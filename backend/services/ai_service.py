"""
AI Service
Handles ML model loading, inference, and management.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
import numpy as np
import pandas as pd
from datetime import datetime
import json
import base64
import io
from PIL import Image

# Import existing ML components
from backend.services.Isolation_forest import IsolationForestDetector
from backend.services.autoencoder_train_test import AutoencoderDetector
from backend.services.lstm_train_test import LSTMDETector
from backend.services.signature_engine import SignatureEngine
from backend.services.aggregator import Aggregator

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class AIService:
    """Centralized AI service for model management and inference."""
    
    def __init__(self):
        self.models = {}
        self.model_status = {}
        self.is_initialized = False
        self.model_versions = {}
        self.confidence_thresholds = {
            "CRITICAL": float(os.getenv("ZEROHACK_CRITICAL_THRESHOLD", "0.9")),
            "HIGH": float(os.getenv("ZEROHACK_HIGH_THRESHOLD", "0.7")),
            "MEDIUM": float(os.getenv("ZEROHACK_MEDIUM_THRESHOLD", "0.5")),
            "LOW": float(os.getenv("ZEROHACK_LOW_THRESHOLD", "0.3"))
        }
        
    async def initialize(self):
        """Initialize all AI models."""
        try:
            logger.info("🤖 Initializing AI Service...")
            
            # Initialize models
            self.models = {
                "isolation_forest": IsolationForestDetector(),
                "autoencoder": AutoencoderDetector(),
                "lstm": LSTMDETector(),
                "signature_engine": SignatureEngine(),
                "aggregator": Aggregator()
            }
            
            # Load models asynchronously
            load_tasks = []
            for name, model in self.models.items():
                if hasattr(model, 'load_model'):
                    load_tasks.append(self._load_model_async(name, model))
            
            # Wait for all models to load
            await asyncio.gather(*load_tasks, return_exceptions=True)
            
            # Update model status and versions
            for name, model in self.models.items():
                model_version = self._get_model_version(name)
                self.model_versions[name] = model_version
                self.model_status[name] = {
                    "status": "ready" if hasattr(model, 'model') and model.model is not None else "error",
                    "loaded_at": datetime.utcnow().isoformat(),
                    "type": model.__class__.__name__,
                    "version": model_version,
                    "confidence_thresholds": self.confidence_thresholds
                }
            
            self.is_initialized = True
            logger.info("✅ AI Service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI Service: {e}")
            raise
    
    async def _load_model_async(self, name: str, model):
        """Load a model asynchronously."""
        try:
            if hasattr(model, 'load_model'):
                await asyncio.get_event_loop().run_in_executor(
                    None, model.load_model
                )
                logger.info(f"✅ Loaded {name} model")
            else:
                logger.warning(f"⚠️ Model {name} has no load_model method")
        except Exception as e:
            logger.error(f"❌ Failed to load {name} model: {e}")
            self.model_status[name] = {
                "status": "error",
                "error": str(e),
                "loaded_at": datetime.utcnow().isoformat()
            }
    
    async def analyze_text(self, text: str, analysis_type: str = "comprehensive") -> Dict[str, Any]:
        """Analyze text content for threats."""
        try:
            if not self.is_initialized:
                raise Exception("AI Service not initialized")
            
            # For text analysis, we'll use a combination of signature engine and LSTM
            # Convert text to features (this is a simplified approach)
            text_features = self._extract_text_features(text)
            
            # Run through available models
            results = {}
            
            # Signature-based analysis
            if "signature_engine" in self.models:
                sig_result = self.models["signature_engine"].analyze_text(text)
                results["signature"] = sig_result
            
            # LSTM analysis (if we can convert text to sequence)
            if "lstm" in self.models and self.model_status.get("lstm", {}).get("status") == "ready":
                try:
                    lstm_input = self._prepare_text_for_lstm(text)
                    lstm_result = self.models["lstm"].predict(lstm_input)
                    results["lstm"] = lstm_result
                except Exception as e:
                    logger.warning(f"LSTM text analysis failed: {e}")
            
            # Aggregate results
            if "aggregator" in self.models:
                final_result = self.models["aggregator"].aggregate_text_results(results)
            else:
                final_result = self._default_text_aggregation(results)
            
            return {
                "threat_detected": final_result.get("threat_detected", False),
                "threat_type": final_result.get("threat_type", "Unknown"),
                "confidence": final_result.get("confidence", 0.0),
                "severity": final_result.get("severity", "LOW"),
                "explanation": final_result.get("explanation", "No threats detected"),
                "model_details": results
            }
            
        except Exception as e:
            logger.error(f"Text analysis failed: {e}")
            raise
    
    async def analyze_image(self, image_data: str, analysis_type: str = "steganography") -> Dict[str, Any]:
        """Analyze image for steganography and hidden content."""
        try:
            if not self.is_initialized:
                raise Exception("AI Service not initialized")
            
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to numpy array for analysis
            img_array = np.array(image)
            
            # For now, use a simplified steganography detection
            # In a real implementation, you'd use a trained CNN model
            stego_score = self._detect_steganography(img_array)
            
            threat_detected = stego_score > 0.7
            confidence = stego_score
            
            return {
                "threat_detected": threat_detected,
                "threat_type": "Steganography" if threat_detected else "Clean",
                "confidence": confidence,
                "severity": "HIGH" if threat_detected else "LOW",
                "explanation": f"Steganography detection score: {stego_score:.2f}",
                "model_details": {
                    "steganography_score": stego_score,
                    "image_size": img_array.shape
                }
            }
            
        except Exception as e:
            logger.error(f"Image analysis failed: {e}")
            raise
    
    async def analyze_network_traffic(self, traffic_data: List[Dict[str, Any]], session_id: Optional[str] = None) -> Dict[str, Any]:
        """Analyze network traffic for anomalies and threats."""
        try:
            if not self.is_initialized:
                raise Exception("AI Service not initialized")
            
            # Convert traffic data to DataFrame
            df = pd.DataFrame(traffic_data)
            
            # Preprocess data
            processed_df = self._preprocess_traffic_data(df)
            
            if processed_df.empty:
                return {
                    "threat_detected": False,
                    "threat_type": "Unknown",
                    "confidence": 0.0,
                    "severity": "LOW",
                    "explanation": "No valid traffic data to analyze",
                    "model_details": {}
                }
            
            # Run through detection pipeline
            results = {}
            
            # Isolation Forest
            if "isolation_forest" in self.models and self.model_status.get("isolation_forest", {}).get("status") == "ready":
                if_result = self.models["isolation_forest"].predict(processed_df)
                results["isolation_forest"] = if_result
            
            # Autoencoder
            if "autoencoder" in self.models and self.model_status.get("autoencoder", {}).get("status") == "ready":
                ae_result = self.models["autoencoder"].predict(processed_df)
                results["autoencoder"] = ae_result
            
            # LSTM
            if "lstm" in self.models and self.model_status.get("lstm", {}).get("status") == "ready":
                lstm_result = self.models["lstm"].predict(processed_df)
                results["lstm"] = lstm_result
            
            # Signature Engine
            if "signature_engine" in self.models:
                sig_events = self._format_traffic_for_signature_engine(df)
                sig_result = self.models["signature_engine"].analyze_session(sig_events)
                results["signature_engine"] = sig_result
            
            # Aggregate results
            if "aggregator" in self.models:
                final_result = self.models["aggregator"].aggregate_results(
                    results.get("isolation_forest", {}),
                    results.get("autoencoder", {}),
                    results.get("signature_engine", {})
                )
            else:
                final_result = self._default_traffic_aggregation(results)
            
            return {
                "threat_detected": final_result.get("final_verdict") == "THREAT",
                "threat_type": final_result.get("final_verdict_reason", "Unknown"),
                "confidence": final_result.get("confidence", 0.0),
                "severity": self._map_confidence_to_severity(final_result.get("confidence", 0.0)),
                "explanation": final_result.get("explanation_summary", "No threats detected"),
                "model_details": results
            }
            
        except Exception as e:
            logger.error(f"Network traffic analysis failed: {e}")
            raise
    
    async def comprehensive_analysis(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive analysis on multiple data types."""
        try:
            results = {}
            
            # Analyze text if present
            if "text" in analysis_data:
                text_result = await self.analyze_text(analysis_data["text"])
                results["text_analysis"] = text_result
            
            # Analyze image if present
            if "image" in analysis_data:
                image_data = analysis_data["image"]
                if isinstance(image_data, dict) and "content" in image_data:
                    # Convert bytes to base64
                    img_b64 = base64.b64encode(image_data["content"]).decode()
                    image_result = await self.analyze_image(img_b64)
                    results["image_analysis"] = image_result
            
            # Analyze traffic if present
            if "traffic" in analysis_data:
                traffic_result = await self.analyze_network_traffic(analysis_data["traffic"])
                results["traffic_analysis"] = traffic_result
            
            # Aggregate comprehensive results
            comprehensive_result = self._aggregate_comprehensive_results(results)
            
            return {
                "threat_detected": comprehensive_result["threat_detected"],
                "threat_type": comprehensive_result["threat_type"],
                "confidence": comprehensive_result["confidence"],
                "severity": comprehensive_result["severity"],
                "explanation": comprehensive_result["explanation"],
                "analysis_components": results,
                "model_details": comprehensive_result["model_details"]
            }
            
        except Exception as e:
            logger.error(f"Comprehensive analysis failed: {e}")
            raise
    
    async def analyze_incident(self, description: str, source_ip: Optional[str] = None, evidence_files: List[str] = None) -> Dict[str, Any]:
        """Analyze an incident report for threat assessment."""
        try:
            # Analyze the description text
            text_analysis = await self.analyze_text(description)
            
            # If we have evidence files, analyze them
            file_analysis = {}
            if evidence_files:
                for file_id in evidence_files:
                    # This would integrate with your file storage system
                    # For now, we'll skip file analysis
                    pass
            
            # Determine overall threat level
            threat_detected = text_analysis["threat_detected"]
            confidence = text_analysis["confidence"]
            threat_type = text_analysis["threat_type"]
            severity = text_analysis["severity"]
            
            # Generate evidence hash for blockchain logging
            evidence_hash = self._generate_evidence_hash(description, source_ip, evidence_files)
            
            return {
                "threat_detected": threat_detected,
                "threat_type": threat_type,
                "confidence": confidence,
                "severity": severity,
                "evidence_hash": evidence_hash,
                "analysis_details": {
                    "text_analysis": text_analysis,
                    "file_analysis": file_analysis
                }
            }
            
        except Exception as e:
            logger.error(f"Incident analysis failed: {e}")
            raise
    
    async def get_model_status(self) -> Dict[str, Any]:
        """Get status of all AI models."""
        return {
            "initialized": self.is_initialized,
            "models": self.model_status,
            "total_models": len(self.models),
            "ready_models": sum(1 for status in self.model_status.values() if status.get("status") == "ready")
        }
    
    async def get_model_explanation(self, model_name: str, prediction_id: str) -> Dict[str, Any]:
        """Get SHAP explanation for a model prediction."""
        # This would integrate with SHAP or similar explainability tools
        # For now, return a placeholder
        return {
            "model_name": model_name,
            "prediction_id": prediction_id,
            "explanation": "SHAP explanation not yet implemented",
            "feature_importance": {}
        }
    
    async def trigger_retraining(self, model_name: Optional[str] = None) -> str:
        """Trigger model retraining."""
        task_id = f"retrain_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        # This would start an async retraining task
        logger.info(f"Retraining triggered for {model_name or 'all models'}, task_id: {task_id}")
        return task_id
    
    def is_ready(self) -> bool:
        """Check if AI service is ready."""
        return self.is_initialized and any(
            status.get("status") == "ready" 
            for status in self.model_status.values()
        )
    
    async def cleanup(self):
        """Cleanup resources."""
        logger.info("🧹 Cleaning up AI Service...")
        # Cleanup any resources if needed
        pass
    
    # Helper methods
    def _extract_text_features(self, text: str) -> Dict[str, Any]:
        """Extract features from text for analysis."""
        return {
            "length": len(text),
            "word_count": len(text.split()),
            "has_suspicious_keywords": any(keyword in text.lower() for keyword in [
                "password", "login", "admin", "root", "sql", "injection", "xss"
            ]),
            "has_urls": "http" in text.lower(),
            "has_emails": "@" in text
        }
    
    def _prepare_text_for_lstm(self, text: str) -> np.ndarray:
        """Prepare text data for LSTM analysis."""
        # This is a simplified tokenization
        # In practice, you'd use proper tokenization and embedding
        words = text.split()
        # Convert to numerical representation (simplified)
        return np.array([[hash(word) % 1000 for word in words[:50]]])  # Limit to 50 words
    
    def _detect_steganography(self, img_array: np.ndarray) -> float:
        """Detect steganography in image (simplified implementation)."""
        # This is a placeholder implementation
        # Real steganography detection would use trained CNN models
        if len(img_array.shape) == 3:
            # Check for unusual patterns in pixel values
            pixel_variance = np.var(img_array)
            return min(pixel_variance / 10000, 1.0)  # Normalize to 0-1
        return 0.0
    
    def _preprocess_traffic_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Preprocess traffic data for ML models."""
        # Select numeric columns only
        numeric_df = df.select_dtypes(include=[np.number])
        
        # Handle missing values
        numeric_df = numeric_df.fillna(0)
        
        # Handle infinite values
        numeric_df = numeric_df.replace([np.inf, -np.inf], 0)
        
        return numeric_df
    
    def _format_traffic_for_signature_engine(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Format traffic data for signature engine."""
        events = []
        for _, row in df.iterrows():
            event = {
                "timestamp": row.get("timestamp", datetime.utcnow()),
                "source_ip": row.get("source_ip", "0.0.0.0"),
                "dest_ip": row.get("dest_ip", "0.0.0.0"),
                "dest_port": int(row.get("dest_port", 0))
            }
            events.append(event)
        return events
    
    def _default_text_aggregation(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Default aggregation for text analysis results."""
        threat_detected = any(
            result.get("threat_detected", False) 
            for result in results.values()
        )
        
        confidences = [
            result.get("confidence", 0.0) 
            for result in results.values() 
            if isinstance(result, dict)
        ]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return {
            "threat_detected": threat_detected,
            "threat_type": "Text-based threat" if threat_detected else "Clean",
            "confidence": avg_confidence,
            "severity": "HIGH" if avg_confidence > 0.8 else "LOW",
            "explanation": f"Text analysis confidence: {avg_confidence:.2f}"
        }
    
    def _default_traffic_aggregation(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Default aggregation for traffic analysis results."""
        # Use the existing aggregator logic if available
        if "isolation_forest" in results and "autoencoder" in results and "signature_engine" in results:
            return {
                "final_verdict": "THREAT" if any(
                    result.get("verdict") == "THREAT" 
                    for result in results.values()
                ) else "SAFE",
                "confidence": 0.8,  # Placeholder
                "explanation_summary": "Traffic analysis completed"
            }
        else:
            return {
                "final_verdict": "SAFE",
                "confidence": 0.0,
                "explanation_summary": "Insufficient data for analysis"
            }
    
    def _aggregate_comprehensive_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Aggregate results from multiple analysis types."""
        threat_detected = any(
            result.get("threat_detected", False) 
            for result in results.values()
        )
        
        confidences = [
            result.get("confidence", 0.0) 
            for result in results.values() 
            if isinstance(result, dict)
        ]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return {
            "threat_detected": threat_detected,
            "threat_type": "Multi-vector threat" if threat_detected else "Clean",
            "confidence": avg_confidence,
            "severity": self._map_confidence_to_severity(avg_confidence),
            "explanation": f"Comprehensive analysis confidence: {avg_confidence:.2f}",
            "model_details": results
        }
    
    def _map_confidence_to_severity(self, confidence: float) -> str:
        """Map confidence score to severity level."""
        if confidence >= 0.9:
            return "CRITICAL"
        elif confidence >= 0.7:
            return "HIGH"
        elif confidence >= 0.5:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _generate_evidence_hash(self, description: str, source_ip: Optional[str], evidence_files: List[str]) -> str:
        """Generate hash for evidence integrity verification."""
        import hashlib
        
        evidence_string = f"{description}|{source_ip or ''}|{','.join(evidence_files or [])}"
        return hashlib.sha256(evidence_string.encode()).hexdigest()
    
    def _get_model_version(self, model_name: str) -> str:
        """Get model version from file or generate default."""
        try:
            # Try to get version from model file metadata
            if hasattr(self.models[model_name], 'model') and self.models[model_name].model is not None:
                # This would be implemented based on your model storage format
                # For now, return a timestamp-based version
                return datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        except Exception:
            pass
        
        return "1.0.0"  # Default version
