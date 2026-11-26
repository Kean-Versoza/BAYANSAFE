"""A small on-screen keyboard for players without a physical keyboard.

It is driven by the same arrow/button events the ESP32 bridge already sends:
stick = move, button 1 = pick, button 2 = backspace, button 3/4 = close.
The login screen opens it when a text field is activated.

Only this widget's text should be queued while it is visible: the theme draws
all text in a single flush above the scaled canvas, so any text queued by the
screen underneath would otherwise appear on top of the keyboard panel.
"""
from __future__ import annotations

import pygame

from src.ui import theme

PANEL = pygame.Rect(18, 12, 284, 148)

ROWS = (
    "abcdefghij",
    "klmnopqrst",
    "uvwxyz0123",
    "456789-_@.",
)
SPECIAL = ("SHIFT", "SPACE", "BKSP", "ESC", "DONE")

GRID_X, GRID_Y = 31, 45
KEY_W, KEY_H, GAP_X, GAP_Y = 24, 14, 2, 3
SPECIAL_X, SPECIAL_Y = 24, 114
SPECIAL_W = (42, 84, 46, 40, 44)
SPECIAL_GAP = 4


class OnScreenKeyboard:
    """Modal key picker. Call :meth:`open`, then feed it events from the state."""

    def __init__(self):
        self.visible = False
        self.field = None
        self.row = 0
        self.col = 0
        self.shift = False
        self.time = 0.0

    # ---------- lifecycle ----------
    def open(self, field):
        self.visible = True
        self.field = field
        self.row = 0
        self.col = 0
        self.shift = False

    def close(self):
        self.visible = False
        self.field = None

    # ---------- navigation ----------
    def _row_len(self, row):
        return len(ROWS[row]) if row < len(ROWS) else len(SPECIAL)

    def move(self, dx=0, dy=0):
        if dy:
            self.row = (self.row + dy) % (len(ROWS) + 1)
            self.col = min(self.col, self._row_len(self.row) - 1)
        if dx:
            self.col = (self.col + dx) % self._row_len(self.row)

    def selection(self):
        """Return ``(action, value)`` for the highlighted key."""
        if self.row < len(ROWS):
            char = ROWS[self.row][self.col]
            return "char", char.upper() if self.shift and char.isalpha() else char
        key = SPECIAL[self.col]
        if key == "SHIFT":
            return "shift", None
        if key == "SPACE":
            return "char", " "
        if key == "BKSP":
            return "backspace", None
        # ESC and DONE both dismiss the keyboard.
        return "close", None

    def update(self, dt):
        self.time += dt

    def contains(self, pos):
        return PANEL.collidepoint(pos)

    def hit_test(self, pos):
        """Return the key index ``(row, col)`` under a canvas position, or None."""
        x, y = pos
        for r, row in enumerate(ROWS):
            for c in range(len(row)):
                rect = pygame.Rect(GRID_X + c * (KEY_W + GAP_X),
                                   GRID_Y + r * (KEY_H + GAP_Y), KEY_W, KEY_H)
                if rect.collidepoint(x, y):
                    return r, c
        cursor = SPECIAL_X
        for c, width in enumerate(SPECIAL_W):
            rect = pygame.Rect(cursor, SPECIAL_Y, width, KEY_H)
            if rect.collidepoint(x, y):
                return len(ROWS), c
            cursor += width + SPECIAL_GAP
        return None

    # ---------- drawing ----------
    @staticmethod
    def _key(surface, rect, label, selected, accent=False, danger=False, pulse=0.0):
        pygame.draw.rect(surface, theme.SHADOW, rect.move(0, 2))
        fill = theme.WOOD_LIGHT if selected else (theme.WOOD_DARK if accent else theme.PLUM_LIGHT)
        border = theme.BRASS_LIGHT if selected else (theme.CORAL if danger else
                                                     (theme.BRASS if accent else theme.WOOD_BORDER))
        pygame.draw.rect(surface, fill, rect)
        pygame.draw.rect(surface, border, rect, 1)
        color = theme.CREAM if selected or accent else theme.CREAM_DIM
        if selected:
            # a thin brass underline pulses on the highlighted key
            y = rect.bottom - 3
            pygame.draw.line(surface, theme.HONEY, (rect.x + 3, y), (rect.right - 4, y),
                             1 + (1 if int(pulse * 4) % 2 else 0))
        theme.draw_text(surface, label, rect.center, "tiny", color,
                        shadow=False, anchor="center")

    def draw(self, surface, value="", label="", secret=False):
        theme.draw_panel(surface, PANEL, accent=theme.HONEY)
        theme.draw_text(surface, "ON-SCREEN KEYBOARD", (160, 16), "tiny",
                        theme.HONEY, anchor="midtop")

        # Live preview of the field being edited.
        shown = ("*" * len(value)) if secret else value
        if not shown:
            shown = "..."
        theme.draw_text(surface, f"{label}: {shown}"[:38], (160, 29), "tiny",
                        theme.CREAM_DIM, anchor="midtop")
        pygame.draw.line(surface, theme.WOOD_BORDER,
                         (PANEL.x + 6, 41), (PANEL.right - 7, 41))

        for r, row in enumerate(ROWS):
            for c, char in enumerate(row):
                rect = pygame.Rect(GRID_X + c * (KEY_W + GAP_X),
                                   GRID_Y + r * (KEY_H + GAP_Y), KEY_W, KEY_H)
                text = char.upper() if self.shift and char.isalpha() else char
                self._key(surface, rect, text, self.row == r and self.col == c,
                          pulse=self.time)

        x = SPECIAL_X
        for c, (name, width) in enumerate(zip(SPECIAL, SPECIAL_W)):
            rect = pygame.Rect(x, SPECIAL_Y, width, KEY_H)
            text = "SHIFT*" if name == "SHIFT" and self.shift else name
            self._key(surface, rect, text, self.row == len(ROWS) and self.col == c,
                      accent=name in ("SPACE", "DONE"), danger=name == "ESC",
                      pulse=self.time)
            x += width + SPECIAL_GAP

        theme.draw_text(surface, "STICK: MOVE   BTN1: PICK   BTN2: ERASE",
                        (160, 133), "tiny", theme.CREAM_DIM, anchor="midtop")
        theme.draw_text(surface, "ESC KEY / BTN3 / BTN4: CLOSE",
                        (160, 145), "tiny", theme.CREAM_DIM, anchor="midtop")
