'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function AuthoredCorePreview() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('جارٍ تحميل قلب المدينة…')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x15110d)
    scene.fog = new THREE.FogExp2(0x15110d, 0.00145)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2200)
    camera.position.set(285, 260, 315)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = false
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 70
    controls.maxDistance = 820
    controls.maxPolarAngle = Math.PI * 0.49

    scene.add(new THREE.HemisphereLight(0xffe6be, 0x3b332b, 2.2))
    const sun = new THREE.DirectionalLight(0xffd8a1, 3.1)
    sun.position.set(-180, 260, 120)
    scene.add(sun)

    const loader = new GLTFLoader()
    let core: THREE.Object3D | null = null
    let disposed = false

    loader.load(
      '/assets/city/core.gltf',
      (gltf) => {
        if (disposed) return
        core = gltf.scene
        core.rotation.x = 0
        core.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.frustumCulled = true
          object.matrixAutoUpdate = false
          object.updateMatrix()
        })
        scene.add(core)

        const bounds = new THREE.Box3().setFromObject(core)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        controls.target.copy(center)
        const span = Math.max(size.x, size.z)
        camera.position.set(center.x + span * 0.72, Math.max(190, span * 0.58), center.z + span * 0.82)
        camera.lookAt(center)
        controls.update()
        setStatus('قلب المدينة المحرر جاهز · اسحب للدوران وقرّب بإصبعين')
      },
      undefined,
      (error) => {
        console.error('Failed to load authored core sector', error)
        if (!disposed) setStatus('تعذر تحميل core.gltf')
      },
    )

    const resize = () => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let raf = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    render()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      if (core) {
        core.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry?.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material?.dispose())
        })
      }
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <main style={{ minHeight: '100dvh', background: '#15110d', color: '#f4eadc', direction: 'rtl', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.12)', background: 'rgba(21,17,13,.94)' }}>
        <strong style={{ display: 'block', fontSize: 18 }}>معاينة قلب المدينة · Authored Core</strong>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, opacity: .72 }}>{status}</span>
      </header>
      <div ref={hostRef} style={{ minHeight: 520, width: '100%', touchAction: 'none' }} aria-label="معاينة ثلاثية الأبعاد لقلب المدينة" />
    </main>
  )
}
