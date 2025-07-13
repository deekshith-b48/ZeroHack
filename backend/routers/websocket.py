from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_broadcaster import manager
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

@router.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # The client can send data, but for now, we just keep the connection open
            # to receive broadcasts from the server.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"Client {websocket.client} disconnected from WebSocket.")
    except Exception as e:
        logger.error(f"An error occurred in the WebSocket connection for {websocket.client}: {e}")
        manager.disconnect(websocket)
