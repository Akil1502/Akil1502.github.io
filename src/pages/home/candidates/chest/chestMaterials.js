// Materials for the armoured chest. All armour materials share one patch (and therefore one shader program per
// material class): the radial nanotech reveal (discard + hot forming edge), the diagnostic scan band and the
// exploded-view offset (aExp) — so the whole suit is a handful of draw calls. The under-suit adds the cyan seam glow
// (energy pulsing outward from the reactor through every panel gap) and the circuitry traces for the exploded view.
import * as THREE from 'three'
import { armorUniforms } from '../../three/armor.js'
import { chestDelayGLSL, NANO_D, NANO_F, REACTOR } from './chestField.js'

export const chestUniforms = {
  uExplode: { value: 0 },
  uPower: { value: 0 }, // seam glow (lamp strike × hover/blink flare)
}

const R3 = `vec3(${REACTOR.map((v) => v.toFixed(3)).join(', ')})`

const vertPatch = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
attribute vec4 aExp;
attribute float aSeam;
uniform float uExplode;
uniform float uTime;
varying vec3 vHelm;
varying float vSeam;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vHelm = position;
vSeam = aSeam;
float brth = 1.0 + 0.045 * sin(uTime * 1.6 + aExp.w * 6.2832) * uExplode;
transformed += aExp.xyz * uExplode * brth;`,
    )
}

function patchChest(mat, { under = false, key }) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, armorUniforms, chestUniforms)
    vertPatch(shader)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vHelm;
varying float vSeam;
uniform float uReveal; uniform float uScanY; uniform float uScanAmt; uniform float uTime;
uniform float uExplode; uniform float uPower;
uniform vec3 uHot; uniform vec3 uCyan;
${chestDelayGLSL}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float nanoVis = uReveal - (chestDelay(vHelm) * ${NANO_D.toFixed(3)} + ${NANO_F.toFixed(3)});
if (nanoVis < 0.0) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float nanoEdge = 1.0 - smoothstep(0.0, 0.07, nanoVis);
totalEmissiveRadiance += uHot * nanoEdge * nanoEdge * 3.2;
float scan = exp(-pow((vHelm.y - uScanY) * 16.0, 2.0)) * uScanAmt;
totalEmissiveRadiance += uCyan * scan * 1.6;
// seam light: plate side walls (only visible inside the panel gaps) glow, pulsing outward from the reactor
float rd = length((vHelm - ${R3}) * vec3(1.0, 0.92, 0.6));
float pulse = 0.55 + 0.45 * sin(uTime * 2.3 - rd * 8.0);
totalEmissiveRadiance += uCyan * vSeam * uPower * (1.0 - 0.7 * uExplode) * pulse * (1.5 - 1.15 * smoothstep(0.15, 1.35, rd)) * 1.15;
${
  under
    ? `
vec3 q = vHelm * 10.0;
float gx = abs(fract(q.x + 0.5 * step(0.5, fract(q.y * 0.5))) - 0.5);
float gy = abs(fract(q.y) - 0.5);
float trace = (1.0 - smoothstep(0.0, 0.055, min(gx, gy))) * step(0.35, fract(sin(dot(floor(q.xy), vec2(12.9898, 78.233))) * 43758.5453));
float tp = 0.55 + 0.45 * sin(uTime * 3.0 - rd * 6.0);
totalEmissiveRadiance += uCyan * trace * uExplode * tp * 1.5;`
    : ''
}`,
      )
  }
  mat.customProgramCacheKey = () => key
  return mat
}

// unlit glow parts (vent slits, socket ring, neck seal): dark glass when off, hot cyan-white when powered
function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...armorUniforms,
      ...chestUniforms,
      uLevel: { value: 0 },
      uColor: { value: new THREE.Color('#9ff4ff') },
    },
    vertexShader: /* glsl */ `
attribute vec4 aExp;
uniform float uExplode; uniform float uTime;
varying vec3 vHelm;
void main() {
  vHelm = position;
  vec3 p = position + aExp.xyz * uExplode * (1.0 + 0.045 * sin(uTime * 1.6 + aExp.w * 6.2832) * uExplode);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uReveal; uniform float uLevel; uniform vec3 uColor;
varying vec3 vHelm;
${chestDelayGLSL}
void main() {
  float nv = uReveal - (chestDelay(vHelm) * ${NANO_D.toFixed(3)} + ${NANO_F.toFixed(3)});
  if (nv < 0.0) discard;
  vec3 col = vec3(0.012, 0.018, 0.026) + uColor * uLevel;
  gl_FragColor = vec4(col, 1.0);
}`,
    toneMapped: false,
  })
}

// NANOTECH swarm with a radial path: plates burst forward out of the reactor face, fan out and settle onto their
// target from the surface normal. Motion lives entirely in the vertex shader (instanced attributes).
function makeNaniteMaterial() {
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.3, envMapIntensity: 1.5 })
  const uni = { uSource: { value: new THREE.Vector3(0, 0.32, 0) } }
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
vec3 toT = aTarget - uSource;
vec3 dT = normalize(toT + vec3(0.0, 0.0, 0.001));
vec3 P0 = uSource + (aRand.yzw - 0.5) * vec3(0.12, 0.12, 0.04);
vec3 P1 = uSource + dT * (0.18 + aRand.w * 0.22) + vec3((aRand.z - 0.5) * 0.3, (aRand.y - 0.5) * 0.3, 0.55 + aRand.y * 0.45);
vec3 P2 = aTarget + nN * (0.32 + aRand.w * 0.28) + vec3(0.0, 0.0, 0.12);
vec3 P3 = aTarget + nN * 0.006;
float it = 1.0 - ke;
vec3 path = it*it*it*P0 + 3.0*it*it*ke*P1 + 3.0*it*ke*ke*P2 + ke*ke*ke*P3;
float mid = sin(3.14159 * kk);
path += vec3(sin(uTime * 3.1 + aRand.y * 20.0), cos(uTime * 2.7 + aRand.z * 17.0), sin(uTime * 2.3 + aRand.w * 13.0)) * 0.06 * mid;
vec3 transformed = nanoRot * (position * sc * (1.0 + mid * 0.6)) + path;
vFly = mid;
vHue = aRand.z;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFly; varying float vHue;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += mix(vec3(1.0, 0.55, 0.18), vec3(0.4, 0.85, 1.0), step(0.72, vHue)) * pow(vFly, 3.0) * 1.1;`,
      )
  }
  mat.customProgramCacheKey = () => 'chest-nanites'
  return mat
}

function makeChestMaterials(tier) {
  const hi = tier !== 'low'
  const Phys = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  const cc = (c, r) => (hi ? { clearcoat: c, clearcoatRoughness: r } : {})
  // candy-apple red: metallic base under a glossy lacquer
  const red = new Phys({ color: '#9e0d14', metalness: 0.62, roughness: 0.32, envMapIntensity: 1.55, ...cc(1, 0.06) })
  // gold titanium: warm, slightly brushed
  const gold = new Phys({ color: '#d08c38', metalness: 1, roughness: 0.27, envMapIntensity: 1.35, ...cc(0.45, 0.16) })
  // gunmetal under-structure
  const gun = new Phys({ color: '#4b4f57', metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35, ...cc(0.3, 0.25) })
  // turned chrome (bezel ring, bolts)
  const chrome = new Phys({ color: '#c3c8d0', metalness: 1, roughness: 0.16, envMapIntensity: 1.8, ...cc(0.2, 0.1) })
  const under = new THREE.MeshStandardMaterial({ color: '#0a0b0e', metalness: 0.7, roughness: 0.55, envMapIntensity: 0.55 })
  const key = hi ? 'chest-armor-hi' : 'chest-armor-lo'
  for (const m of [red, gold, gun, chrome]) patchChest(m, { key })
  patchChest(under, { under: true, key: 'chest-under' })
  return { red, gold, gun, chrome, under, glow: makeGlowMaterial(), nanites: makeNaniteMaterial() }
}

// Session cache (like the shared armour materials): compiled programs survive a round trip to another page.
const cache = new Map()
export function getChestMaterials(tier) {
  const k = tier === 'low' ? 'low' : 'hi'
  if (!cache.has(k)) cache.set(k, makeChestMaterials(tier))
  return cache.get(k)
}
