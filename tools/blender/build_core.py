"""Blender-first authoring script for the Madinah Simulation core sector.

This runs inside Blender, never in the browser. It creates an EDITABLE city massing
scene that is intended to be manually compared with the locked visual reference
before exporting a static GLB.

Important:
- This is visual massing, not a claim of exact archaeological parcel geometry.
- Historical landmarks remain governed by the project's historical data layer.
- Blender is the source of truth for the authored city asset.
- The layout deliberately avoids rings, grids, broad radial roads, and repeated boxes.
"""

import bpy
import json
import math
import random
from pathlib import Path

ROOT = Path(bpy.path.abspath("//"))
OUTPUT = ROOT / "public" / "assets" / "city" / "core.glb"
REPORT = ROOT / "public" / "assets" / "city" / "core-authoring-report.json"
WORKING = ROOT / "tools" / "blender" / "generated" / "core-authored.blend"
SEED = 622
random.seed(SEED)

COLLECTIONS = [
    "BUILDINGS",
    "COURTYARD_WALLS",
    "ROOFS",
    "ROUTES",
    "PALMS",
    "AGRICULTURE",
    "LANDMARKS",
    "TERRAIN",
]

STATS = {
    "compounds": 0,
    "compound_parts": 0,
    "palms": 0,
    "field_patches": 0,
    "route_guides": 0,
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def material(name, color, roughness=0.95):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def move_to_collection(obj, collection_name):
    target = ensure_collection(collection_name)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    target.objects.link(obj)


def add_box(name, dims, location, rotation_z=0.0, collection="BUILDINGS", mat=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new(name="edge_softness", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    if mat:
        obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return obj


def add_cylinder(name, radius, depth, location, collection, mat, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return obj


def local_to_world(cx, cy, yaw, lx, ly):
    return (
        cx + lx * math.cos(yaw) - ly * math.sin(yaw),
        cy + lx * math.sin(yaw) + ly * math.cos(yaw),
    )


def distance_to_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    vv = vx * vx + vy * vy
    if vv == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / vv))
    qx, qy = ax + t * vx, ay + t * vy
    return math.hypot(px - qx, py - qy)


def distance_to_polyline(px, py, points):
    return min(
        distance_to_segment(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
        for i in range(len(points) - 1)
    )


def build_landmark_shell(clay, roof):
    # Schematic only. Final landmark reconstruction remains separately reviewed.
    w, d, h, t = 42.0, 36.0, 3.2, 1.1
    add_box("mosque_n", (w, t, h), (0, d / 2, h / 2), collection="LANDMARKS", mat=clay, bevel=0.08)
    add_box("mosque_s", (w, t, h), (0, -d / 2, h / 2), collection="LANDMARKS", mat=clay, bevel=0.08)
    add_box("mosque_w", (t, d, h), (-w / 2, 0, h / 2), collection="LANDMARKS", mat=clay, bevel=0.08)
    add_box("mosque_e", (t, d, h), (w / 2, 0, h / 2), collection="LANDMARKS", mat=clay, bevel=0.08)
    add_box("mosque_shade", (w - 5, 6.5, 0.24), (0, d / 2 - 4.2, 2.95), collection="ROOFS", mat=roof)


def add_compound(index, cx, cy, yaw, w, d, h, family, clay, deep_clay, basalt, roof):
    wall = random.uniform(1.65, 2.25)
    pieces = []

    if family == 0:  # U courtyard
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (0, d / 2 - wall / 2, w * 0.82, wall, h * random.uniform(0.82, 0.96)),
            (-w / 2 + wall / 2, 0, wall, d - 1.7 * wall, h * random.uniform(0.80, 0.94)),
        ]
    elif family == 1:  # L courtyard
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * random.uniform(0.84, 0.98)),
        ]
    elif family == 2:  # offset court
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * 0.90),
            (w * 0.18, d / 2 - wall / 2, w * 0.54, wall, h * random.uniform(0.74, 0.88)),
        ]
    elif family == 3:  # narrow paired ranges
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w * 0.10, d / 2 - wall / 2, w * 0.68, wall, h * random.uniform(0.76, 0.90)),
        ]
    elif family == 4:  # irregular fragments
        pieces = [
            (-w * 0.14, -d / 2 + wall / 2, w * 0.62, wall, h),
            (w * 0.23, d / 2 - wall / 2, w * 0.42, wall, h * 0.86),
            (-w / 2 + wall / 2, -d * 0.09, wall, d * 0.62, h * 0.80),
            (w / 2 - wall / 2, d * 0.16, wall, d * 0.38, h * 0.74),
        ]
    else:  # asymmetrical courtyard with one thicker room bar
        pieces = [
            (-w * 0.08, -d / 2 + wall * 0.65, w * 0.84, wall * 1.3, h),
            (-w / 2 + wall / 2, d * 0.03, wall, d * 0.78, h * 0.88),
            (w * 0.18, d / 2 - wall / 2, w * 0.48, wall, h * 0.80),
        ]

    for j, (lx, ly, sx, sy, sz) in enumerate(pieces):
        x, y = local_to_world(cx, cy, yaw, lx, ly)
        sz *= random.uniform(0.96, 1.04)
        mat = clay if (index + j) % 4 else deep_clay
        add_box(
            f"compound_{index:03d}_wall_{j}",
            (sx, sy, sz),
            (x, y, sz / 2),
            yaw,
            collection="COURTYARD_WALLS",
            mat=mat,
            bevel=0.05,
        )
        STATS["compound_parts"] += 1

    # Basalt foundation cue only at the street-facing bar.
    fx, fy = local_to_world(cx, cy, yaw, 0, -d / 2 + 0.24)
    add_box(
        f"compound_{index:03d}_foundation",
        (w * random.uniform(0.55, 0.78), 0.42, 0.22),
        (fx, fy, 0.11),
        yaw,
        collection="BUILDINGS",
        mat=basalt,
    )

    # Roof coverage varies and remains partial so courtyards read from above.
    if index % 3 == 0:
        rx, ry = local_to_world(cx, cy, yaw, 0, -d / 2 + wall * 0.62)
        add_box(
            f"compound_{index:03d}_roof",
            (w * random.uniform(0.62, 0.84), wall * random.uniform(0.78, 1.05), 0.18),
            (rx, ry, h + 0.10),
            yaw,
            collection="ROOFS",
            mat=roof,
        )

    STATS["compounds"] += 1


def build_neighborhoods(clay, deep_clay, basalt, roof):
    """Build irregular neighborhood masses instead of concentric rings.

    District anchors overlap so the engine-sector concept never becomes a visible
    radial diagram. Curved path corridors cut through the masses as narrow voids.
    """
    districts = [
        {"name": "inner_west", "center": (-58, 4), "radius": (78, 64), "count": 52, "density": 0.90},
        {"name": "inner_east", "center": (62, -8), "radius": (82, 66), "count": 56, "density": 0.94},
        {"name": "north_cluster", "center": (-8, 92), "radius": (96, 70), "count": 62, "density": 0.88},
        {"name": "south_cluster", "center": (18, -102), "radius": (104, 74), "count": 66, "density": 0.86},
        {"name": "northwest_edge", "center": (-120, 86), "radius": (76, 58), "count": 34, "density": 0.72},
        {"name": "east_edge", "center": (132, 54), "radius": (72, 64), "count": 38, "density": 0.70},
        {"name": "southwest_edge", "center": (-118, -92), "radius": (78, 62), "count": 34, "density": 0.68},
    ]

    paths = [
        [(-205, 18), (-132, 8), (-72, 21), (-24, 14), (26, 8), (84, -5), (196, -16)],
        [(-92, 194), (-74, 132), (-48, 82), (-22, 38), (-8, 5), (4, -42), (18, -112), (38, -200)],
        [(-186, -118), (-126, -82), (-82, -44), (-42, -18), (2, -2), (52, 28), (118, 72), (192, 104)],
        [(102, 190), (86, 132), (72, 96), (54, 62), (28, 38), (4, 22)],
    ]

    placed = []
    index = 0

    for district in districts:
        cx0, cy0 = district["center"]
        rx, ry = district["radius"]
        attempts = 0
        target = district["count"]
        created = 0

        while created < target and attempts < target * 18:
            attempts += 1
            angle = random.uniform(0, math.tau)
            rr = math.sqrt(random.random())
            cx = cx0 + math.cos(angle) * rx * rr
            cy = cy0 + math.sin(angle) * ry * rr

            # Preserve landmark breathing room without making a giant plaza.
            if math.hypot(cx, cy) < random.uniform(28, 35):
                continue

            # Narrow, curved alley/path corridors.
            corridor_distance = min(distance_to_polyline(cx, cy, p) for p in paths)
            if corridor_distance < random.uniform(2.3, 4.2):
                continue

            # Loose collision rule. Allows tight packing but blocks exact overlaps.
            min_gap = random.uniform(5.0, 7.2) * district["density"]
            if any(math.hypot(cx - px, cy - py) < min_gap for px, py in placed[-150:]):
                continue

            # Buildings tend to align locally but never form a grid.
            nearest_path = min(paths, key=lambda p: distance_to_polyline(cx, cy, p))
            a, b = nearest_path[0], nearest_path[-1]
            path_yaw = math.atan2(b[1] - a[1], b[0] - a[0])
            yaw = path_yaw + random.uniform(-0.55, 0.55)

            w = random.uniform(7.0, 14.5)
            d = random.uniform(6.0, 13.0)
            h = random.uniform(2.45, 4.15)
            if math.hypot(cx, cy) > 145:
                h *= random.uniform(0.82, 0.95)

            add_compound(
                index, cx, cy, yaw, w, d, h, random.randrange(6),
                clay, deep_clay, basalt, roof,
            )
            placed.append((cx, cy))
            index += 1
            created += 1

    print(f"Editable compounds created: {STATS['compounds']}")
    return paths


def add_route_guides(paths, route_mat):
    # Guides are hidden-ish editing cues. Final street form should emerge from voids.
    for i, points in enumerate(paths):
        for j in range(len(points) - 1):
            ax, ay = points[j]
            bx, by = points[j + 1]
            length = math.hypot(bx - ax, by - ay)
            yaw = math.atan2(by - ay, bx - ax)
            width = 1.4 if i < 3 else 1.1
            add_box(
                f"route_guide_{i}_{j}",
                (length, width, 0.035),
                ((ax + bx) / 2, (ay + by) / 2, 0.018),
                yaw,
                collection="ROUTES",
                mat=route_mat,
            )
            STATS["route_guides"] += 1


def add_edge_agriculture(soil, palm_trunk, palm_crown):
    # Agriculture wraps around parts of the urban edge, not as a neat outer ring.
    zones = [
        (-176, 112, 58, 34, -0.18),
        (156, 126, 62, 38, 0.22),
        (174, -94, 68, 34, -0.08),
        (-154, -142, 62, 42, 0.16),
    ]

    for zi, (cx, cy, w, d, yaw) in enumerate(zones):
        patch_count = 4
        for p in range(patch_count):
            pw = w * random.uniform(0.34, 0.52)
            pd = d * random.uniform(0.35, 0.52)
            ox = random.uniform(-w * 0.25, w * 0.25)
            oy = random.uniform(-d * 0.25, d * 0.25)
            x, y = local_to_world(cx, cy, yaw, ox, oy)
            add_box(
                f"field_{zi}_{p}",
                (pw, pd, 0.10),
                (x, y, -0.02),
                yaw + random.uniform(-0.10, 0.10),
                collection="AGRICULTURE",
                mat=soil,
            )
            STATS["field_patches"] += 1

        palm_count = random.randint(10, 16)
        for p in range(palm_count):
            px = cx + random.uniform(-w * 0.43, w * 0.43)
            py = cy + random.uniform(-d * 0.43, d * 0.43)
            height = random.uniform(5.4, 8.6)
            add_cylinder(
                f"palm_{zi}_{p}_trunk", 0.24, height, (px, py, height / 2),
                collection="PALMS", mat=palm_trunk, vertices=7,
            )
            add_cylinder(
                f"palm_{zi}_{p}_crown", random.uniform(1.2, 1.8), 0.22,
                (px, py, height + 0.10), collection="PALMS", mat=palm_crown, vertices=9,
            )
            STATS["palms"] += 1


def configure_scene():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"


def export_glb():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print(f"Exported authored core to {OUTPUT}")


def write_report():
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "seed": SEED,
        "status": "authored-core-v2-irregular-neighborhood-fabric",
        **STATS,
        "historical_accuracy": "Visual massing prototype only; not exact parcel reconstruction.",
        "runtime_procedural_generation": False,
        "source_of_truth": "tools/blender/generated/core-authored.blend",
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main():
    reset_scene()
    configure_scene()
    for name in COLLECTIONS:
        ensure_collection(name)

    clay = material("mud_clay", (0.47, 0.30, 0.19))
    deep_clay = material("deep_clay", (0.37, 0.23, 0.14))
    ground = material("compacted_earth", (0.50, 0.39, 0.26), 1.0)
    basalt = material("basalt", (0.16, 0.155, 0.15), 0.99)
    roof = material("palm_wood_roof", (0.30, 0.22, 0.15), 0.97)
    route = material("route_guide", (0.42, 0.34, 0.24), 1.0)
    field_soil = material("field_soil", (0.31, 0.27, 0.17), 1.0)
    palm_trunk = material("palm_trunk", (0.27, 0.19, 0.11), 0.96)
    palm_crown = material("palm_crown", (0.19, 0.29, 0.16), 0.98)

    add_box("core_ground", (470, 470, 0.5), (0, 0, -0.25), collection="TERRAIN", mat=ground)
    build_landmark_shell(clay, roof)
    paths = build_neighborhoods(clay, deep_clay, basalt, roof)
    add_route_guides(paths, route)
    add_edge_agriculture(field_soil, palm_trunk, palm_crown)

    WORKING.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKING))
    export_glb()
    write_report()

    print("Authoring stats:", STATS)


if __name__ == "__main__":
    main()
