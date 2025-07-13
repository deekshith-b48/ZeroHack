'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Info, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ThreatPoint {
  x: number;
  y: number;
  value: number; // Threat level (0-100)
  id: string;
  description: string;
  threatLocation?: string; // Renamed from location to avoid conflicts with global location
  timestamp: string;
  type: string;
}

interface ThreatHeatmapProps {
  width?: number;
  height?: number;
  data?: ThreatPoint[];
  className?: string;
}

export function ThreatHeatmap({ 
  width = 800, 
  height = 500, 
  data: initialData,
  className = ''
}: ThreatHeatmapProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ThreatPoint[]>(initialData || []);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Fetch data from API
  useEffect(() => {
    if (!initialData) {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
      const INCIDENTS_ENDPOINT = `${API_BASE_URL}/api/incidents`;

      const fetchHeatmapData = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(INCIDENTS_ENDPOINT);
          if (!response.ok) throw new Error("Failed to fetch heatmap data");
          const incidents = await response.json();

          // Map incident data to ThreatPoint data for the heatmap.
          // This requires mapping IP to an x/y coordinate.
          // This is a placeholder and would need a proper IP-to-geo or network mapping service.
          const mappedData = incidents.map((inc: any, i: number) => ({
            x: (parseInt(inc.sourceIP.split('.')[2]) % width) || Math.random() * width, // Simple, non-realistic mapping
            y: (parseInt(inc.sourceIP.split('.')[3]) % height) || Math.random() * height,
            value: (inc.confidence || 0.5) * 100,
            id: `threat-${i}-${inc.txHash}`,
            description: inc.explanation,
            threatLocation: inc.sourceIP,
            timestamp: inc.timestamp,
            type: inc.attackType,
          }));

          setData(mappedData);
        } catch (err) {
          setError(err.message);
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      fetchHeatmapData();
    }
  }, [initialData, width, height]);

  // Create and update the heatmap visualization
  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    
    // Create a color scale for threat levels
    const colorScale = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgb('#3b82f6', '#ef4444'));
    
    // Create a container for the heatmap with zoom capabilities
    const container = svg.append('g')
      .attr('class', 'heatmap-container');
    
    // Create the heatmap using a contour plot
    const contours = d3.contourDensity<ThreatPoint>()
      .x(d => d.x)
      .y(d => d.y)
      .weight(d => d.value)
      .size([width, height])
      .bandwidth(30)
      .thresholds(20)(data);
    
    // Draw the contours
    container.append('g')
      .attr('class', 'contours')
      .selectAll('path')
      .data(contours)
      .enter()
      .append('path')
      .attr('d', d3.geoPath())
      .attr('fill', d => colorScale(d.value * 100))
      .attr('stroke', 'none')
      .attr('opacity', 0.7);
    
    // Add threat points as small circles
    container.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 3)
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.8)
      .attr('class', 'threat-point')
      .on('mouseover', function(event, d) {
        // Show tooltip
        const tooltip = d3.select(tooltipRef.current!);
        tooltip.transition()
          .duration(200)
          .style('opacity', 1);
        
        tooltip.html(`
          <div class="font-medium">${d.description}</div>
          <div class="text-sm">${d.type}</div>
          <div class="text-xs text-zinc-400">${d.threatLocation || 'Unknown location'}</div>
          <div class="text-xs text-zinc-400">${new Date(d.timestamp).toLocaleString()}</div>
          <div class="flex items-center mt-1">
            <span class="inline-block w-2 h-2 rounded-full mr-1" style="background: ${colorScale(d.value)}"></span>
            <span class="text-xs">Threat Level: ${Math.round(d.value)}%</span>
          </div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
        
        // Highlight the point
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 6)
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        // Hide tooltip
        d3.select(tooltipRef.current!)
          .transition()
          .duration(500)
          .style('opacity', 0);
        
        // Reset point size
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 3)
          .attr('stroke-width', 0.5);
      });
    
    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });
    
    svg.call(zoom);
    
    // Add legend
    const legendHeight = 10;
    const legendWidth = 200;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;
    
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, ${legendY})`);
    
    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'threat-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorScale(0));
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorScale(100));
    
    // Draw legend rectangle
    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#threat-gradient)');
    
    // Add legend labels
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendHeight + 15)
      .attr('text-anchor', 'start')
      .attr('fill', '#d1d5db')
      .style('font-size', '10px')
      .text('Low');
    
    legend.append('text')
      .attr('x', legendWidth)
      .attr('y', legendHeight + 15)
      .attr('text-anchor', 'end')
      .attr('fill', '#d1d5db')
      .style('font-size', '10px')
      .text('High');
    
    legend.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', legendHeight + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#d1d5db')
      .style('font-size', '10px')
      .text('Threat Level');
    
  }, [data, width, height]);
  
  // Function to handle search result selection
  const handleSearchResult = (result: any) => {
    if (result.type === 'country') {
      // Handle country focus
      if (svgRef.current) {
        // Implementation would depend on the data structure
        // For now just clear the search
        setSearchQuery('');
        setSearchResults([]);
      }
    } else if (result.type === 'threat') {
      // Handle threat point focus
      if (svgRef.current) {
        // Implementation would depend on the data structure
        // For now just clear the search
        setSearchQuery('');
        setSearchResults([]);
      }
    }
  };

  // Handle zoom in button click
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 5]);
    
    svg.transition()
      .duration(300)
      .call(zoom.scaleBy as any, 1.3);
  };

  // Handle zoom out button click
  const handleZoomOut = () => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 5]);
    
    svg.transition()
      .duration(300)
      .call(zoom.scaleBy as any, 0.7);
  };

  // Handle reset view button click
  const handleResetView = () => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 5]);
    
    svg.transition()
      .duration(300)
      .call(zoom.transform as any, d3.zoomIdentity);
  };

  // Refresh data
  const handleRefreshData = () => {
    setLoading(true);
    
    // Generate new random data
    const newData: ThreatPoint[] = Array.from({ length: 200 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      value: Math.random() * 100,
      id: `threat-${i}`,
      description: `Potential ${Math.random() > 0.7 ? 'Critical' : Math.random() > 0.4 ? 'Medium' : 'Low'} Security Threat`,
      location: ['Network Perimeter', 'Internal Network', 'Database Server', 'Web Application', 'User Endpoint'][Math.floor(Math.random() * 5)],
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      type: ['Intrusion Attempt', 'Data Exfiltration', 'Malware', 'DDoS', 'Phishing'][Math.floor(Math.random() * 5)]
    }));
    
    setData(newData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-t-transparent border-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400">Generating threat heatmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-red-500 flex flex-col items-center">
          <Info size={48} className="mb-4" />
          <p>{error}</p>
          <button 
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md"
            onClick={handleRefreshData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search bar for locations */}
      <div className="absolute top-4 left-4 z-10 w-64">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries or threats..."
            className="w-full bg-zinc-800 bg-opacity-90 border border-zinc-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="absolute left-3 top-2.5 text-zinc-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto z-20">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  className="w-full text-left px-4 py-2 hover:bg-zinc-700 flex items-center"
                  onClick={() => handleSearchResult(result)}
                >
                  {result.type === 'country' ? (
                    <div className="mr-2 text-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                    </div>
                  ) : (
                    <div className="mr-2 text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                  )}
                  <span className="text-sm truncate">{result.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-zinc-800 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-zinc-800 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-zinc-800 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700"
          onClick={handleResetView}
          title="Reset View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v18H3z"></path>
          </svg>
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-zinc-800 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700"
          onClick={handleRefreshData}
          title="Refresh Data"
        >
          <RefreshCw size={16} />
        </motion.button>
      </div>
      
      <div className="absolute bottom-4 left-4 z-10 bg-zinc-800 bg-opacity-80 px-3 py-1 rounded-md border border-zinc-700 text-xs">
        Zoom: {Math.round(zoomLevel * 100)}%
      </div>
      
      <svg 
        ref={svgRef} 
        width={width} 
        height={height}
        className="bg-zinc-900 rounded-lg"
      ></svg>
      
      <div 
        ref={tooltipRef}
        className="absolute bg-zinc-900 bg-opacity-95 border border-zinc-700 rounded px-3 py-2 pointer-events-none shadow-lg"
        style={{
          opacity: 0,
          position: 'absolute',
          zIndex: 10
        }}
      ></div>
      
      <div className="absolute bottom-4 right-4 z-10 bg-zinc-800 bg-opacity-80 px-3 py-1 rounded-md border border-zinc-700 text-xs">
        {data.length} Threat Points
      </div>
    </div>
  );
}
