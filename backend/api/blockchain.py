"""
Blockchain API
Handles blockchain operations and evidence chain management.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from backend.services.blockchain_service import BlockchainService
from backend.utils.security import get_current_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class EvidenceRecord(BaseModel):
    """Evidence record model."""
    incident_id: str
    file_hash: str
    transaction_hash: str
    block_number: int
    timestamp: datetime
    verified: bool

class BlockchainStatus(BaseModel):
    """Blockchain connection status."""
    connected: bool
    network: str
    latest_block: int
    contract_address: str

@router.get("/status", response_model=BlockchainStatus)
async def get_blockchain_status(
    blockchain_service: BlockchainService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get blockchain connection status."""
    try:
        status = await blockchain_service.get_status()
        return BlockchainStatus(**status)
        
    except Exception as e:
        logger.error(f"Failed to get blockchain status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get blockchain status")

@router.get("/evidence/{incident_id}", response_model=List[EvidenceRecord])
async def get_evidence_chain(
    incident_id: str,
    blockchain_service: BlockchainService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get evidence chain for a specific incident."""
    try:
        evidence_records = await blockchain_service.get_evidence_chain(incident_id)
        
        return [
            EvidenceRecord(
                incident_id=record["incident_id"],
                file_hash=record["file_hash"],
                transaction_hash=record["transaction_hash"],
                block_number=record["block_number"],
                timestamp=record["timestamp"],
                verified=record["verified"]
            )
            for record in evidence_records
        ]
        
    except Exception as e:
        logger.error(f"Failed to get evidence chain for incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get evidence chain")

@router.post("/verify-evidence")
async def verify_evidence(
    file_hash: str,
    blockchain_service: BlockchainService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Verify evidence integrity against blockchain records."""
    try:
        verification_result = await blockchain_service.verify_evidence(file_hash)
        return verification_result
        
    except Exception as e:
        logger.error(f"Failed to verify evidence {file_hash}: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify evidence")

@router.get("/transactions")
async def get_recent_transactions(
    limit: int = 50,
    blockchain_service: BlockchainService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get recent blockchain transactions."""
    try:
        transactions = await blockchain_service.get_recent_transactions(limit)
        return transactions
        
    except Exception as e:
        logger.error(f"Failed to get recent transactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recent transactions")
