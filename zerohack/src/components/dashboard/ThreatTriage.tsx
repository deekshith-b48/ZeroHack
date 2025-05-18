'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, AlertCircle, Check, X, PlayCircle, Brain } from 'lucide-react';
import { ThreatAlert, mockWebSocketService } from '@/lib/websocket';
import { generateText } from '@/lib/api/util';

interface ThreatTriageProps {}

export function ThreatTriage(_props: ThreatTriageProps) {
  const [threats, setThreats] = useState<ThreatAlert[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatAlert | null>(null);
  const [threatResponse, setThreatResponse] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProvider, setAiProvider] = useState('azure-gpt-4o');
  const [expandedThreats, setExpandedThreats] = useState<Record<string, boolean>>({});

  // Initialize mock WebSocket
  useEffect(() => {
    // Ensure mock service is started
    mockWebSocketService.start();
    
    return () => {
      // Clean up is handled by the parent component
    };
  }, []);

  // Subscribe to threat alerts
  useEffect(() => {
    const unsubscribe = mockWebSocketService.subscribe('threat_alert', (alert: ThreatAlert) => {
      setThreats(prev => {
        // Keep only the most recent 50 threats
        const newThreats = [alert, ...prev].slice(0, 50);
        return newThreats;
      });
    });
    
    return unsubscribe;
  }, []);

  const toggleThreatExpansion = (threatId: string) => {
    setExpandedThreats(prev => ({
      ...prev,
      [threatId]: !prev[threatId]
    }));
  };

  const handleAnalyzeThreat = async () => {
    if (!selectedThreat) return;
    
    setIsAnalyzing(true);
    setThreatResponse(null);
    
    try {
      const prompt = `
You are ZeroHack Sentinel Shield's AI Security Analyst. Analyze this cybersecurity threat alert and provide detailed recommendations:

Threat Details:
- Severity: ${selectedThreat.severity}
- Process: ${selectedThreat.process}
- Description: ${selectedThreat.description}
- Detection Method: ${selectedThreat.detectionMethod}
${selectedThreat.mitreAttack ? `- MITRE ATT&CK: ${selectedThreat.mitreAttack}` : ''}
- Indicators: ${selectedThreat.indicators.join(', ')}
- Current Status: ${selectedThreat.containmentStatus || 'No containment action taken'}

Please provide:
1. Detailed threat analysis (what this alert means)
2. Impact assessment (potential consequences if exploit succeeds)
3. Immediate containment recommendations (prioritized actions)
4. Forensic investigation steps
5. Prevention measures to avoid similar threats

Format your response in markdown with clear sections.
`;

      const result = await generateText(prompt, aiProvider);
      setThreatResponse(result.text);
    } catch (error) {
      console.error('Error analyzing threat:', error);
      setThreatResponse('Error analyzing threat. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900 bg-opacity-30 text-red-500 border-red-900';
      case 'high':
        return 'bg-orange-900 bg-opacity-30 text-orange-500 border-orange-900';
      case 'medium':
        return 'bg-yellow-900 bg-opacity-30 text-yellow-500 border-yellow-900';
      case 'low':
        return 'bg-blue-900 bg-opacity-30 text-blue-500 border-blue-900';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getContainmentStatusIcon = (status?: string) => {
    switch (status) {
      case 'contained':
        return <Check size={16} className="text-green-500" />;
      case 'pending':
        return <PlayCircle size={16} className="text-yellow-500" />;
      case 'failed':
        return <X size={16} className="text-red-500" />;
      default:
        return <AlertCircle size={16} className="text-zinc-500" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle size={20} className={severity === 'critical' ? 'text-red-500' : 'text-orange-500'} />;
      case 'medium':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'low':
        return <AlertTriangle size={20} className="text-blue-500" />;
      default:
        return null;
    }
  };

  const containThreat = (threatId: string) => {
    setThreats(prev => 
      prev.map(threat => 
        threat.id === threatId 
          ? { ...threat, containmentStatus: 'contained' } 
          : threat
      )
    );

    if (selectedThreat?.id === threatId) {
      setSelectedThreat(prev => 
        prev ? { ...prev, containmentStatus: 'contained' } : null
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <ShieldAlert size={24} className="mr-2 text-emerald-500" />
            Threat Triage
          </h2>
          <p className="text-zinc-400 text-sm mt-1">AI-powered analysis and autonomous response system</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-emerald-500">Response system: ACTIVE</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-sm text-zinc-400">AI Provider:</span>
            <select
              className="bg-zinc-800 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-zinc-700"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="azure-gpt-4o">Azure GPT-4o</option>
              <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
              <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
              <option value="claude-bedrock">Claude</option>
              <option value="deepseek-r1">Deepseek R1</option>
              <option value="deepseek-v3">Deepseek V3</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        <div className="w-1/2 bg-zinc-800 rounded-lg flex flex-col overflow-hidden border border-zinc-800 shadow-lg">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Active Threats ({threats.length})
          </div>
          <div className="overflow-auto flex-1">
            {threats.length > 0 ? (
              <div className="divide-y divide-zinc-700">
                {threats.map((threat) => (
                  <div key={threat.id} className="p-0">
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-700 ${
                        selectedThreat?.id === threat.id ? 'bg-zinc-700' : ''
                      }`}
                      onClick={() => setSelectedThreat(threat)}
                    >
                      <div className="flex items-center space-x-3">
                        {getSeverityIcon(threat.severity)}
                        <div>
                          <div className="font-medium">{threat.description}</div>
                          <div className="text-sm text-zinc-400">
                            {threat.process} • {new Date(threat.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${getSeverityClass(threat.severity)}`}>
                          {threat.severity}
                        </span>
                        <button
                          className="p-1 hover:bg-zinc-600 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleThreatExpansion(threat.id);
                          }}
                        >
                          {expandedThreats[threat.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                    
                    {expandedThreats[threat.id] && (
                      <div className="px-4 py-3 bg-zinc-800 text-sm border-t border-zinc-700">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-zinc-400">Detection Method</div>
                            <div>{threat.detectionMethod}</div>
                          </div>
                          <div>
                            <div className="text-zinc-400">Status</div>
                            <div className="flex items-center">
                              {getContainmentStatusIcon(threat.containmentStatus)}
                              <span className="ml-1">
                                {threat.containmentStatus || 'None'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {threat.mitreAttack && (
                          <div className="mt-2">
                            <div className="text-zinc-400">MITRE ATT&CK</div>
                            <div>{threat.mitreAttack}</div>
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <div className="text-zinc-400">Indicators</div>
                          <ul className="list-disc list-inside">
                            {threat.indicators.map((indicator, i) => (
                              <li key={i}>{indicator}</li>
                            ))}
                          </ul>
                        </div>
                        
                        {threat.ipfsHash && (
                          <div className="mt-2">
                            <div className="text-zinc-400">IPFS Hash</div>
                            <div className="font-mono text-xs">{threat.ipfsHash}</div>
                          </div>
                        )}
                        
                        <div className="mt-4 flex justify-end space-x-2">
                          <button
                            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedThreat(threat);
                            }}
                          >
                            View Details
                          </button>
                          {threat.containmentStatus !== 'contained' && (
                            <button
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                containThreat(threat.id);
                              }}
                            >
                              Contain Threat
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500">
                <AlertCircle size={40} className="mx-auto mb-4 opacity-50" />
                <p>No active threats detected</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col space-y-4 overflow-hidden">
          <div className="bg-zinc-800 rounded-lg overflow-hidden flex-1 border border-zinc-800 shadow-lg">
            <div className="bg-zinc-700 px-4 py-3 font-medium">
              Threat Analysis
            </div>
            {selectedThreat ? (
              <div className="p-4 h-[calc(100%-40px)] flex flex-col">
                <div className="flex justify-between mb-4">
                  <div className="space-y-1">
                    <div className="font-medium text-lg">{selectedThreat.description}</div>
                    <div className="text-sm text-zinc-400">
                      Detected at {new Date(selectedThreat.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className={`px-3 py-1 h-fit text-sm font-medium rounded flex items-center ${getSeverityClass(selectedThreat.severity)}`}>
                    {getSeverityIcon(selectedThreat.severity)}
                    <span className="ml-1">{selectedThreat.severity}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-sm text-zinc-400">Process</div>
                    <div>{selectedThreat.process}</div>
                  </div>
                  
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-sm text-zinc-400">Detection Method</div>
                    <div>{selectedThreat.detectionMethod}</div>
                  </div>
                  
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-sm text-zinc-400">Status</div>
                    <div className="flex items-center">
                      {getContainmentStatusIcon(selectedThreat.containmentStatus)}
                      <span className="ml-1">
                        {selectedThreat.containmentStatus || 'No containment action'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-sm text-zinc-400">User Context</div>
                    <div>{selectedThreat.user || 'Unknown'}</div>
                  </div>
                </div>
                
                {selectedThreat.mitreAttack && (
                  <div className="bg-zinc-700 rounded p-3 mb-4">
                    <div className="text-sm text-zinc-400 mb-1">MITRE ATT&CK</div>
                    <div>{selectedThreat.mitreAttack}</div>
                  </div>
                )}
                
                <div className="bg-zinc-700 rounded p-3 mb-4">
                  <div className="text-sm text-zinc-400 mb-1">Indicators</div>
                  <ul className="list-disc list-inside">
                    {selectedThreat.indicators.map((indicator, i) => (
                      <li key={i}>{indicator}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-auto flex space-x-3">
                  <button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md flex justify-center items-center"
                    onClick={handleAnalyzeThreat}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'AI Threat Analysis'}
                  </button>
                  
                  {selectedThreat.containmentStatus !== 'contained' && (
                    <button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                      onClick={() => containThreat(selectedThreat.id)}
                    >
                      Contain Threat
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center h-[calc(100%-40px)]">
                <AlertTriangle size={40} className="mb-4 opacity-50" />
                <p>Select a threat to view analysis</p>
              </div>
            )}
          </div>

          <div className="bg-zinc-800 rounded-lg overflow-hidden flex-1 border border-zinc-800 shadow-lg">
            <div className="bg-zinc-700 px-4 py-3 font-medium flex justify-between items-center">
              <div className="flex items-center">
                <Brain className="mr-2 text-emerald-500" size={18} />
                AI Security Recommendations
              </div>
              <div className="text-xs flex items-center">
                <span className="text-zinc-400">Response time: </span>
                <span className="ml-1 text-emerald-500 font-semibold">238ms</span>
              </div>
            </div>
            <div className="p-4 h-[calc(100%-40px)] overflow-auto">
              {threatResponse ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  {threatResponse.split('\n').map((line, i) => {
                    // Handle headers
                    if (line.startsWith('# ')) {
                      return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.substring(2)}</h1>;
                    }
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-lg font-bold mt-3 mb-2">{line.substring(3)}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={i} className="text-base font-bold mt-2 mb-1">{line.substring(4)}</h3>;
                    }
                    
                    // Handle lists
                    if (line.match(/^\d+\./)) {
                      return <div key={i} className="ml-4 mb-1">{line}</div>;
                    }
                    if (line.startsWith('- ')) {
                      return <div key={i} className="ml-4 mb-1">• {line.substring(2)}</div>;
                    }
                    
                    // Handle empty lines
                    if (line.trim() === '') {
                      return <div key={i} className="h-2"></div>;
                    }
                    
                    // Default paragraph
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>
              ) : selectedThreat ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <p>Click "AI Threat Analysis" to generate security recommendations</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <p>Select a threat to see AI recommendations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
