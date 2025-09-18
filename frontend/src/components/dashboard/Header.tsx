'use client';

import { Bell, Search, Shield, AlertTriangle, Activity, Clock } from 'lucide-react';
import { SystemStatus } from '@/lib/websocket';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface HeaderProps {
  systemStatus: SystemStatus;
}

export function Header({ systemStatus }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  
  const statusItems = [
    { 
      label: 'Processes Monitored', 
      value: systemStatus.processesMonitored,
      icon: <Activity className="text-blue-400" size={18} />
    },
    { 
      label: 'Threats Detected', 
      value: systemStatus.threatsDetected, 
      alert: systemStatus.threatsDetected > 0,
      icon: <AlertTriangle className="text-red-400" size={18} />
    },
    { 
      label: 'Files Scanned', 
      value: systemStatus.filesScanned,
      icon: <Shield className="text-green-400" size={18} />
    },
    { 
      label: 'Quarantined Items', 
      value: systemStatus.quarantinedItems,
      icon: <Clock className="text-yellow-400" size={18} />
    },
  ];
  
  const mockNotifications = [
    {
      id: 1,
      title: "Critical Threat Detected",
      description: "Memory injection attempt in process svchost.exe",
      time: "2 minutes ago",
      read: false,
      type: "critical"
    },
    {
      id: 2,
      title: "New Blockchain Record",
      description: "Threat evidence stored on chain (TxID: 0x7f2a...)",
      time: "15 minutes ago",
      read: false,
      type: "info" 
    },
    {
      id: 3, 
      title: "System Update",
      description: "AI detection model updated to v3.2.1",
      time: "1 hour ago",
      read: true,
      type: "system"
    }
  ];

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Shield className="text-emerald-500 mr-2" size={24} />
          <div>
            <h1 className="text-xl font-bold">ZeroHack: TrustSec</h1>
            <p className="text-xs text-zinc-400">Production-Grade Autonomous Threat Detection</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search threats, processes, files..."
              className="bg-zinc-800 text-white border border-zinc-700 rounded-md py-2 pl-10 pr-4 w-80 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
          </div>
          
          <div className="relative">
            <button 
              className="text-zinc-400 hover:text-white p-2 rounded-md hover:bg-zinc-800"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
              {(systemStatus.threatsDetected > 0 || mockNotifications.some(n => !n.read)) && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {mockNotifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <motion.div 
                className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg z-50"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="border-b border-zinc-800 px-4 py-2 flex justify-between items-center">
                  <h3 className="font-medium">Notifications</h3>
                  <button className="text-xs text-emerald-500 hover:underline">Mark all as read</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {mockNotifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className={`px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800 ${notification.read ? '' : 'bg-zinc-800 bg-opacity-40'}`}
                    >
                      <div className="flex items-start">
                        <div className={`w-2 h-2 rounded-full mt-1.5 mr-2 ${
                          notification.type === 'critical' ? 'bg-red-500' :
                          notification.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'
                        }`}></div>
                        <div>
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-zinc-400 mt-1">{notification.description}</p>
                          <p className="text-xs text-zinc-500 mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 text-center">
                  <button className="text-xs text-emerald-500 hover:underline">View all notifications</button>
                </div>
              </motion.div>
            )}
          </div>
          
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <span className="font-bold text-sm">TS</span>
          </div>
        </div>
      </div>
      
      {/* Status items moved to ZeroHackDashboard.tsx */}
    </header>
  );
}
