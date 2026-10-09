import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COL, CX, CZ, GROUND_W, GROUND_D, GROUND_Z0, groundHeight, rng, tmpObj } from './gammaConst'
import { gamma } from '../store'

// THE CRACKED GAMMA GROUND — the page's centrepiece.
//  · a faceted (flat-shaded) basalt slab baked from groundHeight(): impact crater, heaved rim, rubble, fault steps
//  · fissure shader (MeshStandardMaterial + onBeforeCompile): jagged Voronoi crack network + radial cracks from
//    the crater, glowing gamma green from inside, pulsing outward; cracks only light up inside uCrackR (they spread
//    with every SMASH), a molten gamma pool in the crater floor
//  · instanced heaved rock shards around the rim (flat-shaded slabs, green light leaking from underneath)
//  · shockwaves (up to 4 at once, uniform bus): the ground ripples, a ring of light runs through the cracks and every
//    shard in its path jumps and settles — all in the vertex shader, zero CPU per frame.

const SHOCKS = 4
// Shared uniform objects: ground + shards read the same values, the scene writes them through `groundBus`.
export const groundBus = {
  uTime: { value: 0 },
  uGlow: { value: 1 },
  uCrackR: { value: 0 },
  uFlare: { value: 0 },
  uShock: { value: Array.from({ length: SHOCKS }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uCenter: { value: new THREE.Vector2(CX, CZ) },
  uGreen: { value: new THREE.Color(COL.green) },
  uPurple: { value: new THREE.Color(COL.purpleHi) },
  next: 0,
}
// fire a shockwave at (x, z) in ground-group space
export function fireShock(x, z, power = 1) {
  const s = groundBus.uShock.value[groundBus.next]
  groundBus.next = (groundBus.next + 1) % SHOCKS
  s.set(x, z, groundBus.uTime.value, power)
}

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform float uCrackR;
uniform float uFlare;
uniform vec4 uShock[${SHOCKS}];
uniform vec2 uCenter;
uniform vec3 uGreen;
uniform vec3 uPurple;
// travelling shockwave front: returns the ring intensity at distance d for every live shock
float shockAt(vec2 p, float speed, float width, float decay) {
  float acc = 0.0;
  for (int i = 0; i < ${SHOCKS}; i++) {
    vec4 s = uShock[i];
    float age = uTime - s.z;
    if (age > 0.0 && age < 3.0) {
      float d = distance(p, s.xy);
      float k = (d - age * speed) * width;
      acc += s.w * exp(-k * k) * exp(-age * decay);
    }
  }
  return acc;
}
`

const VORONOI = /* glsl */ `
vec2 gHash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float gHash21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
// x = F2 - F1 (distance to the nearest cell border, cheap), yz = id of the nearest cell
vec3 gVoro(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = gHash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = n + g; }
    else if (d < f2) { f2 = d; }
  }
  return vec3(sqrt(f2) - sqrt(f1), id);
}
`

function makeGroundMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: COL.rock,
    roughness: 0.92,
    metalness: 0.08,
    flatShading: true,
    envMapIntensity: 0.55,
  })
  mat.onBeforeCompile = (shader) => {
    for (const k of ['uTime', 'uGlow', 'uCrackR', 'uFlare', 'uShock', 'uCenter', 'uGreen', 'uPurple']) shader.uniforms[k] = groundBus[k]
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\nvarying vec3 vGPos;\nvarying float vRip;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGPos = transformed;
        // the ground heaves as a shockwave front passes
        float rip = shockAt(transformed.xz, 8.5, 1.15, 1.7);
        transformed.y += rip * 0.32;
        vRip = rip;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}\n${VORONOI}\nvarying vec3 vGPos;\nvarying float vRip;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vGPos.xz;
          vec2 dc = p - uCenter;
          float r = length(dc);
          float ang = atan(dc.y, dc.x);
          // jagged domain warp so no crack is ever a clean curve
          vec2 w = p + 0.32 * vec2(sin(p.y * 1.9 + sin(p.x * 0.8)), sin(p.x * 2.1 + 1.3)) + 0.08 * vec2(sin(p.y * 7.3), sin(p.x * 6.1));
          // shattered near the impact, larger plates far away
          float near = 1.0 - smoothstep(1.5, 9.0, r);
          vec3 vA = gVoro(w * mix(0.85, 1.9, near));
          float lw = mix(0.035, 0.085, near);
          float cell = 1.0 - smoothstep(0.0, lw, vA.x);
          float hotCell = 0.35 + 0.65 * gHash21(vA.yz);
          // radial fissures from the crater (perpendicular distance to the nearest radial line)
          float aw = ang + 0.22 * sin(ang * 3.0 + 1.7) + 0.18 * sin(r * 1.35 + ang * 2.0) + 0.05 * sin(r * 6.0);
          float rl = abs(sin(aw * 4.5)) * r / 4.5;
          float radial = (1.0 - smoothstep(0.0, 0.06 + 0.014 * r, rl)) * (1.0 - smoothstep(5.0, 15.0, r)) * smoothstep(0.6, 1.4, r);
          float crack = max(cell * hotCell, radial * 1.25);
          // the crack network only lights up where it has spread to (uCrackR grows with every smash)
          float spread = 1.0 - smoothstep(uCrackR - 2.2, uCrackR, r);
          // energy pulses travel outward along the fissures
          float flow = 0.62 + 0.38 * sin(uTime * 1.6 - r * 1.25 + vA.y * 2.1);
          float heat = 1.55 * exp(-r * 0.2) + 0.18;
          float ring = shockAt(p, 8.5, 0.9, 1.25);
          vec3 tint = mix(uGreen, uPurple, smoothstep(6.0, 15.0, r) * 0.75);
          float lit = crack * (spread * heat * flow * uGlow * (1.0 + uFlare * 1.6) + ring * 2.6);
          // molten gamma pool in the crater floor, ringed by a hexagon burned into the rock
          float pool = (1.0 - smoothstep(0.0, 0.85, r)) * (0.75 + 0.25 * sin(uTime * 2.6 + r * 4.0)) * min(1.0, uCrackR) * uGlow;
          vec2 hq = abs(dc);
          float hexd = max(hq.x * 0.5 + hq.y * 0.866025, hq.x);
          float hexLine = (1.0 - smoothstep(0.0, 0.06, abs(hexd - 1.12))) + 0.5 * (1.0 - smoothstep(0.0, 0.035, abs(hexd - 1.32)));
          pool += hexLine * smoothstep(0.5, 2.5, uCrackR) * (0.85 + 0.15 * sin(uTime * 4.0)) * uGlow * 0.9;
          // per-plate rock tone, darker inside the fissures, scorched near the impact
          diffuseColor.rgb *= (0.7 + 0.6 * gHash21(vA.yz + 3.1)) * (1.0 - crack * 0.85) * (0.75 + 0.25 * smoothstep(0.5, 4.0, r));
          diffuseColor.rgb += uGreen * 0.015 * near;
          totalEmissiveRadiance += tint * lit * 1.35 + uGreen * pool * (1.6 + uFlare * 2.0) + uGreen * vRip * 0.08;
        }`,
      )
  }
  mat.customProgramCacheKey = () => 'gamma-ground-v1'
  return mat
}

function makeShardMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: '#1a221a',
    roughness: 0.78,
    metalness: 0.12,
    flatShading: true,
    envMapIntensity: 0.7,
  })
  mat.onBeforeCompile = (shader) => {
    for (const k of ['uTime', 'uGlow', 'uCrackR', 'uFlare', 'uShock', 'uCenter', 'uGreen', 'uPurple']) shader.uniforms[k] = groundBus[k]
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\nattribute float aHeat;\nattribute float aSeed;\nvarying float vLocalY;\nvarying float vHeat;\nvarying float vLift;\nvarying float vR;`)
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec2 ic = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ic = vec2(0.0);
        #endif
        // SMASH: every shard in a shockwave's path jumps (with a little tumble) and settles
        float lift = shockAt(ic, 8.5, 1.05, 1.9);
        vLift = lift;
        mvPosition.y += lift * (0.55 + 0.5 * aSeed) + lift * (transformed.x * 0.9 - transformed.z * 0.5) * (aSeed - 0.5);
        // idle: plates near the crater tremble faintly in the gamma field
        mvPosition.y += sin(uTime * 9.0 + aSeed * 40.0) * 0.006 * aHeat * uGlow;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        vLocalY = position.y;
        vHeat = aHeat;
        vR = distance(ic, uCenter);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}\nvarying float vLocalY;\nvarying float vHeat;\nvarying float vLift;\nvarying float vR;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // gamma light leaking out from under each heaved plate
          float under = smoothstep(0.03, -0.17, vLocalY);
          float spread = 1.0 - smoothstep(uCrackR - 2.0, uCrackR, vR);
          float flow = 0.7 + 0.3 * sin(uTime * 1.6 - vR * 1.25);
          totalEmissiveRadiance += uGreen * under * vHeat * spread * flow * uGlow * (1.5 + uFlare * 2.0);
          totalEmissiveRadiance += uGreen * min(vLift, 1.5) * (0.35 + under) * 1.2;
        }`,
      )
  }
  mat.customProgramCacheKey = () => 'gamma-shard-v1'
  return mat
}

// An irregular slab: a 7-sided prism with every corner pushed around (keyed on position so shared corners stay
// welded), then flat-shaded so each face catches light like broken basalt.
function makeShardGeometry(seed) {
  const g = new THREE.CylinderGeometry(0.5, 0.6, 0.3, 7, 1)
  const pos = g.attributes.position
  const r = (x, y, z, k) => {
    const s = Math.sin(x * 91.7 + y * 47.3 + z * 23.9 + seed * 13.1 + k * 7.7) * 43758.5453
    return s - Math.floor(s)
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const kx = Math.round(x * 1000) / 1000
    const kz = Math.round(z * 1000) / 1000
    const s = 0.7 + 0.55 * r(kx, 0, kz, 1)
    pos.setXYZ(i, x * s, y + (r(kx, y, kz, 2) - 0.5) * 0.12, z * s)
  }
  g.computeVertexNormals()
  return g
}

export default function GammaGround({ tier }) {
  const seg = tier === 'high' ? [150, 130] : tier === 'medium' ? [104, 90] : [72, 62]
  const shardN = tier === 'high' ? 720 : tier === 'medium' ? 360 : 180
  const groundMat = useMemo(makeGroundMaterial, [])
  const shardMat = useMemo(makeShardMaterial, [])
  const shards = useRef()
  // the uniform bus is module-level: start every visit with unbroken ground and no live shocks
  useLayoutEffect(() => {
    groundBus.uCrackR.value = 0
    groundBus.uFlare.value = 0
    groundBus.uShock.value.forEach((v) => v.set(0, 0, -100, 0))
  }, [])

  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(GROUND_W, GROUND_D, seg[0], seg[1])
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, GROUND_Z0 - GROUND_D / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()
    return g
  }, [seg[0], seg[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  const shardGeo = useMemo(() => {
    const g = makeShardGeometry(3)
    const r = rng(77)
    const heat = new Float32Array(shardN)
    const seed = new Float32Array(shardN)
    for (let i = 0; i < shardN; i++) {
      seed[i] = r()
      heat[i] = 0
    }
    g.setAttribute('aHeat', new THREE.InstancedBufferAttribute(heat, 1))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    return g
  }, [shardN])

  // heaved plates: dense on the crater rim, tilted so their inner edge rises; smaller and flatter further out
  useLayoutEffect(() => {
    const im = shards.current
    if (!im) return
    const r = rng(311 + shardN)
    const heat = shardGeo.attributes.aHeat.array
    const up = new THREE.Vector3(0, 1, 0)
    const axis = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const qy = new THREE.Quaternion()
    for (let i = 0; i < shardN; i++) {
      // radius distribution: a band on the rim plus a long tail
      const u = r()
      const rad = u < 0.3 ? 2.2 + r() * 1.6 : 3.0 + Math.pow(r(), 1.4) * 12.5
      const a = r() * Math.PI * 2
      const x = CX + Math.cos(a) * rad * 1.08
      const z = CZ + Math.sin(a) * rad * 0.92
      if (z > GROUND_Z0 - 0.5) {
        tmpObj.position.set(0, -50, 0)
        tmpObj.scale.setScalar(0.0001)
        tmpObj.updateMatrix()
        im.setMatrixAt(i, tmpObj.matrix)
        continue
      }
      const nearRim = Math.exp(-((rad - 2.6) / 1.6) * ((rad - 2.6) / 1.6))
      const tilt = 0.06 + 0.85 * nearRim + r() * 0.2
      // tangent axis → the inner edge lifts (crust heaved up and away from the impact)
      axis.set(-Math.sin(a), 0, Math.cos(a)).normalize()
      q.setFromAxisAngle(axis, -tilt)
      qy.setFromAxisAngle(up, r() * Math.PI * 2)
      tmpObj.quaternion.copy(q).multiply(qy)
      const big = 0.3 + nearRim * 0.7 + r() * 0.4
      const sc = big * (rad > 9 ? 0.7 : 1)
      tmpObj.scale.set(sc * (0.8 + r() * 0.6), sc * (0.6 + r() * 0.9), sc * (0.8 + r() * 0.6))
      tmpObj.position.set(x, groundHeight(x, z) - 0.04 + tilt * 0.12 * sc, z)
      tmpObj.updateMatrix()
      im.setMatrixAt(i, tmpObj.matrix)
      heat[i] = Math.min(1, 1.35 * Math.exp(-rad * 0.16))
    }
    im.instanceMatrix.needsUpdate = true
    shardGeo.attributes.aHeat.needsUpdate = true
    im.computeBoundingSphere()
  }, [shardN, shardGeo])

  // hand-made GPU resources leave with the page (R3F only disposes what it created from JSX)
  useEffect(() => () => [groundMat, shardMat].forEach((m) => m.dispose()), [groundMat, shardMat])
  useEffect(() => () => groundGeo.dispose(), [groundGeo])
  useEffect(() => () => shardGeo.dispose(), [shardGeo])

  useFrame((state, dt) => {
    groundBus.uTime.value = state.clock.elapsedTime
    // flare decays (raised by smashes), crack radius eases towards the spread the DOM has earned
    groundBus.uFlare.value = Math.max(0, groundBus.uFlare.value - Math.min(dt, 0.05) * 1.6)
    const targetR = 1.2 + gamma.crack * 15
    const cr = groundBus.uCrackR
    cr.value += (targetR - cr.value) * (1 - Math.pow(0.08, Math.min(dt, 0.05)))
  })

  return (
    <group>
      <mesh geometry={groundGeo} material={groundMat} frustumCulled={false} />
      <instancedMesh ref={shards} args={[shardGeo, shardMat, shardN]} frustumCulled={false} />
    </group>
  )
}
