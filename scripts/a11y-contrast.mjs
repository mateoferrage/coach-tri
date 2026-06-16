// Audit de contraste WCAG 2.2 — convertit OKLCH→sRGB, composite l'alpha, calcule le ratio.
// Usage : node scripts/a11y-contrast.mjs   (script jetable, non committé)

function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  // gamma encode → sRGB 0..1
  return lin.map((v) => {
    v = Math.max(0, Math.min(1, v))
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  })
}

// "oklch(L C H)" ou "oklch(L C H / P%)" → {srgb:[r,g,b], a}
function parse(str) {
  const m = str.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%)?\)/)
  const [, L, C, h, p] = m
  return { srgb: oklchToSrgb(+L, +C, +h), a: p == null ? 1 : +p / 100 }
}

function composite(fg, bg) {
  // composite en espace sRGB (gamma) — approxime le rendu CSS de l'opacité
  const f = parse(fg),
    b = parse(bg)
  return f.srgb.map((c, i) => c * f.a + b.srgb[i] * (1 - f.a))
}

function luminance(srgb) {
  const [r, g, b] = srgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(fg, bg) {
  const fgC = composite(fg, bg) // foreground composité sur son fond
  const bgC = parse(bg).srgb
  const L1 = luminance(fgC),
    L2 = luminance(bgC)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

// ── Couleurs ────────────────────────────────────────────────
const canard = 'oklch(0.306 0.051 209.3)' // --sidebar (header)
const cream = 'oklch(0.97 0.008 200)' // --sidebar-foreground
const glacier = 'oklch(0.72 0.1 184)' // --sidebar-primary
const white = 'oklch(1 0 0)' // carte
const sauge = 'oklch(0.913 0.015 186)' // fond page
const band = 'oklch(0.9 0.028 195)' // SURFACE_DEEP (bandeau carte)
const ink = 'oklch(0.287 0.047 217.9)' // texte principal

const A = (c, p) => c.replace(/\)$/, ` / ${p}%)`)

const checks = [
  ['Header — TRI (glacier) / canard', glacier, canard, 4.5],
  ['Header — nav actif (glacier) / canard', glacier, canard, 4.5],
  ['Header — nav inactif cream/60 / canard', A(cream, 60), canard, 4.5],
  ['Header — email cream/55 / canard', A(cream, 55), canard, 4.5],
  ['Header — déconnexion cream/75 / canard', A(cream, 75), canard, 4.5],
  ['Header — cream plein / canard', cream, canard, 4.5],
  ['Mobile — onglet inactif cream/55 / canard', A(cream, 55), canard, 4.5],
  ['Dashboard — texte 2nd ink/70 / bandeau', A(ink, 70), band, 4.5],
  ['Dashboard — TSS/RPE valeur ink/80 / bandeau', A(ink, 80), band, 4.5],
  ['Dashboard — texte 2nd ink/70 / blanc', A(ink, 70), white, 4.5],
  ['Dashboard — texte 2nd ink/70 / sauge', A(ink, 70), sauge, 4.5],
  ['Texte muted-foreground / blanc', 'oklch(0.504 0.038 203.1)', white, 4.5],
  ['Texte muted-foreground / sauge', 'oklch(0.504 0.038 203.1)', sauge, 4.5],
]

console.log('Cible WCAG 2.2 AA — texte normal ≥ 4.5:1\n')
for (const [label, fg, bg, target] of checks) {
  const r = ratio(fg, bg)
  const pass = r >= target
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  ${label}`)
}

// ── Candidats de remplacement pour le texte « faint » (doit passer sur band/white/sauge) ──
console.log('\n— Candidats texte secondaire AA (cible 4.5:1, surface critique = bandeau) —')
const surfaces = { blanc: white, sauge, bandeau: band }
const candidates = {
  'TEXT_MUTED actuel    oklch(0.504 0.038 203.1)': 'oklch(0.504 0.038 203.1)',
  'candidat A           oklch(0.52 0.04 205)': 'oklch(0.52 0.04 205)',
  'candidat B           oklch(0.54 0.04 205)': 'oklch(0.54 0.04 205)',
  'ink/65%              ': A(ink, 65),
  'ink/70%              ': A(ink, 70),
}
for (const [name, col] of Object.entries(candidates)) {
  const r = Object.entries(surfaces).map(([s, bg]) => `${s} ${ratio(col, bg).toFixed(2)}`)
  console.log(`${name}  →  ${r.join('  ')}`)
}
