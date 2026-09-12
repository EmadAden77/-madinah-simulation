"""Full realism enhancement pass for the authored Madinah core.

Runs after build_core.py. It opens the editable Blender source, enriches the scene
with geometry that reads at aerial and medium zoom, saves the authored .blend,
re-exports core.glb, and amends the authoring report.
"""

import bpy
import json
import math
import random
import re
from pathlib import Path

ROOT = Path(bpy.path.abspath("//"))
WORKING = ROOT / "tools" / "blender" / "generated" / "core-authored.blend"
OUTPUT = ROOT / "public" / "assets" / "city" / "core.glb"
REPORT = ROOT / "public" / "assets" / "city" / "core-authoring-report.json"
SEED = 62231
random.seed(SEED)

DETAIL_COLLECTIONS = ["REALISM_WALLS", "REALISM_COURTYARDS", "REALISM_STREET", "REALISM_TERRAIN", "REALISM_VEGETATION"]
STATS = {
    "wall_caps": 0,
    "buttresses": 0,
    "lintels": 0,
    "courtyard_props": 0,
    "street_props": 0,
    "terrain_rocks": 0,
    "extra_palms": 0,
    "field_rows": 0,
}


def ensure_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def move_to_collection(obj, name):
    target = ensure_collection(name)
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    target.objects.link(obj)


def mat(name, color, roughness=0.95):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def box(name, dims, loc, yaw=0.0, material=None, collection="REALISM_STREET", bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, yaw))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("soft_edge", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    if material:
        obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def cyl(name, radius, depth, loc, material=None, collection="REALISM_STREET", vertices=10, yaw=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=(0, 0, yaw))
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def local_offset(x, y, yaw, forward, side):
    return (
        x + forward * math.cos(yaw) - side * math.sin(yaw),
        y + forward * math.sin(yaw) + side * math.cos(yaw),
    )


def compound_groups():
    groups = {}
    rx = re.compile(r"compound_(\d+)_wall_")
    for obj in bpy.data.objects:
        m = rx.match(obj.name)
        if not m:
            continue
        groups.setdefault(int(m.group(1)), []).append(obj)
    return groups


def enhance_wall_fabric(clay_caps, basalt, timber):
    walls = [o for o in bpy.data.objects if re.match(r"compound_\d+_wall_", o.name)]
    for i, wall in enumerate(walls):
        yaw = wall.rotation_euler.z
        sx, sy, sz = wall.dimensions
        x, y, z = wall.location

        # Irregular earthen cap segments break perfect cuboid silhouettes from above.
        if i % 2 == 0:
            segs = 2 if max(sx, sy) > 5.5 else 1
            for s in range(segs):
                if sx >= sy:
                    span = sx / segs * random.uniform(0.52, 0.83)
                    lx = (-sx * 0.24 if segs == 2 and s == 0 else sx * 0.24 if segs == 2 else 0)
                    ox, oy = local_offset(x, y, yaw, lx, 0)
                    dims = (span, sy * random.uniform(0.62, 0.90), random.uniform(0.08, 0.18))
                else:
                    span = sy / segs * random.uniform(0.52, 0.83)
                    ox, oy = local_offset(x, y, yaw, 0, (-sy * 0.24 if segs == 2 and s == 0 else sy * 0.24 if segs == 2 else 0))
                    dims = (sx * random.uniform(0.62, 0.90), span, random.uniform(0.08, 0.18))
                box(f"real_cap_{i}_{s}", dims, (ox, oy, z + sz / 2 + dims[2] / 2), yaw, random.choice(clay_caps), "REALISM_WALLS", 0.025)
                STATS["wall_caps"] += 1

        # Sparse exterior buttresses make long mud walls less machine-perfect.
        if i % 7 == 0 and max(sx, sy) > 4.5:
            bw = random.uniform(0.35, 0.55)
            bh = min(sz * random.uniform(0.55, 0.82), 2.6)
            if sx >= sy:
                px, py = local_offset(x, y, yaw, random.uniform(-sx * 0.28, sx * 0.28), -sy * 0.58)
                dims = (bw, random.uniform(0.45, 0.72), bh)
            else:
                px, py = local_offset(x, y, yaw, -sx * 0.58, random.uniform(-sy * 0.28, sy * 0.28))
                dims = (random.uniform(0.45, 0.72), bw, bh)
            box(f"real_buttress_{i}", dims, (px, py, bh / 2), yaw, random.choice(clay_caps), "REALISM_WALLS", 0.04)
            STATS["buttresses"] += 1

    # Timber lintels over doors. These read clearly at medium zoom.
    doors = [o for o in bpy.data.objects if re.match(r"compound_\d+_door", o.name)]
    for i, door in enumerate(doors):
        sx, sy, sz = door.dimensions
        box(f"real_lintel_{i}", (sx * 1.28, max(0.18, sy * 1.5), 0.16), (door.location.x, door.location.y, sz + 0.10), door.rotation_euler.z, timber, "REALISM_WALLS", 0.025)
        STATS["lintels"] += 1


def add_courtyard_life(groups, pottery, timber, reed):
    for idx, walls in groups.items():
        if not walls:
            continue
        cx = sum(o.location.x for o in walls) / len(walls)
        cy = sum(o.location.y for o in walls) / len(walls)
        avg_h = sum(o.dimensions.z for o in walls) / len(walls)
        yaw = walls[0].rotation_euler.z

        # Most compounds get only one or two restrained props so it stays believable.
        if idx % 3 == 0:
            px, py = local_offset(cx, cy, yaw, random.uniform(-1.0, 1.0), random.uniform(-0.8, 0.8))
            r = random.uniform(0.18, 0.28)
            cyl(f"jar_{idx}", r, random.uniform(0.42, 0.68), (px, py, 0.28), pottery, "REALISM_COURTYARDS", vertices=10)
            STATS["courtyard_props"] += 1

        if idx % 11 == 0:
            # A low woven shade frame / drying rack.
            px, py = local_offset(cx, cy, yaw, 0.2, 0.15)
            post_h = min(2.25, max(1.65, avg_h * 0.62))
            for s in (-0.75, 0.75):
                ox, oy = local_offset(px, py, yaw, s, 0)
                cyl(f"court_post_{idx}_{s}", 0.07, post_h, (ox, oy, post_h / 2), timber, "REALISM_COURTYARDS", vertices=7)
            box(f"court_reed_{idx}", (1.75, 1.25, 0.08), (px, py, post_h + 0.03), yaw, reed, "REALISM_COURTYARDS", 0.02)
            STATS["courtyard_props"] += 3


def add_street_texture(groups, basalt, pottery, timber):
    centers = []
    for idx, walls in groups.items():
        cx = sum(o.location.x for o in walls) / len(walls)
        cy = sum(o.location.y for o in walls) / len(walls)
        centers.append((idx, cx, cy, walls[0].rotation_euler.z))

    for idx, cx, cy, yaw in centers:
        if idx % 5 == 0:
            # Uneven basalt stones near thresholds/alleys.
            for k in range(random.randint(2, 4)):
                px, py = local_offset(cx, cy, yaw, random.uniform(-3.8, 3.8), random.uniform(-4.0, 4.0))
                rock = box(f"street_stone_{idx}_{k}", (random.uniform(0.22, 0.55), random.uniform(0.18, 0.45), random.uniform(0.08, 0.20)), (px, py, 0.06), random.uniform(-math.pi, math.pi), basalt, "REALISM_STREET", 0.035)
                rock.rotation_euler.x = random.uniform(-0.08, 0.08)
                STATS["street_props"] += 1
        if idx % 17 == 0:
            # Tiny timber bundle beside a wall.
            for k in range(3):
                px, py = local_offset(cx, cy, yaw, random.uniform(-2.0, 2.0), random.uniform(-2.2, 2.2))
                box(f"timber_bundle_{idx}_{k}", (random.uniform(1.1, 1.8), 0.10, 0.10), (px, py, 0.09 + k * 0.08), yaw + random.uniform(-0.25, 0.25), timber, "REALISM_STREET", 0.02)
                STATS["street_props"] += 1


def add_terrain_and_oasis(earth_dark, earth_light, basalt, trunk, frond, crop):
    # Outer ground variation and volcanic stones. Keep the dense core mostly clear.
    for i in range(115):
        angle = random.uniform(0, math.tau)
        radius = random.uniform(155, 225)
        x = math.cos(angle) * radius + random.uniform(-12, 12)
        y = math.sin(angle) * radius + random.uniform(-12, 12)
        r = random.uniform(0.25, 0.9)
        rock = cyl(f"outer_rock_{i}", r, random.uniform(0.10, 0.38), (x, y, 0.06), basalt, "REALISM_TERRAIN", vertices=random.randint(5, 8), yaw=random.uniform(0, math.tau))
        rock.scale.x = random.uniform(0.7, 1.5)
        rock.scale.y = random.uniform(0.65, 1.3)
        STATS["terrain_rocks"] += 1

    # Irregular compacted-earth patches, deliberately not a clean ring.
    for i in range(38):
        angle = random.uniform(0, math.tau)
        radius = random.uniform(95, 205)
        x, y = math.cos(angle) * radius, math.sin(angle) * radius
        cyl(f"earth_patch_{i}", random.uniform(3.0, 8.5), 0.025, (x, y, 0.005), earth_dark if i % 2 else earth_light, "REALISM_TERRAIN", vertices=18)

    # Extra palm clusters and simple fronds. These are visible from the aerial view.
    cluster_centers = [(-178, 112), (158, 126), (175, -96), (-155, -143), (-205, 28), (196, 54)]
    palm_i = 0
    for cx, cy in cluster_centers:
        for _ in range(random.randint(9, 15)):
            x = cx + random.uniform(-28, 28)
            y = cy + random.uniform(-22, 22)
            h = random.uniform(5.5, 9.2)
            cyl(f"real_palm_trunk_{palm_i}", random.uniform(0.18, 0.28), h, (x, y, h / 2), trunk, "REALISM_VEGETATION", vertices=8)
            for f in range(8):
                a = f * math.tau / 8 + random.uniform(-0.14, 0.14)
                length = random.uniform(2.1, 3.3)
                fx = x + math.cos(a) * length * 0.45
                fy = y + math.sin(a) * length * 0.45
                fr = box(f"frond_{palm_i}_{f}", (length, random.uniform(0.12, 0.22), 0.07), (fx, fy, h + random.uniform(-0.05, 0.18)), a, frond, "REALISM_VEGETATION", 0.015)
                fr.rotation_euler.y = random.uniform(-0.16, 0.06)
            STATS["extra_palms"] += 1
            palm_i += 1

    # Broken agricultural rows near orchards, not suburban-perfect rectangles.
    row_i = 0
    for cx, cy, yaw in [(-170, 128, -0.18), (150, 140, 0.22), (168, -112, -0.09), (-150, -158, 0.17)]:
        for r in range(6):
            off = (r - 2.5) * random.uniform(2.3, 3.2)
            x, y = local_offset(cx, cy, yaw, random.uniform(-3.5, 3.5), off)
            box(f"crop_row_{row_i}", (random.uniform(18, 32), random.uniform(0.45, 0.8), 0.08), (x, y, 0.035), yaw + random.uniform(-0.05, 0.05), crop, "REALISM_VEGETATION", 0.03)
            STATS["field_rows"] += 1
            row_i += 1


def export_final():
    bpy.ops.wm.save_as_mainfile(filepath=str(WORKING))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )


def update_report():
    data = {}
    if REPORT.exists():
        data = json.loads(REPORT.read_text(encoding="utf-8"))
    data.update({
        "status": "authored-core-v4-full-realism-pass",
        "realism_pass_seed": SEED,
        "realism_features": [
            "denser irregular fabric from base authoring pass",
            "irregular mud-wall caps and buttresses",
            "timber door lintels",
            "courtyard pottery and shade frames",
            "street basalt scatter and timber bundles",
            "outer volcanic-rock texture",
            "additional palm clusters with radial fronds",
            "broken agricultural rows and compacted-earth variation",
        ],
        "realism_stats": STATS,
        "runtime_procedural_generation": False,
        "source_of_truth": "tools/blender/generated/core-authored.blend",
    })
    REPORT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    if not WORKING.exists():
        raise FileNotFoundError(f"Missing authored Blender source: {WORKING}")
    bpy.ops.wm.open_mainfile(filepath=str(WORKING))
    for name in DETAIL_COLLECTIONS:
        ensure_collection(name)

    clay_caps = [
        mat("real_clay_light", (0.52, 0.34, 0.20)),
        mat("real_clay_mid", (0.44, 0.28, 0.17)),
        mat("real_clay_dust", (0.58, 0.41, 0.26)),
    ]
    basalt = mat("real_basalt", (0.12, 0.12, 0.115), 0.99)
    timber = mat("real_timber", (0.24, 0.16, 0.09), 0.96)
    pottery = mat("real_pottery", (0.42, 0.20, 0.11), 0.91)
    reed = mat("real_reed", (0.47, 0.36, 0.18), 0.98)
    earth_dark = mat("real_earth_dark", (0.34, 0.27, 0.18), 1.0)
    earth_light = mat("real_earth_light", (0.54, 0.43, 0.28), 1.0)
    trunk = mat("real_palm_trunk", (0.24, 0.16, 0.09), 0.97)
    frond = mat("real_palm_frond", (0.14, 0.25, 0.11), 0.98)
    crop = mat("real_crop_row", (0.22, 0.31, 0.13), 0.99)

    groups = compound_groups()
    enhance_wall_fabric(clay_caps, basalt, timber)
    add_courtyard_life(groups, pottery, timber, reed)
    add_street_texture(groups, basalt, pottery, timber)
    add_terrain_and_oasis(earth_dark, earth_light, basalt, trunk, frond, crop)
    export_final()
    update_report()
    print("Full realism enhancement stats:", STATS)


if __name__ == "__main__":
    main()
