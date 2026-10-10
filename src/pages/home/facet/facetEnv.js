import * as THREE from 'three'

// A private "product shot" reflection environment for the faceted plates. A flat plane mirrors ONE direction of the
// environment, so this layout is what makes the sculpture read:
//  · a graded dome: warm and bright above the horizon in front, a softer warm band below it (no plane facing the
//    camera ever mirrors pure black → no muddy faces), falling to near black behind → planes that turn away darken
//    progressively, so neighbouring planes always differ and the forms read as sculpted;
//  · a medium key softbox up front-right and a small cool top strip (crisp, separate highlights — not one big wash
//    that would turn the candy-red clearcoat pink);
//  · a hot red kicker behind-left and a cool white rim behind-right that catch the chamfers on the silhouette;
//  · thin accent strips that make single planes and edges glint in turn as the helmet turns.
// Baked once into a PMREM at the same size as the scene's studio env (256) → identical shader programs.
export function makeFacetEnv(gl) {
  const scene = new THREE.Scene()
  const disposables = []

  const dome = new THREE.SphereGeometry(40, 64, 32)
  const col = []
  const warm = new THREE.Color('#ffd6a0')
  const c = new THREE.Color()
  const p = dome.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 40
    const y = p.getY(i) / 40
    const z = p.getZ(i) / 40
    const front = Math.max(0, z) // 0 behind … 1 straight at the camera side (symmetric: the helmet turns both ways)
    const above = THREE.MathUtils.smoothstep(y, -0.8, 0.75) // gentle horizon gradient (reaches low: the chin and lower cheeks look down-forward)
    let k = 0.012 + front * front * (0.07 + 0.25 * above) + 0.05 * Math.max(0, y) * Math.max(0, y)
    if (y < -0.6) k *= 1 - Math.min(0.8, (-y - 0.6) * 2)
    c.copy(warm).multiplyScalar(k)
    col.push(c.r, c.g, c.b)
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })
  scene.add(new THREE.Mesh(dome, domeMat))
  disposables.push(dome, domeMat)

  const plane = new THREE.PlaneGeometry(1, 1)
  disposables.push(plane)
  const panel = (color, intensity, pos, size, rotZ = 0) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false })
    const mesh = new THREE.Mesh(plane, m)
    mesh.position.set(pos[0], pos[1], pos[2])
    mesh.lookAt(0, 0, 0)
    mesh.rotateZ(rotZ)
    mesh.scale.set(size[0], size[1], 1)
    scene.add(mesh)
    disposables.push(m)
  }
  // two key softboxes: the faceplate catches the left one when the helmet looks toward the copy on the left (hero
  // shot) and the right one when it looks right (identity beat)
  panel('#fff0dc', 1.75, [-6.5, 2.4, 6.5], [4.6, 4.4]) // key L (low, wide)
  panel('#fff0dc', 1.9, [5.5, 5.5, 6.5], [4.2, 3.4]) // key R (high)
  panel('#ffe2bd', 0.6, [0, 0.5, 9], [7, 4]) // soft frontal fill (base level only)
  panel('#eaf2ff', 0.9, [-1.5, 9, 1.5], [6, 0.9], 0.25) // top strip
  panel('#ff2a1a', 4.2, [-8, 1.5, -5], [2, 10]) // red kicker (behind-left)
  panel('#d6ecff', 1.1, [7.5, -0.5, -6.2], [0.9, 9]) // cool rim (behind-right, narrow: only true silhouette planes catch it)
  panel('#ffcf94', 0.5, [0, -8, 4], [12, 4]) // warm floor bounce
  panel('#ffffff', 5, [-6.5, 4, 5], [0.3, 5], 0.6) // accent strip L
  panel('#ffffff', 4, [7, 1.5, 2.5], [0.28, 6], -0.3) // accent strip R
  panel('#fff4e0', 2.4, [-3, -3, 7], [3, 0.26]) // low glint

  const pm = new THREE.PMREMGenerator(gl)
  const rt = pm.fromScene(scene, 0.012, 0.1, 80, { size: 256 })
  pm.dispose()
  for (const d of disposables) d.dispose()
  return rt
}
