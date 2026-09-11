# Authored City Assets

This directory is reserved for the final asset-driven Madinah city sectors.

Expected files:

- `core.glb`
- `north.glb`
- `south.glb`
- `east.glb`
- `west.glb`
- `oasis.glb`
- `outer-terrain.glb`

## Asset rules

Each sector should be authored outside the browser and exported as an optimized GLB.

Preferred characteristics:

- Static geometry merged by material where practical.
- Minimal material count.
- No per-house runtime Object3D requirement.
- No debug slabs or placeholder towers.
- Low-rise historical morphology.
- Sector seams visually disappear when all sectors are loaded.
- Historical IDs and confidence metadata live outside the GLB whenever possible.
- LOD variants may be added later as sibling files.

## Visual target

Match the locked master-city reference in `docs/MASTER_CITY_REFERENCE.md`: dense connected settlement, irregular alleys, oasis integration, and a natural city-to-landscape transition.

Do not treat the GLB assets as claims of archaeological precision where the historical evidence is uncertain.
