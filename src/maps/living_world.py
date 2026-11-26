"""Cinematic living-world effects for the in-game chapter scenes.

Where :mod:`world_ambience` bakes *detail* onto the map, this module makes the
world feel *alive*:

* :class:`LightingSystem` - warm windows, lamps, fire glow and beacon pulses on
  an additive light layer, with long cast shadows from buildings and trees.
* :class:`WeatherFX` - rain that splashes, wind gusts that bend vegetation,
  rotating leaves, smoke columns and a storm that builds over time.
* :class:`WaterFX` - reflected sky bands, wave distortion, impact ripples and
  foam that drifts against the shore.
* :class:`AmbientLife` - birds, butterflies, fireflies and wind-blown leaves.
* :class:`PostFX` - heat shimmer, dithered colour bloom and film grain.

Everything is code-drawn, deterministic per level and cheap enough for the
320x180 internal canvas at 60 fps.  No image assets are used.
"""
from __future__ import annotations

import math
import random
from typing import Iterable, List, Optional, Sequence, Tuple

import pygame

from src.maps.world_ambience import (
    _seed,
    _rect_seed,
    detect_biome,
    glow_surface,
    mix,
    shade,
)

Color = Tuple[int, int, int]

BUILDING_TYPES = (
    "house", "damaged_house", "shelter", "clinic", "research",
    "research_facility", "commercial", "warehouse",
)
TREE_TYPES = ("tree", "tree_trunk")
WATER_TYPES = ("water", "hazard_flood", "hazard_tsunami")


# ----------------------------------------------------------------------
# Shared helpers
# ----------------------------------------------------------------------

# 4x4 ordered dither matrix - turns smooth gradients into rich pixel art.
_BAYER4 = (
    ( 0,  8,  2, 10),
    (12,  4, 14,  6),
    ( 3, 11,  1,  9),
    (15,  7, 13,  5),
)

_LIGHT_CACHE: dict = {}


def soft_glow(radius: int, color: Color, alpha: int) -> pygame.Surface:
    """Cached radial glow with quantised alpha (keeps the cache tiny)."""
    radius = max(2, int(radius))
    alpha = max(8, min(255, (int(alpha) // 12) * 12 + 6))
    key = (radius, tuple(color), alpha)
    surf = _LIGHT_CACHE.get(key)
    if surf is None:
        surf = glow_surface(radius, color, alpha)
        _LIGHT_CACHE[key] = surf
    return surf


_GRADIENT_CACHE: dict = {}


def dithered_gradient(width: int, height: int, top: Color, bottom: Color,
                      bands: int = 10) -> pygame.Surface:
    """A cached vertical gradient dithered into a limited pixel-art palette."""
    width, height = max(1, width), max(1, height)
    key = (width, height, tuple(top), tuple(bottom), bands)
    cached = _GRADIENT_CACHE.get(key)
    if cached is not None:
        return cached
    surf = pygame.Surface((width, height))
    step = 256 // max(2, bands)
    for y in range(height):
        t = y / max(1, height - 1)
        base = mix(top, bottom, t)
        for x in range(width):
            nudge = ((_BAYER4[(y % 4)][(x % 4)] / 15.0) - 0.5) * step * 1.4
            c = tuple(max(0, min(255, (int(base[i] + nudge) // step) * step))
                      for i in range(3))
            surf.fill(c, (x, y, 1, 1))
    _GRADIENT_CACHE[key] = surf
    return surf


def _on_screen(rect: pygame.Rect, w: int, h: int, pad: int = 32) -> bool:
    return rect.right > -pad and rect.left < w + pad and \
           rect.bottom > -pad and rect.top < h + pad


# ----------------------------------------------------------------------
# Dynamic lighting and shadows
# ----------------------------------------------------------------------

class LightingSystem:
    """Additive point lights and directional cast shadows."""

    def __init__(self, block_map, profile: str = "calm"):
        self.block_map = block_map
        self.biome = detect_biome(block_map)
        self.profile = profile
        self.t = 0.0
        self.lights: List[dict] = []
        self.casters: List[Tuple[pygame.Rect, int, str]] = []
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0x11D))
        self.rng = rng

        # Warm windows and entrance lights on every building.
        for elem in block_map.elements:
            r = elem.rect
            if elem.elem_type in BUILDING_TYPES:
                self.lights.append({
                    "x": r.centerx, "y": r.y + r.h * 0.32,
                    "radius": 24, "color": (255, 196, 108),
                    "base": 0.30, "amp": 0.08, "speed": 1.1 + rng.random() * 0.8,
                    "phase": rng.random() * math.tau, "kind": "window",
                })
                self.casters.append((pygame.Rect(r), max(8, r.h // 3), "building"))
            elif elem.elem_type == "tree":
                self.casters.append((pygame.Rect(r), max(6, r.h // 2), "tree"))

        # Fire zones throw a strong, fast-flickering orange glow.
        for hz in block_map.hazard_zones:
            htype = str(getattr(hz, "hazard_type", "")).lower()
            r = hz.rect
            if "fire" in htype or "burn" in htype:
                self.lights.append({
                    "x": r.centerx, "y": r.centery,
                    "radius": max(24, min(70, r.w // 2)), "color": (255, 118, 48),
                    "base": 0.52, "amp": 0.22, "speed": 7.5,
                    "phase": rng.random() * math.tau, "kind": "fire",
                })
            elif "ash" in htype or "volcan" in htype or "lahar" in htype:
                self.lights.append({
                    "x": r.centerx, "y": r.centery,
                    "radius": max(20, min(56, r.w // 2)), "color": (226, 88, 46),
                    "base": 0.28, "amp": 0.10, "speed": 2.0,
                    "phase": rng.random() * math.tau, "kind": "vent",
                })

        # Safe zones glow gently so they read as a refuge from across the map.
        for sz in block_map.safe_zones:
            r = sz.rect
            self.lights.append({
                "x": r.centerx, "y": r.centery,
                "radius": max(22, min(48, r.w // 2)), "color": (112, 240, 152),
                "base": 0.26, "amp": 0.12, "speed": 2.4,
                "phase": rng.random() * math.tau, "kind": "safe",
            })

        # Thematic fill light - a cold starless night in storm/ash scenes.
        self.ambient = {
            "calm": (42, 30, 14), "wind": (20, 30, 48), "flood": (20, 40, 58),
            "fire": (54, 22, 12), "ash": (44, 24, 20), "dust": (38, 30, 20),
        }

    def update(self, dt: float, profile: str = "calm", camera=None) -> None:
        self.profile = profile
        self.t += dt
        for light in self.lights:
            light["phase"] += dt * light["speed"]

    def draw_shadows(self, surface: pygame.Surface, camera) -> None:
        """Long soft shadows cast down-right from a fixed upper-left sun."""
        layer = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        for rect, height, kind in self.casters:
            s = camera.apply(rect)
            if not _on_screen(s, surface.get_width(), surface.get_height()):
                continue
            skew = max(2, int(height * 0.65))
            alpha = 34 if kind == "building" else 24
            poly = [
                (s.left, s.top), (s.right, s.top),
                (s.right + skew, s.bottom + skew // 2),
                (s.left + skew, s.bottom + skew // 2),
            ]
            pygame.draw.polygon(layer, (0, 0, 0, alpha), poly)
            # Contact shadow anchors the object to the ground.
            pygame.draw.ellipse(layer, (0, 0, 0, alpha + 14),
                                (s.left + 1, s.bottom - 3, s.width - 2, 6))
        surface.blit(layer, (0, 0))

    def draw(self, surface: pygame.Surface, camera) -> None:
        """Blend all point lights additively, below the HUD."""
        w, h = surface.get_size()
        layer = pygame.Surface((w, h), pygame.SRCALPHA)
        # Gentle ambient lift so shadows are never pitch black.
        amb = self.ambient.get(self.profile, self.ambient["calm"])
        layer.fill((*amb, 26))

        for light in self.lights:
            flick = 1.0 + light["amp"] * math.sin(light["phase"])
            if light["kind"] == "fire":
                flick += 0.12 * math.sin(light["phase"] * 2.7 + 1.3)
            probe = pygame.Rect(int(light["x"]) - 1, int(light["y"]) - 1, 2, 2)
            s = camera.apply(probe)
            if not _on_screen(s, w, h, pad=light["radius"] + 4):
                continue
            radius = int(light["radius"] * (0.94 + 0.06 * flick))
            alpha = int(255 * max(0.05, light["base"] * flick))
            glow = soft_glow(radius, light["color"], alpha)
            layer.blit(glow, (s.centerx - radius, s.centery - radius))
        surface.blit(layer, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)


# ----------------------------------------------------------------------
# Living weather with physics
# ----------------------------------------------------------------------

class WeatherFX:
    """Rain with splashes, wind gusts, rotating leaves and smoke columns."""

    def __init__(self, block_map, profile: str = "calm"):
        self.block_map = block_map
        self.profile = profile
        self.t = 0.0
        self.intensity = 0.35 if profile in ("wind", "flood") else 0.0
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0x33E))
        self.rng = rng
        self.drops: List[dict] = []
        self.leaves: List[dict] = []
        self.splashes: List[dict] = []
        self.smoke: List[dict] = []
        self._init_drops(90)
        self._init_leaves(26)
        self._init_smoke()

    def _init_drops(self, count: int) -> None:
        r = self.rng
        self.drops = [{
            "x": r.uniform(-20, 340), "y": r.uniform(-180, 180),
            "v": r.uniform(150, 260), "len": r.randrange(4, 9),
            "depth": r.choice((0.4, 0.6, 0.8, 1.0)),
        } for _ in range(count)]

    def _init_leaves(self, count: int) -> None:
        r = self.rng
        self.leaves = [{
            "x": r.uniform(0, 320), "y": r.uniform(0, 180),
            "vx": r.uniform(6, 26), "vy": r.uniform(4, 16),
            "angle": r.uniform(0, math.tau), "spin": r.uniform(-3, 3),
            "size": r.choice((1, 2)), "color": r.choice(
                ((196, 148, 68), (214, 176, 88), (168, 118, 62), (124, 156, 84))),
        } for _ in range(count)]

    def _init_smoke(self) -> None:
        r = self.rng
        self.smoke = []
        for elem in self.block_map.elements:
            if elem.elem_type in BUILDING_TYPES and r.random() < 0.55:
                self.smoke.append({
                    "x": elem.rect.centerx + r.randrange(-6, 7), "y": elem.rect.y,
                    "phase": r.random() * math.tau,
                    "color": (168, 164, 160) if self.biome != "volcanic" else (108, 100, 96),
                })

    @property
    def biome(self) -> str:
        return detect_biome(self.block_map)

    def set_profile(self, profile: str) -> None:
        if profile != self.profile:
            self.profile = profile

    def update(self, dt: float, profile: str = "calm", camera=None) -> None:
        dt = min(0.05, dt)
        self.set_profile(profile)
        self.t += dt
        stormy = profile in ("wind", "flood")
        target = 1.0 if stormy else (0.55 if profile == "dust" else 0.0)
        # Storms build gradually instead of snapping on.
        self.intensity += (target - self.intensity) * min(1.0, dt * 0.55)

        gust = 0.5 + 0.5 * math.sin(self.t * 0.9) * math.sin(self.t * 0.27 + 1.1)
        for drop in self.drops:
            drop["y"] += drop["v"] * drop["depth"] * dt
            drop["x"] += (18 + gust * 42) * drop["depth"] * dt
            if drop["y"] >= 176:
                if self.intensity > 0.25 and self.rng.random() < 0.35:
                    self.splashes.append({"x": drop["x"], "y": 176, "life": 0.34})
                drop["y"] = -8
                drop["x"] = self.rng.uniform(-20, 340)
        for s in self.splashes:
            s["life"] -= dt
        self.splashes = [s for s in self.splashes if s["life"] > 0]

        blow = profile in ("wind", "dust", "ash")
        for leaf in self.leaves:
            leaf["angle"] += leaf["spin"] * dt
            leaf["x"] += (leaf["vx"] + (gust * 55 if blow else 0)) * dt
            leaf["y"] += (leaf["vy"] + (gust * 9 if blow else -2)) * dt
            if leaf["x"] > 330:
                leaf["x"] = -10
                leaf["y"] = self.rng.uniform(10, 170)
            if leaf["y"] > 186:
                leaf["y"] = -6

        for puff in self.smoke:
            puff["phase"] += dt * (0.7 + 0.3 * gust)

    def draw(self, surface: pygame.Surface, camera, layer: str = "front") -> None:
        """Draw weather: ``back`` for smoke, ``front`` for rain and leaves."""
        if layer == "back":
            self._draw_smoke(surface, camera)
            return
        if self.intensity > 0.05:
            self._draw_rain(surface)
        self._draw_splashes(surface)
        self._draw_leaves(surface)

    def _draw_rain(self, surface: pygame.Surface) -> None:
        sheet = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        a = int(120 * self.intensity)
        for drop in self.drops:
            if drop["depth"] < 0.7:
                continue  # far drops are drawn as a faint slanted wash
            x, y = int(drop["x"]), int(drop["y"])
            pygame.draw.line(sheet, (168, 206, 232, a), (x, y),
                             (x - drop["len"] // 2, y - drop["len"]), 1)
        surface.blit(sheet, (0, 0))
        wash = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        off = int(self.t * 55) % 26
        for x in range(-30, surface.get_width() + 30, 26):
            pygame.draw.line(wash, (190, 216, 238, int(18 * self.intensity)),
                             (x + off, 0), (x + off - 12, surface.get_height()), 2)
        surface.blit(wash, (0, 0))

    def _draw_splashes(self, surface: pygame.Surface) -> None:
        for s in self.splashes:
            life = s["life"] / 0.34
            r = int((1 - life) * 5) + 1
            pygame.draw.ellipse(surface, (198, 228, 244, int(150 * life)),
                                (s["x"] - r, s["y"] - r // 2, r * 2, r), 1)

    def _draw_leaves(self, surface: pygame.Surface) -> None:
        for leaf in self.leaves:
            if self.profile in ("calm", "fire") and self.rng.random() < 0.5:
                continue
            x, y = int(leaf["x"]), int(leaf["y"])
            if not (-4 <= x <= 324 and -4 <= y <= 184):
                continue
            size = leaf["size"]
            if math.cos(leaf["angle"]) > 0:
                pygame.draw.rect(surface, leaf["color"], (x, y, size + 1, size))
            else:
                pygame.draw.rect(surface, shade(leaf["color"], -18), (x, y, size, size))

    def _draw_smoke(self, surface: pygame.Surface, camera) -> None:
        for puff in self.smoke:
            s = camera.apply(pygame.Rect(int(puff["x"]), int(puff["y"]), 1, 1))
            if not _on_screen(s, surface.get_width(), surface.get_height()):
                continue
            for i in range(4):
                rise = (puff["phase"] * 7 + i * 7) % 28
                drift = int(math.sin(puff["phase"] + i) * 3)
                radius = 2 + i
                alpha = max(0, 46 - i * 10 - int(rise * 0.6))
                if alpha <= 0:
                    continue
                surf = soft_glow(radius, puff["color"], alpha)
                surface.blit(surf, (s.centerx + drift - radius,
                                    s.top - rise - radius))


# ----------------------------------------------------------------------
# Reflective water
# ----------------------------------------------------------------------

class WaterFX:
    """Reflected sky, wave bands, impact ripples and drifting foam."""

    def __init__(self, block_map, biome: str):
        self.block_map = block_map
        self.biome = biome
        self.t = 0.0
        self.rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xA7E))
        self.ripples: List[dict] = []

        # Reflected sky palette per biome.
        self.sky_top, self.sky_bottom = {
            "town": ((92, 142, 186), (186, 198, 176)),
            "highland": ((70, 112, 160), (168, 190, 202)),
            "plains": ((108, 158, 196), (206, 200, 158)),
            "harbor": ((64, 118, 166), (158, 190, 206)),
            "volcanic": ((116, 74, 74), (186, 124, 92)),
            "facility": ((70, 120, 152), (152, 180, 196)),
        }.get(biome, ((92, 142, 186), (186, 198, 176)))

    def update(self, dt: float) -> None:
        self.t += dt
        if self.rng.random() < dt * 2.5:
            for elem in self.block_map.elements:
                if elem.elem_type in WATER_TYPES:
                    r = elem.rect
                    self.ripples.append({
                        "x": self.rng.randrange(r.left, r.right),
                        "y": self.rng.randrange(r.top, r.bottom),
                        "life": 0.9,
                    })
                    break
        for rp in self.ripples:
            rp["life"] -= dt
        self.ripples = [rp for rp in self.ripples if rp["life"] > 0]

    def draw(self, surface: pygame.Surface, camera) -> None:
        for elem in self.block_map.elements:
            if elem.elem_type not in WATER_TYPES:
                continue
            r = camera.apply(elem.rect)
            if not _on_screen(r, surface.get_width(), surface.get_height()):
                continue
            self._draw_water(surface, r)

    def _draw_water(self, surface: pygame.Surface, r: pygame.Rect) -> None:
        if r.w < 6 or r.h < 4:
            return
        layer = pygame.Surface(r.size, pygame.SRCALPHA)

        # Reflected sky - a dithered gradient that darkens with depth.
        sky = dithered_gradient(r.w, max(2, r.h // 2), self.sky_top, self.sky_bottom, 7)
        layer.blit(sky, (0, 0))
        dark = pygame.Surface((r.w, r.h), pygame.SRCALPHA)
        for y in range(r.h):
            dark.fill((12, 32, 58, int(30 + 110 * (y / max(1, r.h)))), (0, y, r.w, 1))
        layer.blit(dark, (0, 0))

        # Horizontal wave bands with a gentle vertical bob.
        for y in range(2, r.h, 4):
            shift = int(2 * math.sin(self.t * 1.8 + y * 0.19))
            color = (148, 202, 232) if (y // 4) % 2 == 0 else (86, 148, 196)
            pygame.draw.rect(layer, (*color, 58), (shift, y, max(2, r.w - 4), 1))
            pygame.draw.rect(layer, (*shade(color, 34), 42),
                             (shift + 3, y + 1, max(2, r.w // 2), 1))

        # Caustic lattice that slides diagonally.
        for i in range(0, r.w + r.h, 11):
            cx = (i + int(self.t * 9)) % (r.w + 6) - 3
            cy = (i * 2 + int(self.t * 5)) % max(1, r.h)
            pygame.draw.line(layer, (196, 232, 244, 70), (cx, cy), (cx + 5, cy - 2), 1)

        # Foam crawling along the shoreline.
        foam = (224, 244, 252, 170)
        for x in range(0, r.w, 4):
            wob = int(math.sin(x * 0.22 + self.t * 3.2))
            pygame.draw.rect(layer, foam, (x, max(0, wob), 3, 1))
            pygame.draw.rect(layer, foam, (x, max(0, r.h - 3 + wob), 3, 1))

        # Expanding impact rings.
        for rp in self.ripples:
            sx, sy = rp["x"] - r.left, rp["y"] - r.top
            if 0 <= sx < r.w and 0 <= sy < r.h:
                rad = int((1 - rp["life"]) * 9) + 1
                pygame.draw.ellipse(layer, (222, 242, 252, int(150 * rp["life"])),
                                    (sx - rad, sy - rad // 2, rad * 2, rad), 1)

        surface.blit(layer, r.topleft)


# ----------------------------------------------------------------------
# Ambient life
# ----------------------------------------------------------------------

class AmbientLife:
    """Small signs of life: birds, butterflies, fireflies and drifting motes."""

    def __init__(self, block_map, profile: str = "calm"):
        self.block_map = block_map
        self.profile = profile
        self.biome = detect_biome(block_map)
        self.t = 0.0
        rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xC4A))
        self.birds: List[dict] = []
        self.butterflies: List[dict] = []
        self.fireflies: List[dict] = []
        for _ in range(3):
            self.birds.append({
                "x": rng.uniform(0, 320), "y": rng.uniform(12, 54),
                "vx": rng.uniform(7, 16), "phase": rng.random() * math.tau,
            })
        for _ in range(6):
            self.butterflies.append({
                "x": rng.uniform(0, 320), "y": rng.uniform(30, 150),
                "phase": rng.random() * math.tau,
                "color": rng.choice(((244, 196, 92), (232, 142, 168), (184, 206, 236))),
            })
        for _ in range(14):
            self.fireflies.append({
                "x": rng.uniform(0, 320), "y": rng.uniform(20, 170),
                "phase": rng.random() * math.tau, "speed": rng.uniform(0.7, 2.1),
            })

    def update(self, dt: float, profile: str = "calm") -> None:
        self.profile = profile
        self.t += dt
        for bird in self.birds:
            bird["x"] += bird["vx"] * dt
            bird["phase"] += dt * 6
            if bird["x"] > 332:
                bird["x"] = -12
        for b in self.butterflies:
            b["phase"] += dt * 4
            b["x"] += math.sin(b["phase"] * 0.5) * 9 * dt
            b["y"] += math.cos(b["phase"] * 0.7) * 7 * dt
        for f in self.fireflies:
            f["phase"] += dt * f["speed"]

    def draw(self, surface: pygame.Surface, camera) -> None:
        # Birds only in calm/plains/town skies.
        if self.profile in ("calm", "wind"):
            for bird in self.birds:
                x, y = int(bird["x"]), int(bird["y"])
                flap = 1 if math.sin(bird["phase"]) > 0 else -1
                pygame.draw.line(surface, (38, 46, 52), (x - 3, y), (x, y - flap), 1)
                pygame.draw.line(surface, (38, 46, 52), (x, y - flap), (x + 3, y), 1)
        if self.biome in ("town", "plains", "highland") and self.profile in ("calm", "wind"):
            for b in self.butterflies:
                x, y = int(b["x"]), int(b["y"])
                open_wing = math.sin(b["phase"]) > 0
                if open_wing:
                    pygame.draw.rect(surface, b["color"], (x - 2, y - 1, 2, 2))
                    pygame.draw.rect(surface, b["color"], (x + 1, y - 1, 2, 2))
                else:
                    pygame.draw.rect(surface, shade(b["color"], -30), (x, y - 1, 1, 2))
        # Fireflies / ember-like motes glow in the dark storm and fire scenes.
        if self.profile in ("fire", "ash", "wind"):
            for f in self.fireflies:
                glow = 0.5 + 0.5 * math.sin(f["phase"])
                if glow < 0.55:
                    continue
                x, y = int(f["x"]), int(f["y"])
                color = (255, 208, 108) if self.profile == "fire" else (196, 224, 236)
                surface.fill(color, (x, y, 1, 1))
                if glow > 0.9:
                    surf = soft_glow(3, color, int(60 * glow))
                    surface.blit(surf, (x - 3, y - 3))


# ----------------------------------------------------------------------
# Cinematic post effects
# ----------------------------------------------------------------------

class PostFX:
    """Heat shimmer, dithered bloom and a subtle film grain."""

    def __init__(self, block_map, profile: str = "calm"):
        self.block_map = block_map
        self.profile = profile
        self.t = 0.0
        self.rng = random.Random(_seed(getattr(block_map, "location_name", "?"), 0xE22))
        self.grain = pygame.Surface((320, 180), pygame.SRCALPHA)
        self._bake_grain()

    def _bake_grain(self) -> None:
        for _ in range(2600):
            x = self.rng.randrange(320)
            y = self.rng.randrange(180)
            a = self.rng.randrange(8, 26)
            self.grain.fill((255, 255, 255, a), (x, y, 1, 1))

    def update(self, dt: float, profile: str = "calm") -> None:
        self.profile = profile
        self.t += dt

    def draw(self, surface: pygame.Surface, camera) -> None:
        w, h = surface.get_size()
        # Heat shimmer: slide thin horizontal strips near fire zones.
        if self.profile == "fire":
            for hz in self.block_map.hazard_zones:
                r = camera.apply(hz.rect)
                if not _on_screen(r, w, h):
                    continue
                strip = pygame.Surface((min(w, r.w), 1))
                for y in range(max(0, r.top), min(h, r.bottom), 4):
                    shift = int(math.sin(self.t * 7 + y * 0.4) * 2)
                    strip.blit(surface, (0, 0), (max(0, r.left), y, strip.get_width(), 1))
                    surface.blit(strip, (max(0, r.left) + shift, y))
        # Fine film grain adds texture without hiding gameplay.
        surface.blit(self.grain, (0, 0))
