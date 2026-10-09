import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BANDS, buildShieldGeometries, disposeShieldGeometries } from './shieldGeometry'

const noRaycast = () => null

// The shield mesh (unit radius, faces +Z). Materials are owned by the rig so it can drive the star glow.
// `hitArea` gets an invisible disc that is the only raycast target (cheap hover / click on the shield).
export default function Shield({ materials, segments = 128, hitArea, onOver, onOut, onClick }) {
  const geo = useMemo(() => buildShieldGeometries(segments), [segments])
  useEffect(() => () => disposeShieldGeometries(geo), [geo])
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(() => () => hitMat.dispose(), [hitMat])

  return (
    <group>
      {geo.bands.map((g, i) => (
        <mesh key={BANDS[i].key} geometry={g} material={materials[BANDS[i].mat]} raycast={noRaycast} />
      ))}
      <mesh geometry={geo.rim} material={materials.rim} raycast={noRaycast} />
      <mesh geometry={geo.back} material={materials.back} raycast={noRaycast} />
      <mesh geometry={geo.star} material={materials.star} raycast={noRaycast} />
      {geo.straps.map((g, i) => (
        <mesh key={i} geometry={g} material={materials.leather} raycast={noRaycast} />
      ))}
      <mesh geometry={geo.pad} material={materials.leather} raycast={noRaycast} />
      {hitArea ? (
        <mesh ref={hitArea} material={hitMat} position={[0, 0, 0.2]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <circleGeometry args={[1.05, 32]} />
        </mesh>
      ) : null}
    </group>
  )
}
