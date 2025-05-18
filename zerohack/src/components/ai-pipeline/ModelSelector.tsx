'use client';

import React from 'react';
import { Brain, FileText, Image as ImageIcon, Network } from 'lucide-react';
import { AIModel } from '@/lib/ai-pipeline';

interface ModelSelectorProps {
  textModel: AIModel;
  imageModel: AIModel;
  networkModel: AIModel;
  onTextModelChange: (model: AIModel) => void;
  onImageModelChange: (model: AIModel) => void;
  onNetworkModelChange: (model: AIModel) => void;
}

export function ModelSelector({
  textModel,
  imageModel,
  networkModel,
  onTextModelChange,
  onImageModelChange,
  onNetworkModelChange
}: ModelSelectorProps) {
  // Helper function to get model display name
  const getModelDisplayName = (model: AIModel): string => {
    switch (model) {
      case 'azure-gpt-4o': return 'Azure GPT-4o';
      case 'azure-gpt-4o-mini': return 'Azure GPT-4o Mini';
      case 'azure-gpt-4o-o1': return 'Azure GPT-4o O1';
      case 'gemini-1.5-pro': return 'Gemini 1.5 Pro';
      case 'gemini-2.0-flash-exp': return 'Gemini 2.0 Flash';
      case 'claude-bedrock': return 'Claude';
      case 'deepseek-r1': return 'Deepseek R1';
      case 'deepseek-v3': return 'Deepseek V3';
      default: return model;
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 bg-opacity-20 flex items-center justify-center mr-3">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium">Text Analysis</h3>
            <p className="text-xs text-zinc-400">CodeBERT</p>
          </div>
        </div>
        
        <div className="mt-3">
          <label className="block text-xs text-zinc-400 mb-1">Model</label>
          <select 
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
            value={textModel}
            onChange={(e) => onTextModelChange(e.target.value as AIModel)}
          >
            <option value="azure-gpt-4o">Azure GPT-4o</option>
            <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
            <option value="claude-bedrock">Claude</option>
            <option value="deepseek-r1">Deepseek R1</option>
            <option value="deepseek-v3">Deepseek V3</option>
            <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
          </select>
        </div>
        
        <div className="mt-3 text-xs text-zinc-400">
          <div className="flex justify-between mb-1">
            <span>Current Model:</span>
            <span className="text-emerald-500">{getModelDisplayName(textModel)}</span>
          </div>
          <div className="flex justify-between">
            <span>Optimized for:</span>
            <span>Code & Script Analysis</span>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-600 bg-opacity-20 flex items-center justify-center mr-3">
            <ImageIcon size={16} className="text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium">Image Analysis</h3>
            <p className="text-xs text-zinc-400">CNN Steganography</p>
          </div>
        </div>
        
        <div className="mt-3">
          <label className="block text-xs text-zinc-400 mb-1">Model</label>
          <select 
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
            value={imageModel}
            onChange={(e) => onImageModelChange(e.target.value as AIModel)}
          >
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
            <option value="claude-bedrock">Claude</option>
            <option value="azure-gpt-4o">Azure GPT-4o</option>
            <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
          </select>
        </div>
        
        <div className="mt-3 text-xs text-zinc-400">
          <div className="flex justify-between mb-1">
            <span>Current Model:</span>
            <span className="text-emerald-500">{getModelDisplayName(imageModel)}</span>
          </div>
          <div className="flex justify-between">
            <span>Optimized for:</span>
            <span>Hidden Data Detection</span>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full bg-yellow-600 bg-opacity-20 flex items-center justify-center mr-3">
            <Network size={16} className="text-yellow-400" />
          </div>
          <div>
            <h3 className="font-medium">Network Analysis</h3>
            <p className="text-xs text-zinc-400">LSTM-Autoencoder</p>
          </div>
        </div>
        
        <div className="mt-3">
          <label className="block text-xs text-zinc-400 mb-1">Model</label>
          <select 
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
            value={networkModel}
            onChange={(e) => onNetworkModelChange(e.target.value as AIModel)}
          >
            <option value="azure-gpt-4o">Azure GPT-4o</option>
            <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
            <option value="claude-bedrock">Claude</option>
            <option value="deepseek-r1">Deepseek R1</option>
            <option value="deepseek-v3">Deepseek V3</option>
            <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
          </select>
        </div>
        
        <div className="mt-3 text-xs text-zinc-400">
          <div className="flex justify-between mb-1">
            <span>Current Model:</span>
            <span className="text-emerald-500">{getModelDisplayName(networkModel)}</span>
          </div>
          <div className="flex justify-between">
            <span>Optimized for:</span>
            <span>Traffic Anomaly Detection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
