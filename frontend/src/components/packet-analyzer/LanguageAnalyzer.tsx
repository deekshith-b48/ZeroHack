'use client';

import { useState } from 'react';
import { AlertTriangle, BookOpen, Check, CloudCog, Languages } from 'lucide-react';
import { PacketData, AnalysisResult, analyzePayloadLanguage, PacketAIModel } from '@/lib/packet-analyzer';

interface LanguageAnalyzerProps {
  packet: PacketData;
  analysis: AnalysisResult;
  aiModel: PacketAIModel;
}

export function LanguageAnalyzer({ packet, analysis, aiModel }: LanguageAnalyzerProps) {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentModel, setCurrentModel] = useState<PacketAIModel>(aiModel);
  const languages = analysis.detectedLanguages || [];
  
  // Try to decode payload as text
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  let payloadText = '';
  try {
    payloadText = textDecoder.decode(packet.payload.slice(0, 2000)); // Limit to 2000 chars for display
  } catch (error) {
    payloadText = '[Binary data - cannot display as text]';
  }
  
  // Check if payload is likely text or binary
  const isBinaryData = !payloadText || payloadText.replace(/[^\x20-\x7E]/g, '').length < payloadText.length * 0.7;
  
  // Get sentiment icon
  const getSentimentIcon = (sentiment?: string) => {
    if (!sentiment) return null;
    
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return <Check size={16} className="text-green-500" />;
      case 'negative':
        return <AlertTriangle size={16} className="text-red-500" />;
      case 'neutral':
      default:
        return <div className="w-4 h-0.5 bg-blue-500 my-2" />;
    }
  };
  
  // Reanalyze the payload with the selected model
  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      const newLanguages = await analyzePayloadLanguage(packet.payload, currentModel);
      // In a real app, you'd update the global analysis state here
      console.log('Reanalyzed languages:', newLanguages);
    } catch (error) {
      console.error('Error reanalyzing:', error);
    } finally {
      setIsReanalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center">
          <Languages className="mr-2 text-blue-500" size={18} />
          Language Analysis
        </h3>
        
        <div className="flex items-center space-x-2">
          <select 
            className="bg-zinc-700 text-white text-sm rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentModel}
            onChange={(e) => setCurrentModel(e.target.value as PacketAIModel)}
          >
            <option value="azure-gpt-4o">Azure GPT-4o</option>
            <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
            <option value="claude-bedrock">Claude</option>
          </select>
          
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
            onClick={handleReanalyze}
            disabled={isReanalyzing}
          >
            <CloudCog size={14} className="mr-1" />
            {isReanalyzing ? 'Analyzing...' : 'Reanalyze'}
          </button>
        </div>
      </div>
      
      {isBinaryData && languages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-700 rounded-lg p-4 text-center">
          <div className="max-w-md">
            <BookOpen size={48} className="mx-auto mb-4 text-zinc-500 opacity-50" />
            <h4 className="text-lg font-medium mb-2">No Text Content Detected</h4>
            <p className="text-zinc-400 text-sm">
              This packet appears to contain binary data rather than readable text. 
              Language analysis is only applicable to text content.
            </p>
          </div>
        </div>
      ) : languages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-700 rounded-lg p-4 text-center">
          <div className="max-w-md">
            <Languages size={48} className="mx-auto mb-4 text-zinc-500 opacity-50" />
            <h4 className="text-lg font-medium mb-2">No Language Content Detected</h4>
            <p className="text-zinc-400 text-sm">
              The AI model did not detect any significant language content in this packet.
              Try reanalyzing with a different AI model or check if the packet contains text data.
            </p>
            <button
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              onClick={handleReanalyze}
              disabled={isReanalyzing}
            >
              {isReanalyzing ? 'Analyzing...' : 'Analyze Again'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 overflow-auto flex-1">
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">Detected Languages</div>
            <div className="grid grid-cols-2 gap-4">
              {languages.map((lang, index) => (
                <div key={index} className="bg-zinc-800 rounded-md p-3 flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600 bg-opacity-20 flex items-center justify-center mr-3">
                      {getSentimentIcon(lang.sentiment) || <Languages size={16} className="text-blue-500" />}
                    </div>
                    <div>
                      <div className="font-medium">{lang.language}</div>
                      {lang.sentiment && (
                        <div className="text-xs text-zinc-400">Sentiment: {lang.sentiment}</div>
                      )}
                    </div>
                  </div>
                  <div className="bg-zinc-700 px-2 py-1 rounded text-xs">
                    {Math.round(lang.confidence * 100)}% confidence
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {(languages.flatMap(l => l.entities || [])).length > 0 && (
            <div className="bg-zinc-700 rounded-lg p-4">
              <div className="text-sm text-zinc-400 mb-2">Detected Entities</div>
              <div className="space-y-2">
                {languages.flatMap(lang => lang.entities || []).map((entity, index) => (
                  <div key={index} className={`rounded-md p-3 flex justify-between items-center ${
                    entity.sensitivity === 'high' 
                      ? 'bg-red-900 bg-opacity-20 border border-red-900 border-opacity-50' 
                      : 'bg-zinc-800'
                  }`}>
                    <div>
                      <div className="font-medium flex items-center">
                        {entity.sensitivity === 'high' && (
                          <AlertTriangle size={16} className="text-red-500 mr-2" />
                        )}
                        {entity.type}
                      </div>
                      <div className="text-sm text-zinc-400 mt-1">{entity.text}</div>
                    </div>
                    {entity.sensitivity && (
                      <div className="text-xs bg-zinc-900 bg-opacity-50 px-2 py-1 rounded">
                        {entity.sensitivity} sensitivity
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">Packet Text Content</div>
            <div className="font-mono text-xs p-3 bg-zinc-800 rounded max-h-48 overflow-auto whitespace-pre-wrap">
              {payloadText || '[No text content]'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
