import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 確かめる: node verify.mjs（重い検査は同時に2本まで）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(res => server.stdout.on('data', d => { const m = String(d).match(/localhost:(\d+)/); if (m) res(+m[1]) }))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, hash = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 720 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  if (opts.pad) await ctx.addInitScript(() => {
    window.__pad = { connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }
    navigator.getGamepads = () => [window.__pad]
  })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|tom3games\.com/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + hash); await p.waitForFunction(() => window.__fvsReady, null, { timeout: 20000 })
  return p
}
// 一画面に収まる・横にはみ出さない・見えているボタンが画面の中
const fit = q => q.evaluate(() => {
  const W = innerWidth, H = innerHeight, de = document.documentElement, bad = []
  if (de.scrollHeight > H + 1) bad.push('scrollH:' + de.scrollHeight)
  if (de.scrollWidth > W + 1) bad.push('scrollW:' + de.scrollWidth)
  for (const el of document.querySelectorAll('button,canvas#cv,a')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) bad.push((el.id || el.dataset.k || el.className || el.tagName) + ':' + [r.left, r.top, r.right, r.bottom].map(Math.round))
  }
  const c = document.getElementById('cv').getBoundingClientRect()
  return { W, H, cv: [Math.round(c.width), Math.round(c.height)], bad: bad.slice(0, 6) }
})
const keyHold = async (p, key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key) }

const browser = await chromium.launch(MUTE_LAUNCH)
let p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('主人公の呼び名（やめた名前）が画面・説明・文言に無い', async () => {
  const s = await p.evaluate(async () => document.documentElement.outerHTML + JSON.stringify((await import('./js/text.js?v=4')).TEXT))
  expect(!new RegExp('\\u5e03\\u56e3\\u3061\\u3083\\u3093|Futon-' + 'chan|Futon and', 'i').test(s), 'found')
})
await t('画面と説明に出さない言葉が無い', async () => {
  const s = await p.evaluate(() => document.documentElement.outerHTML)
  expect(!/\bA[I]\b|画像[生]成|Chat[G]PT|Mid[j]ourney/i.test(s), 'found')
})

// ---- キーボードで本物の操作
await t('Enter で始まり、→ で進み、Z で跳び、X で撃ち、C ではじく', async () => {
  await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  expect(await p.evaluate(() => fvs.scene()) === 'play', 'not play')
  const x0 = await p.evaluate(() => fvs.r().me.x)
  await keyHold(p, 'ArrowRight', 500)
  const x1 = await p.evaluate(() => fvs.r().me.x)
  await p.keyboard.press('z'); await p.waitForTimeout(120)
  const y = await p.evaluate(() => fvs.r().me.y)
  await keyHold(p, 'x', 400)
  const shots = await p.evaluate(() => fvs.r().stats.shots)
  await p.keyboard.press('c'); await p.waitForTimeout(50)
  const flap = await p.evaluate(() => fvs.r().me.parryT > 0 || fvs.r().me.parryCd > 0)
  expect(x1 > x0 + 80 && y < 460 && shots >= 2 && flap, JSON.stringify({ x0, x1, y, shots, flap }))
  return { dx: Math.round(x1 - x0), shots }
})
await t('シフトでダッシュ、↓ でしゃがむ、Esc で止まる', async () => {
  await p.waitForTimeout(500)
  const x0 = await p.evaluate(() => fvs.r().me.x)
  await p.keyboard.press('Shift'); await p.waitForTimeout(250)
  const x1 = await p.evaluate(() => fvs.r().me.x)
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(80); const duck = await p.evaluate(() => fvs.r().me.duck); await p.keyboard.up('ArrowDown')
  await p.keyboard.press('Escape'); await p.waitForTimeout(100)
  const f0 = await p.evaluate(() => fvs.r().frame); await p.waitForTimeout(300); const f1 = await p.evaluate(() => fvs.r().frame)
  const sc = await p.evaluate(() => fvs.scene())
  await p.keyboard.press('Escape'); await p.waitForTimeout(100)
  expect(x1 - x0 > 60 && duck && f0 === f1 && sc === 'pause', JSON.stringify({ dash: x1 - x0, duck, f0, f1, sc }))
})
await t('固定 60Hz: 描画が 60Hz・120Hz・144Hz・ばらばらでも中身が同じ', async () => {
  const r = await p.evaluate(() => {
    const out = []
    const plans = { hz60: Array(1200).fill(1 / 60), hz120: Array(2400).fill(1 / 120), hz144: Array(2880).fill(1 / 144), jitter: [] }
    let s = 0; while (s < 20 - 1e-9) { const d = [1 / 60, 1 / 30, 1 / 90, 0.021, 1 / 50][plans.jitter.length % 5]; plans.jitter.push(Math.min(d, 20 - s)); s += d }
    for (const [k, dts] of Object.entries(plans)) { fvs.bot('learned', 4); fvs.start(3, 77); fvs.feed(dts); out.push([k, JSON.stringify(fvs.snap())]) }
    fvs.bot(null)
    return out
  })
  const base = r[0][1]
  // ばらばらの時は端数で1コマずれることがある。位置と体力と魔人の体力は、同じコマ数どうしで比べる
  expect(r.slice(0, 3).every(x => x[1] === base), JSON.stringify(r))
  return r.map(x => x[0] + ':' + JSON.parse(x[1]).f)
})
await t('布団（セーブ）で寝て、倒れたらそこから再開する', async () => {
  const r = await p.evaluate(() => {
    fvs.bot('learned', 2); fvs.start(0, 11)
    let n = 0; while (fvs.r().save < 1 && n++ < 60 * 40) fvs.run(1)
    const save = fvs.r().save
    fvs.run(90)   // 布団から少し進む
    fvs.bot(null)
    const R = fvs.r(); R.hp = 1; R.me.y = 900; R.me.iT = 0   // 穴に落ちたことにする
    fvs.run(90)
    return { save, scene: fvs.scene(), dead: R.mode, x: R.me.x }
  })
  await p.waitForTimeout(1300)
  const shown = await p.evaluate(() => fvs.diary())
  await p.click('#btnA')
  await p.waitForTimeout(200)
  const after = await p.evaluate(() => ({ x: fvs.r().me.x, hp: fvs.r().hp, scene: fvs.scene(), saveX: 1700 }))
  expect(r.save === 1 && shown && after.scene === 'play' && Math.abs(after.x - 1730) < 30 && after.hp === 4, JSON.stringify({ r, shown, after }))
  return after
})
await t('倒れた時の手帳に「魔人の残り」と「進んだ道」が出る', async () => {
  const left = await p.evaluate(() => {
    fvs.bot('learned', 5); fvs.start(3, 21)
    let n = 0; while ((!fvs.r().boss || fvs.frac() > 0.7) && n++ < 60 * 90) fvs.run(1)
    fvs.bot('idle'); const R = fvs.r(); R.hp = 1
    n = 0; while (R.mode !== 'dead' && n++ < 60 * 30) fvs.run(1)
    return Math.ceil(R.deathAt.boss * 100)
  })
  await p.waitForTimeout(1300)
  const txt = await p.evaluate(() => document.getElementById('dRows').textContent)
  await p.screenshot({ path: ROOT + '/shots/v-dead-boss.png' })
  expect(txt.includes('魔人の残り') && txt.includes(left + '%') && txt.includes('進んだ道'), txt + ' / ' + left)
  return txt
})
await t('型を覚えた bot が、道中から魔人まで被弾ゼロでクリアし、勝ちの手帳が出る', async () => {
  const r = await p.evaluate(() => {
    fvs.bot('learned', 9); fvs.start(0, 31)
    let n = 0; while (!fvs.r().won && n++ < 60 * 400) fvs.run(1)
    fvs.run(60 * 4)
    return { won: fvs.r().won, hits: fvs.r().stats.hits, t: Math.round(fvs.r().t), scene: fvs.scene() }
  })
  await p.waitForTimeout(500)
  const stamp = await p.evaluate(() => document.getElementById('stamp').textContent)
  await p.screenshot({ path: ROOT + '/shots/v-win.png' })
  expect(r.won && r.hits === 0 && r.scene === 'win' && /吸わず/.test(stamp), JSON.stringify(r) + stamp)
  return r
})
await t('英語に切り替えられる', async () => {
  await p.evaluate(() => { fvs.bot(null) })
  await p.reload(); await p.waitForFunction(() => window.__fvsReady)
  await p.click('#btnLang'); await p.waitForTimeout(150)
  const s = await p.evaluate(() => document.getElementById('btnStart').textContent + '|' + document.getElementById('t2').textContent)
  await p.click('#btnLang')
  expect(/Get up/.test(s) && /Without Smokes/.test(s), s)
})
await t('この通しでエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- パッド（Gamepad API）
p = await open(browser, { pad: true })
await t('パッド: A で始まり、スティックで進み、A で跳ぶ', async () => {
  await p.evaluate(() => { __pad.buttons[0].pressed = true }); await p.waitForTimeout(120); await p.evaluate(() => { __pad.buttons[0].pressed = false })
  await p.waitForTimeout(200)
  const sc = await p.evaluate(() => fvs.scene())
  const x0 = await p.evaluate(() => fvs.r().me.x)
  await p.evaluate(() => { __pad.axes[0] = 1 }); await p.waitForTimeout(400); await p.evaluate(() => { __pad.axes[0] = 0 })
  const x1 = await p.evaluate(() => fvs.r().me.x)
  await p.evaluate(() => { __pad.buttons[0].pressed = true }); await p.waitForTimeout(100)
  const y = await p.evaluate(() => fvs.r().me.y); await p.evaluate(() => { __pad.buttons[0].pressed = false })
  expect(sc === 'play' && x1 > x0 + 60 && y < 465, JSON.stringify({ sc, x0, x1, y }))
})
await t('パッド: X で撃つ・RB でダッシュ・B ではじく・十字の左・スタートで一時停止。付箋がパッドの説明になる', async () => {
  const press = async (i, ms = 120) => { await p.evaluate(i => { __pad.buttons[i].pressed = true }, i); await p.waitForTimeout(ms); await p.evaluate(i => { __pad.buttons[i].pressed = false }, i); await p.waitForTimeout(60) }
  await p.waitForTimeout(500)
  const s0 = await p.evaluate(() => fvs.r().stats.shots); await press(2, 500); const s1 = await p.evaluate(() => fvs.r().stats.shots)
  await p.waitForTimeout(300)
  const d0 = await p.evaluate(() => fvs.r().me.x); await press(5, 80); await p.waitForTimeout(150); const d1 = await p.evaluate(() => fvs.r().me.x)
  await p.waitForTimeout(500)
  await p.evaluate(() => { __pad.buttons[1].pressed = true }); await p.waitForTimeout(40)
  const flap = await p.evaluate(() => fvs.r().me.parryT > 0 || fvs.r().me.parryCd > 0); await p.evaluate(() => { __pad.buttons[1].pressed = false })
  await p.evaluate(() => { __pad.buttons[14].pressed = true }); await p.waitForTimeout(60); const left = await p.evaluate(() => fvs.input().left); await p.evaluate(() => { __pad.buttons[14].pressed = false })
  const dev = await p.evaluate(() => fvs.device())
  await press(9); const sc = await p.evaluate(() => fvs.scene()); await press(9); const sc2 = await p.evaluate(() => fvs.scene())
  expect(s1 > s0 + 2 && d1 - d0 > 50 && flap && left && dev === 'pad' && sc === 'pause' && sc2 === 'play', JSON.stringify({ s0, s1, dash: d1 - d0, flap, left, dev, sc, sc2 }))
})
await p.close()

// ---- PC の画面の大きさ（主）。どれも一画面・横長のまま
const PC = [[1280, 720], [1366, 768], [1920, 1080], [1440, 900], [1024, 768]]
for (const [w, h] of PC) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = { title: await fit(q) }
  await q.screenshot({ path: `${ROOT}/shots/fit-pc-${w}x${h}-title.png` })
  await q.evaluate(() => { fvs.bot('learned', 3); fvs.start(3, 5) }); await q.evaluate(() => fvs.run(60 * 6)); await q.waitForTimeout(150)
  views.boss = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-pc-${w}x${h}-boss.png` })
  await q.evaluate(() => { fvs.bot('idle'); fvs.r().hp = 1 }); await q.evaluate(() => fvs.run(60 * 10)); await q.waitForTimeout(1300)
  views.diary = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-pc-${w}x${h}-diary.png` })
  for (const [v, r] of Object.entries(views)) await t(`PC ${w}x${h} ${v}: 一画面・はみ出しなし`, async () => { expect(!r.bad.length && Math.abs(r.cv[0] / r.cv[1] - 16 / 9) < 0.02, JSON.stringify(r)) })
  await t(`PC ${w}x${h}: エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
  await q.close()
}

// ---- スマホ: 左下のスティック（指を置いた所が中心）と右下の大きい丸
// 部品の大きさと置き場所（一画面・重ならない・親指の弧・44px より十分大きい）
const padGeo = q => q.evaluate(() => {
  const W = innerWidth, H = innerHeight
  const bs = [...document.querySelectorAll('#pad .acts button')].map(b => { const r = b.getBoundingClientRect(); return { k: b.dataset.k, cx: r.x + r.width / 2, cy: r.y + r.height / 2, d: r.width, h: r.height } })
  let overlap = []
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.d + b.d) / 2 + 4) overlap.push(a.k + '-' + b.k) }
  const z = document.getElementById('stickZone').getBoundingClientRect()
  const zoneHitsBtn = bs.filter(b => b.cx > z.left && b.cx < z.right && b.cy > z.top && b.cy < z.bottom).map(b => b.k)
  const corner = [...document.querySelectorAll('.corner')].map(c => c.getBoundingClientRect()).filter(c => c.width)
  const zoneHitsCorner = corner.some(c => c.left < z.right && c.right > z.left && c.top < z.bottom && c.bottom > z.top)
  const jump = bs.find(b => b.k === 'jump')
  return { W, H, bs: bs.map(b => b.k + ':' + Math.round(b.d)), min: Math.min(...bs.map(b => b.d)), round: bs.every(b => Math.abs(b.d - b.h) < 1), jumpBig: bs.every(b => b.k === 'jump' || b.d < jump.d), jumpCorner: bs.every(b => b.k === 'jump' || (b.cx < jump.cx + 1 && b.cy < jump.cy + 1)), rightSide: bs.every(b => b.cx > W * 0.5 && b.cy > H * 0.5), overlap, zoneHitsBtn, zoneHitsCorner, zone: [Math.round(z.left), Math.round(z.top), Math.round(z.width), Math.round(z.height)] }
})
const SP = [[844, 390, 'land'], [667, 375, 'land-se'], [390, 844, 'port'], [360, 640, 'port-small']]
// Chromium のタッチ（CDP の本物のタッチ。指2本を同時に置ける）
for (const [w, h, name] of SP) {
  const q = await open(browser, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const views = { title: await fit(q) }
  await q.tap('#btnStart'); await q.waitForTimeout(300)
  views.play = await fit(q)
  const cdp = await q.context().newCDPSession(q)
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  const geo = await padGeo(q)
  await t(`タッチ ${name}: 右下の丸は大きく（44px より十分大きい）親指の弧に並び、重ならない`, async () => {
    expect(geo.min >= 62 && geo.round && geo.jumpBig && geo.jumpCorner && geo.rightSide && !geo.overlap.length && !geo.zoneHitsBtn.length && !geo.zoneHitsCorner, JSON.stringify(geo)); return geo.bs.join(' ')
  })
  const z = await q.locator('#stickZone').boundingBox()
  // 好きな所に指を置く → そこがスティックの中心。右へ倒すと進む
  const sx = Math.round(z.x + z.width * 0.55), sy = Math.round(z.y + z.height * 0.62)
  const x0 = await q.evaluate(() => fvs.r().me.x)
  await T('touchStart', [{ x: sx, y: sy, id: 1 }])
  const c0 = await q.evaluate(() => { const r = document.getElementById('stick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })
  for (let i = 1; i <= 6; i++) { await T('touchMove', [{ x: sx + i * 9, y: sy, id: 1 }]); await q.waitForTimeout(16) }
  await q.waitForTimeout(350)
  const run = await q.evaluate(() => ({ inp: fvs.input(), x: fvs.r().me.x }))
  // 指を置いたまま、別の指で跳ぶ
  const jb = await q.locator('#pad .b-jump').boundingBox(), jx = jb.x + jb.width / 2, jy = jb.y + jb.height / 2
  await T('touchStart', [{ x: sx + 54, y: sy, id: 1 }, { x: jx, y: jy, id: 2 }]); await q.waitForTimeout(90)
  const air = await q.evaluate(() => ({ y: fvs.r().me.y, right: fvs.input().right }))
  await T('touchEnd', [{ x: jx, y: jy, id: 2 }]); await q.waitForTimeout(500)
  // 上に倒すと上へ撃つ向き、下に倒すとしゃがむ
  for (let i = 1; i <= 5; i++) { await T('touchMove', [{ x: sx, y: sy - i * 10, id: 1 }]); await q.waitForTimeout(16) }
  await q.waitForTimeout(80); const upAim = await q.evaluate(() => ({ up: fvs.input().up, aim: fvs.r().me.aim }))
  for (let i = 1; i <= 8; i++) { await T('touchMove', [{ x: sx, y: sy - 50 + i * 12, id: 1 }]); await q.waitForTimeout(16) }
  await q.waitForTimeout(80); const duck = await q.evaluate(() => ({ down: fvs.input().down, duck: fvs.r().me.duck }))
  // 左に大きく動かすと中心が指についてくる。戻すとすぐ右に変わる
  for (let i = 1; i <= 10; i++) { await T('touchMove', [{ x: sx - i * 16, y: sy, id: 1 }]); await q.waitForTimeout(16) }
  await q.waitForTimeout(60); const left = await q.evaluate(() => fvs.input().left)
  for (let i = 1; i <= 4; i++) { await T('touchMove', [{ x: sx - 160 + i * 25, y: sy, id: 1 }]); await q.waitForTimeout(16) }
  await q.waitForTimeout(60); const back = await q.evaluate(() => fvs.input().right)
  await q.screenshot({ path: `${ROOT}/shots/fit-sp-${name}-stick.png` })
  await T('touchEnd', []); await q.waitForTimeout(80)
  const rel = await q.evaluate(() => { const i = fvs.input(); return !i.left && !i.right && !i.up && !i.down && document.getElementById('stick').classList.contains('idle') })
  await t(`タッチ ${name}: 指を置いた所が中心になり、倒した向きに進む・上で上に撃つ・下でしゃがむ・離すと止まる`, async () => {
    const r = { c0: c0.map(Math.round), sx, sy, run, upAim, duck, left, back, rel }
    expect(Math.hypot(c0[0] - sx, c0[1] - sy) < 3 && run.inp.right && run.x > x0 + 40 && upAim.up && upAim.aim === 2 && duck.down && duck.duck && left && back && rel, JSON.stringify(r)); return { dx: Math.round(run.x - x0) }
  })
  await t(`タッチ ${name}: スティックを持ったまま右下の丸で跳べる（指2本）`, async () => { expect(air.y < 460 && air.right, JSON.stringify(air)); return air })
  // 撃つは1回で撃ちっぱなし・もう1回で止まる。ダッシュ・はじく
  const tapBtn = async k => { const b = await q.locator(`#pad [data-k=${k}]`).boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await T('touchStart', [{ x, y, id: 3 }]); await q.waitForTimeout(40); await T('touchEnd', []) }
  const s0 = await q.evaluate(() => fvs.r().stats.shots)
  await tapBtn('shoot'); await q.waitForTimeout(500)
  const s1 = await q.evaluate(() => ({ n: fvs.r().stats.shots, on: fvs.input().shoot }))
  await tapBtn('shoot'); await q.waitForTimeout(100)
  const off = await q.evaluate(() => !fvs.input().shoot)
  await q.waitForTimeout(400)
  const dx0 = await q.evaluate(() => fvs.r().me.x); await tapBtn('dash'); await q.waitForTimeout(200); const dx1 = await q.evaluate(() => fvs.r().me.x)
  await q.waitForTimeout(500); await tapBtn('parry'); await q.waitForTimeout(16)
  const flap = await q.evaluate(() => fvs.r().me.parryT > 0 || fvs.r().me.parryCd > 0)
  await t(`タッチ ${name}: 撃つ（入りっぱなし→止まる）・ダッシュ・はじく`, async () => { expect(s1.n > s0 + 2 && s1.on && off && Math.abs(dx1 - dx0) > 50 && flap, JSON.stringify({ s0, s1, off, dash: dx1 - dx0, flap })) })
  await q.screenshot({ path: `${ROOT}/shots/fit-sp-${name}-play.png` })
  await q.evaluate(() => { fvs.bot('learned', 3); fvs.start(3, 5); fvs.run(60 * 6) }); await q.waitForTimeout(150)
  views.boss = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-sp-${name}-boss.png` })
  await q.evaluate(() => { fvs.bot('idle'); fvs.r().hp = 1; fvs.run(60 * 10) }); await q.waitForTimeout(1300)
  views.diary = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-sp-${name}-diary.png` })
  for (const [v, r] of Object.entries(views)) await t(`スマホ ${name} ${w}x${h} ${v}: 一画面・はみ出しなし`, async () => { expect(!r.bad.length, JSON.stringify(r)) })
  await t(`タッチ ${name}: エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
  await q.close()
}
// 付箋と遊び方の文言がスティックの説明になっている
await t('タッチの遊び方と付箋がスティックと右下の丸の説明', async () => {
  const q = await open(browser); const s = await q.evaluate(async () => (await import('./js/text.js?v=4')).TEXT); await q.close()
  const ok = /左下に指を置いて/.test(s.ja.keysTouch) && /大きい丸で跳ぶ/.test(s.ja.keysTouch) && /パッド/.test(s.ja.keysTouch) && /左下に指を置いて/.test(s.ja.noteT.move[1]) && !/十字/.test(JSON.stringify(s.ja.noteT) + s.ja.keysTouch) && /thumb/.test(s.en.keysTouch)
  expect(ok, JSON.stringify([s.ja.keysTouch, s.ja.noteT.move])); return s.ja.noteT.move
})
await browser.close()

// WebKit（iPhone 相当）: 本物のタップで丸を押す・スティックは指の pointer で動かす・無音
const wb = await webkit.launch()
for (const [w, h, name] of SP) {
  const q = await open(wb, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const views = { title: await fit(q) }
  await q.screenshot({ path: `${ROOT}/shots/fit-sp-${name}-title.png` })
  await q.tap('#btnStart'); await q.waitForTimeout(300)
  views.play = await fit(q)
  const geo = await padGeo(q)
  const z = await q.locator('#stickZone').boundingBox()
  const sx = z.x + z.width * 0.5, sy = z.y + z.height * 0.6
  const before = await q.evaluate(() => fvs.r().me.x)
  await q.evaluate(([x, y]) => { const el = document.getElementById('stickZone'); const ev = (t, dx) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x + dx, clientY: y, bubbles: true, cancelable: true })); ev('pointerdown', 0); ev('pointermove', 30); ev('pointermove', 55) }, [sx, sy])
  await q.waitForTimeout(400)
  const after = await q.evaluate(() => fvs.r().me.x)
  await q.evaluate(([x, y]) => document.getElementById('stickZone').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })), [sx, sy])
  await q.waitForTimeout(400)
  const jb = await q.locator('#pad .b-jump').boundingBox()
  await q.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2); await q.waitForTimeout(60)
  const jumped = await q.evaluate(() => fvs.r().me.y < 469)
  const sb = await q.locator('#pad .b-shoot').boundingBox()
  await q.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await q.waitForTimeout(400)
  const shots = await q.evaluate(() => fvs.r().stats.shots)
  await t(`WebKit ${name}: スティックで進み、右下の丸を本物のタップで跳ぶ・撃つ`, async () => { expect(after > before + 40 && jumped && shots > 2 && geo.min >= 62 && !geo.overlap.length, JSON.stringify({ before, after, jumped, shots, geo: geo.bs })) })
  await q.evaluate(() => { fvs.bot('learned', 3); fvs.start(3, 5); fvs.run(60 * 6) }); await q.waitForTimeout(150)
  views.boss = await fit(q)
  await q.evaluate(() => { fvs.bot('idle'); fvs.r().hp = 1; fvs.run(60 * 10) }); await q.waitForTimeout(1300)
  views.diary = await fit(q)
  for (const [v, r] of Object.entries(views)) await t(`WebKit ${name} ${w}x${h} ${v}: 一画面・はみ出しなし`, async () => { expect(!r.bad.length, JSON.stringify(r)) })
  await t(`WebKit ${name}: 無音（音を鳴らす操作の後）`, async () => { const ok = await q.evaluate(() => window.__muteOk && window.__muteOk()); expect(ok, ok) })
  await t(`WebKit ${name}: エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
  await q.close()
}
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
