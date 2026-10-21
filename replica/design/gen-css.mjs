// tokens.json -> tokens.css (custom properties). Re-run after every palette change:
//   node replica/design/gen-css.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url)
const t = JSON.parse(readFileSync(new URL('tokens.json', dir), 'utf8'))
const lines = []
for (const [k, v] of Object.entries(t.color)) lines.push(`--c-${k}: ${v};`)
for (const [k, v] of Object.entries(t.font)) lines.push(`--font-${k}: ${v};`)
for (const [k, v] of Object.entries(t.type)) {
  lines.push(`--fs-${k}: ${v.size}px;`, `--lh-${k}: ${v.line}px;`, `--fw-${k}: ${v.weight};`)
}
t.space.forEach((v, i) => lines.push(`--sp-${i}: ${v}px;`))
for (const [k, v] of Object.entries(t.radius)) lines.push(`--r-${k}: ${v}px;`)
for (const [k, v] of Object.entries(t.shadow)) lines.push(`--shadow-${k}: ${v};`)
for (const [k, v] of Object.entries(t.motion)) lines.push(`--motion-${k}: ${v};`)
for (const [k, v] of Object.entries(t.layout)) lines.push(`--${k}: ${v}px;`)

writeFileSync(new URL('tokens.css', dir), `/* generated from tokens.json by gen-css.mjs, do not edit */\n:root {\n  ${lines.join('\n  ')}\n}\n`)
console.log(`tokens.css: ${lines.length} properties`)
