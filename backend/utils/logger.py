"""
Centralized logging configuration.
"""

import logging
import sys
from typing import Optional

def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Get configured logger instance."""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        # Set log level
        log_level = level or "INFO"
        logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logger.level)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(console_handler)
        
        # Prevent duplicate logs
        logger.propagate = False
    
    return logger
