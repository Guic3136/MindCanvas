import base64
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from jose import jwt
from passlib.context import CryptContext
from core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fernet encryption for API keys
settings = get_settings()
kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=settings.encryption_salt.encode(),
    iterations=100_000,
)
_fernet_key = base64.urlsafe_b64encode(kdf.derive(settings.encryption_key.encode()))
_fernet = Fernet(_fernet_key)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def encrypt_value(value: str) -> str:
    return base64.urlsafe_b64encode(_fernet.encrypt(value.encode())).decode()


def decrypt_value(encrypted: str) -> str:
    return _fernet.decrypt(base64.urlsafe_b64decode(encrypted)).decode()


def mask_secret(secret: str, visible_chars: int = 4) -> str:
    if len(secret) <= visible_chars:
        return "***"
    return "*" * (len(secret) - visible_chars) + secret[-visible_chars:]
