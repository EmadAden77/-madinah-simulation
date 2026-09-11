'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl, { MercatorCoordinate } from 'maplibre-gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MADINAH_CENTER } from '@/lib/historicalData'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const CORE_ASSET = `${BASE_PATH}/assets/city/core.glb`

export default function AuthoredCityMap() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('جارٍ تحميل قلب المدينة المحرر…')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const map = new maplibregl.Map({
      container: host,
      center: MADINAH_CENTER,
      zoom: 15.8,
      pitch: 52,
      bearing: -18,
      minZoom: 13,
      maxZoom: 19.5,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#c7b38d' } },
        ],
      },
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left')

    const anchor = MercatorCoordinate.fromLngLat({ lng: MADINAH_CENTER[0], lat: MADINAH_CENTER[1] }, 0)
    const meterScale = anchor.meterInMercatorCoordinateUnits()

    let scene: THREE.Scene
    let camera: THREE.Camera
    let renderer: THREE.WebGLRenderer
    let core: THREE.Object3D | null = null

    const layer = {
      id: 'authored-core-3d',
      type: 'custom' as const,
      renderingMode: '3d' as const,
      onAdd(_map: maplibregl.Map, gl: WebGL2RenderingContext) {
        scene = new THREE.Scene()
        camera = new THREE.Camera()

        scene.add(new THREE.HemisphereLight(0xffe7c0, 0x4a4034, 2.15))
        const sun = new THREE.DirectionalLight(0xffd9a1, 2.85)
        sun.position.set(-160, 240, 110)
        scene.add(sun)

        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
        renderer.autoClear = false
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.0

        new GLTFLoader().load(
          CORE_ASSET,
          (gltf) => {
            core = gltf.scene
            core.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return
              object.frustumCulled = true
              object.castShadow = false
              object.receiveShadow = false
              object.matrixAutoUpdate = false
              object.updateMatrix()
            })
            scene.add(core)
            setStatus('قلب المدينة الحقيقي من Blender محمّل · حرّك وقرّب للمراجعة')
            map.triggerRepaint()
          },
          undefined,
          (error) => {
            console.error('Failed to load authored core sector', error)
            setStatus('تعذر تحميل core.glb')
          },
        )
      },
      render(args: { modelViewProjectionMatrix: Float32Array }) {
        const projection = new THREE.Matrix4().fromArray(Array.from(args.modelViewProjectionMatrix))
        const transform = new THREE.Matrix4()
          .makeTranslation(anchor.x, anchor.y, anchor.z)
          .scale(new THREE.Vector3(meterScale, -meterScale, meterScale))
        camera.projectionMatrix = projection.multiply(transform)
        renderer.resetState()
        renderer.render(scene, camera)
        map.triggerRepaint()
      },
      onRemove() {
        if (core) {
          core.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return
            object.geometry?.dispose()
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.forEach((material) => material?.dispose())
          })
        }
        renderer?.dispose()
      },
    }

    map.on('load', () => {
      map.addLayer(layer as any)
    })

    return () => map.remove()
  }, [])

  return (
    <main style={{ minHeight: '100dvh', background: '#17120e', color: '#f4eadc', direction: 'rtl', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.12)', background: 'rgba(23,18,14,.96)' }}>
        <strong style={{ display: 'block', fontSize: 18 }}>المدينة المنورة · معاينة القطاع الحقيقي على الخريطة</strong>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, opacity: .72 }}>{status}</span>
      </header>
      <div ref={hostRef} style={{ width: '100%', minHeight: 560, touchAction: 'none' }} aria-label="خريطة تفاعلية ثلاثية الأبعاد لقلب المدينة" />
    </main>
  )
}
