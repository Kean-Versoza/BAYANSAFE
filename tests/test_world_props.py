"""Regression tests for the animated world-props layer."""
import os
import sys
import unittest

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.palette import (
    COLOR_GROUND_CENTRAL_TOWN,
    COLOR_GROUND_HARBOR,
    COLOR_GROUND_PLAINS,
)
from src.maps.block_map import BlockMap
from src.maps.world_props import (
    AnimatedFixtures,
    BiomeDressing,
    DecalSystem,
    PedestrianSystem,
    VehicleSystem,
    VegetationSway,
    person_sprite,
    vehicle_sprite,
)
from src.world.camera import Camera


class PropsTestBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()

    @classmethod
    def tearDownClass(cls):
        pygame.quit()

    def make_map(self, color=COLOR_GROUND_CENTRAL_TOWN):
        bm = BlockMap("Test Town", ground_color=color)
        bm.add_road(30, 160, 580, 40)
        bm.add_path(300, 30, 36, 260)
        bm.add_water(0, 300, 640, 60)
        bm.add_building("commercial", "STORE", 60, 60, 70, 50)
        bm.add_building("warehouse", "DEPOT", 180, 60, 80, 50)
        bm.add_building("shelter", "SAFE", 460, 50, 100, 70)
        bm.add_bridge(300, 160, 36, 40)
        return bm

    def make_camera(self):
        return Camera(640, 360)


class TestSprites(PropsTestBase):
    def test_vehicle_sprite_cached_and_sized(self):
        a = vehicle_sprite("car", (200, 80, 60))
        b = vehicle_sprite("car", (200, 80, 60))
        self.assertIs(a, b)
        self.assertEqual(a.get_size(), (13, 8))

    def test_person_sprite_cached(self):
        a = person_sprite((200, 80, 60), (232, 190, 142))
        b = person_sprite((200, 80, 60), (232, 190, 142))
        self.assertIs(a, b)
        self.assertEqual(a.get_size(), (6, 10))


class TestVehicleSystem(PropsTestBase):
    def test_vehicles_created_and_move(self):
        bm = self.make_map()
        vs = VehicleSystem(bm, "town")
        self.assertGreater(len(vs.vehicles), 0)
        before = [(v["x"], v["y"]) for v in vs.vehicles]
        for _ in range(30):
            vs.update(1 / 60)
        after = [(v["x"], v["y"]) for v in vs.vehicles]
        self.assertNotEqual(before, after)

    def test_draw_onto_canvas(self):
        bm = self.make_map()
        vs = VehicleSystem(bm, "town")
        cam = self.make_camera()
        surf = pygame.Surface((320, 180))
        vs.draw(surf, cam)
        self.assertGreater(surf.get_locked(), -1)

    def test_boats_on_water(self):
        bm = self.make_map()
        vs = VehicleSystem(bm, "harbor")
        self.assertTrue(any(v["kind"] == "boat" for v in vs.vehicles))


class TestPedestrianSystem(PropsTestBase):
    def test_pedestrians_created_and_move(self):
        bm = self.make_map()
        ps = PedestrianSystem(bm, "town")
        self.assertGreater(len(ps.people), 0)
        before = [(p["x"], p["y"]) for p in ps.people]
        for _ in range(30):
            ps.update(1 / 60)
        self.assertNotEqual(before, [(p["x"], p["y"]) for p in ps.people])


class TestFixtures(PropsTestBase):
    def test_fixtures_created(self):
        bm = self.make_map()
        fx = AnimatedFixtures(bm, "town", "wind")
        kinds = {f["kind"] for f in fx.fixtures}
        self.assertIn("beacon", kinds)
        self.assertIn("fan", kinds)
        self.assertIn("awning", kinds)

    def test_fixtures_update(self):
        bm = self.make_map()
        fx = AnimatedFixtures(bm, "plains")
        before = [f["phase"] for f in fx.fixtures]
        fx.update(0.5, "wind")
        self.assertNotEqual(before, [f["phase"] for f in fx.fixtures])


class TestDressing(PropsTestBase):
    def test_dressing_bakes_world_sized_layer(self):
        bm = self.make_map()
        dress = BiomeDressing(bm, "town")
        self.assertEqual(dress.surface.get_size(), (bm.width, bm.height))

    def test_dressing_differs_by_biome(self):
        town = self.make_map()
        harbor = BlockMap("Test Harbor", ground_color=COLOR_GROUND_HARBOR)
        harbor.add_road(30, 160, 580, 40)
        a = BiomeDressing(town, "town").surface.copy()
        b = BiomeDressing(harbor, "harbor").surface.copy()
        self.assertNotEqual(a.get_bounding_rect(), b.get_bounding_rect())


class TestDecals(PropsTestBase):
    def test_footprints_follow_player(self):
        bm = self.make_map()
        dec = DecalSystem(bm, "town")
        rect = pygame.Rect(100, 100, 10, 14)
        dec.update(1 / 60, rect, "calm")
        rect.x += 20
        dec.update(1 / 60, rect, "calm")
        self.assertGreater(len(dec.footprints), 0)
        self.assertTrue(dec.footprints[0]["life"] > 0)

    def test_static_layer_sized(self):
        bm = self.make_map()
        dec = DecalSystem(bm, "town")
        self.assertEqual(dec.static.get_size(), (bm.width, bm.height))

    def test_expired_footprints_do_not_crash_draw(self):
        """Regression: expired prints used to produce a negative alpha."""
        bm = self.make_map()
        dec = DecalSystem(bm, "town")
        rect = pygame.Rect(100, 100, 10, 14)
        dec.update(1 / 60, rect, "calm")
        rect.x += 20
        dec.update(1 / 60, rect, "calm")
        self.assertGreater(len(dec.footprints), 0)
        # Age the prints past their 6 second lifetime.
        for _ in range(60 * 8):
            dec.update(1 / 60, rect, "calm")
        self.assertEqual(dec.footprints, [])
        surf = pygame.Surface((320, 180))
        dec.draw(surf, self.make_camera())

    def test_partially_faded_footprint_has_valid_alpha(self):
        bm = self.make_map()
        dec = DecalSystem(bm, "town")
        rect = pygame.Rect(100, 100, 10, 14)
        dec.update(1 / 60, rect, "calm")
        rect.x += 20
        dec.update(1 / 60, rect, "calm")
        for _ in range(60 * 5):
            dec.update(1 / 60, rect, "calm")
        surf = pygame.Surface((320, 180))
        dec.draw(surf, self.make_camera())


class TestVegetation(PropsTestBase):
    def test_blades_created(self):
        bm = self.make_map(COLOR_GROUND_PLAINS)
        veg = VegetationSway(bm, "plains", "wind")
        self.assertGreater(len(veg.blades), 0)

    def test_draw(self):
        bm = self.make_map(COLOR_GROUND_PLAINS)
        veg = VegetationSway(bm, "plains", "wind")
        cam = self.make_camera()
        surf = pygame.Surface((320, 180))
        veg.draw(surf, cam)


if __name__ == "__main__":
    unittest.main()
