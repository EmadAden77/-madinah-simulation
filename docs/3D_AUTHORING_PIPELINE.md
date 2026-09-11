# 3D Authoring Pipeline

## Project rule

The final Madinah city is **not** generated as hundreds of runtime Three.js houses.

The browser is the viewer and interaction layer. The city itself is authored as optimized 3D sector assets outside the browser and committed/exported as glTF/GLB.

## Primary visual target

The locked visual reference controls the overall aerial qualities:

- broad continuous low-rise urban mass
- dense central core
- irregular layered neighborhoods
- narrow maze-like alleys
- non-grid historical block structure
- oasis and palm belts integrated with the urban edge
- gradual transition from settlement to cultivated land and open terrain

Historical project data controls names, landmark interpretation, confidence and historically meaningful relationships. The visual reference does not override historical evidence.

## Sector source layout

Author these as independent scenes/collections:

- `core`
- `north`
- `south`
- `east`
- `west`
- `oasis`
- `outer-terrain`

Runtime outputs live under `public/assets/city/`.

## DCC workflow

Preferred authoring tool: Blender.

Each sector should be built from reusable modular architecture, then manually adjusted so repetition is not obvious.

Recommended collections:

- `BUILDINGS`
- `COURTYARD_WALLS`
- `ROOFS`
- `ROUTES`
- `PALMS`
- `AGRICULTURE`
- `LANDMARKS`
- `TERRAIN`

## Architecture language

Ordinary residential fabric should remain low-rise and use varied morphology:

- compact courtyard house
- L-shaped compound
- offset courtyard compound
- linear room cluster
- irregular multi-room compound

Variation must come from actual silhouette and block structure, not only color.

Use plausible material families:

- mud/clay wall
- basalt foundation
- palm timber
- palm-frond roofing where appropriate
- compacted earth

## Optimization contract

Before export:

- apply transforms
- remove hidden/duplicate geometry
- merge static meshes by compatible material where practical
- keep material count low
- avoid one object per metadata record
- keep landmarks separable when interaction requires it
- use LOD for distant sectors when needed
- export Y-up glTF/GLB consistently

## Historical integrity

Do not present uncertain parcel layouts as documented fact.

Named historical landmarks must retain confidence/source metadata outside the render asset. A visually plausible residential block is not automatically a historically exact reconstruction.

## Acceptance gate

A sector is not accepted merely because it loads.

Before merge it must be reviewed at:

1. high aerial view
2. medium aerial view
3. low aerial view
4. mobile viewport

Review questions:

- Does the silhouette approach the locked visual reference?
- Is the urban fabric continuous rather than scattered?
- Are alleys narrow and organically shaped?
- Is repetition visible?
- Are the oasis and agriculture spatially integrated?
- Does the scene still look like a procedural board or tabletop model?

If the answer to the final question is yes, the sector is not ready.
