'use client';

import React from 'react';
import { BarChart3, Info, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShapExplanation as ShapExplanationType } from '@/lib/ai-pipeline';

interface ShapExplanationProps {
  shapValues: ShapExplanationType;
  isOpen: boolean;
  onClose: () => void;
  threatType?: string;
  confidence?: number;
}

export function ShapExplanation({ 
  shapValues, 
  isOpen, 
  onClose,
  threatType = 'Unknown',
  confidence = 0.5
}: ShapExplanationProps) {
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium flex items-center">
              <BarChart3 size={20} className="mr-2 text-emerald-500" />
              SHAP Feature Explanation
            </h3>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-zinc-700 rounded-full"
            >
              <XCircle size={20} />
            </button>
          </div>
          
          <div className="mb-4">
            <div className="text-sm text-zinc-400 mb-2">Threat Detection Model</div>
            <div className="text-sm">
              This visualization shows how each feature contributed to the model's decision to classify this event as {threatType.toLowerCase()}.
              Positive values (red) push the prediction higher, while negative values (blue) reduce the threat score.
            </div>
          </div>
          
          <div className="space-y-4">
            {shapValues.features.map((feature, idx) => (
              <div key={idx} className="bg-zinc-700 p-4 rounded">
                <div className="flex justify-between mb-2">
                  <div className="font-medium">{feature.name}</div>
                  <div className="font-mono">Value: {feature.value.toFixed(2)}</div>
                </div>
                
                <div className="relative h-6 mb-3">
                  {/* Base value marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-zinc-400"
                    style={{ left: '50%' }}
                  ></div>
                  
                  {/* Feature impact bar */}
                  <div 
                    className={`absolute h-6 ${feature.importance > 0.2 ? 'bg-red-600 bg-opacity-40' : 'bg-blue-600 bg-opacity-40'} rounded`}
                    style={{ 
                      left: feature.importance > 0.2 ? '50%' : `${50 - (feature.importance * 100)}%`,
                      width: `${feature.importance * 100}%`,
                      maxWidth: '50%'
                    }}
                  ></div>
                  
                  {/* Impact value */}
                  <div 
                    className={`absolute top-1 ${feature.importance > 0.2 ? 'right-0 pr-2' : 'left-0 pl-2'}`}
                    style={{ [feature.importance > 0.2 ? 'right' : 'left']: `${50 + (feature.importance * 100)}%` }}
                  >
                    <span className={`text-xs ${feature.importance > 0.2 ? 'text-red-400' : 'text-blue-400'}`}>
                      {feature.importance > 0.2 ? '+' : ''}{(feature.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-zinc-400">
                  {feature.importance > 0.2
                    ? `This feature strongly indicates malicious behavior. The value ${feature.value.toFixed(2)} is significantly above normal thresholds.`
                    : `This feature shows typical behavior patterns. The value ${feature.value.toFixed(2)} is within normal ranges.`
                  }
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-zinc-700">
            <div className="text-sm font-medium mb-2">Model Confidence</div>
            <div className="bg-zinc-700 h-4 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${confidence * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>0%</span>
              <span className="font-medium">{(confidence * 100).toFixed(1)}%</span>
              <span>100%</span>
            </div>
          </div>
          
          <div className="mt-6 bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <div className="flex items-start">
              <Info size={16} className="text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-xs text-zinc-400">
                <p className="mb-2">
                  <strong>About SHAP (SHapley Additive exPlanations):</strong> SHAP values help explain the output of machine learning models by attributing each feature's contribution to the prediction.
                </p>
                <p>
                  The values show how much each feature pushed the model's prediction higher or lower from the base value. This helps understand why the model made a specific decision and which features were most influential.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
