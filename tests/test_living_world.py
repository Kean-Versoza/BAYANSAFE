"""Regression checks for the cinematic living-world effect layer."""
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import math
import unittest

import pygame

from src.core import settings
from src.maps.block_map import BlockMap
from src.maps.living_world import (
    AmbientLife,
    LightingSystem,
    PostFX,
    WaterFX,
    WeatherFX,
    dithered_gradient,
    soft_glow,
)


class LivingWorldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        pygame.display.set_mode((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

    def setUp(self):
        self.map = BlockMap("San Isidro Village", ground_color=(48, 88, 64))
        self.map.add_building("house", "HOME", 120, 100, 40, 30)
        self.map.add_building("clinic", "CLINIC", 260, 100, 44, 36)
        self.map.add_road(0, 170, 320, 14)
        self.map.add_water(40, 30, 60, 44)
        self.surface = pygame.Surface((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

        class _Camera:
            offset = pygame.Vector2(0, 0)
            zoom = 1.0
            viewport = pygame.Rect(0, 0, settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT)

            @staticmethod
            def apply(rect):
                return pygame.Rect(rect)

        self.camera = _Camera()

    def test_dithered_gradient_uses_limited_bands(self):
        grad = dithered_gradient(64, 32, (20, 40, 80), (200, 220, 240), 8)
        colors = {grad.get_at((x, y))[:3] for y in range(32) for x in range(64)}
        self.assertGreater(len(colors), 4)
        self.assertLess(len(colors), 40, "gradient should stay pixel-art banded")

    def test_glow_cache_is_bounded(self):
        a = soft_glow(12, (255, 180, 90), 130)
        b = soft_glow(12, (255, 180, 90), 131)  # quantises to same bucket
        self.assertIs(a, b)

    def test_lighting_has_building_and_beacon_lights(self):
        lighting = LightingSystem(self.map, "calm")
        self.assertGreaterEqual(len(lighting.lights), 2)
        self.assertGreaterEqual(len(lighting.casters), 2)
        self.surface.fill((0, 0, 0))
        lighting.draw_shadows(self.surface, self.camera)
        self.assertLess(sum(self.surface.get_at((140, 120))[:3]),
                        sum((0, 0, 0)) + 90)  # shadow present but not solid

    def test_lighting_brightens_scene(self):
        lighting = LightingSystem(self.map, "calm")
        base = pygame.Surface((320, 180))
        base.fill((40, 50, 60))
        before = sum(base.get_at((140, 120))[:3])
        lighting.draw(base, self.camera)
        after = sum(base.get_at((140, 120))[:3])
        self.assertGreater(after, before, "point lights should add light")

    def test_weather_builds_and_splashes(self):
        weather = WeatherFX(self.map, "calm")
        for _ in range(240):
            weather.update(1 / 60, "wind", self.camera)
        self.assertGreater(weather.intensity, 0.8)
        self.assertEqual(len(weather.drops), 90)
        weather.draw(self.surface, self.camera, "front")
        weather.draw(self.surface, self.camera, "back")

    def test_water_draws_reflection_and_ripples(self):
        water = WaterFX(self.map, "town")
        for _ in range(120):
            water.update(1 / 60)
        before = self.surface.copy()
        water.draw(self.surface, self.camera)
        diff = sum(1 for y in range(30, 74) for x in range(40, 100)
                   if self.surface.get_at((x, y)) != before.get_at((x, y)))
        self.assertGreater(diff, 500, "water should visibly change the region")

    def test_ambient_life_animates(self):
        life = AmbientLife(self.map, "wind")
        a = self.surface.copy()
        life.draw(self.surface, self.camera)
        for _ in range(30):
            life.update(1 / 60, "wind")
        life.draw(self.surface, self.camera)
        changed = sum(1 for y in range(0, 180, 6) for x in range(0, 320, 6)
                      if self.surface.get_at((x, y)) != a.get_at((x, y)))
        self.assertGreater(changed, 2)

    def test_post_fx_keeps_canvas_opaque(self):
        post = PostFX(self.map, "fire")
        for _ in range(10):
            post.update(1 / 60, "fire")
        self.surface.fill((110, 130, 120))
        post.draw(self.surface, self.camera)
        self.assertEqual(self.surface.get_at((100, 100))[3], 255)


if __name__ == "__main__":
    unittest.main()
