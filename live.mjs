import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// futon-vs-smoke fvs を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/futon-vs-smoke/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  // 横丁へ移る前の github.io の中身を見る（横丁の登録はメインがやる。それまでは転送先が無い）
  await ctx.route(/tom3games\.github\.io\/futon-vs-smoke\/(\?.*)?$/, async r => { const res = await r.fetch(); const body = (await res.text()).replace(/<script id="ghMove">.*?<\/script>/, ''); r.fulfill({ response: res, body }) })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/tom3games\.com|fonts\./.test(r.url())) errs.push('fail ' + r.url()) })
  await p.goto(URL0 + '?t=' + Date.now()).catch(() => {})
  await p.waitForFunction(() => window.__fvsReady, null, { timeout: 15000 })
  const play = await p.evaluate(() => { fvs.bot('learned', 4); fvs.start(0, 8); let n = 0; while (!fvs.r().won && n++ < 60 * 400) fvs.run(1); return { won: fvs.r().won, hits: fvs.r().stats.hits } })
  await p.waitForTimeout(4000)
  out.push(name + ' play ' + JSON.stringify(play) + ' diary=' + await p.evaluate(() => fvs.diary()))
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch('og.png'); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/futon-vs-smoke', 'https://github.com/tom3games/futon-vs-smoke/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
