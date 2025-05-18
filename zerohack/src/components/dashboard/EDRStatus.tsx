'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Shield, Brain, Database, AlertTriangle, CheckCircle, BarChart2, Cpu, Zap, Clock, LineChart } from 'lucide-react';
import { SystemStatus, mockWebSocketService } from '@/lib/websocket';
import { motion } from 'framer-motion';
import * as d3 from 'd3';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  positive?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon, change, positive }) => {
  return (
    <div className="bg-zinc-800 p-4 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-zinc-400 text-sm mb-1">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
          {change && (
            <div className={`text-xs mt-1 ${positive ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {positive ? <span className="mr-1">↑</span> : <span className="mr-1">↓</span>}
              {change}
            </div>
          )}
        </div>
        <div className="bg-zinc-700 p-2 rounded-lg text-emerald-500">
          {icon}
        </div>
      </div>
    </div>
  );
};

export function EDRStatus() {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<SystemStatus>({
    processesMonitored: 0,
    threatsDetected: 0,
    filesScanned: 0,
    quarantinedItems: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    isLearningMode: false,
    lastUpdateTimestamp: new Date().toISOString()
  });
  
  const [mlPerformance, setMlPerformance] = useState({
    modelAccuracy: 98.7,
    falsePositiveRate: 0.08,
    falseNegativeRate: 0.12,
    inferenceTime: 32,
    averageThroughput: 768,
    gpuUtilization: 62,
    activeModels: ['XGBoost', 'LSTM', 'YARA'],
  });
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  // Initialize mock WebSocket
  // Charts data state
  const [activityData, setActivityData] = useState<{time: Date, value: number, type: string}[]>([]);
  const [threatDistributionData, setThreatDistributionData] = useState<{name: string, value: number, color: string}[]>([
    { name: "Malware", value: 45, color: "#ef4444" },
    { name: "Suspicious", value: 30, color: "#f59e0b" },
    { name: "Network", value: 15, color: "#3b82f6" },
    { name: "Other", value: 10, color: "#10b981" }
  ]);

  useEffect(() => {
    mockWebSocketService.start();
    
    // Generate initial activity data
    const initialData: {time: Date, value: number, type: string}[] = [];
    const now = new Date();
    
    // Generate CPU data points for last 24 hours
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now);
      time.setHours(now.getHours() - i);
      
      // CPU usage - follows a pattern with random variation
      const baseValue = 30 + 20 * Math.sin(i / 3.82) + Math.random() * 10;
      initialData.push({
        time,
        value: baseValue,
        type: 'cpu'
      });
      
      // Memory usage - slowly increasing with random variation
      const memValue = 40 + i * 0.8 + Math.random() * 8;
      initialData.push({
        time,
        value: memValue > 80 ? 80 - Math.random() * 5 : memValue, 
        type: 'memory'
      });
      
      // Network activity - spiky with random bursts
      const netBase = 20 + Math.random() * 15;
      const netSpike = i % 4 === 0 ? 40 + Math.random() * 30 : 0;
      initialData.push({
        time,
        value: netBase + netSpike,
        type: 'network' 
      });
    }
    
    setActivityData(initialData);
    
    return () => {
      // Cleanup is handled by the parent component
    };
  }, []);

  // Subscribe to system status updates
  useEffect(() => {
    const unsubscribe = mockWebSocketService.subscribe('system_status', (newStatus: SystemStatus) => {
      setStatus(newStatus);
      setLastUpdated(new Date());
      
      // Determine system health based on metrics
      if (newStatus.threatsDetected > 3 || newStatus.cpuUsage > 90) {
        setSystemHealth('critical');
      } else if (newStatus.threatsDetected > 0 || newStatus.cpuUsage > 70) {
        setSystemHealth('warning');
      } else {
        setSystemHealth('healthy');
      }
      
      // Update activity data with new values
      setActivityData(prevData => {
        // Create a new data point for each metric
        const now = new Date();
        const newDataPoints = [
          { time: now, value: newStatus.cpuUsage, type: 'cpu' },
          { time: now, value: newStatus.memoryUsage, type: 'memory' },
          { time: now, value: 20 + Math.random() * 50, type: 'network' } // Network is simulated
        ];
        
        // Keep last 24 data points for each type (24 hours)
        const filtered = prevData.filter(d => {
          const hoursDiff = (now.getTime() - d.time.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24;
        });
        
        return [...filtered, ...newDataPoints];
      });
    });
    
    return unsubscribe;
  }, []);
  
  // Initialize and update D3 charts
  useEffect(() => {
    if (activityData.length === 0) return;
    
    // Activity Chart
    const activityChartResizeHandler = createActivityChart();
    
    // Threat Distribution Chart
    const donutChartResizeHandler = createDonutChart();
    
    // Safely handle window resize events
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', activityChartResizeHandler);
      window.addEventListener('resize', donutChartResizeHandler);
      
      // Cleanup
      return () => {
        window.removeEventListener('resize', activityChartResizeHandler);
        window.removeEventListener('resize', donutChartResizeHandler);
      };
    }
  }, [activityData, status.threatsDetected]);
  
  // Create the activity chart using D3.js
  const createActivityChart = () => {
    // Clear any existing chart
    d3.select('#activity-chart').selectAll('*').remove();
    
    // Use safer method to get dimensions, avoiding direct document access
    const chartContainer = d3.select('#activity-chart').node() as HTMLElement;
    const containerWidth = chartContainer?.clientWidth || 500;
    const containerHeight = chartContainer?.clientHeight || 200;
    
    const margin = { top: 10, right: 30, bottom: 20, left: 40 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    
    // Filter data by type to create separate lines
    const cpuData = activityData.filter(d => d.type === 'cpu');
    const memoryData = activityData.filter(d => d.type === 'memory');
    const networkData = activityData.filter(d => d.type === 'network');
    
    // Create SVG
    const svg = d3.select('#activity-chart')
      .append('svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .attr('aria-label', 'Line chart showing system metrics over time')
        .attr('role', 'img')
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // X axis - time scale
    const x = d3.scaleTime()
      .domain(d3.extent(activityData, d => d.time) as [Date, Date])
      .range([0, width]);
    
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => {
        const date = d as Date;
        return date.getHours() + ':00';
      }))
      .selectAll('text')
        .style('fill', '#9ca3af')
        .style('font-size', '10px');
    
    svg.selectAll('.domain, .tick line').style('stroke', '#4b5563');
    
    // Y axis - percentage scale
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);
    
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
        .style('fill', '#9ca3af')
        .style('font-size', '10px');
    
    svg.selectAll('.domain, .tick line').style('stroke', '#4b5563');
    
    // Create a tooltip
    const tooltip = d3.select(tooltipRef.current!);
    
    // Define line generators
    const createLine = (data: typeof cpuData, color: string, name: string) => {
      // Create the line
      const line = d3.line<{time: Date, value: number, type: string}>()
        .x(d => x(d.time))
        .y(d => y(d.value))
        .curve(d3.curveCardinal);
      
      // Create line path with animation
      const path = svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line);
      
      // Animate the line drawing
      const pathLength = path.node()?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', pathLength)
        .attr('stroke-dashoffset', pathLength)
        .transition()
        .duration(1500)
        .attr('stroke-dashoffset', 0);
      
      // Add data points
      const points = svg.selectAll(`.point-${name}`)
        .data(data)
        .enter()
        .append('circle')
        .attr('class', `point-${name}`)
        .attr('cx', d => x(d.time))
        .attr('cy', d => y(d.value))
        .attr('r', 3)
        .attr('fill', color)
        .attr('opacity', 0);
        
      // First apply the transition
      points.transition()
        .delay((_, i) => i * 50)
        .attr('opacity', 1);
        
      // Then add event handlers directly to the elements (not to the transition)
      points.on('mouseover', function(event: MouseEvent, d: {time: Date, value: number, type: string}) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 5);
        
        tooltip.style('opacity', 1)
          .html(`
            <div class="font-medium">${name}</div>
            <div class="text-sm">${d.value.toFixed(1)}%</div>
            <div class="text-xs text-zinc-400">${d.time.toLocaleTimeString()}</div>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 3);
        
        tooltip.transition()
          .duration(200)
          .style('opacity', 0);
      });
    };
    
    // Create the three lines
    createLine(cpuData, '#ef4444', 'CPU');
    createLine(memoryData, '#3b82f6', 'Memory');
    createLine(networkData, '#10b981', 'Network');
    
    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 100}, 10)`);
    
    const legendItems = [
      { color: '#ef4444', label: 'CPU' },
      { color: '#3b82f6', label: 'Memory' },
      { color: '#10b981', label: 'Network' }
    ];
    
    legendItems.forEach((item, i) => {
      legend.append('circle')
        .attr('cx', 0)
        .attr('cy', i * 20)
        .attr('r', 5)
        .attr('fill', item.color);
      
      legend.append('text')
        .attr('x', 10)
        .attr('y', i * 20 + 4)
        .text(item.label)
        .style('font-size', '10px')
        .style('fill', '#d1d5db');
    });
    
    // Handle window resize
    // Handle resize within useEffect in the parent component
    const handleResize = () => {
      // Simply recreate the chart when resizes
      createActivityChart();
    };
    
    // We'll handle resize events in the parent useEffect
    return handleResize;
  };
  
  // Create donut chart for threat distribution
  const createDonutChart = () => {
    // Clear existing chart
    d3.select('#donut-chart').selectAll('*').remove();
    
    // Use safer method to get dimensions, avoiding direct document access
    const chartContainer = d3.select('#donut-chart').node() as HTMLElement;
    const containerWidth = chartContainer?.clientWidth || 300;
    const containerHeight = chartContainer?.clientHeight || 200;
    
    const margin = 40;
    const width = containerWidth;
    const height = containerHeight;
    
    // Create SVG
    const svg = d3.select('#donut-chart')
      .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('aria-label', 'Donut chart showing threat distribution')
        .attr('role', 'img')
      .append('g')
        .attr('transform', `translate(${width / 3},${height / 2})`);
    
    // Create the pie layout
    const pie = d3.pie<any>()
      .value(d => d.value)
      .sort(null);
    
    // Create arc generator
    const arc = d3.arc<any>()
      .innerRadius(50)
      .outerRadius(80);
    
    // Create the arcs
    const arcs = svg.selectAll('.arc')
      .data(pie(threatDistributionData))
      .enter()
      .append('g')
      .attr('class', 'arc');
    
    // Add the arc paths with animations
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#18181b')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .attr('aria-label', d => `${d.data.name}: ${d.data.value}%`)
      .transition()
      .duration(1000)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
        return function(t) {
          return arc(interpolate(t));
        };
      });
    
    // Add center text
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('class', 'donut-center-text')
      .attr('fill', 'white')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .text(status.threatsDetected);
    
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .attr('fill', '#9ca3af')
      .style('font-size', '12px')
      .text('Total Threats');
    
    // Create legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width / 4}, ${-height / 2.8})`);
    
    threatDistributionData.forEach((d, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);
      
      legendRow.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', d.color);
      
      legendRow.append('text')
        .attr('x', 15)
        .attr('y', 9)
        .attr('fill', 'white')
        .style('font-size', '12px')
        .text(`${d.name} (${d.value}%)`);
    });
    
    // Handle window resize
    // Handle resize within useEffect in the parent component
    const handleResize = () => {
      createDonutChart();
    };
    
    // We'll handle resize events in the parent useEffect
    return handleResize;
  };
  
  // Format time since last update
  const formatTimeSince = () => {
    if (!lastUpdated) return 'Never';
    
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">ZeroHack: TrustSec</h2>
          <p className="text-zinc-400 text-sm mt-1">Real-Time AI Threat Detection Pipeline</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center px-3 py-1 rounded-full ${
            systemHealth === 'healthy' ? 'bg-green-900 bg-opacity-30 text-green-500' :
            systemHealth === 'warning' ? 'bg-yellow-900 bg-opacity-30 text-yellow-500' :
            'bg-red-900 bg-opacity-30 text-red-500'
          }`}>
            {systemHealth === 'healthy' ? (
              <CheckCircle size={16} className="mr-1" />
            ) : (
              <AlertTriangle size={16} className="mr-1" />
            )}
            <span>
              System {systemHealth === 'healthy' ? 'Healthy' : systemHealth === 'warning' ? 'Warning' : 'Critical'}
            </span>
          </div>
          <div className="text-xs bg-zinc-800 px-3 py-1 rounded-full flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            <span>Last updated: {formatTimeSince()}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Model Accuracy</div>
            <div className="text-xl font-bold">{mlPerformance.modelAccuracy}%</div>
          </div>
          <div className="bg-emerald-600 bg-opacity-20 p-2 rounded-lg">
            <Brain className="text-emerald-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">False Positive Rate</div>
            <div className="text-xl font-bold">{mlPerformance.falsePositiveRate}%</div>
          </div>
          <div className="bg-blue-600 bg-opacity-20 p-2 rounded-lg">
            <LineChart className="text-blue-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">GPU Utilization</div>
            <div className="text-xl font-bold">{mlPerformance.gpuUtilization}%</div>
          </div>
          <div className="bg-purple-600 bg-opacity-20 p-2 rounded-lg">
            <Cpu className="text-purple-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Inference Time</div>
            <div className="text-xl font-bold">{mlPerformance.inferenceTime}ms</div>
          </div>
          <div className="bg-yellow-600 bg-opacity-20 p-2 rounded-lg">
            <Clock className="text-yellow-500" size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatusCard 
          title="Processes Monitored" 
          value={status.processesMonitored} 
          icon={<Activity size={20} />} 
          change="5% last hour" 
          positive={true} 
        />
        <StatusCard 
          title="Threats Detected" 
          value={status.threatsDetected} 
          icon={<AlertTriangle size={20} />}
          change={status.threatsDetected > 0 ? "Alert level elevated" : undefined}
          positive={false}
        />
        <StatusCard 
          title="Files Scanned" 
          value={status.filesScanned} 
          icon={<Shield size={20} />}
          change="12% last hour"
          positive={true}
        />
        <StatusCard 
          title="Quarantined Items" 
          value={status.quarantinedItems} 
          icon={<Database size={20} />}
        />
      </div>
      
      <div className="bg-zinc-800 p-4 rounded-lg mb-6 border border-zinc-800 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center">
            <Zap className="mr-2 text-emerald-500" size={18} />
            AI Detection Pipeline Performance
          </h3>
          <div className="text-xs flex space-x-3">
            <div>
              <span className="text-zinc-400">ONNX Runtime:</span>
              <span className="text-emerald-500 font-semibold ml-1">Active</span>
            </div>
            <div>
              <span className="text-zinc-400">GPU Acceleration:</span>
              <span className="text-emerald-500 font-semibold ml-1">Enabled</span>
            </div>
            <div>
              <span className="text-zinc-400">Batch Size:</span>
              <span className="text-emerald-500 font-semibold ml-1">50</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900 p-3 rounded-lg">
            <div className="text-xs text-zinc-500 mb-1">CodeBERT Processing</div>
            <div className="text-lg font-semibold">44ms</div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
              <span>Text Payload</span>
              <span>98.2% Accuracy</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '15%' }}></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 p-3 rounded-lg">
            <div className="text-xs text-zinc-500 mb-1">Scapy Feature Extraction</div>
            <div className="text-lg font-semibold">68ms</div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
              <span>Network Protocol</span>
              <span>96.5% Accuracy</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '25%' }}></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 p-3 rounded-lg">
            <div className="text-xs text-zinc-500 mb-1">OpenCV Steganalysis</div>
            <div className="text-lg font-semibold">98ms</div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
              <span>Media Files</span>
              <span>97.1% Accuracy</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '35%' }}></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 p-3 rounded-lg">
            <div className="text-xs text-zinc-500 mb-1">SHAP Explainability</div>
            <div className="text-lg font-semibold">28ms</div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
              <span>Feature Importance</span>
              <span>100% Coverage</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '10%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="text-zinc-400 text-sm">CPU Usage</div>
            <div className={`text-sm ${status.cpuUsage > 80 ? 'text-red-500' : status.cpuUsage > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
              {status.cpuUsage.toFixed(1)}%
            </div>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                status.cpuUsage > 80 ? 'bg-red-500' : 
                status.cpuUsage > 60 ? 'bg-yellow-500' : 
                'bg-emerald-500'
              }`}
              style={{ width: `${status.cpuUsage}%` }}
            ></div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="text-zinc-400 text-sm">Memory Usage</div>
            <div className={`text-sm ${status.memoryUsage > 80 ? 'text-red-500' : status.memoryUsage > 60 ? 'text-yellow-500' : 'text-green-500'}`}>
              {status.memoryUsage.toFixed(1)}%
            </div>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                status.memoryUsage > 80 ? 'bg-red-500' : 
                status.memoryUsage > 60 ? 'bg-yellow-500' : 
                'bg-emerald-500'
              }`}
              style={{ width: `${status.memoryUsage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center">
          <div className="bg-zinc-700 p-3 rounded-lg mr-4">
            <Brain className="text-emerald-500" size={24} />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">AI Learning Mode</div>
            <div className="font-semibold">
              {status.isLearningMode ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="ml-auto">
            <div className={`w-12 h-6 rounded-full p-1 ${status.isLearningMode ? 'bg-emerald-600' : 'bg-zinc-700'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${status.isLearningMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center">
          <div className="bg-zinc-700 p-3 rounded-lg mr-4">
            <Shield className="text-emerald-500" size={24} />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">Automatic Containment</div>
            <div className="font-semibold">Enabled</div>
          </div>
          <div className="ml-auto">
            <div className="w-12 h-6 rounded-full p-1 bg-emerald-600">
              <div className="w-4 h-4 rounded-full bg-white transform translate-x-6"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg flex items-center">
          <div className="bg-zinc-700 p-3 rounded-lg mr-4">
            <Database className="text-emerald-500" size={24} />
          </div>
          <div>
            <div className="text-zinc-400 text-sm">Blockchain Logging</div>
            <div className="font-semibold">Active</div>
          </div>
          <div className="ml-auto">
            <div className="w-12 h-6 rounded-full p-1 bg-emerald-600">
              <div className="w-4 h-4 rounded-full bg-white transform translate-x-6"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1">
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg relative">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold flex items-center">
              <BarChart2 size={18} className="mr-2 text-emerald-500" /> 
              System Activity
            </div>
            <div className="flex space-x-2">
              <button className="bg-emerald-500 bg-opacity-20 hover:bg-opacity-30 text-emerald-500 px-3 py-1 rounded text-xs">
                Last Hour
              </button>
              <button className="bg-zinc-900 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-xs">
                Last Day
              </button>
              <button className="bg-zinc-900 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-xs">
                Last Week
              </button>
            </div>
          </div>
          
          <div id="activity-chart" className="h-48 w-full" aria-label="System activity chart showing hourly metrics"></div>
          
          {/* D3.js activity chart will be rendered here */}
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>Now</span>
          </div>
          
          <div 
            ref={tooltipRef}
            className="absolute bg-zinc-900 border border-zinc-700 rounded px-3 py-2 pointer-events-none opacity-0 shadow-lg"
            style={{
              zIndex: 10
            }}
          ></div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-800 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold flex items-center">
              <AlertTriangle size={18} className="mr-2 text-red-500" /> 
              Threat Distribution
            </div>
            <button className="text-xs bg-zinc-900 hover:bg-zinc-700 px-3 py-1 rounded text-zinc-300">
              Export Report
            </button>
          </div>
          
          <div id="donut-chart" className="h-48" aria-label="Threat distribution donut chart showing percentage breakdown by category"></div>
        </div>
      </div>
    </div>
  );
}
