'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// WebSocket connection states
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

// WebSocket event types
export type EventType = 
  | 'process_event'  // Process monitoring events 
  | 'threat_alert'   // Detected threat alerts
  | 'blockchain_log' // Blockchain logging events
  | 'system_status'; // System status updates

// Event data interfaces
export interface ProcessEvent {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  handles: number;
  netIO: number;
  path: string;
  hash?: string;
  timestamp: string;
  anomalyScore?: number;
}

export interface ThreatAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  process: string;
  pid?: number;
  description: string;
  detectionMethod: 'yara' | 'ai' | 'behavioral' | 'manual';
  mitreAttack?: string;
  timestamp: string;
  indicators: string[];
  containmentStatus?: 'none' | 'pending' | 'contained' | 'failed';
  user?: string;
  ipfsHash?: string;
}

export interface BlockchainLog {
  id: string;
  txHash: string;
  alertHash: string;
  timestamp: string;
  blockHeight: number;
  status: 'pending' | 'confirmed' | 'rejected';
  merkleRoot?: string;
}

export interface SystemStatus {
  processesMonitored: number;
  threatsDetected: number;
  filesScanned: number;
  quarantinedItems: number;
  cpuUsage: number;
  memoryUsage: number;
  isLearningMode: boolean;
  lastUpdateTimestamp: string;
}

// Combined event type
export type WebSocketEvent = {
  type: EventType;
  data: ProcessEvent | ThreatAlert | BlockchainLog | SystemStatus;
};

// Configuration options for the WebSocket hook
interface WebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Custom hook for WebSocket connections with automatic reconnection
 */
export function useWebSocket(url: string, options: WebSocketOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = options.reconnectAttempts || 10;
  const reconnectInterval = options.reconnectInterval || 2000;

  // Store event listeners for type-specific subscriptions
  const listenersRef = useRef<{
    process_event: ((data: ProcessEvent) => void)[];
    threat_alert: ((data: ThreatAlert) => void)[];
    blockchain_log: ((data: BlockchainLog) => void)[];
    system_status: ((data: SystemStatus) => void)[];
  }>({
    process_event: [],
    threat_alert: [],
    blockchain_log: [],
    system_status: [],
  });

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('open');
        reconnectAttemptsRef.current = 0;
        if (options.onOpen) options.onOpen();
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed', event);
        setStatus('closed');
        
        // Attempt to reconnect unless explicitly closed
        if (!event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`);
          setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, reconnectInterval);
        }
        
        if (options.onClose) options.onClose();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error', error);
        setStatus('error');
        if (options.onError) options.onError(error);
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent = JSON.parse(event.data) as WebSocketEvent;
          
          // Update the events state
          setEvents((prev) => [...prev.slice(-99), wsEvent]);
          setLastEvent(wsEvent);
          
          // Notify type-specific listeners
          if (wsEvent.type in listenersRef.current) {
            const listeners = listenersRef.current[wsEvent.type as keyof typeof listenersRef.current];
            listeners.forEach((listener) => {
              listener(wsEvent.data as any);
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message', error);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket', error);
      setStatus('error');
    }
  }, [url, options, maxReconnectAttempts, reconnectInterval]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: object | string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(data);
      return true;
    }
    return false;
  }, []);

  // Subscribe to specific event types
  const subscribe = useCallback(<T extends EventType>(
    eventType: T, 
    callback: (data: T extends 'process_event' ? ProcessEvent :
                    T extends 'threat_alert' ? ThreatAlert :
                    T extends 'blockchain_log' ? BlockchainLog :
                    SystemStatus) => void
  ) => {
    listenersRef.current[eventType].push(callback as any);
    
    // Return unsubscribe function
    return () => {
      listenersRef.current[eventType] = listenersRef.current[eventType].filter(
        (listener) => listener !== callback
      ) as any;
    };
  }, []);

  return {
    status,
    events,
    lastEvent,
    sendMessage,
    subscribe,
    reconnect: connect
  };
}

/**
 * MockWebSocket class for development when a real backend is not available
 * This simulates the WebSocket server by generating random events
 */
export class MockWebSocketService {
  private static instance: MockWebSocketService;
  private subscribers: { [key: string]: ((data: any) => void)[] } = {};
  private intervalIds: ReturnType<typeof setInterval>[] = [];
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get the singleton instance
  public static getInstance(): MockWebSocketService {
    if (!MockWebSocketService.instance) {
      MockWebSocketService.instance = new MockWebSocketService();
    }
    return MockWebSocketService.instance;
  }
  
  // Start generating mock events
  public start() {
    this.startProcessEventSimulation();
    this.startThreatAlertSimulation();
    this.startBlockchainLogSimulation();
    this.startSystemStatusUpdates();
  }
  
  // Stop all simulations
  public stop() {
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
  }
  
  // Subscribe to specific event types
  public subscribe(eventType: EventType, callback: (data: any) => void) {
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    this.subscribers[eventType].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers[eventType] = this.subscribers[eventType].filter(cb => cb !== callback);
    };
  }
  
  // Notify all subscribers of an event
  private notify(eventType: EventType, data: any) {
    if (this.subscribers[eventType]) {
      this.subscribers[eventType].forEach(callback => {
        callback(data);
      });
    }
  }
  
  // Simulate process events
  private startProcessEventSimulation() {
    const processes = [
      { name: 'system.exe', path: 'C:\\Windows\\System32' },
      { name: 'browser.exe', path: 'C:\\Program Files\\Browser' },
      { name: 'explorer.exe', path: 'C:\\Windows' },
      { name: 'svchost.exe', path: 'C:\\Windows\\System32' },
      { name: 'suspicious_process.exe', path: 'C:\\Temp' },
    ];
    
    const interval = setInterval(() => {
      const process = processes[Math.floor(Math.random() * processes.length)];
      const isSuspicious = process.name === 'suspicious_process.exe';
      
      const event: ProcessEvent = {
        pid: Math.floor(Math.random() * 10000),
        name: process.name,
        cpu: isSuspicious ? 40 + Math.random() * 55 : Math.random() * 15,
        memory: isSuspicious ? 500 + Math.random() * 800 : 100 + Math.random() * 400,
        handles: Math.floor(Math.random() * 200),
        netIO: Math.floor(Math.random() * 10000),
        path: process.path,
        timestamp: new Date().toISOString(),
        anomalyScore: isSuspicious ? 0.75 + Math.random() * 0.25 : Math.random() * 0.2,
      };
      
      this.notify('process_event', event);
    }, 3000);
    
    this.intervalIds.push(interval);
  }
  
  // Simulate threat alerts
  private startThreatAlertSimulation() {
    const threats = [
      {
        description: 'Memory injection attempt detected',
        detectionMethod: 'behavioral',
        process: 'suspicious_process.exe',
        severity: 'high',
        indicators: ['Process memory manipulation', 'Suspicious API calls'],
        mitreAttack: 'T1055 - Process Injection'
      },
      {
        description: 'Unusual network connection attempt',
        detectionMethod: 'ai',
        process: 'svchost.exe',
        severity: 'medium',
        indicators: ['Connection to unknown IP', 'Non-standard port usage'],
        mitreAttack: 'T1571 - Non-Standard Port'
      },
      {
        description: 'Signature match: Known malware pattern',
        detectionMethod: 'yara',
        process: 'malware.exe',
        severity: 'critical',
        indicators: ['YARA rule match', 'Known malicious hash'],
        mitreAttack: 'T1059 - Command and Scripting Interpreter'
      }
    ];
    
    const interval = setInterval(() => {
      // Only generate threat alerts occasionally
      if (Math.random() > 0.7) {
        const threat = threats[Math.floor(Math.random() * threats.length)];
        
        const alert: ThreatAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: threat.severity as any,
          process: threat.process,
          pid: Math.floor(Math.random() * 10000),
          description: threat.description,
          detectionMethod: threat.detectionMethod as any,
          mitreAttack: threat.mitreAttack,
          timestamp: new Date().toISOString(),
          indicators: threat.indicators,
          containmentStatus: Math.random() > 0.5 ? 'contained' : 'pending',
          user: 'SYSTEM',
          ipfsHash: `Qm${Math.random().toString(36).substr(2, 44)}`
        };
        
        this.notify('threat_alert', alert);
      }
    }, 10000);
    
    this.intervalIds.push(interval);
  }
  
  // Simulate blockchain logs
  private startBlockchainLogSimulation() {
    const interval = setInterval(() => {
      // Only generate blockchain logs occasionally
      if (Math.random() > 0.8) {
        const log: BlockchainLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          txHash: `0x${Math.random().toString(36).substr(2, 64)}`,
          alertHash: `0x${Math.random().toString(36).substr(2, 64)}`,
          timestamp: new Date().toISOString(),
          blockHeight: 1000000 + Math.floor(Math.random() * 1000),
          status: Math.random() > 0.9 ? 'pending' : 'confirmed',
          merkleRoot: `0x${Math.random().toString(36).substr(2, 64)}`
        };
        
        this.notify('blockchain_log', log);
      }
    }, 15000);
    
    this.intervalIds.push(interval);
  }
  
  // Simulate system status updates
  private startSystemStatusUpdates() {
    const interval = setInterval(() => {
      const status: SystemStatus = {
        processesMonitored: 50 + Math.floor(Math.random() * 50),
        threatsDetected: Math.floor(Math.random() * 5),
        filesScanned: 500 + Math.floor(Math.random() * 500),
        quarantinedItems: Math.floor(Math.random() * 10),
        cpuUsage: 5 + Math.random() * 20,
        memoryUsage: 30 + Math.random() * 40,
        isLearningMode: Math.random() > 0.7,
        lastUpdateTimestamp: new Date().toISOString()
      };
      
      this.notify('system_status', status);
    }, 5000);
    
    this.intervalIds.push(interval);
  }
}

// Export the mock service
export const mockWebSocketService = MockWebSocketService.getInstance();
