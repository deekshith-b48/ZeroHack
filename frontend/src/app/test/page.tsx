'use client';

import { useState } from 'react';
import { EDRStatus } from '@/components/dashboard/EDRStatus';
import { ProcessMonitor } from '@/components/dashboard/ProcessMonitor';
import { ThreatTriage } from '@/components/dashboard/ThreatTriage';
import { AIDetection } from '@/components/dashboard/AIDetection';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function TestPage() {
  const [activeComponent, setActiveComponent] = useState('dashboard');

  const components = {
    dashboard: <EDRStatus />,
    process: <ProcessMonitor />,
    threat: <ThreatTriage />,
    ai: <AIDetection />
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-2xl font-bold mb-4">ZeroHack Component Test</h1>
          <div className="flex gap-2">
            {Object.keys(components).map((key) => (
              <button
                key={key}
                onClick={() => setActiveComponent(key)}
                className={`px-4 py-2 rounded ${
                  activeComponent === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {components[activeComponent as keyof typeof components]}
        </div>
      </div>
    </ErrorBoundary>
  );
}
