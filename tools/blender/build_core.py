"""Blender-first authoring script for the Madinah Simulation core sector.

This script produces an editable authored scene, then exports a static GLB for the
browser. The browser is only the renderer. The visual target is a dense, irregular,
low-rise earthen settlement with narrow alleys, courtyard compounds, basalt footing,
partial palm-wood roofs, edge orchards, and a natural transition to open ground.

This remains a historically informed visual reconstruction, not a claim of exact
archaeological parcel geometry. Landmark identity/meaning remains governed by the
historical data layer.
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
    "DETAILS",
    "ROUTES",
    "PALMS",
    "AGRICULTURE",
    "LANDMARKS",
    "TERRAIN",
]

STATS = {
    "compounds": 0,
    "compound_parts": 0,
    "doors": 0,
    "roof_elements": 0,
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


def nearest_segment_yaw(px, py, polyline):
    best = None
    best_dist = 1e9
    for i in range(len(polyline) - 1):
        a, b = polyline[i], polyline[i + 1]
        d = distance_to_segment(px, py, a[0], a[1], b[0], b[1])
        if d < best_dist:
            best_dist = d
            best = math.atan2(b[1] - a[1], b[0] - a[0])
    return best or 0.0


def build_landmark_shell(clay, roof, timber):
    # Schematic only. Final landmark reconstruction remains separately reviewed.
    w, d, h, t = 42.0, 36.0, 3.2, 1.15
    for name, dims, pos in [
        ("mosque_n", (w, t, h), (0, d / 2, h / 2)),
        ("mosque_s", (w, t, h), (0, -d / 2, h / 2)),
        ("mosque_w", (t, d, h), (-w / 2, 0, h / 2)),
        ("mosque_e", (t, d, h), (w / 2, 0, h / 2)),
    ]:
        add_box(name, dims, pos, collection="LANDMARKS", mat=clay, bevel=0.10)
    add_box("mosque_shade", (w - 5, 6.2, 0.22), (0, d / 2 - 4.0, 2.92), collection="ROOFS", mat=roof)
    for i in range(8):
        x = -15.5 + i * 4.45
        add_cylinder(f"mosque_post_{i}", 0.12, 2.8, (x, d / 2 - 4.0, 1.4), "DETAILS", timber, vertices=8)


def add_roof_beams(index, cx, cy, yaw, w, d, h, timber, roof):
    if index % 2:
        return
    # A short covered room bar, with visible palm-trunk beams.
    cover_d = min(3.0, d * 0.32)
    rx, ry = local_to_world(cx, cy, yaw, 0, -d / 2 + cover_d / 2 + 0.35)
    add_box(
        f"compound_{index:03d}_roof_skin",
        (w * random.uniform(0.58, 0.82), cover_d, 0.13),
        (rx, ry, h + 0.08), yaw, collection="ROOFS", mat=roof,
    )
    beam_count = max(3, int(w / 2.6))
    span = w * 0.68
    for b in range(beam_count):
        lx = -span / 2 + span * (b / max(1, beam_count - 1))
        bx, by = local_to_world(cx, cy, yaw, lx, -d / 2 + cover_d / 2 + 0.35)
        add_box(
            f"compound_{index:03d}_beam_{b}",
            (0.15, cover_d + 0.25, 0.14),
            (bx, by, h + 0.16), yaw, collection="ROOFS", mat=timber,
        )
        STATS["roof_elements"] += 1


def add_compound(index, cx, cy, yaw, w, d, h, family, clay_mats, basalt, timber, roof, door_mat):
    wall = random.uniform(1.35, 1.95)
    clay = clay_mats[index % len(clay_mats)]
    accent = clay_mats[(index + 2) % len(clay_mats)]

    if family == 0:  # U-shaped courtyard
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0.25, wall, d - 1.4 * wall, h * 0.90),
            (w / 2 - wall / 2, 0.10, wall, d * 0.72, h * 0.82),
        ]
    elif family == 1:  # L-shaped house
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * 0.88),
            (w * 0.24, d / 2 - wall / 2, w * 0.34, wall, h * 0.76),
        ]
    elif family == 2:  # enclosed offset court
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * 0.92),
            (w / 2 - wall / 2, d * 0.06, wall, d * 0.63, h * 0.80),
            (w * 0.12, d / 2 - wall / 2, w * 0.62, wall, h * 0.78),
        ]
    elif family == 3:  # narrow double range
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w * 0.10, d / 2 - wall / 2, w * 0.72, wall, h * 0.82),
            (-w / 2 + wall / 2, 0, wall, d * 0.58, h * 0.78),
        ]
    elif family == 4:  # fragmented irregular compound
        pieces = [
            (-w * 0.12, -d / 2 + wall / 2, w * 0.70, wall, h),
            (w * 0.20, d / 2 - wall / 2, w * 0.48, wall, h * 0.80),
            (-w / 2 + wall / 2, -d * 0.08, wall, d * 0.68, h * 0.84),
            (w / 2 - wall / 2, d * 0.18, wall, d * 0.34, h * 0.70),
        ]
    else:  # compact, asymmetrical courtyard
        pieces = [
            (-w * 0.05, -d / 2 + wall * 0.62, w * 0.90, wall * 1.18, h),
            (-w / 2 + wall / 2, d * 0.02, wall, d * 0.82, h * 0.86),
            (w / 2 - wall / 2, -d * 0.10, wall, d * 0.52, h * 0.78),
            (w * 0.16, d / 2 - wall / 2, w * 0.52, wall, h * 0.76),
        ]

    for j, (lx, ly, sx, sy, sz) in enumerate(pieces):
        x, y = local_to_world(cx, cy, yaw, lx, ly)
        sz *= random.uniform(0.94, 1.06)
        add_box(
            f"compound_{index:03d}_wall_{j}",
            (sx, sy, sz), (x, y, sz / 2), yaw,
            collection="COURTYARD_WALLS",
            mat=clay if j % 3 else accent,
            bevel=random.uniform(0.06, 0.13),
        )
        STATS["compound_parts"] += 1

    # Broken basalt footing, not a continuous decorative stripe.
    fx, fy = local_to_world(cx, cy, yaw, -w * 0.08, -d / 2 + 0.20)
    add_box(
        f"compound_{index:03d}_foundation",
        (w * random.uniform(0.35, 0.66), 0.38, random.uniform(0.18, 0.30)),
        (fx, fy, 0.10), yaw, collection="BUILDINGS", mat=basalt, bevel=0.03,
    )

    # Dark timber door slightly proud of the wall, enough to read at medium zoom.
    door_w = random.uniform(0.75, 1.10)
    door_h = random.uniform(1.65, 2.05)
    door_lx = random.uniform(-w * 0.24, w * 0.24)
    dx, dy = local_to_world(cx, cy, yaw, door_lx, -d / 2 - 0.04)
    add_box(
        f"compound_{index:03d}_door",
        (door_w, 0.12, door_h),
        (dx, dy, door_h / 2), yaw, collection="DETAILS", mat=door_mat, bevel=0.025,
    )
    STATS["doors"] += 1

    add_roof_beams(index, cx, cy, yaw, w, d, h, timber, roof)
    STATS["compounds"] += 1


def build_neighborhoods(clay_mats, basalt, timber, roof, door_mat):
    """Dense overlapping fabric, narrow organic voids, no radial diagram."""
    districts = [
        {"name": "inner_west", "center": (-48, 8), "radius": (72, 58), "count": 86, "gap": (3.2, 4.2)},
        {"name": "inner_east", "center": (54, -4), "radius": (76, 60), "count": 92, "gap": (3.1, 4.1)},
        {"name": "north_cluster", "center": (-6, 78), "radius": (88, 62), "count": 84, "gap": (3.4, 4.4)},
        {"name": "south_cluster", "center": (12, -86), "radius": (94, 66), "count": 92, "gap": (3.4, 4.5)},
        {"name": "northwest", "center": (-112, 82), "radius": (72, 54), "count": 56, "gap": (3.8, 5.0)},
        {"name": "east_edge", "center": (122, 48), "radius": (72, 58), "count": 58, "gap": (3.8, 5.1)},
        {"name": "southwest", "center": (-110, -88), "radius": (72, 58), "count": 54, "gap": (3.9, 5.2)},
        {"name": "south_east", "center": (108, -96), "radius": (66, 52), "count": 48, "gap": (4.0, 5.3)},
    ]

    paths = [
        [(-205, 12), (-144, 6), (-96, 15), (-52, 23), (-18, 13), (28, 7), (82, -6), (198, -18)],
        [(-88, 198), (-74, 148), (-56, 102), (-34, 61), (-18, 28), (-5, 2), (4, -42), (16, -104), (34, -198)],
        [(-190, -122), (-140, -94), (-98, -62), (-58, -35), (-26, -16), (4, -3), (42, 20), (88, 48), (144, 78), (194, 104)],
        [(116, 190), (98, 145), (86, 108), (68, 76), (45, 51), (20, 31), (4, 22)],
        [(-188, 112), (-150, 96), (-112, 78), (-82, 59), (-55, 48)],
    ]

    placed = []
    index = 0

    for district in districts:
        cx0, cy0 = district["center"]
        rx, ry = district["radius"]
        target = district["count"]
        created = 0
        attempts = 0

        while created < target and attempts < target * 32:
            attempts += 1
            angle = random.uniform(0, math.tau)
            rr = math.sqrt(random.random())
            cx = cx0 + math.cos(angle) * rx * rr
            cy = cy0 + math.sin(angle) * ry * rr

            # Keep a modest landmark forecourt, not a giant empty plaza.
            if math.hypot(cx, cy) < random.uniform(22.0, 27.0):
                continue

            corridor_distance = min(distance_to_polyline(cx, cy, p) for p in paths)
            if corridor_distance < random.uniform(1.7, 2.7):
                continue

            min_gap = random.uniform(*district["gap"])
            if any(math.hypot(cx - px, cy - py) < min_gap for px, py in placed[-260:]):
                continue

            nearest_path = min(paths, key=lambda p: distance_to_polyline(cx, cy, p))
            yaw = nearest_segment_yaw(cx, cy, nearest_path) + random.uniform(-0.38, 0.38)

            radial = math.hypot(cx, cy)
            w = random.uniform(6.8, 13.0)
            d = random.uniform(6.2, 11.8)
            h = random.uniform(2.7, 4.25)
            if radial < 95:
                h *= random.uniform(1.02, 1.12)
            elif radial > 155:
                h *= random.uniform(0.80, 0.94)
                w *= random.uniform(0.88, 0.98)

            add_compound(
                index, cx, cy, yaw, w, d, h, random.randrange(6),
                clay_mats, basalt, timber, roof, door_mat,
            )
            placed.append((cx, cy))
            index += 1
            created += 1

    print(f"Editable compounds created: {STATS['compounds']}")
    return paths


def add_route_guides(paths, route_mat):
    for i, points in enumerate(paths):
        for j in range(len(points) - 1):
            ax, ay = points[j]
            bx, by = points[j + 1]
            length = math.hypot(bx - ax, by - ay)
            yaw = math.atan2(by - ay, bx - ax)
            width = random.uniform(0.75, 1.25)
            add_box(
                f"route_guide_{i}_{j}",
                (length, width, 0.025),
                ((ax + bx) / 2, (ay + by) / 2, 0.012),
                yaw, collection="ROUTES", mat=route_mat,
            )
            STATS["route_guides"] += 1


def add_palm(name, px, py, height, trunk_mat, crown_mat):
    add_cylinder(name + "_trunk", 0.20, height, (px, py, height / 2), "PALMS", trunk_mat, vertices=8)
    # Radial fronds read far better than the previous disk-shaped crown.
    for i in range(8):
        yaw = i * math.tau / 8 + random.uniform(-0.12, 0.12)
        length = random.uniform(2.5, 4.0)
        fx = px + math.cos(yaw) * length * 0.43
        fy = py + math.sin(yaw) * length * 0.43
        add_box(
            f"{name}_frond_{i}",
            (length, random.uniform(0.16, 0.24), 0.07),
            (fx, fy, height + random.uniform(-0.05, 0.22)),
            yaw, collection="PALMS", mat=crown_mat, bevel=0.03,
        )
    STATS["palms"] += 1


def add_edge_agriculture(soil_mats, palm_trunk, palm_crown):
    zones = [
        (-176, 116, 68, 42, -0.18),
        (158, 128, 72, 44, 0.22),
        (176, -92, 76, 42, -0.08),
        (-158, -144, 70, 46, 0.16),
        (18, 178, 76, 36, 0.05),
    ]

    for zi, (cx, cy, w, d, yaw) in enumerate(zones):
        for p in range(5):
            pw = w * random.uniform(0.30, 0.48)
            pd = d * random.uniform(0.30, 0.48)
            ox = random.uniform(-w * 0.28, w * 0.28)
            oy = random.uniform(-d * 0.28, d * 0.28)
            x, y = local_to_world(cx, cy, yaw, ox, oy)
            add_box(
                f"field_{zi}_{p}",
                (pw, pd, random.uniform(0.06, 0.11)),
                (x, y, -0.01),
                yaw + random.uniform(-0.14, 0.14),
                collection="AGRICULTURE",
                mat=soil_mats[(zi + p) % len(soil_mats)],
                bevel=0.05,
            )
            STATS["field_patches"] += 1

        for p in range(random.randint(14, 22)):
            px = cx + random.uniform(-w * 0.44, w * 0.44)
            py = cy + random.uniform(-d * 0.44, d * 0.44)
            add_palm(f"palm_{zi}_{p}", px, py, random.uniform(5.2, 8.5), palm_trunk, palm_crown)


def add_terrain_variation(earth_mats):
    # Broad subtle patches break the flat single-color tabletop effect.
    patches = [
        (-120, 132, 110, 54, -0.12),
        (128, 138, 98, 46, 0.10),
        (152, -138, 112, 56, -0.08),
        (-142, -150, 105, 48, 0.14),
    ]
    for i, (x, y, w, d, yaw) in enumerate(patches):
        add_box(
            f"terrain_patch_{i}", (w, d, 0.035), (x, y, 0.008), yaw,
            collection="TERRAIN", mat=earth_mats[i % len(earth_mats)], bevel=0.12,
        )


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
        "status": "authored-core-v3-dense-earthen-fabric",
        **STATS,
        "historical_accuracy": "Historically informed visual reconstruction; not exact parcel archaeology.",
        "runtime_procedural_generation": False,
        "source_of_truth": "tools/blender/generated/core-authored.blend",
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main():
    reset_scene()
    configure_scene()
    for name in COLLECTIONS:
        ensure_collection(name)

    clay_mats = [
        material("mud_clay_warm", (0.50, 0.34, 0.22)),
        material("mud_clay_light", (0.57, 0.40, 0.27)),
        material("mud_clay_deep", (0.40, 0.27, 0.18)),
        material("mud_clay_dusty", (0.53, 0.38, 0.25)),
    ]
    ground = material("compacted_earth", (0.50, 0.40, 0.28), 1.0)
    earth_mats = [
        material("earth_patch_a", (0.46, 0.36, 0.25), 1.0),
        material("earth_patch_b", (0.54, 0.43, 0.30), 1.0),
    ]
    basalt = material("basalt", (0.13, 0.13, 0.125), 0.99)
    timber = material("palm_trunk_wood", (0.24, 0.16, 0.09), 0.96)
    roof = material("palm_mat_roof", (0.34, 0.25, 0.16), 0.98)
    door_mat = material("dark_timber_doors", (0.16, 0.105, 0.065), 0.93)
    route = material("compacted_path", (0.58, 0.47, 0.33), 1.0)
    soil_mats = [
        material("field_soil_a", (0.31, 0.27, 0.17), 1.0),
        material("field_soil_b", (0.38, 0.31, 0.18), 1.0),
    ]
    palm_crown = material("palm_fronds", (0.16, 0.27, 0.13), 0.98)

    add_box("core_ground", (470, 470, 0.5), (0, 0, -0.25), collection="TERRAIN", mat=ground)
    add_terrain_variation(earth_mats)
    build_landmark_shell(clay_mats[1], roof, timber)
    paths = build_neighborhoods(clay_mats, basalt, timber, roof, door_mat)
    add_route_guides(paths, route)
    add_edge_agriculture(soil_mats, timber, palm_crown)

    WORKING.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKING))
    export_glb()
    write_report()
    print("Authoring stats:", STATS)


if __name__ == "__main__":
    main()
