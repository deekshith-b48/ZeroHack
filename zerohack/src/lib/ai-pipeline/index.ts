'use client';

import { generateText, generateTextWithImages } from '@/lib/api/util';

// AI Model types
export type AIModel = 
  | 'azure-gpt-4o' 
  | 'azure-gpt-4o-mini' 
  | 'gemini-1.5-pro' 
  | 'gemini-2.0-flash-exp'
  | 'claude-bedrock'
  | 'deepseek-r1'
  | 'deepseek-v3'
  | 'azure-gpt-4o-o1';

// Pipeline component types
export type PipelineComponent = 'text' | 'image' | 'network';

// Detection result interface
export interface DetectionResult {
  threatDetected: boolean;
  confidence: number;
  threatType?: string;
  explanation?: string;
  shapValues?: ShapExplanation;
  rawOutput?: any;
}

// SHAP explanation interface
export interface ShapExplanation {
  baseValue: number;
  features: Array<{
    name: string;
    value: number;
    importance: number;
  }>;
}

// Pipeline configuration
export interface PipelineConfig {
  textModel: AIModel;
  imageModel: AIModel;
  networkModel: AIModel;
  useGPU: boolean;
  confidenceThreshold: number;
  generateExplanations: boolean;
}

// Default pipeline configuration
export const defaultPipelineConfig: PipelineConfig = {
  textModel: 'azure-gpt-4o',
  imageModel: 'gemini-1.5-pro',
  networkModel: 'azure-gpt-4o',
  useGPU: true,
  confidenceThreshold: 0.7,
  generateExplanations: true
};

/**
 * Main AI Threat Detection Pipeline
 * Orchestrates the detection process across multiple AI models
 */
export class ThreatDetectionPipeline {
  private config: PipelineConfig;
  private onnxAccelerated: boolean = false;
  private pipelineReady: boolean = false;
  private lastPerformanceMetrics: {
    textAnalysisTime?: number;
    imageAnalysisTime?: number;
    networkAnalysisTime?: number;
    totalTime?: number;
  } = {};

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...defaultPipelineConfig, ...config };
    this.initializePipeline();
  }

  /**
   * Initialize the pipeline components and ONNX runtime
   */
  private async initializePipeline(): Promise<void> {
    try {
      // Simulate ONNX Runtime initialization
      console.log('Initializing ONNX Runtime with GPU acceleration:', this.config.useGPU);
      
      // In a real implementation, we would initialize ONNX Runtime here
      // For this demo, we'll simulate the initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.onnxAccelerated = this.config.useGPU;
      this.pipelineReady = true;
      
      console.log('AI Threat Detection Pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Threat Detection Pipeline:', error);
      this.onnxAccelerated = false;
      this.pipelineReady = false;
    }
  }

  /**
   * Check if the pipeline is ready for detection
   */
  public isReady(): boolean {
    return this.pipelineReady;
  }

  /**
   * Get the last performance metrics
   */
  public getPerformanceMetrics() {
    return { ...this.lastPerformanceMetrics };
  }

  /**
   * Update pipeline configuration
   */
  public updateConfig(newConfig: Partial<PipelineConfig>): void {
    const prevGPU = this.config.useGPU;
    this.config = { ...this.config, ...newConfig };
    
    // Re-initialize if GPU setting changed
    if (prevGPU !== this.config.useGPU) {
      this.initializePipeline();
    }
  }

  /**
   * Analyze text content using CodeBERT via the selected AI model
   */
  public async analyzeText(text: string): Promise<DetectionResult> {
    if (!this.pipelineReady) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = performance.now();
    
    try {
      // Construct a prompt that instructs the AI to analyze text using CodeBERT approach
      const prompt = `
You are an advanced CodeBERT-based threat detection system. Analyze the following text for potential security threats:

TEXT TO ANALYZE:
"""
${text}
"""

Perform the following analysis:
1. Identify any malicious code patterns, commands, or scripts
2. Detect potential SQL injection, XSS, or command injection attempts
3. Identify suspicious URLs, IP addresses, or domains
4. Look for encoded/obfuscated content that might hide malicious intent
5. Detect potential data exfiltration patterns

Respond with a JSON object in this exact format:
{
  "threatDetected": boolean,
  "confidence": number (0-1),
  "threatType": string (if threat detected),
  "explanation": string (detailed explanation),
  "shapValues": {
    "baseValue": 0.5,
    "features": [
      {"name": "feature name", "value": number, "importance": number (0-1)},
      ...
    ]
  }
}
`;

      // Call the AI model through the util.ts proxy
      const result = await generateText(prompt, this.config.textModel);
      
      // Parse the JSON response
      let parsedResult: DetectionResult;
      try {
        // Extract JSON from the response text
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback response if parsing fails
        parsedResult = {
          threatDetected: false,
          confidence: 0.1,
          explanation: 'Failed to parse AI response'
        };
      }

      const endTime = performance.now();
      this.lastPerformanceMetrics.textAnalysisTime = endTime - startTime;
      
      return parsedResult;
    } catch (error) {
      console.error('Text analysis error:', error);
      const endTime = performance.now();
      this.lastPerformanceMetrics.textAnalysisTime = endTime - startTime;
      
      return {
        threatDetected: false,
        confidence: 0,
        explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Analyze image content for steganography using CNN via the selected AI model
   */
  public async analyzeImage(imageBase64: string): Promise<DetectionResult> {
    if (!this.pipelineReady) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = performance.now();
    
    try {
      // Ensure the image is properly formatted for the API
      const formattedImage = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;
      
      // Construct a prompt that instructs the AI to analyze the image using CNN approach
      const prompt = `
You are an advanced CNN-based steganography detection system. Analyze the provided image for hidden content or steganography:

Perform the following analysis:
1. Look for unusual pixel patterns or statistical anomalies
2. Detect LSB (Least Significant Bit) steganography
3. Identify DCT coefficient manipulation in JPEG images
4. Check for unusual color patterns or distributions
5. Analyze entropy and other statistical properties

Respond with a JSON object in this exact format:
{
  "threatDetected": boolean,
  "confidence": number (0-1),
  "threatType": string (if threat detected),
  "explanation": string (detailed explanation),
  "shapValues": {
    "baseValue": 0.5,
    "features": [
      {"name": "feature name", "value": number, "importance": number (0-1)},
      ...
    ]
  }
}
`;

      // Call the AI model through the util.ts proxy with image
      const result = await generateTextWithImages(prompt, [formattedImage], this.config.imageModel);
      
      // Parse the JSON response
      let parsedResult: DetectionResult;
      try {
        // Extract JSON from the response text
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback response if parsing fails
        parsedResult = {
          threatDetected: false,
          confidence: 0.1,
          explanation: 'Failed to parse AI response'
        };
      }

      const endTime = performance.now();
      this.lastPerformanceMetrics.imageAnalysisTime = endTime - startTime;
      
      return parsedResult;
    } catch (error) {
      console.error('Image analysis error:', error);
      const endTime = performance.now();
      this.lastPerformanceMetrics.imageAnalysisTime = endTime - startTime;
      
      return {
        threatDetected: false,
        confidence: 0,
        explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Analyze network traffic patterns using LSTM-autoencoder via the selected AI model
   */
  public async analyzeNetworkTraffic(networkData: any): Promise<DetectionResult> {
    if (!this.pipelineReady) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = performance.now();
    
    try {
      // Convert network data to string representation for the AI model
      const networkDataString = JSON.stringify(networkData);
      
      // Construct a prompt that instructs the AI to analyze network data using LSTM-autoencoder approach
      const prompt = `
You are an advanced LSTM-autoencoder network anomaly detection system. Analyze the following network traffic data for potential security threats:

NETWORK DATA:
"""
${networkDataString}
"""

Perform the following analysis:
1. Identify unusual traffic patterns or anomalies
2. Detect potential DDoS, port scanning, or brute force attempts
3. Identify command and control (C2) communication patterns
4. Look for data exfiltration signatures
5. Detect beaconing or other suspicious connection patterns

Respond with a JSON object in this exact format:
{
  "threatDetected": boolean,
  "confidence": number (0-1),
  "threatType": string (if threat detected),
  "explanation": string (detailed explanation),
  "shapValues": {
    "baseValue": 0.5,
    "features": [
      {"name": "feature name", "value": number, "importance": number (0-1)},
      ...
    ]
  }
}
`;

      // Call the AI model through the util.ts proxy
      const result = await generateText(prompt, this.config.networkModel);
      
      // Parse the JSON response
      let parsedResult: DetectionResult;
      try {
        // Extract JSON from the response text
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback response if parsing fails
        parsedResult = {
          threatDetected: false,
          confidence: 0.1,
          explanation: 'Failed to parse AI response'
        };
      }

      const endTime = performance.now();
      this.lastPerformanceMetrics.networkAnalysisTime = endTime - startTime;
      
      return parsedResult;
    } catch (error) {
      console.error('Network analysis error:', error);
      const endTime = performance.now();
      this.lastPerformanceMetrics.networkAnalysisTime = endTime - startTime;
      
      return {
        threatDetected: false,
        confidence: 0,
        explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Run the full pipeline on a data object containing text, image, and/or network data
   */
  public async analyzeAll(data: {
    text?: string;
    image?: string;
    networkData?: any;
  }): Promise<Record<PipelineComponent, DetectionResult | null>> {
    const startTime = performance.now();
    
    const results: Record<PipelineComponent, DetectionResult | null> = {
      text: null,
      image: null,
      network: null
    };
    
    // Run analyses in parallel for better performance
    const promises: Promise<void>[] = [];
    
    if (data.text) {
      promises.push(
        this.analyzeText(data.text)
          .then(result => { results.text = result; })
          .catch(error => {
            console.error('Text analysis failed:', error);
            results.text = {
              threatDetected: false,
              confidence: 0,
              explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
            };
          })
      );
    }
    
    if (data.image) {
      promises.push(
        this.analyzeImage(data.image)
          .then(result => { results.image = result; })
          .catch(error => {
            console.error('Image analysis failed:', error);
            results.image = {
              threatDetected: false,
              confidence: 0,
              explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
            };
          })
      );
    }
    
    if (data.networkData) {
      promises.push(
        this.analyzeNetworkTraffic(data.networkData)
          .then(result => { results.network = result; })
          .catch(error => {
            console.error('Network analysis failed:', error);
            results.network = {
              threatDetected: false,
              confidence: 0,
              explanation: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
            };
          })
      );
    }
    
    // Wait for all analyses to complete
    await Promise.all(promises);
    
    const endTime = performance.now();
    this.lastPerformanceMetrics.totalTime = endTime - startTime;
    
    return results;
  }
}

// Export a singleton instance for easy access
export const threatDetectionPipeline = new ThreatDetectionPipeline();
