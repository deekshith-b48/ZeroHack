'use client';

import { generateText, generateTextWithImages, TextGenerationResult } from '@/lib/api/util';

export interface PacketData {
  id: string;
  timestamp: Date;
  sourceIP: string;
  destinationIP: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  size: number;
  payload: Uint8Array;
  flags?: Record<string, boolean>;
  headers?: Record<string, string>;
}

export interface AnalysisResult {
  packetId: string;
  threatScore: number;
  classification: 'benign' | 'suspicious' | 'malicious';
  detectedLanguages?: DetectedLanguage[];
  detectedSteganography?: SteganographyResult[];
  protocolAnalysis?: ProtocolAnalysisResult;
  aiAnalysis?: string;
  confidence: number;
}

export interface DetectedLanguage {
  language: string;
  confidence: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  entities?: {
    text: string;
    type: string;
    sensitivity?: 'low' | 'medium' | 'high';
  }[];
}

export interface SteganographyResult {
  techniqueDetected: string;
  confidence: number;
  detectionLocation: string;
  extractedData?: string;
}

export interface ProtocolAnalysisResult {
  protocolName: string;
  version?: string;
  isValid: boolean;
  anomalies: string[];
  structuralAnalysis: Record<string, any>;
}

// Supported AI models for packet analysis
export type PacketAIModel = 
  | 'azure-gpt-4o' 
  | 'azure-gpt-4o-mini' 
  | 'gemini-1.5-pro' 
  | 'gemini-2.0-flash-exp'
  | 'claude-bedrock';

// Base protocol parser interface
export interface ProtocolParser {
  name: string;
  defaultPorts: number[];
  parse(packet: PacketData): ProtocolAnalysisResult;
  detectAnomalies(parsed: ProtocolAnalysisResult): string[];
}

/**
 * Analyzes packet payload for language content
 */
export async function analyzePayloadLanguage(
  payload: Uint8Array, 
  aiModel: PacketAIModel = 'azure-gpt-4o'
): Promise<DetectedLanguage[]> {
  try {
    // Convert binary payload to text (handling encoding issues)
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const payloadText = textDecoder.decode(payload);
    
    // Skip analysis for non-text or very short payloads
    if (!payloadText || payloadText.length < 10 || !isLikelyText(payloadText)) {
      return [];
    }

    // Truncate very large payloads
    const truncatedPayload = payloadText.length > 5000 
      ? payloadText.substring(0, 5000) + '... [truncated]' 
      : payloadText;

    const prompt = `
      Analyze the following text from network packet payload and identify:
      1. What languages are present? (Provide confidence score 0-100%)
      2. Any potential sensitive information like: credit cards, API keys, personal data
      3. Any potentially malicious content: code injection, commands, exploit patterns
      4. Overall threat assessment (0-100%)

      Packet payload text:
      \`\`\`
      ${truncatedPayload}
      \`\`\`

      Format your response in JSON:
      {
        "languages": [
          {"language": "English", "confidence": 95, "sentiment": "neutral"}
        ],
        "sensitiveData": [
          {"type": "API_KEY", "confidence": 85, "snippet": "..."}
        ],
        "maliciousContent": [
          {"type": "SQL_INJECTION", "confidence": 90, "snippet": "..."}
        ],
        "threatAssessment": 65
      }
    `;

    // Call AI API through the util wrapper
    const result = await generateText(prompt, aiModel);
    
    // Parse the JSON response
    try {
      const parsedResult = extractJSONFromAIResponse(result.text);
      
      // Map to our interface format
      return (parsedResult.languages || []).map((lang: any) => ({
        language: lang.language,
        confidence: lang.confidence / 100, // Convert to 0-1 scale
        sentiment: lang.sentiment,
        entities: [
          ...(parsedResult.sensitiveData || []).map((item: any) => ({
            text: item.snippet,
            type: item.type,
            sensitivity: 'high'
          })),
          ...(parsedResult.maliciousContent || []).map((item: any) => ({
            text: item.snippet,
            type: item.type,
            sensitivity: 'high'
          }))
        ]
      }));
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return [];
    }
  } catch (error) {
    console.error('Error in language analysis:', error);
    return [];
  }
}

/**
 * Analyzes binary data for potential steganography
 */
export async function detectSteganography(
  data: Uint8Array, 
  fileType: string,
  aiModel: PacketAIModel = 'gemini-1.5-pro'
): Promise<SteganographyResult[]> {
  // Skip non-media files
  if (!isMediaFile(fileType)) {
    return [];
  }

  // For image files, convert to base64 for AI processing
  if (isImageFile(fileType) && data.length > 0) {
    try {
      // Convert image to base64
      const base64Image = arrayBufferToBase64(data);
      
      // Prompt for the AI model
      const prompt = `
        Analyze this image for potential steganography. Look for:
        1. Unusual pixel patterns
        2. Color anomalies
        3. Unexpected metadata
        4. Signs of hidden data within the image
        
        Describe any suspicious elements that might indicate steganographic content.
      `;
      
      // Call the vision model
      const result = await generateTextWithImages(prompt, [`data:image/${fileType};base64,${base64Image}`], aiModel);

      // Process the AI response
      if (result.text.toLowerCase().includes('steganograph') || 
          result.text.toLowerCase().includes('hidden') || 
          result.text.toLowerCase().includes('concealed')) {
        
        return [{
          techniqueDetected: extractTechnique(result.text),
          confidence: calculateConfidence(result.text),
          detectionLocation: 'Image data',
          extractedData: extractMentionedData(result.text)
        }];
      }
    } catch (error) {
      console.error('Error in steganography analysis:', error);
    }
  }

  // Basic statistical analysis for all file types
  const entropyResult = calculateShannonEntropy(data);
  if (entropyResult.isAnomaly) {
    return [{
      techniqueDetected: 'Unusual entropy distribution',
      confidence: entropyResult.confidence,
      detectionLocation: 'Full file',
      extractedData: undefined
    }];
  }

  return [];
}

/**
 * Parses packets according to specific protocols
 */
export function parseProtocol(packet: PacketData): ProtocolAnalysisResult {
  // Determine which protocol parser to use
  const parser = getProtocolParser(packet.protocol, packet.destinationPort);
  
  if (parser) {
    return parser.parse(packet);
  }
  
  // Default basic analysis if no specific parser available
  return {
    protocolName: packet.protocol,
    isValid: true,
    anomalies: [],
    structuralAnalysis: {
      size: packet.size,
      headers: packet.headers || {},
      flags: packet.flags || {}
    }
  };
}

/**
 * Performs AI-powered analysis on a packet
 */
export async function analyzePacketWithAI(
  packet: PacketData, 
  aiModel: PacketAIModel = 'azure-gpt-4o'
): Promise<AnalysisResult> {
  // Get language analysis
  const languageResults = await analyzePayloadLanguage(packet.payload, aiModel);
  
  // Determine file type for steganography detection
  const fileType = determineFileType(packet.payload);
  const stegResults = await detectSteganography(packet.payload, fileType, aiModel);
  
  // Parse protocol
  const protocolResults = parseProtocol(packet);
  
  // Calculate threat score based on combined analyses
  let threatScore = 0;
  
  // Add points for language detection findings
  languageResults.forEach(lang => {
    if (lang.entities?.some(e => e.sensitivity === 'high')) {
      threatScore += 30;
    }
  });
  
  // Add points for steganography findings
  stegResults.forEach(steg => {
    threatScore += steg.confidence * 50; // Scale 0-50 points based on confidence
  });
  
  // Add points for protocol anomalies
  threatScore += protocolResults.anomalies.length * 15;
  
  // Determine classification based on threat score
  let classification: 'benign' | 'suspicious' | 'malicious' = 'benign';
  if (threatScore > 70) classification = 'malicious';
  else if (threatScore > 30) classification = 'suspicious';
  
  return {
    packetId: packet.id,
    threatScore: Math.min(threatScore, 100), // Cap at 100
    classification,
    detectedLanguages: languageResults,
    detectedSteganography: stegResults,
    protocolAnalysis: protocolResults,
    confidence: 0.75 // Base confidence level
  };
}

// Helper functions

function isLikelyText(str: string): boolean {
  // Check if string is likely to be human-readable text
  const textChars = str.replace(/[^\x20-\x7E]/g, '').length;
  return textChars / str.length > 0.7; // If >70% printable ASCII
}

function isMediaFile(fileType: string): boolean {
  const mediaTypes = ['image', 'video', 'audio'];
  return mediaTypes.some(type => fileType.startsWith(type));
}

function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface EntropyResult {
  entropy: number;
  isAnomaly: boolean;
  confidence: number;
}

function calculateShannonEntropy(data: Uint8Array): EntropyResult {
  // Count byte frequency
  const frequencies = new Array(256).fill(0);
  for (const byte of data) {
    frequencies[byte]++;
  }
  
  // Calculate entropy
  let entropy = 0;
  const length = data.length;
  
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / length;
      entropy -= p * Math.log2(p);
    }
  }
  
  // Randomized data (like encrypted or compressed) has entropy close to 8
  // Plain text typically has entropy between 4-6
  // Determine if entropy indicates potential hidden data
  const isAnomaly = (entropy > 7.8) || (entropy < 3.0 && length > 50);
  const confidence = isAnomaly 
    ? (entropy > 7.8 ? 0.8 : 0.6)  // High or low entropy anomaly
    : 0.2;  // No anomaly
  
  return { entropy, isAnomaly, confidence };
}

function extractTechnique(aiResponse: string): string {
  const techniques = [
    'LSB (Least Significant Bit)',
    'DCT (Discrete Cosine Transform)',
    'Pixel Value Differencing',
    'Echo Hiding',
    'Spread Spectrum',
    'Palette-Based'
  ];
  
  // Try to extract the technique from AI response
  for (const technique of techniques) {
    if (aiResponse.toLowerCase().includes(technique.toLowerCase())) {
      return technique;
    }
  }
  
  // Default response if no technique is identified
  return 'Unknown steganographic technique';
}

function calculateConfidence(aiResponse: string): number {
  // Analyze the AI's response to estimate confidence
  const highConfidenceWords = ['definitely', 'clearly', 'obvious', 'evident', 'certainly'];
  const mediumConfidenceWords = ['likely', 'probably', 'appears', 'suggests', 'indicates'];
  const lowConfidenceWords = ['possibly', 'might', 'could', 'perhaps', 'potential'];
  
  let confidenceScore = 0.5; // Default medium confidence
  
  // Check for confidence indicators in the text
  for (const word of highConfidenceWords) {
    if (aiResponse.toLowerCase().includes(word)) {
      confidenceScore = Math.min(confidenceScore + 0.15, 0.95);
    }
  }
  
  for (const word of mediumConfidenceWords) {
    if (aiResponse.toLowerCase().includes(word)) {
      confidenceScore = Math.min(confidenceScore + 0.05, 0.8);
    }
  }
  
  for (const word of lowConfidenceWords) {
    if (aiResponse.toLowerCase().includes(word)) {
      confidenceScore = Math.max(confidenceScore - 0.1, 0.3);
    }
  }
  
  return confidenceScore;
}

function extractMentionedData(aiResponse: string): string | undefined {
  // Look for mentions of extracted data
  if (aiResponse.toLowerCase().includes('extracted') || 
      aiResponse.toLowerCase().includes('hidden text') || 
      aiResponse.toLowerCase().includes('concealed message')) {
    
    // Try to extract what was found
    const dataMatch = aiResponse.match(/["']([^"']+)["']/) || 
                      aiResponse.match(/text[:\s]+([^.]+)/i);
    
    if (dataMatch && dataMatch[1]) {
      return dataMatch[1].trim();
    }
  }
  
  return undefined;
}

function getProtocolParser(protocol: string, port: number): ProtocolParser | null {
  // This would be expanded with actual protocol parsers
  const availableParsers: Record<string, ProtocolParser> = {
    'HTTP': new HTTPProtocolParser(),
    'DNS': new DNSProtocolParser(),
    'SMTP': new SMTPProtocolParser(),
    'FTP': new FTPProtocolParser()
  };
  
  // Try to match by protocol name
  if (protocol && availableParsers[protocol.toUpperCase()]) {
    return availableParsers[protocol.toUpperCase()];
  }
  
  // Try to match by port number
  for (const parserKey in availableParsers) {
    if (availableParsers[parserKey].defaultPorts.includes(port)) {
      return availableParsers[parserKey];
    }
  }
  
  return null;
}

function extractJSONFromAIResponse(text: string): any {
  try {
    // First try to parse the entire response as JSON
    return JSON.parse(text);
  } catch (e) {
    // If that fails, try to extract JSON using regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON:', innerError);
      }
    }
    
    // Return empty object if all parsing fails
    return {};
  }
}

function determineFileType(data: Uint8Array): string {
  // Basic file type detection based on magic bytes
  if (data.length < 4) return 'application/octet-stream';
  
  // Check for common image formats
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }
  
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return 'image/gif';
  }
  
  // Check for common document formats
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
    return 'application/pdf';
  }
  
  // Default unknown binary
  return 'application/octet-stream';
}

// Protocol Parser Implementations

class HTTPProtocolParser implements ProtocolParser {
  name = 'HTTP';
  defaultPorts = [80, 8080, 443, 8443];
  
  parse(packet: PacketData): ProtocolAnalysisResult {
    // Convert payload to string for HTTP parsing
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const payloadText = textDecoder.decode(packet.payload);
    
    // Basic HTTP request/response validation
    const isHTTPRequest = payloadText.match(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) .+ HTTP\/\d\.\d/);
    const isHTTPResponse = payloadText.match(/^HTTP\/\d\.\d \d{3} .+/);
    const isValid = !!isHTTPRequest || !!isHTTPResponse;
    
    // Extract headers
    const headers: Record<string, string> = {};
    const headerLines = payloadText.split('\r\n');
    for (let i = 1; i < headerLines.length; i++) {
      const line = headerLines[i];
      if (!line || line === '') break;
      
      const separatorIndex = line.indexOf(':');
      if (separatorIndex > 0) {
        const key = line.substring(0, separatorIndex).trim();
        const value = line.substring(separatorIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    // Check for anomalies
    const anomalies = this.detectAnomalies({
      protocolName: 'HTTP',
      isValid,
      anomalies: [],
      structuralAnalysis: { headers }
    });
    
    return {
      protocolName: 'HTTP',
      version: this.extractHTTPVersion(payloadText),
      isValid,
      anomalies,
      structuralAnalysis: {
        method: this.extractHTTPMethod(payloadText),
        path: this.extractHTTPPath(payloadText),
        statusCode: this.extractHTTPStatusCode(payloadText),
        headers
      }
    };
  }
  
  detectAnomalies(parsed: ProtocolAnalysisResult): string[] {
    const anomalies: string[] = [];
    const analysis = parsed.structuralAnalysis;
    
    if (!parsed.isValid) {
      anomalies.push('Invalid HTTP format');
    }
    
    // Check for suspicious headers
    const headers = analysis.headers || {};
    
    // Unusual User-Agent
    if (headers['User-Agent'] && (
        headers['User-Agent'].includes('curl') ||
        headers['User-Agent'].includes('python') ||
        headers['User-Agent'].includes('wget') ||
        headers['User-Agent'].length < 10)) {
      anomalies.push('Suspicious User-Agent');
    }
    
    // Check for SQL injection in path
    if (analysis.path && (
        analysis.path.includes('--') || 
        analysis.path.includes('=\'') || 
        analysis.path.includes('="') || 
        analysis.path.includes(' OR ') || 
        analysis.path.includes(' AND '))) {
      anomalies.push('Potential SQL injection in URL');
    }
    
    // Check for potential XSS
    if (analysis.path && (
        analysis.path.includes('<script>') || 
        analysis.path.includes('javascript:') || 
        analysis.path.includes('onerror='))) {
      anomalies.push('Potential XSS in URL');
    }
    
    return anomalies;
  }
  
  private extractHTTPVersion(payload: string): string | undefined {
    const match = payload.match(/HTTP\/(\d\.\d)/);
    return match ? match[1] : undefined;
  }
  
  private extractHTTPMethod(payload: string): string | undefined {
    const match = payload.match(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) /);
    return match ? match[1] : undefined;
  }
  
  private extractHTTPPath(payload: string): string | undefined {
    const match = payload.match(/^(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) (.+) HTTP\/\d\.\d/);
    return match ? match[1] : undefined;
  }
  
  private extractHTTPStatusCode(payload: string): number | undefined {
    const match = payload.match(/^HTTP\/\d\.\d (\d{3})/);
    return match ? parseInt(match[1]) : undefined;
  }
}

class DNSProtocolParser implements ProtocolParser {
  name = 'DNS';
  defaultPorts = [53];
  
  parse(packet: PacketData): ProtocolAnalysisResult {
    // Parse DNS packet
    // This is a simplified implementation - real DNS parsing is more complex
    const view = new DataView(packet.payload.buffer);
    
    try {
      // Basic DNS header validation
      const id = view.getUint16(0);
      const flags = view.getUint16(2);
      const qdcount = view.getUint16(4); // question count
      const ancount = view.getUint16(6); // answer count
      
      const isResponse = (flags & 0x8000) !== 0;
      const opcode = (flags & 0x7800) >> 11;
      const rcode = flags & 0x000F; // response code
      
      const structuralAnalysis = {
        id,
        isResponse,
        opcode,
        rcode,
        questionCount: qdcount,
        answerCount: ancount,
        query: this.extractDNSQuery(packet.payload)
      };
      
      const anomalies = this.detectAnomalies({
        protocolName: 'DNS',
        isValid: true,
        anomalies: [],
        structuralAnalysis
      });
      
      return {
        protocolName: 'DNS',
        isValid: true,
        anomalies,
        structuralAnalysis
      };
    } catch (error) {
      return {
        protocolName: 'DNS',
        isValid: false,
        anomalies: ['Invalid DNS packet format'],
        structuralAnalysis: {}
      };
    }
  }
  
  detectAnomalies(parsed: ProtocolAnalysisResult): string[] {
    const anomalies: string[] = [];
    const analysis = parsed.structuralAnalysis;
    
    // Check for DNS tunneling (unusually long domain name)
    if (analysis.query && analysis.query.length > 50) {
      anomalies.push('Potential DNS tunneling (unusually long domain)');
    }
    
    // Check for DNS exfiltration (many subdomains)
    if (analysis.query && (analysis.query.match(/\./g) || []).length > 5) {
      anomalies.push('Potential data exfiltration (excessive subdomains)');
    }
    
    // Check for hex-encoded domains (potential DGA - Domain Generation Algorithm)
    if (analysis.query && /^[a-f0-9]{10,}\./.test(analysis.query)) {
      anomalies.push('Potential DGA (hex-encoded domain)');
    }
    
    return anomalies;
  }
  
  private extractDNSQuery(payload: Uint8Array): string {
    // Simple extraction of the first domain name in a DNS query
    // This is a very simplified implementation
    try {
      let pos = 12; // Skip DNS header
      let labels = [];
      
      while (pos < payload.length) {
        const labelLength = payload[pos];
        if (labelLength === 0) break; // End of domain name
        
        pos++;
        const label = new TextDecoder().decode(
          payload.slice(pos, pos + labelLength)
        );
        labels.push(label);
        pos += labelLength;
      }
      
      return labels.join('.');
    } catch (error) {
      return '';
    }
  }
}

class SMTPProtocolParser implements ProtocolParser {
  name = 'SMTP';
  defaultPorts = [25, 587, 465];
  
  parse(packet: PacketData): ProtocolAnalysisResult {
    // Convert payload to string for SMTP parsing
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const payloadText = textDecoder.decode(packet.payload);
    
    // Check if this looks like SMTP
    const isSMTP = payloadText.match(/^(HELO|EHLO|MAIL FROM|RCPT TO|DATA|QUIT|250|220|354|550)/i);
    
    // Extract command or response
    let command = '';
    let parameter = '';
    let responseCode = 0;
    let isResponse = false;
    
    const firstLine = payloadText.split('\r\n')[0] || '';
    
    if (/^\d{3}/.test(firstLine)) {
      // This is a response
      isResponse = true;
      responseCode = parseInt(firstLine.substring(0, 3));
    } else {
      // This is a command
      const match = firstLine.match(/^(\w+)(?:\s+(.+))?$/);
      if (match) {
        command = match[1] || '';
        parameter = match[2] || '';
      }
    }
    
    const structuralAnalysis = {
      isResponse,
      command,
      parameter,
      responseCode,
      fullText: payloadText
    };
    
    const anomalies = this.detectAnomalies({
      protocolName: 'SMTP',
      isValid: !!isSMTP,
      anomalies: [],
      structuralAnalysis
    });
    
    return {
      protocolName: 'SMTP',
      isValid: !!isSMTP,
      anomalies,
      structuralAnalysis
    };
  }
  
  detectAnomalies(parsed: ProtocolAnalysisResult): string[] {
    const anomalies: string[] = [];
    const analysis = parsed.structuralAnalysis;
    
    if (!parsed.isValid) {
      anomalies.push('Invalid SMTP format');
    }
    
    // Check for command injection in MAIL FROM or RCPT TO
    if (analysis.command === 'MAIL' && analysis.parameter.includes('|')) {
      anomalies.push('Potential command injection in MAIL FROM');
    }
    
    if (analysis.command === 'RCPT' && analysis.parameter.includes('|')) {
      anomalies.push('Potential command injection in RCPT TO');
    }
    
    // Check for unusually large DATA
    if (analysis.command === 'DATA' && analysis.fullText.length > 1000000) {
      anomalies.push('Unusually large email data');
    }
    
    // Check for base64 encoded content (potential hidden payload)
    if (analysis.fullText.includes('Content-Transfer-Encoding: base64')) {
      const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/;
      if (base64Pattern.test(analysis.fullText)) {
        anomalies.push('Base64 encoded content detected');
      }
    }
    
    return anomalies;
  }
}

class FTPProtocolParser implements ProtocolParser {
  name = 'FTP';
  defaultPorts = [20, 21];
  
  parse(packet: PacketData): ProtocolAnalysisResult {
    // Convert payload to string for FTP parsing
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const payloadText = textDecoder.decode(packet.payload);
    
    // Check if this looks like FTP
    const isFTPCommand = payloadText.match(/^(USER|PASS|PORT|RETR|STOR|LIST|QUIT|CWD|PWD)/i);
    const isFTPResponse = payloadText.match(/^(\d{3})(?:[\s-])/);
    
    // Extract command or response
    let command = '';
    let parameter = '';
    let responseCode = 0;
    let isResponse = false;
    
    if (isFTPResponse) {
      isResponse = true;
      responseCode = parseInt(isFTPResponse[1]);
    } else if (isFTPCommand) {
      const match = payloadText.match(/^(\w+)(?:\s+(.+))?$/);
      if (match) {
        command = match[1] || '';
        parameter = match[2] || '';
      }
    }
    
    const structuralAnalysis = {
      isResponse,
      command,
      parameter,
      responseCode,
      fullText: payloadText
    };
    
    const anomalies = this.detectAnomalies({
      protocolName: 'FTP',
      isValid: !!(isFTPCommand || isFTPResponse),
      anomalies: [],
      structuralAnalysis
    });
    
    return {
      protocolName: 'FTP',
      isValid: !!(isFTPCommand || isFTPResponse),
      anomalies,
      structuralAnalysis
    };
  }
  
  detectAnomalies(parsed: ProtocolAnalysisResult): string[] {
    const anomalies: string[] = [];
    const analysis = parsed.structuralAnalysis;
    
    if (!parsed.isValid) {
      anomalies.push('Invalid FTP format');
    }
    
    // Check for anonymous login
    if (analysis.command === 'USER' && analysis.parameter.toLowerCase() === 'anonymous') {
      anomalies.push('Anonymous FTP login attempt');
    }
    
    // Check for password in cleartext
    if (analysis.command === 'PASS') {
      anomalies.push('Cleartext password transmission');
    }
    
    // Check for sensitive commands
    if (['DELE', 'RMD', 'MKD'].includes(analysis.command)) {
      anomalies.push(`Sensitive FTP command: ${analysis.command}`);
    }
    
    // Check for path traversal
    if (analysis.parameter && analysis.parameter.includes('../')) {
      anomalies.push('Potential path traversal attack');
    }
    
    return anomalies;
  }
}
