'use client';

import { useState, useEffect, useRef } from 'react';
import { Map, Globe, AlertTriangle, Info, LineChart, Radar, Shield, Database, Server, Zap, Layers, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import topojson from '@/lib/topojson';
import { MapboxToolkit } from '@/lib/mapbox';
import { ThreatHeatmap } from './ThreatHeatmap';

// Define accessible focus styles for SVG elements
const focusStyles = `
  .country:focus, .threat-point:focus {
    outline: 2px solid #10b981;
    outline-offset: 2px;
  }
`;

interface ThreatLocation {
  id: number;
  latitude: number;
  longitude: number;
  country: string;
  city: string;
  ipAddress: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  magnitude?: number; // For visualizing impact size
  protocol?: string;
  port?: number;
  asn?: string;
  connectionCount?: number;
  targetIndustry?: string;
  attackVector?: string;
  malwareFamily?: string;
  confidence?: number;
  mitreTactic?: string;
  description?: string;
  enrichedData?: {
    orgName?: string;
    isp?: string;
    firstSeen?: string;
    lastSeen?: string;
    tags?: string[];
    reputation?: number;
  };
  relatedEvents?: {
    id: number;
    type: string;
    timestamp: string;
  }[];
  shapExplanation?: {
    features: Array<{
      name: string;
      value: number;
      importance: number;
    }>;
  };
}

export function ThreatMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapboxRef = useRef<MapboxToolkit | null>(null);
  
  const [threats, setThreats] = useState<ThreatLocation[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatLocation | null>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'heatmap'>('globe');
  const [threatCategories, setThreatCategories] = useState<Record<string, number>>({});
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/dark-v11');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<{
    name: string;
    threats: number;
    topThreats: string[];
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
  } | null>(null);
  const [showCountryModal, setShowCountryModal] = useState<boolean>(false);
  const [threatStats, setThreatStats] = useState({
    total: 0,
    byCountry: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0
    },
    topTargetedPorts: [80, 443, 22, 3389, 445],
    lastUpdated: new Date()
  });
  const [showShapExplanation, setShowShapExplanation] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (mapContainerRef.current) {
        const container = mapContainerRef.current.parentElement;
        if (container) {
          setContainerWidth(container.clientWidth);
          setContainerHeight(container.clientHeight);
        }
      }
    };
    
    // Initial update
    updateDimensions();
    
    // Update on resize
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Enhanced Globe View
  useEffect(() => {
    if (viewMode === 'globe') {
      if (!svgRef.current || !mapData) return;

      // Clear previous SVG content
      const svgElement = d3.select(svgRef.current);
      svgElement.selectAll('*').remove();

      // Set up ortho projection for globe
      const projection = d3.geoOrthographic()
        .scale(Math.min(containerWidth, containerHeight) / 3)
        .translate([containerWidth / 2, containerHeight / 2])
        .clipAngle(90);

      // Create path generator and store the projection reference for later use
      const path = d3.geoPath().projection(projection);
      
      // Store the projection as a property on the SVG node for later use
      if (svgElement.node()) {
        (svgElement.node() as any).__projectionRef = projection;
      }

      // Create the SVG container
      const svg = svgElement
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .attr('aria-label', 'Global threat map visualization');

      // Add Water/Ocean
      svg.append('circle')
        .attr('cx', containerWidth / 2)
        .attr('cy', containerHeight / 2)
        .attr('r', projection.scale())
        .attr('fill', '#111827')
        .attr('stroke', '#374151')
        .attr('stroke-width', 0.5);

      // Draw countries
      const countries = svg.append('g')
        .attr('class', 'countries');
      
      countries.selectAll('path')
        .data(topojson.feature(mapData, mapData.objects.countries).features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', path as any)
        .attr('fill', '#2d3748')
        .attr('stroke', '#4a5568')
        .attr('stroke-width', 0.5)
        .attr('tabindex', 0) // Make focusable for accessibility
        .attr('aria-label', (d) => `Country: ${(d as any).properties.name || 'Unknown'}`)
        .attr('data-country', (d: any) => (d as any).properties.name || 'Unknown')
        .on('mouseover', function() {
          d3.select(this).attr('fill', '#3e4c5e');
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('fill', d3.select(this).attr('data-selected') === 'true' ? '#4c6283' : '#2d3748');
        })
        .on('click', function(event, d: any) {
          // Reset all countries to default fill
          countries.selectAll('path').attr('data-selected', null).attr('fill', '#2d3748');
          
          // Mark this country as selected
          d3.select(this).attr('data-selected', 'true').attr('fill', '#4c6283');
          
          const countryName = d.properties.name;
          setSelectedCountry(countryName);
          
          // Generate mock country-specific threat data
          const threatCount = Math.floor(Math.random() * 50) + 5;
          const threatTypes = ['Malware', 'DDoS', 'Phishing', 'Ransomware', 'Data Breach', 'Zero-Day Exploit'];
          const topThreats = Array.from({ length: 3 }, () => 
            threatTypes[Math.floor(Math.random() * threatTypes.length)]
          );
          
          const threatLevel = threatCount > 30 ? 'critical' : 
                              threatCount > 20 ? 'high' : 
                              threatCount > 10 ? 'medium' : 'low';
          
          setCountryData({
            name: countryName,
            threats: threatCount,
            topThreats,
            threatLevel
          });
          
          setShowCountryModal(true);
        });
      
      // Add threat points
      const threatPoints = svg.append('g')
        .attr('class', 'threats');
      
      threatPoints.selectAll('circle')
        .data(threats)
        .enter()
        .append('circle')
        .attr('cx', (d) => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[0] : 0;
        })
        .attr('cy', (d) => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[1] : 0;
        })
        .attr('r', (d) => (d.magnitude || 30) / 10)
        .attr('fill', (d) => {
          switch (d.severity) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#3b82f6';
            default: return '#3b82f6';
          }
        })
        .attr('opacity', 0.8)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .attr('tabindex', 0)
        .attr('data-country', (d) => d.country)
        .attr('aria-label', (d) => `Threat: ${d.threatType} in ${d.city}, ${d.country}`)
        .on('mouseover', function(event, d) {
          // Show tooltip
          const tooltip = d3.select(tooltipRef.current!);
          tooltip.transition()
            .duration(200)
            .style('opacity', 1);
          
          tooltip.html(`
            <div class="font-medium">${d.description || d.threatType}</div>
            <div class="text-sm">${d.city}, ${d.country}</div>
            <div class="text-xs text-zinc-400">${new Date(d.timestamp).toLocaleString()}</div>
            <div class="flex items-center mt-1">
              <span class="inline-block w-2 h-2 rounded-full mr-1" style="background: ${
                d.severity === 'high' ? '#ef4444' : 
                d.severity === 'medium' ? '#f59e0b' : '#3b82f6'
              }"></span>
              <span class="capitalize text-xs">${d.severity} severity</span>
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
        })
        .on('click', function(event, d) {
          setSelectedThreat(d as ThreatLocation);
        });

      // Add rotation for interactive globe
      let rotation = 0;
      let animationRequestId: number;
      const rotate = () => {
        projection.rotate([rotation, -30, 0]);
        svg.selectAll('.country').attr('d', path as any);
        
        // Update threat positions
        svg.selectAll('.threats circle')
          .attr('cx', (d: any) => {
            const coords = projection([d.longitude, d.latitude]);
            return coords ? coords[0] : 0;
          })
          .attr('cy', (d: any) => {
            const coords = projection([d.longitude, d.latitude]);
            return coords ? coords[1] : 0;
          });
        
        rotation += 0.1;
        // Request next frame only if we're still in globe view
        if (viewMode === 'globe') {
          animationRequestId = requestAnimationFrame(rotate);
        }
      };
      
      // Start animation
      animationRequestId = requestAnimationFrame(rotate);
      
      // Add drag behavior
      const dragBehavior = d3.drag<SVGSVGElement, unknown>()
        .on('start', () => {
          // Cancel animation during drag
          if (animationRequestId) {
            cancelAnimationFrame(animationRequestId);
          }
        })
        .on('drag', (event) => {
          const rotate = projection.rotate();
          projection.rotate([rotate[0] + event.dx / 4, rotate[1] - event.dy / 4, 0]);
          svg.selectAll('.country').attr('d', path as any);
          
          // Update threat positions
          svg.selectAll('.threats circle')
            .attr('cx', (d: any) => {
              const coords = projection([d.longitude, d.latitude]);
              return coords ? coords[0] : 0;
            })
            .attr('cy', (d: any) => {
              const coords = projection([d.longitude, d.latitude]);
              return coords ? coords[1] : 0;
            });
        })
        .on('end', () => {
          // Resume animation after drag if we're still in globe mode
          if (viewMode === 'globe') {
            animationRequestId = requestAnimationFrame(rotate);
          }
        });
      
      svg.call(dragBehavior as any);
      
      // Add zoom behavior
      const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 8])
        .on('zoom', (event) => {
          const newScale = projection.scale() * event.transform.k;
          projection.scale(newScale);
          
          // Update the ocean circle radius
          svg.select('circle')
            .attr('r', newScale);
          
          // Update all paths and points
          svg.selectAll('.country').attr('d', path as any);
          
          svg.selectAll('.threats circle')
            .attr('cx', (d: any) => {
              const coords = projection([d.longitude, d.latitude]);
              return coords ? coords[0] : 0;
            })
            .attr('cy', (d: any) => {
              const coords = projection([d.longitude, d.latitude]);
              return coords ? coords[1] : 0;
            })
            .attr('r', (d: any) => ((d.magnitude || 30) / 10) / event.transform.k);
        });
      
      svg.call(zoomBehavior as any);
      
      setLoading(false);
    }
  }, [mapData, threats, viewMode, containerWidth, containerHeight]);

  // Handle search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    
    // Search through countries and threat points
    const results = [];
    
    // Search countries
    if (mapData && mapData.objects && mapData.objects.countries) {
      const countries = topojson.feature(mapData, mapData.objects.countries).features;
      
      for (const country of countries) {
        const countryName = country.properties?.name || '';
        if (countryName.toLowerCase().includes(query)) {
          results.push({
            type: 'country',
            name: countryName,
            data: country
          });
          
          if (results.length >= 5) break;
        }
      }
    }
    
    // Search through threat points
    for (const threat of threats) {
      if (results.length >= 10) break;
      
      const { country, city, threatType, description } = threat;
      
      if (
        country.toLowerCase().includes(query) ||
        city.toLowerCase().includes(query) ||
        threatType.toLowerCase().includes(query) ||
        (description && description.toLowerCase().includes(query))
      ) {
        results.push({
          type: 'threat',
          name: `${threatType} in ${city}, ${country}`,
          data: threat
        });
      }
    }
    
    setSearchResults(results);
  }, [searchQuery, mapData, threats]);

  // Function to focus on a specific location or threat
  const focusOnLocation = (item: any) => {
    if (!svgRef.current || !mapData) return;
    
    const svg = d3.select(svgRef.current);
    
    // Get the current projection from SVG
    // We need to store the projection as a property when we create it
    const svgNode = svg.node();
    if (!svgNode || !(svgNode as any).__projectionRef) return;
    
    const currentProjection = (svgNode as any).__projectionRef;
    
    if (item.type === 'country') {
      // Focus on country
      const countryPath = d3.geoPath().projection(currentProjection);
      const bounds = countryPath.bounds(item.data);
      const dx = bounds[1][0] - bounds[0][0];
      const dy = bounds[1][1] - bounds[0][1];
      const x = (bounds[0][0] + bounds[1][0]) / 2;
      const y = (bounds[0][1] + bounds[1][1]) / 2;
      
      // Set rotation to center on country
      const coordinates = d3.geoCentroid(item.data);
      currentProjection.rotate([-coordinates[0], -coordinates[1]]);
      
      // Update all paths
      svg.selectAll('.country').attr('d', countryPath as any);
      
      // Update threat points
      svg.selectAll('.threats circle')
        .attr('cx', (d: any) => {
          const coords = currentProjection([d.longitude, d.latitude]);
          return coords ? coords[0] : 0;
        })
        .attr('cy', (d: any) => {
          const coords = currentProjection([d.longitude, d.latitude]);
          return coords ? coords[1] : 0;
        });
      
      // Set selected country
      setSelectedCountry(item.data.properties.name);
    } else if (item.type === 'threat') {
      // Focus on threat point
      const threat = item.data;
      const coordinates = [threat.longitude, threat.latitude];
      
      // Set rotation to center on threat
      currentProjection.rotate([-coordinates[0], -coordinates[1]]);
      
      // Update all paths
      svg.selectAll('.country').attr('d', d3.geoPath().projection(currentProjection) as any);
      
      // Update threat points
      svg.selectAll('.threats circle')
        .attr('cx', (d: any) => {
          const coords = currentProjection([d.longitude, d.latitude]);
          return coords ? coords[0] : 0;
        })
        .attr('cy', (d: any) => {
          const coords = currentProjection([d.longitude, d.latitude]);
          return coords ? coords[1] : 0;
        });
      
      // Set selected threat
      setSelectedThreat(threat);
    }
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };
  
  useEffect(() => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
    const INCIDENTS_ENDPOINT = `${API_BASE_URL}/api/incidents`;

    const fetchThreats = async () => {
      setLoading(true);
      try {
        const response = await fetch(INCIDENTS_ENDPOINT);
        if (!response.ok) throw new Error("Failed to fetch incidents");
        const data = await response.json();

        // Map API response to ThreatLocation interface
        // NOTE: This requires a way to get lat/long from an IP.
        // For now, we'll assign random coordinates as a placeholder.
        const mappedThreats = data.map((inc: any, index: number) => ({
          id: index,
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
          country: 'Unknown', // Placeholder, needs IP geolocation
          city: 'Unknown', // Placeholder
          ipAddress: inc.sourceIP,
          threatType: inc.attackType,
          severity: inc.confidence > 0.7 ? 'high' : inc.confidence > 0.4 ? 'medium' : 'low',
          timestamp: inc.timestamp,
          magnitude: (inc.confidence || 0.5) * 100,
          description: inc.explanation,
        }));

        setThreats(mappedThreats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchThreats();

    const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
    const ALERTS_WEBSOCKET_ENDPOINT = `${WS_BASE_URL}/ws/alerts`;

    const ws = new WebSocket(ALERTS_WEBSOCKET_ENDPOINT);

    ws.onmessage = (event) => {
      const messageData = JSON.parse(event.data);
      if (messageData.event_type === 'IPQuarantined' || messageData.event_type === 'AdminAlert') {
        // A new threat has been detected and logged. Re-fetch the incidents.
        fetchThreats();
      }
    };

    // Load world map data
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setMapData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading map data:', error);
        setError('Failed to load map data');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!mapData || !svgRef.current) return;

    // Clear previous SVG content
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll('*').remove();

    // Get container dimensions
    const containerWidth = svgElement.node()?.parentElement?.clientWidth || 800;
    const containerHeight = svgElement.node()?.parentElement?.clientHeight || 600;
    
    // Define map projection
    const projection = d3.geoMercator()
      .scale(150)
      .center([0, 20])
      .translate([containerWidth / 2, containerHeight / 2]);
    
    // Create path generator
    const path = d3.geoPath().projection(projection);
    
    // Create a container for our map with zoom capabilities
    const svg = svgElement
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('aria-label', 'Global threat map visualization')
      .append('g');
    
    // Add style for focus states
    const style = document.createElement('style');
    style.textContent = focusStyles;
    document.head.appendChild(style);
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        svg.attr('transform', event.transform);
        
        // Scale threat points based on zoom level
        svg.selectAll('.threat-point')
          .attr('r', d => {
            const baseRadius = (d as any).magnitude / 10;
            return baseRadius / event.transform.k;
          });
      });
    
    svgElement.call(zoom as any);
    
    // Draw countries
    const countries = svg.append('g')
      .attr('class', 'countries');
    
    countries.selectAll('path')
      .data(topojson.feature(mapData, mapData.objects.countries).features)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path as any)
      .attr('fill', '#2d3748')
      .attr('stroke', '#4a5568')
      .attr('stroke-width', 0.5)
      .attr('tabindex', 0) // Make focusable for accessibility
      .attr('aria-label', (d) => `Country: ${(d as any).properties.name || 'Unknown'}`)
      .on('mouseover', function() {
        d3.select(this).attr('fill', '#3e4c5e');
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', '#2d3748');
      });
    
    // Add threat points
    const threatPoints = svg.append('g')
      .attr('class', 'threats');
    
    threatPoints.selectAll('circle')
      .data(threats)
      .enter()
      .append('circle')
      .attr('class', 'threat-point')
      .attr('cx', (d) => {
        const coords = projection([d.longitude, d.latitude]);
        return coords ? coords[0] : 0;
      })
      .attr('cy', (d) => {
        const coords = projection([d.longitude, d.latitude]);
        return coords ? coords[1] : 0;
      })
      .attr('r', (d) => (d.magnitude || 30) / 10)
      .attr('fill', (d) => {
        switch (d.severity) {
          case 'high': return '#ef4444';
          case 'medium': return '#f59e0b';
          case 'low': return '#3b82f6';
          default: return '#3b82f6';
        }
      })
      .attr('opacity', 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('tabindex', 0) // Make focusable for accessibility
      .attr('aria-label', (d) => `Threat: ${d.threatType} in ${d.city}, ${d.country}`)
      // Animation effect
      .attr('opacity', 0)
      .transition()
      .duration(1000)
      .delay((_, i) => i * 100)
      .attr('opacity', 0.8)
      // Add pulse animation
      .each(function(_, i) {
        d3.select(this)
          .append('animate')
          .attr('attributeName', 'r')
          .attr('values', (d: any) => {
            const baseRadius = (d.magnitude || 30) / 10;
            return `${baseRadius};${baseRadius * 1.3};${baseRadius}`;
          })
          .attr('dur', '2s')
          .attr('repeatCount', 'indefinite');
      })
      .on('mouseover', function(this: SVGCircleElement, event: any, d: any) {
        // Highlight point
        d3.select(this)
          .attr('stroke-width', 2)
          .attr('stroke', '#ffffff');
        
        // Show tooltip
        const tooltip = d3.select(tooltipRef.current!);
        tooltip.transition()
          .duration(200)
          .style('opacity', 1);
        
        const threatData = d as ThreatLocation;
        tooltip.html(`
          <div class="font-semibold">${threatData.threatType}</div>
          <div class="text-sm">${threatData.city}, ${threatData.country}</div>
          <div class="text-xs text-zinc-400">${threatData.timestamp}</div>
          <div class="flex items-center mt-1">
            <span class="inline-block w-2 h-2 rounded-full mr-1" style="background: ${
              threatData.severity === 'high' ? '#ef4444' : 
              threatData.severity === 'medium' ? '#f59e0b' : '#3b82f6'
            }"></span>
            <span class="capitalize text-xs">${threatData.severity} severity</span>
          </div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        // Reset highlight
        d3.select(this)
          .attr('stroke-width', 0.5)
          .attr('stroke', '#ffffff');
        
        // Hide tooltip
        d3.select(tooltipRef.current!)
          .transition()
          .duration(500)
          .style('opacity', 0);
      })
      .on('click', function(this: SVGCircleElement, event: any, d: any) {
        setSelectedThreat(d as ThreatLocation);
        
        // Animate to the threat location
        const threatData = d as ThreatLocation;
        const coords = projection([threatData.longitude, threatData.latitude]);
        if (coords) {
          const targetX = containerWidth / 2 - coords[0] * 2;
          const targetY = containerHeight / 2 - coords[1] * 2;
          const targetScale = 2;
          
          svgElement.transition()
            .duration(750)
            .call(
              zoom.transform as any,
              d3.zoomIdentity
                .translate(targetX, targetY)
                .scale(targetScale)
            );
        }
      });
    
    // Add connections between certain threats to visualize relationships
    const threatConnections = [
      { source: 0, target: 2 }, // San Francisco to Tokyo
      { source: 1, target: 4 }, // London to Sydney
      { source: 3, target: 7 }, // Moscow to Rio
      { source: 5, target: 6 }  // Paris to Mexico City
    ];
    
    const connections = svg.append('g')
      .attr('class', 'connections');
    
    connections.selectAll('path')
      .data(threatConnections)
      .enter()
      .append('path')
      .attr('d', (d) => {
        const source = threats[d.source];
        const target = threats[d.target];
        
        const sourceCoords = projection([source.longitude, source.latitude]);
        const targetCoords = projection([target.longitude, target.latitude]);
        
        if (!sourceCoords || !targetCoords) return '';
        
        // Create curved line between points
        const dx = targetCoords[0] - sourceCoords[0];
        const dy = targetCoords[1] - sourceCoords[1];
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curve factor
        
        return `M${sourceCoords[0]},${sourceCoords[1]}A${dr},${dr} 0 0,1 ${targetCoords[0]},${targetCoords[1]}`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '5,3')
      // Animated flow
      .each(function() {
        const totalLength = this.getTotalLength();
        
        d3.select(this)
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(2000)
          .delay((_, i) => i * 500)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', 0)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('stroke-dashoffset', -totalLength)
          .on('end', function repeat() {
            d3.select(this)
              .attr('stroke-dashoffset', totalLength)
              .transition()
              .duration(2000)
              .ease(d3.easeLinear)
              .attr('stroke-dashoffset', 0)
              .transition()
              .duration(2000)
              .ease(d3.easeLinear)
              .attr('stroke-dashoffset', -totalLength)
              .on('end', repeat);
          });
      });

    // Handle window resize
    const handleResize = () => {
      const newWidth = svgElement.node()?.parentElement?.clientWidth || 800;
      const newHeight = svgElement.node()?.parentElement?.clientHeight || 600;
      
      svgElement
        .attr('width', newWidth)
        .attr('height', newHeight);
      
      // Update projection
      projection
        .translate([newWidth / 2, newHeight / 2]);
      
      // Update paths and circles
      countries.selectAll('path')
        .attr('d', path as any);
      
      threatPoints.selectAll('circle')
        .attr('cx', (d: any) => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[0] : 0;
        })
        .attr('cy', (d: any) => {
          const coords = projection([d.longitude, d.latitude]);
          return coords ? coords[1] : 0;
        });
      
      // Update connections
      connections.selectAll('path')
        .attr('d', (d: any) => {
          const source = threats[d.source];
          const target = threats[d.target];
          
          const sourceCoords = projection([source.longitude, source.latitude]);
          const targetCoords = projection([target.longitude, target.latitude]);
          
          if (!sourceCoords || !targetCoords) return '';
          
          const dx = targetCoords[0] - sourceCoords[0];
          const dy = targetCoords[1] - sourceCoords[1];
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
          
          return `M${sourceCoords[0]},${sourceCoords[1]}A${dr},${dr} 0 0,1 ${targetCoords[0]},${targetCoords[1]}`;
        });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.head.removeChild(style);
    };
  }, [mapData, threats]);

  const handleThreatClick = (threat: ThreatLocation) => {
    setSelectedThreat(threat);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-500';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Threat Map</h2>
        </div>
        <div className="flex-1 bg-zinc-800 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-400">Loading threat data...</p>
          </div>
        </div>
      </div>
    );
  }

  {/* Country-specific threat data modal */}
  <AnimatePresence>
    {showCountryModal && countryData && (
      <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setShowCountryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-800 rounded-lg p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center">
                    <Globe size={20} className="mr-2 text-blue-500" />
                    {countryData.name}
                  </h3>
                  <p className="text-zinc-400 text-sm">Threat Intelligence Summary</p>
                </div>
                <button 
                  onClick={() => setShowCountryModal(false)}
                  className="p-1 hover:bg-zinc-700 rounded-full"
                >
                  <XCircle size={20} />
                </button>
              </div>
            
              <div className="space-y-4">
                <div className="bg-zinc-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-zinc-400">Threat Level</div>
                    <div className={`text-sm px-3 py-1 rounded-full ${
                      countryData.threatLevel === 'critical' ? 'bg-red-900 bg-opacity-30 text-red-500' :
                      countryData.threatLevel === 'high' ? 'bg-orange-900 bg-opacity-30 text-orange-500' :
                      countryData.threatLevel === 'medium' ? 'bg-yellow-900 bg-opacity-30 text-yellow-500' :
                      'bg-blue-900 bg-opacity-30 text-blue-500'
                    }`}>
                      {countryData.threatLevel.charAt(0).toUpperCase() + countryData.threatLevel.slice(1)}
                    </div>
                  </div>
                </div>
              
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-700 p-4 rounded-lg">
                    <div className="text-sm text-zinc-400 mb-2">Active Threats</div>
                    <div className="text-2xl font-bold">{countryData.threats}</div>
                  </div>
                
                  <div className="bg-zinc-700 p-4 rounded-lg">
                    <div className="text-sm text-zinc-400 mb-2">Last Attack</div>
                    <div className="text-sm font-medium">{new Date().toLocaleDateString()}</div>
                    <div className="text-xs text-zinc-500">{new Date().toLocaleTimeString()}</div>
                  </div>
                </div>
              
                <div className="bg-zinc-700 p-4 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Top Threat Vectors</div>
                  <div className="space-y-2">
                    {countryData.topThreats.map((threat, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                        <div className="text-sm">{threat}</div>
                      </div>
                    ))}
                  </div>
                </div>
              
                <div className="bg-zinc-700 p-4 rounded-lg">
                  <div className="text-sm text-zinc-400 mb-2">Threat Trend</div>
                  <div className="h-20">
                    {/* Simple mockup chart using divs */}
                    <div className="flex items-end h-full space-x-1">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const height = 20 + Math.random() * 80;
                        return (
                          <div 
                            key={i}
                            className="bg-emerald-500 bg-opacity-60 flex-1 rounded-t"
                            style={{ height: `${height}%` }}
                          ></div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-zinc-500">Jan</span>
                    <span className="text-xs text-zinc-500">Dec</span>
                  </div>
                </div>
              
                <div className="flex space-x-3">
                  <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md flex items-center justify-center">
                    <Radar size={16} className="mr-2" />
                    Detailed Analysis
                  </button>
                  <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-md flex items-center justify-center">
                    <Shield size={16} className="mr-2" />
                    Countermeasures
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

  if (error) {
  return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Threat Map</h2>
        </div>
        <div className="flex-1 bg-zinc-800 rounded-lg flex items-center justify-center">
          <div className="text-red-500 flex flex-col items-center">
            <AlertTriangle size={48} className="mb-4" />
            <p>{error}</p>
            <button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Interactive Threat Map</h2>
        <div className="flex items-center space-x-4">
          <div className="bg-zinc-800 px-3 py-1 rounded-md border border-zinc-700 flex items-center">
            <Shield size={16} className="text-emerald-500 mr-2" />
            <span className="text-xs text-zinc-300">
              {threatStats.total} Active Threats <span className="text-zinc-500 mx-1">•</span> 
              <span className="text-red-500 font-medium">{threatStats.bySeverity.high}</span> High Priority
            </span>
          </div>
          
          <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
            <button 
              className={`px-3 py-2 text-xs ${viewMode === 'globe' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setViewMode('globe')}
            >
              Globe View
            </button>
            <button 
              className={`px-3 py-2 text-xs ${viewMode === 'heatmap' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setViewMode('heatmap')}
            >
              Heatmap
            </button>
          </div>
          
          <Link 
            href="/threat-heatmap"
            className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-md flex items-center"
          >
            <Layers size={18} className="mr-2" />
            Full Heatmap View
          </Link>
          
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md flex items-center text-sm">
            <RefreshCw size={14} className="mr-2" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Total Threats</div>
            <div className="text-xl font-bold">{threats.length}</div>
          </div>
          <div className="bg-red-600 bg-opacity-20 p-2 rounded-lg">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Top Country</div>
            <div className="text-lg font-bold">United States</div>
          </div>
          <div className="bg-blue-600 bg-opacity-20 p-2 rounded-lg">
            <Globe className="text-blue-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Top Attack Type</div>
            <div className="text-lg font-bold">Brute Force</div>
          </div>
          <div className="bg-yellow-600 bg-opacity-20 p-2 rounded-lg">
            <Zap className="text-yellow-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Analysis Engine</div>
            <div className="text-lg font-bold">XGBoost</div>
          </div>
          <div className="bg-purple-600 bg-opacity-20 p-2 rounded-lg">
            <Layers className="text-purple-500" size={20} />
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-zinc-400 text-xs">Model Accuracy</div>
            <div className="text-lg font-bold">98.7%</div>
          </div>
          <div className="bg-emerald-600 bg-opacity-20 p-2 rounded-lg">
            <LineChart className="text-emerald-500" size={20} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 shadow-lg relative">
          {/* Map container */}
          <div className="w-full h-full relative">
            {viewMode === 'globe' && (
              <div id="mapbox-container" ref={mapContainerRef} className="w-full h-full"></div>
            )}
            {viewMode === 'heatmap' && (
              <ThreatHeatmap 
                width={containerWidth} 
                height={containerHeight} 
              />
            )}
            {viewMode !== 'globe' && viewMode !== 'heatmap' && (
              <svg ref={svgRef} className="w-full h-full"></svg>
            )}
            
            {/* Tooltip */}
            <div 
              ref={tooltipRef}
              className="absolute bg-zinc-900 bg-opacity-95 border border-zinc-700 rounded px-3 py-2 pointer-events-none shadow-lg"
              style={{
                opacity: 0,
                position: 'absolute',
                zIndex: 10
              }}
            ></div>
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-zinc-900 bg-opacity-80 border border-zinc-700 rounded-lg p-3 shadow-lg">
              <div className="text-sm font-semibold mb-2">Threat Severity</div>
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                  <span className="text-xs">High</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                  <span className="text-xs">Medium</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                  <span className="text-xs">Low</span>
                </div>
              </div>
              
              <div className="border-t border-zinc-700 my-2"></div>
              
              <div className="text-sm font-semibold mb-2">Active Threats</div>
              <div className="text-2xl font-bold">{threats.length}</div>
            </div>
            
            {/* Map controls */}
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
              <button className="bg-zinc-900 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700" title="Zoom in">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="bg-zinc-900 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700" title="Zoom out">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="bg-zinc-900 bg-opacity-80 hover:bg-opacity-100 w-8 h-8 rounded-md flex items-center justify-center border border-zinc-700" title="Reset view">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Instructions overlay - shown briefly then fades out */}
            <motion.div 
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 3, duration: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-zinc-900 bg-opacity-80 rounded-lg p-4 shadow-lg">
                <p className="text-sm text-zinc-300">
                  <span className="text-emerald-500">Click and drag</span> to pan the map. 
                  <span className="text-emerald-500 ml-2">Scroll</span> to zoom.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="w-80 flex flex-col">
          <div className="bg-zinc-800 rounded-lg overflow-hidden mb-4 border border-zinc-700 shadow-lg">
            <div className="bg-zinc-700 px-4 py-3 font-medium">
              Active Threats
            </div>
            <div className="overflow-auto max-h-[300px]">
              {threats.map((threat) => (
                <motion.div 
                  key={threat.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: threat.id * 0.1 }}
                  className={`p-3 border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                    selectedThreat?.id === threat.id ? 'bg-zinc-700' : ''
                  }`}
                  onClick={() => handleThreatClick(threat)}
                >
                  <div className="flex items-center">
                    <AlertTriangle 
                      size={16} 
                      className={
                        threat.severity === 'high' ? 'text-red-500' : 
                        threat.severity === 'medium' ? 'text-yellow-500' : 
                        'text-blue-500'
                      } 
                    />
                    <span className="ml-2 font-medium">{threat.threatType}</span>
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">
                    {threat.city}, {threat.country}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {threat.timestamp}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-800 rounded-lg overflow-hidden flex-1 border border-zinc-700 shadow-lg">
            <div className="bg-zinc-700 px-4 py-3 font-medium">
              Threat Details
            </div>
            {selectedThreat ? (
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      selectedThreat.severity === 'high' ? 'bg-red-500' :
                      selectedThreat.severity === 'medium' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                    <h3 className="font-medium">{selectedThreat.threatType}</h3>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    selectedThreat.severity === 'high' ? 'bg-red-900 bg-opacity-20 text-red-500' :
                    selectedThreat.severity === 'medium' ? 'bg-yellow-900 bg-opacity-20 text-yellow-500' :
                    'bg-blue-900 bg-opacity-20 text-blue-500'
                  }`}>
                    {selectedThreat.severity.toUpperCase()} Priority
                  </div>
                </div>
              
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-zinc-400">Location</div>
                    <div className="font-medium">{selectedThreat.city}, {selectedThreat.country}</div>
                  </div>
                
                  <div>
                    <div className="text-sm text-zinc-400">Time Detected</div>
                    <div className="font-medium">{selectedThreat.timestamp}</div>
                  </div>
                </div>
              
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-zinc-400">IP Address</div>
                    <div className="font-medium font-mono text-sm">{selectedThreat.ipAddress}</div>
                  </div>
                
                  <div>
                    <div className="text-sm text-zinc-400">ASN</div>
                    <div className="font-medium">{selectedThreat.asn || 'Unknown'}</div>
                  </div>
                </div>
              
                {selectedThreat.protocol && selectedThreat.port && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-zinc-400">Protocol</div>
                      <div className="font-medium">{selectedThreat.protocol}</div>
                    </div>
                  
                    <div>
                      <div className="text-sm text-zinc-400">Port</div>
                      <div className="font-medium">{selectedThreat.port}</div>
                    </div>
                  </div>
                )}
              
                {selectedThreat.attackVector && (
                  <div>
                    <div className="text-sm text-zinc-400">Attack Vector</div>
                    <div className="font-medium">{selectedThreat.attackVector}</div>
                  </div>
                )}
              
                {selectedThreat.mitreTactic && (
                  <div>
                    <div className="text-sm text-zinc-400">MITRE ATT&CK</div>
                    <div className="font-medium">{selectedThreat.mitreTactic}</div>
                  </div>
                )}
              
                {selectedThreat.connectionCount && (
                  <div>
                    <div className="text-sm text-zinc-400">Connection Count</div>
                    <div className="font-medium">{selectedThreat.connectionCount}</div>
                  </div>
                )}
              
                {selectedThreat.shapExplanation && (
                  <div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-zinc-400">SHAP Analysis</div>
                      <button 
                        className="text-xs text-emerald-500 hover:underline"
                        onClick={() => setShowShapExplanation(true)}
                      >
                        View Details
                      </button>
                    </div>
                    <div className="mt-2 bg-zinc-700 p-2 rounded">
                      <div className="text-xs mb-1">Top Factors:</div>
                      {selectedThreat.shapExplanation.features.slice(0, 2).map((feature, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{feature.name}</span>
                          <span className="font-medium">{(feature.importance * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              
                <div className="pt-4 grid grid-cols-2 gap-3">
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md text-sm">
                    View Full Analysis
                  </button>
                  <button className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-md text-sm">
                    Block IP Address
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500">
                <Globe size={40} className="mx-auto mb-4 opacity-50" />
                <p>Select a threat to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    
    {/* SHAP Explanation Modal */}
    <AnimatePresence>
      {showShapExplanation && selectedThreat && selectedThreat.shapExplanation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setShowShapExplanation(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">SHAP Feature Explanation</h3>
              <button 
                onClick={() => setShowShapExplanation(false)}
                className="p-1 hover:bg-zinc-700 rounded-full"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-zinc-400 mb-2">Threat Detection Model: XGBoost Classifier</div>
              <div className="text-sm">
                This visualization shows how each feature contributed to the model's decision to classify this event as a threat.
                Positive values (red) push the prediction higher, while negative values (blue) reduce the threat score.
              </div>
            </div>
            
            <div className="space-y-4">
              {selectedThreat.shapExplanation.features.map((feature, idx) => (
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
                  style={{ width: `${selectedThreat.confidence || 85}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>0%</span>
                <span className="font-medium">{selectedThreat.confidence || 85}%</span>
                <span>100%</span>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
                onClick={() => setShowShapExplanation(false)}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
