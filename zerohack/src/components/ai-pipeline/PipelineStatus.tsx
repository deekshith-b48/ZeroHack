'use client';

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Cpu, 
  Gauge, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Image as ImageIcon, 
  Network, 
  RefreshCw,
  BarChart3,
  Zap,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  ThreatDetectionPipeline, 
  PipelineConfig, 
  defaultPipelineConfig,
  AIModel,
  DetectionResult,
  PipelineComponent
} from '@/lib/ai-pipeline';

// Configuration for API endpoint
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze`;

interface PipelineStatusProps {
  initialConfig?: Partial<PipelineConfig>;
}

export function PipelineStatus({ initialConfig = {} }: PipelineStatusProps) {
  const [pipeline] = useState(() => new ThreatDetectionPipeline(initialConfig));
  const [config, setConfig] = useState<PipelineConfig>({ ...defaultPipelineConfig, ...initialConfig });
  const [isReady, setIsReady] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'network'>('text');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<Record<PipelineComponent, DetectionResult | null>>({
    text: null,
    image: null,
    network: null
  });
  
  // Sample data for testing
  const [textInput, setTextInput] = useState<string>('');
  const [imageInput, setImageInput] = useState<string>('');
  const [networkInput, setNetworkInput] = useState<string>('');
  
  // Check if pipeline is ready
  useEffect(() => {
    const checkPipeline = () => {
      setIsReady(pipeline.isReady());
      if (pipeline.isReady()) {
        setPerformanceMetrics(pipeline.getPerformanceMetrics());
      } else {
        setTimeout(checkPipeline, 500);
      }
    };
    
    checkPipeline();
  }, [pipeline]);
  
  // Update pipeline config when config changes
  useEffect(() => {
    pipeline.updateConfig(config);
  }, [config, pipeline]);
  
  // Handle config changes
  const handleConfigChange = (key: keyof PipelineConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };
  
  // Handle model selection
  const handleModelChange = (component: 'textModel' | 'imageModel' | 'networkModel', model: AIModel) => {
    handleConfigChange(component, model);
  };
  
  // Handle file upload for image analysis
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageInput(base64);
    };
    reader.readAsDataURL(file);
  };
  
  // Run analysis based on active tab
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      let result: Record<PipelineComponent, DetectionResult | null> = {
        text: null,
        image: null,
        network: null
      };
      
      switch (activeTab) {
        case 'text':
          if (textInput) {
            result.text = await pipeline.analyzeText(textInput);
          }
          break;
        case 'image':
          if (imageInput) {
            result.image = await pipeline.analyzeImage(imageInput);
          }
          break;
        case 'network':
          if (networkInput) {
            const networkData = JSON.parse(networkInput);
            result.network = await pipeline.analyzeNetworkTraffic(networkData);
          }
          break;
      }
      
      setResults(prev => ({ ...prev, ...result }));
      setPerformanceMetrics(pipeline.getPerformanceMetrics());
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Analyze traffic by sending it to the backend pipeline
  const analyzeTraffic = async () => {
    setIsAnalyzing(true);
    
    try {
      // The backend expects a list of traffic events.
      // We will construct a single event from the available network data.
      // This is a simplified mapping.
      if (!networkInput) {
        console.warn("No network data to analyze.");
        setIsAnalyzing(false);
        return;
      }
      
      const networkData = JSON.parse(networkInput);
      const event = {
        timestamp: new Date().toISOString(),
        source_ip: networkData.source_ip || "N/A",
        dest_ip: networkData.destination_ip || "N/A",
        dest_port: networkData.destination_port || 0,
        ...networkData // Pass all other fields from the network input
      };

      const response = await fetch(ANALYZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [event] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Backend Analysis Result:", result);

      // We need a state to hold this backend result to display it.
      // For now, we'll just log it. A new state `[backendAnalysis, setBackendAnalysis]` would be needed.
      // Example of mapping it to the existing `results` state for partial display:
      const threatDetected = result.final_verdict === 'THREAT';
      const explanation = result.explanation_summary;
      const confidence = result.confidence;

      setResults(prev => ({
        ...prev,
        network: { // Update the network result tab with backend data
          threatDetected,
          threatType: threatDetected ? result.layer_outputs.find(l => l.rule_id)?.rule_id || 'Aggregated Threat' : 'N/A',
          confidence,
          explanation,
          shapValues: null // SHAP values are not returned by this API structure
        }
      }));

    } catch (error) {
      console.error('Backend analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Generate sample data for testing
  const generateSampleData = () => {
    switch (activeTab) {
      case 'text':
        setTextInput(`SELECT * FROM users WHERE username = 'admin' OR 1=1; --' AND password = 'anything'`);
        break;
      case 'image':
        // Use a placeholder image URL
        fetch('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=500')
          .then(response => response.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onload = () => {
              setImageInput(reader.result as string);
            };
            reader.readAsDataURL(blob);
          });
        break;
      case 'network':
        setNetworkInput(JSON.stringify({
          source_ip: "192.168.1.100",
          destination_ip: "203.0.113.1",
          source_port: 49152,
          destination_port: 80,
          protocol: "TCP",
          bytes_sent: 1024,
          bytes_received: 8192,
          duration_ms: 350,
          packets_sent: 12,
          packets_received: 8,
          http_method: "POST",
          http_path: "/admin/login",
          http_user_agent: "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)",
          connection_count: 120,
          connection_rate: 15
        }, null, 2));
        break;
    }
  };
  
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-lg">
      <div className="bg-zinc-800 p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center">
          <Brain className="text-emerald-500 mr-2" size={24} />
          <div>
            <h2 className="text-xl font-bold">AI Threat Detection Pipeline</h2>
            <p className="text-sm text-zinc-400">Multi-stage detection with ONNX acceleration</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-zinc-900 px-3 py-1 rounded-full">
            <Cpu className="text-emerald-500 mr-2" size={16} />
            <span className="text-xs">
              {config.useGPU ? 'GPU Accelerated' : 'CPU Mode'}
            </span>
          </div>
          
          <div className="flex items-center bg-zinc-900 px-3 py-1 rounded-full">
            <Gauge className="text-emerald-500 mr-2" size={16} />
            <span className="text-xs">
              {isReady ? 'Pipeline Ready' : 'Initializing...'}
            </span>
          </div>
          
          <button 
            className="bg-zinc-700 hover:bg-zinc-600 p-2 rounded-full"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
      
      {/* Configuration Panel */}
      {isConfigOpen && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-zinc-800 border-b border-zinc-700 p-4"
        >
          <h3 className="text-lg font-medium mb-4">Pipeline Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-zinc-300 flex items-center">
                <FileText size={16} className="mr-2 text-blue-400" />
                Text Analysis (CodeBERT)
              </h4>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Model</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={config.textModel}
                  onChange={(e) => handleModelChange('textModel', e.target.value as AIModel)}
                >
                  <option value="azure-gpt-4o">Azure GPT-4o</option>
                  <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                  <option value="claude-bedrock">Claude</option>
                  <option value="deepseek-r1">Deepseek R1</option>
                  <option value="deepseek-v3">Deepseek V3</option>
                  <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-zinc-300 flex items-center">
                <ImageIcon size={16} className="mr-2 text-purple-400" />
                Image Analysis (CNN)
              </h4>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Model</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={config.imageModel}
                  onChange={(e) => handleModelChange('imageModel', e.target.value as AIModel)}
                >
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                  <option value="claude-bedrock">Claude</option>
                  <option value="azure-gpt-4o">Azure GPT-4o</option>
                  <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-zinc-300 flex items-center">
                <Network size={16} className="mr-2 text-yellow-400" />
                Network Analysis (LSTM)
              </h4>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Model</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={config.networkModel}
                  onChange={(e) => handleModelChange('networkModel', e.target.value as AIModel)}
                >
                  <option value="azure-gpt-4o">Azure GPT-4o</option>
                  <option value="azure-gpt-4o-mini">Azure GPT-4o Mini</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                  <option value="claude-bedrock">Claude</option>
                  <option value="deepseek-r1">Deepseek R1</option>
                  <option value="deepseek-v3">Deepseek V3</option>
                  <option value="azure-gpt-4o-o1">Azure GPT-4o O1</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">GPU Acceleration</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={config.useGPU}
                    onChange={() => handleConfigChange('useGPU', !config.useGPU)}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full ${config.useGPU ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.useGPU ? 'transform translate-x-6' : ''}`}></div>
                </div>
              </label>
            </div>
            
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">Generate SHAP Explanations</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={config.generateExplanations}
                    onChange={() => handleConfigChange('generateExplanations', !config.generateExplanations)}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full ${config.generateExplanations ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.generateExplanations ? 'transform translate-x-6' : ''}`}></div>
                </div>
              </label>
            </div>
            
            <div>
              <label className="block text-sm mb-1">Confidence Threshold</label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.confidenceThreshold}
                  onChange={(e) => handleConfigChange('confidenceThreshold', parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="ml-2 text-sm">{config.confidenceThreshold}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Performance Metrics */}
      <div className="grid grid-cols-4 gap-4 p-4">
        <div className="bg-zinc-800 p-3 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Text Analysis</div>
          <div className="text-lg font-bold">{performanceMetrics.textAnalysisTime ? `${performanceMetrics.textAnalysisTime.toFixed(0)}ms` : 'N/A'}</div>
          <div className="flex items-center mt-1">
            <div className="w-full bg-zinc-700 h-1.5 rounded-full">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-3 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Image Analysis</div>
          <div className="text-lg font-bold">{performanceMetrics.imageAnalysisTime ? `${performanceMetrics.imageAnalysisTime.toFixed(0)}ms` : 'N/A'}</div>
          <div className="flex items-center mt-1">
            <div className="w-full bg-zinc-700 h-1.5 rounded-full">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-3 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Network Analysis</div>
          <div className="text-lg font-bold">{performanceMetrics.networkAnalysisTime ? `${performanceMetrics.networkAnalysisTime.toFixed(0)}ms` : 'N/A'}</div>
          <div className="flex items-center mt-1">
            <div className="w-full bg-zinc-700 h-1.5 rounded-full">
              <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '35%' }}></div>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-3 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Total Pipeline</div>
          <div className="text-lg font-bold">{performanceMetrics.totalTime ? `${performanceMetrics.totalTime.toFixed(0)}ms` : 'N/A'}</div>
          <div className="flex items-center mt-1">
            <div className="w-full bg-zinc-700 h-1.5 rounded-full">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Analysis Tabs */}
      <div className="border-t border-zinc-800">
        <div className="flex border-b border-zinc-800">
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'text' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-400'}`}
            onClick={() => setActiveTab('text')}
          >
            <FileText size={16} className="inline mr-2" />
            Text Analysis
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'image' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-400'}`}
            onClick={() => setActiveTab('image')}
          >
            <ImageIcon size={16} className="inline mr-2" />
            Image Analysis
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'network' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-400'}`}
            onClick={() => setActiveTab('network')}
          >
            <Network size={16} className="inline mr-2" />
            Network Analysis
          </button>
        </div>
        
        <div className="p-4">
          {/* Text Analysis Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Text Input</label>
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm h-32"
                  placeholder="Enter text to analyze for threats..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                ></textarea>
              </div>
              
              <div className="flex justify-between">
                <button
                  className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                  onClick={generateSampleData}
                >
                  Generate Sample
                </button>
                
                <div className="space-x-3">
                  <button
                    className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                    onClick={() => setTextInput('')}
                  >
                    Clear
                  </button>
                  
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm flex items-center"
                    onClick={runAnalysis}
                    disabled={!textInput || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={16} className="mr-2" />
                        Analyze Text
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Text Analysis Results */}
              {results.text && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  results.text.threatDetected 
                    ? 'bg-red-900 bg-opacity-20 border-red-900' 
                    : 'bg-green-900 bg-opacity-20 border-green-900'
                }`}>
                  <div className="flex items-center mb-3">
                    {results.text.threatDetected ? (
                      <AlertTriangle size={20} className="text-red-500 mr-2" />
                    ) : (
                      <CheckCircle size={20} className="text-green-500 mr-2" />
                    )}
                    <h3 className="text-lg font-medium">
                      {results.text.threatDetected 
                        ? `Threat Detected: ${results.text.threatType}` 
                        : 'No Threats Detected'}
                    </h3>
                    <div className="ml-auto bg-zinc-800 px-2 py-1 rounded text-xs">
                      Confidence: {(results.text.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <p className="text-sm mb-4">{results.text.explanation}</p>
                  
                  {results.text.shapValues && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center">
                        <BarChart3 size={16} className="mr-2" />
                        SHAP Feature Importance
                      </h4>
                      <div className="space-y-2">
                        {results.text.shapValues.features.map((feature, idx) => (
                          <div key={idx} className="bg-zinc-800 p-2 rounded">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{feature.name}</span>
                              <span>{feature.value.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-zinc-700 h-2 rounded-full">
                              <div 
                                className={`h-2 rounded-full ${feature.importance > 0.5 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${feature.importance * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Image Analysis Tab */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Image Input</label>
                <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center">
                  {imageInput ? (
                    <div className="relative">
                      <img 
                        src={imageInput} 
                        alt="Uploaded image" 
                        className="max-h-64 mx-auto rounded"
                      />
                      <button
                        className="absolute top-2 right-2 bg-zinc-800 p-1 rounded-full"
                        onClick={() => setImageInput('')}
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon size={48} className="mx-auto mb-2 text-zinc-600" />
                      <p className="text-sm text-zinc-400 mb-4">Upload an image for steganography analysis</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm cursor-pointer"
                      >
                        Select Image
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between">
                <button
                  className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                  onClick={generateSampleData}
                >
                  Generate Sample
                </button>
                
                <div className="space-x-3">
                  {imageInput && (
                    <button
                      className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                      onClick={() => setImageInput('')}
                    >
                      Clear
                    </button>
                  )}
                  
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm flex items-center"
                    onClick={runAnalysis}
                    disabled={!imageInput || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={16} className="mr-2" />
                        Analyze Image
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Image Analysis Results */}
              {results.image && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  results.image.threatDetected 
                    ? 'bg-red-900 bg-opacity-20 border-red-900' 
                    : 'bg-green-900 bg-opacity-20 border-green-900'
                }`}>
                  <div className="flex items-center mb-3">
                    {results.image.threatDetected ? (
                      <AlertTriangle size={20} className="text-red-500 mr-2" />
                    ) : (
                      <CheckCircle size={20} className="text-green-500 mr-2" />
                    )}
                    <h3 className="text-lg font-medium">
                      {results.image.threatDetected 
                        ? `Steganography Detected: ${results.image.threatType}` 
                        : 'No Hidden Content Detected'}
                    </h3>
                    <div className="ml-auto bg-zinc-800 px-2 py-1 rounded text-xs">
                      Confidence: {(results.image.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <p className="text-sm mb-4">{results.image.explanation}</p>
                  
                  {results.image.shapValues && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center">
                        <BarChart3 size={16} className="mr-2" />
                        SHAP Feature Importance
                      </h4>
                      <div className="space-y-2">
                        {results.image.shapValues.features.map((feature, idx) => (
                          <div key={idx} className="bg-zinc-800 p-2 rounded">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{feature.name}</span>
                              <span>{feature.value.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-zinc-700 h-2 rounded-full">
                              <div 
                                className={`h-2 rounded-full ${feature.importance > 0.5 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${feature.importance * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Network Analysis Tab */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Network Traffic Data (JSON)</label>
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm h-32 font-mono"
                  placeholder="Enter network traffic data in JSON format..."
                  value={networkInput}
                  onChange={(e) => setNetworkInput(e.target.value)}
                ></textarea>
              </div>
              
              <div className="flex justify-between">
                <button
                  className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                  onClick={generateSampleData}
                >
                  Generate Sample
                </button>
                
                <div className="space-x-3">
                  <button
                    className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
                    onClick={() => setNetworkInput('')}
                  >
                    Clear
                  </button>
                  
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm flex items-center"
                    onClick={runAnalysis}
                    disabled={!networkInput || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap size={16} className="mr-2" />
                        Analyze Network
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Network Analysis Results */}
              {results.network && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  results.network.threatDetected 
                    ? 'bg-red-900 bg-opacity-20 border-red-900' 
                    : 'bg-green-900 bg-opacity-20 border-green-900'
                }`}>
                  <div className="flex items-center mb-3">
                    {results.network.threatDetected ? (
                      <AlertTriangle size={20} className="text-red-500 mr-2" />
                    ) : (
                      <CheckCircle size={20} className="text-green-500 mr-2" />
                    )}
                    <h3 className="text-lg font-medium">
                      {results.network.threatDetected 
                        ? `Network Anomaly Detected: ${results.network.threatType}` 
                        : 'No Network Anomalies Detected'}
                    </h3>
                    <div className="ml-auto bg-zinc-800 px-2 py-1 rounded text-xs">
                      Confidence: {(results.network.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <p className="text-sm mb-4">{results.network.explanation}</p>
                  
                  {results.network.shapValues && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center">
                        <BarChart3 size={16} className="mr-2" />
                        SHAP Feature Importance
                      </h4>
                      <div className="space-y-2">
                        {results.network.shapValues.features.map((feature, idx) => (
                          <div key={idx} className="bg-zinc-800 p-2 rounded">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{feature.name}</span>
                              <span>{feature.value.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-zinc-700 h-2 rounded-full">
                              <div 
                                className={`h-2 rounded-full ${feature.importance > 0.5 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${feature.importance * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Full Pipeline Analysis */}
      <div className="border-t border-zinc-800 p-4">
        <button
          className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg flex items-center justify-center"
          onClick={analyzeTraffic}
          disabled={isAnalyzing || (!textInput && !imageInput && !networkInput)}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw size={18} className="mr-2 animate-spin" />
              Analyzing with Backend...
            </>
          ) : (
            <>
              <Shield size={18} className="mr-2" />
              Analyze with Backend Pipeline
            </>
          )}
        </button>
      </div>
    </div>
  );
}
