// Deterministic authored-massing generator source note.
// The checked-in core.glb is the runtime asset.
// This file documents the design contract rather than generating geometry in-browser.

export const AUTHORED_CORE_SPEC = {
  seed: 622,
  target: 'dense low-rise historical urban core',
  houseFamilies: 5,
  runtimeProceduralGeneration: false,
  landmarkPolicy: 'Prophet Mosque remains separate historical landmark; current massing is schematic',
  referencePolicy: 'visual composition follows the locked project reference; historical data governs interpretation',
  optimizationPolicy: 'offline-authored GLB, static sector asset, no one-Object3D-per-house metadata model'
}
