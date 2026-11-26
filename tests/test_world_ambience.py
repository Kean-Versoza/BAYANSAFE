"""Regression checks for the code-drawn in-game environment detail."""
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import unittest

import pygame

from src.core import settings
from src.maps.block_map import BlockMap
from src.maps.world_ambience import (
    AmbientParticles,
    Atmosphere,
    GroundTexture,
    PropLayer,
    detect_biome,
    draw_bridge_planks,
    draw_building_detail,
    draw_hazard_detail,
    draw_path_detail,
    draw_road_detail,
    draw_safe_zone_detail,
    draw_tree_detail,
    draw_water_ripples,
    hazard_profile,
)


class _TyphoonHazard: pass
class _FlashFloodHazard: pass
class _FlashFireHazard: pass
class _VolcanicEruptionHazard: pass
class _EarthquakeHazard: pass
class _LandslideHazard: pass
class _TsunamiHazard: pass


class WorldAmbienceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        pygame.display.set_mode((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

    def setUp(self):
        self.map = BlockMap("SAN ISIDRO", ground_color=(48, 88, 64))
        self.surface = pygame.Surface((settings.INTERNAL_WIDTH, settings.INTERNAL_HEIGHT))

    def test_ground_texture_adds_detail_without_covering_structures(self):
        bm = self.map
        bm.add_road(40, 40, 200, 20)
        bm.add_water(300, 20, 60, 120)
        bm.add_tree(150, 150)

        texture = GroundTexture(bm)
        self.assertEqual(texture.surface.get_size(), (bm.width, bm.height))

        # The baked layer must be transparent over structures and water.
        road = bm.elements[-3].rect
        self.assertEqual(texture.surface.get_at(road.center)[3], 0)

        bm.draw(self.surface)
        varied = set()
        for y in range(0, 180, 3):
            for x in range(0, 320, 3):
                varied.add(self.surface.get_at((x, y))[:3])
        self.assertGreater(len(varied), 8, "ground still looks flat")

    def test_hazard_profile_detection(self):
        cases = (
            (_TyphoonHazard, "wind"),
            (_FlashFloodHazard, "flood"),   # "flash" must not match bare "ash"
            (_FlashFireHazard, "fire"),
            (_VolcanicEruptionHazard, "ash"),
            (_EarthquakeHazard, "dust"),
            (_LandslideHazard, "dust"),
            (_TsunamiHazard, "flood"),
        )
        for cls, expected in cases:
            with self.subTest(hazard=cls.__name__):
                self.assertEqual(hazard_profile([cls()]), expected)
        self.assertEqual(hazard_profile([]), "calm")

    def test_particles_switch_profile_and_move(self):
        amb = AmbientParticles(self.map, "calm")
        for profile in ("calm", "wind", "flood", "fire", "ash", "dust"):
            with self.subTest(profile=profile):
                amb.set_profile(profile)
                self.assertEqual(amb.profile, profile)
                before = [(p["x"], p["y"]) for p in amb.particles]
                for _ in range(30):
                    amb.update(1 / 60, profile)
                moved = sum(
                    1 for p, (x, y) in zip(amb.particles, before)
                    if abs(p["x"] - x) + abs(p["y"] - y) > 1
                )
                self.assertGreater(moved, 30)
                amb.draw(self.surface)

    def test_map_detail_helpers_tolerate_small_rects(self):
        tiny = pygame.Rect(0, 0, 2, 2)
        draw_water_ripples(self.surface, tiny, 0.0)
        draw_bridge_planks(self.surface, tiny)
        draw_road_detail(self.surface, tiny)
        draw_path_detail(self.surface, tiny)
        draw_tree_detail(self.surface, tiny, 0.0)

    def test_biome_detection(self):
        cases = (
            ("Volcano Valley Gorge", "volcanic"),
            ("Aegis-Terra Facility Campus", "facility"),
            ("Harbor Warehouse District", "harbor"),
            ("North East Agricultural Plains", "plains"),
            ("Plateau Mountain Slope", "highland"),
            ("San Isidro Village", "town"),
        )
        for name, expected in cases:
            with self.subTest(name=name):
                bm = BlockMap(name, ground_color=(48, 88, 64))
                self.assertEqual(detect_biome(bm), expected)

    def test_prop_layer_avoids_structures(self):
        bm = self.map
        house = bm.add_building("house", "HOME", 100, 100, 40, 30)
        bm.add_road(10, 10, 200, 12)
        props = PropLayer(bm)
        self.assertEqual(props.surface.get_size(), (bm.width, bm.height))
        # No prop pixels may be drawn over the building footprint.
        painted = 0
        for y in range(house.rect.top, house.rect.bottom):
            for x in range(house.rect.left, house.rect.right):
                painted += 1 if props.surface.get_at((x, y))[3] else 0
        self.assertEqual(painted, 0, "props must not hide buildings")

    def test_building_detail_uses_many_colors(self):
        rect = pygame.Rect(60, 30, 40, 34)
        pygame.draw.rect(self.surface, (110, 80, 56), rect)
        draw_building_detail(self.surface, rect, "house", 0.0)
        colors = set()
        for y in range(rect.top, rect.bottom):
            for x in range(rect.left, rect.right):
                colors.add(self.surface.get_at((x, y))[:3])
        self.assertGreater(len(colors), 14, "building still looks flat")

    def test_hazard_and_safe_details_animate(self):
        zone = pygame.Rect(20, 20, 60, 40)
        self.surface.fill((0, 0, 0))
        draw_hazard_detail(self.surface, zone, "fire", 0.0, 0.5)
        draw_safe_zone_detail(self.surface, zone, 0.0)
        a = self.surface.copy()
        self.surface.fill((0, 0, 0))
        draw_hazard_detail(self.surface, zone, "fire", 1.7, 1.0)
        draw_safe_zone_detail(self.surface, zone, 1.7)
        changed = 0
        for y in range(zone.top, zone.bottom, 2):
            for x in range(zone.left, zone.right, 2):
                if self.surface.get_at((x, y)) != a.get_at((x, y)):
                    changed += 1
        self.assertGreater(changed, 10, "hazard/safe effects should animate")

    def test_atmosphere_keeps_canvas_opaque(self):
        self.surface.fill((120, 140, 130))
        atm = Atmosphere(self.map, "fire")
        for _ in range(10):
            atm.update(1 / 60, "fire")
        atm.draw(self.surface)
        self.assertEqual(self.surface.get_at((10, 10))[3], 255)
        # Vignette darkens the corners more than the centre.
        corner = sum(self.surface.get_at((1, 1))[:3])
        centre = sum(self.surface.get_at((160, 90))[:3])
        self.assertLess(corner, centre)

    def test_map_draw_with_camera(self):
        from src.world.camera import Camera
        bm = self.map
        bm.add_water(100, 100, 80, 60)
        cam = Camera(bm.width, bm.height)
        cam.follow(pygame.Rect(200, 150, 10, 10))
        bm.draw(self.surface, cam)
        # Repeated draws reuse the cached texture and stay fast.
        for _ in range(5):
            bm.anim_timer += 0.1
            bm.draw(self.surface, cam)


if __name__ == "__main__":
    unittest.main()
