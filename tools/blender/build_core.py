"""Blender authoring starter for Madinah Simulation core sector.

Run inside Blender's Python environment, not in the browser.
This script creates a structured starter scene for manual authoring and exports GLB.
It is intentionally a starting point, not a claim of archaeological parcel accuracy.
"""

import bpy
from math import radians
from pathlib import Path

ROOT = Path(bpy.path.abspath("//"))
OUTPUT = ROOT / "public" / "assets" / "city" / "core.glb"

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


def build_landmark_shell(clay):
    # Schematic only. Final Prophet's Mosque reconstruction remains separately governed
    # by historical data and review.
    w, d, h, t = 42.0, 36.0, 3.2, 1.1
    add_box("mosque_n", (w, t, h), (0, d/2, h/2), collection="LANDMARKS", mat=clay)
    add_box("mosque_s", (w, t, h), (0,-d/2, h/2), collection="LANDMARKS", mat=clay)
    add_box("mosque_w", (t, d, h), (-w/2,0,h/2), collection="LANDMARKS", mat=clay)
    add_box("mosque_e", (t, d, h), ( w/2,0,h/2), collection="LANDMARKS", mat=clay)


def build_starter_blocks(clay, deep_clay):
    # Deliberately small starter set. These objects are meant to be manually edited,
    # duplicated and reshaped in Blender rather than treated as the final city generator.
    starters = [
        ("courtyard_a", (12, 3.0, 3.0), (-58, -35, 1.5), 8),
        ("courtyard_b", (9, 4.0, 2.8), (-38, -18, 1.4), -13),
        ("courtyard_c", (14, 3.4, 3.3), (52, -28, 1.65), 17),
        ("courtyard_d", (8, 6.0, 2.6), (35, 22, 1.3), -21),
        ("courtyard_e", (11, 4.2, 3.1), (-48, 39, 1.55), 11),
    ]
    for index, (name, dims, loc, deg) in enumerate(starters):
        add_box(name, dims, loc, radians(deg), mat=clay if index % 2 == 0 else deep_clay)


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

    clay = material("mud_clay", (0.50, 0.32, 0.20))
    deep_clay = material("deep_clay", (0.40, 0.25, 0.15))
    ground = material("compacted_earth", (0.55, 0.43, 0.28), 1.0)

    add_box("core_ground", (430, 430, 0.5), (0, 0, -0.25), collection="TERRAIN", mat=ground)
    build_landmark_shell(clay)
    build_starter_blocks(clay, deep_clay)
    export_glb()


if __name__ == "__main__":
    main()
