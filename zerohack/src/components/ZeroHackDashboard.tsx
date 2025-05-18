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

  // Initialize WebSocket mock service
  useEffect(() => {
    mockWebSocketService.start();
    
    return () => {
      mockWebSocketService.stop();
    };
  }, []);

  // Subscribe to system status updates
  useEffect(() => {
    const unsubscribe = mockWebSocketService.subscribe('system_status', (data: SystemStatus) => {
      setSystemStatus({
        processesMonitored: data.processesMonitored,
        threatsDetected: data.threatsDetected,
        filesScanned: data.filesScanned,
        quarantinedItems: data.quarantinedItems,
        cpuUsage: data.cpuUsage,
        memoryUsage: data.memoryUsage,
        isLearningMode: data.isLearningMode,
        lastUpdateTimestamp: data.lastUpdateTimestamp,
      });
    });
    
    return unsubscribe;
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
