'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useWebSocket, ProcessEvent, mockWebSocketService } from '@/lib/websocket';

interface ProcessNode {
  id: number;
  name: string;
  status: 'normal' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  children: ProcessNode[];
  parentId?: number;
  depth: number;
}

export function ProcessTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [processes, setProcesses] = useState<ProcessEvent[]>([]);
  const [treeData, setTreeData] = useState<ProcessNode | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<ProcessNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Initialize the mock WebSocket service
  useEffect(() => {
    mockWebSocketService.start();
    
    return () => {
      mockWebSocketService.stop();
    };
  }, []);
  
  // Subscribe to process events
  useEffect(() => {
    const unsubscribe = mockWebSocketService.subscribe('process_event', (data: ProcessEvent) => {
      setProcesses(prev => {
        // Update existing process or add new one
        const exists = prev.some(p => p.pid === data.pid);
        if (exists) {
          return prev.map(p => p.pid === data.pid ? data : p);
        } else {
          return [...prev, data];
        }
      });
    });
    
    return unsubscribe;
  }, []);
  
  // Convert flat process list to hierarchical tree structure
  const buildProcessTree = useMemo(() => {
    if (!processes.length) return null;
    
    // Generate mock parent-child relationships for demo purposes
    // In a real system, this would come from process parent-child data
    const tree: ProcessNode = {
      id: 1,
      name: 'system.exe',
      status: 'normal',
      cpu: 2.4,
      memory: 124.5,
      children: [],
      depth: 0
    };
    
    // Assign random processes as children
    const assignChildren = (node: ProcessNode, depth: number) => {
      if (depth > 2) return; // Limit depth for demo
      
      const potentialChildren = processes.filter(p => 
        p.name !== node.name && 
        Math.random() > 0.5
      ).slice(0, 3); // Up to 3 random children
      
      node.children = potentialChildren.map(p => ({
        id: p.pid,
        name: p.name,
        status: p.anomalyScore && p.anomalyScore > 0.7 ? 'critical' : 
               p.anomalyScore && p.anomalyScore > 0.4 ? 'warning' : 'normal',
        cpu: p.cpu,
        memory: p.memory,
        children: [],
        parentId: node.id,
        depth: depth
      }));
      
      node.children.forEach(child => assignChildren(child, depth + 1));
    };
    
    assignChildren(tree, 1);
    return tree;
  }, [processes]);
  
  // Update tree data when the process tree changes
  useEffect(() => {
    setTreeData(buildProcessTree);
  }, [buildProcessTree]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          setDimensions({
            width: container.clientWidth,
            height: container.clientHeight
          });
        }
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // D3 visualization rendering
  useEffect(() => {
    if (!svgRef.current || !treeData) return;
    
    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();
    
    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;
    
    // Create a tree layout
    const treeLayout = d3.tree<ProcessNode>()
      .size([height - 100, width - 200])
      .nodeSize([60, 180]);
    
    // Convert data to D3 hierarchy
    const root = d3.hierarchy(treeData);
    const treeData2 = treeLayout(root);
    
    // Create a group for the entire visualization
    const g = svg.append('g')
      .attr('transform', `translate(100, 50)`);
    
    // Add links between nodes
    g.selectAll('.link')
      .data(treeData2.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<ProcessNode>, d3.HierarchyPointNode<ProcessNode>>()
        .x(d => d.y)
        .y(d => d.x)
      )
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);
    
    // Add nodes
    const node = g.selectAll('.node')
      .data(treeData2.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y}, ${d.x})`)
      .on('click', (event, d) => {
        setSelectedProcess(d.data);
      });
    
    // Add node circles
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => 
        d.data.status === 'critical' ? '#ef4444' :
        d.data.status === 'warning' ? '#f59e0b' : 
        '#22c55e'
      )
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // Add node labels
    node.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e4e4e7')
      .text(d => d.data.name.split('.')[0]);
    
    // Add CPU usage indicators
    node.append('text')
      .attr('dy', -25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e4e4e7')
      .attr('font-size', '10px')
      .text(d => `CPU: ${d.data.cpu.toFixed(1)}%`);
    
  }, [treeData, dimensions, selectedProcess]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'critical':
        return <XCircle size={18} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Process Tree Visualization</h2>
        <div className="flex space-x-2">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md">
            Refresh Tree
          </button>
        </div>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Live Process Hierarchy
          </div>
          <div className="h-[calc(100%-40px)] w-full">
            <svg 
              ref={svgRef} 
              width="100%" 
              height="100%" 
              className="overflow-visible"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              preserveAspectRatio="xMidYMid meet"
            ></svg>
          </div>
        </div>

        <div className="w-80 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Process Details
          </div>
          {selectedProcess ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(selectedProcess.status)}
                <div className="font-medium">
                  {selectedProcess.name}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Process ID</div>
                  <div className="font-medium">{selectedProcess.id}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"></path>
                    <path d="M9 22V12h6v10M2 10.6L12 2l10 8.6"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Parent Process</div>
                  <div className="font-medium">{selectedProcess.parentId || 'None (Root)'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Child Processes</div>
                  <div className="font-medium">{selectedProcess.children.length}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Tree Depth</div>
                  <div className="font-medium">{selectedProcess.depth}</div>
                </div>
              </div>
              
              <div className="pt-4">
                <div className="text-sm text-zinc-400 mb-2">CPU Usage</div>
                <div className="relative pt-1">
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-700">
                    <div
                      style={{ width: `${selectedProcess.cpu}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"
                    ></div>
                  </div>
                  <div className="text-xs text-right">{selectedProcess.cpu.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="pt-1">
                <div className="text-sm text-zinc-400 mb-2">Memory Usage</div>
                <div className="relative pt-1">
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-700">
                    <div
                      style={{ width: `${Math.min((selectedProcess.memory / 2000) * 100, 100)}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    ></div>
                  </div>
                  <div className="text-xs text-right">{selectedProcess.memory.toFixed(1)} MB</div>
                </div>
              </div>
              
              <div className="pt-4">
                <div className="text-sm text-zinc-400 mb-2">Status</div>
                <div className={`px-3 py-2 rounded-md font-medium ${
                  selectedProcess.status === 'normal' ? 'bg-green-900 bg-opacity-30 text-green-500' :
                  selectedProcess.status === 'warning' ? 'bg-yellow-900 bg-opacity-30 text-yellow-500' :
                  'bg-red-900 bg-opacity-30 text-red-500'
                }`}>
                  {selectedProcess.status === 'normal' && 'Normal - No threats detected'}
                  {selectedProcess.status === 'warning' && 'Warning - Elevated resource usage'}
                  {selectedProcess.status === 'critical' && 'Critical - Anomalous behavior detected'}
                </div>
              </div>
              
              {selectedProcess.status !== 'normal' && (
                <button
                  className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md"
                >
                  Terminate Process
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="mx-auto mb-4 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
              </svg>
              <p>Select a process in the tree to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
