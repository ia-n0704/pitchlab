"""
Outbound notifications. Currently just the email-verification code.

If SMTP is configured it sends a real email; otherwise (local dev / CI) it logs
the code and relies on `expose_verification_code` to surface it to the client,
so the verification flow works end-to-end without an email server.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

log = logging.getLogger(__name__)


def send_verification_code(email: str, code: str) -> None:
    if settings.smtp_host and settings.smtp_user and settings.smtp_password:
        msg = EmailMessage()
        msg["Subject"] = "[PitchLab] 이메일 인증 코드"
        msg["From"] = settings.smtp_from
        msg["To"] = email
        msg.set_content(f"PitchLab 인증 코드: {code}\n10분 내에 입력해 주세요.")
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as s:
                s.starttls()
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
            log.info("verification code sent to %s via SMTP", email)
            return
        except Exception:  # noqa: BLE001 — fall back to logging so signup still succeeds
            log.exception("SMTP send failed for %s; falling back to log", email)

    log.info("[DEV] verification code for %s: %s", email, code)
