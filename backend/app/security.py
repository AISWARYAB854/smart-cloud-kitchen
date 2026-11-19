from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User, Role

passwords = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)

def token_for(user):
    return jwt.encode({"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, settings.jwt_secret, algorithm="HS256")

def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        user = db.get(User, int(payload["sub"]))
        if not user:
            raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(401, "Please sign in to continue")

def require_roles(*roles):
    def check(user: User = Depends(current_user), db: Session = Depends(get_db)):
        if db.get(Role, user.role_id).name not in roles:
            raise HTTPException(403, "You do not have access to this module")
        return user
    return check
