// Materials for the armoured chest. All armour materials share one patch (and therefore one shader program per
// material class): the radial nanotech reveal (discard + hot forming edge), the diagnostic scan band and the
// exploded-view offset (aExp) — so the whole suit is a handful of draw calls. The under-suit adds the cyan seam glow
// (energy pulsing outward from the reactor through every panel gap) and the circuitry traces for the exploded view.
import * as THREE from 'three'
import { armorUniforms } from '../three/armor.js'
import { chestDelayGLSL, NANO_D, NANO_F, REACTOR } from './chestField.js'

export const chestUniforms = {
  uExplode: { value: 0 },
  uPower: { value: 0 }, // seam glow (lamp strike × hover/blink flare)
  uRim: { value: 1 }, // silhouette rim (follows the stage's light level)
}

const R3 = `vec3(${REACTOR.map((v) => v.toFixed(3)).join(', ')})`

// The reactor's point light sits a hand's width in front of the chest: its irradiance on the plates round the
// socket is ~100× the key light, which bleached them white and drowned them in bloom. A soft knee on every point
// light's irradiance keeps the rim lights as they are (they sit well below the knee) and compresses only that
// near-field blow-out — the heart still lights the plates round it, but they stay red / gold and readable.
const kneeGLSL = /* glsl */ `
vec3 chestKnee(vec3 c) {
  float m = max(max(c.r, c.g), c.b);
  if (m <= 1.6) return c;
  float k = 1.6 + (m - 1.6) / (1.0 + (m - 1.6) / 1.4);
  return c * (k / m);
}`
const lightsKnee = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getPointLightInfo( pointLight, geometryPosition, directLight );',
  'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color = chestKnee( directLight.color );',
)

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
varying vec3 vObjN;
varying float vSeam;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vHelm = position;
vObjN = normal;
vSeam = aSeam;
float brth = 1.0 + 0.045 * sin(uTime * 1.6 + aExp.w * 6.2832) * uExplode;
transformed += aExp.xyz * uExplode * brth;`,
    )
}

function patchChest(mat, { under = false, gold = false, key }) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, armorUniforms, chestUniforms)
    vertPatch(shader)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vHelm;
varying vec3 vObjN;
varying float vSeam;
uniform float uReveal; uniform float uScanY; uniform float uScanAmt; uniform float uTime;
uniform float uExplode; uniform float uPower; uniform float uRim;
uniform vec3 uHot; uniform vec3 uCyan;
${gold ? 'uniform vec3 uGoldTint;' : ''}
float chestHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
${kneeGLSL}
${chestDelayGLSL}`,
      )
      .replace('#include <lights_fragment_begin>', lightsKnee)
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
    ? ''
    : `// product-shot rim: a thin fresnel line that traces the silhouette — warm on the left, cool on the right, gold
// from above — so the armour separates from the dark stage whichever way it turns
float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
vec3 rimC = mix(vec3(1.0, 0.32, 0.18), vec3(0.55, 0.9, 1.0), smoothstep(-0.5, 0.5, normal.x));
rimC = mix(rimC, vec3(1.0, 0.78, 0.42), smoothstep(0.2, 0.9, normal.y) * 0.6);
totalEmissiveRadiance += rimC * rimF * uRim * 0.55;`
}
${
  under
    ? `
// circuit traces (PCB style): every cell of a grid links its centre to the neighbours whose shared edge is "on"
// (hashed per edge, so a trace always continues into the next cell); dead ends get a round pad. Projected on the
// plane facing the surface; anti-aliased with fwidth.
vec2 q = (abs(vObjN.x) > abs(vObjN.z) ? vHelm.zy : vHelm.xy) * 11.0;
vec2 cc = floor(q);
vec2 f = fract(q) - 0.5;
float eR = step(0.5, chestHash(cc + vec2(0.5, 0.0)));
float eL = step(0.5, chestHash(cc - vec2(0.5, 0.0)));
float eU = step(0.5, chestHash(cc + vec2(0.0, 0.5)));
float eD = step(0.5, chestHash(cc - vec2(0.0, 0.5)));
float dT = 9.0;
dT = min(dT, mix(9.0, length(vec2(min(f.x, 0.0), f.y)), eR));
dT = min(dT, mix(9.0, length(vec2(max(f.x, 0.0), f.y)), eL));
dT = min(dT, mix(9.0, length(vec2(f.x, min(f.y, 0.0))), eU));
dT = min(dT, mix(9.0, length(vec2(f.x, max(f.y, 0.0))), eD));
float links = eR + eL + eU + eD;
float pad = links == 1.0 ? abs(length(f) - 0.13) : 9.0;
float aaT = fwidth(q.x) + fwidth(q.y);
float trace = 1.0 - smoothstep(0.045, 0.045 + aaT, min(dT, pad));
float tp = 0.55 + 0.45 * sin(uTime * 3.0 - rd * 6.0);
float forming = 1.0 - smoothstep(0.0, 0.22, nanoVis);
totalEmissiveRadiance += uCyan * trace * max(uExplode, forming * 0.8) * tp * 1.5;`
    : ''
}`,
      )
    if (gold) {
      shader.uniforms.uGoldTint = mat.userData.goldTint
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <aomap_fragment>',
        `{
  float gLum = dot(reflectedLight.directSpecular, vec3(0.2126, 0.7152, 0.0722));
  reflectedLight.directSpecular = mix(reflectedLight.directSpecular, gLum * uGoldTint, 0.85);
}
#include <aomap_fragment>`,
      )
    }
  }
  if (gold) {
    const c = mat.color // linear working space
    const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
    mat.userData.goldTint = { value: new THREE.Vector3(c.r / lum, c.g / lum, c.b / lum) }
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
// a short hop out of the reactor face, then a skim just above the body to the landing point: the swarm reads as a
// sheet of plates flowing outwards over the chest (not a cloud thrown at the camera)
vec3 P0 = uSource + (aRand.yzw - 0.5) * vec3(0.1, 0.1, 0.03);
vec3 P1 = uSource + dT * (0.14 + aRand.w * 0.16) + vec3(0.0, 0.0, 0.16 + aRand.y * 0.14);
vec3 P2 = aTarget + nN * (0.08 + aRand.w * 0.1) + dT * 0.04;
vec3 P3 = aTarget + nN * 0.006;
float it = 1.0 - ke;
vec3 path = it*it*it*P0 + 3.0*it*it*ke*P1 + 3.0*it*ke*ke*P2 + ke*ke*ke*P3;
float mid = sin(3.14159 * kk);
path += vec3(sin(uTime * 3.1 + aRand.y * 20.0), cos(uTime * 2.7 + aRand.z * 17.0), sin(uTime * 2.3 + aRand.w * 13.0)) * 0.025 * mid;
vec3 transformed = nanoRot * (position * sc * (1.0 + mid * 0.25)) + path;
vFly = mid;
vHue = aRand.z;`,
      )
    // (the same soft knee as the plates: the nanites hop out right next to the reactor's point light, which would
    // otherwise blow the fresh swarm out into a white blob)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vFly; varying float vHue;\n${kneeGLSL}`)
      .replace('#include <lights_fragment_begin>', lightsKnee)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += mix(vec3(1.0, 0.55, 0.18), vec3(0.4, 0.85, 1.0), step(0.72, vHue)) * pow(vFly, 3.0) * 0.32;`,
      )
  }
  mat.customProgramCacheKey = () => 'chest-nanites'
  return mat
}

function makeChestMaterials(tier) {
  const hi = tier !== 'low'
  const Phys = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  const cc = (c, r) => (hi ? { clearcoat: c, clearcoatRoughness: r } : {})
  // candy-apple red: a deep metallic red base under a mirror-glossy lacquer
  const red = new Phys({ color: '#a50b15', metalness: 0.7, roughness: 0.3, envMapIntensity: 1.45, ...cc(1, 0.05) })
  // polished gold
  const gold = new Phys({ color: '#d39a47', metalness: 1, roughness: 0.3, envMapIntensity: 1.08, ...cc(0.3, 0.14) })
  // dark titanium gunmetal (collarbones, lat slats, belt, gorget)
  const gun = new Phys({ color: '#4c515b', metalness: 0.94, roughness: 0.26, envMapIntensity: 1.35, ...cc(0.4, 0.18) })
  // turned chrome (socket lip, bolts)
  const chrome = new Phys({ color: '#c9ced6', metalness: 1, roughness: 0.14, envMapIntensity: 1.7, ...cc(0.2, 0.1) })
  // the under-suit: dark gunmetal, seen only in the panel gaps (its circuitry lights up in the suit-up / diagnostic)
  const under = new THREE.MeshStandardMaterial({ color: '#16181d', metalness: 0.8, roughness: 0.42, envMapIntensity: 0.7 })
  const key = hi ? 'chest-armor-hi' : 'chest-armor-lo'
  for (const m of [red, gun, chrome]) patchChest(m, { key })
  patchChest(gold, { gold: true, key: key + '-gold' })
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
