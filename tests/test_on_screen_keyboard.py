"""Regression checks for the joystick-driven on-screen keyboard."""
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import unittest
from types import SimpleNamespace

import pygame

from src.core import settings
from src.states.login_state import LoginState
from src.ui import theme


class OnScreenKeyboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        pygame.display.set_mode((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))
        theme._font_cache.clear()

    def setUp(self):
        game = SimpleNamespace(
            web_api=None,
            session=SimpleNamespace(web_user=None),
            to_canvas_pos=lambda pos: pos,
            ask_quit=lambda: None,
        )
        self.state = LoginState(game)

    def _key(self, code):
        self.state.handle_event(pygame.event.Event(pygame.KEYDOWN, key=code))

    def _go_to(self, row, col):
        kb = self.state.keyboard
        while kb.row > row:
            self._key(pygame.K_UP)
        while kb.row < row:
            self._key(pygame.K_DOWN)
        while kb.col > col:
            self._key(pygame.K_LEFT)
        while kb.col < col:
            self._key(pygame.K_RIGHT)
        self.assertEqual((kb.row, kb.col), (row, col))

    def test_field_activation_opens_keyboard_and_types(self):
        state = self.state
        self.assertEqual(state.focus, 0)
        self._key(pygame.K_RETURN)          # BTN1 on the username field
        self.assertTrue(state.keyboard.visible)
        self._go_to(0, 0)                   # 'a'
        self._key(pygame.K_RETURN)
        self.assertEqual(state.username, "a")
        self._go_to(0, 1)                   # 'b'
        self._key(pygame.K_RETURN)
        self.assertEqual(state.username, "ab")

    def test_backspace_space_shift_and_done(self):
        state = self.state
        self._key(pygame.K_RETURN)          # open keyboard
        self._key(pygame.K_RETURN)          # 'a'
        self._key(pygame.K_BACKSPACE)       # BTN2 erases
        self.assertEqual(state.username, "")
        self._go_to(4, 1)                   # SPACE
        self._key(pygame.K_RETURN)
        self.assertEqual(state.username, " ")
        self._go_to(4, 0)                   # SHIFT
        self._key(pygame.K_RETURN)
        self.assertTrue(state.keyboard.shift)
        self._go_to(0, 0)                   # uppercase 'A'
        self._key(pygame.K_RETURN)
        self.assertEqual(state.username, " A")
        self._go_to(4, 3)                   # ESC key on the keyboard
        self.assertEqual(state.keyboard.selection(), ("close", None))
        self._key(pygame.K_RETURN)
        self.assertFalse(state.keyboard.visible)

    def test_done_key_closes_keyboard(self):
        state = self.state
        self._key(pygame.K_RETURN)          # open keyboard
        self._go_to(4, 4)                   # DONE
        self.assertEqual(state.keyboard.selection(), ("close", None))
        self._key(pygame.K_RETURN)
        self.assertFalse(state.keyboard.visible)

    def test_special_row_has_five_keys(self):
        from src.ui.on_screen_keyboard import SPECIAL, SPECIAL_W
        self.assertEqual(SPECIAL, ("SHIFT", "SPACE", "BKSP", "ESC", "DONE"))
        self.assertEqual(len(SPECIAL_W), len(SPECIAL))

    def test_keyboard_closes_on_cancel_button(self):
        state = self.state
        self._key(pygame.K_RETURN)
        self.assertTrue(state.keyboard.visible)
        self._key(pygame.K_ESCAPE)          # BTN4 / cancel
        self.assertFalse(state.keyboard.visible)

    def test_physical_typing_still_works_with_overlay_closed(self):
        state = self.state
        state.handle_event(pygame.event.Event(pygame.TEXTINPUT, text="juan"))
        self.assertEqual(state.username, "juan")

    def test_underlying_text_is_not_queued_while_keyboard_is_open(self):
        from src.core import settings
        from src.ui import theme

        state = self.state
        surface = pygame.Surface((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

        theme.TEXT_QUEUE.clear()
        state.draw(surface)
        self.assertGreater(len(theme.TEXT_QUEUE), 0)

        state.keyboard.open("username")
        theme.TEXT_QUEUE.clear()
        state.draw(surface)
        queued = [entry[1] for entry in theme.TEXT_QUEUE]
        self.assertIn("ON-SCREEN KEYBOARD", queued)
        for hidden in ("SIGN IN TO PLAY", "CONTINUE WITH GOOGLE", "PLAY OFFLINE"):
            self.assertNotIn(hidden, queued)

    def test_keyboard_panel_fits_above_footer(self):
        from src.core import settings
        from src.ui.on_screen_keyboard import PANEL
        self.assertLessEqual(PANEL.right, settings.INTERNAL_WIDTH)
        self.assertGreaterEqual(PANEL.left, 0)
        # The panel must clear the menu's 14px tip strip at the bottom.
        self.assertLessEqual(PANEL.bottom, settings.INTERNAL_HEIGHT - 14)


if __name__ == "__main__":
    unittest.main()
