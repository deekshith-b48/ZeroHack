'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Settings, Terminal, Network, Server, Zap, Webhook, Database, BarChart3, Globe, Clock, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResponseRule {
  id: number;
  name: string;
  threshold: number;
  action: 'quarantine' | 'block' | 'alert' | 'terminate';
  status: 'enabled' | 'disabled';
  lastTriggered?: string;
  count: number;
}

interface ResponseEvent {
  id: number;
  timestamp: string;
  threatId: string;
  confidence: number;
  action: 'quarantine' | 'block' | 'alert' | 'terminate' | 'throttle' | 'memory_capture';
  target: string;
  status: 'success' | 'pending' | 'failed';
  responseTime?: number; // in ms
  technicalDetails?: {
    command?: string;
    responseCode?: number;
    memorySize?: string;
    networkInterface?: string;
    siemAlert?: boolean;
  };
  shap?: {
    baseValue: number;
    featureValues: Array<{
      feature: string;
      value: number;
      direction: 'positive' | 'negative';
    }>;
  };
}

export function AutonomousResponse() {
  const [rules, setRules] = useState<ResponseRule[]>([
    {
      id: 1,
      name: 'High Confidence Malware',
      threshold: 90,
      action: 'quarantine',
      status: 'enabled',
      lastTriggered: '2023-05-16 14:23:45',
      count: 12
    },
    {
      id: 2,
      name: 'Network Connection Block',
      threshold: 85,
      action: 'block',
      status: 'enabled',
      lastTriggered: '2023-05-16 13:12:30',
      count: 8
    },
    {
      id: 3,
      name: 'Memory Injection Detection',
      threshold: 80,
      action: 'terminate',
      status: 'enabled',
      lastTriggered: '2023-05-16 12:45:12',
      count: 5
    },
    {
      id: 4,
      name: 'Suspicious File Access',
      threshold: 70,
      action: 'alert',
      status: 'disabled',
      count: 3
    }
  ]);
  
  const [events, setEvents] = useState<ResponseEvent[]>([
    {
      id: 1,
      timestamp: '2023-05-16 14:23:45',
      threatId: 'THREAT-2023-05-16-001',
      confidence: 95,
      action: 'quarantine',
      target: 'suspicious_file.exe',
      status: 'success'
    },
    {
      id: 2,
      timestamp: '2023-05-16 13:12:30',
      threatId: 'THREAT-2023-05-16-002',
      confidence: 88,
      action: 'block',
      target: '192.168.1.100:4444',
      status: 'success'
    },
    {
      id: 3,
      timestamp: '2023-05-16 12:45:12',
      threatId: 'THREAT-2023-05-16-003',
      confidence: 82,
      action: 'terminate',
      target: 'malware_process.exe (PID: 1234)',
      status: 'pending'
    },
    {
      id: 4,
      timestamp: '2023-05-16 11:03:22',
      threatId: 'THREAT-2023-05-16-004',
      confidence: 75,
      action: 'alert',
      target: 'User login from unusual location',
      status: 'success'
    },
    {
      id: 5,
      timestamp: '2023-05-16 10:34:18',
      threatId: 'THREAT-2023-05-16-005',
      confidence: 91,
      action: 'quarantine',
      target: 'infected_document.pdf',
      status: 'failed'
    }
  ]);

  const [activeTab, setActiveTab] = useState('events');
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [newRule, setNewRule] = useState(false);
  const [shapDetails, setShapDetails] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<ResponseEvent | null>(null);
  const [siemStats, setSiemStats] = useState({
    splunkConnected: true,
    elkConnected: true,
    lastWebhookSuccess: '2023-05-16 15:10:23',
    averageLatency: '485ms',
    queuedAlerts: 0
  });
  
  // Simulate a new event arriving
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const actions: ('quarantine' | 'block' | 'alert' | 'terminate' | 'throttle' | 'memory_capture')[] = 
          ['quarantine', 'block', 'alert', 'terminate', 'throttle', 'memory_capture'];
        const statuses: ('success' | 'pending' | 'failed')[] = ['success', 'success', 'success', 'pending', 'failed'];
        
        const newEvent: ResponseEvent = {
          id: Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          threatId: `THREAT-${new Date().toISOString().substring(0, 10)}-${Math.floor(Math.random() * 1000)}`,
          confidence: Math.floor(Math.random() * 30) + 70,
          action: actions[Math.floor(Math.random() * actions.length)],
          target: Math.random() > 0.5 ? `suspicious_file_${Math.floor(Math.random() * 100)}.exe` : `192.168.1.${Math.floor(Math.random() * 255)}:${Math.floor(Math.random() * 10000)}`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          responseTime: Math.floor(Math.random() * 150) + 50,
          technicalDetails: {
            command: Math.random() > 0.5 ? `iptables -A INPUT -s 192.168.1.${Math.floor(Math.random() * 255)} -j DROP` : `taskkill /F /PID ${Math.floor(Math.random() * 10000)}`,
            responseCode: Math.floor(Math.random() * 2),
            memorySize: `${(Math.random() * 25 + 5).toFixed(1)} MB`,
            networkInterface: 'eth0',
            siemAlert: Math.random() > 0.3
          },
          shap: {
            baseValue: 0.5,
            featureValues: [
              { 
                feature: 'Network anomaly score', 
                value: Math.random() * 0.9, 
                direction: 'positive' 
              },
              { 
                feature: 'Process entropy', 
                value: Math.random() * 0.8, 
                direction: 'positive' 
              },
              { 
                feature: 'File signature', 
                value: Math.random() * 0.7, 
                direction: Math.random() > 0.7 ? 'negative' : 'positive' 
              },
              { 
                feature: 'Registry modifications', 
                value: Math.random() * 0.6, 
                direction: 'positive' 
              }
            ]
          }
        };
        
        setEvents(prev => [newEvent, ...prev.slice(0, 19)]);
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'quarantine':
        return <Shield size={16} className="text-emerald-500" />;
      case 'block':
        return <XCircle size={16} className="text-red-500" />;
      case 'alert':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'terminate':
        return <Terminal size={16} className="text-blue-500" />;
      case 'throttle':
        return <Network size={16} className="text-purple-500" />;
      case 'memory_capture':
        return <Database size={16} className="text-cyan-500" />;
      default:
        return null;
    }
  };
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'quarantine':
        return 'border-emerald-900 bg-emerald-500 bg-opacity-20 text-emerald-500';
      case 'block':
        return 'border-red-900 bg-red-500 bg-opacity-20 text-red-500';
      case 'alert':
        return 'border-yellow-900 bg-yellow-500 bg-opacity-20 text-yellow-500';
      case 'terminate':
        return 'border-blue-900 bg-blue-500 bg-opacity-20 text-blue-500';
      default:
        return 'border-zinc-700 bg-zinc-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-emerald-500" />;
      case 'pending':
        return <RefreshCw size={16} className="text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Shield className="mr-2 text-emerald-500" size={24} />
            Autonomous Response Engine
          </h2>
          <p className="text-zinc-400 text-sm mt-1">AI-driven threat containment with multi-level response</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700">
            <span className="text-sm text-zinc-300">System Status:</span>
            <button 
              onClick={() => setSystemEnabled(!systemEnabled)}
              className="relative inline-flex items-center"
            >
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${systemEnabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${systemEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
              <span className={`ml-2 text-sm ${systemEnabled ? 'text-emerald-500' : 'text-zinc-500'}`}>
                {systemEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>
          
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md flex items-center">
            <Settings size={16} className="mr-2" />
            Configure
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center mb-2">
            <Webhook size={18} className="text-emerald-500 mr-2" />
            <div className="text-sm font-medium">SIEM Integration</div>
          </div>
          <div className="flex justify-between mb-2 text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>
              <span>Splunk</span>
            </div>
            <div>Connected</div>
          </div>
          <div className="flex justify-between mb-2 text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>
              <span>ELK Stack</span>
            </div>
            <div>Connected</div>
          </div>
          <div className="text-xs text-zinc-400 mt-2">
            Last webhook: {siemStats.lastWebhookSuccess}
          </div>
          <div className="text-xs text-zinc-400">
            Average latency: {siemStats.averageLatency}
          </div>
        </div>
        
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center mb-3">
            <BarChart3 size={18} className="text-emerald-500 mr-2" />
            <div className="text-sm font-medium">Threat-Level Matrix</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                <span>Critical (≥90%)</span>
              </div>
              <div className="text-red-500">Quarantine + Memory Capture</div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-orange-500 mr-1"></div>
                <span>High (70-90%)</span>
              </div>
              <div className="text-orange-500">Traffic Throttling + SOC Alert</div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                <span>Medium (40-70%)</span>
              </div>
              <div className="text-yellow-500">SOC Alert</div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
                <span>Low (&lt;40%)</span>
              </div>
              <div className="text-blue-500">Log Only</div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center mb-3">
            <Globe size={18} className="text-emerald-500 mr-2" />
            <div className="text-sm font-medium">System Health</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-700 rounded p-2">
              <div className="text-xs text-zinc-400">Average Response</div>
              <div className="font-medium">138ms</div>
            </div>
            <div className="bg-zinc-700 rounded p-2">
              <div className="text-xs text-zinc-400">Memory Usage</div>
              <div className="font-medium">2.4 GB</div>
            </div>
            <div className="bg-zinc-700 rounded p-2">
              <div className="text-xs text-zinc-400">Rules Active</div>
              <div className="font-medium">{rules.filter(r => r.status === 'enabled').length}</div>
            </div>
            <div className="bg-zinc-700 rounded p-2">
              <div className="text-xs text-zinc-400">Actions Today</div>
              <div className="font-medium">{events.length}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-800 rounded-lg mb-6 overflow-hidden border border-zinc-700 shadow-lg">
        <div className="flex border-b border-zinc-700">
          <button
            className={`px-6 py-3 text-sm font-medium ${activeTab === 'events' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-400'}`}
            onClick={() => setActiveTab('events')}
          >
            Recent Response Events
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium ${activeTab === 'rules' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-400'}`}
            onClick={() => setActiveTab('rules')}
          >
            Response Rules
          </button>
        </div>
        
        {activeTab === 'events' && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-700 text-zinc-300">
                  <tr>
                    <th className="px-4 py-2 text-left">Timestamp</th>
                    <th className="px-4 py-2 text-left">Threat ID</th>
                    <th className="px-4 py-2 text-left">Confidence</th>
                    <th className="px-4 py-2 text-left">Action</th>
                    <th className="px-4 py-2 text-left">Target</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {events.map((event) => (
                      <motion.tr 
                        key={event.id} 
                        className="border-b border-zinc-700 hover:bg-zinc-700"
                        initial={{ opacity: 0, backgroundColor: 'rgba(5, 150, 105, 0.2)' }}
                        animate={{ opacity: 1, backgroundColor: 'rgba(0, 0, 0, 0)' }}
                        transition={{ duration: 1 }}
                      >
                        <td className="px-4 py-2">{event.timestamp}</td>
                        <td className="px-4 py-2 font-mono text-xs">{event.threatId}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center">
                            <div className="w-12 bg-zinc-700 rounded-full h-2 mr-2">
                              <div 
                                className={`h-full rounded-full ${
                                  event.confidence > 90 ? 'bg-red-500' :
                                  event.confidence > 80 ? 'bg-orange-500' :
                                  'bg-yellow-500'
                                }`}
                                style={{ width: `${event.confidence}%` }}
                              ></div>
                            </div>
                            <span>{event.confidence}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className={`inline-flex items-center px-2 py-1 rounded border ${getActionColor(event.action)}`}>
                            {getActionIcon(event.action)}
                            <span className="ml-1 capitalize text-xs">{event.action}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={event.target}>
                          {event.target}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center">
                            {getStatusIcon(event.status)}
                            <span className="ml-1 capitalize">{event.status}</span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'rules' && (
          <div className="p-4">
            <div className="flex justify-between mb-4">
              <div>
                <span className="text-sm text-zinc-400">{rules.filter(r => r.status === 'enabled').length} active rules</span>
              </div>
              <button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm"
                onClick={() => setNewRule(!newRule)}
              >
                + Add Rule
              </button>
            </div>
            
            {newRule && (
              <motion.div 
                className="bg-zinc-700 p-4 rounded-md mb-4 border border-zinc-600"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <h3 className="text-sm font-medium mb-3">New Response Rule</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Rule Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-800 rounded px-3 py-2 text-sm"
                      placeholder="Enter rule name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Confidence Threshold (%)</label>
                    <input 
                      type="number" 
                      className="w-full bg-zinc-800 rounded px-3 py-2 text-sm" 
                      placeholder="75"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Action</label>
                    <select className="w-full bg-zinc-800 rounded px-3 py-2 text-sm">
                      <option value="quarantine">Quarantine</option>
                      <option value="block">Block</option>
                      <option value="alert">Alert</option>
                      <option value="terminate">Terminate</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button 
                    className="bg-zinc-600 hover:bg-zinc-500 text-white px-3 py-1 rounded text-sm"
                    onClick={() => setNewRule(false)}
                  >
                    Cancel
                  </button>
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm">
                    Save Rule
                  </button>
                </div>
              </motion.div>
            )}
            
            <div className="grid gap-4">
              {rules.map((rule) => (
                <div 
                  key={rule.id} 
                  className={`bg-zinc-700 p-4 rounded-md border ${rule.status === 'enabled' ? 'border-emerald-900' : 'border-zinc-600'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      {getActionIcon(rule.action)}
                      <h3 className="font-medium ml-2">{rule.name}</h3>
                    </div>
                    <div className="flex items-center">
                      <span className={`text-xs px-2 py-1 rounded ${rule.status === 'enabled' ? 'bg-emerald-500 bg-opacity-20 text-emerald-500' : 'bg-zinc-600 text-zinc-400'}`}>
                        {rule.status}
                      </span>
                      <button className="ml-4 text-zinc-400 hover:text-zinc-200">
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-zinc-400">Confidence Threshold</div>
                      <div className="flex items-center mt-1">
                        <div className="w-full bg-zinc-800 rounded-full h-2 mr-2">
                          <div 
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${rule.threshold}%` }}
                          ></div>
                        </div>
                        <span className="text-xs">{rule.threshold}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-zinc-400">Trigger Count</div>
                      <div className="text-sm mt-1">{rule.count}</div>
                    </div>
                    
                    {rule.lastTriggered && (
                      <div>
                        <div className="text-xs text-zinc-400">Last Triggered</div>
                        <div className="text-sm mt-1">{rule.lastTriggered}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-6 flex-1">
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg">
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Network className="mr-2 text-emerald-500" size={16} />
            Active Network Blocks
          </h3>
          <div className="space-y-2">
            {['192.168.1.100:4444', '45.77.123.45:8080', '103.45.67.89:*'].map((ip, index) => (
              <div key={index} className="bg-zinc-700 p-2 rounded flex justify-between items-center">
                <div className="font-mono text-sm">{ip}</div>
                <div className="flex items-center">
                  <span className="text-xs text-red-500 mr-2">Blocked</span>
                  <XCircle size={14} className="text-red-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg">
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Shield className="mr-2 text-emerald-500" size={16} />
            Quarantined Items
          </h3>
          <div className="space-y-2">
            {['suspicious_file.exe', 'infected_document.pdf', 'malware_installer.msi'].map((file, index) => (
              <div key={index} className="bg-zinc-700 p-2 rounded flex justify-between items-center">
                <div className="text-sm">{file}</div>
                <div className="flex items-center">
                  <span className="text-xs text-emerald-500 mr-2">Secured</span>
                  <CheckCircle size={14} className="text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg">
          <h3 className="text-sm font-medium mb-3 flex items-center">
            <Server className="mr-2 text-emerald-500" size={16} />
            Terminated Processes
          </h3>
          <div className="space-y-2">
            {['malware_process.exe (PID: 1234)', 'suspicious_service.exe (PID: 5678)', 'unknown_process.exe (PID: 9012)'].map((process, index) => (
              <div key={index} className="bg-zinc-700 p-2 rounded flex justify-between items-center">
                <div className="text-sm">{process}</div>
                <div className="flex items-center">
                  <span className="text-xs text-blue-500 mr-2">Terminated</span>
                  <Terminal size={14} className="text-blue-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
