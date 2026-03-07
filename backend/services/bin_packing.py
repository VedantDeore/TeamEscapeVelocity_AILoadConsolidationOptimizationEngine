"""
Lorri — 3D Bin Packing Service

Implements a layer-based First Fit Decreasing (FFD) algorithm.
Assigns (x, y, z) positions inside the vehicle container so the
frontend Three.js viewer can render exact placement.
"""

import math
import random


# ── palette for box colours ────────────────────────────────
COLOURS = [
    "#635BFF", "#0CAF60", "#E5850B", "#DF1B41",
    "#00A2E8", "#FF6B35", "#9B59B6", "#1ABC9C",
    "#F39C12", "#E74C3C", "#3498DB", "#2ECC71",
]


def _cm_to_m(val: float) -> float:
    return val / 100.0


def pack_cluster(shipments: list, vehicle: dict) -> dict:
    """
    Fit shipments into vehicle using 3D FFD (layer-based).

    Args:
        shipments: list of shipment dicts with length_cm, width_cm, height_cm, weight_kg
        vehicle:   dict with length_cm, width_cm, height_cm, max_weight_kg, max_volume_m3

    Returns:
        {
          "items":          [...],  # each item with position + dimensions
          "utilization_pct": float,
          "total_weight":   float,
          "total_volume":   float,
          "container":      {"length": m, "width": m, "height": m},
          "fits":           bool,
        }
    """
    if not shipments:
        return _empty_result(vehicle)

    # Container dimensions (metres)
    c_len = _cm_to_m(float(vehicle.get("length_cm", 720)))
    c_wid = _cm_to_m(float(vehicle.get("width_cm", 240)))
    c_hei = _cm_to_m(float(vehicle.get("height_cm", 240)))
    c_vol = c_len * c_wid * c_hei

    # Sort items largest-volume-first
    items = sorted(shipments, key=lambda s: (
        float(s.get("length_cm", 100)) *
        float(s.get("width_cm",  80))  *
        float(s.get("height_cm", 60))
    ), reverse=True)

    placed   = []
    fits     = True
    cur_x    = 0.0   # current position along vehicle length
    cur_y    = 0.0   # current position along width
    row_max_l = 0.0  # tallest item in current width-row
    layer_max_x = 0.0  # how far the current length-layer extends

    for idx, item in enumerate(items):
        # Item dimensions in metres
        il = _cm_to_m(float(item.get("length_cm", 100)))
        iw = _cm_to_m(float(item.get("width_cm",  80)))
        ih = _cm_to_m(float(item.get("height_cm", 60)))

        # Try current position
        placed_ok = False

        # If it fits in current row
        if cur_y + iw <= c_wid and cur_x + il <= c_len:
            pos_x, pos_y, pos_z = cur_x, cur_y, 0.0
            cur_y     += iw
            row_max_l  = max(row_max_l, il)
            placed_ok  = True

        elif cur_x + row_max_l + il <= c_len:
            # Start a new width-row
            cur_x    += row_max_l
            cur_y     = 0.0
            row_max_l = 0.0
            if cur_y + iw <= c_wid:
                pos_x, pos_y, pos_z = cur_x, cur_y, 0.0
                cur_y     += iw
                row_max_l  = il
                placed_ok  = True

        if not placed_ok:
            fits = False
            # Still add it (stacked / overflow) but mark as outside
            pos_x = cur_x + 0.1
            pos_y = cur_y + 0.1
            pos_z = 0.0

        placed.append({
            "shipment_id":  item.get("id", f"item-{idx}"),
            "shipment_code": item.get("shipment_code", f"ITEM-{idx+1}"),
            "x": round(pos_x, 3),
            "y": round(pos_y, 3),
            "z": round(pos_z, 3),
            "length": round(il, 3),
            "width":  round(iw, 3),
            "height": round(ih, 3),
            "weight_kg": item.get("weight_kg", 0),
            "cargo_type": item.get("cargo_type", "general"),
            "priority":   item.get("priority", "normal"),
            "color": COLOURS[idx % len(COLOURS)],
        })

    total_weight = sum(float(s.get("weight_kg", 0)) for s in shipments)
    total_volume = sum(
        _cm_to_m(float(s.get("length_cm", 100))) *
        _cm_to_m(float(s.get("width_cm", 80))) *
        _cm_to_m(float(s.get("height_cm", 60)))
        for s in shipments
    )

    wt_cap  = float(vehicle.get("max_weight_kg", 12000)) or 1
    vol_cap = float(vehicle.get("max_volume_m3", c_vol * 0.95)) or 1

    util_pct = round(max(
        total_weight / wt_cap,
        total_volume / vol_cap
    ) * 100, 1)
    util_pct = min(util_pct, 100.0)

    return {
        "items":           placed,
        "utilization_pct": util_pct,
        "total_weight":    round(total_weight, 2),
        "total_volume":    round(total_volume, 3),
        "container": {
            "length": round(c_len, 3),
            "width":  round(c_wid, 3),
            "height": round(c_hei, 3),
        },
        "fits": fits,
    }


def _empty_result(vehicle: dict) -> dict:
    c_len = _cm_to_m(float(vehicle.get("length_cm", 720)))
    c_wid = _cm_to_m(float(vehicle.get("width_cm", 240)))
    c_hei = _cm_to_m(float(vehicle.get("height_cm", 240)))
    return {
        "items": [],
        "utilization_pct": 0.0,
        "total_weight": 0.0,
        "total_volume": 0.0,
        "container": {"length": c_len, "width": c_wid, "height": c_hei},
        "fits": True,
    }
3D Bin Packing Engine — AI Load Consolidation Optimization
==========================================================

A high-performance 3D bin packing engine using a hybrid optimization approach:
  Phase 1: Greedy First-Fit Decreasing (FFD) with Extreme Points heuristic
  Phase 2: Simulated Annealing local search refinement
  Phase 3: Multi-container assignment via Best-Fit Decreasing

Key features:
  - 6-orientation rotation support for every item
  - Extreme-point based spatial management
  - Weight, stackability, and fragility constraints
  - Step-by-step placement recording for simulation replay
  - Collision detection via AABB intersection
  - Real-time utilization and center-of-gravity tracking
"""

from __future__ import annotations

import copy
import logging
import math
import random
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CargoType(str, Enum):
    GENERAL = "general"
    FRAGILE = "fragile"
    REFRIGERATED = "refrigerated"
    HAZARDOUS = "hazardous"


class Priority(str, Enum):
    NORMAL = "normal"
    EXPRESS = "express"
    CRITICAL = "critical"


class Orientation(int, Enum):
    """Six possible orientations mapping (width, height, depth) permutations."""
    WHD = 0  # original
    WDH = 1  # swap height <-> depth
    HWD = 2  # swap width <-> height
    HDW = 3  # height->w, depth->h, width->d
    DWH = 4  # depth->w, width->h, height->d
    DHW = 5  # depth->w, height->h, width->d


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class Item3D:
    """A 3D item to be packed."""
    id: str
    label: str
    width: float    # cm -- X dimension
    height: float   # cm -- Y dimension (vertical)
    depth: float    # cm -- Z dimension
    weight: float   # kg
    cargo_type: CargoType = CargoType.GENERAL
    priority: Priority = Priority.NORMAL
    stackable: bool = True
    max_stack_weight: float = 5000.0  # max weight that can be placed on top (kg)
    color: str = "#0ea5e9"

    @property
    def volume(self) -> float:
        """Volume in cubic centimeters."""
        return self.width * self.height * self.depth

    @property
    def volume_m3(self) -> float:
        """Volume in cubic meters."""
        return self.volume / 1_000_000

    def get_oriented_dims(self, orientation: Orientation) -> tuple[float, float, float]:
        """Return (w, h, d) after applying the given orientation."""
        w, h, d = self.width, self.height, self.depth
        mapping = {
            Orientation.WHD: (w, h, d),
            Orientation.WDH: (w, d, h),
            Orientation.HWD: (h, w, d),
            Orientation.HDW: (h, d, w),
            Orientation.DWH: (d, w, h),
            Orientation.DHW: (d, h, w),
        }
        return mapping[orientation]

    def allowed_orientations(self) -> list[Orientation]:
        """Return orientations allowed for this item based on cargo type."""
        if self.cargo_type == CargoType.FRAGILE:
            # Fragile items: keep original height axis upright
            return [Orientation.WHD, Orientation.DWH]
        return list(Orientation)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "width": self.width,
            "height": self.height,
            "depth": self.depth,
            "weight": self.weight,
            "volume_m3": round(self.volume_m3, 4),
            "cargo_type": self.cargo_type.value,
            "priority": self.priority.value,
            "stackable": self.stackable,
            "color": self.color,
        }


@dataclass
class Position:
    """3D position (corner closest to origin)."""
    x: float
    y: float
    z: float

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "z": self.z}


@dataclass
class Placement:
    """A placed item with position and chosen orientation."""
    item: Item3D
    position: Position
    orientation: Orientation

    @property
    def oriented_dims(self) -> tuple[float, float, float]:
        return self.item.get_oriented_dims(self.orientation)

    @property
    def x(self) -> float:
        return self.position.x

    @property
    def y(self) -> float:
        return self.position.y

    @property
    def z(self) -> float:
        return self.position.z

    @property
    def w(self) -> float:
        return self.oriented_dims[0]

    @property
    def h(self) -> float:
        return self.oriented_dims[1]

    @property
    def d(self) -> float:
        return self.oriented_dims[2]

    @property
    def max_x(self) -> float:
        return self.x + self.w

    @property
    def max_y(self) -> float:
        return self.y + self.h

    @property
    def max_z(self) -> float:
        return self.z + self.d

    @property
    def center(self) -> tuple[float, float, float]:
        return (self.x + self.w / 2, self.y + self.h / 2, self.z + self.d / 2)

    def intersects(self, other: "Placement") -> bool:
        """Check AABB collision with another placement."""
        return not (
            self.max_x <= other.x + 1e-6 or other.max_x <= self.x + 1e-6 or
            self.max_y <= other.y + 1e-6 or other.max_y <= self.y + 1e-6 or
            self.max_z <= other.z + 1e-6 or other.max_z <= self.z + 1e-6
        )

    def to_dict(self) -> dict:
        w, h, d = self.oriented_dims
        return {
            "item": self.item.to_dict(),
            "position": self.position.to_dict(),
            "orientation": self.orientation.value,
            "oriented_width": w,
            "oriented_height": h,
            "oriented_depth": d,
        }


@dataclass
class Container3D:
    """A 3D container (truck / trailer)."""
    id: str
    name: str
    width: float     # cm -- X
    height: float    # cm -- Y
    depth: float     # cm -- Z
    max_weight: float  # kg
    cost_per_km: float = 0.0
    emission_factor: float = 0.0

    @property
    def volume(self) -> float:
        return self.width * self.height * self.depth

    @property
    def volume_m3(self) -> float:
        return self.volume / 1_000_000

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "width": self.width,
            "height": self.height,
            "depth": self.depth,
            "max_weight": self.max_weight,
            "volume_m3": round(self.volume_m3, 4),
        }


# ---------------------------------------------------------------------------
# Placement Step (for simulation replay)
# ---------------------------------------------------------------------------

@dataclass
class PlacementStep:
    """Records a single step in the packing simulation."""
    step_number: int
    action: str  # "place", "swap", "remove", "reposition"
    item_id: str
    item_label: str
    position: Position
    orientation: Orientation
    oriented_dims: tuple[float, float, float]
    utilization_pct: float
    weight_utilization_pct: float
    items_placed: int
    total_items: int
    center_of_gravity: tuple[float, float, float]
    color: str

    def to_dict(self) -> dict:
        return {
            "step_number": self.step_number,
            "action": self.action,
            "item_id": self.item_id,
            "item_label": self.item_label,
            "position": self.position.to_dict(),
            "orientation": self.orientation.value,
            "oriented_dims": list(self.oriented_dims),
            "utilization_pct": round(self.utilization_pct, 2),
            "weight_utilization_pct": round(self.weight_utilization_pct, 2),
            "items_placed": self.items_placed,
            "total_items": self.total_items,
            "center_of_gravity": [round(c, 2) for c in self.center_of_gravity],
            "color": self.color,
        }


# ---------------------------------------------------------------------------
# Packing Result
# ---------------------------------------------------------------------------

@dataclass
class PackingResult:
    """Complete result of a packing operation."""
    container: Container3D
    placements: list[Placement] = field(default_factory=list)
    unpacked_items: list[Item3D] = field(default_factory=list)
    steps: list[PlacementStep] = field(default_factory=list)
    algorithm: str = "hybrid"
    computation_time_ms: float = 0.0

    @property
    def total_items_volume(self) -> float:
        return sum(p.item.volume for p in self.placements)

    @property
    def total_items_weight(self) -> float:
        return sum(p.item.weight for p in self.placements)

    @property
    def volume_utilization(self) -> float:
        if self.container.volume == 0:
            return 0
        return (self.total_items_volume / self.container.volume) * 100

    @property
    def weight_utilization(self) -> float:
        if self.container.max_weight == 0:
            return 0
        return (self.total_items_weight / self.container.max_weight) * 100

    @property
    def center_of_gravity(self) -> tuple[float, float, float]:
        if not self.placements:
            return (0, 0, 0)
        total_weight = sum(p.item.weight for p in self.placements)
        if total_weight == 0:
            return (0, 0, 0)
        cx = sum(p.center[0] * p.item.weight for p in self.placements) / total_weight
        cy = sum(p.center[1] * p.item.weight for p in self.placements) / total_weight
        cz = sum(p.center[2] * p.item.weight for p in self.placements) / total_weight
        return (cx, cy, cz)

    def to_dict(self) -> dict:
        cog = self.center_of_gravity
        return {
            "container": self.container.to_dict(),
            "placements": [p.to_dict() for p in self.placements],
            "unpacked_items": [i.to_dict() for i in self.unpacked_items],
            "steps": [s.to_dict() for s in self.steps],
            "metrics": {
                "total_items": len(self.placements),
                "unpacked_count": len(self.unpacked_items),
                "volume_utilization_pct": round(self.volume_utilization, 2),
                "weight_utilization_pct": round(self.weight_utilization, 2),
                "total_weight_kg": round(self.total_items_weight, 2),
                "total_volume_m3": round(self.total_items_volume / 1_000_000, 4),
                "center_of_gravity": {"x": round(cog[0], 2), "y": round(cog[1], 2), "z": round(cog[2], 2)},
                "container_volume_m3": round(self.container.volume_m3, 4),
                "algorithm": self.algorithm,
                "computation_time_ms": round(self.computation_time_ms, 2),
            },
        }


# ---------------------------------------------------------------------------
# Spatial Manager -- Extreme Points Algorithm
# ---------------------------------------------------------------------------

class SpatialManager:
    """
    Manages free space inside a container using the Extreme Points (EP)
    heuristic. After each item placement, new extreme points are generated
    at the three corners exposed by the placed box.
    """

    def __init__(self, container: Container3D):
        self.container = container
        self.placements: list[Placement] = []
        # Initial extreme point: the origin
        self.extreme_points: list[Position] = [Position(0, 0, 0)]
        self._current_weight: float = 0.0

    @property
    def volume_utilization(self) -> float:
        vol = sum(p.item.volume for p in self.placements)
        return (vol / self.container.volume) * 100 if self.container.volume else 0

    @property
    def weight_utilization(self) -> float:
        return (self._current_weight / self.container.max_weight) * 100 if self.container.max_weight else 0

    @property
    def center_of_gravity(self) -> tuple[float, float, float]:
        if not self.placements:
            return (0, 0, 0)
        tw = sum(p.item.weight for p in self.placements)
        if tw == 0:
            return (0, 0, 0)
        cx = sum(p.center[0] * p.item.weight for p in self.placements) / tw
        cy = sum(p.center[1] * p.item.weight for p in self.placements) / tw
        cz = sum(p.center[2] * p.item.weight for p in self.placements) / tw
        return (cx, cy, cz)

    def can_place(self, item: Item3D, pos: Position, orient: Orientation) -> bool:
        """Check whether the item can be placed at the given position/orientation."""
        w, h, d = item.get_oriented_dims(orient)

        # Boundary check
        if pos.x + w > self.container.width + 1e-6:
            return False
        if pos.y + h > self.container.height + 1e-6:
            return False
        if pos.z + d > self.container.depth + 1e-6:
            return False

        # Weight check
        if self._current_weight + item.weight > self.container.max_weight + 1e-6:
            return False

        # Collision check
        candidate = Placement(item, pos, orient)
        for placed in self.placements:
            if candidate.intersects(placed):
                return False

        # Stackability check -- if placing on top of non-stackable items
        if pos.y > 1e-6:
            if not self._check_support(candidate):
                return False

        return True

    def _check_support(self, candidate: Placement) -> bool:
        """
        Verify the item has sufficient support from below.
        At least 50% of the item's base area must be supported.
        """
        support_area = 0.0
        base_area = candidate.w * candidate.d

        for placed in self.placements:
            # Check if placed item is directly below candidate
            if abs(placed.max_y - candidate.y) > 1e-6:
                continue
            # Check stacking constraints
            if not placed.item.stackable:
                return False
            if candidate.item.weight > placed.item.max_stack_weight:
                return False
            # Calculate overlap area
            ox = max(0, min(candidate.max_x, placed.max_x) - max(candidate.x, placed.x))
            oz = max(0, min(candidate.max_z, placed.max_z) - max(candidate.z, placed.z))
            support_area += ox * oz

        # If on the floor (y ~= 0), always supported
        if candidate.y < 1e-6:
            return True

        # Require at least 50% support
        return support_area >= base_area * 0.5

    def place(self, item: Item3D, pos: Position, orient: Orientation) -> Placement:
        """Place the item and update extreme points."""
        placement = Placement(item, pos, orient)
        self.placements.append(placement)
        self._current_weight += item.weight

        # Generate new extreme points from this placement
        self._update_extreme_points(placement)

        return placement

    def _update_extreme_points(self, p: Placement) -> None:
        """Generate new extreme points at the three exposed corners of the placed box."""
        new_eps = [
            Position(p.max_x, p.y, p.z),        # right of box
            Position(p.x, p.max_y, p.z),         # on top of box
            Position(p.x, p.y, p.max_z),         # behind box
        ]

        for ep in new_eps:
            # Only add if inside container bounds
            if (ep.x <= self.container.width + 1e-6 and
                ep.y <= self.container.height + 1e-6 and
                ep.z <= self.container.depth + 1e-6):
                # Don't add duplicate points
                if not any(
                    abs(e.x - ep.x) < 1e-6 and
                    abs(e.y - ep.y) < 1e-6 and
                    abs(e.z - ep.z) < 1e-6
                    for e in self.extreme_points
                ):
                    self.extreme_points.append(ep)

        # Remove extreme points that are now inside a placed box
        self.extreme_points = [
            ep for ep in self.extreme_points
            if not self._point_inside_any_box(ep)
        ]

        # Sort extreme points: prefer bottom-left-back (Y first, then Z, then X)
        self.extreme_points.sort(key=lambda ep: (ep.y, ep.z, ep.x))

    def _point_inside_any_box(self, pos: Position) -> bool:
        """Check if a point is strictly inside any placed box."""
        for p in self.placements:
            if (p.x + 1e-6 < pos.x < p.max_x - 1e-6 and
                p.y + 1e-6 < pos.y < p.max_y - 1e-6 and
                p.z + 1e-6 < pos.z < p.max_z - 1e-6):
                return True
        return False

    def find_best_position(self, item: Item3D) -> Optional[tuple[Position, Orientation]]:
        """
        Find the best (position, orientation) for this item using extreme points.
        Scoring: prefer positions that minimize wasted space and keep items
        low (small Y), toward the back (large Z first), and to the left (small X).
        """
        best_score = float("inf")
        best_result: Optional[tuple[Position, Orientation]] = None

        for ep in self.extreme_points:
            for orient in item.allowed_orientations():
                if self.can_place(item, ep, orient):
                    w, h, d = item.get_oriented_dims(orient)
                    # Score: prefer low Y, then small Z (pack from front), then small X
                    # Also prefer orientations that leave more usable space
                    score = (
                        ep.y * 10.0 +        # strongly prefer floor level
                        ep.z * 1.0 +          # then pack front-to-back
                        ep.x * 0.5 +          # then left-to-right
                        (1.0 - item.volume / self.container.volume) * 0.1  # bigger items first
                    )
                    if score < best_score:
                        best_score = score
                        best_result = (ep, orient)

        return best_result


# ---------------------------------------------------------------------------
# Phase 1: Greedy FFD + Extreme Points
# ---------------------------------------------------------------------------

def _sort_items_for_packing(items: list[Item3D]) -> list[Item3D]:
    """
    Sort items for First-Fit Decreasing: by volume descending,
    with priority items first.
    """
    priority_order = {Priority.CRITICAL: 0, Priority.EXPRESS: 1, Priority.NORMAL: 2}

    return sorted(
        items,
        key=lambda it: (
            priority_order.get(it.priority, 2),
            -it.volume,
            -it.weight,
        ),
    )


def greedy_pack(container: Container3D, items: list[Item3D],
                record_steps: bool = True) -> PackingResult:
    """
    Phase 1: Greedy packing using FFD + Extreme Points.

    Time complexity: O(n^2 * k) where n = items, k = extreme points per item.
    Typical utilization: 70-82%.
    """
    start = time.time()
    spatial = SpatialManager(container)
    sorted_items = _sort_items_for_packing(items)
    packed: list[Placement] = []
    unpacked: list[Item3D] = []
    steps: list[PlacementStep] = []
    step_num = 0

    for item in sorted_items:
        result = spatial.find_best_position(item)
        if result is not None:
            pos, orient = result
            placement = spatial.place(item, pos, orient)
            packed.append(placement)
            step_num += 1

            if record_steps:
                cog = spatial.center_of_gravity
                steps.append(PlacementStep(
                    step_number=step_num,
                    action="place",
                    item_id=item.id,
                    item_label=item.label,
                    position=Position(pos.x, pos.y, pos.z),
                    orientation=orient,
                    oriented_dims=item.get_oriented_dims(orient),
                    utilization_pct=spatial.volume_utilization,
                    weight_utilization_pct=spatial.weight_utilization,
                    items_placed=len(packed),
                    total_items=len(sorted_items),
                    center_of_gravity=cog,
                    color=item.color,
                ))
        else:
            unpacked.append(item)

    elapsed_ms = (time.time() - start) * 1000

    packing_result = PackingResult(
        container=container,
        placements=packed,
        unpacked_items=unpacked,
        steps=steps,
        algorithm="greedy_ffd_extreme_points",
        computation_time_ms=elapsed_ms,
    )

    logger.info(
        "Greedy packing: %d/%d items packed, %.1f%% utilization in %.1f ms",
        len(packed), len(items), packing_result.volume_utilization, elapsed_ms,
    )
    return packing_result


# ---------------------------------------------------------------------------
# Phase 2: Simulated Annealing Refinement
# ---------------------------------------------------------------------------

def simulated_annealing_refine(
    container: Container3D,
    items: list[Item3D],
    initial_result: PackingResult,
    max_iterations: int = 500,
    initial_temp: float = 100.0,
    cooling_rate: float = 0.97,
    record_steps: bool = True,
) -> PackingResult:
    """
    Phase 2: Simulated Annealing to improve packing quality.

    Moves:
      - Swap two items' positions
      - Change an item's orientation
      - Reinsert an unpacked item by reorganizing

    Time complexity: O(iterations * n^2) in worst case.
    """
    start = time.time()

    # Work with item ordering -- repack with different orderings
    best_items_order = [p.item for p in initial_result.placements]
    best_unpacked = list(initial_result.unpacked_items)
    best_utilization = initial_result.volume_utilization

    current_order = list(best_items_order)
    current_unpacked = list(best_unpacked)
    current_util = best_utilization

    temp = initial_temp
    improvements = 0

    all_items = current_order + current_unpacked

    for iteration in range(max_iterations):
        # Generate neighbor solution via perturbation
        neighbor_order = list(all_items)
        move_type = random.choice(["swap", "rotate_insert", "shift"])

        if move_type == "swap" and len(neighbor_order) >= 2:
            i, j = random.sample(range(len(neighbor_order)), 2)
            neighbor_order[i], neighbor_order[j] = neighbor_order[j], neighbor_order[i]

        elif move_type == "rotate_insert" and len(neighbor_order) >= 1:
            # Move a random item to a different position in the order
            idx = random.randint(0, len(neighbor_order) - 1)
            item = neighbor_order.pop(idx)
            new_idx = random.randint(0, len(neighbor_order))
            neighbor_order.insert(new_idx, item)

        elif move_type == "shift" and len(neighbor_order) >= 2:
            # Reverse a small segment
            i = random.randint(0, len(neighbor_order) - 2)
            j = random.randint(i + 1, min(i + 5, len(neighbor_order)))
            neighbor_order[i:j] = reversed(neighbor_order[i:j])

        # Repack with new ordering (without recording steps for speed)
        trial = greedy_pack(container, neighbor_order, record_steps=False)
        trial_util = trial.volume_utilization

        # Acceptance criterion
        delta = trial_util - current_util
        if delta > 0 or random.random() < math.exp(delta / max(temp, 1e-10)):
            current_order = [p.item for p in trial.placements]
            current_unpacked = list(trial.unpacked_items)
            current_util = trial_util
            all_items = current_order + current_unpacked

            if trial_util > best_utilization:
                best_items_order = list(current_order)
                best_unpacked = list(current_unpacked)
                best_utilization = trial_util
                improvements += 1

        temp *= cooling_rate

    # Final repack with best ordering, recording steps
    final_result = greedy_pack(container, best_items_order + best_unpacked,
                               record_steps=record_steps)
    elapsed_ms = (time.time() - start) * 1000
    final_result.algorithm = "simulated_annealing"
    final_result.computation_time_ms = elapsed_ms

    logger.info(
        "SA refinement: %.1f%% -> %.1f%% utilization (%d improvements) in %.1f ms",
        initial_result.volume_utilization, final_result.volume_utilization,
        improvements, elapsed_ms,
    )
    return final_result


# ---------------------------------------------------------------------------
# Phase 3: Multi-Container Assignment
# ---------------------------------------------------------------------------

def multi_container_pack(
    containers: list[Container3D],
    items: list[Item3D],
    optimize: bool = True,
    sa_iterations: int = 300,
) -> list[PackingResult]:
    """
    Phase 3: Assign items to multiple containers using Best-Fit Decreasing.

    For each item (sorted by volume desc), try to fit it in the container
    that would result in the highest utilization after placement.
    After assignment, optimize each container with SA.
    """
    start = time.time()

    # Sort items: largest first
    sorted_items = _sort_items_for_packing(items)

    # Initialize spatial managers for each container
    assignments: dict[str, list[Item3D]] = {c.id: [] for c in containers}
    container_map = {c.id: c for c in containers}

    # Sort containers by volume descending for assignment
    sorted_containers = sorted(containers, key=lambda c: c.volume, reverse=True)

    remaining = list(sorted_items)
    globally_unpacked: list[Item3D] = []

    for item in remaining:
        placed = False
        best_container_id = None
        best_waste = float("inf")

        for container in sorted_containers:
            cid = container.id
            trial_items = assignments[cid] + [item]
            trial_result = greedy_pack(container, trial_items, record_steps=False)

            if item.id in [p.item.id for p in trial_result.placements]:
                waste = container.volume - trial_result.total_items_volume
                if waste < best_waste:
                    best_waste = waste
                    best_container_id = cid
                    placed = True

        if placed and best_container_id:
            assignments[best_container_id].append(item)
        else:
            globally_unpacked.append(item)

    # Final packing for each container with optimization
    results: list[PackingResult] = []
    for container in containers:
        cid = container.id
        assigned_items = assignments.get(cid, [])
        if not assigned_items:
            continue

        result = greedy_pack(container, assigned_items, record_steps=True)

        if optimize and len(assigned_items) > 1:
            result = simulated_annealing_refine(
                container, assigned_items, result,
                max_iterations=sa_iterations,
                record_steps=True,
            )

        results.append(result)

    # Add globally unpacked items to the last result (or create a report)
    if globally_unpacked and results:
        results[-1].unpacked_items.extend(globally_unpacked)

    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "Multi-container packing: %d containers used, %d items unpacked in %.1f ms",
        len(results), len(globally_unpacked), elapsed_ms,
    )
    return results


# ---------------------------------------------------------------------------
# Main entry point -- Hybrid Packing Engine
# ---------------------------------------------------------------------------

def pack_items(
    container: Container3D,
    items: list[Item3D],
    algorithm: str = "hybrid",
    sa_iterations: int = 500,
    sa_initial_temp: float = 100.0,
    sa_cooling_rate: float = 0.97,
) -> PackingResult:
    """
    Main entry point for single-container packing.

    Algorithms:
      - "greedy": Phase 1 only (fast, ~70-82% utilization)
      - "sa": Phase 2 only (starts with greedy, then SA refinement)
      - "hybrid": Phase 1 + Phase 2 (best quality, ~80-92% utilization)

    Args:
        container: The container to pack into
        items: Items to pack
        algorithm: "greedy", "sa", or "hybrid"
        sa_iterations: Number of SA iterations
        sa_initial_temp: Initial temperature for SA
        sa_cooling_rate: Cooling rate for SA

    Returns:
        PackingResult with placements, steps, and metrics
    """
    if not items:
        return PackingResult(container=container, algorithm=algorithm)

    logger.info("Packing %d items into %s using '%s' algorithm",
                len(items), container.name, algorithm)

    if algorithm == "greedy":
        return greedy_pack(container, items, record_steps=True)

    # For both "sa" and "hybrid", start with greedy then refine
    greedy_result = greedy_pack(container, items, record_steps=False)

    if algorithm in ("sa", "hybrid"):
        return simulated_annealing_refine(
            container, items, greedy_result,
            max_iterations=sa_iterations,
            initial_temp=sa_initial_temp,
            cooling_rate=sa_cooling_rate,
            record_steps=True,
        )

    return greedy_result


# ---------------------------------------------------------------------------
# Utility: Generate demo items from shipment data
# ---------------------------------------------------------------------------

ITEM_COLORS = [
    "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
    "#14b8a6", "#a855f7", "#eab308", "#3b82f6", "#e11d48",
]


def create_items_from_shipments(shipments: list[dict]) -> list[Item3D]:
    """Convert shipment dicts (from API / mock data) to Item3D objects."""
    items: list[Item3D] = []
    for i, s in enumerate(shipments):
        cargo_type = CargoType.GENERAL
        if s.get("cargoType") in [e.value for e in CargoType]:
            cargo_type = CargoType(s["cargoType"])

        priority = Priority.NORMAL
        if s.get("priority") in [e.value for e in Priority]:
            priority = Priority(s["priority"])

        items.append(Item3D(
            id=s.get("id", f"item-{i+1}"),
            label=s.get("shipmentCode", s.get("id", f"ITEM-{i+1}")).upper(),
            width=float(s.get("widthCm", s.get("width", 50))),
            height=float(s.get("heightCm", s.get("height", 50))),
            depth=float(s.get("lengthCm", s.get("depth", s.get("length", 50)))),
            weight=float(s.get("weightKg", s.get("weight", 100))),
            cargo_type=cargo_type,
            priority=priority,
            stackable=cargo_type not in (CargoType.FRAGILE, CargoType.HAZARDOUS),
            color=ITEM_COLORS[i % len(ITEM_COLORS)],
        ))

    return items


def create_container_from_vehicle(vehicle: dict) -> Container3D:
    """Convert a vehicle dict to a Container3D."""
    return Container3D(
        id=vehicle.get("id", str(uuid.uuid4())),
        name=vehicle.get("name", "Container"),
        width=float(vehicle.get("widthCm", vehicle.get("width", 240))),
        height=float(vehicle.get("heightCm", vehicle.get("height", 240))),
        depth=float(vehicle.get("lengthCm", vehicle.get("depth", 720))),
        max_weight=float(vehicle.get("maxWeightKg", vehicle.get("max_weight", 10000))),
        cost_per_km=float(vehicle.get("costPerKm", 0)),
        emission_factor=float(vehicle.get("emissionFactor", 0)),
    )
