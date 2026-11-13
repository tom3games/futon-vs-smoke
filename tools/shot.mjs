import '../mute-auto.mjs'
// 画面を撮る。node tools/shot.mjs [幅] [高さ] [touch]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = new URL('..', import.meta.url).pathname
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(res => srv.stdout.on('data', d => { const m = String(d).match(/localhost:(\d+)/); if (m) res(+m[1]) }))
const [w = 1280, h = 720, mode = ''] = process.argv.slice(2)
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: mode === 'touch', isMobile: mode === 'touch', locale: 'ja-JP' })
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); try { await p.waitForFunction(() => window.__fvsReady, null, { timeout: 15000 }) } catch (e) { console.log("NOT READY", errs, await p.evaluate(() => ({ up: window.__jsUp, boot: window.__bootDone, n: performance.getEntriesByType("resource").filter(e=>e.name.includes("webp")).length, fonts: document.fonts.status, res: performance.getEntriesByType("resource").map(e=>e.name.split("/").pop()).join(" ") }))); process.exit(1) }
await p.waitForTimeout(600)
const tag = `${w}x${h}${mode}`
await p.screenshot({ path: `${ROOT}shots/s-${tag}-title.png` })
await p.evaluate(() => { fvs.bot('learned', 3); fvs.start(0) })
const at = async (frames, name) => { await p.evaluate(n => fvs.run(n), frames); await p.waitForTimeout(250); await p.screenshot({ path: `${ROOT}shots/s-${tag}-${name}.png` }) }
await at(60 * 2.5, 'room')
await at(60 * 4, 'parry')
await at(60 * 8, 'street')
await at(60 * 6, 'street2')
await p.evaluate(() => { fvs.start(3); fvs.bot('learned', 3) })
await at(60 * 3, 'bossin')
for (let i = 0; i < 10; i++) { await at(60 * 2.6 + i * 7, 'boss' + i) }
await p.evaluate(() => { fvs.bot('idle'); fvs.r().hp = 1 })
await at(60 * 8, 'dead')
await p.evaluate(() => { fvs.bot('learned', 5); fvs.start(3) })
await p.evaluate(() => { fvs.r().boss || fvs.run(200); })
await at(60 * 3, 'b2-a')
await p.evaluate(() => { const r = fvs.r(); if (r.boss) r.boss.hp = 335 })
for (let i = 0; i < 6; i++) await at(60 * 2.2, 'p2-' + i)
await p.evaluate(() => { const r = fvs.r(); if (r.boss) r.boss.hp = 3 })
await at(60 * 6, 'win')
console.log(JSON.stringify(await p.evaluate(() => ({ scene: fvs.scene(), diary: fvs.diary(), snap: fvs.snap() }))))
console.log('errs', errs)
await b.close(); srv.kill()
