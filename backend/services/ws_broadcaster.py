from fastapi import WebSocket
from typing import List
import logging

# It's better to use a standard logger instance
logger = logging.getLogger("uvicorn.error") # Piggyback on uvicorn's logger

class ConnectionManager:
    """
    Manages active WebSocket connections for broadcasting messages.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accepts and stores a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket client connected: {websocket.client}. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Removes a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected: {websocket.client}. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        """
        Broadcasts a message to all active WebSocket connections.
        Handles disconnections that may occur during broadcast.
        """
        logger.info(f"Broadcasting message to {len(self.active_connections)} client(s)...")
        # A copy is made to handle cases where a client disconnects during broadcast
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception:
                # If sending fails, assume client disconnected and remove them
                self.disconnect(connection)

# Create a single, global instance of the manager to be used across the application
manager = ConnectionManager()
