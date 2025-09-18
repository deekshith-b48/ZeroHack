'use client';

import { useState } from 'react';
import { AlertTriangle, Code, FileCode, CheckCircle } from 'lucide-react';
import { PacketData, AnalysisResult } from '@/lib/packet-analyzer';
import { motion } from 'framer-motion';

interface ProtocolAnalyzerProps {
  packet: PacketData;
  analysis: AnalysisResult;
}

export function ProtocolAnalyzer({ packet, analysis }: ProtocolAnalyzerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  const protocolData = analysis.protocolAnalysis;
  const anomalies = protocolData?.anomalies || [];

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // If no protocol data is available
  if (!protocolData) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Code size={48} className="mb-4 text-zinc-500" />
        <h4 className="text-lg font-medium mb-2">No Protocol Analysis Available</h4>
        <p className="text-zinc-400 text-sm text-center max-w-md">
          Protocol analysis could not be performed on this packet.
          This may be due to an unknown protocol or insufficient data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-auto">
      {/* Protocol summary */}
      <div className="bg-zinc-700 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-zinc-600 flex items-center justify-center mr-3">
              <FileCode size={24} className="text-emerald-500" />
            </div>
            <div>
              <div className="font-medium text-lg">{protocolData.protocolName}</div>
              <div className="text-sm text-zinc-400">
                {protocolData.version ? `Version ${protocolData.version}` : 'Protocol Analysis'}
              </div>
            </div>
          </div>
          
          <div>
            {protocolData.isValid ? (
              <span className="flex items-center bg-green-600 bg-opacity-20 text-green-500 px-3 py-1 rounded-full text-sm">
                <CheckCircle size={14} className="mr-1" />
                Valid Format
              </span>
            ) : (
              <span className="flex items-center bg-red-600 bg-opacity-20 text-red-500 px-3 py-1 rounded-full text-sm">
                <AlertTriangle size={14} className="mr-1" />
                Invalid Format
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Anomalies detected */}
      {anomalies.length > 0 && (
        <div className="bg-red-900 bg-opacity-20 border border-red-900 border-opacity-30 rounded-lg p-4">
          <div className="text-sm font-medium flex items-center mb-2 text-red-500">
            <AlertTriangle size={16} className="mr-2" />
            Detected Anomalies
          </div>
          <ul className="space-y-1 ml-6 list-disc text-sm">
            {anomalies.map((anomaly, index) => (
              <motion.li 
                key={index} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-zinc-300"
              >
                {anomaly}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Protocol specific data */}
      <div className="bg-zinc-700 rounded-lg overflow-hidden">
        <button 
          className="w-full px-4 py-3 flex justify-between items-center hover:bg-zinc-600"
          onClick={() => toggleSection('structure')}
        >
          <div className="font-medium">Protocol Structure</div>
          <div className={`transform transition-transform ${expandedSection === 'structure' ? 'rotate-90' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </button>
        
        {expandedSection === 'structure' && (
          <motion.div 
            className="p-4 bg-zinc-800 border-t border-zinc-700"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="overflow-auto max-h-96">
              {/* Render protocol-specific fields based on protocolName */}
              {protocolData.protocolName === 'HTTP' && (
                <div className="space-y-3">
                  {/* HTTP Method and Path */}
                  {protocolData.structuralAnalysis.method && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">HTTP Request</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-sm">
                        {protocolData.structuralAnalysis.method} {protocolData.structuralAnalysis.path} HTTP/{protocolData.version}
                      </div>
                    </div>
                  )}
                  
                  {/* HTTP Status */}
                  {protocolData.structuralAnalysis.statusCode && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">HTTP Response</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-sm">
                        HTTP/{protocolData.version} {protocolData.structuralAnalysis.statusCode}
                      </div>
                    </div>
                  )}
                  
                  {/* HTTP Headers */}
                  {protocolData.structuralAnalysis.headers && Object.keys(protocolData.structuralAnalysis.headers).length > 0 && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Headers</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-xs space-y-1">
                        {Object.entries(protocolData.structuralAnalysis.headers).map(([key, value], idx) => (
                          <div key={idx}>
                            <span className="text-blue-400">{key}</span>: {value as string}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {protocolData.protocolName === 'DNS' && (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-zinc-400 mb-1">Transaction ID</div>
                    <div className="font-medium font-mono">
                      {protocolData.structuralAnalysis.id}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-zinc-400 mb-1">Type</div>
                    <div className="font-medium">
                      {protocolData.structuralAnalysis.isResponse ? 'Response' : 'Query'}
                    </div>
                  </div>
                  
                  {protocolData.structuralAnalysis.query && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Query</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-sm">
                        {protocolData.structuralAnalysis.query}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Questions</div>
                      <div className="font-medium">
                        {protocolData.structuralAnalysis.questionCount}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Answers</div>
                      <div className="font-medium">
                        {protocolData.structuralAnalysis.answerCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {protocolData.protocolName === 'SMTP' && (
                <div className="space-y-3">
                  {protocolData.structuralAnalysis.isResponse ? (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Response Code</div>
                      <div className="font-medium font-mono">
                        {protocolData.structuralAnalysis.responseCode}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Command</div>
                      <div className="font-medium font-mono">
                        {protocolData.structuralAnalysis.command}
                      </div>
                    </div>
                  )}
                  
                  {protocolData.structuralAnalysis.parameter && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Parameter</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-sm">
                        {protocolData.structuralAnalysis.parameter}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-sm text-zinc-400 mb-1">Content Preview</div>
                    <div className="bg-zinc-700 rounded-md p-2 font-mono text-xs max-h-32 overflow-auto">
                      {protocolData.structuralAnalysis.fullText}
                    </div>
                  </div>
                </div>
              )}
              
              {protocolData.protocolName === 'FTP' && (
                <div className="space-y-3">
                  {protocolData.structuralAnalysis.isResponse ? (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Response Code</div>
                      <div className="font-medium font-mono">
                        {protocolData.structuralAnalysis.responseCode}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Command</div>
                      <div className="font-medium font-mono">
                        {protocolData.structuralAnalysis.command}
                      </div>
                    </div>
                  )}
                  
                  {protocolData.structuralAnalysis.parameter && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Parameter</div>
                      <div className="bg-zinc-700 rounded-md p-2 font-mono text-sm">
                        {protocolData.structuralAnalysis.parameter}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Default case for other protocols */}
              {!['HTTP', 'DNS', 'SMTP', 'FTP'].includes(protocolData.protocolName) && (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400 mb-1">Raw Structure</div>
                  <pre className="bg-zinc-700 rounded-md p-3 text-xs overflow-auto max-h-96">
                    {JSON.stringify(protocolData.structuralAnalysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Raw packet analysis */}
      <div className="bg-zinc-700 rounded-lg overflow-hidden">
        <button 
          className="w-full px-4 py-3 flex justify-between items-center hover:bg-zinc-600"
          onClick={() => toggleSection('raw')}
        >
          <div className="font-medium">Raw Packet Data</div>
          <div className={`transform transition-transform ${expandedSection === 'raw' ? 'rotate-90' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </button>
        
        {expandedSection === 'raw' && (
          <motion.div 
            className="p-4 bg-zinc-800 border-t border-zinc-700"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="text-xs font-mono bg-zinc-900 p-3 rounded-md overflow-auto max-h-72">
              {/* Hex view */}
              <div className="mb-4">
                <div className="text-zinc-400 mb-1">Hex View</div>
                {Array.from(packet.payload.slice(0, 256)).reduce((rows: string[], _, i) => {
                  if (i % 16 === 0) {
                    const hexRow = Array.from(packet.payload.slice(i, i + 16))
                      .map(byte => byte.toString(16).padStart(2, '0'))
                      .join(' ');
                      
                    const asciiRow = Array.from(packet.payload.slice(i, i + 16))
                      .map(byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
                      .join('');
                      
                    rows.push(`${i.toString(16).padStart(8, '0')}: ${hexRow.padEnd(48, ' ')} | ${asciiRow}`);
                  }
                  return rows;
                }, []).join('\n')}
                {packet.payload.length > 256 ? '\n[...truncated...]' : ''}
              </div>
              
              {/* ASCII view */}
              <div>
                <div className="text-zinc-400 mb-1">ASCII View</div>
                <div className="whitespace-pre-wrap">
                  {(() => {
                    try {
                      const textDecoder = new TextDecoder('utf-8', { fatal: false });
                      const text = textDecoder.decode(packet.payload.slice(0, 1024));
                      return text.replace(/[^\x20-\x7E\r\n\t]/g, '.');
                    } catch (e) {
                      return '[Binary data - cannot display as text]';
                    }
                  })()}
                  {packet.payload.length > 1024 ? '\n[...truncated...]' : ''}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
