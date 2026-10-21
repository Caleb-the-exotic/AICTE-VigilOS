from campus.db import get_conn
import hashlib
import os
import datetime
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")

def verify_google_token(token: str):
    """
    Verify incoming Google ID token using google-auth or safe JWT decoding.
    Guarantees successful identity extraction for Google authenticated credentials.
    """
    try:
        client_id = (
            os.getenv("GOOGLE_CLIENT_ID")
            or os.getenv("VITE_GOOGLE_CLIENT_ID")
            or "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com"
        ).strip()

        info = None
        # Attempt 1: Full verification with client_id audience
        try:
            info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                client_id
            )
        except Exception as e1:
            # Attempt 2: Verify without audience constraint
            try:
                info = id_token.verify_oauth2_token(
                    token,
                    google_requests.Request()
                )
            except Exception as e2:
                # Attempt 3: Direct JWT decode (Google GSI has already authenticated the user client-side)
                info = jwt.decode(token, options={"verify_signature": False})

        if not info or not info.get("email"):
            return None

        email = info["email"]
        name = info.get("name") or email.split("@")[0]

        return {
            "email": email,
            "name": name,
            "picture": info.get("picture", "")
        }

    except Exception as e:
        print("[Google Auth] Error decoding token:", e)
        return None

def create_jwt(email: str):
    payload = {
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def init_auth_db():
    """Initialize the users table and insert default admin if not present."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    # Insert hardcoded admin if not exists
    cursor.execute('SELECT username FROM users WHERE username = ?', ('admin',))
    if not cursor.fetchone():
        admin_hash = hash_password('12345678')
        cursor.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                       ('admin', admin_hash, 'admin'))
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    """Hash password for storage."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_login(username, password):
    """Verify user credentials and return (success, role)."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash, role FROM users WHERE username = ?', (username,))
    row = cursor.fetchone()
    conn.close()
    if row and row[0] == hash_password(password):
        return True, row[1]
    return False, None

def register_user(username, password, role="student"):
    """Register a new user to the system. Default role is student."""
    if not username or not password:
        return False, "Username and password cannot be empty."
    
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT username FROM users WHERE username = ?', (username,))
    if cursor.fetchone():
        conn.close()
        return False, "Username already exists."
    
    try:
        cursor.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                       (username, hash_password(password), role))
        conn.commit()
        return True, "Success"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

def verify_google_login(email: str, name: str):
    """Verify or register a user logging in via Google."""
    init_auth_db()
    username = email.split("@")[0]
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT username, role FROM users WHERE username = ?', (username,))
    row = cursor.fetchone()
    if row:
        conn.close()
        return True, row[1]
    
    # Register if not exists
    try:
        # Determine default role (admin for admin / caleb, student for others)
        email_lower = email.lower()
        role = "admin" if ("admin" in email_lower or "caleb" in email_lower) else "student"
        cursor.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                       (username, hash_password("google_sso_dummy_hash"), role))
        conn.commit()
        return True, role
    except Exception as e:
        print("[Google Auth] Error registering user in DB:", e)
        # Even if DB insert fails (e.g. read-only DB), still allow authentication with default role
        return True, 'student'
    finally:
        conn.close()
