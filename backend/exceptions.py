"""
Centralized exception handling for ZeroHack API.
Custom exceptions for consistent error responses across the application.
"""

from fastapi import HTTPException, status
from typing import Any, Dict, Optional


class ZeroHackException(Exception):
    """Base exception for ZeroHack application."""
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(ZeroHackException):
    """Authentication related errors."""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, details)


class AuthorizationError(ZeroHackException):
    """Authorization related errors."""
    
    def __init__(self, message: str = "Insufficient permissions", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_403_FORBIDDEN, details)


class ValidationError(ZeroHackException):
    """Data validation errors."""
    
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)


class NotFoundError(ZeroHackException):
    """Resource not found errors."""
    
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_404_NOT_FOUND, details)


class ConflictError(ZeroHackException):
    """Resource conflict errors."""
    
    def __init__(self, message: str = "Resource conflict", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_409_CONFLICT, details)


class ServiceUnavailableError(ZeroHackException):
    """Service unavailable errors."""
    
    def __init__(self, message: str = "Service unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status.HTTP_503_SERVICE_UNAVAILABLE, details)


# Specific business logic exceptions
class IncidentNotFoundError(NotFoundError):
    """Incident not found."""
    
    def __init__(self, incident_id: str):
        super().__init__(
            f"Incident with ID '{incident_id}' not found",
            details={"incident_id": incident_id}
        )


class UserNotFoundError(NotFoundError):
    """User not found."""
    
    def __init__(self, user_id: str):
        super().__init__(
            f"User with ID '{user_id}' not found",
            details={"user_id": user_id}
        )


class InvalidCredentialsError(AuthenticationError):
    """Invalid login credentials."""
    
    def __init__(self):
        super().__init__("Invalid email or password")


class AccountDeactivatedError(AuthenticationError):
    """Account is deactivated."""
    
    def __init__(self):
        super().__init__("Account is deactivated")


class Invalid2FACodeError(AuthenticationError):
    """Invalid 2FA code."""
    
    def __init__(self):
        super().__init__("Invalid 2FA code")


class InsufficientRoleError(AuthorizationError):
    """Insufficient role for operation."""
    
    def __init__(self, required_role: str, user_role: str):
        super().__init__(
            f"Role '{required_role}' required, but user has '{user_role}'",
            details={"required_role": required_role, "user_role": user_role}
        )


class AIModelNotReadyError(ServiceUnavailableError):
    """AI model not ready for inference."""
    
    def __init__(self, model_name: str):
        super().__init__(
            f"AI model '{model_name}' is not ready",
            details={"model_name": model_name}
        )


class BlockchainConnectionError(ServiceUnavailableError):
    """Blockchain connection failed."""
    
    def __init__(self, network: str):
        super().__init__(
            f"Failed to connect to blockchain network: {network}",
            details={"network": network}
        )


class EvidenceVerificationError(ValidationError):
    """Evidence verification failed."""
    
    def __init__(self, file_hash: str, reason: str):
        super().__init__(
            f"Evidence verification failed for file hash '{file_hash}': {reason}",
            details={"file_hash": file_hash, "reason": reason}
        )


class FileTooLargeError(ValidationError):
    """File size exceeds limit."""
    
    def __init__(self, max_size_mb: int):
        super().__init__(
            f"File size exceeds maximum limit of {max_size_mb}MB",
            details={"max_size_mb": max_size_mb}
        )


class DuplicateIncidentError(ConflictError):
    """Duplicate incident detected."""
    
    def __init__(self, incident_id: str):
        super().__init__(
            f"Incident with ID '{incident_id}' already exists",
            details={"incident_id": incident_id}
        )


class NotificationDeliveryError(ServiceUnavailableError):
    """Notification delivery failed."""
    
    def __init__(self, notification_type: str, reason: str):
        super().__init__(
            f"Failed to deliver {notification_type} notification: {reason}",
            details={"notification_type": notification_type, "reason": reason}
        )


# Exception handlers
def create_http_exception(exc: ZeroHackException) -> HTTPException:
    """Convert ZeroHackException to FastAPI HTTPException."""
    return HTTPException(
        status_code=exc.status_code,
        detail={
            "message": exc.message,
            "details": exc.details
        }
    )


def handle_zerohack_exception(exc: ZeroHackException) -> Dict[str, Any]:
    """Handle ZeroHackException and return error response."""
    return {
        "error": {
            "type": exc.__class__.__name__,
            "message": exc.message,
            "status_code": exc.status_code,
            "details": exc.details
        }
    }
