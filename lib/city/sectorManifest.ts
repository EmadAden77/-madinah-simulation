export type CitySectorId =
  | 'core'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'oasis'
  | 'outer-terrain'

export type CitySectorLod = {
  distance: number
  asset: string
}

export type CitySectorDefinition = {
  id: CitySectorId
  labelAr: string
  labelEn: string
  asset: string
  bounds: readonly [number, number, number, number]
  loadingPriority: number
  historicalRegionIds: readonly string[]
  lods: readonly CitySectorLod[]
}

/**
 * Asset-driven city contract.
 *
 * Bounds are local simulation coordinates [minX, minZ, maxX, maxZ].
 * They are deliberately placeholders until authored GLB sectors are available.
 * Historical metadata remains separate from render geometry.
 */
export const CITY_SECTORS: readonly CitySectorDefinition[] = [
  {
    id: 'core',
    labelAr: 'قلب المدينة',
    labelEn: 'Urban Core',
    asset: '/assets/city/core.glb',
    bounds: [-220, -220, 220, 220],
    loadingPriority: 100,
    historicalRegionIds: ['prophets-mosque'],
    lods: [],
  },
  {
    id: 'north',
    labelAr: 'الشمال',
    labelEn: 'North',
    asset: '/assets/city/north.glb',
    bounds: [-420, -820, 420, -180],
    loadingPriority: 80,
    historicalRegionIds: [],
    lods: [],
  },
  {
    id: 'south',
    labelAr: 'الجنوب',
    labelEn: 'South',
    asset: '/assets/city/south.glb',
    bounds: [-420, 180, 420, 820],
    loadingPriority: 80,
    historicalRegionIds: [],
    lods: [],
  },
  {
    id: 'east',
    labelAr: 'الشرق',
    labelEn: 'East',
    asset: '/assets/city/east.glb',
    bounds: [180, -420, 820, 420],
    loadingPriority: 75,
    historicalRegionIds: [],
    lods: [],
  },
  {
    id: 'west',
    labelAr: 'الغرب',
    labelEn: 'West',
    asset: '/assets/city/west.glb',
    bounds: [-820, -420, -180, 420],
    loadingPriority: 75,
    historicalRegionIds: [],
    lods: [],
  },
  {
    id: 'oasis',
    labelAr: 'الواحة والبساتين',
    labelEn: 'Oasis',
    asset: '/assets/city/oasis.glb',
    bounds: [-1100, -1100, 1100, 1100],
    loadingPriority: 60,
    historicalRegionIds: [],
    lods: [],
  },
  {
    id: 'outer-terrain',
    labelAr: 'التضاريس الخارجية',
    labelEn: 'Outer Terrain',
    asset: '/assets/city/outer-terrain.glb',
    bounds: [-1800, -1800, 1800, 1800],
    loadingPriority: 40,
    historicalRegionIds: [],
    lods: [],
  },
] as const

export const citySectorById = Object.fromEntries(
  CITY_SECTORS.map((sector) => [sector.id, sector]),
) as Record<CitySectorId, CitySectorDefinition>
