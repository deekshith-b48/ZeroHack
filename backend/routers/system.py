from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

# Import service-level status checkers
from backend.services.blockchain_logger import is_connected_and_configured as is_logger_connected
from backend.services.blockchain_response_engine import is_connected_and_configured as is_response_engine_connected
from backend.services.dao_interactor import dao_is_connected_and_configured as is_dao_connected
from backend.services.ws_broadcaster import manager as ws_manager
# We need a way to check IPFS connection status, can add a function to ipfs_uploader.py
# from backend.services.ipfs_uploader import check_ipfs_connection

router = APIRouter()

class SystemStatusResponse(BaseModel):
    status: str
    logger_contract_connection: str
    response_engine_connection: str
    dao_connection: str
    active_ws_clients: int
    # ipfs_connection: str # To be added

@router.get("/api/status", response_model=SystemStatusResponse, summary="Get System Health Check")
async def get_system_status():
    """
    Provides a health check of the ZeroHack backend services, including
    blockchain connections and active WebSocket clients.
    """
    # ipfs_status = "connected" if check_ipfs_connection() else "disconnected" # Example
    return {
        "status": "ok",
        "logger_contract_connection": "connected" if is_logger_connected() else "disconnected",
        "response_engine_connection": "connected" if is_response_engine_connected() else "disconnected",
        "dao_connection": "connected" if is_dao_connected() else "disconnected",
        "active_ws_clients": len(ws_manager.active_connections),
        # "ipfs_connection": ipfs_status
    }
