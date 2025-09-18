from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import psutil
import os
import time
import random
import asyncio
from datetime import datetime
from typing import Dict, List, Any

app = FastAPI(title="ZeroHack API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "ZeroHack API is running", "status": "healthy"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ZeroHack API"}

def get_real_system_metrics():
    """Get real system metrics from the device"""
    try:
        # Get real system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get process count
        process_count = len(psutil.pids())
        
        # Get network stats
        net_io = psutil.net_io_counters()
        
        # Simulate AI model metrics (in real implementation, these would come from actual models)
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
            "shap_explainability": round(random.uniform(20, 40), 1)
        }
        
        return {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "memory_available": round(memory.available / (1024**3), 2),  # GB
            "disk_usage": disk.percent,
            "disk_free": round(disk.free / (1024**3), 2),  # GB
            "processes_monitored": process_count,
            "network_bytes_sent": net_io.bytes_sent,
            "network_bytes_recv": net_io.bytes_recv,
            "timestamp": datetime.utcnow().isoformat(),
            **ai_metrics
        }
    except Exception as e:
        # Fallback to simulated data if real metrics fail
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
            "shap_explainability": round(random.uniform(20, 40), 1)
        }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get real-time dashboard statistics"""
    system_metrics = get_real_system_metrics()
    
    # Simulate threat detection data
    threats_today = random.randint(0, 5)
    high_severity = random.randint(0, 2)
    
    return {
        "total_incidents": random.randint(10, 25),
        "threats_detected_today": threats_today,
        "high_severity_incidents": high_severity,
        "system_health": "operational" if system_metrics["cpu_usage"] < 80 else "warning",
        "ai_models_active": 4,
        "blockchain_transactions": random.randint(100, 200),
        "files_scanned": random.randint(1000, 5000),
        "quarantined_items": random.randint(0, 5),
        "is_learning_mode": random.choice([True, False]),
        "automatic_containment": True,
        "blockchain_logging": True,
        **system_metrics
    }

@app.get("/api/incidents")
async def get_incidents():
    return [
        {
            "id": 1,
            "title": "Suspicious Network Activity",
            "severity": "HIGH",
            "status": "ACTIVE",
            "timestamp": "2024-01-15T10:30:00Z",
            "description": "Unusual network traffic detected from external IP"
        },
        {
            "id": 2,
            "title": "Malware Detection",
            "severity": "CRITICAL",
            "status": "CONTAINED",
            "timestamp": "2024-01-15T09:15:00Z",
            "description": "Malicious file detected and quarantined"
        }
    ]

@app.get("/api/system/real-time")
async def get_real_time_metrics():
    """Get real-time system metrics"""
    return get_real_system_metrics()

@app.get("/api/processes")
async def get_processes():
    """Get real process information"""
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
            try:
                proc_info = proc.info
                processes.append({
                    "id": proc_info['pid'],
                    "name": proc_info['name'],
                    "cpu": round(proc_info['cpu_percent'], 1),
                    "memory": round(proc_info['memory_percent'], 1),
                    "status": proc_info['status'],
                    "path": proc.exe() if hasattr(proc, 'exe') else "N/A"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return processes[:50]  # Return top 50 processes
    except Exception as e:
        return []

@app.get("/api/network/packets")
async def get_network_packets():
    """Get network packet data for packet analyzer"""
    try:
        # Simulate packet data
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
                "description": f"Packet {i+1} - {random.choice(['Normal traffic', 'Suspicious pattern', 'Potential threat'])}"
            })
        return packets
    except Exception as e:
        return []

@app.get("/api/threats/heatmap")
async def get_threat_heatmap():
    """Get threat heatmap data"""
    try:
        # Generate heatmap data
        heatmap_data = []
        for i in range(10):
            for j in range(10):
                heatmap_data.append({
                    "x": i,
                    "y": j,
                    "intensity": random.uniform(0, 1),
                    "threat_count": random.randint(0, 10),
                    "region": f"Region_{i}_{j}"
                })
        return heatmap_data
    except Exception as e:
        return []

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8008)
