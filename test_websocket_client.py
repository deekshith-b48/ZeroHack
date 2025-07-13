import asyncio
import websockets
import json
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Get WebSocket URL from environment or use a default
WS_URL = os.getenv("ZERO_HACK_WS_URL", "ws://localhost:8008/ws/alerts")

async def listen_to_alerts():
    """Connects to the WebSocket server and listens for alert messages."""
    print(f"--- ZeroHack WebSocket Test Client ---")
    print(f"Attempting to connect to: {WS_URL}")

    while True: # Add a reconnection loop
        try:
            async with websockets.connect(WS_URL) as websocket:
                print(f"[✅] Successfully connected to {WS_URL}")
                print("[...] Waiting for real-time alerts from the server...")
                print("(To trigger alerts, use the /api/analyze endpoint with threat data while this client is running)")

                while True:
                    try:
                        message = await websocket.recv()
                        print("\n--- [!] New Alert Received! ---")
                        try:
                            # Pretty print the JSON message
                            data = json.loads(message)
                            print(json.dumps(data, indent=2))
                        except json.JSONDecodeError:
                            print(f"Received non-JSON message: {message}")
                        print("---------------------------------")

                    except websockets.ConnectionClosed:
                        print("[❌] Connection closed by server.")
                        break # Exit inner loop to trigger reconnection

        except (websockets.exceptions.ConnectionClosedError, ConnectionRefusedError) as e:
            print(f"[❌] Connection failed: {e}. Is the FastAPI server running?")
        except Exception as e:
            print(f"[❌] An unexpected error occurred: {e}")

        print("Retrying connection in 10 seconds...")
        await asyncio.sleep(10)


if __name__ == "__main__":
    try:
        asyncio.run(listen_to_alerts())
    except KeyboardInterrupt:
        print("\nTest client stopped by user.")
    except Exception as e:
        print(f"Failed to start test client: {e}")
