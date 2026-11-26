"""Rich procedural environment detail for the in-game chapter scenes.

The chapter maps are deliberately built from plain coloured rectangles so the
gameplay stays readable and needs no image assets.  This module layers a full
code-drawn world on top of those rectangles:

* :class:`GroundTexture` - a baked, biome-aware soil layer (grass, crops,
  rock, ash, dock boards, facility plating, ...) with speckles, cracks and
  drifting debris.
* :class:`PropLayer` - a baked layer of street furniture: lamps, signs,
  crates, barrels, bushes, benches, poles and puddles, placed only in clear
  ground so they never hide a route.
* :func:`draw_building_detail` - turns a plain block into a small building with
  a roof, siding, windows, a door, signage and damage where appropriate.
* :func:`draw_water_ripples`, :func:`draw_tree_detail` and friends - animated
  accents for the map's terrain rectangles.
* :func:`draw_hazard_detail` - fire flames, flood foam, ash drifts, debris and
  tsunami surge inside the hazard zones.
* :class:`AmbientParticles` - screen-space weather: rain, embers, ash, spray
  and dust that react to the active hazard.
* :class:`Atmosphere` - per-map lighting, colour grade, sun shafts, vignette
  and occasional lightning.

Everything is deterministic from the location name and rectangle positions,
so a level looks the same on every replay.  No external images are used.
"""
from __future__ import annotations

import math
import random
import zlib
from typing import Iterable, List, Optional, Sequence, Tuple

import pygame

Color = Tuple[int, int, int]

# ----------------------------------------------------------------------
# Colour & geometry helpers
# ----------------------------------------------------------------------


def shade(color: Color, amount: int) -> Color:
    return tuple(max(0, min(255, int(c) + amount)) for c in color)


def mix(a: Color, b: Color, t: float) -> Color:
    t = max(0.0, min(1.0, t))
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def _seed(text: str, salt: int = 0) -> int:
    return zlib.crc32(text.encode("utf-8", "replace")) ^ salt


def _rect_seed(rect: pygame.Rect, salt: int = 0) -> int:
    return _seed(f"{rect.x}:{rect.y}:{rect.w}:{rect.h}", salt)


def _blocked_rects(block_map) -> List[pygame.Rect]:
    """Every area that should keep its readable, flat surface."""
    return [elem.rect for elem in block_map.elements] + \
           [hz.rect for hz in block_map.hazard_zones] + \
           [sz.rect for sz in block_map.safe_zones]


def _clear(rects: Sequence[pygame.Rect], x: int, y: int, pad: int = 2) -> bool:
    return not any(r.collidepoint(x, y) for r in rects)


_GLOW_CACHE: dict = {}
_VIGNETTE_CACHE: dict = {}


def glow_surface(radius: int, color: Color, max_alpha: int = 80) -> pygame.Surface:
    """A cached soft radial glow."""
    radius = max(2, int(radius))
    key = (radius, tuple(color), int(max_alpha))
    if key in _GLOW_CACHE:
        return _GLOW_CACHE[key]
    surf = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
    for r in range(radius, 0, -1):
        alpha = int(max_alpha * (1.0 - r / radius) ** 1.5)
        if alpha > 0:
            pygame.draw.circle(surf, (*color, alpha), (radius, radius), r)
    _GLOW_CACHE[key] = surf
    return surf


def vignette_surface(w: int, h: int, strength: int = 95) -> pygame.Surface:
    """A cached darkened-edge overlay."""
    key = (w, h, int(strength))
    if key in _VIGNETTE_CACHE:
        return _VIGNETTE_CACHE[key]
    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    steps = 20
    max_inset = max(1, min(w, h) // 2 - 2)
    for k in range(steps):
        inset = k * max_inset // steps
        alpha = int(strength * (1.0 - k / steps) ** 2)
        if alpha <= 0:
            continue
        pygame.draw.rect(surf, (0, 0, 0, alpha),
                         (inset, inset, w - 2 * inset, h - 2 * inset), 2)
    _VIGNETTE_CACHE[key] = surf
    return surf


def detect_biome(block_map) -> str:
    """Classify a level from its title and ground colour."""
    name = str(getattr(block_map, "location_name", "")).lower()
    if any(k in name for k in ("volcano", "caldera", "valley", "lahar", "ash corridor",
                               "gorge")):
        return "volcanic"
    if any(k in name for k in ("facility", "campus", "terminal", "complex", "machine")):
        return "facility"
    if any(k in name for k in ("harbor", "harbour", "pier", "dock", "warehouse")):
        return "harbor"
    if any(k in name for k in ("plains", "agricultural", "irrigation", "foothills",
                               "excavation")):
        return "plains"
    if any(k in name for k in ("plateau", "mountain", "summit", "slope", "trail",
                               "overlook")):
        return "highland"
    if any(k in name for k in ("town", "village", "san isidro", "plaza", "street")):
        return "town"
    rgb = getattr(block_map, "ground_color", (45, 60, 50))
    if rgb[1] <= 45 and rgb[0] <= 60:
        return "volcanic"
    if abs(rgb[0] - rgb[2]) < 12 and rgb[1] < 70:
        return "facility"
    return "town"


# ----------------------------------------------------------------------
# Baked ground detail
# ----------------------------------------------------------------------


class GroundTexture:
    """A cached world-sized layer of biome-aware ground decorations."""

    def __init__(self, block_map):
        self.block_map = block_map
        self.biome = detect_biome(block_map)
        self.surface = self._bake()

    def _bake(self) -> pygame.Surface:
        bm = self.block_map
        surf = pygame.Surface((bm.width, bm.height), pygame.SRCALPHA)
        rng = random.Random(_seed(bm.location_name, 0x51A7))
        base = bm.ground_color
        blocked = _blocked_rects(bm)
        biome = self.biome

        def clear(x, y, pad=2):
            return _clear(blocked, x, y, pad)

        # Faint soil patches break up the single flat fill.
        for _ in range(95):
            x = rng.randrange(0, bm.width)
            y = rng.randrange(0, bm.height)
            if not clear(x, y, 8):
                continue
            w = rng.randrange(12, 38)
            h = rng.randrange(7, 22)
            col = shade(base, 10 if rng.random() < 0.55 else -11)
            pygame.draw.ellipse(surf, (*col, 26), (x - w // 2, y - h // 2, w, h))

        # Fine grains / sand scattered everywhere.
        for _ in range(780):
            x = rng.randrange(0, bm.width)
            y = rng.randrange(0, bm.height)
            if not clear(x, y):
                continue
            col = shade(base, rng.choice((-26, -16, -8, 14, 22, 30)))
            surf.fill((*col, rng.randrange(40, 115)), (x, y, 1, 1))

        # Pebbles with a tiny drop shadow.
        for _ in range(70):
            x = rng.randrange(2, bm.width - 3)
            y = rng.randrange(2, bm.height - 3)
            if not clear(x, y):
                continue
            stone = mix(base, (156, 150, 136), 0.5)
            surf.fill((*shade(stone, -34), 150), (x, y + 1, 3, 1))
            surf.fill((*stone, 200), (x, y, 2, 1))
            surf.fill((*shade(stone, 22), 170), (x, y, 1, 1))

        # ---- biome-specific motifs ---------------------------------------
        if biome in ("town", "highland", "plains"):
            tuft = shade(base, 28)
            tuft_dark = shade(base, 13)
            for _ in range(190):
                x = rng.randrange(2, bm.width - 3)
                y = rng.randrange(3, bm.height - 3)
                if not clear(x, y):
                    continue
                hgt = rng.choice((2, 2, 3, 4))
                surf.fill((*tuft_dark, 155), (x, y, 1, hgt))
                surf.fill((*tuft, 175), (x - 1, y + 1, 1, max(1, hgt - 1)))
                surf.fill((*tuft, 175), (x + 1, y + 1, 1, max(1, hgt - 1)))
                if rng.random() < 0.12:
                    surf.fill((*tuft, 160), (x, y - 1, 1, 1))

        if biome == "town":
            # Tiny wildflowers and fallen leaves along the paths.
            for _ in range(46):
                x = rng.randrange(3, bm.width - 4)
                y = rng.randrange(3, bm.height - 4)
                if not clear(x, y):
                    continue
                petal = rng.choice(((240, 196, 72), (232, 140, 160), (210, 220, 240)))
                surf.fill((*petal, 190), (x, y, 1, 1))
                surf.fill((*petal, 150), (x + 1, y, 1, 1))
                surf.fill((*shade(base, 20), 160), (x, y + 1, 1, 1))

        if biome == "highland":
            # Rock fragments and dry contour scratches.
            for _ in range(60):
                x = rng.randrange(3, bm.width - 6)
                y = rng.randrange(3, bm.height - 5)
                if not clear(x, y, 3):
                    continue
                rock = mix(base, (148, 138, 122), 0.55)
                pygame.draw.polygon(surf, (*rock, 165),
                                    [(x, y + 2), (x + 2, y), (x + 5, y + 1), (x + 4, y + 3)])
                surf.fill((*shade(rock, -30), 150), (x, y + 3, 5, 1))
            for _ in range(30):
                x = rng.randrange(4, bm.width - 14)
                y = rng.randrange(3, bm.height - 3)
                if not clear(x, y, 3):
                    continue
                for i in range(rng.randrange(4, 10)):
                    surf.fill((*shade(base, -18), 110), (x + i, y + (i // 4), 1, 1))

        if biome == "plains":
            # Cultivated furrows - soft parallel bands across open ground.
            for y in range(4, bm.height - 4, 9):
                for x in range(4, bm.width - 8, 17):
                    if not clear(x, y, 4):
                        continue
                    surf.fill((*shade(base, -14), 85), (x, y, 13, 2))
                    surf.fill((*shade(base, 20), 95), (x, y + 2, 13, 1))
                    if rng.random() < 0.45:
                        surf.fill((*shade(base, 34), 130), (x + rng.randrange(13), y + 1, 1, 2))
            for _ in range(40):
                x = rng.randrange(3, bm.width - 4)
                y = rng.randrange(3, bm.height - 4)
                if not clear(x, y):
                    continue
                surf.fill((*shade(base, 38), 140), (x, y, 1, 2))
                surf.fill((*shade(base, 24), 130), (x + 1, y, 1, 1))

        if biome == "harbor":
            # Weathered dock boards, rust stains and little puddles.
            for y in range(2, bm.height - 2, 8):
                for x in range(2, bm.width - 2, 26):
                    if not clear(x, y, 3):
                        continue
                    plank = shade(base, rng.choice((-12, -6, 9, 14)))
                    surf.fill((*plank, 110), (x, y, 24, 6))
                    surf.fill((*shade(plank, -26), 145), (x, y + 6, 24, 1))
                    surf.fill((*shade(plank, -18), 120), (x + 25, y, 1, 7))
            for _ in range(26):
                x = rng.randrange(3, bm.width - 8)
                y = rng.randrange(3, bm.height - 6)
                if not clear(x, y):
                    continue
                surf.fill((*mix(base, (126, 72, 46), 0.6), 120), (x, y, rng.randrange(3, 8), 2))
            for _ in range(20):
                x = rng.randrange(3, bm.width - 10)
                y = rng.randrange(3, bm.height - 6)
                if not clear(x, y, 3):
                    continue
                pygame.draw.ellipse(surf, (*shade(base, 40), 90), (x, y, 9, 3))

        if biome == "volcanic":
            # Ash drifts, glowing vents and jagged basalt cracks.
            ash = mix(base, (138, 132, 128), 0.35)
            for _ in range(120):
                x = rng.randrange(2, bm.width - 4)
                y = rng.randrange(2, bm.height - 3)
                if not clear(x, y):
                    continue
                surf.fill((*ash, rng.randrange(60, 130)), (x, y, rng.choice((1, 2, 3)), 1))
            for _ in range(34):
                x = rng.randrange(5, bm.width - 14)
                y = rng.randrange(5, bm.height - 10)
                if not clear(x, y, 4):
                    continue
                pts = [(x, y)]
                for i in range(rng.randrange(3, 7)):
                    pts.append((x + i * 2, y + rng.choice((-2, 0, 1, 2))))
                pygame.draw.lines(surf, (*shade(base, -30), 150), False, pts, 1)
            for _ in range(9):
                x = rng.randrange(6, bm.width - 8)
                y = rng.randrange(6, bm.height - 7)
                if not clear(x, y, 5):
                    continue
                pygame.draw.ellipse(surf, (*shade(base, -40), 170), (x, y, 5, 3))
                pygame.draw.ellipse(surf, (220, 92, 32, 170), (x + 1, y + 1, 3, 1))

        if biome == "facility":
            # Metal floor panels, rivets and safety stripes.
            for y in range(2, bm.height - 2, 22):
                for x in range(2, bm.width - 2, 22):
                    if not clear(x, y, 3):
                        continue
                    pygame.draw.rect(surf, (*shade(base, 12), 80), (x, y, 20, 20), 1)
                    for dx, dy in ((2, 2), (18, 2), (2, 18), (18, 18)):
                        surf.fill((*shade(base, 36), 140), (x + dx, y + dy, 1, 1))
            for x in range(4, bm.width - 10, 14):
                y = rng.choice((bm.height // 3, 2 * bm.height // 3))
                if not clear(x, y, 4):
                    continue
                for i in range(6):
                    col = (196, 168, 54) if i % 2 == 0 else (46, 48, 54)
                    surf.fill((*col, 110), (x + i * 2, y, 2, 3))
            for _ in range(18):
                x = rng.randrange(3, bm.width - 12)
                y = rng.randrange(3, bm.height - 4)
                if not clear(x, y, 3):
                    continue
                pygame.draw.line(surf, (*shade(base, -22), 130), (x, y), (x + 9, y), 1)

        return surf

    def draw(self, surface: pygame.Surface, camera=None):
        if camera is None:
            surface.blit(self.surface, (0, 0))
            return
        dest = camera.apply(pygame.Rect(0, 0, self.block_map.width, self.block_map.height))
        surface.blit(self.surface, dest)


# ----------------------------------------------------------------------
# Baked street furniture
# ----------------------------------------------------------------------

_BUILDING_TYPES = ("house", "damaged_house", "shelter", "clinic", "research",
                   "commercial", "warehouse")


class PropLayer:
    """Deterministic props placed on clear ground around the map."""

    def __init__(self, block_map):
        self.block_map = block_map
        self.biome = detect_biome(block_map)
        self.surface = self._bake()

    def _bake(self) -> pygame.Surface:
        bm = self.block_map
        surf = pygame.Surface((bm.width, bm.height), pygame.SRCALPHA)
        rng = random.Random(_seed(bm.location_name, 0xB0B5))
        blocked = _blocked_rects(bm)
        buildings = [e.rect for e in bm.elements if e.elem_type in _BUILDING_TYPES]
        roads = [e.rect for e in bm.elements if e.elem_type in ("road", "path")]

        def free(x, y, w, h):
            probe = pygame.Rect(x, y, w, h)
            return not any(probe.colliderect(r) for r in blocked)

        def near(x, y, rects, dist=34):
            return any(abs(x - r.centerx) < dist and abs(y - r.centery) < dist
                       for r in rects)

        # Lamp posts: prefer spots beside roads and near buildings.
        lamp_spots = []
        for _ in range(140):
            x = rng.randrange(18, bm.width - 18)
            y = rng.randrange(22, bm.height - 22)
            if not free(x - 3, y - 14, 7, 16) or not near(x, y, roads + buildings, 40):
                continue
            if any((x - px) ** 2 + (y - py) ** 2 < 40 ** 2 for px, py, _ in lamp_spots):
                continue
            lamp_spots.append((x, y, rng.random()))
            if len(lamp_spots) >= 9:
                break
        for x, y, warm in lamp_spots:
            self._lamp(surf, x, y, warm)

        # Signs pointing toward safety / evacuation.
        for _ in range(3):
            for _try in range(60):
                x = rng.randrange(20, bm.width - 20)
                y = rng.randrange(25, bm.height - 25)
                if free(x - 5, y - 12, 11, 14) and near(x, y, roads, 30):
                    self._sign(surf, x, y, rng.random() < 0.5)
                    break

        # Crates / barrels / sandbag stacks beside buildings.
        for _ in range(16):
            for _try in range(40):
                x = rng.randrange(16, bm.width - 20)
                y = rng.randrange(20, bm.height - 20)
                if not free(x - 6, y - 7, 13, 9) or not near(x, y, buildings, 46):
                    continue
                kind = rng.random()
                if kind < 0.4:
                    self._crate(surf, x, y)
                elif kind < 0.72:
                    self._barrel(surf, x, y)
                else:
                    self._sandbags(surf, x, y)
                break

        # Vegetation / rubble clumps in open ground.
        clumps = 46 if self.biome in ("town", "plains", "highland") else 24
        for _ in range(clumps):
            for _try in range(30):
                x = rng.randrange(10, bm.width - 12)
                y = rng.randrange(12, bm.height - 12)
                if not free(x - 6, y - 6, 13, 10):
                    continue
                if self.biome == "volcanic":
                    self._rocks(surf, x, y, rng)
                elif self.biome == "facility":
                    self._debris(surf, x, y, rng)
                elif self.biome == "harbor":
                    self._ropecoil(surf, x, y) if rng.random() < 0.4 else self._rocks(surf, x, y, rng)
                else:
                    self._bush(surf, x, y, rng)
                break

        # Benches on the plazas, puddles after the storm.
        for _ in range(5):
            for _try in range(50):
                x = rng.randrange(20, bm.width - 24)
                y = rng.randrange(20, bm.height - 20)
                if free(x - 8, y - 5, 17, 8) and near(x, y, roads, 26):
                    self._bench(surf, x, y)
                    break
        for _ in range(12):
            x = rng.randrange(12, bm.width - 20)
            y = rng.randrange(12, bm.height - 14)
            if free(x - 6, y - 3, 13, 6):
                pygame.draw.ellipse(surf, (110, 150, 170, 70), (x - 6, y - 3, 12, 4))
                pygame.draw.ellipse(surf, (170, 205, 220, 90), (x - 3, y - 2, 5, 1))

        return surf

    @staticmethod
    def _shadow(surf, x, y, w, h):
        pygame.draw.ellipse(surf, (0, 0, 0, 70), (x - w // 2 + 2, y - 1, w, 3))

    def _lamp(self, surf, x, y, warm):
        self._shadow(surf, x, y, 8, 3)
        pygame.draw.rect(surf, (44, 48, 54), (x, y - 13, 2, 13))
        pygame.draw.rect(surf, (78, 82, 88), (x, y - 13, 1, 13))
        pygame.draw.rect(surf, (34, 38, 44), (x - 3, y - 15, 8, 2))
        glow = (255, 206, 118) if warm else (196, 224, 236)
        pygame.draw.rect(surf, glow, (x - 1, y - 15, 4, 2))
        surf.blit(glow_surface(9, glow, 95), (x - 8, y - 22))

    def _sign(self, surf, x, y, evacuation):
        self._shadow(surf, x, y, 8, 3)
        pygame.draw.rect(surf, (60, 56, 48), (x, y - 11, 2, 11))
        body = (48, 118, 74) if evacuation else (196, 84, 54)
        pygame.draw.rect(surf, body, (x - 5, y - 15, 12, 7))
        pygame.draw.rect(surf, (232, 232, 214), (x - 4, y - 14, 10, 5), 1)
        pygame.draw.rect(surf, (236, 236, 220), (x - 2, y - 13, 2, 3))
        if evacuation:
            pygame.draw.polygon(surf, (236, 236, 220),
                                [(x + 2, y - 13), (x + 5, y - 12), (x + 2, y - 11)])

    def _crate(self, surf, x, y):
        self._shadow(surf, x, y, 10, 3)
        pygame.draw.rect(surf, (108, 76, 46), (x - 5, y - 7, 10, 7))
        pygame.draw.rect(surf, (148, 108, 64), (x - 5, y - 7, 10, 1))
        pygame.draw.rect(surf, (70, 46, 28), (x - 5, y - 7, 10, 7), 1)
        pygame.draw.line(surf, (74, 48, 28), (x - 5, y - 7), (x + 4, y - 1), 1)
        pygame.draw.line(surf, (74, 48, 28), (x + 4, y - 7), (x - 5, y - 1), 1)

    def _barrel(self, surf, x, y):
        self._shadow(surf, x, y, 8, 3)
        pygame.draw.rect(surf, (72, 92, 104), (x - 3, y - 8, 7, 8))
        pygame.draw.ellipse(surf, (104, 128, 140), (x - 3, y - 9, 7, 3))
        pygame.draw.rect(surf, (46, 60, 70), (x - 3, y - 6, 7, 1))
        pygame.draw.rect(surf, (46, 60, 70), (x - 3, y - 2, 7, 1))
        pygame.draw.rect(surf, (196, 154, 62), (x - 2, y - 5, 4, 2))

    def _sandbags(self, surf, x, y):
        self._shadow(surf, x, y, 12, 3)
        for row in range(2):
            for col in range(3 - row):
                bx = x - 5 + col * 4 + row * 2
                by = y - 3 - row * 3
                pygame.draw.ellipse(surf, (158, 146, 108), (bx, by, 5, 3))
                pygame.draw.ellipse(surf, (118, 106, 78), (bx, by, 5, 3), 1)

    def _bush(self, surf, x, y, rng):
        self._shadow(surf, x, y, 10, 3)
        dark = (28, 74, 40)
        mid = (46, 104, 54)
        light = (70, 138, 66)
        pygame.draw.ellipse(surf, dark, (x - 6, y - 5, 12, 6))
        pygame.draw.ellipse(surf, mid, (x - 5, y - 6, 9, 5))
        pygame.draw.ellipse(surf, light, (x - 3, y - 7, 5, 3))
        if rng.random() < 0.35:
            pygame.draw.rect(surf, (232, 186, 82), (x - 1, y - 6, 1, 1))
            pygame.draw.rect(surf, (232, 140, 166), (x + 2, y - 5, 1, 1))

    def _rocks(self, surf, x, y, rng):
        self._shadow(surf, x, y, 11, 3)
        for _ in range(rng.randrange(2, 5)):
            rx = x + rng.randrange(-5, 5)
            ry = y - rng.randrange(0, 4)
            size = rng.randrange(2, 5)
            pygame.draw.polygon(surf, (96, 90, 84),
                                [(rx, ry + size), (rx + size // 2, ry),
                                 (rx + size, ry + size - 1)])
            pygame.draw.line(surf, (138, 132, 124), (rx + size // 2, ry), (rx + size, ry + size - 1))

    def _debris(self, surf, x, y, rng):
        self._shadow(surf, x, y, 8, 3)
        for _ in range(rng.randrange(3, 7)):
            dx = x + rng.randrange(-4, 5)
            dy = y - rng.randrange(0, 3)
            col = rng.choice(((70, 78, 88), (120, 96, 60), (46, 52, 60)))
            pygame.draw.rect(surf, col, (dx, dy, rng.randrange(1, 3), 1))

    def _ropecoil(self, surf, x, y):
        self._shadow(surf, x, y, 8, 3)
        pygame.draw.ellipse(surf, (156, 132, 92), (x - 4, y - 3, 8, 4), 1)
        pygame.draw.ellipse(surf, (126, 104, 72), (x - 2, y - 2, 4, 2), 1)

    def _bench(self, surf, x, y):
        self._shadow(surf, x, y, 14, 3)
        pygame.draw.rect(surf, (96, 68, 42), (x - 8, y - 5, 16, 2))
        pygame.draw.rect(surf, (80, 54, 34), (x - 8, y - 2, 16, 2))
        pygame.draw.rect(surf, (54, 46, 42), (x - 6, y - 3, 2, 4))
        pygame.draw.rect(surf, (54, 46, 42), (x + 4, y - 3, 2, 4))

    def draw(self, surface: pygame.Surface, camera=None):
        dest = self.surface.get_rect()
        if camera is not None:
            dest = camera.apply(dest)
        surface.blit(self.surface, dest)


# ----------------------------------------------------------------------
# Animated terrain accents
# ----------------------------------------------------------------------


def draw_water_ripples(surface: pygame.Surface, rect: pygame.Rect, t: float) -> None:
    """Depth bands, caustics, foam and floating debris on a water rectangle."""
    r = pygame.Rect(rect)
    if r.w < 6 or r.h < 4:
        return
    layer = pygame.Surface(r.size, pygame.SRCALPHA)
    # Deeper toward the bottom.
    for dy in range(0, r.h, 3):
        a = int(14 + 52 * (dy / max(1, r.h)))
        pygame.draw.rect(layer, (12, 34, 74, a), (0, dy, r.w, 3))
    # Sliding caustic bands.
    for y in range(3, r.h - 1, 7):
        drift = int(t * 11 + y * 3) % 19
        shift = int(2 * math.sin(t * 2.0 + y * 0.17))
        for x in range(drift - 19, r.w, 19):
            pygame.draw.rect(layer, (108, 184, 226, 125), (x + shift, y, 7, 1))
            pygame.draw.rect(layer, (60, 132, 196, 105), (x + shift + 2, y + 2, 5, 1))
    # Shoreline foam along every edge.
    edge = (206, 236, 248, 150)
    for x in range(0, r.w, 5):
        wob = int(math.sin(x * 0.19 + t * 3.4) * 1.4)
        pygame.draw.rect(layer, edge, (x, max(0, 1 + wob), 4, 1))
        pygame.draw.rect(layer, edge, (x, max(0, r.h - 3 + wob), 4, 1))
    for y in range(0, r.h, 5):
        wob = int(math.sin(y * 0.21 - t * 3.0) * 1.4)
        pygame.draw.rect(layer, edge, (max(0, 1 + wob), y, 1, 4))
        pygame.draw.rect(layer, edge, (max(0, r.w - 3 + wob), y, 1, 4))
    # Floating leaves drifting with the current.
    for i in range(max(2, r.w // 44)):
        fx = int((i * 37 + t * 13) % max(1, r.w - 4))
        fy = 5 + (i * 23) % max(1, r.h - 8)
        pygame.draw.rect(layer, (176, 152, 92, 165), (fx, fy, 3, 1))
        pygame.draw.rect(layer, (226, 232, 220, 140), (fx + 3, fy, 1, 1))
    surface.blit(layer, r.topleft)


def draw_bridge_planks(surface: pygame.Surface, rect: pygame.Rect) -> None:
    r = pygame.Rect(rect)
    step = 6
    horizontal = r.w >= r.h
    if horizontal:
        for x in range(r.left + step, r.right, step):
            pygame.draw.line(surface, (86, 58, 36), (x, r.top + 1), (x, r.bottom - 1))
            pygame.draw.line(surface, (132, 96, 60), (x + 1, r.top + 1), (x + 1, r.bottom - 1))
        pygame.draw.line(surface, (48, 32, 22), (r.left, r.top + 1), (r.right, r.top + 1), 2)
        pygame.draw.line(surface, (148, 112, 72), (r.left, r.bottom - 2), (r.right, r.bottom - 2), 1)
    else:
        for y in range(r.top + step, r.bottom, step):
            pygame.draw.line(surface, (86, 58, 36), (r.left + 1, y), (r.right - 1, y))
            pygame.draw.line(surface, (132, 96, 60), (r.left + 1, y + 1), (r.right - 1, y + 1))
        pygame.draw.line(surface, (48, 32, 22), (r.left + 1, r.top), (r.left + 1, r.bottom), 2)
        pygame.draw.line(surface, (148, 112, 72), (r.right - 2, r.top), (r.right - 2, r.bottom), 1)


def draw_tree_detail(surface: pygame.Surface, rect: pygame.Rect, t: float,
                     trunk: Optional[pygame.Rect] = None) -> None:
    """Bark trunk, branches and a layered swaying canopy with fruit."""
    r = pygame.Rect(rect)
    if r.w < 6 or r.h < 6:
        return
    seed = _rect_seed(r, 0x7EE)
    sway = round(math.sin(t * 2.1 + seed * 0.001))
    # Ground shadow.
    pygame.draw.ellipse(surface, (0, 0, 0, 55), (r.x - 3, r.bottom - 2, r.w + 6, 4))
    if trunk is not None:
        tr = pygame.Rect(trunk)
        pygame.draw.rect(surface, (62, 40, 22), tr)
        pygame.draw.rect(surface, (104, 70, 38), (tr.x + 1, tr.y, max(1, tr.w - 2), tr.h))
        pygame.draw.rect(surface, (142, 100, 54), (tr.x + 1, tr.y, 1, tr.h))
        for by in range(tr.y + 1, tr.bottom - 1, 3):
            pygame.draw.line(surface, (48, 30, 18), (tr.x + 1, by), (tr.right - 1, by + 1))
        # Branch reaching into the canopy.
        pygame.draw.line(surface, (96, 64, 34),
                         (tr.centerx, tr.y + 2), (tr.centerx + 5 + sway, r.y + 5), 2)
    pygame.draw.ellipse(surface, (18, 46, 26), (r.x, r.y + 3, r.w, r.h - 2))
    pygame.draw.ellipse(surface, (32, 82, 42), (r.x + 1, r.y + 2, r.w - 2, r.h - 4))
    pygame.draw.ellipse(surface, (52, 108, 54), (r.x + 2, r.y + 1, r.w - 5, max(3, r.h // 2)))
    for i in range(3):
        fx = r.x + 3 + i * 3 + sway
        fy = r.y + 2 + (i % 2)
        pygame.draw.ellipse(surface, (76, 138, 66), (fx, fy, 4, 2))
        pygame.draw.rect(surface, (150, 178, 88), (fx + 1, fy, 2, 1))
    # Coconut / fruit cluster.
    pygame.draw.rect(surface, (122, 82, 44), (r.x + 4 + sway, r.y + r.h - 5, 2, 2))
    pygame.draw.rect(surface, (146, 104, 56), (r.x + 7 + sway, r.y + r.h - 4, 1, 1))


def draw_road_detail(surface: pygame.Surface, rect: pygame.Rect) -> None:
    r = pygame.Rect(rect)
    if r.w < 10 or r.h < 8:
        return
    horizontal = r.w >= r.h * 1.4
    edge = (112, 116, 120)
    if horizontal:
        pygame.draw.line(surface, edge, (r.left + 1, r.top + 1), (r.right - 2, r.top + 1))
        pygame.draw.line(surface, (44, 46, 50), (r.left + 1, r.top + 2), (r.right - 2, r.top + 2))
        pygame.draw.line(surface, edge, (r.left + 1, r.bottom - 2), (r.right - 2, r.bottom - 2))
        pygame.draw.line(surface, (44, 46, 50), (r.left + 1, r.bottom - 3), (r.right - 2, r.bottom - 3))
        for x in range(r.left + 6, r.right - 5, 12):
            pygame.draw.line(surface, (216, 192, 98), (x, r.centery), (x + 5, r.centery))
        for x in range(r.left + 3, r.right - 3, 27):
            pygame.draw.rect(surface, (86, 88, 92), (x, r.top + 3, 1, 1))
    else:
        pygame.draw.line(surface, edge, (r.left + 1, r.top + 1), (r.left + 1, r.bottom - 2))
        pygame.draw.line(surface, (44, 46, 50), (r.left + 2, r.top + 1), (r.left + 2, r.bottom - 2))
        pygame.draw.line(surface, edge, (r.right - 2, r.top + 1), (r.right - 2, r.bottom - 2))
        pygame.draw.line(surface, (44, 46, 50), (r.right - 3, r.top + 1), (r.right - 3, r.bottom - 2))
        for y in range(r.top + 6, r.bottom - 5, 12):
            pygame.draw.line(surface, (216, 192, 98), (r.centerx, y), (r.centerx, y + 5))
        for y in range(r.top + 3, r.bottom - 3, 27):
            pygame.draw.rect(surface, (86, 88, 92), (r.left + 3, y, 1, 1))


def draw_path_detail(surface: pygame.Surface, rect: pygame.Rect) -> None:
    r = pygame.Rect(rect)
    if r.w < 8 or r.h < 8:
        return
    horizontal = r.w >= r.h
    span = r.w if horizontal else r.h
    for i in range(0, span, 7):
        jitter = (i * 7) % 5 - 2
        shade_col = (132, 112, 76) if (i // 7) % 2 == 0 else (96, 78, 54)
        if horizontal:
            pygame.draw.line(surface, shade_col, (r.left + i, r.centery + jitter),
                             (r.left + i + 3, r.centery + jitter))
            if i % 21 == 0:
                pygame.draw.rect(surface, (156, 138, 98), (r.left + i + 1, r.top + 2, 2, 1))
        else:
            pygame.draw.line(surface, shade_col, (r.centerx + jitter, r.top + i),
                             (r.centerx + jitter, r.top + i + 3))
            if i % 21 == 0:
                pygame.draw.rect(surface, (156, 138, 98), (r.left + 2, r.top + i + 1, 1, 2))


# ----------------------------------------------------------------------
# Building architecture
# ----------------------------------------------------------------------

_BUILDING_STYLES = {
    "house": ((152, 108, 62), (98, 62, 38), (86, 150, 190)),
    "damaged_house": ((112, 78, 58), (72, 48, 36), (72, 96, 108)),
    "shelter": ((86, 158, 106), (44, 104, 66), (128, 196, 208)),
    "clinic": ((186, 196, 196), (110, 128, 134), (110, 180, 210)),
    "research": ((96, 122, 148), (52, 76, 100), (110, 196, 224)),
    "commercial": ((186, 142, 78), (116, 78, 46), (128, 178, 198)),
    "warehouse": ((118, 126, 132), (72, 80, 88), (112, 152, 172)),
}


def draw_building_detail(surface: pygame.Surface, rect: pygame.Rect,
                         btype: str, t: float, lit: bool = True) -> None:
    """Add a roof, siding, windows, a door and signage to a building block."""
    r = pygame.Rect(rect)
    if r.w < 12 or r.h < 12:
        return
    wall, roof, glass = _BUILDING_STYLES.get(btype, _BUILDING_STYLES["house"])
    seed = _rect_seed(r, 0x8215)
    rng = random.Random(seed)

    # Cast shadow (up-left light source).
    pygame.draw.rect(surface, (0, 0, 0, 30), (r.x + 3, r.y + 3, r.w, r.h))

    # Wall texture: siding courses or brickwork.
    step = 5 if btype in ("warehouse", "research", "clinic") else 4
    for y in range(r.top + step, r.bottom - 1, step):
        pygame.draw.line(surface, shade(wall, -18), (r.left + 1, y), (r.right - 2, y))
        pygame.draw.line(surface, shade(wall, 14), (r.left + 1, y + 1), (r.right - 2, y + 1))
    if btype in ("house", "damaged_house", "commercial"):
        for y in range(r.top + 3, r.bottom - 2, 8):
            offset = ((y - r.top) // 8 % 2) * 4
            for x in range(r.left + 2 + offset, r.right - 2, 8):
                pygame.draw.line(surface, shade(wall, -26), (x, y), (x, y + 4))

    # Roof: a darker band with eaves and a lit ridge.
    roof_h = max(4, min(8, r.h // 4))
    pygame.draw.rect(surface, shade(roof, -22), (r.x - 1, r.y - 1, r.w + 2, roof_h + 1))
    pygame.draw.rect(surface, roof, (r.x, r.y, r.w, roof_h))
    pygame.draw.rect(surface, shade(roof, 26), (r.x + 1, r.y, r.w - 2, 1))
    for x in range(r.left + 3, r.right - 2, 6):
        pygame.draw.line(surface, shade(roof, -28), (x, r.y + 1), (x, r.y + roof_h - 1))

    # Windows in two rows where there is room.
    win_cols = max(1, min(4, (r.w - 8) // 15))
    win_rows = 2 if r.h >= 38 else 1
    for row in range(win_rows):
        wy = r.top + roof_h + 5 + row * 13
        if wy + 7 > r.bottom - 9:
            continue
        for col in range(win_cols):
            wx = r.left + 5 + col * ((r.w - 10) // max(1, win_cols))
            if wx + 7 > r.right - 3:
                continue
            frame = shade(wall, -40)
            pygame.draw.rect(surface, frame, (wx - 1, wy - 1, 9, 9))
            is_lit = lit and rng.random() < (0.62 if btype != "research" else 0.85)
            pane = (238, 198, 112) if is_lit else glass
            pygame.draw.rect(surface, pane, (wx, wy, 7, 7))
            pygame.draw.rect(surface, shade(pane, 34), (wx, wy, 3, 3))
            pygame.draw.line(surface, frame, (wx + 3, wy), (wx + 3, wy + 7))
            pygame.draw.line(surface, frame, (wx, wy + 3), (wx + 7, wy + 3))
            pygame.draw.rect(surface, shade(wall, 20), (wx - 1, wy + 8, 9, 1))
            if is_lit:
                surface.blit(glow_surface(8, (255, 200, 110), 55), (wx - 4, wy - 4))

    # Door centered at the bottom.
    door_w = min(9, max(5, r.w // 4))
    dx = r.centerx - door_w // 2
    dy = r.bottom - min(13, max(8, r.h // 3))
    pygame.draw.rect(surface, shade(wall, -52), (dx - 1, dy - 1, door_w + 2, r.bottom - dy + 1))
    door_col = (92, 58, 34) if btype in ("house", "damaged_house", "commercial") else (64, 84, 96)
    pygame.draw.rect(surface, door_col, (dx, dy, door_w, r.bottom - dy))
    pygame.draw.rect(surface, shade(door_col, 24), (dx, dy, 1, r.bottom - dy))
    pygame.draw.rect(surface, (232, 196, 92), (dx + door_w - 3, dy + 6, 1, 1))
    pygame.draw.rect(surface, shade(wall, -30), (dx - 2, r.bottom - 1, door_w + 4, 2))

    # Type-specific trim.
    if btype == "clinic":
        cx, cy = r.right - 8, r.top + roof_h + 10
        pygame.draw.rect(surface, (238, 240, 236), (cx - 4, cy - 4, 9, 9))
        pygame.draw.rect(surface, (206, 62, 58), (cx - 1, cy - 3, 3, 7))
        pygame.draw.rect(surface, (206, 62, 58), (cx - 3, cy - 1, 7, 3))
    elif btype == "shelter":
        pygame.draw.rect(surface, (28, 92, 56), (r.left + 3, r.top + roof_h + 2, r.w - 6, 7))
        pygame.draw.rect(surface, (214, 236, 214), (r.left + 4, r.top + roof_h + 3, r.w - 8, 5), 1)
    elif btype == "commercial":
        # Striped awning over the door.
        ay = dy - 4
        pygame.draw.rect(surface, (226, 214, 188), (dx - 5, ay, door_w + 10, 3))
        for i in range(0, door_w + 10, 4):
            pygame.draw.rect(surface, (188, 72, 58), (dx - 5 + i, ay, 2, 3))
    elif btype == "warehouse":
        for sy in range(dy, r.bottom, 3):
            pygame.draw.line(surface, (58, 66, 74), (dx, sy), (dx + door_w, sy))
    elif btype == "research":
        ax = r.right - 5
        pygame.draw.line(surface, (150, 176, 196), (ax, r.top), (ax, r.top - 9))
        pygame.draw.ellipse(surface, (220, 90, 74), (ax - 1, r.top - 11, 3, 3))
        blink = 0.6 + 0.4 * math.sin(t * 5 + seed)
        surface.blit(glow_surface(4, (255, 96, 76), int(70 * blink)), (ax - 3, r.top - 13))

    if btype == "damaged_house":
        # Boarded windows and cracks in the wall.
        for bx in range(r.left + 6, r.right - 6, 14):
            for by in range(r.top + roof_h + 6, r.bottom - 10, 13):
                pygame.draw.line(surface, (156, 114, 68), (bx, by + 5), (bx + 7, by), 2)
                pygame.draw.line(surface, (84, 56, 34), (bx, by), (bx + 7, by + 5), 1)
        pygame.draw.lines(surface, (38, 28, 24), False,
                          [(r.left + 3, r.bottom - 4), (r.left + 9, r.bottom - 14),
                           (r.left + 7, r.bottom - 22)], 1)


# ----------------------------------------------------------------------
# Hazard-zone specific effects
# ----------------------------------------------------------------------


def draw_hazard_detail(surface: pygame.Surface, rect: pygame.Rect,
                       hazard_type: str, t: float, pulse: float) -> None:
    """Distinct animated treatment inside each kind of danger zone."""
    r = pygame.Rect(rect)
    if r.w < 4 or r.h < 4:
        return
    layer = pygame.Surface(r.size, pygame.SRCALPHA)

    if hazard_type == "fire":
        # Heat gradient, flickering flame tongues and rising smoke.
        pygame.draw.rect(layer, (196, 62, 26, int(28 + 18 * pulse)), layer.get_rect())
        for x in range(0, r.w, 4):
            wob = 0.5 * math.sin(t * 8 + x * 0.7) + 0.5 * math.sin(t * 3 + x * 0.2)
            hgt = int(r.h * (0.45 + 0.35 * wob)) // 2 * 2
            hgt = max(3, min(r.h, hgt))
            pygame.draw.rect(layer, (214, 44, 28, 150), (x, r.h - hgt, 3, hgt))
            pygame.draw.rect(layer, (250, 132, 34, 175), (x, r.h - int(hgt * 0.7), 3, int(hgt * 0.7)))
            pygame.draw.rect(layer, (255, 226, 118, 190), (x, r.h - int(hgt * 0.35), 2, int(hgt * 0.35)))
        for i in range(3):
            sx = (i * r.w // 3 + int(t * 8)) % max(1, r.w)
            sy = int((t * 17 + i * 21) % max(1, r.h))
            pygame.draw.circle(layer, (72, 66, 64, 70), (sx, r.h - sy), 3 + i)

    elif hazard_type in ("flood", "tsunami"):
        deep = (22, 82, 142) if hazard_type == "flood" else (24, 62, 128)
        pygame.draw.rect(layer, (*deep, int(56 + 18 * pulse)), layer.get_rect())
        for y in range(2, r.h, 6):
            drift = int(t * 12 + y * 4) % 15
            for x in range(drift - 15, r.w, 15):
                pygame.draw.rect(layer, (168, 216, 240, 150), (x, y, 6, 1))
        for x in range(0, r.w, 5):
            wob = int(math.sin(x * 0.2 + t * 4) * 2)
            pygame.draw.rect(layer, (232, 246, 252, 190), (x, max(0, wob), 4, 1))
        for i in range(max(1, r.w // 40)):
            fx = int((i * 31 + t * 15) % max(1, r.w - 4))
            fy = 4 + (i * 19) % max(1, r.h - 6)
            pygame.draw.rect(layer, (168, 142, 92, 175), (fx, fy, 3, 1))

    elif hazard_type == "ash":
        pygame.draw.rect(layer, (118, 112, 106, int(34 + 16 * pulse)), layer.get_rect())
        for _ in range(max(8, r.w * r.h // 130)):
            ax = int((_ * 29 + t * 6) % max(1, r.w))
            ay = int((_ * 47 + t * 13) % max(1, r.h))
            col = (196, 190, 182, 140) if _ % 3 else (86, 82, 80, 150)
            pygame.draw.rect(layer, col, (ax, ay, 2, 1))

    elif hazard_type == "debris":
        # Falling rubble: tumbling concrete chips and expanding dust puffs.
        pygame.draw.rect(layer, (96, 78, 58, int(38 + 16 * pulse)), layer.get_rect())
        for i in range(max(4, r.w // 12)):
            dx = (i * 19 + int(t * 14)) % max(1, r.w)
            dy = (i * 37 + int(t * 26)) % max(1, r.h)
            size = 2 + (i % 3)
            pygame.draw.polygon(layer, (148, 138, 124, 190),
                                [(dx, dy + size), (dx + size // 2, dy),
                                 (dx + size, dy + size - 1)])
            pygame.draw.line(layer, (94, 84, 76, 150),
                             (dx + size // 2, dy), (dx + size, dy + size - 1))
        for i in range(2):
            cx = (i * r.w // 2 + int(t * 11)) % max(1, r.w)
            pygame.draw.ellipse(layer, (186, 172, 150, int(36 * pulse)),
                                (cx - 6, r.h // 2 - 3, 12, 6))

    elif hazard_type in ("landslide", "unstable", "ashfall"):
        pygame.draw.rect(layer, (92, 74, 58, int(40 + 14 * pulse)), layer.get_rect())
        for i in range(max(3, r.w // 16)):
            rx = (i * 23 + int(t * 10)) % max(1, r.w)
            ry = (i * 31) % max(1, r.h)
            pygame.draw.polygon(layer, (128, 116, 100, 175),
                                [(rx, ry + 4), (rx + 3, ry), (rx + 6, ry + 4)])
        for i in range(3):
            sx = (i * r.w // 3 + int(t * 14)) % max(1, r.w)
            pygame.draw.circle(layer, (172, 156, 132, 60), (sx, r.h // 2), 6 + i)

    surface.blit(layer, r.topleft)


def draw_safe_zone_detail(surface: pygame.Surface, rect: pygame.Rect, t: float) -> None:
    """A soft green beacon, dashed boundary and a waving flag."""
    r = pygame.Rect(rect)
    if r.w < 6 or r.h < 6:
        return
    glow = 0.5 + 0.5 * math.sin(t * 2.6)
    cx, cy = r.centerx, r.centery
    surface.blit(glow_surface(min(r.w, r.h) // 2, (110, 230, 140), int(38 + 22 * glow)),
                 (cx - min(r.w, r.h) // 2, cy - min(r.w, r.h) // 2))
    for x in range(r.left + 2, r.right - 2, 10):
        pygame.draw.line(surface, (168, 244, 184), (x, r.top + 2), (x + 5, r.top + 2), 1)
        pygame.draw.line(surface, (168, 244, 184), (x + 5, r.bottom - 3), (x, r.bottom - 3), 1)
    # Beacon pole and waving flag.
    px = r.left + 7
    pygame.draw.line(surface, (198, 214, 202), (px, r.bottom - 4), (px, r.top + 4))
    wave = round(math.sin(t * 4) * 2)
    pygame.draw.polygon(surface, (86, 206, 122),
                        [(px, r.top + 4), (px + 12 + wave, r.top + 6),
                         (px, r.top + 11)])


# ----------------------------------------------------------------------
# Hazard-reactive ambience
# ----------------------------------------------------------------------

PROFILES = ("calm", "wind", "flood", "fire", "ash", "dust")


def hazard_profile(hazards: Iterable, hazard_zones: Iterable = ()) -> str:
    """Pick the dominant weather mood from active hazards and map zones."""
    words: List[str] = []
    for hz in hazards:
        words.append(type(hz).__name__.lower())
        words.append(str(getattr(hz, "name", "")).lower())
    for z in hazard_zones:
        words.append(str(getattr(z, "hazard_type", "")).lower())
    text = " ".join(words)
    # Bare "ash" would also match "flash" (FlashFloodHazard).
    if any(k in text for k in ("volcan", "erupt", "ashfall", "lahar")):
        return "ash"
    if any(k in text for k in ("fire", "burn", "blaze")):
        return "fire"
    if any(k in text for k in ("typhoon", "wind", "storm")):
        return "wind"
    if any(k in text for k in ("flood", "tsunami", "surge", "water")):
        return "flood"
    if any(k in text for k in ("quake", "earth", "landslide", "debris")):
        return "dust"
    return "calm"


class AmbientParticles:
    """Layered screen-space weather driven by the dominant hazard."""

    COUNT = 78
    W, H = 320, 180

    def __init__(self, block_map, profile: str = "calm"):
        self.rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xC10D))
        self.profile = profile
        self.t = 0.0
        self.particles: List[dict] = []
        self.set_profile(profile)

    def _spawn(self, at_random_y: bool = True) -> dict:
        r = self.rng
        p = {
            "x": r.uniform(-12, self.W + 12),
            "y": r.uniform(0, self.H) if at_random_y else r.uniform(-14, -2),
            "phase": r.uniform(0, math.tau),
            "size": r.choice((1, 1, 1, 2, 2)),
            "layer": r.choice((0, 0, 1, 1, 2)),
        }
        prof = self.profile
        if prof == "wind":
            p.update(vx=r.uniform(90, 165), vy=r.uniform(24, 54),
                     length=r.randrange(4, 11), color=(182, 212, 232))
        elif prof == "flood":
            p.update(vx=r.uniform(10, 34), vy=r.uniform(-7, 7),
                     color=r.choice(((156, 216, 236), (100, 172, 214), (238, 248, 244))))
        elif prof == "fire":
            p.update(vx=r.uniform(-16, 16), vy=r.uniform(-42, -16),
                     color=r.choice(((255, 184, 68), (255, 122, 42), (255, 226, 140))))
        elif prof == "ash":
            p.update(vx=r.uniform(-14, 14), vy=r.uniform(10, 26),
                     color=r.choice(((152, 148, 144), (202, 194, 184), (112, 108, 106))))
        elif prof == "dust":
            p.update(vx=r.uniform(14, 44), vy=r.uniform(-9, 8),
                     color=r.choice(((190, 172, 136), (152, 134, 106), (220, 204, 170))))
        else:
            p.update(vx=r.uniform(-5, 6), vy=r.uniform(-10, -2),
                     color=r.choice(((255, 242, 182), (232, 218, 174), (202, 230, 190))))
        return p

    def set_profile(self, profile: str) -> None:
        if profile not in PROFILES:
            profile = "calm"
        if profile == self.profile and self.particles:
            return
        self.profile = profile
        self.particles = [self._spawn() for _ in range(self.COUNT)]

    def update(self, dt: float, profile: str = "calm", camera=None) -> None:
        dt = min(0.05, max(0.0, dt))
        self.t += dt
        self.set_profile(profile)
        drift = -getattr(camera.offset, "x", 0) if camera is not None else 0.0
        for p in self.particles:
            depth = 0.45 + p["layer"] * 0.4
            p["x"] += (p["vx"] * depth + drift * 0.02 * depth) * dt
            p["y"] += p["vy"] * depth * dt
            p["phase"] += dt * (2.4 + depth)
            if p["y"] < -16:
                p["y"] = self.H + 8
                p["x"] = self.rng.uniform(-12, self.W + 12)
            elif p["y"] > self.H + 16:
                p["y"] = -10
                p["x"] = self.rng.uniform(-12, self.W + 12)
            if p["x"] < -18:
                p["x"] = self.W + 12
            elif p["x"] > self.W + 18:
                p["x"] = -12

    def draw(self, surface: pygame.Surface) -> None:
        prof = self.profile
        # Rain / wind gets a translucent moving sheet behind the streaks.
        if prof == "wind":
            sheet = pygame.Surface((self.W, self.H), pygame.SRCALPHA)
            off = int(self.t * 40) % 40
            for x in range(-40, self.W + 40, 40):
                pygame.draw.line(sheet, (168, 198, 220, 26),
                                 (x + off, 0), (x + off - 18, self.H), 2)
            surface.blit(sheet, (0, 0))

        for p in self.particles:
            twinkle = 0.55 + 0.45 * math.sin(p["phase"])
            color = p["color"]
            if twinkle < 0.6 and prof in ("calm", "fire", "ash"):
                continue
            x, y = int(p["x"]), int(p["y"])
            if not (-5 <= x <= self.W + 5 and -5 <= y <= self.H + 5):
                continue
            depth = 1 if p["layer"] == 2 else 0
            if prof == "wind":
                length = p.get("length", 5)
                pygame.draw.line(surface, color, (x, y), (x - 2 - depth, y - length))
                if depth:
                    pygame.draw.line(surface, (222, 240, 252), (x, y), (x - 1, y - length // 2))
            elif prof == "fire":
                pygame.draw.rect(surface, color, (x, y, p["size"], p["size"] + 1 + depth))
                if depth:
                    pygame.draw.rect(surface, (255, 244, 196), (x, y, 1, 1))
            elif prof == "flood":
                pygame.draw.line(surface, color, (x, y), (x + 2 + depth, y))
                pygame.draw.rect(surface, color, (x + 1, y - 1, 1, 1))
            elif prof == "ash":
                pygame.draw.rect(surface, color, (x, y, p["size"], 1))
                if depth and twinkle > 0.85:
                    pygame.draw.rect(surface, (228, 222, 214), (x, y - 1, 1, 1))
            elif prof == "dust":
                pygame.draw.rect(surface, color, (x, y, p["size"] + depth, p["size"]))
                pygame.draw.rect(surface, color, (x + 2, y - 1, 1, 1))
            else:
                surface.fill(color, (x, y, 1, 1))
                if depth and twinkle > 0.86:
                    surface.fill(color, (x - 1, y, 1, 1))
                    surface.fill(color, (x + 1, y, 1, 1))
                    surface.fill((255, 255, 226), (x, y - 1, 1, 1))


# ----------------------------------------------------------------------
# Lighting & colour grade
# ----------------------------------------------------------------------

# Per-biome mood: (overlay colour, alpha, lamp/window warmth)
_MOODS = {
    "town": ((252, 196, 122), 18, 1.0),
    "highland": ((168, 196, 222), 20, 0.75),
    "plains": ((250, 222, 156), 16, 0.85),
    "harbor": ((132, 176, 206), 22, 0.8),
    "volcanic": ((212, 116, 78), 24, 1.2),
    "facility": ((128, 178, 210), 20, 0.9),
}


class Atmosphere:
    """Screen-space colour grade, sun shafts, vignette and lightning."""

    W, H = 320, 180

    def __init__(self, block_map, profile: str = "calm"):
        self.biome = detect_biome(block_map)
        self.profile = profile
        self.t = 0.0
        self._flash = 0.0
        self._next_flash = 7.0
        self.rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xA7A))
        self.vignette = vignette_surface(self.W, self.H, 46)

    def update(self, dt: float, profile: str = "calm") -> None:
        self.t += dt
        self.profile = profile
        if profile in ("wind", "ash"):
            self._next_flash -= dt
            if self._next_flash <= 0:
                self._flash = 1.0
                self._next_flash = self.rng.uniform(6.0, 14.0)
        if self._flash > 0:
            self._flash = max(0.0, self._flash - dt * 4.5)

    def draw(self, surface: pygame.Surface) -> None:
        mood_color, alpha, _warm = _MOODS.get(self.biome, _MOODS["town"])
        if self.profile in ("wind", "flood"):
            mood_color, alpha = (146, 172, 196), max(alpha, 26)
        elif self.profile == "fire":
            mood_color, alpha = (236, 132, 72), max(alpha, 28)
        elif self.profile == "ash":
            mood_color, alpha = (168, 158, 148), max(alpha, 30)

        # A gentle colour grade. Multiplying RGB leaves the canvas opaque.
        strength = min(0.4, alpha / 90.0)
        grade_color = mix((255, 255, 255), mood_color, strength)
        grade = pygame.Surface((self.W, self.H))
        grade.fill(grade_color)
        surface.blit(grade, (0, 0), special_flags=pygame.BLEND_RGB_MULT)

        # Soft diagonal light shafts that slowly breathe.
        shafts = pygame.Surface((self.W, self.H), pygame.SRCALPHA)
        for i in range(3):
            x = 40 + i * 105 + int(math.sin(self.t * 0.35 + i) * 12)
            beam_alpha = max(0, 12 + int(7 * math.sin(self.t * 0.8 + i * 2)))
            pygame.draw.polygon(
                shafts, (255, 244, 206, beam_alpha),
                [(x, 0), (x + 16, 0), (x + 48, self.H), (x + 16, self.H)],
            )
        surface.blit(shafts, (0, 0))

        # Lightning briefly brightens everything.
        if self._flash > 0:
            flash = pygame.Surface((self.W, self.H), pygame.SRCALPHA)
            flash.fill((206, 226, 255, int(self._flash * 90)))
            surface.blit(flash, (0, 0))

        surface.blit(self.vignette, (0, 0))
