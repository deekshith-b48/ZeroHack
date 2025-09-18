from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd

# Import the pipeline instance getter from the main app file
# This avoids circular dependencies if routers need access to app-level state/singletons
from backend.api_server import get_pipeline, logger

router = APIRouter()

# --- Pydantic Models for this router ---
class TrafficEvent(BaseModel):
    timestamp: Any
    source_ip: str
    dest_ip: str
    dest_port: int
    protocol: Optional[str] = None
    flags: Optional[str] = None
    SomeFeature1: Optional[float] = None
    SomeFeature2: Optional[float] = None
    SomeFeature3: Optional[float] = None
    Label: Optional[str] = None
    class Config:
        extra = 'allow'

class AnalyzeRequest(BaseModel):
    events: List[TrafficEvent]

class AnalyzeResponse(BaseModel):
    final_verdict: str
    confidence: float
    explanation_summary: str
    layer_outputs: List[Dict[str, Any]]
    ipfs_cid: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None
    incident_id: Optional[str] = None

@router.post("/api/analyze",
             response_model=AnalyzeResponse,
             summary="Analyze Traffic Session for Threats")
async def analyze_traffic_api(request_data: AnalyzeRequest):
    if not request_data.events:
        raise HTTPException(status_code=400, detail="No events provided in the request.")

    try:
        events_dict_list = [event.model_dump(exclude_unset=True) for event in request_data.events]
        traffic_df = pd.DataFrame(events_dict_list)
        if 'timestamp' in traffic_df.columns:
            traffic_df['timestamp'] = pd.to_datetime(traffic_df['timestamp'], errors='coerce')
    except Exception as e:
        logger.error(f"Error converting request data to DataFrame: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Invalid input data format: {e}")

    if traffic_df.empty:
        raise HTTPException(status_code=400, detail="DataFrame became empty after processing input events.")

    pipeline = get_pipeline()
    try:
        analysis_result = pipeline.analyze_traffic_session(traffic_df)
        return analysis_result
    except Exception as e:
        logger.error(f"Error during traffic analysis pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error during threat analysis: {e}")
