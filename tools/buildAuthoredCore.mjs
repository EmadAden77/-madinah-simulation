import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const OUT = resolve('public/assets/city/core.gltf')
const META = resolve('public/assets/city/core.meta.json')

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(622)
const range = (a, b) => a + (b - a) * rand()

const positions = new Float32Array([
  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,0.5,-0.5, -0.5,0.5,-0.5,
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5,0.5, 0.5, -0.5,0.5, 0.5,
])
const indices = new Uint16Array([
  0,1,2, 0,2,3, 4,6,5, 4,7,6,
  0,4,5, 0,5,1, 1,5,6, 1,6,2,
  2,6,7, 2,7,3, 3,7,4, 3,4,0,
])

const posBuffer = Buffer.from(positions.buffer)
const idxBuffer = Buffer.from(indices.buffer)
const pad = Buffer.alloc((4 - (posBuffer.length % 4)) % 4)
const binary = Buffer.concat([posBuffer, pad, idxBuffer])
const dataUri = `data:application/octet-stream;base64,${binary.toString('base64')}`
const idxOffset = posBuffer.length + pad.length

const nodes = []
const addBox = (name, mesh, x, y, z, sx, sy, sz, yaw = 0) => {
  nodes.push({
    name,
    mesh,
    translation: [x, z, y],
    scale: [sx, sz, sy],
    rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
  })
}

// Ground patch for the authored core sector.
addBox('core_ground', 2, 0, 0, -0.3, 430, 430, 0.6)

// Schematic mosque massing placeholder. Historical landmark detail stays separate.
const mosqueW = 42
const mosqueD = 36
addBox('mosque_n', 1, 0, mosqueD/2, 1.6, mosqueW, 1.1, 3.2)
addBox('mosque_s', 1, 0,-mosqueD/2, 1.6, mosqueW, 1.1, 3.2)
addBox('mosque_w', 1,-mosqueW/2,0, 1.6, 1.1, mosqueD, 3.2)
addBox('mosque_e', 1, mosqueW/2,0, 1.6, 1.1, mosqueD, 3.2)
addBox('mosque_roof_strip', 3, 0, mosqueD/2-4, 3.0, mosqueW-4, 7, 0.35)

let houseEquivalents = 0
let compoundParts = 0
const corridorCenters = [0.18*Math.PI, 0.72*Math.PI, 1.14*Math.PI, 1.58*Math.PI]

function angularDistance(a, b) {
  let d = (a - b + Math.PI) % (2*Math.PI)
  if (d < 0) d += 2*Math.PI
  return Math.abs(d - Math.PI)
}

for (let ring = 0; ring < 4; ring++) {
  const rMin = 34 + ring * 34
  const rMax = rMin + 26
  const n = 34 + ring * 12

  for (let i = 0; i < n; i++) {
    const theta = 2*Math.PI*i/n + range(-0.045,0.045)
    if (corridorCenters.some((c) => angularDistance(theta,c) < 0.045 + ring*0.008)) continue

    const r = range(rMin,rMax)
    const cx = r*Math.cos(theta)
    const cy = r*Math.sin(theta)
    const w = range(7.5,13.5)
    const d = range(6.5,12.5)
    const h = range(2.5,4.0)
    const yaw = theta + Math.PI/2 + range(-0.22,0.22)
    const family = Math.floor(rand()*5)
    const parts = []

    if (family === 0) {
      parts.push([0,-d/2+1.1,w,2.2,h],[0,d/2-1,w,2,h*0.96],[-w/2+1,0,2,d-3.8,h*0.9])
    } else if (family === 1) {
      parts.push([0,-d/2+1.1,w,2.2,h],[-w/2+1.1,0,2.2,d,h*0.94])
    } else if (family === 2) {
      parts.push([0,-d/2+1,w,2,h],[-w/2+1,0,2,d,h*0.92],[w*0.18,d/2-1,w*0.55,2,h*0.85])
    } else if (family === 3) {
      parts.push([0,-d/2+1.05,w,2.1,h],[-w*0.10,d/2-1,w*0.72,2,h*0.88])
    } else {
      parts.push([-w*0.12,-d/2+1,w*0.62,2,h],[w*0.23,d/2-1,w*0.42,2,h*0.9],[-w/2+1,-d*0.08,2,d*0.62,h*0.86],[w/2-1,d*0.16,2,d*0.38,h*0.8])
    }

    for (let j=0;j<parts.length;j++) {
      const [lx,ly,sx,sy,sz] = parts[j]
      const rx = lx*Math.cos(yaw) - ly*Math.sin(yaw)
      const ry = lx*Math.sin(yaw) + ly*Math.cos(yaw)
      addBox(`house_${houseEquivalents}_${j}`, (houseEquivalents+j)%3===0 ? 1 : 0, cx+rx, cy+ry, sz/2, sx, sy, sz, yaw)
      compoundParts++
    }
    houseEquivalents++
  }
}

// Break the outer silhouette so the core is not a perfect radial disk.
for (const side of [-1,1]) {
  for (let k=0;k<10;k++) {
    const x = side*range(130,190)
    const y = range(-150,150)
    const w = range(8,13)
    const d = range(7,11)
    const h = range(2.4,3.4)
    addBox(`edge_${side}_${k}`, 0, x, y, h/2, w, d, h, range(-0.5,0.5))
    houseEquivalents++
  }
}

const gltf = {
  asset: { version: '2.0', generator: 'Madinah Simulation authored-core offline compiler' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_,i)=>i) }],
  nodes,
  buffers: [{ byteLength: binary.length, uri: dataUri }],
  bufferViews: [
    { buffer:0, byteOffset:0, byteLength:posBuffer.length, target:34962 },
    { buffer:0, byteOffset:idxOffset, byteLength:idxBuffer.length, target:34963 },
  ],
  accessors: [
    { bufferView:0, componentType:5126, count:8, type:'VEC3', min:[-0.5,-0.5,-0.5], max:[0.5,0.5,0.5] },
    { bufferView:1, componentType:5123, count:indices.length, type:'SCALAR', min:[0], max:[7] },
  ],
  materials: [
    { name:'clay', pbrMetallicRoughness:{ baseColorFactor:[0.52,0.35,0.23,1], metallicFactor:0, roughnessFactor:0.95 } },
    { name:'deep_clay', pbrMetallicRoughness:{ baseColorFactor:[0.44,0.29,0.19,1], metallicFactor:0, roughnessFactor:0.97 } },
    { name:'ground', pbrMetallicRoughness:{ baseColorFactor:[0.58,0.45,0.29,1], metallicFactor:0, roughnessFactor:1 } },
    { name:'roof', pbrMetallicRoughness:{ baseColorFactor:[0.38,0.28,0.19,1], metallicFactor:0, roughnessFactor:0.96 } },
  ],
  meshes: [0,1,2,3].map((material) => ({ primitives:[{ attributes:{POSITION:0}, indices:1, material }] })),
}

await mkdir(dirname(OUT), { recursive:true })
await writeFile(OUT, JSON.stringify(gltf))
await writeFile(META, JSON.stringify({
  asset:'/assets/city/core.gltf',
  status:'authored-massing-v1',
  seed:622,
  houseEquivalents,
  compoundParts,
  historicalAccuracy:'Massing prototype only; not an exact parcel reconstruction.',
  landmarkNote:'Prophet Mosque geometry is schematic massing only and remains governed by separate historical data.',
  runtimeProceduralGeneration:false,
}, null, 2))

console.log(`Authored core written: ${OUT}`)
console.log({ houseEquivalents, compoundParts, nodeCount:nodes.length })
