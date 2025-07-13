'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, Code, Database, Filter, Globe, 
         GraduationCap, Languages, Microscope, RefreshCw, Search, Settings, Upload, X, Cpu, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PacketData, 
  AnalysisResult, 
  PacketAIModel
} from '@/lib/packet-analyzer'; // analyzePacketWithAI is no longer used from here
import { LanguageAnalyzer } from './LanguageAnalyzer';
import { StealthDetector } from './StealthDetector';
import { ProtocolAnalyzer } from './ProtocolAnalyzer';

// Configuration for API endpoint
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;

// Mock packet generation for demo purposes
function generateMockPackets(count: number): PacketData[] {
  const protocols = ['HTTP', 'DNS', 'SMTP', 'FTP', 'Unknown'];
  const sourceIPs = ['192.168.1.100', '10.0.0.5', '172.16.0.10', '8.8.8.8', '1.1.1.1'];
  const destIPs = ['93.184.216.34', '104.18.22.46', '172.217.170.78', '13.107.42.12', '151.101.1.140'];
  
  return Array.from({ length: count }).map((_, i) => {
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const size = Math.floor(Math.random() * 1500) + 40;
    const payload = new Uint8Array(size);
    crypto.getRandomValues(payload);
    
    if (Math.random() > 0.7) {
      const text = `This is a sample packet payload with potential sensitive information like API_KEY=sk-12345abcdef or password: secretpass123 for testing language detection.`;
      const encoder = new TextEncoder();
      const textBytes = encoder.encode(text);
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
      protocol, size, payload,
      flags: { syn: Math.random() > 0.8, ack: Math.random() > 0.3, fin: Math.random() > 0.9, rst: Math.random() > 0.95 },
      headers: protocol === 'HTTP' ? { 'Host': 'example.com', 'User-Agent': 'Mozilla/5.0' } : {}
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
    cpuUsage: 0, gpuAcceleration: true, batchSize: 50, averageLatency: 120, throughput: 415
  });
  const [captureActive, setCaptureActive] = useState(false);
  const [filter, setFilter] = useState('');
  const captureIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPackets(generateMockPackets(15));
  }, []);

  useEffect(() => {
    if (captureActive) {
      captureIntervalRef.current = setInterval(() => {
        setPackets(prev => [generateMockPackets(1)[0], ...prev.slice(0, 99)]);
      }, 3000);
    } else if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    return () => { if (captureIntervalRef.current) clearInterval(captureIntervalRef.current); };
  }, [captureActive]);

  const analyzePacket = async (packet: PacketData) => {
    const startTime = performance.now();
    setIsAnalyzing(true);
    setPacketAnalysis(null); // Clear previous analysis
    
    try {
      setEngineStats(prev => ({...prev, cpuUsage: Math.floor(15 + Math.random() * 25)}));
      
      const serializablePacket = {
        ...packet,
        payload: Array.from(packet.payload),
        timestamp: packet.timestamp.toISOString(),
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

      const mappedResult: AnalysisResult = {
        packetId: packet.id,
        threatScore: result.confidence * 100,
        classification: result.final_verdict === 'THREAT' ? (result.confidence > 0.8 ? 'malicious' : 'suspicious') : 'benign',
        aiAnalysis: result.explanation_summary,
        confidence: result.confidence,
        // The following are placeholders as the backend doesn't provide this level of detail yet
        detectedLanguages: [],
        detectedSteganography: [],
        protocolAnalysis: { protocolName: packet.protocol, isValid: true, anomalies: [], structuralAnalysis: {} },
      };

      setPacketAnalysis(mappedResult);
      setProcessingTime(Math.round(performance.now() - startTime));
    } catch (error) {
      console.error('Error analyzing packet:', error);
      // You could set an error state here to display in the UI
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePacketSelect = (packet: PacketData) => {
    setSelectedPacket(packet);
    analyzePacket(packet);
  };

  const filteredPackets = packets.filter(p =>
    !filter || Object.values(p).some(val => String(val).toLowerCase().includes(filter.toLowerCase()))
  );

  const getStatusBadge = (classification?: 'benign' | 'suspicious' | 'malicious') => {
    // ... (getStatusBadge implementation remains the same)
    switch (classification) {
        case 'malicious': return <span className="inline-flex items-center px-2 py-1 bg-red-600 bg-opacity-20 text-red-500 rounded-full text-xs font-medium"><AlertTriangle size={12} className="mr-1" />Malicious</span>;
        case 'suspicious': return <span className="inline-flex items-center px-2 py-1 bg-yellow-600 bg-opacity-20 text-yellow-500 rounded-full text-xs font-medium"><AlertTriangle size={12} className="mr-1" />Suspicious</span>;
        default: return <span className="inline-flex items-center px-2 py-1 bg-green-600 bg-opacity-20 text-green-500 rounded-full text-xs font-medium"><CheckCircle size={12} className="mr-1" />Benign</span>;
    }
  };

  return (
    // The entire JSX structure remains the same, only the analyzePacket function logic was changed.
    // For brevity, I am not repeating the full JSX here.
    // The component will now use the live `analyzePacket` function when a packet is clicked.
    <div className="h-full flex flex-col">
       {/* ... (Header and stats bar JSX as before) ... */}
       <div className="flex flex-1 space-x-4 overflow-hidden">
        {/* ... (Packet list table JSX as before, it calls handlePacketSelect which now triggers the live API) ... */}
        {/* ... (Packet details and analysis tabs JSX as before, they display state updated by the live API call) ... */}
       </div>
    </div>
  );
}
