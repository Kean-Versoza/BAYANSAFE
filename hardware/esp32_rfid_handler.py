#!/usr/bin/env python3
"""Handle RFID card data coming from an ESP32.

The ESP32 can deliver card UIDs in two ways:

* over USB serial (the sketch prints one UID per line), or
* over Wi-Fi (the sketch POSTs JSON to this script's HTTP endpoint).

Either way each UID is normalised the same way as shared/rfid.js, then:

  * appended to a CSV log file (rfid_log.csv by default), and
  * inserted into the PostgreSQL ``rfid_scans`` table, and
  * optionally forwarded to the BayanSafe Node server (/api/rfid/scan).

Usage
-----
Serial mode (default)::

    py hardware/esp32_rfid_handler.py --port COM3 --baud 115200

HTTP mode (run a receiver the ESP32 posts to)::

    py hardware/esp32_rfid_handler.py --http 8090

Both at once::

    py hardware/esp32_rfid_handler.py --port COM3 --http 8090

Environment variables (or a .env next to this file) are honoured:

    DATABASE_URL   postgresql://bayansafe:bayansafe@localhost:5432/bayansafe
    SERVER_URL     http://localhost:3000
    RFID_BRIDGE_TOKEN   shared secret, must match server/.env
    LOG_FILE       path to the CSV log
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Optional dependencies. We keep the script usable even when one of them is
# missing (for example when only the file logging part is wanted).
# ---------------------------------------------------------------------------
try:
    import serial  # type: ignore
    import serial.tools.list_ports  # type: ignore

    SERIAL_AVAILABLE = True
except Exception:  # pragma: no cover
    SERIAL_AVAILABLE = False

try:
    import psycopg2  # type: ignore

    DB_AVAILABLE = True
except Exception:  # pragma: no cover
    DB_AVAILABLE = False

try:
    import requests  # type: ignore

    REQUESTS_AVAILABLE = True
except Exception:  # pragma: no cover
    REQUESTS_AVAILABLE = False


# ---------------------------------------------------------------------------
# Normalisation - must stay in sync with shared/rfid.js
# ---------------------------------------------------------------------------
CARD_RE = re.compile(r"^[A-Z0-9]{4,32}$")


def clean_card_number(value):
    if not isinstance(value, str):
        return ""
    value = value.strip().upper()
    value = re.sub(r"^0X", "", value)
    value = re.sub(r"[^A-Z0-9]", "", value)
    return value


def normalize_card_number(value):
    clean = clean_card_number(value)
    if not CARD_RE.fullmatch(clean):
        return ""
    trimmed = clean.lstrip("0")
    if len(trimmed) >= 4:
        return trimmed
    return clean


def extract_card_number(line):
    if not isinstance(line, str):
        return ""
    matches = re.findall(r"[0-9A-F]{4,}", line.upper())
    if not matches:
        return ""
    return normalize_card_number(matches[-1])


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
def load_env_file(path):
    """Tiny .env loader so we don't need python-dotenv."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


HERE = Path(__file__).resolve().parent
load_env_file(HERE / ".env")
load_env_file(HERE.parent / "server" / ".env")


def env(name, default=""):
    return os.environ.get(name, default).strip()


DATABASE_URL = env("DATABASE_URL", "postgresql://bayansafe:bayansafe@localhost:5432/bayansafe")
SERVER_URL = env("SERVER_URL", "http://localhost:3000")
BRIDGE_TOKEN = env("RFID_BRIDGE_TOKEN", "")
DEFAULT_LOG = env("LOG_FILE", str(HERE / "rfid_log.csv"))


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------
def ensure_db_table(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS rfid_scans (
                id          SERIAL PRIMARY KEY,
                uid         TEXT NOT NULL,
                source      TEXT NOT NULL DEFAULT 'esp32',
                raw         TEXT,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_rfid_scans_uid ON rfid_scans (uid)")
    conn.commit()


def db_connect(database_url):
    if not DB_AVAILABLE:
        return None
    try:
        conn = psycopg2.connect(database_url)
        ensure_db_table(conn)
        return conn
    except Exception as exc:  # pragma: no cover
        print(f"[db] could not connect: {exc}", file=sys.stderr)
        return None


def append_csv(log_path, record):
    path = Path(log_path)
    is_new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if is_new:
            writer.writerow(["received_at", "uid", "source", "raw"])
        writer.writerow(
            [record["received_at"], record["uid"], record["source"], record["raw"]]
        )


def insert_db(conn, record):
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO rfid_scans (uid, source, raw, received_at) VALUES (%s, %s, %s, %s)",
                (record["uid"], record["source"], record["raw"], record["received_at"]),
            )
        conn.commit()
    except Exception as exc:  # pragma: no cover
        print(f"[db] insert failed: {exc}", file=sys.stderr)
        try:
            conn.rollback()
        except Exception:
            pass


def forward_to_server(record):
    if not SERVER_URL:
        return
    url = SERVER_URL.rstrip("/") + "/api/rfid/scan"
    headers = {"Content-Type": "application/json"}
    if BRIDGE_TOKEN:
        headers["x-bridge-token"] = BRIDGE_TOKEN
    payload = {"uid": record["uid"]}
    try:
        if REQUESTS_AVAILABLE:
            requests.post(url, json=payload, headers=headers, timeout=5)
        else:
            import urllib.request

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            urllib.request.urlopen(req, timeout=5)
    except Exception as exc:  # pragma: no cover
        print(f"[forward] {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Core handler
# ---------------------------------------------------------------------------
class Handler:
    def __init__(self, log_path, db_conn, forward, source):
        self.log_path = log_path
        self.db_conn = db_conn
        self.forward = forward
        self.source = source
        self.lock = threading.Lock()

    def handle(self, raw, source=None):
        source = source or self.source
        uid = extract_card_number(raw if isinstance(raw, str) else str(raw))
        if not uid:
            # Maybe the payload is already a bare UID without hex grouping.
            uid = normalize_card_number(str(raw).strip())
        if not uid:
            print(f"[skip] not a card number: {raw!r}", file=sys.stderr)
            return None

        record = {
            "uid": uid,
            "raw": str(raw).strip(),
            "source": source,
            "received_at": datetime.now(timezone.utc).isoformat(),
        }

        with self.lock:
            append_csv(self.log_path, record)
            insert_db(self.db_conn, record)
        print(f"[scan] {uid}  (source={source})")

        if self.forward:
            threading.Thread(target=forward_to_server, args=(record,), daemon=True).start()
        return record


# ---------------------------------------------------------------------------
# Serial mode
# ---------------------------------------------------------------------------
def serial_loop(port, baud, handler, stop_event):
    if not SERIAL_AVAILABLE:
        print("pyserial is not installed; cannot read from a serial port.", file=sys.stderr)
        return
    print(f"[serial] opening {port} @ {baud}")
    try:
        ser = serial.Serial(port, baud, timeout=1)
    except Exception as exc:
        print(f"[serial] could not open {port}: {exc}", file=sys.stderr)
        return
    try:
        while not stop_event.is_set():
            try:
                line = ser.readline().decode("utf-8", errors="replace").strip()
            except Exception as exc:
                print(f"[serial] read error: {exc}", file=sys.stderr)
                time.sleep(1)
                continue
            if line:
                handler.handle(line, source=f"esp32-serial:{port}")
    finally:
        ser.close()
        print("[serial] closed")


def list_ports():
    if not SERIAL_AVAILABLE:
        return []
    return [p.device for p in serial.tools.list_ports.comports()]


# ---------------------------------------------------------------------------
# HTTP mode
# ---------------------------------------------------------------------------
class _HttpHandler(BaseHTTPRequestHandler):
    handler: Handler = None  # set before server starts

    def _send(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-bridge-token")
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self._send(200, {"ok": True, "ports": list_ports()})
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw_body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except json.JSONDecodeError:
            payload = {}
        # Accept {uid}, {card}, or a plain text body.
        uid_raw = ""
        if isinstance(payload, dict):
            uid_raw = payload.get("uid") or payload.get("card") or payload.get("rfid") or ""
        if not uid_raw and raw_body:
            uid_raw = raw_body.decode("utf-8", errors="replace")

        if BRIDGE_TOKEN:
            given = self.headers.get("x-bridge-token", "")
            if given != BRIDGE_TOKEN:
                self._send(401, {"ok": False, "error": "bad bridge token"})
                return

        record = self.handler.handle(uid_raw, source="esp32-http")
        if record is None:
            self._send(400, {"ok": False, "error": "that is not a card number"})
        else:
            self._send(200, {"ok": True, "uid": record["uid"]})

    def log_message(self, *args):
        # keep the console tidy
        pass


def http_loop(port, handler, stop_event):
    _HttpHandler.handler = handler
    server = ThreadingHTTPServer(("0.0.0.0", port), _HttpHandler)
    server.timeout = 1
    print(f"[http] listening on 0.0.0.0:{port}")
    try:
        while not stop_event.is_set():
            server.handle_request()
    finally:
        server.server_close()
        print("[http] closed")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def parse_args():
    parser = argparse.ArgumentParser(description="Handle RFID data from an ESP32.")
    parser.add_argument("--port", help="Serial port, e.g. COM3 or /dev/ttyUSB0")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate")
    parser.add_argument("--http", type=int, help="Run an HTTP receiver on this port")
    parser.add_argument("--log", default=DEFAULT_LOG, help="CSV log file path")
    parser.add_argument("--db-url", default=DATABASE_URL, help="PostgreSQL connection URL")
    parser.add_argument("--no-db", action="store_true", help="Disable database storage")
    parser.add_argument("--no-forward", action="store_true", help="Do not forward to the Node server")
    parser.add_argument("--source", default="esp32", help="Default source label")
    parser.add_argument("--list-ports", action="store_true", help="List serial ports and exit")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.list_ports:
        print("Serial ports:")
        for p in list_ports():
            print("  " + p)
        return

    if not args.port and not args.http:
        print("Nothing to do: pass --port (serial) and/or --http (receiver).", file=sys.stderr)
        print("Use --list-ports to see available serial ports.", file=sys.stderr)
        sys.exit(1)

    db_conn = None
    if not args.no_db:
        db_conn = db_connect(args.db_url)
        if db_conn is not None:
            print("[db] connected")

    handler = Handler(
        log_path=args.log,
        db_conn=db_conn,
        forward=not args.no_forward,
        source=args.source,
    )

    stop_event = threading.Event()

    def on_signal(_sig, _frame):
        stop_event.set()

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    threads = []
    if args.port:
        t = threading.Thread(
            target=serial_loop, args=(args.port, args.baud, handler, stop_event), daemon=True
        )
        threads.append(t)
        t.start()
    if args.http:
        t = threading.Thread(target=http_loop, args=(args.http, handler, stop_event), daemon=True)
        threads.append(t)
        t.start()

    print("[handler] running. Press Ctrl+C to stop.")
    try:
        while not stop_event.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        stop_event.set()

    for t in threads:
        t.join(timeout=3)
    if db_conn is not None:
        db_conn.close()
    print("[handler] stopped")


if __name__ == "__main__":
    main()
