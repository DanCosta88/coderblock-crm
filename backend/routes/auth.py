from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db
import bcrypt
import jwt as pyjwt
import os
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])
SECRET_KEY = os.environ.get("SECRET_KEY", "crm-coderblock-2024-secret")
ALGORITHM = "HS256"


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = "Danilo"


class UserLogin(BaseModel):
    email: str
    password: str


def create_token(user_id: int, email: str, full_name: str):
    payload = {
        "sub": str(user_id),
        "email": email,
        "full_name": full_name,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        result = db.execute(
            text("SELECT id, email, full_name, role FROM users WHERE id = :id AND is_active = true"),
            {"id": user_id}
        ).fetchone()
        if not result:
            raise HTTPException(status_code=401, detail="User not found")
        return {"id": result[0], "email": result[1], "full_name": result[2], "role": result[3]}
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register")
async def register(data: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": data.email}).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
    role = "admin" if count == 0 else "user"
    result = db.execute(text(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES (:email, :pw, :name, :role) RETURNING id, email, full_name, role"
    ), {"email": data.email, "pw": pw_hash, "name": data.full_name or "Danilo", "role": role})
    db.commit()
    user = result.fetchone()
    token = create_token(user[0], user[1], user[2])
    return {"access_token": token, "user": {"id": user[0], "email": user[1], "full_name": user[2], "role": user[3]}}


@router.post("/login")
async def login(data: UserLogin, db: Session = Depends(get_db)):
    result = db.execute(
        text("SELECT id, email, password_hash, full_name, role FROM users WHERE email = :email AND is_active = true"),
        {"email": data.email}
    ).fetchone()
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(data.password.encode(), result[2].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(result[0], result[1], result[3])
    return {"access_token": token, "user": {"id": result[0], "email": result[1], "full_name": result[3], "role": result[4]}}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
