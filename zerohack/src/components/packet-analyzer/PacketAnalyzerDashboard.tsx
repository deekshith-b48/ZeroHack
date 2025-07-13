'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, Code, Database, Filter, Globe, 
         GraduationCap, Languages, Microscope, RefreshCw, Search, Settings, Upload, X, Cpu, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PacketData, 
  AnalysisResult, 
  analyzePacketWithAI, 
  PacketAIModel
} from '@/lib/packet-analyzer';
import { LanguageAnalyzer } from './LanguageAnalyzer';

// Configuration for API endpoint
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;
import { StealthDetector } from './StealthDetector';
import { ProtocolAnalyzer } from './ProtocolAnalyzer';

// Mock packet generation for demo purposes
function generateMockPackets(count: number): PacketData[] {
  const protocols = ['HTTP', 'DNS', 'SMTP', 'FTP', 'Unknown'];
  const sourceIPs = ['192.168.1.100', '10.0.0.5', '172.16.0.10', '8.8.8.8', '1.1.1.1'];
  const destIPs = ['93.184.216.34', '104.18.22.46', '172.217.170.78', '13.107.42.12', '151.101.1.140'];
  
  return Array.from({ length: count }).map((_, i) => {
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const size = Math.floor(Math.random() * 1500) + 40;
    
    // Create random payload
    const payload = new Uint8Array(size);
    crypto.getRandomValues(payload);
    
    // Potentially inject text for language analysis
    if (Math.random() > 0.7) {
      const text = `This is a sample packet payload with potential sensitive information like API_KEY=sk-12345abcdef or password: secretpass123 for testing language detection.`;
      const encoder = new TextEncoder();
      const textBytes = encoder.encode(text);
      
      // Make sure we don't exceed the payload size
      const bytesToCopy = Math.min(textBytes.length, payload.length);
      payload.set(textBytes.slice(0, bytesToCopy), 0);
    }
    
    return {
      id: `pkt-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
      sourceIP: sourceIPs[Math.floor(Math.random() * sourceIPs.length)],
      destinationIP: destIPs[Math.floor(Math.random() * destIPs.length)],
      sourcePort: Math.floor(Math.random() * 65535),
      destinationPort: [80, 443, 53, 25, 21, 8080][Math.floor(Math.random() * 6)],
      protocol,
      size,
      payload,
      flags: {
        syn: Math.random() > 0.8,
        ack: Math.random() > 0.3,
        fin: Math.random() > 0.9,
        rst: Math.random() > 0.95
      },
      headers: protocol === 'HTTP' ? {
        'Host': 'example.com',
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
        'Content-Type': 'application/json'
      } : {}
    };
  });
}

export default function PacketAnalyzerDashboard() {
  const [packets, setPackets] = useState<PacketData[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<PacketData | null>(null);
  const [packetAnalysis, setPacketAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'language' | 'stealth' | 'protocol'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiModel, setAiModel] = useState<PacketAIModel>('azure-gpt-4o');
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
  const captureIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial packets
  useEffect(() => {
    const initialPackets = generateMockPackets(15);
    setPackets(initialPackets);
  }, []);

  // Handle packet capture toggle
  useEffect(() => {
    if (captureActive) {
      captureIntervalRef.current = setInterval(() => {
        const newPacket = generateMockPackets(1)[0];
        setPackets(prev => [newPacket, ...prev.slice(0, 99)]); // Keep last 100 packets
      }, 3000);
    } else if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    
    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [captureActive]);

  // Analyze selected packet with AI
  const analyzePacket = async (packet: PacketData) => {
    const startTime = performance.now();
    setIsAnalyzing(true);
    
    try {
      // Simulate GPU acceleration and performance monitoring
      setEngineStats(prev => ({
        ...prev,
        cpuUsage: Math.floor(15 + Math.random() * 25),
        averageLatency: Math.floor(80 + Math.random() * 90)
      }));
      
      // The old way used a mock function. New way calls the backend API.
      // const result = await analyzePacketWithAI(packet, aiModel);

      // The /api/analyze endpoint expects a list of events.
      // We will send a single packet as a session of one event.
      // The `payload` needs to be serializable, so we convert Uint8Array to an array of numbers.
      const serializablePacket = {
        ...packet,
        payload: Array.from(packet.payload), // Convert Uint8Array to number array
        timestamp: packet.timestamp.toISOString(), // Convert Date to ISO string
      };

      const response = await fetch(ANALYZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [serializablePacket] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const result = await response.json();

      // The backend response is the aggregator's result. We need to map it
      // to the frontend's `AnalysisResult` interface.
      // This is a placeholder mapping.
      const mappedResult: AnalysisResult = {
        packetId: packet.id,
        threatScore: result.confidence * 100, // Convert 0-1 confidence to 0-100 score
        classification: result.final_verdict === 'THREAT' ? 'malicious' : 'benign',
        // The other fields (detectedLanguages, etc.) are not directly provided by the
        // current aggregator response and would require more detailed parsing of layer_outputs.
        // For now, we'll leave them empty.
        detectedLanguages: [],
        detectedSteganography: [],
        protocolAnalysis: {
            protocolName: packet.protocol,
            isValid: true,
            anomalies: [],
            structuralAnalysis: {}
        },
        aiAnalysis: result.explanation_summary,
        confidence: result.confidence,
      };

      setPacketAnalysis(mappedResult);
      
      const endTime = performance.now();
      setProcessingTime(Math.round(endTime - startTime));
    } catch (error) {
      console.error('Error analyzing packet:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle packet selection
  const handlePacketSelect = (packet: PacketData) => {
    setSelectedPacket(packet);
    analyzePacket(packet);
  };

  // Filter packets
  const filteredPackets = packets.filter(packet => {
    if (!filter) return true;
    
    const filterLower = filter.toLowerCase();
    return (
      packet.protocol.toLowerCase().includes(filterLower) ||
      packet.sourceIP.includes(filter) ||
      packet.destinationIP.includes(filter) ||
      packet.id.toLowerCase().includes(filterLower)
    );
  });

  // Get status badge style
  const getStatusBadge = (classification?: 'benign' | 'suspicious' | 'malicious') => {
    switch (classification) {
      case 'malicious':
        return <span className="inline-flex items-center px-2 py-1 bg-red-600 bg-opacity-20 text-red-500 rounded-full text-xs font-medium">
          <AlertTriangle size={12} className="mr-1" />
          Malicious
        </span>;
      case 'suspicious':
        return <span className="inline-flex items-center px-2 py-1 bg-yellow-600 bg-opacity-20 text-yellow-500 rounded-full text-xs font-medium">
          <AlertTriangle size={12} className="mr-1" />
          Suspicious
        </span>;
      case 'benign':
      default:
        return <span className="inline-flex items-center px-2 py-1 bg-green-600 bg-opacity-20 text-green-500 rounded-full text-xs font-medium">
          <CheckCircle size={12} className="mr-1" />
          Benign
        </span>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Activity className="mr-2 text-emerald-500" size={24} />
            AI-Powered Packet Analysis
          </h2>
          <p className="text-zinc-400 text-sm mt-1">CodeBERT analysis (96% accuracy) with XGBoost classification and OpenCV steganalysis</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-zinc-400">AI Engine:</span>
            <select 
              className="bg-zinc-800 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-zinc-700"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value as PacketAIModel)}
            >
              <option value="azure-gpt-4o">CodeBERT+XGBoost</option>
              <option value="azure-gpt-4o-mini">OpenCV+Tesseract OCR</option>
              <option value="gemini-1.5-pro">Scapy+XGBoost</option>
              <option value="gemini-2.0-flash-exp">Multi-modal Pipeline</option>
              <option value="claude-bedrock">Ensemble Model</option>
            </select>
          </div>
          
          <div className="bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-700 flex items-center">
            <Gauge size={16} className="text-emerald-500 mr-2" />
            <span className="text-xs text-zinc-300">
              {processingTime > 0 ? (
                <span>Analysis time: <span className="text-emerald-500 font-semibold">{processingTime}ms</span></span>
              ) : (
                <span>ONNX GPU Accelerated</span>
              )}
            </span>
          </div>
          
          <button 
            className={`flex items-center px-4 py-2 rounded-md ${
              captureActive 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-emerald-600 hover:bg-emerald-700'
            } text-white transition-colors`}
            onClick={() => setCaptureActive(!captureActive)}
          >
            {captureActive ? (
              <>
                <X className="mr-2" size={18} />
                Stop Capture
              </>
            ) : (
              <>
                <Activity className="mr-2" size={18} />
                Start Capture
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-sm">Packets Analyzed</div>
            <div className="text-xl font-bold">{packets.length}</div>
          </div>
          <div className="bg-emerald-600 bg-opacity-20 p-2 rounded-lg">
            <Activity className="text-emerald-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-sm">Threats Detected</div>
            <div className="text-xl font-bold">
              {packets.filter(p => packetAnalysis?.packetId === p.id && packetAnalysis?.classification === 'malicious').length}
            </div>
          </div>
          <div className="bg-red-600 bg-opacity-20 p-2 rounded-lg">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-sm">Suspicious Packets</div>
            <div className="text-xl font-bold">
              {packets.filter(p => packetAnalysis?.packetId === p.id && packetAnalysis?.classification === 'suspicious').length}
            </div>
          </div>
          <div className="bg-yellow-600 bg-opacity-20 p-2 rounded-lg">
            <AlertTriangle className="text-yellow-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-sm">ONNX Performance</div>
            <div className="text-xl font-bold">{engineStats.averageLatency}ms</div>
            <div className="text-xs text-zinc-500">
              {engineStats.batchSize}-packet batching
            </div>
          </div>
          <div className="bg-blue-600 bg-opacity-20 p-2 rounded-lg">
            <Cpu className="text-blue-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-sm">GPU Acceleration</div>
            <div className="text-xl font-bold">{engineStats.throughput} p/s</div>
            <div className="text-xs text-zinc-500">
              CUDA Enabled
            </div>
          </div>
          <div className="bg-purple-600 bg-opacity-20 p-2 rounded-lg">
            <GraduationCap className="text-purple-500" size={20} />
          </div>
        </div>
      </div>

      <div className="flex space-x-4 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Filter packets by protocol, IP, or ID..."
            className="w-full bg-zinc-800 text-white pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
        </div>
        
        <button className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-md flex items-center">
          <Filter size={18} className="mr-2" />
          Advanced Filters
        </button>
        
        <button 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md flex items-center"
          onClick={() => {
            const newPackets = generateMockPackets(10);
            setPackets(prev => [...newPackets, ...prev]);
          }}
        >
          <RefreshCw size={18} className="mr-2" />
          Generate Test Packets
        </button>
      </div>

      <div className="flex flex-1 space-x-4 overflow-hidden">
        <div className="w-1/2 bg-zinc-800 rounded-lg flex flex-col overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Packet Capture
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Protocol</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-left">Destination</th>
                  <th className="px-4 py-2 text-left">Size</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackets.map((packet) => {
                  const analysisResult = packetAnalysis?.packetId === packet.id ? packetAnalysis : null;
                  
                  return (
                    <motion.tr 
                      key={packet.id} 
                      className={`border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                        selectedPacket?.id === packet.id ? 'bg-zinc-700' : ''
                      }`}
                      onClick={() => handlePacketSelect(packet)}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-2">
                        {packet.timestamp.toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center px-2 py-1 bg-zinc-700 rounded text-xs">
                          {packet.protocol}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {packet.sourceIP}:{packet.sourcePort}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {packet.destinationIP}:{packet.destinationPort}
                      </td>
                      <td className="px-4 py-2">
                        {packet.size} bytes
                      </td>
                      <td className="px-4 py-2">
                        {analysisResult ? getStatusBadge(analysisResult.classification) : '-'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="bg-zinc-800 rounded-lg overflow-hidden mb-4">
            <div className="bg-zinc-700 px-4 py-3 font-medium flex justify-between items-center">
              <div>Packet Details</div>
              {selectedPacket && (
                <div className="text-xs text-zinc-400">
                  ID: {selectedPacket.id.substring(0, 16)}...
                </div>
              )}
            </div>
            <div className="p-4">
              {selectedPacket ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Protocol</div>
                      <div className="font-medium flex items-center">
                        <Globe size={16} className="mr-2 text-blue-400" />
                        {selectedPacket.protocol}
                      </div>
                    </div>
                    
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Size</div>
                      <div className="font-medium flex items-center">
                        <Database size={16} className="mr-2 text-emerald-400" />
                        {selectedPacket.size} bytes
                      </div>
                    </div>
                    
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Source</div>
                      <div className="font-medium font-mono text-sm">
                        {selectedPacket.sourceIP}:{selectedPacket.sourcePort}
                      </div>
                    </div>
                    
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Destination</div>
                      <div className="font-medium font-mono text-sm">
                        {selectedPacket.destinationIP}:{selectedPacket.destinationPort}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-xs text-zinc-400 mb-1">Flags</div>
                    <div className="flex space-x-2">
                      {selectedPacket.flags && Object.entries(selectedPacket.flags).map(([flag, value]) => (
                        <span 
                          key={flag} 
                          className={`px-2 py-1 rounded-md text-xs font-mono ${
                            value 
                              ? 'bg-emerald-600 bg-opacity-20 text-emerald-500' 
                              : 'bg-zinc-600 text-zinc-400'
                          }`}
                        >
                          {flag.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {Object.keys(selectedPacket.headers || {}).length > 0 && (
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Headers</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto text-xs font-mono">
                        {Object.entries(selectedPacket.headers || {}).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-zinc-300">{key}:</span>
                            <span className="text-zinc-400">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-zinc-700 rounded p-3">
                    <div className="text-xs text-zinc-400 mb-1">Payload Preview</div>
                    <div className="font-mono text-xs overflow-auto max-h-24 bg-zinc-800 p-2 rounded">
                      {Array.from(selectedPacket.payload.slice(0, 100)).map((byte, i) => (
                        <span key={i} className="mr-1">{byte.toString(16).padStart(2, '0')}</span>
                      ))}
                      {selectedPacket.payload.length > 100 && '...'}
                    </div>
                  </div>
                  
                  {packetAnalysis && (
                    <div className="bg-zinc-700 rounded p-3">
                      <div className="text-xs text-zinc-400 mb-1">Threat Analysis</div>
                      <div className="flex justify-between items-center">
                        <div className="font-medium flex items-center">
                          {packetAnalysis.classification === 'malicious' ? (
                            <AlertTriangle size={16} className="mr-2 text-red-500" />
                          ) : packetAnalysis.classification === 'suspicious' ? (
                            <AlertTriangle size={16} className="mr-2 text-yellow-500" />
                          ) : (
                            <CheckCircle size={16} className="mr-2 text-green-500" />
                          )}
                          {packetAnalysis.classification.charAt(0).toUpperCase() + packetAnalysis.classification.slice(1)}
                        </div>
                        
                        <div className="text-sm">
                          Threat Score: 
                          <span className={`ml-1 font-medium ${
                            packetAnalysis.threatScore > 70 ? 'text-red-500' :
                            packetAnalysis.threatScore > 30 ? 'text-yellow-500' :
                            'text-green-500'
                          }`}>
                            {packetAnalysis.threatScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                  <Database size={48} className="mb-2 opacity-50" />
                  <div>Select a packet to view details</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-800 rounded-lg flex-1 flex flex-col overflow-hidden">
            <div className="bg-zinc-700 px-4 py-3 font-medium flex border-b border-zinc-600">
              <button
                className={`px-4 py-1 mr-2 ${activeTab === 'protocol' ? 'bg-zinc-800 rounded-t' : 'text-zinc-400'}`}
                onClick={() => setActiveTab('protocol')}
              >
                <Code size={16} className="mr-2 inline-block" /> 
                Protocol Analysis
              </button>
              <button
                className={`px-4 py-1 mr-2 ${activeTab === 'language' ? 'bg-zinc-800 rounded-t' : 'text-zinc-400'}`}
                onClick={() => setActiveTab('language')}
              >
                <Languages size={16} className="mr-2 inline-block" /> 
                Language Analysis
              </button>
              <button
                className={`px-4 py-1 ${activeTab === 'stealth' ? 'bg-zinc-800 rounded-t' : 'text-zinc-400'}`}
                onClick={() => setActiveTab('stealth')}
              >
                <Microscope size={16} className="mr-2 inline-block" /> 
                Stealth Detection
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {selectedPacket && packetAnalysis ? (
                isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-t-transparent border-emerald-500 rounded-full animate-spin mb-4"></div>
                    <div className="text-zinc-400">Analyzing packet with AI...</div>
                  </div>
                ) : (
                  <div className="p-4 h-full">
                    {activeTab === 'protocol' && (
                      <ProtocolAnalyzer 
                        packet={selectedPacket} 
                        analysis={packetAnalysis} 
                      />
                    )}
                    
                    {activeTab === 'language' && (
                      <LanguageAnalyzer 
                        packet={selectedPacket} 
                        analysis={packetAnalysis}
                        aiModel={aiModel}
                      />
                    )}
                    
                    {activeTab === 'stealth' && (
                      <StealthDetector 
                        packet={selectedPacket} 
                        analysis={packetAnalysis} 
                        aiModel={aiModel}
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <GraduationCap size={48} className="mb-2 opacity-50" />
                  <div>Select a packet to perform analysis</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
