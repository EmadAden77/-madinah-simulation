"""Blender-first authoring script for the Madinah Simulation core sector.

This runs inside Blender, never in the browser. Its job is to create an EDITABLE
historical-city massing scene that can be hand-adjusted against the locked visual
reference before exporting a static GLB.

Important:
- This is visual massing, not a claim of exact archaeological parcel geometry.
- Historical landmarks remain governed by the project's historical data layer.
- The generated objects are intentionally grouped into editable Blender collections.
"""

import bpy
import math
import random
from pathlib import Path

ROOT = Path(bpy.path.abspath("//"))
OUTPUT = ROOT / "public" / "assets" / "city" / "core.glb"
SEED = 622
random.seed(SEED)

COLLECTIONS = [
    "BUILDINGS",
    "COURTYARD_WALLS",
    "ROOFS",
    "ROUTES",
    "LANDMARKS",
    "TERRAIN",
]


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


def add_box(name, dims, location, rotation_z=0.0, collection="BUILDINGS", mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return obj


def local_to_world(cx, cy, yaw, lx, ly):
    return (
        cx + lx * math.cos(yaw) - ly * math.sin(yaw),
        cy + lx * math.sin(yaw) + ly * math.cos(yaw),
    )


def build_landmark_shell(clay, roof):
    # Schematic shell only. The final Prophet's Mosque reconstruction remains
    # a separately reviewed historical landmark asset.
    w, d, h, t = 42.0, 36.0, 3.2, 1.1
    add_box("mosque_n", (w, t, h), (0, d / 2, h / 2), collection="LANDMARKS", mat=clay)
    add_box("mosque_s", (w, t, h), (0, -d / 2, h / 2), collection="LANDMARKS", mat=clay)
    add_box("mosque_w", (t, d, h), (-w / 2, 0, h / 2), collection="LANDMARKS", mat=clay)
    add_box("mosque_e", (t, d, h), (w / 2, 0, h / 2), collection="LANDMARKS", mat=clay)
    add_box("mosque_shade", (w - 5, 6.5, 0.28), (0, d / 2 - 4.2, 2.95), collection="ROOFS", mat=roof)


def add_compound(index, cx, cy, yaw, w, d, h, family, clay, deep_clay, basalt, roof):
    """Create one editable compound from a small historical morphology family."""
    wall = 1.8 + random.random() * 0.55
    pieces = []

    if family == 0:  # U court
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (0, d / 2 - wall / 2, w * 0.86, wall, h * 0.92),
            (-w / 2 + wall / 2, 0, wall, d - 1.7 * wall, h * 0.88),
        ]
    elif family == 1:  # L court
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * 0.94),
        ]
    elif family == 2:  # offset court
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w / 2 + wall / 2, 0, wall, d, h * 0.90),
            (w * 0.18, d / 2 - wall / 2, w * 0.54, wall, h * 0.82),
        ]
    elif family == 3:  # narrow courtyard pair
        pieces = [
            (0, -d / 2 + wall / 2, w, wall, h),
            (-w * 0.10, d / 2 - wall / 2, w * 0.70, wall, h * 0.86),
        ]
    else:  # irregular four-sided fragments
        pieces = [
            (-w * 0.14, -d / 2 + wall / 2, w * 0.62, wall, h),
            (w * 0.23, d / 2 - wall / 2, w * 0.42, wall, h * 0.88),
            (-w / 2 + wall / 2, -d * 0.09, wall, d * 0.62, h * 0.82),
            (w / 2 - wall / 2, d * 0.16, wall, d * 0.38, h * 0.77),
        ]

    for j, (lx, ly, sx, sy, sz) in enumerate(pieces):
        x, y = local_to_world(cx, cy, yaw, lx, ly)
        mat = clay if (index + j) % 3 else deep_clay
        add_box(
            f"compound_{index:03d}_wall_{j}",
            (sx, sy, sz),
            (x, y, sz / 2),
            yaw,
            collection="COURTYARD_WALLS",
            mat=mat,
        )

    # Small basalt threshold/foundation cue. Kept subtle so the core does not
    # turn into a striped toy-city when seen from above.
    fx, fy = local_to_world(cx, cy, yaw, 0, -d / 2 + 0.28)
    add_box(
        f"compound_{index:03d}_foundation",
        (w * 0.72, 0.55, 0.24),
        (fx, fy, 0.12),
        yaw,
        collection="BUILDINGS",
        mat=basalt,
    )

    # Not every compound gets a full roof. This preserves courtyard readability.
    if index % 4 == 0:
        rx, ry = local_to_world(cx, cy, yaw, 0, -d / 2 + wall * 0.62)
        add_box(
            f"compound_{index:03d}_roof",
            (w * 0.82, wall * 0.92, 0.22),
            (rx, ry, h + 0.11),
            yaw,
            collection="ROOFS",
            mat=roof,
        )


def build_dense_core(clay, deep_clay, basalt, roof):
    """Create a dense, continuous, editable core mass around the central landmark.

    The layout intentionally preserves four winding corridor bands rather than
    carving modern roads. These voids are meant to read as narrow historical
    access routes after manual Blender refinement.
    """
    corridor_angles = [0.18 * math.pi, 0.72 * math.pi, 1.14 * math.pi, 1.58 * math.pi]
    compound_index = 0

    for ring in range(4):
        r_min = 33 + ring * 34
        r_max = r_min + 27
        count = 36 + ring * 14

        for i in range(count):
            theta = 2 * math.pi * i / count + random.uniform(-0.055, 0.055)

            # Leave organic alley corridors. Their width changes by ring so they
            # do not read as straight radial boulevards.
            blocked = False
            for c in corridor_angles:
                delta = abs((theta - c + math.pi) % (2 * math.pi) - math.pi)
                if delta < 0.038 + ring * 0.009:
                    blocked = True
                    break
            if blocked:
                continue

            r = random.uniform(r_min, r_max)
            cx = r * math.cos(theta)
            cy = r * math.sin(theta)
            w = random.uniform(7.3, 14.0)
            d = random.uniform(6.4, 12.8)
            h = random.uniform(2.5, 4.1)
            yaw = theta + math.pi / 2 + random.uniform(-0.26, 0.26)
            family = random.randrange(5)

            add_compound(
                compound_index,
                cx,
                cy,
                yaw,
                w,
                d,
                h,
                family,
                clay,
                deep_clay,
                basalt,
                roof,
            )
            compound_index += 1

    # Break the outer silhouette so the settlement edge is not a perfect disk.
    for side in (-1, 1):
        for k in range(12):
            x = side * random.uniform(132, 194)
            y = random.uniform(-152, 152)
            w = random.uniform(8.0, 13.0)
            d = random.uniform(7.0, 11.5)
            h = random.uniform(2.4, 3.5)
            yaw = random.uniform(-0.52, 0.52)
            add_compound(
                compound_index,
                x,
                y,
                yaw,
                w,
                d,
                h,
                random.randrange(5),
                clay,
                deep_clay,
                basalt,
                roof,
            )
            compound_index += 1

    print(f"Editable compounds created: {compound_index}")


def add_route_guides(route_mat):
    """Create subtle route-guide meshes for manual editing, not final modern roads."""
    guides = [
        ((18, -175, 0.03), (5.5, 115, 0.06), math.radians(-6)),
        ((-72, 126, 0.03), (4.3, 96, 0.06), math.radians(18)),
        ((128, 72, 0.03), (4.0, 82, 0.06), math.radians(-27)),
    ]
    for i, (loc, dims, rot) in enumerate(guides):
        add_box(f"route_guide_{i}", dims, loc, rot, collection="ROUTES", mat=route_mat)


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


def main():
    reset_scene()
    configure_scene()
    for name in COLLECTIONS:
        ensure_collection(name)

    clay = material("mud_clay", (0.48, 0.31, 0.20))
    deep_clay = material("deep_clay", (0.39, 0.245, 0.15))
    ground = material("compacted_earth", (0.53, 0.42, 0.285), 1.0)
    basalt = material("basalt", (0.19, 0.18, 0.17), 0.98)
    roof = material("palm_wood_roof", (0.32, 0.24, 0.17), 0.96)
    route = material("route_guide", (0.44, 0.36, 0.25), 1.0)

    add_box("core_ground", (430, 430, 0.5), (0, 0, -0.25), collection="TERRAIN", mat=ground)
    build_landmark_shell(clay, roof)
    build_dense_core(clay, deep_clay, basalt, roof)
    add_route_guides(route)

    # Save the .blend working scene before export so Blender becomes the source of truth.
    working_file = ROOT / "tools" / "blender" / "generated" / "core-authored.blend"
    working_file.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(working_file))
    export_glb()


if __name__ == "__main__":
    main()
