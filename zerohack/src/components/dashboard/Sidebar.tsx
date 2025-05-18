'use client';

import { useState } from 'react';
import { 
  Activity, 
  Shield, 
  Brain, 
  Database, 
  Map, 
  Settings as SettingsIcon,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  LineChart,
  NetworkIcon,
  Lock,
  ServerIcon,
  Wifi,
  Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const menuSections = [
    {
      title: "Overview",
      items: [
        { id: 'edr-status', label: 'Dashboard', icon: <LineChart size={20} /> },
        { id: 'threat-triage', label: 'Threat Triage', icon: <AlertTriangle size={20} /> },
      ]
    },
    {
      title: "Monitoring",
      items: [
        { id: 'process-monitor', label: 'Process Monitor', icon: <Activity size={20} /> },
        { id: 'file-system', label: 'File System Guard', icon: <Shield size={20} /> },
        { id: 'packet-analyzer', label: 'Packet Analyzer', icon: <Wifi size={20} /> },
      ]
    },
    {
      title: "Threat Intelligence",
      items: [
        { id: 'ai-pipeline', label: 'AI Pipeline', icon: <Brain size={20} /> },
        { id: 'ai-detection', label: 'AI Detection', icon: <Brain size={20} /> },
        { id: 'blockchain', label: 'Blockchain Forensics', icon: <Database size={20} /> },
        { id: 'threat-map', label: 'Threat Map', icon: <Map size={20} /> },
        { id: 'autonomous-response', label: 'Autonomous Response', icon: <Shield size={20} /> },
      ]
    },
    {
      title: "System",
      items: [
        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
      ]
    }
  ];

  return (
    <div className={`bg-zinc-900 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} border-r border-zinc-800`}>
      <div className="flex items-center p-4 border-b border-zinc-800">
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : ''}`}>
          <ShieldAlert className="text-emerald-500" size={24} />
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-2 font-bold"
            >
              <div className="text-xl">AI-Driven</div>
              <div className="text-xs text-emerald-500">Defense System</div>
            </motion.div>
          )}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className={`ml-auto p-1 rounded-full hover:bg-zinc-800 ${collapsed ? 'rotate-180' : ''}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex flex-col flex-1 py-4 overflow-y-auto">
        {menuSections.map((section, index) => (
          <div key={index} className="mb-6">
            {!collapsed && (
              <div className="px-4 mb-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>
            )}
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center px-4 py-2.5 mb-1 mx-2 rounded-md ${
                  activeTab === item.id 
                    ? 'bg-emerald-500 bg-opacity-20 text-emerald-500' 
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-3 text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-zinc-800">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold">
            TS
          </div>
          {!collapsed && (
            <div className="ml-3">
              <div className="text-sm font-medium">Defense System</div>
              <div className="text-xs text-zinc-400">v2.0.0</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
