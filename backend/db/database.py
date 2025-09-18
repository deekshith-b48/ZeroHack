"""
Database configuration and connection management.
"""

import os
import logging
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Database configuration
DATABASE_URL = os.getenv(
    "ZEROHACK_DATABASE_URL", 
    "sqlite:///./zerohack.db"
)

# Convert SQLite URL to async if needed
if DATABASE_URL.startswith("sqlite://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# Create async engine
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=os.getenv("ZEROHACK_DB_ECHO", "false").lower() == "true",
    poolclass=StaticPool if "sqlite" in ASYNC_DATABASE_URL else None,
    connect_args={"check_same_thread": False} if "sqlite" in ASYNC_DATABASE_URL else {}
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Create base class for models
Base = declarative_base()

# Metadata for table creation
metadata = MetaData()

async def init_db():
    """Initialize database tables."""
    try:
        logger.info("🗄️ Initializing database...")
        
        # Import all models to ensure they're registered
        from backend.db.models import User, Incident, Notification
        
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("✅ Database initialized successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        raise

async def get_db():
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
