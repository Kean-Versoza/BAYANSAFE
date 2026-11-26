"""Serial controller for the BayanSafe ESP32 joystick/button bridge.

The ESP32 sketch prints lines like::

    JOY,x,y,b1,b2,b3,b4       x/y in -100..100, buttons 0/1

This reader turns that stream into the same keyboard events the desktop game
already understands, and exposes the analog vector for omnidirectional
movement.  Set ``BAYANSAFE_ESP32_PORT`` (e.g. ``COM3``) before launching the
game, or leave it unset to auto-detect an ESP32/USB-serial port.

Do not run ``hardware/esp32_rfid_handler.py`` on the same COM port at the same
time -- a serial port can only be opened by one program.
"""
from __future__ import annotations

import os
import queue
import threading
import time

import pygame

try:
    import serial  # type: ignore
    import serial.tools.list_ports  # type: ignore

    SERIAL_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    serial = None  # type: ignore
    SERIAL_AVAILABLE = False


ENV_PORT = "BAYANSAFE_ESP32_PORT"
ENV_BAUD = "BAYANSAFE_ESP32_BAUD"

# Keep in sync with PygameController.BUTTON_ACTIONS.
BUTTON_KEYS = (
    pygame.K_RETURN,    # button 1: next / confirm / pick up / equip
    pygame.K_BACKSPACE, # button 2: back / cancel / throw / unequip
    pygame.K_TAB,       # button 3: select / objective
    pygame.K_p,         # button 4: start / pause
)

AXIS_KEYS = (
    pygame.K_LEFT,
    pygame.K_RIGHT,
    pygame.K_UP,
    pygame.K_DOWN,
)

# Shared analog vector, read by Player.get_direction() without needing a
# reference to the controller instance.
_SERIAL_ANALOG = [0.0, 0.0]
_ANALOG_LOCK = threading.Lock()

# Card UIDs printed by the sketch ("Card detected: AABBCCDD"). The login screen
# drains this queue; other game states simply ignore it.
_CARD_QUEUE = queue.Queue()
_LAST_CARD = ("", 0.0)
_CARD_DEDUPE_S = 3.0


def get_serial_analog():
    """Return ``(x, y)`` in -1..1 from the ESP32 stick (0,0 when inactive)."""
    with _ANALOG_LOCK:
        return (_SERIAL_ANALOG[0], _SERIAL_ANALOG[1])


def _set_serial_analog(x: float, y: float):
    with _ANALOG_LOCK:
        _SERIAL_ANALOG[0] = x
        _SERIAL_ANALOG[1] = y


def get_pending_cards():
    """Return (and clear) card UIDs scanned since the last call."""
    cards = []
    while True:
        try:
            cards.append(_CARD_QUEUE.get_nowait())
        except queue.Empty:
            break
    return cards


def _note_card(uid: str):
    """Queue a card unless it is the same tap repeated a moment ago."""
    global _LAST_CARD
    uid = uid.strip().upper()
    if not uid or any(char not in "0123456789ABCDEF" for char in uid):
        return
    now = time.monotonic()
    last_uid, last_at = _LAST_CARD
    if uid == last_uid and now - last_at < _CARD_DEDUPE_S:
        return
    _LAST_CARD = (uid, now)
    print(f"[esp32] card detected: {uid}", flush=True)
    _CARD_QUEUE.put(uid)


def list_ports():
    if not SERIAL_AVAILABLE:
        return []
    return list(serial.tools.list_ports.comports())


def detect_port():
    """Best-effort guess of the ESP32 port; returns '' when unsure."""
    hints = ("esp32", "cp210", "ch340", "silicon labs", "usb-serial")
    for info in list_ports():
        text = f"{info.device} {info.description} {getattr(info, 'manufacturer', '')}"
        if any(h in text.lower() for h in hints):
            return info.device
    return ""


class Esp32SerialController:
    """Background serial reader that produces pygame key events.

    Parameters
    ----------
    port:
        Serial port name. When ``None``, ``BAYANSAFE_ESP32_PORT`` is used,
        falling back to auto-detection.
    baud:
        Serial speed (default 115200, matching the sketch).
    deadzone:
        Fraction of the stick ignored around centre (default 0.28).
    """

    def __init__(self, port=None, baud=None, deadzone=0.28,
                 repeat_delay=0.36, repeat_rate=0.16):
        if port is None:
            port = os.environ.get(ENV_PORT, "").strip() or detect_port()
        if baud is None:
            try:
                baud = int(os.environ.get(ENV_BAUD, "115200"))
            except ValueError:
                baud = 115200

        self.port = str(port or "")
        self.baud = int(baud)
        self.deadzone = float(deadzone)
        self.repeat_delay = float(repeat_delay)
        self.repeat_rate = float(repeat_rate)

        self.enabled = bool(self.port) and SERIAL_AVAILABLE
        self._stop = threading.Event()
        self._thread = None
        self._state_lock = threading.Lock()

        self.buttons = [False] * 4
        self._prev_buttons = [False] * 4
        self.axis = {key: False for key in AXIS_KEYS}
        self._prev_axis = {key: False for key in AXIS_KEYS}
        self._repeat_timers = {key: 0.0 for key in AXIS_KEYS}

        self.last_error = ""
        self._last_error_log = 0.0

        if self.enabled:
            self._thread = threading.Thread(
                target=self._read_loop, name="esp32-serial", daemon=True
            )
            self._thread.start()
            print(f"[esp32] reading joystick from {self.port} @ {self.baud}")
        elif self.port and not SERIAL_AVAILABLE:
            print("[esp32] pyserial is not installed; controller disabled.", flush=True)

    # ------------------------------------------------------------------
    # Serial worker
    # ------------------------------------------------------------------
    def _log_error_once(self, message):
        self.last_error = str(message)
        now = time.monotonic()
        if now - self._last_error_log >= 10.0:
            print(f"[esp32] {message}", flush=True)
            self._last_error_log = now

    def _read_loop(self):
        while not self._stop.is_set():
            try:
                handle = serial.Serial(self.port, self.baud, timeout=1)
            except Exception as exc:
                self._log_error_once(f"could not open {self.port}: {exc}")
                self._stop.wait(2.0)
                continue

            self._log_error_once("connected")
            try:
                while not self._stop.is_set():
                    try:
                        raw = handle.readline()
                    except Exception as exc:
                        self._log_error_once(f"read error: {exc}")
                        break
                    if not raw:
                        continue
                    try:
                        line = raw.decode("utf-8", errors="replace").strip()
                    except Exception:
                        continue
                    if line.startswith("JOY,"):
                        self._parse(line)
                    elif line.startswith("Card detected:"):
                        _note_card(line.split(":", 1)[1])
            finally:
                try:
                    handle.close()
                except Exception:
                    pass
                _set_serial_analog(0.0, 0.0)
                if not self._stop.is_set():
                    self._log_error_once("disconnected; retrying...")
                    self._stop.wait(2.0)

    def _parse(self, line: str):
        parts = line.split(",")
        if len(parts) < 7:
            return
        try:
            x = int(parts[1])
            y = int(parts[2])
            buttons = [1 if int(v) != 0 else 0 for v in parts[3:7]]
        except (ValueError, IndexError):
            return

        with self._state_lock:
            for i in range(4):
                self.buttons[i] = bool(buttons[i])

            # Normalise -100..100 -> -1..1 and apply deadzone.
            fx = x / 100.0
            fy = y / 100.0
            if abs(fx) <= self.deadzone:
                fx = 0.0
            if abs(fy) <= self.deadzone:
                fy = 0.0
            _set_serial_analog(fx, fy)

            self.axis[pygame.K_LEFT] = fx < -self.deadzone
            self.axis[pygame.K_RIGHT] = fx > self.deadzone
            self.axis[pygame.K_UP] = fy < -self.deadzone
            self.axis[pygame.K_DOWN] = fy > self.deadzone

    # ------------------------------------------------------------------
    # Event generation (same contract as PygameController)
    # ------------------------------------------------------------------
    @staticmethod
    def _post_key(key):
        return pygame.event.Event(pygame.KEYDOWN, key=key, repeat=False)

    def poll_events(self, dt):
        """Return key-down events for new button presses and stick directions."""
        if not self.enabled:
            return []
        events = []

        with self._state_lock:
            buttons = list(self.buttons)
            axis = dict(self.axis)

        for i, key in enumerate(BUTTON_KEYS):
            if buttons[i] and not self._prev_buttons[i]:
                events.append(self._post_key(key))
            self._prev_buttons[i] = buttons[i]

        for key in AXIS_KEYS:
            active = axis.get(key, False)
            was_active = self._prev_axis[key]
            if active:
                self._repeat_timers[key] -= dt
                if not was_active or self._repeat_timers[key] <= 0:
                    events.append(self._post_key(key))
                    self._repeat_timers[key] = (
                        self.repeat_delay if not was_active else self.repeat_rate
                    )
            else:
                self._repeat_timers[key] = 0.0
            self._prev_axis[key] = active

        return events

    def close(self):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
        _set_serial_analog(0.0, 0.0)
