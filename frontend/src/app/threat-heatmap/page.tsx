'use client';

import React from 'react';
import { ThreatHeatmap } from '@/components/dashboard/ThreatHeatmap';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ThreatHeatmapPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Interactive Threat Heatmap</h1>
            <p className="text-zinc-400 text-sm mt-1">Visualize and analyze security threats across your network</p>
          </div>
          <Link 
            href="/"
            className="flex items-center justify-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
        
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 shadow-lg">
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Threat Density Analysis</h2>
            <p className="text-zinc-400 text-sm">
              This heatmap visualizes the concentration and severity of security threats across your network infrastructure. 
              Darker red areas indicate higher threat density or severity. Use the controls to zoom, pan, and explore specific areas.
            </p>
          </div>
          
          <div className="flex justify-center">
            <ThreatHeatmap 
              width={1000} 
              height={600} 
              className="border border-zinc-800 rounded-lg shadow-lg"
            />
          </div>
          
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-zinc-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">How to Use</h3>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• Click and drag to pan the heatmap</li>
                <li>• Use the zoom controls to zoom in/out</li>
                <li>• Hover over points to see threat details</li>
                <li>• Use the reset button to return to the original view</li>
              </ul>
            </div>
            
            <div className="bg-zinc-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Threat Categories</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                  <span>Intrusion Attempts</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                  <span>Data Exfiltration</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                  <span>Malware</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                  <span>DDoS</span>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Statistics</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Threats:</span>
                  <span>200</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Critical Threats:</span>
                  <span className="text-red-500">42</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Medium Threats:</span>
                  <span className="text-yellow-500">87</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Low Threats:</span>
                  <span className="text-blue-500">71</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
