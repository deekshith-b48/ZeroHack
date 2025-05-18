'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Activity, Cpu, Clock, Folder } from 'lucide-react';

interface Process {
  id: number;
  name: string;
  status: 'normal' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  path: string;
  started: string;
}

export function ProcessMonitor() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);

  useEffect(() => {
    // Simulate loading processes
    const mockProcesses: Process[] = [
      {
        id: 1,
        name: 'system.exe',
        status: 'normal',
        cpu: 2.4,
        memory: 124.5,
        path: 'C:\\Windows\\System32',
        started: '2023-05-16 08:23:45',
      },
      {
        id: 2,
        name: 'browser.exe',
        status: 'normal',
        cpu: 15.7,
        memory: 450.2,
        path: 'C:\\Program Files\\Browser',
        started: '2023-05-16 09:12:30',
      },
      {
        id: 3,
        name: 'suspicious_process.exe',
        status: 'warning',
        cpu: 45.2,
        memory: 890.7,
        path: 'C:\\Temp',
        started: '2023-05-16 10:45:12',
      },
      {
        id: 4,
        name: 'malware.exe',
        status: 'critical',
        cpu: 87.5,
        memory: 1240.3,
        path: 'C:\\Users\\AppData\\Temp',
        started: '2023-05-16 11:03:22',
      },
      {
        id: 5,
        name: 'explorer.exe',
        status: 'normal',
        cpu: 1.2,
        memory: 85.6,
        path: 'C:\\Windows',
        started: '2023-05-16 08:00:15',
      },
      {
        id: 6,
        name: 'svchost.exe',
        status: 'normal',
        cpu: 0.8,
        memory: 45.2,
        path: 'C:\\Windows\\System32',
        started: '2023-05-16 08:00:05',
      },
    ];

    setProcesses(mockProcesses);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'critical':
        return <XCircle size={18} className="text-red-500" />;
      default:
        return null;
    }
  };

  const handleProcessClick = (process: Process) => {
    setSelectedProcess(process);
  };

  const handleTerminateProcess = () => {
    if (selectedProcess) {
      setProcesses(processes.filter(p => p.id !== selectedProcess.id));
      setSelectedProcess(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Process Monitor</h2>
        <div className="flex space-x-2">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md">
            Refresh
          </button>
          <button 
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedProcess}
            onClick={handleTerminateProcess}
          >
            Terminate Process
          </button>
        </div>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Active Processes
          </div>
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full">
              <thead className="bg-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Process Name</th>
                  <th className="px-4 py-2 text-left">CPU %</th>
                  <th className="px-4 py-2 text-left">Memory (MB)</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr 
                    key={process.id} 
                    className={`border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                      selectedProcess?.id === process.id ? 'bg-zinc-700' : ''
                    }`}
                    onClick={() => handleProcessClick(process)}
                  >
                    <td className="px-4 py-3">{getStatusIcon(process.status)}</td>
                    <td className="px-4 py-3">{process.name}</td>
                    <td className="px-4 py-3">{process.cpu}%</td>
                    <td className="px-4 py-3">{process.memory} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-80 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Process Details
          </div>
          {selectedProcess ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Activity size={20} className="text-zinc-400" />
                <div>
                  <div className="text-sm text-zinc-400">Process Name</div>
                  <div className="font-medium">{selectedProcess.name}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Cpu size={20} className="text-zinc-400" />
                <div>
                  <div className="text-sm text-zinc-400">CPU Usage</div>
                  <div className="font-medium">{selectedProcess.cpu}%</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <path d="M5 12h14"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Memory Usage</div>
                  <div className="font-medium">{selectedProcess.memory} MB</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Folder size={20} className="text-zinc-400" />
                <div>
                  <div className="text-sm text-zinc-400">Path</div>
                  <div className="font-medium text-sm">{selectedProcess.path}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock size={20} className="text-zinc-400" />
                <div>
                  <div className="text-sm text-zinc-400">Started</div>
                  <div className="font-medium">{selectedProcess.started}</div>
                </div>
              </div>
              
              <div className="pt-4">
                <div className="text-sm text-zinc-400 mb-2">Status</div>
                <div className={`px-3 py-2 rounded-md font-medium ${
                  selectedProcess.status === 'normal' ? 'bg-green-900 bg-opacity-30 text-green-500' :
                  selectedProcess.status === 'warning' ? 'bg-yellow-900 bg-opacity-30 text-yellow-500' :
                  'bg-red-900 bg-opacity-30 text-red-500'
                }`}>
                  {selectedProcess.status === 'normal' && 'Normal - No threats detected'}
                  {selectedProcess.status === 'warning' && 'Warning - Suspicious behavior'}
                  {selectedProcess.status === 'critical' && 'Critical - Malicious activity detected'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              <Activity size={40} className="mx-auto mb-4 opacity-50" />
              <p>Select a process to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
