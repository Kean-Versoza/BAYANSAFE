"""Animated objects, pedestrians and set dressing for the chapter scenes.

This module populates the world with things that *move* and things that make a
place feel specific:

* :class:`VehicleSystem` - cars, trucks, vans, tractors and boats that travel
  along the map's roads and water with headlights and wheel motion.
* :class:`PedestrianSystem` - background villagers strolling along paths.
* :class:`AnimatedFixtures` - waving flags, blinking beacons, turning wind
  turbines, spinning fans and water wheels.
* :class:`BiomeDressing` - baked biome-specific objects: traffic lights, buses,
  shipping containers, cranes, hay bales, irrigation pipes, steam vents,
  server racks and more.
* :class:`DecalSystem` - footprints that trail the player, tyre tracks, cracks
  and scorch marks.
* :class:`VegetationSway` - swaying tall grass and crop rows.

All art is code-drawn at the 320x180 internal resolution, deterministic per
level, and cheap enough for 60 fps.  No image assets are used.
"""
from __future__ import annotations

import math
import random
from typing import Dict, List, Optional, Sequence, Tuple

import pygame

from src.maps.world_ambience import _rect_seed, _seed, detect_biome, mix, shade
from src.maps.living_world import soft_glow

Color = Tuple[int, int, int]

BUILDING_TYPES = (
    "house", "damaged_house", "shelter", "clinic", "research",
    "research_facility", "commercial", "warehouse",
)


# ----------------------------------------------------------------------
# Small cached sprite builders
# ----------------------------------------------------------------------

_SPRITE_CACHE: Dict[tuple, pygame.Surface] = {}
_VARIANT_CACHE: Dict[tuple, pygame.Surface] = {}


def _variant(surf: pygame.Surface, rotate: bool, flip: bool) -> pygame.Surface:
    """Cached rotated/flipped sprite variant (transforms are not free)."""
    key = (id(surf), rotate, flip)
    result = _VARIANT_CACHE.get(key)
    if result is None:
        result = surf
        if rotate:
            result = pygame.transform.rotate(result, 90)
        if flip:
            result = pygame.transform.flip(result, True, False)
        _VARIANT_CACHE[key] = result
    return result


def _visible_area(surface: pygame.Surface, camera) -> pygame.Rect:
    """Source rectangle covering only the visible part of a world-sized layer."""
    return pygame.Rect(int(camera.offset.x), int(camera.offset.y),
                       surface.get_width(), surface.get_height())


def _canvas(w: int, h: int) -> pygame.Surface:
    return pygame.Surface((max(1, w), max(1, h)), pygame.SRCALPHA)


def vehicle_sprite(kind: str, color: Color) -> pygame.Surface:
    """Chunky top-down vehicle sprite with cabin, wheels and lights."""
    key = (kind, tuple(color))
    cached = _SPRITE_CACHE.get(key)
    if cached is not None:
        return cached

    if kind == "boat":
        w, h = 20, 11
        s = _canvas(w, h)
        pygame.draw.polygon(s, shade(color, -30),
                            [(1, h // 2), (5, 1), (w - 5, 1), (w - 1, h // 2), (w - 5, h - 1), (5, h - 1)])
        pygame.draw.polygon(s, color,
                            [(2, h // 2), (6, 2), (w - 6, 2), (w - 2, h // 2), (w - 6, h - 2), (6, h - 2)])
        pygame.draw.rect(s, (58, 104, 132), (8, 3, 7, 5))
        pygame.draw.rect(s, (206, 226, 232), (9, 3, 3, 2))
        pygame.draw.rect(s, (232, 196, 92), (w - 3, h // 2 - 1, 2, 2))
        pygame.draw.rect(s, (232, 92, 72), (1, h // 2 - 1, 2, 2))
    elif kind == "tractor":
        w, h = 17, 11
        s = _canvas(w, h)
        pygame.draw.rect(s, shade(color, -50), (1, 2, 4, 7))
        pygame.draw.rect(s, shade(color, -50), (13, 1, 3, 9))
        pygame.draw.rect(s, color, (3, 3, 12, 6))
        pygame.draw.rect(s, shade(color, 28), (8, 1, 6, 6))
        pygame.draw.rect(s, (76, 126, 150), (9, 2, 4, 4))
        pygame.draw.rect(s, (244, 218, 128), (15, 4, 2, 2))
    else:
        dims = {
            "car": (13, 8), "van": (16, 9), "truck": (22, 10),
            "bus": (25, 11), "forklift": (15, 9),
        }
        w, h = dims.get(kind, dims["car"])
        s = _canvas(w, h)
        # Shadow and dark underbody.
        pygame.draw.rect(s, (0, 0, 0, 70), (1, 2, w - 2, h - 3))
        pygame.draw.rect(s, shade(color, -46), (0, 1, w, h - 2))
        pygame.draw.rect(s, color, (1, 2, w - 2, h - 4))
        pygame.draw.rect(s, shade(color, 26), (1, 2, w - 2, 1))
        # Wheels.
        for wx in (2, w - 5):
            pygame.draw.rect(s, (26, 26, 30), (wx, 0, 3, 2))
            pygame.draw.rect(s, (26, 26, 30), (wx, h - 2, 3, 2))
            pygame.draw.rect(s, (92, 92, 98), (wx + 1, 0, 1, 2))
        # Cabin / windshield.
        if kind in ("truck", "bus"):
            pygame.draw.rect(s, (60, 106, 138), (w - 8, 3, 6, h - 7))
            pygame.draw.rect(s, (172, 212, 226), (w - 7, 3, 2, 2))
            for wx in range(2, w - 9, 4):
                pygame.draw.rect(s, (120, 168, 190), (wx, 3, 3, h - 7))
        elif kind == "forklift":
            pygame.draw.rect(s, (58, 82, 94), (6, 2, 6, h - 6))
            pygame.draw.rect(s, (212, 178, 74), (1, h // 2 - 3, 2, 6))
        else:
            pygame.draw.rect(s, (62, 110, 142), (3, 3, w - 7, h - 7))
            pygame.draw.rect(s, (176, 214, 228), (4, 3, 3, 2))
            pygame.draw.rect(s, shade(color, -22), (3, h // 2, w - 7, 1))
        # Headlights / tail lights.
        pygame.draw.rect(s, (250, 226, 138), (w - 2, 3, 1, 2))
        pygame.draw.rect(s, (250, 226, 138), (w - 2, h - 5, 1, 2))
        pygame.draw.rect(s, (214, 76, 64), (0, 3, 1, 2))
        pygame.draw.rect(s, (214, 76, 64), (0, h - 5, 1, 2))
    _SPRITE_CACHE[key] = s
    return s


def person_sprite(color: Color, skin: Color) -> pygame.Surface:
    """Tiny 6x10 background pedestrian."""
    key = ("person", tuple(color), tuple(skin))
    cached = _SPRITE_CACHE.get(key)
    if cached is not None:
        return cached
    s = _canvas(6, 10)
    pygame.draw.ellipse(s, (0, 0, 0, 60), (0, 8, 6, 2))
    pygame.draw.rect(s, shade(color, -40), (1, 6, 2, 3))
    pygame.draw.rect(s, shade(color, -40), (3, 6, 2, 3))
    pygame.draw.rect(s, color, (1, 3, 4, 4))
    pygame.draw.rect(s, shade(color, -30), (1, 3, 4, 1))
    pygame.draw.rect(s, skin, (2, 1, 2, 2))
    pygame.draw.rect(s, (48, 38, 34), (1, 0, 4, 1))
    _SPRITE_CACHE[key] = s
    return s


# ----------------------------------------------------------------------
# Moving vehicles
# ----------------------------------------------------------------------

class VehicleSystem:
    """Vehicles patrolling roads and boats drifting on water."""

    KINDS = ("car", "van", "truck", "bus", "tractor", "forklift")

    def __init__(self, block_map, biome: str):
        self.block_map = block_map
        self.biome = biome
        self.vehicles: List[dict] = []
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xE11C))

        roads = [e.rect for e in block_map.elements if e.elem_type == "road" and e.rect.w > 80]
        paths = [e.rect for e in block_map.elements if e.elem_type == "path" and e.rect.w > 80]
        waters = [e.rect for e in block_map.elements if e.elem_type == "water" and e.rect.w > 100]

        lane_colors = {
            "town": ((196, 92, 72), (88, 132, 186), (222, 186, 92), (232, 226, 214), (108, 178, 132)),
            "highland": ((188, 152, 92), (144, 118, 84), (112, 132, 108)),
            "plains": ((206, 176, 82), (126, 164, 96), (188, 118, 72)),
            "harbor": ((86, 132, 164), (176, 128, 84), (132, 146, 152)),
            "volcanic": ((120, 104, 96), (156, 112, 80), (92, 96, 108)),
            "facility": ((96, 132, 156), (172, 168, 152), (112, 152, 124)),
        }.get(biome, ((196, 92, 72), (88, 132, 186)))
        palette = lane_colors

        for r in roads + paths:
            count = 2 if r.w >= 400 else 1
            for i in range(count):
                horizontal = r.w >= r.h
                kind = self._pick_kind(horizontal, rng)
                lane_offset = r.h // 4 if horizontal else r.w // 4
                if i % 2:
                    lane_offset = -lane_offset
                if horizontal:
                    y = r.centery + lane_offset
                    self.vehicles.append({
                        "kind": kind, "color": rng.choice(palette),
                        "x": float(rng.randrange(r.left, r.right)), "y": float(y),
                        "dir": rng.choice((-1, 1)), "horizontal": True,
                        "min": r.left - 20, "max": r.right + 20,
                        "speed": rng.uniform(14, 30), "blink": rng.random() * math.tau,
                    })
                else:
                    x = r.centerx + lane_offset
                    self.vehicles.append({
                        "kind": kind, "color": rng.choice(palette),
                        "x": float(x), "y": float(rng.randrange(r.top, r.bottom)),
                        "dir": rng.choice((-1, 1)), "horizontal": False,
                        "min": r.top - 20, "max": r.bottom + 20,
                        "speed": rng.uniform(14, 28), "blink": rng.random() * math.tau,
                    })

        for r in waters:
            for _ in range(2):
                self.vehicles.append({
                    "kind": "boat", "color": rng.choice(((196, 188, 168), (168, 122, 84), (120, 150, 168))),
                    "x": float(rng.randrange(r.left, r.right)),
                    "y": float(rng.randrange(r.top, r.bottom)),
                    "dir": rng.choice((-1, 1)), "horizontal": r.w >= r.h,
                    "min": (r.left - 16 if r.w >= r.h else r.top - 16),
                    "max": (r.right + 16 if r.w >= r.h else r.bottom + 16),
                    "speed": rng.uniform(6, 13), "blink": rng.random() * math.tau,
                })

    @staticmethod
    def _pick_kind(horizontal: bool, rng: random.Random) -> str:
        return rng.choice(VehicleSystem.KINDS)

    def update(self, dt: float) -> None:
        for v in self.vehicles:
            pos = v["x"] if v["horizontal"] else v["y"]
            pos += v["dir"] * v["speed"] * dt
            if pos > v["max"]:
                pos = v["min"]
            elif pos < v["min"]:
                pos = v["max"]
            if v["horizontal"]:
                v["x"] = pos
            else:
                v["y"] = pos
            v["blink"] += dt

    def draw(self, surface: pygame.Surface, camera) -> None:
        w, h = surface.get_width(), surface.get_height()
        for v in self.vehicles:
            rect = pygame.Rect(int(v["x"]), int(v["y"]), 1, 1)
            s = camera.apply(rect)
            if not (-30 <= s.left <= w and -30 <= s.top <= h):
                continue
            art = vehicle_sprite(v["kind"], v["color"])
            art = _variant(art, not v["horizontal"], v["dir"] < 0)
            surface.blit(art, art.get_rect(center=(s.left, s.top)))
            # Soft headlight pool in the travel direction.
            if math.sin(v["blink"] * 3) > -0.6:
                dx = 8 if v["dir"] > 0 else -8
                px = s.left + (dx if v["horizontal"] else 0)
                py = s.top + (0 if v["horizontal"] else dx)
                glow = soft_glow(7, (255, 226, 150), 46)
                surface.blit(glow, (px - 7, py - 7))


# ----------------------------------------------------------------------
# Background pedestrians
# ----------------------------------------------------------------------

class PedestrianSystem:
    """Villagers walking back and forth along roads and paths."""

    COLORS = ((196, 108, 92), (96, 144, 176), (208, 174, 92), (118, 160, 112),
              (176, 128, 164), (222, 206, 176), (84, 132, 148))

    def __init__(self, block_map, biome: str):
        self.block_map = block_map
        self.people: List[dict] = []
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0x9E0D))
        routes = [e.rect for e in block_map.elements
                  if e.elem_type in ("road", "path") and e.rect.w > 120]
        if not routes:
            return
        count = 6 if biome in ("town", "plains") else 4
        for i in range(count):
            r = rng.choice(routes)
            horizontal = r.w >= r.h
            lane = rng.choice((-1, 1)) * max(3, (r.h if horizontal else r.w) // 5)
            self.people.append({
                "x": float(rng.randrange(r.left, r.right)),
                "y": float((r.centery + lane) if horizontal else (r.centerx + lane)),
                "min": (r.left if horizontal else r.top),
                "max": (r.right if horizontal else r.bottom),
                "dir": rng.choice((-1, 1)), "horizontal": horizontal,
                "speed": rng.uniform(6, 13), "phase": rng.random() * math.tau,
                "color": rng.choice(self.COLORS),
                "skin": rng.choice(((232, 190, 142), (198, 152, 112), (242, 210, 174))),
            })

    def update(self, dt: float) -> None:
        for p in self.people:
            key = "x" if p["horizontal"] else "y"
            p[key] += p["dir"] * p["speed"] * dt
            if p[key] > p["max"]:
                p[key] = p["min"]
                p["dir"] = -1
            elif p[key] < p["min"]:
                p[key] = p["max"]
                p["dir"] = 1
            p["phase"] += dt * 7

    def draw(self, surface: pygame.Surface, camera) -> None:
        for p in self.people:
            s = camera.apply(pygame.Rect(int(p["x"]), int(p["y"]), 1, 1))
            art = person_sprite(p["color"], p["skin"])
            if math.sin(p["phase"]) < 0:
                key = ("personflip", id(art))
                flipped = _VARIANT_CACHE.get(key)
                if flipped is None:
                    flipped = pygame.transform.flip(art, True, False)
                    _VARIANT_CACHE[key] = flipped
                art = flipped
            surface.blit(art, art.get_rect(midbottom=(s.left, s.top + 3)))


# ----------------------------------------------------------------------
# Animated fixtures on buildings and terrain
# ----------------------------------------------------------------------

class AnimatedFixtures:
    """Flags, beacons, turbines, fans and water wheels."""

    def __init__(self, block_map, biome: str, profile: str = "calm"):
        self.block_map = block_map
        self.biome = biome
        self.profile = profile
        self.t = 0.0
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xF14C))
        self.fixtures: List[dict] = []

        for elem in block_map.elements:
            r = elem.rect
            if elem.elem_type in ("clinic", "shelter", "research", "research_facility"):
                self.fixtures.append({
                    "kind": "beacon", "x": r.centerx, "y": r.y + 2,
                    "phase": rng.random() * math.tau,
                })
            if elem.elem_type == "commercial":
                self.fixtures.append({
                    "kind": "awning", "x": r.left + 6, "y": r.bottom - 12,
                    "phase": rng.random() * math.tau, "color": elem.color,
                })
            if elem.elem_type == "warehouse":
                self.fixtures.append({
                    "kind": "fan", "x": r.right - 8, "y": r.y + 7,
                    "phase": rng.random() * math.tau,
                })

        if biome in ("plains", "highland"):
            for e in block_map.elements:
                if e.elem_type in ("road", "path") and e.rect.w > 200:
                    self.fixtures.append({
                        "kind": "turbine", "x": e.rect.left + 40, "y": e.rect.top - 26,
                        "phase": rng.random() * math.tau,
                    })
                    break

        for e in block_map.elements:
            if e.elem_type == "bridge":
                self.fixtures.append({
                    "kind": "wheel", "x": e.rect.right + 4, "y": e.rect.centery,
                    "phase": rng.random() * math.tau,
                })
                break

    def update(self, dt: float, profile: str = "calm") -> None:
        self.profile = profile
        self.t += dt
        for f in self.fixtures:
            speed = 2.2 if f["kind"] == "beacon" else (0.8 if f["kind"] == "turbine" else 1.4)
            if self.profile == "wind":
                speed *= 2.4
            f["phase"] += dt * speed

    def draw(self, surface: pygame.Surface, camera) -> None:
        for f in self.fixtures:
            s = camera.apply(pygame.Rect(int(f["x"]), int(f["y"]), 1, 1))
            if not (-20 <= s.left <= surface.get_width() and -20 <= s.top <= surface.get_height()):
                continue
            kind = f["kind"]
            if kind == "beacon":
                blink = 0.5 + 0.5 * math.sin(f["phase"])
                color = (236, 76, 66) if math.sin(f["phase"]) > 0 else (86, 148, 236)
                pygame.draw.circle(surface, color, (s.left, s.top), 2)
                if blink > 0.4:
                    surface.blit(soft_glow(6, color, int(70 * blink)), (s.left - 6, s.top - 6))
            elif kind == "fan":
                for i in range(3):
                    a = f["phase"] + i * math.tau / 3
                    pygame.draw.line(surface, (168, 184, 196),
                                     (s.left, s.top),
                                     (s.left + int(math.cos(a) * 5), s.top + int(math.sin(a) * 5)), 1)
                pygame.draw.circle(surface, (96, 108, 118), (s.left, s.top), 1)
            elif kind == "turbine":
                pygame.draw.line(surface, (196, 202, 206), (s.left, s.top), (s.left, s.top + 26))
                for i in range(3):
                    a = f["phase"] + i * math.tau / 3
                    pygame.draw.line(surface, (226, 232, 234), (s.left, s.top),
                                     (s.left + int(math.cos(a) * 9), s.top + int(math.sin(a) * 9)), 1)
            elif kind == "wheel":
                for i in range(4):
                    a = f["phase"] + i * math.tau / 4
                    pygame.draw.line(surface, (146, 104, 62), (s.left, s.top),
                                     (s.left + int(math.cos(a) * 6), s.top + int(math.sin(a) * 6)), 1)
                pygame.draw.circle(surface, (92, 64, 38), (s.left, s.top), 2)
            elif kind == "awning":
                wave = int(math.sin(self.t * 2 + f["phase"]) * 2)
                pygame.draw.rect(surface, shade(f["color"], 26),
                                 (s.left - 6, s.top, 13, 3))
                pygame.draw.rect(surface, (188, 72, 58), (s.left - 6 + wave, s.top + 3, 4, 2))


# ----------------------------------------------------------------------
# Biome-specific baked set dressing
# ----------------------------------------------------------------------

class BiomeDressing:
    """Small biome-specific objects baked once into a world-sized layer."""

    def __init__(self, block_map, biome: str):
        self.block_map = block_map
        self.biome = biome
        self.surface = self._bake()

    def _bake(self) -> pygame.Surface:
        bm = self.block_map
        surf = pygame.Surface((bm.width, bm.height), pygame.SRCALPHA)
        rng = random.Random(_seed(bm.location_name, 0xD0B5))
        blocked = [e.rect for e in bm.elements]

        def free(x, y, w=10, h=8):
            probe = pygame.Rect(x, y, w, h)
            return not any(probe.colliderect(r) for r in blocked)

        # Traffic lights / signals at road junctions in built-up biomes.
        if self.biome in ("town", "harbor", "facility"):
            for e in bm.elements:
                if e.elem_type != "road" or e.rect.w < 300:
                    continue
                for fx in (e.rect.left + 14, e.rect.right - 18):
                    y = e.rect.top - 12
                    if free(fx, y, 6, 14):
                        pygame.draw.rect(surf, (52, 56, 60), (fx + 2, y, 2, 12))
                        pygame.draw.rect(surf, (38, 42, 46), (fx, y - 2, 6, 10))
                        for i, c in enumerate(((206, 72, 62), (214, 184, 74), (86, 176, 104))):
                            pygame.draw.circle(surf, c, (fx + 3, y + i + 1), 1)

        # Shipping containers and cranes at the harbor.
        if self.biome == "harbor":
            colors = ((188, 92, 72), (76, 132, 164), (196, 166, 82), (96, 152, 116))
            for _ in range(14):
                x, y = rng.randrange(10, bm.width - 40), rng.randrange(10, bm.height - 20)
                if not free(x, y, 30, 12):
                    continue
                c = rng.choice(colors)
                pygame.draw.rect(surf, shade(c, -40), (x + 1, y + 1, 30, 12))
                pygame.draw.rect(surf, c, (x, y, 30, 12))
                for i in range(1, 10):
                    pygame.draw.line(surf, shade(c, -26), (x + i * 3, y), (x + i * 3, y + 12))
                pygame.draw.rect(surf, shade(c, 22), (x, y, 30, 1))
            for cx in (80, 300, 520):
                pygame.draw.rect(surf, (196, 172, 82), (cx, 16, 3, 60))
                pygame.draw.line(surf, (196, 172, 82), (cx - 24, 18), (cx + 36, 18), 2)
                pygame.draw.line(surf, (196, 172, 82), (cx + 1, 18), (cx + 1, 30))
                pygame.draw.rect(surf, (208, 196, 148), (cx - 22, 29, 10, 6))

        # Hay bales, fences and irrigation pipes on the plains.
        if self.biome == "plains":
            for _ in range(24):
                x, y = rng.randrange(8, bm.width - 16), rng.randrange(8, bm.height - 12)
                if not free(x, y, 10, 8):
                    continue
                if rng.random() < 0.55:
                    pygame.draw.ellipse(surf, (196, 172, 92), (x, y, 10, 7))
                    pygame.draw.ellipse(surf, (164, 136, 68), (x, y, 10, 7), 1)
                    pygame.draw.line(surf, (140, 116, 58), (x + 3, y + 1), (x + 6, y + 6))
                else:
                    pygame.draw.rect(surf, (118, 96, 62), (x, y + 3, 2, 8))
                    pygame.draw.rect(surf, (118, 96, 62), (x + 10, y + 3, 2, 8))
                    pygame.draw.line(surf, (150, 126, 82), (x, y + 4), (x + 12, y + 4))
                    pygame.draw.line(surf, (150, 126, 82), (x, y + 7), (x + 12, y + 7))
            for x in range(20, bm.width - 40, 90):
                y = bm.height - 26
                if free(x, y, 34, 8):
                    pygame.draw.rect(surf, (92, 112, 118), (x, y, 34, 6))
                    pygame.draw.ellipse(surf, (132, 152, 158), (x + 32, y + 1, 4, 4))

        # Basalt columns and glowing steam vents in volcanic zones.
        if self.biome == "volcanic":
            for _ in range(22):
                x, y = rng.randrange(6, bm.width - 16), rng.randrange(6, bm.height - 12)
                if not free(x, y, 10, 10):
                    continue
                hgt = rng.randrange(4, 11)
                pygame.draw.polygon(surf, (72, 66, 64),
                                    [(x, y + hgt), (x + 2, y), (x + 8, y + 1), (x + 10, y + hgt)])
                pygame.draw.line(surf, (112, 104, 100), (x + 3, y + 1), (x + 3, y + hgt))
                pygame.draw.line(surf, (112, 104, 100), (x + 7, y + 2), (x + 7, y + hgt))
            for _ in range(8):
                x, y = rng.randrange(10, bm.width - 12), rng.randrange(10, bm.height - 10)
                if free(x, y, 8, 5):
                    pygame.draw.ellipse(surf, (40, 34, 32), (x, y, 8, 4))
                    pygame.draw.ellipse(surf, (214, 108, 56), (x + 2, y + 1, 4, 2))

        # Server racks, cable trays and floor markings in facilities.
        if self.biome == "facility":
            for x in range(16, bm.width - 24, 46):
                y = 22
                if free(x, y, 16, 22):
                    pygame.draw.rect(surf, (44, 54, 64), (x, y, 16, 22))
                    pygame.draw.rect(surf, (68, 82, 94), (x + 1, y + 1, 14, 20))
                    for row in range(4):
                        pygame.draw.rect(surf, (24, 30, 38), (x + 2, y + 2 + row * 5, 12, 3))
                        pygame.draw.rect(surf, (96, 214, 132), (x + 3, y + 3 + row * 5, 1, 1))
                        pygame.draw.rect(surf, (214, 164, 82), (x + 5, y + 3 + row * 5, 1, 1))
            for y in range(50, bm.height - 20, 60):
                pygame.draw.line(surf, (188, 164, 62), (10, y), (bm.width - 10, y), 1)

        # Town extras: hydrants, mailboxes and bus stops.
        if self.biome == "town":
            for _ in range(9):
                x, y = rng.randrange(8, bm.width - 12), rng.randrange(8, bm.height - 12)
                if not free(x, y, 7, 9):
                    continue
                if rng.random() < 0.5:
                    pygame.draw.rect(surf, (196, 72, 62), (x + 2, y + 2, 3, 6))
                    pygame.draw.circle(surf, (214, 92, 74), (x + 3, y + 2), 2)
                    pygame.draw.rect(surf, (176, 60, 52), (x + 1, y + 4, 5, 1))
                else:
                    pygame.draw.rect(surf, (62, 74, 86), (x + 2, y + 4, 2, 5))
                    pygame.draw.rect(surf, (92, 126, 156), (x, y, 7, 5))
                    pygame.draw.rect(surf, (196, 186, 156), (x + 1, y + 1, 5, 1))
        return surf

    def draw(self, surface: pygame.Surface, camera) -> None:
        view = _visible_area(surface, camera)
        surface.blit(self.surface, (0, 0), area=view)


# ----------------------------------------------------------------------
# Persistent decals
# ----------------------------------------------------------------------

class DecalSystem:
    """Footprints behind the player and baked environmental marks."""

    def __init__(self, block_map, biome: str):
        self.block_map = block_map
        self.biome = biome
        self.footprints: List[dict] = []
        self.last_pos: Optional[Tuple[int, int]] = None
        self.step = 0
        self.t = 0.0
        self.static = self._bake_static()

    def _bake_static(self) -> pygame.Surface:
        bm = self.block_map
        surf = pygame.Surface((bm.width, bm.height), pygame.SRCALPHA)
        rng = random.Random(_seed(bm.location_name, 0xDECA))

        # Tyre tracks along every road.
        for e in bm.elements:
            if e.elem_type != "road":
                continue
            r = e.rect
            if r.w >= r.h:
                for x in range(r.left + 4, r.right - 2, 7):
                    for lane in (r.top + r.h // 4, r.bottom - r.h // 4):
                        surf.fill((28, 26, 24, 55), (x, lane, 3, 1))
            else:
                for y in range(r.top + 4, r.bottom - 2, 7):
                    for lane in (r.left + r.w // 4, r.right - r.w // 4):
                        surf.fill((28, 26, 24, 55), (lane, y, 1, 3))

        # Scorch marks inside fire zones, flood lines in flood zones.
        for hz in bm.hazard_zones:
            r = hz.rect
            htype = str(getattr(hz, "hazard_type", "")).lower()
            if "fire" in htype:
                for _ in range(max(3, r.w // 14)):
                    x = rng.randrange(r.left, r.right)
                    y = rng.randrange(r.top, r.bottom)
                    pygame.draw.ellipse(surf, (32, 26, 22, 90), (x - 5, y - 3, 10, 6))
                    pygame.draw.ellipse(surf, (126, 68, 40, 70), (x - 3, y - 2, 6, 4))
            elif "flood" in htype or "tsunami" in htype:
                for y in (r.top + 6, r.bottom - 8):
                    for x in range(r.left + 2, r.right - 2, 9):
                        surf.fill((178, 208, 216, 60), (x + rng.randrange(-2, 3), y, 6, 1))
            elif "landslide" in htype or "debris" in htype:
                pts = [(r.left + 2, r.bottom - 4)]
                for i in range(6):
                    pts.append((r.left + 4 + i * (r.w // 6),
                                r.bottom - 6 - rng.randrange(0, 12)))
                pygame.draw.lines(surf, (36, 28, 22, 110), False, pts, 1)
        return surf

    def update(self, dt: float, player_rect, profile: str = "calm") -> None:
        self.t += dt
        profile_biome = profile
        pos = (player_rect.centerx, player_rect.bottom)
        if self.last_pos is not None:
            dx = pos[0] - self.last_pos[0]
            dy = pos[1] - self.last_pos[1]
            if dx * dx + dy * dy > 5 * 5:
                self.step += 1
                self.footprints.append({
                    "x": pos[0], "y": pos[1],
                    "side": 1 if self.step % 2 else -1,
                    "life": 6.0,
                    "wet": profile_biome in ("flood", "wind"),
                })
                if len(self.footprints) > 40:
                    self.footprints.pop(0)
                self.last_pos = pos
        else:
            self.last_pos = pos
        for fp in self.footprints:
            fp["life"] -= dt
        # Drop fully faded prints instead of letting life go negative.  A
        # negative alpha is an invalid pygame colour and crashed the game
        # a few seconds after entering a level.
        self.footprints[:] = [fp for fp in self.footprints if fp["life"] > 0]

    def draw(self, surface: pygame.Surface, camera) -> None:
        view = _visible_area(surface, camera)
        surface.blit(self.static, (0, 0), area=view)
        for fp in self.footprints:
            s = camera.apply(pygame.Rect(int(fp["x"]), int(fp["y"]), 1, 1))
            if not (-4 <= s.left <= surface.get_width() and -4 <= s.top <= surface.get_height()):
                continue
            life = max(0.0, min(1.0, fp["life"]))
            alpha = max(0, min(255, int(60 * life)))
            if alpha <= 0:
                continue
            col = (46, 62, 72, alpha) if fp["wet"] else (58, 44, 30, alpha)
            ox = fp["side"] * 2
            pygame.draw.ellipse(surface, col, (s.left + ox - 1, s.top - 1, 3, 2))


# ----------------------------------------------------------------------
# Swaying vegetation
# ----------------------------------------------------------------------

class VegetationSway:
    """Tall grass and crop rows that ripple in the wind."""

    def __init__(self, block_map, biome: str, profile: str = "calm"):
        self.block_map = block_map
        self.biome = biome
        self.profile = profile
        self.t = 0.0
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0x6755))
        self.blades: List[dict] = []
        count = 32 if biome in ("town", "plains", "highland") else 14
        blocked = [e.rect for e in block_map.elements]
        for _ in range(count * 3):
            x, y = rng.randrange(4, block_map.width - 4), rng.randrange(4, block_map.height - 4)
            if any(r.collidepoint(x, y) for r in blocked):
                continue
            self.blades.append({
                "x": x, "y": y, "phase": rng.random() * math.tau,
                "height": rng.randrange(2, 5),
                "color": rng.choice(((58, 112, 60), (76, 134, 66), (94, 148, 72), (126, 142, 70))),
            })
            if len(self.blades) >= count:
                break

    def update(self, dt: float, profile: str = "calm") -> None:
        self.profile = profile
        self.t += dt

    def draw(self, surface: pygame.Surface, camera) -> None:
        wind = 1.0 if self.profile in ("wind", "dust") else 0.35
        for b in self.blades:
            s = camera.apply(pygame.Rect(b["x"], b["y"], 1, 1))
            if not (0 <= s.left <= surface.get_width() and 0 <= s.top <= surface.get_height()):
                continue
            sway = round(math.sin(self.t * 3 + b["phase"]) * wind * 2)
            h = b["height"]
            pygame.draw.line(surface, shade(b["color"], -24),
                             (s.left, s.top), (s.left + sway, s.top - h))
            pygame.draw.line(surface, b["color"],
                             (s.left + 1, s.top), (s.left + 1 + sway, s.top - h + 1))
