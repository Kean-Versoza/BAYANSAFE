"""Small HTTP client for the BayanSafe website API.

The desktop game signs in against the same Express/PostgreSQL service the
website uses, so one account works in both places. The sign-in cookie is kept
in a cookie jar, which means every later request is authenticated without the
game ever seeing a password again.

``urllib`` from the standard library is used on purpose: no extra dependency
is needed, and the service is a plain JSON API.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar


ENV_URL = "BAYANSAFE_SERVER_URL"
DEFAULT_URL = "https://bayansafe.vercel.app"


class WebApiError(Exception):
    """A readable error returned by the website (or a connection failure)."""

    def __init__(self, message, status=None, payload=None):
        super().__init__(message)
        self.message = str(message)
        self.status = status
        self.payload = payload or {}

    @property
    def pending(self):
        return bool(self.payload.get("pending"))


class WebApiClient:
    """Sign-in client for the website behind ``BAYANSAFE_SERVER_URL``."""

    def __init__(self, base_url=None, timeout=5.0):
        self.base_url = (base_url or os.environ.get(ENV_URL, DEFAULT_URL)).strip().rstrip("/")
        self.timeout = float(timeout)
        self._jar = CookieJar()
        self._opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self._jar)
        )
        self.user = None

    # ------------------------------------------------------------------
    # Low level
    # ------------------------------------------------------------------
    def request(self, method, path, data=None):
        """Call the API and return its decoded JSON body."""
        url = self.base_url + path
        body = None
        headers = {"Accept": "application/json"}
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            payload = self._decode(raw)
            raise WebApiError(
                payload.get("error") or f"The server returned {exc.code}.",
                exc.code,
                payload,
            ) from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            raise WebApiError(f"Cannot reach the website: {reason}") from exc
        except (OSError, TimeoutError) as exc:
            raise WebApiError(f"Cannot reach the website: {exc}") from exc

        payload = self._decode(raw)
        if payload.get("ok") is False:
            raise WebApiError(
                payload.get("error") or "The website could not sign you in.",
                None,
                payload,
            )
        return payload

    @staticmethod
    def _decode(raw):
        if not raw:
            return {}
        try:
            value = json.loads(raw)
        except (ValueError, TypeError):
            return {}
        return value if isinstance(value, dict) else {}

    # ------------------------------------------------------------------
    # Sign in methods (all use the website's own database)
    # ------------------------------------------------------------------
    def _signed_in(self, payload):
        self.user = payload.get("user")
        return self.user

    def login(self, username, password):
        """Sign in with a website username (or email) and password."""
        return self._signed_in(self.request("POST", "/api/account/login", {
            "username": username,
            "password": password,
        }))

    def login_rfid(self, uid):
        """Sign in with a scanned card (no PIN required)."""
        return self._signed_in(self.request("POST", "/api/account/rfid/login", {
            "uid": uid,
        }))

    def google_token(self, token):
        """Sign in with a Google ID token obtained in the browser."""
        return self._signed_in(self.request("POST", "/api/auth/google", {"token": token}))

    def session(self):
        """Return the signed-in user, or None when the cookie is absent/expired."""
        try:
            payload = self.request("GET", "/api/account/session")
        except WebApiError:
            self.user = None
            return None
        if not payload.get("signedIn"):
            self.user = None
            return None
        return self._signed_in(payload)

    def logout(self):
        try:
            self.request("POST", "/api/account/logout")
        except WebApiError:
            pass
        self.user = None

    # ------------------------------------------------------------------
    # Device link (used by the in-game "Sign in with Google" option)
    # ------------------------------------------------------------------
    def device_start(self):
        payload = self.request("POST", "/api/client/device/start")
        return payload.get("code"), payload.get("url", "")

    def device_token(self, code):
        """Return ``(pending, user)`` for a device code."""
        payload = self.request("POST", "/api/client/device/token", {"code": code})
        return False, self._signed_in(payload)
