"""
ZeroHack Backend - Central API Gateway
Production-ready FastAPI application with integrated ML, blockchain, and security services.
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse
import asyncio
import logging
import os
import json
from datetime import datetime
from contextlib import asynccontextmanager

from backend.exceptions import ZeroHackException, handle_zerohack_exception

# Import routers
from backend.api import incidents, auth, ai_inference, blockchain, notifications, dashboard
from backend.services.ai_service import AIService
from backend.services.blockchain_service import BlockchainService
from backend.services.notification_service import NotificationService
from backend.services.websocket_manager import manager as ws_manager
from backend.utils.logger import get_logger
from backend.db.database import init_db

logger = get_logger(__name__)

# Global service instances
ai_service = None
blockchain_service = None
notification_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown tasks."""
    global ai_service, blockchain_service, notification_service
    
    # Startup
    logger.info("🚀 Starting ZeroHack Backend Services...")
    
    try:
        # Initialize database
        await init_db()
        logger.info("✅ Database initialized")
        
        # Initialize AI service (loads models)
        ai_service = AIService()
        await ai_service.initialize()
        logger.info("✅ AI Service initialized")
        
        # Initialize blockchain service
        blockchain_service = BlockchainService()
        await blockchain_service.initialize()
        logger.info("✅ Blockchain Service initialized")
        
        # Initialize notification service
        notification_service = NotificationService()
        await notification_service.initialize()
        logger.info("✅ Notification Service initialized")
        
        # Start background tasks
        asyncio.create_task(blockchain_event_listener())
        asyncio.create_task(websocket_cleanup_task())
        logger.info("✅ Background tasks started")
        
        logger.info("🎉 All services initialized successfully!")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down ZeroHack Backend Services...")
    if ai_service:
        await ai_service.cleanup()
    if blockchain_service:
        await blockchain_service.cleanup()
    if notification_service:
        await notification_service.cleanup()
    logger.info("✅ Shutdown complete")

# Create FastAPI app with lifespan management
app = FastAPI(
    title="ZeroHack API",
    description="Production-ready cybersecurity platform with AI threat detection, blockchain forensics, and autonomous response",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.zerohack.local"]
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://zerohack.local",
        "https://*.zerohack.local"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Security scheme
security = HTTPBearer()

# Global exception handler
@app.exception_handler(ZeroHackException)
async def zerohack_exception_handler(request: Request, exc: ZeroHackException):
    """Handle custom ZeroHack exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=handle_zerohack_exception(exc)
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": "HTTPException",
                "message": exc.detail,
                "status_code": exc.status_code
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "type": "InternalServerError",
                "message": "An unexpected error occurred",
                "status_code": 500
            }
        }
    )

# Dependency to get service instances
def get_ai_service() -> AIService:
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI Service not available")
    return ai_service

def get_blockchain_service() -> BlockchainService:
    if not blockchain_service:
        raise HTTPException(status_code=503, detail="Blockchain Service not available")
    return blockchain_service

def get_notification_service() -> NotificationService:
    if not notification_service:
        raise HTTPException(status_code=503, detail="Notification Service not available")
    return notification_service

# Background task for blockchain event listening
async def blockchain_event_listener():
    """Listen for blockchain events and broadcast via WebSocket."""
    logger.info("🔗 Starting blockchain event listener...")
    
    while True:
        try:
            if blockchain_service and blockchain_service.is_connected():
                # Listen for new incidents
                events = await blockchain_service.get_new_events()
                for event in events:
                    await ws_manager.broadcast({
                        "event_type": event.get("type", "UnknownEvent"),
                        "data": event.get("data", {}),
                        "timestamp": event.get("timestamp")
                    })
            
            await asyncio.sleep(5)  # Check every 5 seconds
            
        except Exception as e:
            logger.error(f"Error in blockchain event listener: {e}")
            await asyncio.sleep(15)  # Wait longer on error

async def websocket_cleanup_task():
    """Clean up stale WebSocket connections."""
    while True:
        try:
            await ws_manager.cleanup_stale_connections()
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error in WebSocket cleanup task: {e}")
            await asyncio.sleep(60)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "services": {
            "ai": ai_service.is_ready() if ai_service else False,
            "blockchain": blockchain_service.is_connected() if blockchain_service else False,
            "notifications": notification_service.is_ready() if notification_service else False,
        },
        "version": "1.0.0"
    }

# Include API routers
app.include_router(
    incidents.router,
    prefix="/api/incidents",
    tags=["Incidents"],
    dependencies=[Depends(security)]
)

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    ai_inference.router,
    prefix="/api/ai",
    tags=["AI Inference"],
    dependencies=[Depends(security)]
)

app.include_router(
    blockchain.router,
    prefix="/api/blockchain",
    tags=["Blockchain"],
    dependencies=[Depends(security)]
)

app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"],
    dependencies=[Depends(security)]
)

app.include_router(
    dashboard.router,
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(security)]
)

# WebSocket endpoints
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket):
    """WebSocket endpoint for real-time alerts and updates."""
    await ws_manager.connect(websocket, connection_type="alerts")
    try:
        while True:
            # Keep connection alive and handle ping/pong
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "pong":
                    # Update last ping time
                    if websocket in ws_manager.connection_metadata:
                        ws_manager.connection_metadata[websocket]["last_ping"] = datetime.utcnow()
            except json.JSONDecodeError:
                pass  # Ignore non-JSON messages
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket):
    """WebSocket endpoint for dashboard real-time updates."""
    await ws_manager.connect(websocket, connection_type="dashboard")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "pong":
                    if websocket in ws_manager.connection_metadata:
                        ws_manager.connection_metadata[websocket]["last_ping"] = datetime.utcnow()
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("Dashboard WebSocket disconnected")
    except Exception as e:
        logger.error(f"Dashboard WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

@app.websocket("/ws/incidents")
async def websocket_incidents(websocket):
    """WebSocket endpoint for incident real-time updates."""
    await ws_manager.connect(websocket, connection_type="incidents")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "pong":
                    if websocket in ws_manager.connection_metadata:
                        ws_manager.connection_metadata[websocket]["last_ping"] = datetime.utcnow()
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("Incidents WebSocket disconnected")
    except Exception as e:
        logger.error(f"Incidents WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    
    # Get configuration from environment
    host = os.getenv("ZEROHACK_HOST", "0.0.0.0")
    port = int(os.getenv("ZEROHACK_PORT", "8008"))
    reload = os.getenv("ZEROHACK_RELOAD", "false").lower() == "true"
    
    logger.info(f"🚀 Starting ZeroHack Backend on {host}:{port}")
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
