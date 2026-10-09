// Armour materials + the NANOTECH reveal field shared by the solid plates and the nanite swarm.
// A plate fragment at helmet-space point p becomes solid when the swarm "lands" there:
//   landT(p) = delay(p) * D + F      (delay: 0 at the neck … 1 at the crown, with a little noise)
// uReveal runs 0 → 1.1. Nanite i flies during [delay·D, delay·D + F] — so the solid surface fills in exactly
// behind the arriving plates, and scrubbing uReveal backwards retracts the armour into the reactor.
import * as THREE from 'three'

export const NANO_D = 0.62
export const NANO_F = 0.38
export const Y0 = -1.18
export const Y1 = 1.08

export const armorUniforms = {
  uReveal: { value: 0 },
  uScanY: { value: -9 },
  uScanAmt: { value: 0 },
  uDiag: { value: 0 },
  uTime: { value: 0 },
  uHot: { value: new THREE.Color('#ffb347') },
  uCyan: { value: new THREE.Color('#7fe9ff') },
}

// JS twin of the GLSL delay() below (keep them identical).
export function nanoDelay(x, y, z) {
  const h = Math.min(1, Math.max(0, (y - Y0) / (Y1 - Y0)))
  const n = 0.5 + 0.5 * Math.sin(x * 9.1 + z * 4.3 + Math.sin(y * 7.7) * 1.3) * Math.cos(z * 6.1 - x * 3.7)
  return Math.min(1, Math.max(0, h * 0.84 + n * 0.16))
}

export const delayGLSL = /* glsl */ `
float nanoDelay(vec3 p) {
  float h = clamp((p.y - (${Y0.toFixed(3)})) / (${(Y1 - Y0).toFixed(3)}), 0.0, 1.0);
  float n = 0.5 + 0.5 * sin(p.x * 9.1 + p.z * 4.3 + sin(p.y * 7.7) * 1.3) * cos(p.z * 6.1 - p.x * 3.7);
  return clamp(h * 0.84 + n * 0.16, 0.0, 1.0);
}
`

// Patches a MeshStandard/Physical material: nanotech reveal (discard + hot forming edge), diagnostic scan band,
// and (optionally) glowing circuitry traces on the under-suit for the exploded view.
export function patchArmor(mat, { circuitry = false, key = 'armor' } = {}) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, armorUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHelm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHelm = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vHelm;
uniform float uReveal; uniform float uScanY; uniform float uScanAmt; uniform float uDiag; uniform float uTime;
uniform vec3 uHot; uniform vec3 uCyan;
${delayGLSL}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float nanoVis = uReveal - (nanoDelay(vHelm) * ${NANO_D.toFixed(3)} + ${NANO_F.toFixed(3)});
if (nanoVis < 0.0) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float nanoEdge = 1.0 - smoothstep(0.0, 0.07, nanoVis);
totalEmissiveRadiance += uHot * nanoEdge * nanoEdge * 3.2;
float scan = exp(-pow((vHelm.y - uScanY) * 16.0, 2.0)) * uScanAmt;
totalEmissiveRadiance += uCyan * scan * 1.6;
${
  circuitry
    ? `
vec3 q = vHelm * 9.0;
float gx = abs(fract(q.x + 0.5 * step(0.5, fract(q.y * 0.5))) - 0.5);
float gy = abs(fract(q.y) - 0.5);
float trace = (1.0 - smoothstep(0.0, 0.05, min(gx, gy))) * step(0.35, fract(sin(dot(floor(q.xy), vec2(12.9898, 78.233))) * 43758.5453));
float pulse = 0.55 + 0.45 * sin(uTime * 3.0 - vHelm.y * 6.0);
totalEmissiveRadiance += uCyan * trace * uDiag * pulse * 1.4;`
    : ''
}`,
      )
  }
  mat.customProgramCacheKey = () => key + (circuitry ? '-c' : '')
  return mat
}

export function makeArmorMaterials(tier) {
  const hi = tier !== 'low'
  const Phys = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  const red = new Phys({
    color: '#b0121a',
    metalness: 0.55,
    roughness: 0.3,
    envMapIntensity: 1.5,
    ...(hi ? { clearcoat: 1, clearcoatRoughness: 0.12 } : {}),
  })
  const gold = new Phys({
    color: '#d29b45',
    metalness: 1,
    roughness: 0.33,
    envMapIntensity: 1.2,
    ...(hi ? { clearcoat: 0.35, clearcoatRoughness: 0.25 } : {}),
  })
  const silver = new THREE.MeshStandardMaterial({ color: '#a9aeb8', metalness: 1, roughness: 0.26, envMapIntensity: 1.6 })
  const gunmetal = new THREE.MeshStandardMaterial({ color: '#2e3037', metalness: 0.95, roughness: 0.38, envMapIntensity: 1.3 })
  const under = new THREE.MeshStandardMaterial({ color: '#0c0c10', metalness: 0.75, roughness: 0.5, envMapIntensity: 0.6, emissive: '#000000' })
  // identical shader patches share one cache key, so red+gold (physical) and silver+gunmetal (standard) each
  // compile a single program instead of one per paint colour
  patchArmor(red)
  patchArmor(gold)
  patchArmor(silver)
  patchArmor(gunmetal)
  patchArmor(under, { circuitry: true })
  return { red, gold, silver, gunmetal, under }
}

// The armour + swarm materials are cached for the session (like the helmet geometry): their shader programs are
// the expensive part of the page, so a revisit of Home re-uses them instead of recompiling everything. They hold
// no per-mount state (all animation lives in the shared armorUniforms), so sharing them is safe.
const matCache = new Map()
export function getArmorMaterials(tier) {
  const key = tier === 'low' ? 'low' : 'hi'
  if (!matCache.has(key)) matCache.set(key, makeArmorMaterials(tier))
  return matCache.get(key)
}
