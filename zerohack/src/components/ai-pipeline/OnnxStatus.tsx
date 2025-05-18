'use client';

import React from 'react';
import { Cpu, Gauge, Zap } from 'lucide-react';

interface OnnxStatusProps {
  isAccelerated: boolean;
  metrics: {
    cpuUsage?: number;
    gpuUsage?: number;
    memoryUsage?: number;
    inferenceTime?: number;
    throughput?: number;
  };
}

export function OnnxStatus({ isAccelerated, metrics }: OnnxStatusProps) {
  return (
    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center">
          <Cpu className="mr-2 text-emerald-500" size={18} />
          ONNX Runtime Status
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs ${
          isAccelerated 
            ? 'bg-emerald-900 bg-opacity-30 text-emerald-500' 
            : 'bg-zinc-700 text-zinc-400'
        }`}>
          {isAccelerated ? 'GPU Accelerated' : 'CPU Mode'}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-zinc-400 mb-1">Inference Time</div>
          <div className="text-lg font-bold">{metrics.inferenceTime || 0}ms</div>
          <div className="w-full bg-zinc-700 h-1.5 rounded-full mt-1">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, ((metrics.inferenceTime || 100) / 200) * 100)}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="text-xs text-zinc-400 mb-1">Throughput</div>
          <div className="text-lg font-bold">{metrics.throughput || 0} items/s</div>
          <div className="w-full bg-zinc-700 h-1.5 rounded-full mt-1">
            <div 
              className="bg-blue-500 h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, ((metrics.throughput || 0) / 1000) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <div className="text-xs text-zinc-400 mb-1">
            {isAccelerated ? 'GPU Usage' : 'CPU Usage'}
          </div>
          <div className="text-lg font-bold">
            {isAccelerated ? (metrics.gpuUsage || 0) : (metrics.cpuUsage || 0)}%
          </div>
          <div className="w-full bg-zinc-700 h-1.5 rounded-full mt-1">
            <div 
              className={`${isAccelerated ? 'bg-purple-500' : 'bg-yellow-500'} h-1.5 rounded-full`}
              style={{ width: `${isAccelerated ? (metrics.gpuUsage || 0) : (metrics.cpuUsage || 0)}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="text-xs text-zinc-400 mb-1">Memory Usage</div>
          <div className="text-lg font-bold">{metrics.memoryUsage || 0} MB</div>
          <div className="w-full bg-zinc-700 h-1.5 rounded-full mt-1">
            <div 
              className="bg-red-500 h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, ((metrics.memoryUsage || 0) / 2000) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-zinc-700 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center">
          <Zap size={14} className="mr-1 text-emerald-500" />
          <span>
            {isAccelerated ? 'CUDA Enabled' : 'CPU Fallback'}
          </span>
        </div>
        <div className="flex items-center">
          <Gauge size={14} className="mr-1 text-emerald-500" />
          <span>
            Batch Size: {isAccelerated ? '64' : '16'}
          </span>
        </div>
      </div>
    </div>
  );
}
