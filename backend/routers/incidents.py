from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Import service functions
from backend.services.blockchain_logger import contract_instance as logger_contract
from backend.services.blockchain_response_engine import response_contract_instance, get_quarantine_status
from backend.services.incident_db import get_incidents_by_ip
from backend.services.dao_interactor import get_dao_proposal_details # Example for future use

router = APIRouter()

# --- Pydantic Models for this router ---
class IncidentResponse(BaseModel):
    txHash: str
    blockNumber: int
    sourceIP: str
    timestamp: str
    attackType: str
    explanation: str
    ipfsHash: Optional[str] = None
    reputationScore: int

class VerdictResponse(BaseModel):
    ip_address: str
    quarantine_status: Optional[bool] = None
    reputation_score: Optional[int] = None
    recent_incidents: List[Dict[str, Any]] = []


@router.get("/api/incidents", response_model=List[IncidentResponse], summary="Fetch Logged Cybersecurity Incidents")
async def get_incidents_api(ip: Optional[str] = Query(None), type: Optional[str] = Query(None), limit: int = Query(100, ge=1)):
    if not logger_contract:
        raise HTTPException(status_code=503, detail="Logger contract service unavailable.")
    try:
        event_filter = logger_contract.events.IncidentLogged.create_filter(fromBlock='earliest')
        log_entries = event_filter.get_all_entries()
        incidents = []
        for entry in log_entries:
            args = entry.args
            incidents.append({
                "txHash": entry.transactionHash.hex(), "blockNumber": entry.blockNumber,
                "sourceIP": args.sourceIP, "timestamp": args.timestamp, "attackType": args.attackType,
                "explanation": args.explanation, "ipfsHash": args.ipfsHash or None,
                "reputationScore": args.reputationScore
            })

        if ip: incidents = [i for i in incidents if i["sourceIP"] == ip]
        if type: incidents = [i for i in incidents if type.lower() in i["attackType"].lower()]

        incidents.sort(key=lambda x: x["blockNumber"], reverse=True)
        return incidents[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch incidents: {str(e)}")


@router.get("/api/verdict/{ip_address}", response_model=VerdictResponse, summary="Get a Comprehensive Verdict for an IP")
async def get_verdict_for_ip(ip_address: str):
    if not response_contract_instance or not logger_contract:
        raise HTTPException(status_code=503, detail="A required blockchain service is unavailable.")

    try:
        quarantine_status = get_quarantine_status(ip_address)
        reputation_score = logger_contract.functions.getReputation(str(ip_address)).call()
        recent_incidents_for_ip = get_incidents_by_ip(ip_address, limit=5)

        return {
            "ip_address": ip_address,
            "quarantine_status": quarantine_status,
            "reputation_score": reputation_score,
            "recent_incidents": recent_incidents_for_ip
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error gathering verdict for {ip_address}: {str(e)}")
