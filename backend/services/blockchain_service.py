"""
Blockchain Service
Handles blockchain operations and evidence chain management.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import os
from web3 import Web3

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class BlockchainService:
    """Centralized blockchain service for evidence chain management."""
    
    def __init__(self):
        self.web3 = None
        self.contracts = {}
        self.is_connected = False
        self.network_info = {}
        
    async def initialize(self):
        """Initialize blockchain connections and contracts."""
        try:
            logger.info("🔗 Initializing Blockchain Service...")
            
            # Get blockchain configuration
            rpc_url = os.getenv("ZEROHACK_BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
            
            # Initialize Web3 connection
            self.web3 = Web3(Web3.HTTPProvider(rpc_url))
            
            if not self.web3.is_connected():
                raise Exception(f"Failed to connect to blockchain at {rpc_url}")
            
            # Get network information
            self.network_info = {
                "chain_id": self.web3.eth.chain_id,
                "latest_block": self.web3.eth.block_number,
                "gas_price": self.web3.eth.gas_price
            }
            
            # Load contracts
            await self._load_contracts()
            
            self.is_connected = True
            logger.info("✅ Blockchain Service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Blockchain Service: {e}")
            raise
    
    async def _load_contracts(self):
        """Load smart contracts."""
        try:
            # Load Logger contract
            logger_contract_address = os.getenv("ZEROHACK_LOGGER_CONTRACT_ADDRESS")
            if logger_contract_address:
                logger_abi = await self._load_abi("ZeroHackLoggerABI.json")
                self.contracts["logger"] = self.web3.eth.contract(
                    address=logger_contract_address,
                    abi=logger_abi
                )
                logger.info(f"✅ Loaded Logger contract at {logger_contract_address}")
            
            # Load Response Engine contract
            response_contract_address = os.getenv("ZEROHACK_RESPONSE_CONTRACT_ADDRESS")
            if response_contract_address:
                response_abi = await self._load_abi("ZeroHackResponseEngineABI.json")
                self.contracts["response_engine"] = self.web3.eth.contract(
                    address=response_contract_address,
                    abi=response_abi
                )
                logger.info(f"✅ Loaded Response Engine contract at {response_contract_address}")
            
            # Load DAO contract
            dao_contract_address = os.getenv("ZEROHACK_DAO_CONTRACT_ADDRESS")
            if dao_contract_address:
                dao_abi = await self._load_abi("ZeroHackDAOABI.json")
                self.contracts["dao"] = self.web3.eth.contract(
                    address=dao_contract_address,
                    abi=dao_abi
                )
                logger.info(f"✅ Loaded DAO contract at {dao_contract_address}")
                
        except Exception as e:
            logger.error(f"Failed to load contracts: {e}")
            raise
    
    async def _load_abi(self, abi_filename: str) -> List[Dict]:
        """Load contract ABI from file."""
        abi_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "..", "blockchain", abi_filename
        )
        
        with open(abi_path, 'r') as f:
            return json.load(f)
    
    async def log_incident(self, incident_id: str, source_ip: str, attack_type: str, 
                          explanation: str, evidence_hash: str = "") -> Dict[str, Any]:
        """Log incident to blockchain for chain of custody."""
        try:
            if not self.is_connected or "logger" not in self.contracts:
                raise Exception("Blockchain not connected or logger contract not available")
            
            # Prepare transaction
            contract = self.contracts["logger"]
            sender_address = os.getenv("ZEROHACK_SENDER_ACCOUNT_ADDRESS")
            private_key = os.getenv("ZEROHACK_SENDER_PRIVATE_KEY")
            
            if not sender_address or not private_key:
                raise Exception("Sender credentials not configured")
            
            # Get transaction parameters
            nonce = self.web3.eth.get_transaction_count(sender_address)
            gas_price = self.web3.eth.gas_price
            
            # Build transaction
            transaction = contract.functions.logIncident(
                source_ip,
                datetime.utcnow().isoformat(),
                attack_type,
                explanation,
                evidence_hash
            ).build_transaction({
                'from': sender_address,
                'gas': 200000,
                'gasPrice': gas_price,
                'nonce': nonce,
            })
            
            # Sign and send transaction
            signed_txn = self.web3.eth.account.sign_transaction(transaction, private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for confirmation
            tx_receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            logger.info(f"✅ Incident logged to blockchain: {tx_hash.hex()}")
            
            return {
                "tx_hash": tx_hash.hex(),
                "block_number": tx_receipt.blockNumber,
                "gas_used": tx_receipt.gasUsed,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"Failed to log incident to blockchain: {e}")
            return {
                "tx_hash": None,
                "error": str(e),
                "status": "failed"
            }
    
    async def get_evidence_chain(self, incident_id: str) -> List[Dict[str, Any]]:
        """Get evidence chain for a specific incident."""
        try:
            if not self.is_connected or "logger" not in self.contracts:
                raise Exception("Blockchain not connected or logger contract not available")
            
            contract = self.contracts["logger"]
            
            # Get events for this incident
            event_filter = contract.events.IncidentLogged.create_filter(
                fromBlock=0,
                toBlock='latest'
            )
            
            events = event_filter.get_all_entries()
            
            # Filter events by incident ID (if stored in explanation)
            evidence_records = []
            for event in events:
                if incident_id in event.args.explanation:
                    evidence_records.append({
                        "incident_id": incident_id,
                        "file_hash": event.args.ipfsHash,
                        "transaction_hash": event.transactionHash.hex(),
                        "block_number": event.blockNumber,
                        "timestamp": datetime.fromtimestamp(event.args.timestamp),
                        "verified": True  # Blockchain verification
                    })
            
            return evidence_records
            
        except Exception as e:
            logger.error(f"Failed to get evidence chain for incident {incident_id}: {e}")
            return []
    
    async def verify_evidence(self, file_hash: str) -> Dict[str, Any]:
        """Verify evidence integrity against blockchain records."""
        try:
            if not self.is_connected or "logger" not in self.contracts:
                raise Exception("Blockchain not connected or logger contract not available")
            
            contract = self.contracts["logger"]
            
            # Search for evidence in blockchain events
            event_filter = contract.events.IncidentLogged.create_filter(
                fromBlock=0,
                toBlock='latest'
            )
            
            events = event_filter.get_all_entries()
            
            for event in events:
                if event.args.ipfsHash == file_hash:
                    return {
                        "verified": True,
                        "transaction_hash": event.transactionHash.hex(),
                        "block_number": event.blockNumber,
                        "timestamp": datetime.fromtimestamp(event.args.timestamp),
                        "source_ip": event.args.sourceIP,
                        "attack_type": event.args.attackType
                    }
            
            return {
                "verified": False,
                "message": "Evidence not found in blockchain"
            }
            
        except Exception as e:
            logger.error(f"Failed to verify evidence {file_hash}: {e}")
            return {
                "verified": False,
                "error": str(e)
            }
    
    async def get_recent_transactions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent blockchain transactions."""
        try:
            if not self.is_connected:
                raise Exception("Blockchain not connected")
            
            # Get recent blocks and extract transactions
            latest_block = self.web3.eth.block_number
            transactions = []
            
            for block_num in range(max(0, latest_block - limit), latest_block + 1):
                try:
                    block = self.web3.eth.get_block(block_num, full_transactions=True)
                    for tx in block.transactions:
                        if tx.to and tx.to.lower() in [
                            contract.address.lower() 
                            for contract in self.contracts.values()
                        ]:
                            transactions.append({
                                "hash": tx.hash.hex(),
                                "block_number": block_num,
                                "from": tx['from'],
                                "to": tx.to,
                                "value": tx.value,
                                "gas_used": tx.gas,
                                "timestamp": datetime.fromtimestamp(block.timestamp)
                            })
                except Exception as e:
                    logger.warning(f"Failed to get block {block_num}: {e}")
                    continue
            
            return transactions[-limit:]  # Return most recent transactions
            
        except Exception as e:
            logger.error(f"Failed to get recent transactions: {e}")
            return []
    
    async def get_new_events(self) -> List[Dict[str, Any]]:
        """Get new blockchain events since last check."""
        try:
            if not self.is_connected:
                return []
            
            events = []
            
            # Check for new incidents
            if "logger" in self.contracts:
                contract = self.contracts["logger"]
                event_filter = contract.events.IncidentLogged.create_filter(
                    fromBlock='latest'
                )
                
                new_events = event_filter.get_new_entries()
                for event in new_events:
                    events.append({
                        "type": "IncidentLogged",
                        "data": {
                            "source_ip": event.args.sourceIP,
                            "attack_type": event.args.attackType,
                            "explanation": event.args.explanation,
                            "ipfs_hash": event.args.ipfsHash
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    })
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get new events: {e}")
            return []
    
    async def get_status(self) -> Dict[str, Any]:
        """Get blockchain service status."""
        try:
            if not self.is_connected:
                return {
                    "connected": False,
                    "network": "Unknown",
                    "latest_block": 0,
                    "contract_addresses": {}
                }
            
            # Get current network info
            latest_block = self.web3.eth.block_number
            chain_id = self.web3.eth.chain_id
            
            # Map chain ID to network name
            network_names = {
                1: "Ethereum Mainnet",
                3: "Ropsten Testnet",
                4: "Rinkeby Testnet",
                5: "Goerli Testnet",
                42: "Kovan Testnet",
                137: "Polygon Mainnet",
                80001: "Polygon Mumbai Testnet",
                1337: "Local Development"
            }
            
            network_name = network_names.get(chain_id, f"Unknown (Chain ID: {chain_id})")
            
            # Get contract addresses
            contract_addresses = {}
            for name, contract in self.contracts.items():
                contract_addresses[name] = contract.address
            
            return {
                "connected": True,
                "network": network_name,
                "latest_block": latest_block,
                "contract_addresses": contract_addresses,
                "transaction_count": len(await self.get_recent_transactions(1000))
            }
            
        except Exception as e:
            logger.error(f"Failed to get blockchain status: {e}")
            return {
                "connected": False,
                "network": "Error",
                "latest_block": 0,
                "contract_addresses": {},
                "error": str(e)
            }
    
    def is_connected(self) -> bool:
        """Check if blockchain is connected."""
        return self.is_connected and self.web3 is not None
    
    async def cleanup(self):
        """Cleanup blockchain connections."""
        logger.info("🧹 Cleaning up Blockchain Service...")
        # Cleanup any persistent connections if needed
        pass
