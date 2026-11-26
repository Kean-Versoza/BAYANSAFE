"""Tests for the desktop game's sign-in link to the website API."""
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from src.core.web_api import WebApiClient, WebApiError
from src.hardware import esp32_serial_controller as esp32


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, payload, cookie=False, clear=False):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            self.send_header("Set-Cookie", "bayansafe_user=test-token; Path=/; HttpOnly")
        if clear:
            self.send_header("Set-Cookie", "bayansafe_user=; Path=/; Max-Age=0")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(size) or b"{}")
        if self.path == "/api/account/login":
            if data.get("password") == "wrong":
                self._send({"ok": False, "error": "Wrong password."})
            else:
                self._send({"ok": True, "user": {"username": data["username"]}}, cookie=True)
        elif self.path == "/api/account/rfid/login":
            self._send({"ok": True, "user": {"username": "carduser"}}, cookie=True)
        elif self.path == "/api/client/device/start":
            self._send({"ok": True, "code": "ABCD1234", "url": "http://localhost:5173/game-login"})
        elif self.path == "/api/client/device/token":
            if data.get("code") == "ABCD1234":
                self._send({"ok": True, "user": {"username": "googleuser"}}, cookie=True)
            else:
                self._send({"ok": False, "pending": True})
        else:
            self._send({"ok": False, "error": "Not found"})

    def do_GET(self):
        signed = bool(self.headers.get("Cookie"))
        self._send({"signedIn": signed, "user": {"username": "signed"} if signed else None})


class WebLoginTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), _Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)

    def api(self):
        return WebApiClient(f"http://127.0.0.1:{self.port}", timeout=2)

    def test_password_login_keeps_session(self):
        api = self.api()
        self.assertEqual(api.login("juan", "secret")["username"], "juan")
        self.assertEqual(api.session()["username"], "signed")
        with self.assertRaises(WebApiError):
            api.login("juan", "wrong")

    def test_rfid_login_needs_no_pin(self):
        api = self.api()
        self.assertEqual(api.login_rfid("AABBCCDD")["username"], "carduser")

    def test_google_device_link(self):
        api = self.api()
        code, url = api.device_start()
        self.assertEqual(code, "ABCD1234")
        self.assertIn("game-login", url)
        with self.assertRaises(WebApiError) as caught:
            api.device_token("WRONG")
        self.assertTrue(caught.exception.pending)
        pending, user = api.device_token(code)
        self.assertFalse(pending)
        self.assertEqual(user["username"], "googleuser")

    def test_esp32_card_line_is_captured(self):
        while esp32.get_pending_cards():
            pass
        esp32._LAST_CARD = ("", 0.0)
        esp32._note_card("AABBCCDD")
        esp32._note_card("AABBCCDD")            # duplicate tap is ignored
        self.assertEqual(esp32.get_pending_cards(), ["AABBCCDD"])
        self.assertEqual(esp32.get_pending_cards(), [])


if __name__ == "__main__":
    unittest.main()
