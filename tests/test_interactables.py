"""Regression tests for object interactions.

A mismatched callback signature used to raise TypeError on the exact frame the
player pressed interact, which closed the game without a visible error.
"""
import inspect
import os
import sys
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
os.environ["BAYANSAFE_ESP32_PORT"] = ""

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame

from src.core.game import Game
from src.story import chapter_registry as cr
from src.story.base_level import _adapt_interact


class TestInteractables(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()

    @classmethod
    def tearDownClass(cls):
        pygame.quit()

    def test_every_registered_callback_accepts_the_item(self):
        """All 25 missions must be able to run their object callbacks."""
        game = Game()
        failures = []
        try:
            for chapter_id, level_id in cr.STORY_SEQUENCE:
                state = cr.StoryLevelState(game, chapter_id, level_id)
                for item in state.level.interactables:
                    callback = item.get("on_interact")
                    if callback is None:
                        continue
                    try:
                        inspect.signature(callback).bind({"key": item.get("key")})
                    except TypeError as exc:
                        failures.append(f"{chapter_id}/{level_id}: {item.get('key')}: {exc}")
                    except ValueError:
                        pass
        finally:
            game.quit()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_zero_argument_callback_is_adapted(self):
        calls = []

        def handler():
            calls.append("called")

        adapted = _adapt_interact(handler)
        adapted({"key": "radio"})
        self.assertEqual(calls, ["called"])

    def test_one_argument_callback_is_kept(self):
        seen = []

        def handler(item):
            seen.append(item["key"])

        adapted = _adapt_interact(handler)
        adapted({"key": "radio"})
        self.assertEqual(seen, ["radio"])


if __name__ == "__main__":
    unittest.main()
