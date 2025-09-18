"""
AI Inference API
Handles ML model inference and analysis requests.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
import asyncio

from backend.services.ai_service import AIService
from backend.utils.security import get_current_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class TextAnalysisRequest(BaseModel):
    """Request model for text analysis."""
    text: str = Field(..., description="Text content to analyze")
    analysis_type: str = Field("comprehensive", description="Type of analysis to perform")

class ImageAnalysisRequest(BaseModel):
    """Request model for image analysis."""
    image_data: str = Field(..., description="Base64 encoded image data")
    analysis_type: str = Field("steganography", description="Type of image analysis")

class NetworkTrafficRequest(BaseModel):
    """Request model for network traffic analysis."""
    traffic_data: List[Dict[str, Any]] = Field(..., description="Network traffic data points")
    session_id: Optional[str] = Field(None, description="Session identifier")

class AnalysisResponse(BaseModel):
    """Response model for AI analysis."""
    threat_detected: bool
    threat_type: str
    confidence: float
    severity: str
    explanation: str
    model_details: Dict[str, Any]
    processing_time: float

@router.post("/analyze/text", response_model=AnalysisResponse)
async def analyze_text(
    request: TextAnalysisRequest,
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Analyze text content for threats using CodeBERT and other text models."""
    try:
        start_time = asyncio.get_event_loop().time()
        
        result = await ai_service.analyze_text(
            text=request.text,
            analysis_type=request.analysis_type
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return AnalysisResponse(
            threat_detected=result["threat_detected"],
            threat_type=result["threat_type"],
            confidence=result["confidence"],
            severity=result["severity"],
            explanation=result["explanation"],
            model_details=result["model_details"],
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Text analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Text analysis failed")

@router.post("/analyze/image", response_model=AnalysisResponse)
async def analyze_image(
    request: ImageAnalysisRequest,
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Analyze image for steganography and hidden content."""
    try:
        start_time = asyncio.get_event_loop().time()
        
        result = await ai_service.analyze_image(
            image_data=request.image_data,
            analysis_type=request.analysis_type
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return AnalysisResponse(
            threat_detected=result["threat_detected"],
            threat_type=result["threat_type"],
            confidence=result["confidence"],
            severity=result["severity"],
            explanation=result["explanation"],
            model_details=result["model_details"],
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Image analysis failed")

@router.post("/analyze/network", response_model=AnalysisResponse)
async def analyze_network_traffic(
    request: NetworkTrafficRequest,
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Analyze network traffic for anomalies and threats."""
    try:
        start_time = asyncio.get_event_loop().time()
        
        result = await ai_service.analyze_network_traffic(
            traffic_data=request.traffic_data,
            session_id=request.session_id
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return AnalysisResponse(
            threat_detected=result["threat_detected"],
            threat_type=result["threat_type"],
            confidence=result["confidence"],
            severity=result["severity"],
            explanation=result["explanation"],
            model_details=result["model_details"],
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Network traffic analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Network traffic analysis failed")

@router.post("/analyze/comprehensive")
async def comprehensive_analysis(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    traffic_data: Optional[str] = Form(None),
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Perform comprehensive analysis on multiple data types."""
    try:
        start_time = asyncio.get_event_loop().time()
        
        # Prepare analysis data
        analysis_data = {}
        
        if text:
            analysis_data["text"] = text
        
        if image:
            image_content = await image.read()
            analysis_data["image"] = {
                "content": image_content,
                "filename": image.filename,
                "content_type": image.content_type
            }
        
        if traffic_data:
            import json
            analysis_data["traffic"] = json.loads(traffic_data)
        
        # Run comprehensive analysis
        result = await ai_service.comprehensive_analysis(analysis_data)
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return {
            "threat_detected": result["threat_detected"],
            "threat_type": result["threat_type"],
            "confidence": result["confidence"],
            "severity": result["severity"],
            "explanation": result["explanation"],
            "analysis_components": result["analysis_components"],
            "model_details": result["model_details"],
            "processing_time": processing_time
        }
        
    except Exception as e:
        logger.error(f"Comprehensive analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Comprehensive analysis failed")

@router.get("/models/status")
async def get_model_status(
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get status of all AI models."""
    try:
        status = await ai_service.get_model_status()
        return status
        
    except Exception as e:
        logger.error(f"Failed to get model status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model status")

@router.get("/models/{model_name}/explain")
async def explain_model_prediction(
    model_name: str,
    prediction_id: str,
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get SHAP explanation for a specific model prediction."""
    try:
        explanation = await ai_service.get_model_explanation(model_name, prediction_id)
        return explanation
        
    except Exception as e:
        logger.error(f"Failed to get model explanation: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model explanation")

@router.post("/models/retrain")
async def trigger_model_retraining(
    model_name: Optional[str] = None,
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Trigger retraining of AI models with new data."""
    try:
        # Check if user has admin privileges
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        task_id = await ai_service.trigger_retraining(model_name)
        return {"task_id": task_id, "status": "retraining_started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger model retraining: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger model retraining")
