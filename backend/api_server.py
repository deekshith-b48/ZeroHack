from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import pandas as pd
import datetime
import json
import ipfshttpclient
import os

# Assuming blockchain_logger.py is in the same directory or accessible via Python path
from backend.blockchain_logger import web3_instance, contract_instance, is_connected_and_configured, connect_and_load_contract, logger as blockchain_logger_instance
from backend.ipfs_uploader import IPFS_API_URL
from threat_detector import ThreatDetectorPipeline
from backend.feedback_logger import log_incident_feedback
from backend.dao_interactor import (
    propose_ip_blacklist, cast_dao_vote, execute_dao_proposal,
    get_dao_proposal_details, get_all_dao_proposals, check_is_voter,
    dao_is_connected_and_configured as dao_connected,
    connect_and_load_dao_contract,
    DAO_SENDER_ACCOUNT_ADDRESS, DAO_SENDER_PRIVATE_KEY
)
# Import analytics functions from incident_db
from backend.incident_db import (
    get_threats_over_time,
    get_attack_type_distribution,
    get_top_offending_ips
)

import config

app = FastAPI(
    title="ZeroHack API",
    description="API for ZeroHack cybersecurity application, including incident reporting, feedback, DAO interactions, and analytics.",
    version="0.1.0"
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- Pydantic Models ---
class TrafficEvent(BaseModel):
    timestamp: Any; source_ip: str; dest_ip: str; dest_port: int
    protocol: Optional[str] = None; flags: Optional[str] = None
    SomeFeature1: Optional[float] = None; SomeFeature2: Optional[float] = None
    SomeFeature3: Optional[float] = None; Label: Optional[str] = None
    class Config: extra = 'allow'

class AnalyzeRequest(BaseModel): events: List[TrafficEvent]
class AnalyzeResponse(BaseModel):
    final_verdict: str; confidence: float; explanation_summary: str
    layer_outputs: List[Dict[str, Any]]; ipfs_cid: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None; incident_id: Optional[str] = None

class UserFeedbackPayload(BaseModel):
    is_false_positive: Optional[bool] = None; is_false_negative: Optional[bool] = None
    corrected_attack_type: Optional[str] = None; notes: Optional[str] = None
class FeedbackRequest(BaseModel):
    incident_identifier: str; original_features: Dict[str, Any]; user_feedback: UserFeedbackPayload

class IPReputationResponse(BaseModel): ip_address: str; reputation_score: int

class DAOProposalRequest(BaseModel):
    proposed_ip: str = Field(..., example="192.168.1.200")
    reason: str = Field(..., description="Reason or IPFS hash of details.", example="QmXyZ...")
class DAOVoteRequest(BaseModel): support: bool
class DAOProposalResponse(BaseModel):
    id: int; ip: str; reason: str; yesVotes: int; noVotes: int
    deadline: int; executed: bool
class DAOTransactionResponse(BaseModel):
    message: str; transaction_hash: Optional[str] = None; proposal_id: Optional[int] = None

# Analytics Pydantic Models
class ThreatOverTimePoint(BaseModel):
    period_start: str
    count: int
class AttackTypeDistributionPoint(BaseModel):
    attack_type: str
    count: int
class TopOffendingIPPoint(BaseModel):
    source_ip: str
    count: int

# --- Pipeline Instance ---
pipeline_instance: Optional[ThreatDetectorPipeline] = None
def get_pipeline():
    global pipeline_instance
    if pipeline_instance is None:
        blockchain_logger_instance.info("Initializing ThreatDetectorPipeline for API server...")
        pipeline_instance = ThreatDetectorPipeline()
    return pipeline_instance

# --- API Endpoints ---
@app.on_event("startup")
async def startup_event():
    if not is_connected_and_configured:
        blockchain_logger_instance.info("API Startup: Connecting to ZeroHackLogger contract...")
        connect_and_load_contract()
    if not dao_connected():
        blockchain_logger_instance.info("API Startup: Connecting to ZeroHackDAO contract...")
        connect_and_load_dao_contract()
    get_pipeline()

# ... (analyze, feedback, incidents, ip_score, DAO endpoints remain the same) ...
@app.post("/api/analyze", response_model=AnalyzeResponse, summary="Analyze Traffic Session for Threats")
async def analyze_traffic_api(request_data: AnalyzeRequest):
    if not request_data.events: raise HTTPException(status_code=400, detail="No events provided.")
    try:
        events_df = pd.DataFrame([e.model_dump(exclude_unset=True) for e in request_data.events])
        if 'timestamp' in events_df.columns: events_df['timestamp'] = pd.to_datetime(events_df['timestamp'], errors='coerce')
    except Exception as e: raise HTTPException(status_code=400, detail=f"Invalid input data: {e}")
    if events_df.empty: raise HTTPException(status_code=400, detail="Processed event data is empty.")
    return get_pipeline().analyze_traffic_session(events_df)

@app.post("/api/feedback/incident", summary="Submit Feedback", status_code=202)
async def submit_incident_feedback_api(feedback_data: FeedbackRequest):
    log_path = log_incident_feedback(feedback_data.model_dump())
    if log_path: return {"message": "Feedback logged.", "id": feedback_data.incident_identifier, "log_path": log_path}
    else: raise HTTPException(status_code=500, detail="Failed to store feedback.")

@app.get("/api/incidents", response_model=List[Dict[str, Any]], summary="Fetch Incidents")
async def get_incidents_api(ip: Optional[str] = Query(None), attack_type: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)):
    if not contract_instance: raise HTTPException(status_code=503, detail="Blockchain service unavailable.")
    try:
        entries = contract_instance.events.IncidentLogged.create_filter(fromBlock='earliest').get_all_entries()
        incidents = [{
            "txHash": e.transactionHash.hex(), "blockNumber": e.blockNumber, "sourceIP": e.args.sourceIP,
            "timestamp": e.args.timestamp, "attackType": e.args.attackType, "explanation": e.args.explanation,
            "ipfsHash": e.args.ipfsHash or None, "reputationScore": e.args.reputationScore
        } for e in entries]
        if ip: incidents = [i for i in incidents if i["sourceIP"] == ip]
        if attack_type: incidents = [i for i in incidents if attack_type.lower() in i["attackType"].lower()]
        incidents.sort(key=lambda x: x["blockNumber"], reverse=True)
        return incidents[:limit]
    except Exception as e: raise HTTPException(status_code=500, detail=f"Failed to fetch incidents: {e}")

@app.get("/api/ip_score/{ip_address}", response_model=IPReputationResponse, summary="Get IP Reputation")
async def get_ip_reputation_api(ip_address: str):
    if not contract_instance: raise HTTPException(status_code=503, detail="Blockchain service unavailable.")
    try:
        score = contract_instance.functions.getReputation(str(ip_address)).call()
        return {"ip_address": ip_address, "reputation_score": score}
    except Exception as e: raise HTTPException(status_code=500, detail=f"Failed to fetch reputation: {e}")

@app.post("/api/dao/proposals", response_model=DAOTransactionResponse, summary="Create DAO Proposal")
async def create_dao_proposal_api(data: DAOProposalRequest):
    if not dao_connected() or not DAO_SENDER_ACCOUNT_ADDRESS or not DAO_SENDER_PRIVATE_KEY:
        raise HTTPException(status_code=503, detail="DAO service/sender not configured.")
    tx_hash = propose_ip_blacklist(data.proposed_ip, data.reason, DAO_SENDER_ACCOUNT_ADDRESS, DAO_SENDER_PRIVATE_KEY)
    if tx_hash: return {"message": "DAO proposal created.", "transaction_hash": tx_hash}
    else: raise HTTPException(status_code=500, detail="Failed to create DAO proposal.")

@app.post("/api/dao/proposals/{proposal_id}/vote", response_model=DAOTransactionResponse, summary="Vote on DAO Proposal")
async def cast_dao_vote_api(proposal_id: int, data: DAOVoteRequest):
    if not dao_connected() or not DAO_SENDER_ACCOUNT_ADDRESS or not DAO_SENDER_PRIVATE_KEY:
        raise HTTPException(status_code=503, detail="DAO service/sender not configured.")
    tx_hash = cast_dao_vote(proposal_id, data.support, DAO_SENDER_ACCOUNT_ADDRESS, DAO_SENDER_PRIVATE_KEY)
    if tx_hash: return {"message": "Vote cast.", "transaction_hash": tx_hash, "proposal_id": proposal_id}
    else: raise HTTPException(status_code=500, detail="Failed to cast vote.")

@app.post("/api/dao/proposals/{proposal_id}/execute", response_model=DAOTransactionResponse, summary="Execute DAO Proposal")
async def execute_dao_proposal_api(proposal_id: int):
    if not dao_connected() or not DAO_SENDER_ACCOUNT_ADDRESS or not DAO_SENDER_PRIVATE_KEY:
        raise HTTPException(status_code=503, detail="DAO service/sender not configured.")
    tx_hash = execute_dao_proposal(proposal_id, DAO_SENDER_ACCOUNT_ADDRESS, DAO_SENDER_PRIVATE_KEY)
    if tx_hash: return {"message": "DAO proposal execution submitted.", "transaction_hash": tx_hash, "proposal_id": proposal_id}
    else: raise HTTPException(status_code=500, detail="Failed to execute DAO proposal.")

@app.get("/api/dao/proposals/{proposal_id}", response_model=Optional[DAOProposalResponse], summary="Get DAO Proposal")
async def get_dao_proposal_api(proposal_id: int):
    if not dao_connected(): raise HTTPException(status_code=503, detail="DAO service unavailable.")
    details = get_dao_proposal_details(proposal_id)
    if not details: raise HTTPException(status_code=404, detail="Proposal not found.")
    return details

@app.get("/api/dao/proposals", response_model=List[DAOProposalResponse], summary="List DAO Proposals")
async def list_dao_proposals_api():
    if not dao_connected(): raise HTTPException(status_code=503, detail="DAO service unavailable.")
    return get_all_dao_proposals()

@app.get("/api/dao/voters/{address}/is_voter", response_model=bool, summary="Check Voter Status")
async def check_is_voter_api(address: str):
    if not dao_connected(): raise HTTPException(status_code=503, detail="DAO service unavailable.")
    is_val = check_is_voter(address)
    if is_val is None: raise HTTPException(status_code=500, detail="Error checking voter status.")
    return is_val

# --- Analytics API Endpoints ---
@app.get("/api/analytics/threats_over_time", response_model=List[ThreatOverTimePoint], summary="Get Threat Trends Over Time")
async def get_threats_over_time_api(period: str = Query("day", enum=["hour", "day", "week", "month"]), limit: int = Query(30, ge=1)):
    data = get_threats_over_time(period=period, limit=limit)
    return data

@app.get("/api/analytics/attack_type_distribution", response_model=List[AttackTypeDistributionPoint], summary="Get Attack Type Distribution")
async def get_attack_type_distribution_api():
    data = get_attack_type_distribution()
    return data

@app.get("/api/analytics/top_offending_ips", response_model=List[TopOffendingIPPoint], summary="Get Top Offending IPs")
async def get_top_offending_ips_api(limit: int = Query(10, ge=1, le=100)):
    data = get_top_offending_ips(limit=limit)
    return data

@app.get("/api/health", summary="Health Check")
async def health_check():
    return {"status": "ok", "blockchain_connected": is_connected_and_configured, "dao_connected": dao_connected()}

@app.get("/api/ipfs/details/{ipfs_cid}", summary="Fetch Incident Details from IPFS")
async def get_ipfs_details(ipfs_cid: str):
    if not IPFS_API_URL: raise HTTPException(status_code=503, detail="IPFS service not configured.")
    client = None
    try:
        client = ipfshttpclient.connect(addr=IPFS_API_URL, session=True)
        data = client.cat(ipfs_cid)
        try: return json.loads(data.decode('utf-8'))
        except json.JSONDecodeError: return {"cid": ipfs_cid, "content_raw": data.decode('utf-8', errors='replace')}
    except ipfshttpclient.exceptions.ConnectionError as e: raise HTTPException(status_code=503, detail=f"IPFS Connection Error: {e}")
    except ipfshttpclient.exceptions.ErrorResponse as e:
        if "not found" in str(e).lower(): raise HTTPException(status_code=404, detail=f"IPFS content not found: {ipfs_cid}")
        raise HTTPException(status_code=500, detail=f"IPFS error: {e}")
    except Exception as e: raise HTTPException(status_code=500, detail=f"Unexpected IPFS error: {e}")
    finally:
        if client: client.close()

if __name__ == "__main__":
    import uvicorn
    config.get_logger("api_server_main").info("Starting FastAPI server for ZeroHack API...") # Use config's logger
    uvicorn.run("api_server:app", host="0.0.0.0", port=8008, reload=True, workers=1)
