# Master City Visual Reference

## Purpose

The uploaded reference video and SirahMaps-style authored 3D environments define the visual target for the Madinah simulation.

The project must not rely on runtime procedural city generation for final city form. The city should be authored as optimized 3D sectors, then loaded and interacted with in Three.js/MapLibre.

## Locked visual goals

- Dense, continuous low-rise urban mass.
- Clear central core around the Prophet's Mosque.
- Irregular neighborhoods with narrow maze-like alleys.
- Organic, non-grid street fabric.
- Distinct house morphologies: rectangular, L-shaped, rounded/oval compounds, courtyard compounds, irregular wall lines.
- Oasis agriculture and palm groves wrapping and penetrating the settlement edge.
- Natural transition from city to cultivated land, wadis, basaltic terrain, and open earth.
- No visible engine-sector boundaries.
- No giant placeholder slabs, debug towers, or modern-looking roads.

## Historical rule

The reference controls visual composition only. Historical placement, names, confidence, and relationships must come from the project's historical data and cited source material.

Uncertain historical locations must remain explicitly marked as approximate.

## Rendering rule

The browser is a renderer and interaction layer, not the final city modeller.

Final city sectors should be exported as optimized GLB assets with:

- merged static geometry,
- low material count,
- LOD-ready structure,
- predictable bounds,
- historical metadata mapped separately from render nodes.

## Initial sector contract

- core
- north
- south
- east
- west
- oasis
- outer-terrain

The engine may subdivide sectors later for streaming, but the visible settlement must read as one continuous city.
