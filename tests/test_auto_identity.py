"""A signed-in website account already supplies the player identity."""
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pygame

from src.core import settings
from src.core.session import GameSession
from src.states.character_select import CharacterSelect
from src.states.high_scores import HighScores


class AutoIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        pygame.display.set_mode((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

    def _game(self, web_user, challenger_id):
        session = GameSession()
        session.web_user = web_user
        session.challenger_id = challenger_id
        session.challenger_name = challenger_id
        return SimpleNamespace(
            session=session,
            state_manager=SimpleNamespace(pop=lambda: None, change=lambda _s: None),
            to_canvas_pos=lambda pos: pos,
            ask_quit=lambda: None,
        )

    def test_signed_in_player_skips_id_prompt(self):
        game = self._game({"username": "juan"}, "juan")
        screen = CharacterSelect(game)
        screen.confirm()
        self.assertFalse(screen.identity_editing)
        self.assertTrue(screen.leaving)
        self.assertEqual(game.session.challenger_id, "juan")
        self.assertEqual(game.session.challenger_name, "juan")

    def test_offline_player_still_types_an_id(self):
        game = self._game(None, "")
        screen = CharacterSelect(game)
        screen.confirm()
        self.assertTrue(screen.identity_editing)
        self.assertFalse(screen.leaving)

    def test_signed_in_without_username_falls_back_to_prompt(self):
        game = self._game({"email": "juan@example.com"}, "")
        screen = CharacterSelect(game)
        screen.confirm()
        self.assertTrue(screen.identity_editing)

    def test_manual_entry_still_works(self):
        game = self._game(None, "")
        screen = CharacterSelect(game)
        screen.confirm()
        screen.identity_text = "JUAN"
        screen.finish_identity_entry()
        self.assertFalse(screen.identity_editing)
        self.assertTrue(screen.leaving)
        self.assertEqual(game.session.challenger_id, "JUAN")

    # -- leaderboard identity ------------------------------------------------
    def test_new_game_keeps_signed_in_identity(self):
        session = GameSession()
        session.set_account_identity({"username": "maria"})
        session.challenger_id = "OLDTAG"
        session.reset()
        self.assertEqual(session.account_username(), "maria")
        self.assertEqual(session.player_identity(), "maria")
        self.assertEqual(session.challenger_id, "maria")

    def test_start_over_keeps_signed_in_identity(self):
        session = GameSession()
        session.set_account_identity({"username": "maria"})
        session.challenger_id = "OLDTAG"
        with patch("src.core.session.load_save", return_value={}):
            session.erase()
        self.assertEqual(session.player_identity(), "maria")

    def test_login_sets_account_identity(self):
        session = GameSession()
        session.challenger_id = "OLDTAG"
        session.challenger_name = "OLDTAG"
        session.set_account_identity({"username": "maria", "id": "42"})
        self.assertEqual(session.account_username(), "maria")
        self.assertEqual(session.player_identity(), "maria")
        self.assertEqual(session.challenger_id, "maria")
        self.assertEqual(session.challenger_name, "maria")
        self.assertIsNone(session.db_player_id)

    def test_leaderboard_records_use_account_not_typed_tag(self):
        session = GameSession()
        session.character = {"id": "juan", "name": "Juan"}
        session.set_account_identity({"username": "maria"})
        # Simulate an old tag left on the session by an offline run.
        session.challenger_id = "OLDTAG"
        session.challenger_name = "OLDTAG"
        session.record_run("prologue", {"score": 100, "time": 10})
        self.assertIn("prologue", session.high_scores)
        self.assertIn("maria", session.high_scores["prologue"])
        self.assertNotIn("OLDTAG", session.high_scores["prologue"])
        self.assertEqual(
            session.high_scores["prologue"]["maria"]["player_id"], "maria")

    def test_save_load_cannot_restore_an_old_tag(self):
        session = GameSession()
        session.set_account_identity({"username": "maria"})
        saved = {
            "challenger_id": "OLDTAG",
            "challenger_name": "OLDTAG",
            "character_id": "juan",
            "unlocked": [],
            "completed": [],
            "current_stage": "prologue",
        }
        with patch("src.core.session.load_save", return_value=saved):
            session.load([{"id": "juan", "name": "Juan"}])
        self.assertEqual(session.challenger_id, "maria")
        self.assertEqual(session.player_identity(), "maria")

    def test_high_scores_migrates_old_tag_to_account(self):
        session = GameSession()
        session.set_account_identity({"username": "maria"})
        game = SimpleNamespace(
            session=session,
            state_manager=SimpleNamespace(pop=lambda: None, change=lambda _s: None),
            to_canvas_pos=lambda pos: pos,
            ask_quit=lambda: None,
        )
        saved = {
            "challenger_id": "OLDTAG",
            "challenger_name": "OLDTAG",
            "high_scores": {
                "prologue": {"OLDTAG": {"player_id": "OLDTAG", "score": 90}}
            },
        }
        with patch("src.states.high_scores.load_save", return_value=saved):
            HighScores(game)
        board = session.high_scores["prologue"]
        self.assertIn("maria", board)
        self.assertNotIn("OLDTAG", board)
        self.assertEqual(board["maria"]["name"], "maria")


if __name__ == "__main__":
    unittest.main()
