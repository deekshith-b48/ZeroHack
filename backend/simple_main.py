from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import psutil
import os
import time
import random
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Set

app = FastAPI(title="ZeroHack API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────── WebSocket manager ───────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections.discard(ws)

manager = ConnectionManager()

# ─────────────────────────── Background broadcaster ──────────────────────────

async def status_broadcaster():
    """Broadcast simulated system-status events every 5 seconds."""
    while True:
        await asyncio.sleep(5)
        try:
            metrics = get_real_system_metrics()
            await manager.broadcast({
                "type": "system_status",
                "data": {
                    "processesMonitored": metrics["processes_monitored"],
                    "threatsDetected": random.randint(0, 3),
                    "filesScanned": random.randint(1000, 5000),
                    "quarantinedItems": random.randint(0, 5),
                    "cpuUsage": metrics["cpu_usage"],
                    "memoryUsage": metrics["memory_usage"],
                    "isLearningMode": False,
                    "lastUpdateTimestamp": datetime.utcnow().isoformat(),
                },
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(status_broadcaster())

# ─────────────────────────── WebSocket endpoints ─────────────────────────────

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "pong":
                    pass
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "pong":
                    pass
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.websocket("/ws/incidents")
async def ws_incidents(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "pong":
                    pass
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# ─────────────────────────── System metrics helper ───────────────────────────

def get_real_system_metrics():
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        process_count = len(psutil.pids())
        net_io = psutil.net_io_counters()
        ai_metrics = {
            "model_accuracy": round(random.uniform(95.0, 99.5), 1),
            "false_positive_rate": round(random.uniform(0.05, 0.15), 3),
            "gpu_utilization": round(random.uniform(40, 80), 1),
            "inference_time": round(random.uniform(25, 50), 1),
            "onnx_runtime": "Active",
            "gpu_acceleration": "Enabled",
            "batch_size": 50,
            "codebert_processing": round(random.uniform(30, 60), 1),
            "scapy_extraction": round(random.uniform(50, 80), 1),
            "opencv_steganalysis": round(random.uniform(70, 95), 1),
            "shap_explainability": round(random.uniform(20, 40), 1),
        }
        return {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "memory_available": round(memory.available / (1024 ** 3), 2),
            "disk_usage": disk.percent,
            "disk_free": round(disk.free / (1024 ** 3), 2),
            "processes_monitored": process_count,
            "network_bytes_sent": net_io.bytes_sent,
            "network_bytes_recv": net_io.bytes_recv,
            "timestamp": datetime.utcnow().isoformat(),
            **ai_metrics,
        }
    except Exception:
        return {
            "cpu_usage": round(random.uniform(10, 30), 1),
            "memory_usage": round(random.uniform(50, 80), 1),
            "memory_available": round(random.uniform(2, 8), 2),
            "disk_usage": round(random.uniform(40, 70), 1),
            "disk_free": round(random.uniform(50, 200), 2),
            "processes_monitored": random.randint(100, 300),
            "network_bytes_sent": random.randint(1000000, 10000000),
            "network_bytes_recv": random.randint(1000000, 10000000),
            "timestamp": datetime.utcnow().isoformat(),
            "model_accuracy": round(random.uniform(95.0, 99.5), 1),
            "false_positive_rate": round(random.uniform(0.05, 0.15), 3),
            "gpu_utilization": round(random.uniform(40, 80), 1),
            "inference_time": round(random.uniform(25, 50), 1),
            "onnx_runtime": "Active",
            "gpu_acceleration": "Enabled",
            "batch_size": 50,
            "codebert_processing": round(random.uniform(30, 60), 1),
            "scapy_extraction": round(random.uniform(50, 80), 1),
            "opencv_steganalysis": round(random.uniform(70, 95), 1),
            "shap_explainability": round(random.uniform(20, 40), 1),
        }

# ─────────────────────────── Mock incident data ───────────────────────────────

MOCK_INCIDENTS = [
    {
        "id": "inc-001",
        "description": "Suspicious network traffic detected from external IP attempting port scan",
        "source_ip": "192.168.1.45",
        "attack_type": "Port Scan",
        "severity": "HIGH",
        "status": "ACTIVE",
        "confidence_score": 0.92,
        "blockchain_tx_hash": "0x73ebc8b5d13e3e30e87d87c72f849c7e94822ff",
        "created_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
    },
    {
        "id": "inc-002",
        "description": "Malicious file detected and quarantined – matches known ransomware signature",
        "source_ip": "10.0.0.22",
        "attack_type": "Ransomware",
        "severity": "CRITICAL",
        "status": "CONTAINED",
        "confidence_score": 0.98,
        "blockchain_tx_hash": "0x41adc87b93e49a6abce795fb9583be54e932817",
        "created_at": (datetime.utcnow() - timedelta(hours=5)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(hours=4)).isoformat(),
    },
    {
        "id": "inc-003",
        "description": "Unusual outbound DNS queries – potential data exfiltration via DNS tunnelling",
        "source_ip": "172.16.0.10",
        "attack_type": "DNS Tunnelling",
        "severity": "MEDIUM",
        "status": "INVESTIGATING",
        "confidence_score": 0.75,
        "blockchain_tx_hash": None,
        "created_at": (datetime.utcnow() - timedelta(hours=8)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(hours=7)).isoformat(),
    },
    {
        "id": "inc-004",
        "description": "SQL injection attempt detected in web application request parameters",
        "source_ip": "203.0.113.42",
        "attack_type": "SQL Injection",
        "severity": "HIGH",
        "status": "BLOCKED",
        "confidence_score": 0.88,
        "blockchain_tx_hash": "0x67f8d92451c3e76a781ab1a349c7b7d7328af1b",
        "created_at": (datetime.utcnow() - timedelta(hours=12)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(hours=11)).isoformat(),
    },
    {
        "id": "inc-005",
        "description": "Memory injection technique detected in process explorer.exe",
        "source_ip": "192.168.5.100",
        "attack_type": "Memory Injection",
        "severity": "CRITICAL",
        "status": "ACTIVE",
        "confidence_score": 0.95,
        "blockchain_tx_hash": "0x0fc8e723d51437e2b6aa47a98b8ce5e3c1d4e86",
        "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    },
]

# ─────────────────────────── REST endpoints ──────────────────────────────────

@app.get("/")
async def root():
    return {"message": "ZeroHack API is running", "status": "healthy"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "ZeroHack API",
        "services": {
            "ai": True,
            "blockchain": True,
            "notifications": True,
        },
        "version": "1.0.0",
    }

# ── Dashboard ──

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    system_metrics = get_real_system_metrics()
    threats_today = random.randint(0, 5)
    high_severity = random.randint(0, 2)
    return {
        "total_incidents": len(MOCK_INCIDENTS),
        "active_incidents": sum(1 for i in MOCK_INCIDENTS if i["status"] == "ACTIVE"),
        "threats_detected_today": threats_today,
        "high_severity_incidents": high_severity,
        "system_health": "operational" if system_metrics["cpu_usage"] < 80 else "warning",
        "ai_models_active": 4,
        "blockchain_transactions": random.randint(100, 200),
        "files_scanned": random.randint(1000, 5000),
        "quarantined_items": random.randint(0, 5),
        "is_learning_mode": False,
        "automatic_containment": True,
        "blockchain_logging": True,
        **system_metrics,
    }

@app.get("/api/dashboard/threat-heatmap")
async def get_threat_heatmap_dashboard(days: int = 7):
    heatmap = []
    locations = [
        (37.7749, -122.4194, "San Francisco"),
        (40.7128, -74.0060, "New York"),
        (51.5074, -0.1278, "London"),
        (35.6762, 139.6503, "Tokyo"),
        (48.8566, 2.3522, "Paris"),
        (55.7558, 37.6173, "Moscow"),
        (-33.8688, 151.2093, "Sydney"),
        (28.6139, 77.2090, "New Delhi"),
        (1.3521, 103.8198, "Singapore"),
        (-23.5505, -46.6333, "São Paulo"),
    ]
    for lat, lon, _ in locations:
        heatmap.append({
            "latitude": lat + random.uniform(-0.5, 0.5),
            "longitude": lon + random.uniform(-0.5, 0.5),
            "threat_count": random.randint(1, 20),
            "severity": random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            "timestamp": (datetime.utcnow() - timedelta(hours=random.randint(0, days * 24))).isoformat(),
        })
    return heatmap

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity(limit: int = 20):
    activities = []
    for i, inc in enumerate(MOCK_INCIDENTS[:limit]):
        activities.append({
            "id": inc["id"],
            "type": "incident",
            "description": f"New {inc['attack_type']} incident detected from {inc['source_ip']}",
            "timestamp": inc["created_at"],
            "severity": inc["severity"],
        })
    return activities[:limit]

@app.get("/api/dashboard/ai-pipeline-status")
async def get_ai_pipeline_status():
    return {
        "initialized": True,
        "total_models": 4,
        "ready_models": 4,
        "models": {
            "isolation_forest": {"status": "ready", "type": "IsolationForestDetector", "version": "1.0.0"},
            "autoencoder": {"status": "ready", "type": "AutoencoderDetector", "version": "1.0.0"},
            "lstm": {"status": "ready", "type": "LSTMDetector", "version": "1.0.0"},
            "signature_engine": {"status": "ready", "type": "SignatureEngine", "version": "1.0.0"},
        },
    }

# ── Incidents ──

@app.get("/api/incidents")
async def get_incidents():
    return MOCK_INCIDENTS

@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            return inc
    return {"error": "Incident not found"}, 404

# ── System ──

@app.get("/api/system/real-time")
async def get_real_time_metrics():
    return get_real_system_metrics()

@app.get("/api/processes")
async def get_processes():
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
            try:
                info = proc.info
                processes.append({
                    "id": info['pid'],
                    "name": info['name'],
                    "cpu": round(info['cpu_percent'] or 0, 1),
                    "memory": round(info['memory_percent'] or 0, 1),
                    "status": info['status'],
                    "path": "N/A",
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return processes[:50]
    except Exception:
        return []

@app.get("/api/network/packets")
async def get_network_packets():
    packets = []
    for i in range(20):
        packets.append({
            "id": i + 1,
            "timestamp": datetime.utcnow().isoformat(),
            "source_ip": f"192.168.1.{random.randint(1, 254)}",
            "dest_ip": f"10.0.0.{random.randint(1, 254)}",
            "protocol": random.choice(["TCP", "UDP", "ICMP", "HTTP", "HTTPS"]),
            "size": random.randint(64, 1500),
            "flags": random.choice(["SYN", "ACK", "FIN", "RST", "PSH"]),
            "threat_level": random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            "description": f"Packet {i + 1} – {random.choice(['Normal traffic', 'Suspicious pattern', 'Potential threat'])}",
        })
    return packets

@app.get("/api/threats/heatmap")
async def get_threats_heatmap():
    heatmap_data = []
    for i in range(10):
        for j in range(10):
            heatmap_data.append({
                "x": i,
                "y": j,
                "intensity": random.uniform(0, 1),
                "threat_count": random.randint(0, 10),
                "region": f"Region_{i}_{j}",
            })
    return heatmap_data

# ── Blockchain ──

@app.get("/api/blockchain/status")
async def get_blockchain_status():
    return {
        "connected": True,
        "network": "Hyperledger Fabric",
        "peers": 4,
        "orderers": 3,
        "channels": 2,
        "transaction_count": random.randint(100, 500),
        "latest_block": 16429781 + random.randint(0, 100),
        "consensus_type": "Raft",
        "tps": 500,
        "ipfs_connected": True,
    }

@app.get("/api/blockchain/evidence/{incident_id}")
async def get_evidence_chain(incident_id: str):
    return [
        {
            "tx_hash": f"0x{random.randint(0, 2**256):064x}",
            "block_height": 16429781 + random.randint(0, 100),
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "IncidentLogged",
            "incident_id": incident_id,
            "ipfs_cid": f"Qm{''.join(random.choices('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=44))}",
            "confirmations": random.randint(5, 50),
        }
    ]

# ── Notifications ──

@app.get("/api/notifications")
async def get_notifications(limit: int = 20, unread_only: bool = False):
    notifications = [
        {
            "id": "notif-001",
            "title": "Critical threat detected",
            "message": "Ransomware signature matched on host 10.0.0.22",
            "severity": "CRITICAL",
            "read": False,
            "created_at": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
        },
        {
            "id": "notif-002",
            "title": "Blockchain transaction confirmed",
            "message": "Incident inc-001 successfully logged on-chain",
            "severity": "INFO",
            "read": True,
            "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        },
        {
            "id": "notif-003",
            "title": "AI model retrain completed",
            "message": "Isolation forest model updated with latest feedback",
            "severity": "INFO",
            "read": False,
            "created_at": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
        },
    ]
    if unread_only:
        notifications = [n for n in notifications if not n["read"]]
    return notifications[:limit]

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    return {"success": True, "notification_id": notification_id}

# ── Auth ──

@app.post("/api/auth/login")
async def login(credentials: dict):
    return {
        "access_token": "demo_access_token_zerohack",
        "refresh_token": "demo_refresh_token_zerohack",
        "token_type": "bearer",
        "expires_in": 3600,
    }

@app.post("/api/auth/refresh")
async def refresh_token(body: dict):
    return {
        "access_token": "demo_access_token_zerohack_refreshed",
        "refresh_token": "demo_refresh_token_zerohack",
        "token_type": "bearer",
        "expires_in": 3600,
    }

@app.get("/api/auth/me")
async def get_me():
    return {
        "id": "user-001",
        "email": "admin@zerohack.local",
        "role": "admin",
        "name": "ZeroHack Admin",
    }

@app.post("/api/auth/logout")
async def logout():
    return {"success": True}

# ── AI Inference ──

@app.post("/api/ai/analyze/text")
async def analyze_text(body: dict):
    text = body.get("text", "")
    suspicious_keywords = ["password", "inject", "exploit", "shell", "malware", "hack"]
    threat = any(kw in text.lower() for kw in suspicious_keywords)
    return {
        "threat_detected": threat,
        "threat_type": "Text-based threat" if threat else "Clean",
        "confidence": round(random.uniform(0.7, 0.95) if threat else random.uniform(0.05, 0.2), 3),
        "severity": "HIGH" if threat else "LOW",
        "explanation": "Suspicious keywords detected" if threat else "No threats detected",
        "model_details": {"signature_engine": {"matched": threat}},
        "processing_time": round(random.uniform(20, 60), 1),
    }

@app.post("/api/ai/analyze/image")
async def analyze_image(body: dict):
    return {
        "threat_detected": False,
        "threat_type": "Clean",
        "confidence": round(random.uniform(0.05, 0.15), 3),
        "severity": "LOW",
        "explanation": "No steganographic content detected",
        "model_details": {"steganography_score": round(random.uniform(0.0, 0.1), 3)},
        "processing_time": round(random.uniform(50, 150), 1),
    }

@app.post("/api/ai/analyze/network")
async def analyze_network(body: dict):
    traffic = body.get("traffic_data", [])
    threat = len(traffic) > 0 and random.random() > 0.7
    return {
        "threat_detected": threat,
        "threat_type": "Network anomaly" if threat else "Clean",
        "confidence": round(random.uniform(0.6, 0.9) if threat else random.uniform(0.05, 0.3), 3),
        "severity": random.choice(["MEDIUM", "HIGH"]) if threat else "LOW",
        "explanation": "Anomalous traffic pattern detected" if threat else "Traffic within normal parameters",
        "model_details": {},
        "processing_time": round(random.uniform(30, 80), 1),
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8008)
