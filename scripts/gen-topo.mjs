// Génère public/topo.svg : courbes de niveau « topo » tuilables sans couture (600×600).
// Période = 600 (divise la largeur) → les bords gauche/droite se raccordent ; les ondes
// sont espacées de 75px (divise 600) → raccord haut/bas. Usage : node scripts/gen-topo.mjs

import { writeFileSync } from 'node:fs'

const SIZE = 600
const SPACING = 75 // 600 / 8 → tuile verticalement
const STEP = 25 // pas d'échantillonnage (600 / 24)
const TWO_PI = Math.PI * 2

// y périodique d'une onde (période = SIZE → seamless horizontal)
const waveY = (x, baseY, amp, phase) => baseY + amp * Math.sin((TWO_PI * x) / SIZE + phase)

// Catmull-Rom → cubic Bézier pour un tracé lisse
function pathFor(baseY, amp, phase) {
  const pts = []
  for (let x = -STEP; x <= SIZE + STEP; x += STEP) {
    pts.push([x, waveY(x, baseY, amp, phase)])
  }
  let d = ''
  for (let i = 1; i < pts.length - 2; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const [x3, y3] = pts[i + 2]
    if (x1 < 0 || x1 >= SIZE) continue
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    if (d === '') d += `M${x1.toFixed(1)},${y1.toFixed(1)} `
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} `
  }
  return d.trim()
}

// 8 ondes, amplitude/phase variées pour un rendu organique (terrain)
const amps = [16, 22, 19, 26, 18, 24, 20, 17]
const phases = [0, 0.9, 1.8, 0.4, 2.6, 1.2, 0.2, 2.0]
let paths = ''
for (let k = 0; k < 8; k++) {
  const baseY = SPACING / 2 + SPACING * k // 37.5, 112.5, …, 562.5
  paths += `    <path d="${pathFor(baseY, amps[k], phases[k])}"/>\n`
}

const svg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#0f3b44" stroke-width="1" fill="none" stroke-linecap="round">
${paths}  </g>
</svg>
`

writeFileSync(new URL('../public/topo.svg', import.meta.url), svg)
console.log('public/topo.svg généré (8 ondes seamless, 600×600)')
