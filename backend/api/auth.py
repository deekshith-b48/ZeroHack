"""
Authentication API
Handles user authentication, JWT tokens, and 2FA.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets
import pyotp
import qrcode
import io
import base64

from backend.db.models import User, UserRole
from backend.db.schemas import UserResponse, UserCreate, UserLogin
from backend.utils.security import (
    hash_password, verify_password, create_access_token, 
    create_refresh_token, verify_token, get_password_hash
)
from backend.utils.logger import get_logger
from backend.services.notification_service import NotificationService

logger = get_logger(__name__)
router = APIRouter()
security = HTTPBearer()

class LoginRequest(BaseModel):
    """Login request model."""
    email: EmailStr
    password: str
    totp_code: Optional[str] = None

class RegisterRequest(BaseModel):
    """Registration request model."""
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = None

class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TwoFactorSetup(BaseModel):
    """2FA setup response model."""
    secret: str
    qr_code: str
    backup_codes: List[str]

@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(
    request: RegisterRequest,
    notification_service: NotificationService = Depends()
):
    """Register a new user."""
    try:
        # Check if user already exists
        existing_user = await User.get_by_email(request.email)
        if existing_user:
            raise HTTPException(
                status_code=400, 
                detail="User with this email already exists"
            )
        
        # Validate password strength
        if len(request.password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long"
            )
        
        # Create user
        user = User(
            email=request.email,
            password_hash=get_password_hash(request.password),
            full_name=request.full_name,
            organization=request.organization,
            role=UserRole.ANALYST,  # Default role
            is_active=True,
            is_verified=False,
            created_at=datetime.utcnow()
        )
        
        await user.save()
        
        # Send verification email
        await notification_service.send_verification_email(user)
        
        logger.info(f"User registered: {user.email}")
        
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            organization=user.organization,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/login", response_model=TokenResponse)
async def login_user(request: LoginRequest):
    """Authenticate user and return JWT tokens."""
    try:
        # Get user by email
        user = await User.get_by_email(request.email)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Verify password
        if not verify_password(request.password, user.password_hash):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="Account is deactivated"
            )
        
        # Check 2FA if enabled
        if user.totp_secret:
            if not request.totp_code:
                raise HTTPException(
                    status_code=401,
                    detail="2FA code required"
                )
            
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(request.totp_code, valid_window=1):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid 2FA code"
                )
        
        # Update last login
        user.last_login = datetime.utcnow()
        await user.save()
        
        # Create tokens
        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role.value}
        )
        refresh_token = create_refresh_token(
            data={"sub": user.id}
        )
        
        logger.info(f"User logged in: {user.email}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=3600  # 1 hour
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Refresh access token using refresh token."""
    try:
        # Verify refresh token
        payload = verify_token(refresh_token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )
        
        # Get user
        user = await User.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User not found or inactive"
            )
        
        # Create new access token
        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role.value}
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # Keep same refresh token
            expires_in=3600
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(status_code=500, detail="Token refresh failed")

@router.post("/setup-2fa", response_model=TwoFactorSetup)
async def setup_two_factor(
    current_user: dict = Depends(lambda: verify_token(credentials.credentials))
):
    """Setup 2FA for the current user."""
    try:
        user_id = current_user["sub"]
        user = await User.get_by_id(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Generate TOTP secret
        totp_secret = pyotp.random_base32()
        
        # Generate QR code
        totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
            name=user.email,
            issuer_name="ZeroHack"
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        qr_code_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        
        # Generate backup codes
        backup_codes = [secrets.token_hex(4) for _ in range(10)]
        
        # Store secret and backup codes (hashed)
        user.totp_secret = totp_secret
        user.backup_codes = [get_password_hash(code) for code in backup_codes]
        await user.save()
        
        return TwoFactorSetup(
            secret=totp_secret,
            qr_code=f"data:image/png;base64,{qr_code_base64}",
            backup_codes=backup_codes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"2FA setup failed: {e}")
        raise HTTPException(status_code=500, detail="2FA setup failed")

@router.post("/verify-2fa")
async def verify_two_factor(
    totp_code: str,
    current_user: dict = Depends(lambda: verify_token(credentials.credentials))
):
    """Verify 2FA setup with a test code."""
    try:
        user_id = current_user["sub"]
        user = await User.get_by_id(user_id)
        
        if not user or not user.totp_secret:
            raise HTTPException(status_code=400, detail="2FA not set up")
        
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(totp_code, valid_window=1):
            return {"verified": True, "message": "2FA setup verified successfully"}
        else:
            raise HTTPException(status_code=400, detail="Invalid 2FA code")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"2FA verification failed: {e}")
        raise HTTPException(status_code=500, detail="2FA verification failed")

@router.post("/logout")
async def logout_user(
    current_user: dict = Depends(lambda: verify_token(credentials.credentials))
):
    """Logout user (invalidate tokens on client side)."""
    # In a production system, you might want to maintain a blacklist of tokens
    # For now, we'll just return success and let the client handle token removal
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(lambda: verify_token(credentials.credentials))
):
    """Get current user information."""
    try:
        user_id = current_user["sub"]
        user = await User.get_by_id(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            organization=user.organization,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user info")
