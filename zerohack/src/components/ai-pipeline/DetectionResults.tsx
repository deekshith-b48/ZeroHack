'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, BarChart3, Info } from 'lucide-react';
import { DetectionResult, ShapExplanation as ShapExplanationType } from '@/lib/ai-pipeline';
import { ShapExplanation } from './ShapExplanation';

interface DetectionResultsProps {
  result: DetectionResult | null;
  type: 'text' | 'image' | 'network';
}

export function DetectionResults({ result, type }: DetectionResultsProps) {
  const [showShapExplanation, setShowShapExplanation] = useState(false);
  
  if (!result) return null;
  
  const getTypeLabel = () => {
    switch (type) {
      case 'text': return 'Text';
      case 'image': return 'Image';
      case 'network': return 'Network';
    }
  };
  
  const getTypeSpecificLabel = () => {
    switch (type) {
      case 'text': return result.threatDetected ? 'Malicious Code/Content' : 'Clean Text';
      case 'image': return result.threatDetected ? 'Steganography Detected' : 'No Hidden Content';
      case 'network': return result.threatDetected ? 'Network Anomaly' : 'Normal Traffic';
    }
  };
  
  return (
    <>
      <div className={`p-4 rounded-lg border ${
        result.threatDetected 
          ? 'bg-red-900 bg-opacity-20 border-red-900' 
          : 'bg-green-900 bg-opacity-20 border-green-900'
      }`}>
        <div className="flex items-center mb-3">
          {result.threatDetected ? (
            <AlertTriangle size={20} className="text-red-500 mr-2" />
          ) : (
            <CheckCircle size={20} className="text-green-500 mr-2" />
          )}
          <h3 className="text-lg font-medium">
            {result.threatDetected 
              ? `${getTypeLabel()} Threat Detected: ${result.threatType}` 
              : `${getTypeSpecificLabel()}`}
          </h3>
          <div className="ml-auto bg-zinc-800 px-2 py-1 rounded text-xs">
            Confidence: {(result.confidence * 100).toFixed(1)}%
          </div>
        </div>
        
        <p className="text-sm mb-4">{result.explanation}</p>
        
        {result.shapValues && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium flex items-center">
                <BarChart3 size={16} className="mr-2" />
                SHAP Feature Importance
              </h4>
              <button 
                className="text-xs text-emerald-500 hover:underline"
                onClick={() => setShowShapExplanation(true)}
              >
                View Full Explanation
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Show only top 3 features in the summary */}
              {result.shapValues.features.slice(0, 3).map((feature, idx) => (
                <div key={idx} className="bg-zinc-800 p-2 rounded">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{feature.name}</span>
                    <span>{feature.value.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-zinc-700 h-2 rounded-full">
                    <div 
                      className={`h-2 rounded-full ${feature.importance > 0.5 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${feature.importance * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              
              {result.shapValues.features.length > 3 && (
                <div className="text-xs text-center text-zinc-400 mt-1">
                  + {result.shapValues.features.length - 3} more features
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t border-zinc-700 flex items-center text-xs text-zinc-400">
          <Info size={14} className="mr-2" />
          <span>
            Analysis performed using {getTypeLabel()} analysis pipeline with ONNX acceleration
          </span>
        </div>
      </div>
      
      {/* SHAP Explanation Modal */}
      {result.shapValues && (
        <ShapExplanation
          shapValues={result.shapValues}
          isOpen={showShapExplanation}
          onClose={() => setShowShapExplanation(false)}
          threatType={result.threatType || getTypeSpecificLabel()}
          confidence={result.confidence}
        />
      )}
    </>
  );
}
