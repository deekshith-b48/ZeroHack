'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, Code, Database, Filter, Globe, 
         GraduationCap, Languages, Microscope, RefreshCw, Search, Settings, Upload, X, Cpu, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api/client';

interface PacketData {
  id: number;
  timestamp: string;
  source_ip: string;
  dest_ip: string;
  protocol: string;
  size: number;
  flags: string;
  threat_level: string;
  description: string;
}

interface AnalysisResult {
  packetId: string;
  threatScore: number;
  classification: 'benign' | 'suspicious' | 'malicious';
  aiAnalysis: string;
  confidence: number;
  detectedLanguages: string[];
  detectedSteganography: string[];
  protocolAnalysis: {
    protocolName: string;
    isValid: boolean;
    anomalies: string[];
    structuralAnalysis: Record<string, any>;
  };
}

export default function PacketAnalyzerDashboard() {
  const [packets, setPackets] = useState<PacketData[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<PacketData | null>(null);
  const [packetAnalysis, setPacketAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'language' | 'stealth' | 'protocol'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [engineStats, setEngineStats] = useState({
    cpuUsage: 0, 
    gpuAcceleration: true, 
    batchSize: 50, 
    averageLatency: 120, 
    throughput: 415
  });
  const [captureActive, setCaptureActive] = useState(false);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch packets from backend
  const fetchPackets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getNetworkPackets();
      if (response.data) {
        setPackets(response.data);
      } else {
        setError('Failed to fetch packets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackets();
  }, []);

  useEffect(() => {
    if (captureActive) {
      captureIntervalRef.current = setInterval(() => {
        fetchPackets();
      }, 5000);
    } else if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    return () => { 
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current); 
    };
  }, [captureActive]);

  const analyzePacket = async (packet: PacketData) => {
    const startTime = performance.now();
    setIsAnalyzing(true);
    setPacketAnalysis(null);
    
    try {
      setEngineStats(prev => ({...prev, cpuUsage: Math.floor(15 + Math.random() * 25)}));
      
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const mockResult: AnalysisResult = {
        packetId: packet.id.toString(),
        threatScore: packet.threat_level === 'CRITICAL' ? 95 : packet.threat_level === 'HIGH' ? 80 : packet.threat_level === 'MEDIUM' ? 60 : 20,
        classification: packet.threat_level === 'CRITICAL' ? 'malicious' : packet.threat_level === 'HIGH' ? 'suspicious' : 'benign',
        aiAnalysis: `Analysis of ${packet.protocol} packet from ${packet.source_ip} to ${packet.dest_ip}. ${packet.description}`,
        confidence: packet.threat_level === 'CRITICAL' ? 0.95 : packet.threat_level === 'HIGH' ? 0.8 : packet.threat_level === 'MEDIUM' ? 0.6 : 0.2,
        detectedLanguages: packet.protocol === 'HTTP' ? ['English', 'JavaScript'] : ['Binary'],
        detectedSteganography: packet.threat_level === 'CRITICAL' ? ['LSB Steganography detected'] : [],
        protocolAnalysis: {
          protocolName: packet.protocol,
          isValid: true,
          anomalies: packet.threat_level !== 'LOW' ? ['Unusual payload size', 'Suspicious timing'] : [],
          structuralAnalysis: {
            headerLength: 20,
            payloadSize: packet.size - 20,
            checksumValid: true
          }
        }
      };

      setPacketAnalysis(mockResult);
      setProcessingTime(Math.round(performance.now() - startTime));
    } catch (error) {
      console.error('Error analyzing packet:', error);
      setError('Failed to analyze packet');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePacketSelect = (packet: PacketData) => {
    setSelectedPacket(packet);
    analyzePacket(packet);
  };

  const filteredPackets = packets.filter(p =>
    !filter || 
    p.source_ip.toLowerCase().includes(filter.toLowerCase()) ||
    p.dest_ip.toLowerCase().includes(filter.toLowerCase()) ||
    p.protocol.toLowerCase().includes(filter.toLowerCase()) ||
    p.threat_level.toLowerCase().includes(filter.toLowerCase())
  );

  const getStatusBadge = (threatLevel: string) => {
    switch (threatLevel) {
      case 'CRITICAL': 
        return <span className="inline-flex items-center px-2 py-1 bg-red-600 bg-opacity-20 text-red-500 rounded-full text-xs font-medium">
          <AlertTriangle size={12} className="mr-1" />Critical
        </span>;
      case 'HIGH': 
        return <span className="inline-flex items-center px-2 py-1 bg-orange-600 bg-opacity-20 text-orange-500 rounded-full text-xs font-medium">
          <AlertTriangle size={12} className="mr-1" />High
        </span>;
      case 'MEDIUM': 
        return <span className="inline-flex items-center px-2 py-1 bg-yellow-600 bg-opacity-20 text-yellow-500 rounded-full text-xs font-medium">
          <AlertTriangle size={12} className="mr-1" />Medium
        </span>;
      default: 
        return <span className="inline-flex items-center px-2 py-1 bg-green-600 bg-opacity-20 text-green-500 rounded-full text-xs font-medium">
          <CheckCircle size={12} className="mr-1" />Low
        </span>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-zinc-800">
        <div className="flex items-center space-x-4">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Microscope className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Packet Analyzer</h1>
            <p className="text-zinc-400 text-sm">Real-time network traffic analysis with AI detection</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCaptureActive(!captureActive)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              captureActive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {captureActive ? 'Stop Capture' : 'Start Capture'}
          </button>
          
          <button
            onClick={fetchPackets}
            disabled={isLoading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Cpu className="text-emerald-500" size={16} />
            <span className="text-sm text-zinc-400">CPU:</span>
            <span className="text-sm font-medium">{engineStats.cpuUsage}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <Gauge className="text-emerald-500" size={16} />
            <span className="text-sm text-zinc-400">Latency:</span>
            <span className="text-sm font-medium">{engineStats.averageLatency}ms</span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="text-emerald-500" size={16} />
            <span className="text-sm text-zinc-400">Throughput:</span>
            <span className="text-sm font-medium">{engineStats.throughput} pps</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Filter packets..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Packet List */}
        <div className="w-1/2 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-semibold">Network Packets ({filteredPackets.length})</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="animate-spin text-emerald-500" size={24} />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-32 text-red-500">
                {error}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredPackets.map((packet) => (
                  <div
                    key={packet.id}
                    onClick={() => handlePacketSelect(packet)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedPacket?.id === packet.id 
                        ? 'bg-emerald-600 bg-opacity-20 border border-emerald-500' 
                        : 'bg-zinc-800 hover:bg-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono">{packet.source_ip}</span>
                        <span className="text-zinc-400">→</span>
                        <span className="text-sm font-mono">{packet.dest_ip}</span>
                      </div>
                      {getStatusBadge(packet.threat_level)}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{packet.protocol}</span>
                      <span>{packet.size} bytes</span>
                      <span>{new Date(packet.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Packet Details & Analysis */}
        <div className="w-1/2 flex flex-col">
          {selectedPacket ? (
            <>
              {/* Packet Details */}
              <div className="p-4 border-b border-zinc-800">
                <h3 className="font-semibold mb-4">Packet Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Source IP:</span>
                    <span className="font-mono">{selectedPacket.source_ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Destination IP:</span>
                    <span className="font-mono">{selectedPacket.dest_ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Protocol:</span>
                    <span>{selectedPacket.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Size:</span>
                    <span>{selectedPacket.size} bytes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Flags:</span>
                    <span>{selectedPacket.flags}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Threat Level:</span>
                    {getStatusBadge(selectedPacket.threat_level)}
                  </div>
                </div>
              </div>

              {/* Analysis Tabs */}
              <div className="flex-1 overflow-hidden">
                <div className="flex border-b border-zinc-800">
                  {[
                    { id: 'protocol', label: 'Protocol Analysis', icon: Code },
                    { id: 'language', label: 'Language Detection', icon: Languages },
                    { id: 'stealth', label: 'Steganography', icon: GraduationCap }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id as any)}
                      className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === id 
                          ? 'text-emerald-500 border-b-2 border-emerald-500' 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-4 h-full overflow-y-auto">
                  {isAnalyzing ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="animate-spin text-emerald-500" size={24} />
                      <span className="ml-2">Analyzing packet...</span>
                    </div>
                  ) : packetAnalysis ? (
                    <div className="space-y-4">
                      <div className="bg-zinc-800 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">AI Analysis</h4>
                        <p className="text-sm text-zinc-300">{packetAnalysis.aiAnalysis}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm text-zinc-400">Confidence:</span>
                          <span className="text-sm font-medium">{(packetAnalysis.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm text-zinc-400">Processing Time:</span>
                          <span className="text-sm font-medium">{processingTime}ms</span>
                        </div>
                      </div>

                      {activeTab === 'protocol' && (
                        <div className="bg-zinc-800 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Protocol Analysis</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Protocol:</span>
                              <span>{packetAnalysis.protocolAnalysis.protocolName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Valid:</span>
                              <span className={packetAnalysis.protocolAnalysis.isValid ? 'text-green-500' : 'text-red-500'}>
                                {packetAnalysis.protocolAnalysis.isValid ? 'Yes' : 'No'}
                              </span>
                            </div>
                            {packetAnalysis.protocolAnalysis.anomalies.length > 0 && (
                              <div>
                                <span className="text-zinc-400">Anomalies:</span>
                                <ul className="mt-1 text-red-400">
                                  {packetAnalysis.protocolAnalysis.anomalies.map((anomaly, i) => (
                                    <li key={i}>• {anomaly}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {activeTab === 'language' && (
                        <div className="bg-zinc-800 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Language Detection</h4>
                          {packetAnalysis.detectedLanguages.length > 0 ? (
                            <div className="space-y-2">
                              {packetAnalysis.detectedLanguages.map((lang, i) => (
                                <span key={i} className="inline-block bg-emerald-600 bg-opacity-20 text-emerald-500 px-2 py-1 rounded text-xs mr-2">
                                  {lang}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-400">No languages detected</p>
                          )}
                        </div>
                      )}

                      {activeTab === 'stealth' && (
                        <div className="bg-zinc-800 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Steganography Detection</h4>
                          {packetAnalysis.detectedSteganography.length > 0 ? (
                            <div className="space-y-2">
                              {packetAnalysis.detectedSteganography.map((steg, i) => (
                                <div key={i} className="text-sm text-red-400">• {steg}</div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-400">No steganography detected</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-zinc-400">
                      Select a packet to analyze
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-400">
              Select a packet to view details
            </div>
          )}
        </div>
       </div>
    </div>
  );
}
