from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging

# Import routers
from backend.routers import traffic, incidents, system, websocket, dao
# Import services and helpers for startup tasks
from backend.services.blockchain_logger import connect_and_load_contract as connect_logger_contract
from backend.services.blockchain_response_engine import connect_and_load_contract as connect_response_contract, response_contract_instance
from backend.services.dao_interactor import connect_and_load_dao_contract
from backend.services.ai_pipeline import get_pipeline
from backend.services.ws_broadcaster import manager as ws_manager
import config

logger = config.get_logger("api_server")

# --- Background Task for WebSocket Event Listener ---
async def event_listener_background_task():
    logger.info("Starting background event listener for blockchain events.")
    import json

    while True:
        try:
            if not response_contract_instance:
                logger.warning("Event listener: Response Engine contract not loaded. Retrying connection...")
                connect_response_contract()
                await asyncio.sleep(15)
                continue

            event_filter_admin = response_contract_instance.events.AdminAlert.create_filter(fromBlock='latest')
            event_filter_quarantine = response_contract_instance.events.IPQuarantined.create_filter(fromBlock='latest')

            logger.info("Background listener started, waiting for AdminAlert and IPQuarantined events...")

            while True:
                for event in event_filter_admin.get_new_entries():
                    logger.info(f"Caught AdminAlert event: {event.args}")
                    await ws_manager.broadcast(json.dumps({"event_type": "AdminAlert", "data": dict(event.args)}))

                for event in event_filter_quarantine.get_new_entries():
                    logger.info(f"Caught IPQuarantined event: {event.args}")
                    await ws_manager.broadcast(json.dumps({"event_type": "IPQuarantined", "data": dict(event.args)}))

                await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"Error in event listener task: {e}. Reconnecting in 15 seconds.", exc_info=True)
            await asyncio.sleep(15)

# --- FastAPI App Setup ---
app = FastAPI(
    title="ZeroHack API",
    description="API for ZeroHack cybersecurity application, including incident reporting, feedback, DAO interactions, and analytics.",
    version="0.2.0"
)

# --- CORS Middleware ---
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI server starting up...")
    # Initialize services
    connect_logger_contract()
    connect_response_contract()
    connect_and_load_dao_contract()
    get_pipeline() # Initialize AI pipeline singleton
    # Start background task for event listening
    asyncio.create_task(event_listener_background_task())

# --- Include Routers ---
app.include_router(traffic.router)
app.include_router(incidents.router)
app.include_router(system.router)
app.include_router(websocket.router)
app.include_router(dao.router)

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting FastAPI server directly for ZeroHack API...")
    uvicorn.run("api_server:app", host="0.0.0.0", port=8008, reload=True)
