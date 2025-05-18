'use client';

import { useState, useEffect } from 'react';
import { Brain, AlertTriangle, CheckCircle, BarChart2, Info } from 'lucide-react';
import { generateText } from '@/lib/api/util';

interface AIAlert {
  id: number;
  timestamp: string;
  process: string;
  user: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  explanation: string;
  confidence: number;
}

export function AIDetection() {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AIAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState('azure-gpt-4o');

  useEffect(() => {
    // Simulate loading AI alerts
    const mockAlerts: AIAlert[] = [
      {
        id: 1,
        timestamp: '2023-05-16 14:23:45',
        process: 'explorer.exe',
        user: 'SYSTEM',
        severity: 'low',
        description: 'Unusual file access pattern detected',
        explanation: 'Process accessed multiple sensitive files in quick succession, which is outside its normal behavior pattern.',
        confidence: 65,
      },
      {
        id: 2,
        timestamp: '2023-05-16 13:12:30',
        process: 'svchost.exe',
        user: 'SYSTEM',
        severity: 'medium',
        description: 'Anomalous network connection attempt',
        explanation: 'Process attempted to establish connection to known malicious IP address (103.45.67.89) on port 4444.',
        confidence: 82,
      },
      {
        id: 3,
        timestamp: '2023-05-16 12:45:12',
        process: 'malware.exe',
        user: 'User',
        severity: 'high',
        description: 'Process injection detected',
        explanation: 'Process attempted to inject code into another process using WriteProcessMemory API calls, consistent with malware behavior.',
        confidence: 95,
      },
    ];

    setAlerts(mockAlerts);
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low':
        return <AlertTriangle size={18} className="text-blue-500" />;
      case 'medium':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'high':
        return <AlertTriangle size={18} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-500';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
      default:
        return '';
    }
  };

  const handleAlertClick = (alert: AIAlert) => {
    setSelectedAlert(alert);
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedAlert) return;
    
    setLoading(true);
    try {
      const prompt = `Analyze this security alert and provide detailed recommendations:
      
Process: ${selectedAlert.process}
User: ${selectedAlert.user}
Description: ${selectedAlert.description}
Explanation: ${selectedAlert.explanation}
Confidence: ${selectedAlert.confidence}%

Please provide:
1. A detailed analysis of what this alert means
2. The potential impact if this is a real threat
3. Recommended actions to mitigate this threat
4. Prevention steps for the future`;

      const result = await generateText(prompt, aiProvider);
      
      // In a real app, you would update the UI with this analysis
      alert(`AI Analysis Complete: ${result.text.substring(0, 100)}...`);
    } catch (error) {
      console.error('Error analyzing with AI:', error);
      alert('Failed to analyze with AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">AI-Powered Detection</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="mr-2 text-sm text-zinc-400">AI Provider:</span>
            <select 
              className="bg-zinc-700 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="azure-gpt-4o">Azure GPT-4o</option>
            </select>
          </div>
          <button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedAlert || loading}
            onClick={handleAnalyzeWithAI}
          >
            {loading ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Behavioral Alerts
          </div>
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full">
              <thead className="bg-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left">Severity</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Process</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Confidence</th>
                  <th className="px-4 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr 
                    key={alert.id} 
                    className={`border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                      selectedAlert?.id === alert.id ? 'bg-zinc-700' : ''
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <td className="px-4 py-3">{getSeverityIcon(alert.severity)}</td>
                    <td className="px-4 py-3">{alert.description}</td>
                    <td className="px-4 py-3">{alert.process}</td>
                    <td className="px-4 py-3">{alert.user}</td>
                    <td className="px-4 py-3">{alert.confidence}%</td>
                    <td className="px-4 py-3 text-zinc-400">{alert.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-80 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Alert Details
          </div>
          {selectedAlert ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                {getSeverityIcon(selectedAlert.severity)}
                <div className={`font-medium ${getSeverityColor(selectedAlert.severity)}`}>
                  {selectedAlert.severity.charAt(0).toUpperCase() + selectedAlert.severity.slice(1)} Severity
                </div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Description</div>
                <div className="font-medium">{selectedAlert.description}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Process</div>
                <div className="font-medium">{selectedAlert.process}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">User</div>
                <div className="font-medium">{selectedAlert.user}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Time</div>
                <div className="font-medium">{selectedAlert.timestamp}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Confidence</div>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-zinc-700">
                        {selectedAlert.confidence}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-700">
                    <div 
                      style={{ width: `${selectedAlert.confidence}%` }} 
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        selectedAlert.severity === 'low' ? 'bg-blue-500' :
                        selectedAlert.severity === 'medium' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Explanation</div>
                <div className="mt-1 p-3 bg-zinc-700 rounded-md text-sm">
                  {selectedAlert.explanation}
                </div>
              </div>
              
              <div className="pt-2 flex items-center text-sm text-zinc-400">
                <Info size={14} className="mr-1" />
                SHAP analysis available for this alert
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              <Brain size={40} className="mx-auto mb-4 opacity-50" />
              <p>Select an alert to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
