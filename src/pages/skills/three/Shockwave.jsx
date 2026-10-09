import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'


// (adapted from the shared Arsenal shockwave) IMPACT shockwave: a camera-facing double ring that bursts out from the centre and fades, with a brief core
// flash. One quad, one draw call, constant-width rings at any scale (computed in the fragment shader, so the
// band does not fatten as the mesh grows the way a scaled torus would). Driven by the parent via
// ref.current.set(progress) with progress 0..1; it hides itself outside that range.

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform float uP;
  uniform vec3 uColor;
  uniform vec3 uCore;
  varying vec2 vUv;
  // a bright leading edge with a soft trailing wake
  float band(float d, float r, float w) {
    return smoothstep(r - w, r, d) * (1.0 - smoothstep(r, r + w * 0.25, d));
  }
  void main() {
    float d = length(vUv - 0.5) * 2.0; // 0 at the centre, 1 at the quad's inscribed circle
    float p1 = clamp(uP, 0.0, 1.0);
    float p2 = clamp((uP - 0.16) / 0.84, 0.0, 1.0);
    float e1 = 1.0 - pow(1.0 - p1, 3.0);
    float e2 = 1.0 - pow(1.0 - p2, 3.0);
    float a1 = band(d, 0.04 + e1 * 0.94, 0.05 + 0.12 * e1) * pow(1.0 - p1, 1.5);
    float a2 = band(d, 0.04 + e2 * 0.7, 0.03 + 0.08 * e2) * pow(1.0 - p2, 1.8) * step(0.0001, p2) * 0.6;
    float core = (1.0 - smoothstep(0.0, 0.18 + 0.3 * e1, d)) * pow(1.0 - p1, 5.0) * 0.9;
    float a = a1 + a2 + core;
    if (a < 0.004) discard;
    // additive blending multiplies rgb by alpha, so hand it the colour mix normalised by the total weight
    vec3 col = (uColor * (a1 + a2) + uCore * core) / a;
    gl_FragColor = vec4(col, min(a, 1.0));
    #include <colorspace_fragment>
  }
`

const Shockwave = forwardRef(function Shockwave({ color = '#8fd8ff', coreColor = '#ffe9a8', ...props }, ref) {
  const mesh = useRef()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uP: { value: 0 },
          uColor: { value: new THREE.Color(color).multiplyScalar(2.2) },
          uCore: { value: new THREE.Color(coreColor).multiplyScalar(1.6) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color, coreColor],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  useImperativeHandle(
    ref,
    () => ({
      set(p) {
        mat.uniforms.uP.value = p
        if (mesh.current) mesh.current.visible = p > 0 && p < 1
      },
      get object() {
        return mesh.current
      },
    }),
    [mat],
  )

  return <mesh ref={mesh} geometry={geo} material={mat} visible={false} frustumCulled={false} renderOrder={2} {...props} />
})

export default Shockwave
