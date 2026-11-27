"""The first screen in the game: sign in with the website account.

Three online options share the website's PostgreSQL accounts:
  * username + password       -> POST /api/account/login
  * Google (device link)      -> browser page -> POST /api/client/device/*
  * RFID card                 -> ESP32 serial -> POST /api/account/rfid/login

"PLAY OFFLINE" skips sign-in so the game still works without the web service.

The screen deliberately reuses the main menu's living backdrop, wooden plank
buttons and HUD widgets so signing in feels like part of the same world.
"""
from __future__ import annotations

import math
import queue
import threading
import webbrowser

import pygame

from src.core import audio
from src.core.web_api import WebApiError
from src.hardware.esp32_serial_controller import get_pending_cards
from src.states.base_state import BaseState
from src.states.main_menu import MainMenu
from src.ui import menu_fx, theme
from src.ui.backdrop import MenuBackdrop
from src.ui.button import Button
from src.ui.on_screen_keyboard import OnScreenKeyboard

# 8x8 icons in the same pixel style as the main menu's icons.
LOGIN_ICONS = {
    "key": ["..###...", ".#...#..", ".#...#..", "..###...",
            "...#....", "...###..", "...#....", "........"],
    "google": ["..####..", ".##..##.", "##......", "##......",
               "##.####.", "##...##.", ".##..##.", "..####.."],
    "card": [".######.", ".#....#.", ".#.##.#.", ".#....#.",
             ".#....#.", ".#.##.#.", ".######.", "........"],
}
theme.ICONS.update(LOGIN_ICONS)

# Layout, in canvas pixels (the canvas is 320x180).
PANEL = pygame.Rect(38, 58, 244, 108)
LABEL_X = 48
FIELD_X, FIELD_W, FIELD_H = 104, 166, 14
USER_Y, PASS_Y = 71, 87
STATUS_Y = 102
BUTTON_X, BUTTON_W, BUTTON_H = 50, 220, 12
BUTTON_YS = (112, 125, 138, 151)
SLIDE_DELAY, SLIDE_STAGGER, SLIDE_TIME = 0.15, 0.07, 0.30


class LoginState(BaseState):
    USER_RECT = pygame.Rect(FIELD_X, USER_Y, FIELD_W, FIELD_H)
    PASS_RECT = pygame.Rect(FIELD_X, PASS_Y, FIELD_W, FIELD_H)
    BUTTON_RECTS = [pygame.Rect(BUTTON_X, y, BUTTON_W, BUTTON_H)
                    for y in BUTTON_YS]

    # The last plank is "PLAY OFFLINE" on the form, "CANCEL" in the other modes.
    SIGN_IN, GOOGLE, RFID, LAST = range(4)
    CANCEL = LAST

    def __init__(self, game):
        super().__init__(game)
        self.time = 0.0
        self.api = game.web_api
        self.backdrop = MenuBackdrop()
        self._slid = set()

        self.mode = "form"                # form | rfid | google
        self.busy = False
        self.message = "Sign in, or play offline."
        self.is_error = False

        self.username = ""
        self.password = ""
        self.pending_uid = ""
        self.keyboard = OnScreenKeyboard()

        self.google_code = ""
        self.google_url = ""
        self.google_poll_in = 0.0

        self.focus = 0
        self.widgets = []
        self._results = queue.Queue()

        self.buttons = []
        self._build_buttons()
        self._build_widgets()
        audio.warm()

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------
    def _build_buttons(self):
        entries = [
            ("SIGN IN", "key", self.sign_in),
            ("CONTINUE WITH GOOGLE", "google", self.sign_in_google),
            ("USE RFID CARD", "card", self.sign_in_rfid),
            ("PLAY OFFLINE", "house", self.play_offline),
        ]
        self.buttons = [
            Button(text, rect, action, icon=icon, press_delay=0.12)
            for (text, icon, action), rect in zip(entries, self.BUTTON_RECTS)
        ]
        self._refresh_buttons()

    def _refresh_buttons(self):
        """Keep each plank's label/action in step with the current mode."""
        sign_in = self.buttons[self.SIGN_IN]
        if self.mode == "form":
            sign_in.text = "SIGN IN"
            sign_in.callback = self.sign_in
            sign_in.enabled = bool(self.username.strip() and self.password)
            self.buttons[self.GOOGLE].callback = self.sign_in_google
            self.buttons[self.RFID].callback = self.sign_in_rfid
            self.buttons[self.LAST].text = "PLAY OFFLINE"
            self.buttons[self.LAST].callback = self.play_offline
            for i in (self.GOOGLE, self.RFID, self.LAST):
                self.buttons[i].enabled = True
        else:
            # While a network/RFID operation is in progress the first three
            # planks are hints; only CANCEL is actionable.
            sign_in.enabled = False
            for i in (self.GOOGLE, self.RFID):
                self.buttons[i].enabled = False
            self.buttons[self.CANCEL].text = "CANCEL"
            self.buttons[self.CANCEL].callback = self.cancel
            self.buttons[self.CANCEL].enabled = True

        if self.busy:
            for button in self.buttons:
                button.enabled = False
        self._update_selection()

    def _build_widgets(self):
        widgets = []
        if self.mode == "form":
            widgets.extend([
                ("field", "username", self.USER_RECT),
                ("field", "password", self.PASS_RECT),
            ])
        widgets.extend(("button", i, button.rect)
                       for i, button in enumerate(self.buttons))
        self.widgets = widgets
        self.focus = max(0, min(self.focus, len(widgets) - 1))
        self._update_selection()

    def _update_selection(self):
        focused = self.widgets[self.focus] if self.widgets else None
        for i, button in enumerate(self.buttons):
            button.selected = focused == ("button", i, button.rect)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def enter(self):
        pygame.key.start_text_input()

    def exit(self):
        pygame.key.stop_text_input()

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------
    def _say(self, text, error=False):
        self.message = str(text)
        self.is_error = error

    def _async(self, name, work):
        if self.busy:
            return
        self.busy = True
        self._refresh_buttons()
        threading.Thread(target=self._worker, args=(name, work), daemon=True).start()

    def _worker(self, name, work):
        try:
            self._results.put((name, True, work()))
        except WebApiError as exc:
            self._results.put((name, False, exc))
        except Exception as exc:                 # pragma: no cover - safety net
            self._results.put((name, False, WebApiError(str(exc))))

    def sign_in(self):
        if self.busy or not self.username.strip() or not self.password:
            return
        self._say("Signing in...")
        self._async("password", lambda: self.api.login(
            self.username.strip(), self.password))

    def sign_in_rfid(self):
        if self.busy:
            return
        self.mode = "rfid"
        self.pending_uid = ""
        self.focus = self.CANCEL
        self._say("Tap your RFID card on the reader...")
        self._build_widgets()
        self._refresh_buttons()

    def sign_in_google(self):
        if self.busy:
            return
        self._say("Contacting the website...")
        self._async("device_start", self.api.device_start)

    def play_offline(self):
        audio.play("confirm")
        self._finish(None)

    def cancel(self):
        if self.busy:
            return
        audio.play("back")
        self.mode = "form"
        self.pending_uid = ""
        self.google_code = ""
        self.focus = 0
        self._say("Sign in, or play offline.")
        self._build_widgets()
        self._refresh_buttons()

    def _try_rfid(self, uid):
        self.pending_uid = uid
        self._say("Checking your card...")
        self._async("rfid", lambda: self.api.login_rfid(uid))

    def _finish(self, user):
        self.busy = False
        session = self.game.session
        session.set_account_identity(user)
        audio.play("confirm")
        self.game.state_manager.change(MainMenu(self.game))

    # ------------------------------------------------------------------
    # Results from network threads
    # ------------------------------------------------------------------
    def _drain_results(self):
        while not self._results.empty():
            name, ok, value = self._results.get()
            self.busy = False
            try:
                if name == "password":
                    if ok:
                        self._finish(value)
                        return
                    self._say(value.message, error=True)
                elif name == "rfid":
                    if ok:
                        self._finish(value)
                        return
                    self._say(value.message, error=True)
                elif name == "device_start":
                    if not ok:
                        self._say(value.message, error=True)
                    else:
                        self.google_code, self.google_url = value
                        if not self.google_code:
                            self._say("The website did not return a sign-in code.", error=True)
                        else:
                            self.mode = "google"
                            self.focus = self.CANCEL
                            self.google_poll_in = 1.0
                            self._say("Sign in on the website to continue...")
                            try:
                                webbrowser.open(self.google_url)
                            except Exception:
                                pass
                            self._build_widgets()
                elif name == "google_poll":
                    if ok:
                        self._finish(value)
                        return
                    if getattr(value, "pending", False):
                        self.google_poll_in = 1.5
                    else:
                        self._say(value.message, error=True)
            finally:
                self._refresh_buttons()

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(self, dt):
        self.time += dt
        self.keyboard.update(dt)
        for name, volume in self.backdrop.consume_sounds():
            audio.play(name, volume)

        # The same slide-in the main menu uses for its entries.
        for i, button in enumerate(self.buttons):
            p = max(0.0, min(1.0, (self.time - SLIDE_DELAY
                                  - i * SLIDE_STAGGER) / SLIDE_TIME))
            if p > 0 and i not in self._slid:
                self._slid.add(i)
                audio.play("whoosh", 0.4)
            button.offset_x = -int((1 - p) ** 3 * 170)
            button.update(dt)

        self._drain_results()
        if self.mode == "form" or self.busy:
            return

        # A tap is a sign-in request in its own right - accept it on the main
        # sign-in form too, so players never have to hunt for the RFID plank.
        if self.mode in ("form", "rfid"):
            for card in get_pending_cards():
                self._try_rfid(card)
                break
        elif self.mode == "google":
            self.google_poll_in -= dt
            if self.google_poll_in <= 0:
                self.google_poll_in = 1.5
                code = self.google_code
                self._async("google_poll", lambda: self.api.device_token(code)[1])

    # ------------------------------------------------------------------
    # Input
    # ------------------------------------------------------------------
    def _focused_field(self):
        item = self.widgets[self.focus] if self.widgets else None
        return item[1] if item and item[0] == "field" else None

    def _field_value(self, key):
        return {"username": self.username, "password": self.password}.get(key, "")

    def _set_field_value(self, key, value):
        if key == "username":
            self.username = value
        elif key == "password":
            self.password = value
        self._refresh_buttons()

    def _move_focus(self, step):
        if not self.widgets:
            return
        self.focus = (self.focus + step) % len(self.widgets)
        audio.play("tick", 0.3)
        self._update_selection()

    def _append_text(self, key, text):
        """Apply a chunk of typing with each field's character rules."""
        if not key or self.busy:
            return
        if key == "username":
            text = "".join(char for char in text if char.isalnum() or char in "@._- ")
        else:
            text = "".join(char for char in text if char.isprintable())
        limit = 32 if key == "username" else 64
        self._set_field_value(key, (self._field_value(key) + text)[:limit])
        self._say("Sign in, or play offline.")

    def _erase(self, key):
        if key and not self.busy:
            self._set_field_value(key, self._field_value(key)[:-1])

    def _activate(self):
        item = self.widgets[self.focus] if self.widgets else None
        if not item:
            return
        if item[0] == "button":
            self.buttons[item[1]].activate()
        else:
            # Joystick players can't type: open the on-screen keyboard.
            self.keyboard.open(item[1])
            audio.play("confirm")

    def _apply_key_action(self, action, value):
        kb = self.keyboard
        if action == "char":
            self._append_text(kb.field, value)
            audio.play("tick", 0.25)
        elif action == "backspace":
            self._erase(kb.field)
            audio.play("tick", 0.25)
        elif action == "shift":
            kb.shift = not kb.shift
            audio.play("tick", 0.3)
        elif action == "close":
            kb.close()
            audio.play("back")

    def _handle_keyboard_event(self, event):
        """Feed events to the overlay; return True when it consumed the event."""
        kb = self.keyboard
        if event.type == pygame.TEXTINPUT:
            self._append_text(kb.field, event.text)
            return True

        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_LEFT, pygame.K_a):
                kb.move(dx=-1)
            elif event.key in (pygame.K_RIGHT, pygame.K_d):
                kb.move(dx=1)
            elif event.key in (pygame.K_UP, pygame.K_w):
                kb.move(dy=-1)
            elif event.key in (pygame.K_DOWN, pygame.K_s):
                kb.move(dy=1)
            elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE):
                self._apply_key_action(*kb.selection())
            elif event.key == pygame.K_BACKSPACE:
                self._erase(kb.field)
                audio.play("tick", 0.25)
            elif event.key in (pygame.K_ESCAPE, pygame.K_TAB, pygame.K_p):
                kb.close()
                audio.play("back")
            return True

        if event.type == pygame.MOUSEMOTION:
            hit = kb.hit_test(self.game.to_canvas_pos(event.pos))
            if hit is not None:
                kb.row, kb.col = hit
            return True

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            pos = self.game.to_canvas_pos(event.pos)
            if not kb.contains(pos):
                kb.close()
            else:
                hit = kb.hit_test(pos)
                if hit is not None:
                    kb.row, kb.col = hit
                    self._apply_key_action(*kb.selection())
            return True
        return False

    def _hit_widget(self, pos):
        for index, item in enumerate(self.widgets):
            if item[0] == "button":
                hit = self.buttons[item[1]].contains(pos)
            else:
                hit = item[2].collidepoint(pos)
            if hit:
                return index
        return None

    def handle_event(self, event):
        if self.keyboard.visible and self._handle_keyboard_event(event):
            return

        if event.type == pygame.TEXTINPUT:
            key = self._focused_field()
            if key is None and self.widgets:
                for item in self.widgets:
                    if item[0] == "field":
                        key = item[1]
                        break
            self._append_text(key, event.text)
            return

        if event.type == pygame.KEYDOWN:
            key = self._focused_field()
            if event.key == pygame.K_TAB:
                self._move_focus(1)
            elif event.key in (pygame.K_UP, pygame.K_w):
                self._move_focus(-1)
            elif event.key in (pygame.K_DOWN, pygame.K_s):
                self._move_focus(1)
            elif event.key in (pygame.K_LEFT, pygame.K_a):
                self._move_focus(-1)
            elif event.key in (pygame.K_RIGHT, pygame.K_d):
                self._move_focus(1)
            elif event.key == pygame.K_BACKSPACE:
                if key is None and self.widgets:
                    for item in self.widgets:
                        if item[0] == "field":
                            key = item[1]
                            break
                if key and not self.busy:
                    self._erase(key)
                else:
                    self.cancel() if self.mode != "form" else self.game.ask_quit()
            elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                self._activate()
            elif event.key == pygame.K_ESCAPE:
                self.cancel() if self.mode != "form" else self.game.ask_quit()
            return

        if event.type == pygame.MOUSEMOTION:
            pos = self.game.to_canvas_pos(event.pos)
            self.backdrop.look_at(pos[0])
            hit = self._hit_widget(pos)
            if hit is not None and hit != self.focus:
                self.focus = hit
                self._update_selection()
                audio.play("tick", 0.2)
            return

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            pos = self.game.to_canvas_pos(event.pos)
            hit = self._hit_widget(pos)
            if hit is not None:
                self.focus = hit
                self._update_selection()
                item = self.widgets[hit]
                if item[0] == "button":
                    self.buttons[item[1]].activate()
                else:
                    self.keyboard.open(item[1])
                    audio.play("confirm")

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    @staticmethod
    def _fit(text, width):
        """Trim a status line so it stays on one row of the panel."""
        text = str(text)
        font = theme.get_font("tiny")
        if font.size(text)[0] <= width:
            return text
        while len(text) > 1 and font.size(text + "...")[0] > width:
            text = text[:-1]
        return text.rstrip() + "..."

    def _draw_field(self, surface, rect, label, value, placeholder, focused,
                    secret=False):
        theme.draw_text(surface, label, (LABEL_X, rect.centery), "tiny",
                        theme.HONEY if focused else theme.CREAM_DIM,
                        shadow=False, anchor="midleft")
        pygame.draw.rect(surface, theme.SHADOW, rect.move(0, 1))
        pygame.draw.rect(surface, theme.PARCHMENT_LIGHT if focused
                         else theme.PARCHMENT, rect)
        pygame.draw.rect(surface, theme.BRASS_LIGHT if focused
                         else theme.WOOD_BORDER, rect, 1)
        shown = "*" * len(value) if secret else value
        if shown:
            theme.draw_text(surface, shown, (rect.x + 3, rect.centery), "tiny",
                            theme.INK, shadow=False, anchor="midleft")
        else:
            theme.draw_text(surface, placeholder, (rect.x + 3, rect.centery),
                            "tiny", (128, 106, 80), shadow=False,
                            anchor="midleft")
        if focused and int(self.time * 2) % 2 == 0:
            cx = rect.x + 3 + theme.get_font("tiny").size(shown)[0]
            if cx < rect.right - 2:
                pygame.draw.rect(surface, theme.INK,
                                 (cx, rect.y + 2, 1, rect.h - 4))

    def _draw_card(self, surface, cx, cy):
        """A little parchment RFID card with pulsing reader waves."""
        card = pygame.Rect(cx - 22, cy - 13, 44, 26)
        pygame.draw.rect(surface, theme.SHADOW, card.move(1, 2))
        pygame.draw.rect(surface, theme.PARCHMENT, card)
        pygame.draw.rect(surface, theme.BRASS, card, 1)
        pygame.draw.rect(surface, (166, 130, 66), (cx - 12, cy - 6, 12, 9))
        pygame.draw.rect(surface, (108, 80, 42), (cx - 12, cy - 6, 12, 9), 1)
        for i in range(3):
            r = 9 + i * 5 + (1 + int(math.sin(self.time * 3 - i * 0.6) * 1.5))
            pygame.draw.arc(surface, theme.SKY, (cx - r, cy - r, 2 * r, 2 * r),
                            -0.8, 0.8, 1)

    def _draw_google(self, surface):
        theme.draw_text(surface, "SIGN IN IN YOUR BROWSER", (160, 71),
                        "tiny", theme.CREAM_DIM, anchor="midtop")
        theme.draw_text(surface, self.google_code, (160, 82), "small",
                        theme.HONEY, anchor="midtop")
        dots = "." * (1 + int(self.time * 2) % 3)
        theme.draw_text(surface, "WAITING FOR SIGN-IN" + dots, (160, 93),
                        "tiny", theme.SKY, anchor="midtop")

    def draw(self, surface):
        # Same living island scene as the main menu.
        self.backdrop.draw(surface, self.time)

        if self.keyboard.visible:
            # The theme flushes every queued string above the scaled canvas in
            # one pass, so any text queued by the screen underneath would be
            # drawn over the keyboard panel. Draw only the footer (below the
            # panel) and the keyboard while the overlay is up.
            menu_fx.draw_footer(surface, self.time)
            field = self.keyboard.field
            self.keyboard.draw(
                surface,
                self._field_value(field),
                "USERNAME" if field == "username" else "PASSWORD",
                secret=field == "password",
            )
            return

        if self.backdrop.has_title:
            self.backdrop.draw_title(surface, (160, 34))
        else:
            theme.draw_text(surface, "BAYANSAFE", (160, 28), "title",
                            theme.HONEY, anchor="center")
        menu_fx.draw_alert_chip(surface, self.time, self.backdrop.level,
                                self.backdrop.hazard)
        menu_fx.draw_gobag(surface, self.time)

        # The sign-in card: a carved wood panel with parchment input slots.
        theme.draw_panel(surface, PANEL, accent=theme.HONEY)
        theme.draw_text(surface, "SIGN IN TO PLAY", (160, PANEL.y + 3), "tiny",
                        theme.HONEY, anchor="midtop")
        pygame.draw.line(surface, theme.mix(theme.PLUM, theme.HONEY, 0.35),
                         (PANEL.x + 4, PANEL.y + 12),
                         (PANEL.right - 5, PANEL.y + 12))

        focused = self._focused_field()
        if self.mode == "form":
            self._draw_field(surface, self.USER_RECT, "USERNAME", self.username,
                             "Username or email", focused == "username")
            self._draw_field(surface, self.PASS_RECT, "PASSWORD", self.password,
                             "Password", focused == "password", secret=True)
        elif self.mode == "rfid":
            self._draw_card(surface, 160, 86)
        elif self.mode == "google":
            self._draw_google(surface)

        color = theme.CORAL if self.is_error else theme.CREAM_DIM
        theme.draw_text(surface, self._fit(self.message, PANEL.w - 16),
                        (160, STATUS_Y), "tiny", color, anchor="midtop")

        for button in self.buttons:
            button.draw(surface, self.time)

        menu_fx.draw_footer(surface, self.time)
        menu_fx.draw_banner(surface, self.backdrop.fx)
