# Asset Pipeline Tools

This folder is reserved for offline tooling used to prepare the authored 3D city before it reaches the browser.

Planned responsibilities:

- GLB validation
- mesh/material statistics
- geometry merging
- texture compression
- LOD generation/verification
- sector bounds validation
- metadata mapping checks

The browser runtime should load optimized assets; it should not rebuild the full city procedurally.
