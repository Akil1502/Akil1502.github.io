import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { armorUniforms, nanoDelay, NANO_D, NANO_F } from './armor'

// NANOTECH SUIT-UP: thousands of tiny hex plates stream out of the reactor and crawl over the helmet surface.
// All motion happens in the vertex shader from per-instance attributes, driven by the shared uReveal uniform
// (0 → 1.1). Each plate lands exactly where the solid armour then appears (same delay field as the plates).
const COLORS = { gold: '#e3a83c', red: '#b0121a', gun: '#3a3d45' }

// The swarm material is built independently of the helmet geometry so the scene can pre-compile its shader while
// the geometry is still being generated (no compile stall at the moment the suit-up starts).
export function makeNaniteMaterial() {
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.3, envMapIntensity: 1.5 })
  const uni = { uSource: { value: new THREE.Vector3(0, -2, 0) } }
  mat.userData.uni = uni
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, armorUniforms, uni)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aTarget; attribute vec3 aNormalT; attribute vec4 aRand;
uniform float uReveal; uniform vec3 uSource; uniform float uTime;
varying float vFly; varying float vHue;
mat3 rotAxis(vec3 a, float ang) {
  float s = sin(ang); float c = cos(ang); float oc = 1.0 - c;
  return mat3(oc*a.x*a.x + c, oc*a.x*a.y + a.z*s, oc*a.z*a.x - a.y*s,
              oc*a.x*a.y - a.z*s, oc*a.y*a.y + c, oc*a.y*a.z + a.x*s,
              oc*a.z*a.x + a.y*s, oc*a.y*a.z - a.x*s, oc*a.z*a.z + c);
}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `float nk = (uReveal - aRand.x * ${NANO_D.toFixed(3)}) / ${NANO_F.toFixed(3)};
float kk = clamp(nk, 0.0, 1.0);
float ke = kk * kk * (3.0 - 2.0 * kk);
vec3 nN = normalize(aNormalT);
vec3 refA = abs(nN.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
vec3 tT = normalize(cross(refA, nN));
vec3 bB = cross(tT, nN);
mat3 nanoRot = mat3(tT, nN, bB) * rotAxis(normalize(aRand.yzw - 0.5 + 0.001), (1.0 - ke) * (5.0 + aRand.y * 9.0));
vec3 objectNormal = nanoRot * vec3(normal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `float sc = smoothstep(0.0, 0.06, nk) * (1.0 - smoothstep(1.0, 1.1, nk));
vec3 P0 = uSource + (aRand.yzw - 0.5) * vec3(0.3, 0.1, 0.3);
vec3 P1 = P0 + vec3((aRand.z - 0.5) * 1.8, 0.8 + aRand.w * 0.7, (aRand.y - 0.5) * 1.3 + 0.45);
vec3 P2 = aTarget + nN * (0.35 + aRand.w * 0.25) + vec3(0.0, -0.5, 0.0);
vec3 P3 = aTarget + nN * 0.006;
float it = 1.0 - ke;
vec3 path = it*it*it*P0 + 3.0*it*it*ke*P1 + 3.0*it*ke*ke*P2 + ke*ke*ke*P3;
float mid = sin(3.14159 * kk);
path += vec3(sin(uTime * 3.1 + aRand.y * 20.0), cos(uTime * 2.7 + aRand.z * 17.0), sin(uTime * 2.3 + aRand.w * 13.0)) * 0.07 * mid;
vec3 transformed = nanoRot * (position * sc * (1.0 + mid * 0.5)) + path;
vFly = mid;
vHue = aRand.z;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFly; varying float vHue;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += mix(vec3(1.0, 0.55, 0.18), vec3(0.4, 0.85, 1.0), step(0.8, vHue)) * pow(vFly, 3.0) * 0.9;`,
      )
  }
  mat.customProgramCacheKey = () => 'nanites'
  return mat
}

let naniteMat = null
export const getNaniteMaterial = () => (naniteMat ||= makeNaniteMaterial()) // session cache (see getArmorMaterials)

export const naniteSize = (count) => 0.026 * Math.sqrt(5000 / count)

export default function Nanites({ geo, count = 5000, sourceRef, material }) {
  const mesh = useMemo(() => {
    // which plates feed the swarm, with their paint
    const parts = [
      [geo.mask, COLORS.gold],
      [geo.cheekR, COLORS.gold],
      [geo.cheekL, COLORS.gold],
      [geo.crown, COLORS.red],
      [geo.crest, COLORS.red],
      [geo.sideR, COLORS.red],
      [geo.sideL, COLORS.red],
      [geo.back, COLORS.red],
    ]
    const areas = parts.map(([g]) => triArea(g) * 0.5)
    const total = areas.reduce((a, b) => a + b, 0)
    const size = naniteSize(count)
    const hex = new THREE.CylinderGeometry(size, size, size * 0.32, 6, 1)
    const m = new THREE.InstancedMesh(hex, material, count)
    m.frustumCulled = false
    const aTarget = new Float32Array(count * 3)
    const aNormal = new Float32Array(count * 3)
    const aRand = new Float32Array(count * 4)
    const p = new THREE.Vector3()
    const n = new THREE.Vector3()
    const q = new THREE.Vector3()
    const col = new THREE.Color()
    let idx = 0
    parts.forEach(([g, c], pi) => {
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build()
      const want = pi === parts.length - 1 ? count - idx : Math.round((areas[pi] / total) * count)
      col.set(c)
      for (let k = 0; k < want && idx < count; k++) {
        let tries = 0
        do {
          sampler.sample(p, n)
          tries++
        } while (n.dot(q.copy(p).setY(p.y + 0.1)) < 0 && tries < 8) // keep outward-facing samples
        aTarget.set([p.x, p.y, p.z], idx * 3)
        aNormal.set([n.x, n.y, n.z], idx * 3)
        aRand.set([nanoDelay(p.x, p.y, p.z), Math.random(), Math.random(), Math.random()], idx * 4)
        m.setColorAt(idx, col)
        idx++
      }
    })
    hex.setAttribute('aTarget', new THREE.InstancedBufferAttribute(aTarget, 3))
    hex.setAttribute('aNormalT', new THREE.InstancedBufferAttribute(aNormal, 3))
    hex.setAttribute('aRand', new THREE.InstancedBufferAttribute(aRand, 4))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [geo, count, material])

  // the material is owned (and disposed) by the scene; only the per-geometry instance data lives here
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame(() => {
    const r = armorUniforms.uReveal.value
    // nothing in flight → skip drawing entirely
    mesh.visible = r > 0.001 && r < 1.1
    if (sourceRef?.current) material.userData.uni.uSource.value.copy(sourceRef.current)
  })

  return <primitive object={mesh} />
}

function triArea(g) {
  const pos = g.attributes.position
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let s = 0
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    s += b.sub(a).cross(c.sub(a)).length() * 0.5
  }
  return s
}
