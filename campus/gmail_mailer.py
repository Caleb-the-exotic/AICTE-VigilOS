# ============================================================
# campus/gmail_mailer.py — Gmail API v1 Mailer for AICTE VigilOS
# ============================================================
# Sends transactional OTP and notification emails via the official
# Gmail REST API using OAuth 2.0 Refresh Tokens.
# ============================================================

import os
import base64
import time
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# Cache for access token: (token, expiry_timestamp)
_cached_token: Optional[Tuple[str, float]] = None

def get_gmail_credentials():
    """Retrieve OAuth credentials from environment."""
    client_id = (
        os.getenv("GOOGLE_CLIENT_ID")
        or os.getenv("VITE_GOOGLE_CLIENT_ID")
        or "178410841874-gd0mdctpo2g4s4n6govmen71v5nqp96a.apps.googleusercontent.com"
    ).strip()
    client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
    refresh_token = (os.getenv("GMAIL_REFRESH_TOKEN") or "").strip()
    sender_email = (os.getenv("GMAIL_SENDER_EMAIL") or "2204caleb2007@gmail.com").strip()

    return client_id, client_secret, refresh_token, sender_email

def get_access_token() -> str:
    """
    Exchange refresh token for a fresh short-lived access token using
    Google's OAuth2 token endpoint. Caches token until 2 minutes before expiry.
    """
    global _cached_token
    now = time.time()
    if _cached_token and _cached_token[1] > now + 120:
        return _cached_token[0]

    client_id, client_secret, refresh_token, _ = get_gmail_credentials()
    if not refresh_token or not client_secret:
        raise ValueError("GMAIL_REFRESH_TOKEN or GOOGLE_CLIENT_SECRET is missing from environment.")

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    resp = requests.post(token_url, data=payload, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to refresh Google access token: {resp.status_code} {resp.text}")

    data = resp.json()
    access_token = data.get("access_token")
    expires_in = data.get("expires_in", 3600)

    if not access_token:
        raise RuntimeError(f"No access_token returned by Google: {data}")

    _cached_token = (access_token, now + expires_in)
    return access_token

def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """
    Send an email via the Gmail API v1 messages.send endpoint.
    """
    _, _, _, sender_email = get_gmail_credentials()
    access_token = get_access_token()

    msg = MIMEMultipart("alternative")
    msg["From"] = f"AICTE VigilOS Security <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    send_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {"raw": raw_message}

    res = requests.post(send_url, json=payload, headers=headers, timeout=12)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Gmail API error {res.status_code}: {res.text}")

    return True

def send_otp_email(to_email: str, otp_code: str, name: Optional[str] = None, purpose: str = "Password Reset") -> bool:
    """
    Send a beautifully formatted AICTE VigilOS security OTP email.
    """
    recipient_name = name or to_email.split("@")[0].title()
    subject = f"[{otp_code}] Your AICTE VigilOS Verification Code"

    # Spaced out code for easy readability
    formatted_code = " ".join(list(str(otp_code)))

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>{subject}</title>
      <style>
        body {{
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f17;
          color: #f1f5f9;
          margin: 0;
          padding: 24px;
        }}
        .container {{
          max-width: 540px;
          margin: 0 auto;
          background-color: #111827;
          border: 1px solid #1f293d;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }}
        .header {{
          background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #991b1b 100%);
          padding: 28px 24px;
          text-align: center;
          color: #ffffff;
        }}
        .logo-title {{
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0;
        }}
        .subtitle {{
          font-size: 12px;
          opacity: 0.9;
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }}
        .content {{
          padding: 32px 28px;
        }}
        .greeting {{
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 12px;
        }}
        .text {{
          font-size: 14px;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 24px;
        }}
        .otp-box {{
          background-color: #030712;
          border: 1px solid #dc2626;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin: 24px 0;
        }}
        .otp-label {{
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #f87171;
          margin-bottom: 8px;
        }}
        .otp-code {{
          font-size: 32px;
          font-weight: 800;
          font-family: 'Courier New', Courier, monospace;
          letter-spacing: 8px;
          color: #ffffff;
          margin: 0;
        }}
        .expiry-notice {{
          font-size: 12px;
          color: #64748b;
          text-align: center;
          margin-top: 8px;
        }}
        .alert {{
          background-color: #1e293b;
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 12px;
          color: #cbd5e1;
          margin-top: 24px;
          line-height: 1.5;
        }}
        .footer {{
          background-color: #0a0f1d;
          border-top: 1px solid #1e293b;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
        }}
        .footer a {{
          color: #f87171;
          text-decoration: none;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-title">AICTE VigilOS</h1>
          <div class="subtitle">Official Security Verification Service</div>
        </div>
        <div class="content">
          <div class="greeting">Hello {recipient_name},</div>
          <div class="text">
            We received a request for <strong>{purpose}</strong> on your AICTE VigilOS account. Use the verification code below to authorize this action:
          </div>

          <div class="otp-box">
            <div class="otp-label">One-Time Password (OTP)</div>
            <div class="otp-code">{formatted_code}</div>
            <div class="expiry-notice">Valid for 10 minutes · Single use only</div>
          </div>

          <div class="alert">
            <strong>Security Notice:</strong> If you did not initiate this password reset request, please disregard this email. Your account credentials remain secure.
          </div>
        </div>
        <div class="footer">
          <div>All India Council for Technical Education (AICTE) · Central Vigilance Portal</div>
          <div>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070</div>
          <div style="margin-top: 6px;"><a href="https://aicte-vigil-os.vercel.app/">https://aicte-vigil-os.vercel.app/</a></div>
        </div>
      </div>
    </body>
    </html>
    """

    plain_content = f"""AICTE VigilOS Security Verification

Hello {recipient_name},

Your verification code for {purpose} is:
{otp_code}

This code will expire in 10 minutes.

If you did not request this, please disregard this email.
All India Council for Technical Education (AICTE)
https://aicte-vigil-os.vercel.app/
"""

    return send_email(to_email, subject, html_content, plain_content)
