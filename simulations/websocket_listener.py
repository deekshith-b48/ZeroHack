import asyncio
import json
import os
from web3 import Web3
from web3.middleware import geth_poa_middleware
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import config

logger = config.get_logger("websocket_listener")

# --- Configuration ---
# Note: Web3.py requires a WebSocket endpoint for event filtering (wss:// or ws://)
WSS_RPC_URL = os.getenv("ZERO_HACK_BLOCKCHAIN_WSS_URL", "ws://127.0.0.1:8545")
CONTRACT_ADDRESS_STR = os.getenv("ZERO_HACK_RESPONSE_CONTRACT_ADDRESS")
ABI_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blockchain", "ZeroHackResponseEngineABI.json")
RECONNECT_DELAY_SECONDS = 10

def get_contract_instance(w3: Web3) -> Optional[Any]:
    """Loads and returns a contract instance."""
    if not CONTRACT_ADDRESS_STR:
        logger.error("ZERO_HACK_RESPONSE_CONTRACT_ADDRESS not set.")
        return None
    try:
        with open(ABI_FILE_PATH, 'r') as f:
            abi = json.load(f)
        checksum_address = w3.to_checksum_address(CONTRACT_ADDRESS_STR)
        return w3.eth.contract(address=checksum_address, abi=abi)
    except Exception as e:
        logger.error(f"Failed to load contract instance: {e}")
        return None

async def event_listener_log_loop(event_filter, poll_interval_seconds: int):
    """The loop that polls for new events and logs them."""
    while True:
        try:
            for event in event_filter.get_new_entries():
                logger.info(f"--- New Event Received: {event.event} ---")
                logger.info(f"  Transaction Hash: {event.transactionHash.hex()}")
                logger.info(f"  Block Number: {event.blockNumber}")
                # Pretty print event arguments
                formatted_args = json.dumps(dict(event.args), indent=2)
                logger.info(f"  Event Data:\n{formatted_args}")
                logger.info("----------------------------------------")

            await asyncio.sleep(poll_interval_seconds)

        except Exception as e:
            logger.error(f"Error in event polling loop: {e}", exc_info=True)
            # Break the loop to allow the main loop to handle reconnection
            break

async def main_listener():
    """Main function to establish connection and manage the event listener loop."""
    logger.info("Starting WebSocket Event Listener...")
    if not WSS_RPC_URL.startswith(("ws://", "wss://")):
        logger.error(f"Invalid WebSocket URL: {WSS_RPC_URL}. It must start with 'ws://' or 'wss://'.")
        return

    while True: # Main reconnection loop
        try:
            logger.info(f"Attempting to connect to WebSocket provider at {WSS_RPC_URL}...")
            w3 = Web3(Web3.WebsocketProvider(WSS_RPC_URL))
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            if not w3.is_connected():
                raise ConnectionError("Initial connection failed.")
            logger.info("Successfully connected to WebSocket provider.")

            contract = get_contract_instance(w3)
            if not contract:
                logger.error("Could not load contract. Retrying after delay...")
                await asyncio.sleep(RECONNECT_DELAY_SECONDS)
                continue

            # Create filters for the events we care about
            # We can listen to multiple events. For this demo, let's listen to two.
            admin_alert_filter = contract.events.AdminAlert.create_filter(fromBlock='latest')
            ip_quarantined_filter = contract.events.IPQuarantined.create_filter(fromBlock='latest')

            logger.info("Event filters created for AdminAlert and IPQuarantined. Listening for new events...")

            # Run two listeners concurrently
            listener_task_1 = asyncio.create_task(event_listener_log_loop(admin_alert_filter, 2))
            listener_task_2 = asyncio.create_task(event_listener_log_loop(ip_quarantined_filter, 2))

            # This will run until one of the listeners exits due to an error
            done, pending = await asyncio.wait(
                [listener_task_1, listener_task_2],
                return_when=asyncio.FIRST_COMPLETED,
            )

            # If a task completed (likely due to error), cancel others and restart the main loop
            for task in pending:
                task.cancel()
            logger.warning("Listener loop exited. Attempting to reconnect...")

        except ConnectionRefusedError:
            logger.error("Connection refused. Is the Ethereum node running and the WebSocket endpoint enabled?")
        except Exception as e:
            logger.error(f"An unexpected error occurred in the main listener: {e}", exc_info=True)

        logger.info(f"Retrying connection in {RECONNECT_DELAY_SECONDS} seconds...")
        await asyncio.sleep(RECONNECT_DELAY_SECONDS)


if __name__ == "__main__":
    logger.info("This script listens for events from the ZeroHackResponseEngine smart contract.")
    logger.info("To test, deploy the contract and run this script.")
    logger.info("Then, trigger the `reportIncident` function on the contract (e.g., using `test_smart_contract_integration.py`).")
    logger.info("Ensure ZERO_HACK_BLOCKCHAIN_WSS_URL and ZERO_HACK_RESPONSE_CONTRACT_ADDRESS are set in your .env file.")

    try:
        asyncio.run(main_listener())
    except KeyboardInterrupt:
        logger.info("Listener stopped by user.")
    except Exception as e:
        logger.error(f"Listener failed to start: {e}", exc_info=True)
