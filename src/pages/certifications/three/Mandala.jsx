import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/*
 * A procedural spell mandala drawn entirely in a fragment shader (no textures): double outer rings, a rotating band
 * of rune glyphs (each cell picks 2–3 strokes from a hash), two counter-rotating squares forming an eight-point
 * star, a ticked inner dial, radial spokes and a hot core. Sparks crawl round the rim. Everything is additive and
 * bloom-friendly. `uReveal` (0..1) draws the circle in by sweeping the angle, so a spell can be "cast".
 *
 * Control it through the mesh ref: mesh.material.uniforms.{uIntensity,uReveal,uColor,uHot,uRot} and
 * mesh.userData.speed (rad/s the band turns; squares counter-rotate, the dial turns at 0.7x).
 */
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uRot;
  uniform float uIntensity;
  uniform float uReveal;
  uniform float uSeed;
  uniform float uCells;
  uniform float uDetail;
  uniform vec3 uColor;
  uniform vec3 uHot;
  varying vec2 vUv;
  #define TAU 6.28318530718
  #define PI 3.14159265359

  float hash1(float n) { return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }
  float lineW(float d, float w) {
    float aa = fwidth(d) * 1.25;
    return 1.0 - smoothstep(w, w + aa, abs(d));
  }
  mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float sqd(vec2 p, float s) { vec2 d = abs(p); return max(d.x, d.y) - s; }
  float box(vec2 p, vec2 a, vec2 b) { return step(a.x, p.x) * step(p.x, b.x) * step(a.y, p.y) * step(p.y, b.y); }

  // one rune glyph inside a band cell, u (along the angle) and v (along the radius) both 0..1
  float glyph(vec2 uv, float h) {
    float g = 0.0;
    float h2 = fract(h * 7.31);
    float h3 = fract(h * 13.7);
    vec2 inV = vec2(0.5, 0.0);
    g += step(0.35, h) * lineW(uv.x - 0.5, 0.07) * box(uv, vec2(0.0, 0.18), vec2(1.0, 0.82));
    g += step(0.55, h2) * lineW(uv.y - 0.78, 0.06) * box(uv, vec2(0.2, 0.0), vec2(0.8, 1.0));
    g += step(h2, 0.4) * lineW(uv.y - 0.22, 0.06) * box(uv, vec2(0.2, 0.0), vec2(0.8, 1.0));
    g += step(0.5, h3) * lineW((uv.x - 0.5) - (uv.y - 0.5) * 0.6, 0.06) * box(uv, vec2(0.15, 0.25), vec2(0.85, 0.75));
    g += step(h3, 0.3) * lineW(length((uv - vec2(0.5, 0.5)) * vec2(1.0, 1.4)) - 0.22, 0.06);
    g += step(0.75, h) * lineW(abs(uv.x - 0.5) - (uv.y - 0.2) * 0.45, 0.06) * box(uv, vec2(0.1, 0.2), vec2(0.9, 0.8));
    return clamp(g, 0.0, 1.0);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float t = uTime;

    // reveal: the circle is drawn in clockwise from the top
    float ang01 = fract(0.25 - a / TAU);
    float rev = smoothstep(ang01 - 0.02, ang01, uReveal * 1.02);
    float innerRev = smoothstep(0.35, 1.0, uReveal);

    float m = 0.0;
    // outer double ring + sparks running round it
    m += lineW(r - 0.965, 0.007);
    m += lineW(r - 0.93, 0.0035);
    float spark = pow(max(0.0, sin(a * 23.0 + t * 5.0)), 40.0) + pow(max(0.0, sin(a * 37.0 - t * 7.3)), 60.0);
    m += spark * lineW(r - 0.948, 0.018) * 1.6;

    // rune band
    float ar = a + uRot;
    float cellsF = uCells;
    float cpos = (ar / TAU + 0.5) * cellsF;
    float cell = mod(floor(cpos), cellsF);
    float u = fract(cpos);
    float v = (r - 0.815) / 0.095;
    if (v > 0.0 && v < 1.0) {
      float h = hash1(cell);
      float g = glyph(vec2(u, v), h);
      // a few cells flare up at random
      float flare = step(0.92, hash1(cell + floor(t * 1.5) * 13.0));
      m += g * (0.85 + flare * 1.2);
    }
    m += lineW(r - 0.80, 0.0045);
    m += lineW(r - 0.775, 0.003);

    // eight-point star: two counter-rotating squares
    vec2 q = rot2(-uRot * 1.6) * p;
    float s1 = sqd(q, 0.535);
    float s2 = sqd(rot2(PI * 0.25) * q, 0.535);
    float star = (lineW(s1, 0.0045) + lineW(s2, 0.0045)) * step(r, 0.77);
    m += star * innerRev;

    // inner dial with ticks
    float dial = lineW(r - 0.53, 0.004) + lineW(r - 0.47, 0.003);
    float ta = fract((a - uRot * 0.7) / TAU * 60.0);
    float major = step(0.5, fract((a - uRot * 0.7) / TAU * 12.0 + 0.04)) ;
    dial += lineW(ta - 0.5, 0.06) * step(0.47, r) * step(r, mix(0.505, 0.53, major));
    m += dial * innerRev;

    // radial spokes + inner circles (detail level)
    if (uDetail > 0.5) {
      float sa = fract((a + uRot * 0.4) / TAU * 12.0);
      m += lineW(sa - 0.5, 0.012) * step(0.24, r) * step(r, 0.45) * 0.7 * innerRev;
      vec2 q2 = rot2(uRot * 2.2) * p;
      m += lineW(sqd(q2, 0.17), 0.004) * innerRev;
      m += lineW(sqd(rot2(PI * 0.25) * q2, 0.17), 0.004) * innerRev;
      m += lineW(r - 0.24, 0.004) * innerRev;
    }
    m += lineW(r - 0.09, 0.006) * innerRev;

    m *= rev;
    // flicker, as if the circle were made of sparks
    float fl = 0.82 + 0.18 * sin(a * 41.0 + t * 11.0) * sin(a * 17.0 - t * 6.0);
    m *= fl;

    float halo = exp(-abs(r - 0.95) * 26.0) * 0.28 + exp(-abs(r - 0.79) * 30.0) * 0.12 + exp(-r * 4.0) * 0.1 * innerRev;
    vec3 col = uColor * (m + halo * rev);
    col += uHot * smoothstep(0.9, 1.8, m) * 0.9;
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`

export function makeMandalaMaterial({ color = '#ffa63d', hot = '#fff1c9', seed = 1, cells = 64, detail = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uRot: { value: 0 },
      uIntensity: { value: 1 },
      uReveal: { value: 1 },
      uSeed: { value: seed },
      uCells: { value: cells },
      uDetail: { value: detail },
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color(hot) },
    },
  })
}

const plane = new THREE.PlaneGeometry(2, 2)

// <Mandala radius color speed /> — a square plane of side 2*radius. Turns by itself (userData.speed rad/s).
const Mandala = forwardRef(function Mandala({ radius = 1, color, hot, seed = 1, cells = 64, detail = 1, speed = 0.1, intensity = 1, reveal = 1, ...props }, ref) {
  const own = useRef(null)
  const mat = useMemo(() => makeMandalaMaterial({ color, hot, seed, cells, detail }), [color, hot, seed, cells, detail])
  useLayoutEffect(() => {
    mat.uniforms.uIntensity.value = intensity
    mat.uniforms.uReveal.value = reveal
  }, [mat, intensity, reveal])
  useLayoutEffect(() => () => mat.dispose(), [mat])
  useFrame((state, dt) => {
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    const m = own.current
    if (!m || !m.visible) return
    const sp = m.userData.speed !== undefined ? m.userData.speed : speed
    u.uRot.value += Math.min(dt, 0.05) * sp
  })
  const setRef = (el) => {
    own.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  return <mesh ref={setRef} geometry={plane} material={mat} scale={radius} frustumCulled={false} renderOrder={2} {...props} />
})

export default Mandala
