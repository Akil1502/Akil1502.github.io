// Shared palette + layout constants for the 3D scene (mirror of the CSS variables).
export const palette = {
  bg: '#07060a',
  bg2: '#120609',
  red: '#e8232a',
  redDeep: '#7a0b12',
  gold: '#f5c04a',
  goldBase: '#d9a53a',
  goldHi: '#ffe9a8',
  cyan: '#4fd1ff',
  cyanDeep: '#0b6f94',
  white: '#eef0f6',
}

// Order of DOM sections; 3D groups are placed at y = -index * SECTION_GAP
export const SECTION_ORDER = ['hero', 'origin', 'arsenal', 'missions', 'roster', 'training', 'assemble']
export const SECTION_GAP = 12
export const CAMERA_Z = 10

export const FONTS = {
  bebas3d: '/fonts/BebasNeue.typeface.json',
  barlow3d: '/fonts/BarlowCondensed-ExtraBold.typeface.json',
  bebas: '/fonts/BebasNeue-Regular.ttf',
  rajdhani: '/fonts/Rajdhani-SemiBold.ttf',
  barlow: '/fonts/Barlow-Medium.ttf',
  mono: '/fonts/JetBrainsMono-Medium.ttf',
}
