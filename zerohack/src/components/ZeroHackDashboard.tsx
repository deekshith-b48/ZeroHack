'use client';

import { useState, useEffect } from 'react';
import { Activity, Shield, AlertTriangle, Clock, Layers } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { ProcessMonitor } from '@/components/dashboard/ProcessMonitor';
import { ProcessTree } from '@/components/dashboard/ProcessTree';
import { FileSystemGuard } from '@/components/dashboard/FileSystemGuard';
import { AIDetection } from '@/components/dashboard/AIDetection';
import { ThreatTriage } from '@/components/dashboard/ThreatTriage';
import { BlockchainForensics } from '@/components/dashboard/BlockchainForensics';
import { ThreatMap } from '@/components/dashboard/ThreatMap';
import { EDRStatus } from '@/components/dashboard/EDRStatus';
import { AutonomousResponse } from '@/components/dashboard/AutonomousResponse';
import { Settings } from '@/components/dashboard/Settings';
import PacketAnalyzerDashboard from '@/components/packet-analyzer/PacketAnalyzerDashboard';
import { ThreatHeatmap } from '@/components/dashboard/ThreatHeatmap';
import { SystemStatus, mockWebSocketService } from '@/lib/websocket';
import { motion } from 'framer-motion';
import { PipelineStatus } from '@/components/ai-pipeline/PipelineStatus';

// Configuration for API and WebSocket endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
const STATUS_ENDPOINT = `${API_BASE_URL}/api/status`;
const ALERTS_WEBSOCKET_ENDPOINT = `${WS_BASE_URL}/ws/alerts`;


export default function ZeroHackDashboard() {
  const [activeTab, setActiveTab] = useState('ai-pipeline');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    processesMonitored: 0,
    threatsDetected: 0,
    filesScanned: 0,
    quarantinedItems: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    isLearningMode: false,
    lastUpdateTimestamp: new Date().toISOString(),
  });
  
  const statusItems = [
    { 
      label: 'Processes Monitored', 
      key: 'processesMonitored' as keyof SystemStatus,
      icon: <Activity className="text-blue-400" size={18} />
    },
    { 
      label: 'Threats Detected', 
      key: 'threatsDetected' as keyof SystemStatus,
      alert: systemStatus.threatsDetected > 0,
      icon: <AlertTriangle className="text-red-400" size={18} />
    },
    { 
      label: 'Files Scanned', 
      key: 'filesScanned' as keyof SystemStatus,
      icon: <Shield className="text-green-400" size={18} />
    },
    { 
      label: 'Quarantined Items', 
      key: 'quarantinedItems' as keyof SystemStatus,
      icon: <Clock className="text-yellow-400" size={18} />
    },
  ];

  // Fetch initial status and connect to WebSocket for real-time updates
  useEffect(() => {
    // Fetch initial system status
    const fetchStatus = async () => {
      try {
        const response = await fetch(STATUS_ENDPOINT);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Here we need to map the /api/status response to the SystemStatus state
        // This requires knowing the structure of the /api/status response
        // For now, let's assume a partial mapping.
        setSystemStatus(prevStatus => ({
          ...prevStatus,
          // Example mapping, adjust based on actual API response
          // ai_model_status: data.ai_model,
          // blockchain_connection: data.blockchain,
          // active_ws_clients: data.active_ws_clients
        }));
        console.log("Fetched initial status:", data);
      } catch (error) {
        console.error("Failed to fetch initial system status:", error);
      }
    };

    fetchStatus();

    // Establish WebSocket connection
    const ws = new WebSocket(ALERTS_WEBSOCKET_ENDPOINT);

    ws.onopen = () => {
      console.log("Dashboard WebSocket connected.");
    };

    ws.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);
        console.log("Dashboard received WebSocket message:", messageData);

        // Update dashboard based on message type
        // This part needs to be built out. For example, if we get a new threat alert,
        // we might increment the threatsDetected count.
        if (messageData.event_type === 'IPQuarantined' || messageData.event_type === 'AdminAlert') {
          setSystemStatus(prevStatus => ({
            ...prevStatus,
            threatsDetected: prevStatus.threatsDetected + 1,
            // quarantinedItems could also be updated if we get that info
            lastUpdateTimestamp: new Date().toISOString(),
          }));
        }
        // A 'system_status' type message could update everything at once
        if (messageData.event_type === 'system_status') {
             setSystemStatus(messageData.data);
        }

      } catch (e) {
        console.error("Error parsing WebSocket message in dashboard:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("Dashboard WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Dashboard WebSocket closed.");
    };

    // Cleanup on component unmount
    return () => {
      ws.close();
    };
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'edr-status':
        return <EDRStatus />;
      case 'process-monitor':
        return <ProcessMonitor />;
      case 'file-system':
        return <FileSystemGuard />;
      case 'ai-detection':
        return <AIDetection />;
      case 'threat-triage':
        return <ThreatTriage />;
      case 'blockchain':
        return <BlockchainForensics />;
      case 'threat-map':
        return <ThreatMap />;
      case 'autonomous-response':
        return <AutonomousResponse />;
      case 'packet-analyzer':
        return <PacketAnalyzerDashboard />;
      case 'settings':
        return <Settings />;
      case 'ai-pipeline':
        return <PipelineStatus />;
      default:
        return <EDRStatus />;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header systemStatus={systemStatus} />
        <motion.main 
          className="flex-1 overflow-y-auto p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'edr-status' && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {statusItems.map((item, index) => (
                <motion.div 
                  key={index} 
                  className="bg-zinc-800 rounded-lg p-4 border border-zinc-800 shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-zinc-400">{item.label}</div>
                    <div>{item.icon}</div>
                  </div>
                  <div className={`text-xl font-bold ${item.alert ? 'text-red-500' : 'text-white'}`}>
                    {systemStatus[item.key].toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {renderActiveTab()}
        </motion.main>
      </div>
    </div>
  );
}
