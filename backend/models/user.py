"""
User Data Models
Pydantic models for user management and authentication
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """Base user model with common fields"""
    email: EmailStr = Field(..., description="User email address")
    username: Optional[str] = Field(None, min_length=3, max_length=100, description="Username")
    full_name: Optional[str] = Field(None, max_length=200, description="Full name")


class UserCreate(UserBase):
    """Model for creating a new user (registration)"""
    password: str = Field(..., min_length=6, max_length=128, description="Password")


class UserLogin(BaseModel):
    """Model for user login"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="Password")


class UserUpdate(BaseModel):
    """Model for updating user profile - all fields optional"""
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)
    avatar_url: Optional[str] = None


class User(UserBase):
    """Complete user model with ID and timestamps (no password)"""
    id: int = Field(..., description="Unique identifier")
    role: str = Field(default="user", description="User role")
    is_active: bool = Field(default=True, description="Account active status")
    is_verified: bool = Field(default=False, description="Email verified status")
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user: User


class SocialLoginComplete(BaseModel):
    """Model for completing social login via OAuth relay"""
    oauth_token: str = Field(..., description="JWT token from Coderblock OAuth relay")
    provider: str = Field(default="google", description="OAuth provider (google or github)")
