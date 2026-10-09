import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// LIGHTNING: a pool of procedural branching bolts. Each bolt is a camera-facing ribbon (built on the CPU in the
// XY plane, which faces the fixed camera) along a midpoint-displaced jagged polyline, with forks splitting off
// the main channel. While a bolt lives it re-routes every few frames (the crackle) and strobes with re-strike
// keyframes; its endpoints are re-read from live getters so it stays attached to a moving hammer / stone.
// Additive + toneMapped:false, so the white core blooms and the cyan halo glows. No per-frame allocations: every
// buffer is preallocated; fire() is the only call that allocates (two small closures per strike).

const MAIN = 33 // points on the main channel (2^5 + 1)
const FORKS = 3
const FORK_PTS = 17 // 2^4 + 1
const PATHS = [MAIN, ...Array(FORKS).fill(FORK_PTS)]
const TOTAL = PATHS.reduce((a, b) => a + b, 0)
const STRIKE_KEYS = [1, 0.25, 1, 0.55, 0.95, 0.35, 0.75, 0.15, 0]

const vert = /* glsl */ `
  attribute float aV;
  attribute float aT;
  varying float vV;
  varying float vT;
  void main() {
    vV = aV;
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform float uI;
  uniform vec3 uColor;
  varying float vV;
  varying float vT;
  void main() {
    float a = abs(vV);
    float core = 1.0 - smoothstep(0.0, 0.26, a);
    float halo = pow(1.0 - a, 2.6) * 0.6;
    float tip = 1.0 - smoothstep(0.86, 1.0, vT);
    vec3 col = vec3(1.0, 1.0, 1.0) * core * 2.6 + uColor * halo * 2.2;
    float alpha = (core + halo) * uI * tip;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

function strikeEnvelope(u) {
  if (u >= 1) return 0
  const f = u * (STRIKE_KEYS.length - 1)
  const i = Math.floor(f)
  return STRIKE_KEYS[i] + (STRIKE_KEYS[i + 1] - STRIKE_KEYS[i]) * (f - i)
}

// Midpoint displacement into out[] (xyz triples) for n = 2^k + 1 points between a and b.
function displace(out, n, ax, ay, az, bx, by, bz, rough, rnd) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy, bz - az) || 1e-4
  const lxy = Math.hypot(dx, dy) || 1e-4
  const px = -dy / lxy
  const py = dx / lxy
  out[0] = ax
  out[1] = ay
  out[2] = az
  out[(n - 1) * 3] = bx
  out[(n - 1) * 3 + 1] = by
  out[(n - 1) * 3 + 2] = bz
  let step = n - 1
  let amp = len * rough
  while (step > 1) {
    const half = step / 2
    for (let i = half; i < n - 1; i += step) {
      const a = (i - half) * 3
      const b = (i + half) * 3
      const o = (rnd() * 2 - 1) * amp
      out[i * 3] = (out[a] + out[b]) * 0.5 + px * o
      out[i * 3 + 1] = (out[a + 1] + out[b + 1]) * 0.5 + py * o
      out[i * 3 + 2] = (out[a + 2] + out[b + 2]) * 0.5 + (rnd() * 2 - 1) * amp * 0.35
    }
    amp *= 0.56
    step = half
  }
}

class Bolt {
  constructor(material) {
    this.geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(TOTAL * 2 * 3)
    const aV = new Float32Array(TOTAL * 2)
    const aT = new Float32Array(TOTAL * 2)
    const idx = []
    let base = 0
    for (const n of PATHS) {
      for (let i = 0; i < n; i++) {
        aV[(base + i) * 2] = -1
        aV[(base + i) * 2 + 1] = 1
        aT[(base + i) * 2] = aT[(base + i) * 2 + 1] = i / (n - 1)
        if (i < n - 1) {
          const v = (base + i) * 2
          idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3)
        }
      }
      base += n
    }
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    this.geo.setAttribute('position', this.posAttr)
    this.geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1))
    this.geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    this.geo.setIndex(idx)
    this.mat = material
    this.mesh = new THREE.Mesh(this.geo, material)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.renderOrder = 5
    this.pts = new Float32Array(MAIN * 3)
    this.fork = new Float32Array(FORK_PTS * 3)
    this.age = 0
    this.life = 0
    this.regen = 0
    this.active = false
    this.from = null
    this.to = null
    this.a = new THREE.Vector3()
    this.b = new THREE.Vector3()
  }

  // Writes a ribbon for the points in src (n points) into the vertex buffer starting at point `base`.
  ribbon(src, n, base, width, taperStart) {
    const p = this.pos
    let nx = 0
    let ny = 1
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1) * 3
      const i1 = Math.min(n - 1, i + 1) * 3
      const tx = src[i1] - src[i0]
      const ty = src[i1 + 1] - src[i0 + 1]
      const tl = Math.hypot(tx, ty)
      if (tl > 1e-5) {
        nx = -ty / tl
        ny = tx / tl
      }
      const t = i / (n - 1)
      const w = width * (taperStart + (1 - taperStart) * (1 - t)) * (0.75 + 0.25 * Math.sin(i * 1.7))
      const v = (base + i) * 6
      const x = src[i * 3]
      const y = src[i * 3 + 1]
      const z = src[i * 3 + 2]
      p[v] = x - nx * w
      p[v + 1] = y - ny * w
      p[v + 2] = z
      p[v + 3] = x + nx * w
      p[v + 4] = y + ny * w
      p[v + 5] = z
    }
  }

  collapse(base, n) {
    this.pos.fill(0, base * 6, (base + n) * 6)
  }

  build(rnd) {
    this.from(this.a)
    this.to(this.b)
    const { a, b } = this
    displace(this.pts, MAIN, a.x, a.y, a.z, b.x, b.y, b.z, this.rough, rnd)
    this.ribbon(this.pts, MAIN, 0, this.width, 0.35)
    let base = MAIN
    for (let f = 0; f < FORKS; f++) {
      if (f >= this.forks) {
        this.collapse(base, FORK_PTS)
        base += FORK_PTS
        continue
      }
      // a fork leaves the main channel between 20% and 75% of its length, angled off the main direction
      const k = Math.floor((0.2 + rnd() * 0.55) * (MAIN - 1))
      const sx = this.pts[k * 3]
      const sy = this.pts[k * 3 + 1]
      const sz = this.pts[k * 3 + 2]
      const dx = b.x - sx
      const dy = b.y - sy
      const rem = Math.hypot(dx, dy) || 0.1
      const ang = Math.atan2(dy, dx) + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.6)
      const fl = rem * (0.25 + rnd() * 0.35)
      displace(this.fork, FORK_PTS, sx, sy, sz, sx + Math.cos(ang) * fl, sy + Math.sin(ang) * fl, sz + (rnd() - 0.5) * fl * 0.4, this.rough * 1.1, rnd)
      this.ribbon(this.fork, FORK_PTS, base, this.width * 0.5, 0)
      base += FORK_PTS
    }
    this.posAttr.needsUpdate = true
  }
}

const Lightning = forwardRef(function Lightning({ count = 6, color = '#8fd8ff' }, ref) {
  const group = useRef()
  // global 0..1 multiplier set by the scene (the hand-off to the next-mission CTA fades every live bolt out)
  const fade = useRef(1)
  const rnd = Math.random
  const pool = useMemo(() => {
    const out = []
    for (let i = 0; i < count; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uI: { value: 0 }, uColor: { value: new THREE.Color(color) } },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
      out.push(new Bolt(m))
    }
    return out
  }, [count, color])

  useEffect(() => {
    const g = group.current
    if (!g) return
    pool.forEach((b) => g.add(b.mesh))
    return () => {
      pool.forEach((b) => {
        g.remove(b.mesh)
        b.geo.dispose()
        b.mat.dispose()
      })
    }
  }, [pool])

  useImperativeHandle(
    ref,
    () => ({
      // from / to: (target: Vector3) => void, re-evaluated on every re-route so the bolt tracks moving ends.
      fire(from, to, { life = 0.5, width = 0.06, forks = 2, rough = 0.2, intensity = 1 } = {}) {
        let b = pool.find((x) => !x.active)
        if (!b) b = pool.reduce((o, x) => (x.age / x.life > o.age / o.life ? x : o), pool[0])
        b.from = from
        b.to = to
        b.life = life
        b.width = width
        b.forks = Math.min(FORKS, forks)
        b.rough = rough
        b.peak = intensity
        b.age = 0
        b.regen = 0
        b.active = true
        b.build(rnd)
        b.mesh.visible = true
        return b
      },
      get busy() {
        return pool.some((b) => b.active)
      },
      set fade(v) {
        fade.current = v
      },
    }),
    [pool, rnd],
  )

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1)
    const f = fade.current
    for (const b of pool) {
      if (!b.active) continue
      b.age += d
      const u = b.age / b.life
      if (u >= 1 || f < 0.01) {
        b.active = false
        b.mesh.visible = false
        b.mat.uniforms.uI.value = 0
        continue
      }
      b.regen -= d
      if (b.regen <= 0) {
        b.regen = 0.045 + Math.random() * 0.05
        b.build(rnd)
      }
      b.mat.uniforms.uI.value = strikeEnvelope(u) * b.peak * f
    }
  })

  return <group ref={group} />
})

export default Lightning
