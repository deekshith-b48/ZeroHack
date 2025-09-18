'use client';

import React from 'react';
import { PipelineStatus } from '@/components/ai-pipeline/PipelineStatus';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AIPipelinePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Threat Detection Pipeline</h1>
            <p className="text-zinc-400 text-sm mt-1">Multi-stage detection with CodeBERT, CNN, and LSTM-autoencoder models</p>
          </div>
          <Link 
            href="/"
            className="flex items-center justify-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
        
        <PipelineStatus />
        
        <div className="mt-8 bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-medium mb-4">About the AI Threat Detection Pipeline</h2>
          
          <div className="space-y-4 text-zinc-300">
            <p>
              This multi-stage AI threat detection pipeline combines three specialized models to detect various types of security threats:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-zinc-800 p-4 rounded-lg">
                <h3 className="font-medium text-emerald-500 mb-2">CodeBERT Text Analysis</h3>
                <p className="text-sm text-zinc-400">
                  Analyzes code and text content to detect malicious scripts, SQL injection attempts, XSS attacks, and other text-based threats using a fine-tuned CodeBERT model.
                </p>
              </div>
              
              <div className="bg-zinc-800 p-4 rounded-lg">
                <h3 className="font-medium text-emerald-500 mb-2">CNN Image Steganography</h3>
                <p className="text-sm text-zinc-400">
                  Uses convolutional neural networks to detect hidden data in images, including LSB steganography, unusual pixel patterns, and other image-based data hiding techniques.
                </p>
              </div>
              
              <div className="bg-zinc-800 p-4 rounded-lg">
                <h3 className="font-medium text-emerald-500 mb-2">LSTM Network Analysis</h3>
                <p className="text-sm text-zinc-400">
                  Employs LSTM-autoencoder architecture to detect anomalies in network traffic patterns, identifying potential DDoS attacks, data exfiltration, and command & control communications.
                </p>
              </div>
            </div>
            
            <div className="bg-zinc-800 p-4 rounded-lg mt-6">
              <h3 className="font-medium text-emerald-500 mb-2">ONNX Runtime Acceleration</h3>
              <p className="text-sm text-zinc-400">
                All models are optimized with ONNX Runtime for GPU acceleration, providing high-performance inference with minimal latency. The pipeline can process multiple data types simultaneously and provides detailed SHAP explanations for all detections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
