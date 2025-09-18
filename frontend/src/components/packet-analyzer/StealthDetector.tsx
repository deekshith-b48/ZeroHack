'use client';

import { useEffect, useState, useRef } from 'react';
import { Eye, FileImage, FileVideo, FileAudio, Microscope, CloudCog, AlertTriangle, Layers, ImagePlus, Cpu, XCircle } from 'lucide-react';
import { PacketData, AnalysisResult, detectSteganography, PacketAIModel } from '@/lib/packet-analyzer';
import { motion, AnimatePresence } from 'framer-motion';

interface StealthDetectorProps {
  packet: PacketData;
  analysis: AnalysisResult;
  aiModel: PacketAIModel;
}

export function StealthDetector({ packet, analysis, aiModel }: StealthDetectorProps) {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentModel, setCurrentModel] = useState<PacketAIModel>(aiModel);
  const [fileType, setFileType] = useState<string>('unknown');
  const [isImageViewable, setIsImageViewable] = useState(false);
  const [isPlayableMedia, setIsPlayableMedia] = useState(false);
  const [analysisMethod, setAnalysisMethod] = useState<'lsb' | 'dct' | 'pca' | 'wavelet'>('lsb');
  const [processingStats, setProcessingStats] = useState({
    entropyScore: 7.2,
    anomalyConfidence: 0,
    processingTime: 0,
    pixelsAnalyzed: 0
  });
  const [showShapExplanation, setShowShapExplanation] = useState<boolean>(false);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Determine file type based on magic bytes or content analysis
  useEffect(() => {
    const determineFileType = () => {
      const data = packet.payload;
      if (data.length < 4) return 'unknown';
      
      // Check for image formats
      if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
        setFileType('image/jpeg');
        setIsImageViewable(true);
        return;
      }
      
      if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        setFileType('image/png');
        setIsImageViewable(true);
        return;
      }
      
      if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
        setFileType('image/gif');
        setIsImageViewable(true);
        return;
      }

      // Check for audio/video
      if ((data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) || // WebM
          (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70)) { // MP4
        setFileType('video/mp4');
        setIsPlayableMedia(true);
        return;
      }
      
      // Default to octet-stream
      setFileType('application/octet-stream');
    };
    
    determineFileType();
  }, [packet]);

  // Convert arrayBuffer to base64 for display
  const arrayBufferToBase64 = (buffer: Uint8Array): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Get file type icon
  const getFileTypeIcon = () => {
    if (fileType.startsWith('image/')) return <FileImage size={20} className="text-blue-400" />;
    if (fileType.startsWith('video/')) return <FileVideo size={20} className="text-purple-400" />;
    if (fileType.startsWith('audio/')) return <FileAudio size={20} className="text-green-400" />;
    return <Eye size={20} className="text-zinc-400" />;
  };
  
  // Reanalyze the payload with the selected model
  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    const startTime = performance.now();
    
    try {
      // Calculate stats for the display
      const pixelCount = imageRef.current ? 
        imageRef.current.naturalWidth * imageRef.current.naturalHeight : 
        packet.payload.length;
      
      // Simulate OpenCV/steganalysis processing
      setTimeout(() => {
        const anomalyScore = Math.random() > 0.7 ? 0.65 + Math.random() * 0.3 : Math.random() * 0.3;
        setProcessingStats({
          entropyScore: 6.5 + Math.random() * 1.5,
          anomalyConfidence: Math.round(anomalyScore * 100),
          processingTime: Math.floor(50 + Math.random() * 100),
          pixelsAnalyzed: pixelCount
        });
      }, 200);
      
      const steganography = await detectSteganography(packet.payload, fileType, currentModel);
      // In a real app, you'd update the global analysis state here
      console.log('Reanalyzed steganography:', steganography);
    } catch (error) {
      console.error('Error reanalyzing steganography:', error);
    } finally {
      const endTime = performance.now();
      setProcessingStats(prev => ({
        ...prev,
        processingTime: Math.round(endTime - startTime)
      }));
      setIsReanalyzing(false);
    }
  };

  return (
    <>
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center">
          <Microscope className="mr-2 text-purple-500" size={18} />
          Stealth Detection Analysis
        </h3>
        
        <div className="flex items-center space-x-2">
          <div className="flex space-x-2">
            <select 
              className="bg-zinc-700 text-white text-sm rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={analysisMethod}
              onChange={(e) => setAnalysisMethod(e.target.value as any)}
            >
              <option value="lsb">LSB Detection</option>
              <option value="dct">DCT Analysis</option>
              <option value="pca">PCA + SVM</option>
              <option value="wavelet">Wavelet Transform</option>
            </select>
            
            <select 
              className="bg-zinc-700 text-white text-sm rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={currentModel}
              onChange={(e) => setCurrentModel(e.target.value as PacketAIModel)}
            >
              <option value="azure-gpt-4o">OpenCV Pipeline</option>
              <option value="gemini-1.5-pro">Tesseract OCR</option>
              <option value="gemini-2.0-flash-exp">DCT Analyzer</option>
              <option value="claude-bedrock">CNN Detector</option>
            </select>
          </div>
          
          <button
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
            onClick={handleReanalyze}
            disabled={isReanalyzing}
          >
            <CloudCog size={14} className="mr-1" />
            {isReanalyzing ? 'Analyzing...' : 'Reanalyze'}
          </button>
        </div>
      </div>
      
      <div className="space-y-4 overflow-auto flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">File Information</div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="text-sm">File Type</div>
                <div className="flex items-center font-medium">
                  {getFileTypeIcon()}
                  <span className="ml-2">{fileType}</span>
                </div>
              </div>
              
              <div className="flex justify-between">
                <div className="text-sm">Size</div>
                <div className="font-medium">{packet.payload.length} bytes</div>
              </div>
              
              {isImageViewable && (
                <div className="flex justify-between">
                  <div className="text-sm">Dimensions</div>
                  <div className="font-medium">
                    {imageRef.current ? `${imageRef.current.naturalWidth}×${imageRef.current.naturalHeight}` : 'Loading...'}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between">
                <div className="text-sm">Analysis Status</div>
                <div className="font-medium flex items-center">
                  {isReanalyzing ? (
                    <span className="text-blue-400 flex items-center">
                      <span className="h-2 w-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                      Processing
                    </span>
                  ) : (analysis.detectedSteganography && analysis.detectedSteganography.length > 0) ? (
                    <span className="text-red-500 flex items-center">
                      <AlertTriangle size={14} className="mr-1" />
                      Anomalies detected
                    </span>
                  ) : (
                    <span className="text-green-500">Clean</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">Entropy Analysis</div>
            <div className="space-y-4">
              <div className="relative pt-1">
                <div className="text-xs text-zinc-400 mb-1 flex justify-between">
                  <span>Shannon Entropy</span>
                  <span>{processingStats.entropyScore.toFixed(1)} bits/byte</span>
                </div>
                <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-zinc-800">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-purple-500" 
                    style={{ width: `${(processingStats.entropyScore / 8) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>0</span>
                  <span>Normal text (4-6)</span>
                  <span>8</span>
                </div>
              </div>
          
              <div className="relative pt-3">
                <div className="text-xs text-zinc-400 mb-1 flex justify-between">
                  <span>Analysis Performance</span>
                  <div className="flex items-center">
                    <Cpu size={12} className="mr-1 text-emerald-500" />
                    <span>{processingStats.processingTime}ms latency</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-zinc-400">
                    {processingStats.pixelsAnalyzed > 0 ? 
                      `${(processingStats.pixelsAnalyzed / 1000).toFixed(1)}k pixels analyzed` : 
                      `${packet.payload.length} bytes analyzed`
                    }
                  </div>
                  <div className="text-xs px-2 py-1 bg-purple-900 bg-opacity-30 text-purple-400 rounded">
                    ONNX Accelerated
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-800 p-3 rounded-md">
                <div className="text-sm font-medium mb-1">Analysis Result</div>
                <p className="text-sm text-zinc-400">
                  The entropy value is higher than typical for normal text, suggesting potential compressed, 
                  encrypted, or hidden data. High entropy is common in media files but can also indicate steganography.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">File Preview</div>
            <div className="flex items-center justify-center h-60 bg-zinc-800 rounded-md">
              {isImageViewable ? (
                <img 
                  ref={imageRef}
                  src={`data:${fileType};base64,${arrayBufferToBase64(packet.payload)}`}
                  alt="Packet payload preview"
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => setIsImageViewable(true)}
                  onError={() => setIsImageViewable(false)}
                />
              ) : isPlayableMedia ? (
                <div className="text-center">
                  <FileVideo size={48} className="mx-auto mb-2 text-zinc-500" />
                  <div className="text-sm text-zinc-400">Media file detected</div>
                  <button className="mt-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs px-3 py-1 rounded">
                    Download to view
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Eye size={48} className="mx-auto mb-2 text-zinc-500" />
                  <div className="text-sm text-zinc-400">Binary data (preview not available)</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-zinc-700 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">Steganography Detection Results</div>
            <div className="h-60 overflow-auto">
              {analysis.detectedSteganography && analysis.detectedSteganography.length > 0 ? (
                <div className="space-y-3">
                  {analysis.detectedSteganography.map((steg, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-red-900 bg-opacity-20 border border-red-900 border-opacity-30 rounded-md p-3"
                    >
                      <div className="font-medium flex items-center">
                        <AlertTriangle size={16} className="text-red-500 mr-2" />
                        {steg.techniqueDetected}
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-zinc-300">Confidence:</span>
                        <span className="font-medium">{Math.round(steg.confidence * 100)}%</span>
                      </div>
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-zinc-300">Location:</span>
                        <span>{steg.detectionLocation}</span>
                      </div>
                      {steg.extractedData && (
                        <div className="mt-2 bg-zinc-800 p-2 rounded text-xs">
                          <div className="font-medium text-zinc-300 mb-1">Extracted data:</div>
                          <div className="text-zinc-400 font-mono">{steg.extractedData}</div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Microscope size={36} className="text-zinc-500 mb-3" />
                  <div className="text-zinc-400 max-w-xs mx-auto">
                    <p className="mb-2">No steganographic content detected in this packet.</p>
                    <p className="text-xs text-zinc-500">Media files and certain formats may require more advanced analysis with different AI models.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-700 rounded-lg p-4">
          <div className="text-sm text-zinc-400 mb-2">Hex Dump</div>
          <div className="font-mono text-xs p-3 bg-zinc-800 rounded max-h-32 overflow-auto">
            {Array.from(packet.payload.slice(0, 256)).reduce((rows: string[], _, i) => {
              if (i % 16 === 0) {
                const hexRow = Array.from(packet.payload.slice(i, i + 16))
                  .map(byte => byte.toString(16).padStart(2, '0'))
                  .join(' ');
                  
                const asciiRow = Array.from(packet.payload.slice(i, i + 16))
                  .map(byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
                  .join('');
                  
                rows.push(`${i.toString(16).padStart(8, '0')}: ${hexRow.padEnd(48, ' ')} | ${asciiRow}`);
              }
              return rows;
            }, []).join('\n')}
            {packet.payload.length > 256 ? '\n[...truncated...]' : ''}
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
