"""
Email Service for user verification and notifications.
Uses Brevo (formerly SendinBlue) transactional email API.
"""
import logging
import secrets
from typing import Optional

import httpx
from core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Lightweight email service using Brevo HTTP API (no SDK needed)."""

    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender_email = settings.BREVO_SENDER_EMAIL
        self.sender_name = settings.BREVO_SENDER_NAME
        self.enabled = bool(self.api_key)
        if not self.enabled:
            logger.warning("BREVO_API_KEY not set — email verification disabled (users auto-verified)")

    @staticmethod
    def generate_verification_token() -> str:
        return secrets.token_urlsafe(32)

    async def send_verification_email(
        self,
        to_email: str,
        to_name: str,
        verification_token: str,
        app_name: str = "App",
    ) -> bool:
        """Send email verification link after registration."""
        if not self.enabled:
            logger.info(f"Email disabled — skipping verification email to {to_email}")
            return False

        frontend_url = settings.FRONTEND_URL.rstrip("/")
        verify_url = f"{frontend_url}/verify-email?token={verification_token}"

        html_content = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confirm your email</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;background:#f8fafc;margin:0;padding:20px}}
.c{{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden}}
.h{{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 30px;text-align:center;color:#fff}}
.h h1{{margin:0;font-size:24px;font-weight:600}}
.b{{padding:36px 30px}}
.b p{{color:#4a5568;font-size:15px;margin:0 0 16px}}
.btn{{display:inline-block;background:#6366f1;color:#fff!important;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;margin:20px 0}}
.f{{background:#f7fafc;padding:24px 30px;text-align:center;border-top:1px solid #e2e8f0}}
.f p{{color:#718096;font-size:13px;margin:4px 0}}
</style></head><body>
<div class="c">
<div class="h"><h1>Confirm your email</h1></div>
<div class="b">
<p>Thanks for signing up for <strong>{app_name}</strong>!</p>
<p>Please confirm your email address ({to_email}) by clicking the button below:</p>
<a href="{verify_url}" class="btn">Verify Email</a>
<p style="margin-top:24px;font-size:13px;color:#718096">If you didn&rsquo;t create an account, you can safely ignore this email.</p>
</div>
<div class="f"><p>&copy; {app_name}. Built with Coderblock.</p></div>
</div></body></html>"""

        return await self._send(
            to_email=to_email,
            to_name=to_name or to_email.split("@")[0],
            subject=f"Confirm your signup — {app_name}",
            html=html_content,
        )

    async def _send(self, to_email: str, to_name: str, subject: str, html: str) -> bool:
        headers = {"api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "sender": {"email": self.sender_email, "name": self.sender_name},
            "to": [{"email": to_email, "name": to_name}],
            "subject": subject,
            "htmlContent": html,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers=headers,
                    json=payload,
                )
            if resp.status_code == 201:
                logger.info(f"✅ Email sent to {to_email}")
                return True
            logger.error(f"Brevo error {resp.status_code}: {resp.text[:300]}")
            return False
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False


email_service = EmailService()
