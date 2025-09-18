"""
WebSocket manager for real-time updates.
Handles WebSocket connections and broadcasting to connected clients.
"""

import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self):
        # Store active connections by user ID
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Store connections by type (dashboard, incidents, etc.)
        self.connections_by_type: Dict[str, List[WebSocket]] = {
            "dashboard": [],
            "incidents": [],
            "alerts": []
        }
        # Store connection metadata
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None, connection_type: str = "dashboard"):
        """Accept a WebSocket connection."""
        await websocket.accept()
        
        # Add to type-based connections
        if connection_type in self.connections_by_type:
            self.connections_by_type[connection_type].append(websocket)
        
        # Add to user-based connections if user_id provided
        if user_id:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        
        # Store metadata
        self.connection_metadata[websocket] = {
            "user_id": user_id,
            "connection_type": connection_type,
            "connected_at": datetime.utcnow(),
            "last_ping": datetime.utcnow()
        }
        
        logger.info(f"WebSocket connected: {connection_type} (user: {user_id})")
        
        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "message": "Connected to ZeroHack real-time updates",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        metadata = self.connection_metadata.get(websocket, {})
        user_id = metadata.get("user_id")
        connection_type = metadata.get("connection_type")
        
        # Remove from type-based connections
        if connection_type and connection_type in self.connections_by_type:
            if websocket in self.connections_by_type[connection_type]:
                self.connections_by_type[connection_type].remove(websocket)
        
        # Remove from user-based connections
        if user_id and user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            # Clean up empty user connections
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Remove metadata
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]
        
        logger.info(f"WebSocket disconnected: {connection_type} (user: {user_id})")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_type(self, message: Dict[str, Any], connection_type: str):
        """Broadcast a message to all connections of a specific type."""
        if connection_type not in self.connections_by_type:
            logger.warning(f"Unknown connection type: {connection_type}")
            return
        
        disconnected = []
        for websocket in self.connections_by_type[connection_type]:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to broadcast to {connection_type}: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def broadcast_to_user(self, message: Dict[str, Any], user_id: str):
        """Broadcast a message to all connections of a specific user."""
        if user_id not in self.active_connections:
            logger.warning(f"No connections found for user: {user_id}")
            return
        
        disconnected = []
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to broadcast to user {user_id}: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def broadcast_to_all(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients."""
        all_connections = set()
        for connections in self.connections_by_type.values():
            all_connections.update(connections)
        
        disconnected = []
        for websocket in all_connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to broadcast to all: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def send_incident_alert(self, incident_data: Dict[str, Any]):
        """Send incident alert to relevant connections."""
        message = {
            "type": "incident_alert",
            "data": incident_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to dashboard and incidents connections
        await self.broadcast_to_type(message, "dashboard")
        await self.broadcast_to_type(message, "incidents")
        await self.broadcast_to_type(message, "alerts")
    
    async def send_system_status_update(self, status_data: Dict[str, Any]):
        """Send system status update to dashboard connections."""
        message = {
            "type": "system_status",
            "data": status_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_type(message, "dashboard")
    
    async def send_blockchain_event(self, event_data: Dict[str, Any]):
        """Send blockchain event to relevant connections."""
        message = {
            "type": "blockchain_event",
            "data": event_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_type(message, "dashboard")
        await self.broadcast_to_type(message, "incidents")
    
    async def send_ai_analysis_update(self, analysis_data: Dict[str, Any]):
        """Send AI analysis update to relevant connections."""
        message = {
            "type": "ai_analysis",
            "data": analysis_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_type(message, "dashboard")
        await self.broadcast_to_type(message, "alerts")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get statistics about active connections."""
        total_connections = sum(len(connections) for connections in self.connections_by_type.values())
        unique_users = len(self.active_connections)
        
        return {
            "total_connections": total_connections,
            "unique_users": unique_users,
            "connections_by_type": {
                type_name: len(connections) 
                for type_name, connections in self.connections_by_type.items()
            },
            "active_users": list(self.active_connections.keys())
        }
    
    async def ping_connections(self):
        """Send ping to all connections to check if they're alive."""
        ping_message = {
            "type": "ping",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_all(ping_message)
    
    async def cleanup_stale_connections(self):
        """Clean up stale connections that haven't responded to pings."""
        current_time = datetime.utcnow()
        stale_connections = []
        
        for websocket, metadata in self.connection_metadata.items():
            last_ping = metadata.get("last_ping", current_time)
            # Consider connection stale if no ping response in 5 minutes
            if (current_time - last_ping).total_seconds() > 300:
                stale_connections.append(websocket)
        
        for websocket in stale_connections:
            logger.info("Cleaning up stale connection")
            self.disconnect(websocket)

# Global connection manager instance
manager = ConnectionManager()
