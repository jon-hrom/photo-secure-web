import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = 'enc:'


def _get_fernet() -> Fernet:
    secret = os.environ.get('JWT_SECRET') or os.environ.get('EMAIL_CODE_SALT') or 'fallback-key'
    digest = hashlib.sha256(secret.encode('utf-8')).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_token(value: str) -> str:
    if not value:
        return ''
    if value.startswith(ENC_PREFIX):
        return value
    f = _get_fernet()
    token = f.encrypt(value.encode('utf-8')).decode('utf-8')
    return ENC_PREFIX + token


def decrypt_token(value: str) -> str:
    if not value:
        return ''
    if not value.startswith(ENC_PREFIX):
        return value
    f = _get_fernet()
    try:
        raw = f.decrypt(value[len(ENC_PREFIX):].encode('utf-8'))
        return raw.decode('utf-8')
    except (InvalidToken, ValueError):
        return ''
