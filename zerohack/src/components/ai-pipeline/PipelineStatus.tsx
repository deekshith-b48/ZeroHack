'use client';

import React, { useState, useEffect } from 'react';
import { 
  Brain, Cpu, Gauge, Settings, AlertTriangle, CheckCircle, FileText,
  ImageIcon, Network, RefreshCw, BarChart3, Zap, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';

// Note: The local pipeline logic from '@/lib/ai-pipeline' is being replaced by backend calls.
// We keep some interfaces if they are useful for state.
interface DetectionResult {
    threatDetected: boolean;
    threatType: string;
    confidence: number;
    explanation: string;
}

// Configuration for API endpoint
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;

export function PipelineStatus() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DetectionResult | null>(null);
  
  // Sample data for testing
  const [networkInput, setNetworkInput] = useState<string>('');
  
  // Analyze traffic by sending it to the backend pipeline
  const analyzeTraffic = async () => {
    if (!networkInput) {
      alert("Please generate or enter network traffic data first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      // The backend expects a list of events.
      // We will construct a single event from the JSON in the text area.
      const networkData = JSON.parse(networkInput);
      const event = {
        timestamp: new Date().toISOString(),
        ...networkData
      };

      const response = await fetch(ANALYZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [event] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Backend Analysis Result:", result);

      // Map backend response to our local state for display
      const threatDetected = result.final_verdict === 'THREAT';
      setAnalysisResult({
          threatDetected,
          threatType: threatDetected ? result.layer_outputs.find((l: any) => l.rule_id)?.rule_id || 'Aggregated Threat' : 'N/A',
          confidence: result.confidence,
          explanation: result.explanation_summary,
      });

    } catch (error: any) {
      console.error('Backend analysis error:', error);
      alert(`Error analyzing traffic: ${error.message}`);
      setAnalysisResult(null); // Clear previous results on error
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Generate sample data for testing
  const generateSampleData = () => {
    setNetworkInput(JSON.stringify({
      source_ip: "192.168.1.105",
      destination_ip: "104.26.10.12",
      source_port: 51234,
      destination_port: 443,
      protocol: "TCP",
      bytes_sent: 2048,
      bytes_received: 16384,
      duration_ms: 750,
      packets_sent: 25,
      packets_received: 20,
      http_method: "GET",
      http_path: "/api/v1/user_data",
      http_user_agent: "Mozilla/5.0",
      connection_count: 5,
      connection_rate: 1
    }, null, 2));
  };
  
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-lg">
      <div className="bg-zinc-800 p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center">
          <Brain className="text-emerald-500 mr-2" size={24} />
          <div>
            <h2 className="text-xl font-bold">AI Threat Detection Pipeline</h2>
            <p className="text-sm text-zinc-400">Submit network session data for analysis by the backend AI engine.</p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="space-y-4">
            <div>
            <label className="block text-sm mb-2">Network Traffic Data (JSON)</label>
            <textarea
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm h-48 font-mono"
                placeholder="Enter network traffic data in JSON format..."
                value={networkInput}
                onChange={(e) => setNetworkInput(e.target.value)}
            ></textarea>
            </div>
            
            <div className="flex justify-between">
            <button
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                onClick={generateSampleData}
            >
                Generate Sample Data
            </button>
            
            <div className="space-x-3">
                <button
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                onClick={() => setNetworkInput('')}
                >
                Clear
                </button>
                
                <button
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm flex items-center"
                onClick={analyzeTraffic}
                disabled={!networkInput || isAnalyzing}
                >
                {isAnalyzing ? (
                    <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Analyzing...
                    </>
                ) : (
                    <>
                    <Zap size={16} className="mr-2" />
                    Analyze with Backend
                    </>
                )}
                </button>
            </div>
            </div>

            {analysisResult && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-lg border ${
                analysisResult.threatDetected
                ? 'bg-red-900 bg-opacity-20 border-red-900'
                : 'bg-green-900 bg-opacity-20 border-green-900'
            }`}>
                <div className="flex items-center mb-3">
                {analysisResult.threatDetected ? (
                    <AlertTriangle size={20} className="text-red-500 mr-2" />
                ) : (
                    <CheckCircle size={20} className="text-green-500 mr-2" />
                )}
                <h3 className="text-lg font-medium">
                    {analysisResult.threatDetected
                    ? `Threat Detected: ${analysisResult.threatType}`
                    : 'No Threats Detected'}
                </h3>
                <div className="ml-auto bg-zinc-800 px-2 py-1 rounded text-xs">
                    Confidence: {(analysisResult.confidence * 100).toFixed(1)}%
                </div>
                </div>

                <p className="text-sm mb-4">{analysisResult.explanation}</p>
            </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}
