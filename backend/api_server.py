from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import pandas as pd
import datetime
import json
import ipfshttpclient
import os
import asyncio

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
from backend.incident_db import (
    get_threats_over_time,
    get_attack_type_distribution,
    get_top_offending_ips
)
# Import new response engine functions
from backend.blockchain_response_engine import (
    report_incident as report_incident_to_chain,
    get_quarantine_status,
    response_contract_instance, # Use this for quarantine check
    connect_and_load_contract as connect_response_contract # Alias to be clear
)

import config

app = FastAPI(
    title="ZeroHack API",
    description="API for ZeroHack cybersecurity application, including incident reporting, feedback, DAO interactions, and analytics.",
    version="0.1.0"
)

origins = [ "http://localhost:3000", "http://127.0.0.1:3000" ]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    async def broadcast(self, message: str):
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)
manager = ConnectionManager()

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
class ThreatOverTimePoint(BaseModel): period_start: str; count: int
class AttackTypeDistributionPoint(BaseModel): attack_type: str; count: int
class TopOffendingIPPoint(BaseModel): source_ip: str; count: int
class QuarantineStatusResponse(BaseModel): ip_address: str; is_quarantined: bool

# --- Pipeline Instance ---
pipeline_instance: Optional[ThreatDetectorPipeline] = None
def get_pipeline():
    global pipeline_instance
    if pipeline_instance is None:
        blockchain_logger_instance.info("Initializing ThreatDetectorPipeline for API server...")
        pipeline_instance = ThreatDetectorPipeline()
    return pipeline_instance

# --- Background Task ---
async def event_listener_background_task():
    logger = config.get_logger("EventBGTask")
    while True:
        try:
            if not response_contract_instance: connect_response_contract()
            if response_contract_instance:
                event_filter_admin = response_contract_instance.events.AdminAlert.create_filter(fromBlock='latest')
                event_filter_quarantine = response_contract_instance.events.IPQuarantined.create_filter(fromBlock='latest')
                logger.info("Background listener started for AdminAlert and IPQuarantined events.")
                while True:
                    for event in event_filter_admin.get_new_entries():
                        logger.info(f"Caught AdminAlert event: {event.args}")
                        await manager.broadcast(json.dumps({"event_type": "AdminAlert", "data": dict(event.args)}))
                    for event in event_filter_quarantine.get_new_entries():
                        logger.info(f"Caught IPQuarantined event: {event.args}")
                        await manager.broadcast(json.dumps({"event_type": "IPQuarantined", "data": dict(event.args)}))
                    await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"Error in event listener task: {e}. Reconnecting in 15s.", exc_info=True)
            await asyncio.sleep(15)

# --- API Endpoints ---
@app.on_event("startup")
async def startup_event():
    # Connect to both contracts on startup
    connect_and_load_contract()
    connect_and_load_dao_contract()
    connect_response_contract()
    get_pipeline()
    asyncio.create_task(event_listener_background_task())

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect: manager.disconnect(websocket)

# ... (Previous endpoints: analyze, feedback, incidents, ip_score, DAO endpoints, analytics) ...
@app.post("/api/analyze", response_model=AnalyzeResponse, summary="Analyze Traffic")
async def analyze_traffic_api(request_data: AnalyzeRequest):
    if not request_data.events: raise HTTPException(400, "No events provided.")
    try:
        df = pd.DataFrame([e.model_dump(exclude_unset=True) for e in request_data.events])
        if 'timestamp' in df.columns: df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        return get_pipeline().analyze_traffic_session(df)
    except Exception as e: raise HTTPException(500, f"Analysis error: {e}")

@app.post("/api/feedback/incident", summary="Submit Feedback", status_code=202)
async def submit_incident_feedback_api(data: FeedbackRequest):
    log_path = log_incident_feedback(data.model_dump())
    if log_path: return {"message": "Feedback logged.", "id": data.incident_identifier, "log_path": log_path}
    else: raise HTTPException(500, "Failed to store feedback.")

@app.get("/api/incidents", response_model=List[Dict[str, Any]], summary="Fetch Incidents")
async def get_incidents_api(ip: Optional[str] = Query(None), type: Optional[str] = Query(None), limit: int = Query(100, ge=1)):
    if not contract_instance: raise HTTPException(503, "Logger contract unavailable.")
    try:
        entries = contract_instance.events.IncidentLogged.create_filter(fromBlock='earliest').get_all_entries()
        incidents = [{"txHash": e.transactionHash.hex(), "blockNumber": e.blockNumber, **e.args} for e in entries]
        if ip: incidents = [i for i in incidents if i["sourceIP"] == ip]
        if type: incidents = [i for i in incidents if type.lower() in i["attackType"].lower()]
        return sorted(incidents, key=lambda x: x["blockNumber"], reverse=True)[:limit]
    except Exception as e: raise HTTPException(500, f"Failed to fetch incidents: {e}")

@app.get("/api/ip_score/{ip_address}", response_model=IPReputationResponse, summary="Get IP Reputation")
async def get_ip_reputation_api(ip_address: str):
    if not contract_instance: raise HTTPException(503, "Logger contract unavailable.")
    try:
        score = contract_instance.functions.getReputation(str(ip_address)).call()
        return {"ip_address": ip_address, "reputation_score": score}
    except Exception as e: raise HTTPException(500, f"Failed to fetch reputation: {e}")

@app.get("/api/quarantine_status/{ip_address}", response_model=QuarantineStatusResponse, summary="Get IP Quarantine Status")
async def get_quarantine_status_api(ip_address: str):
    if not response_contract_instance: raise HTTPException(503, "Response Engine contract unavailable.")
    try:
        status = get_quarantine_status(ip_address)
        if status is None: raise Exception("Failed to retrieve status from blockchain.")
        return {"ip_address": ip_address, "is_quarantined": status}
    except Exception as e: raise HTTPException(500, f"Failed to get quarantine status: {e}")

# ... (DAO, Analytics, Health, IPFS endpoints) ...
@app.get("/api/health", summary="Health Check")
async def health_check():
    return {"status": "ok", "logger_connected": is_connected_and_configured, "dao_connected": dao_connected()}

if __name__ == "__main__":
    import uvicorn
    config.get_logger("api_server_main").info("Starting FastAPI server for ZeroHack API...")
    uvicorn.run("api_server:app", host="0.0.0.0", port=8008, reload=True)
