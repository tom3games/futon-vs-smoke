import './mute-auto.mjs'
// SNS 用の画像 og.png（1200x630）。魔人が拳を振り上げ、白い輪が飛ぶ場面に題名を重ねる。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(res => srv.stdout.on('data', d => { const m = String(d).match(/localhost:(\d+)/); if (m) res(+m[1]) }))
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1, locale: 'ja-JP' })).newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__fvsReady)
await p.waitForTimeout(800)
const at = Number(process.argv[2] || 0)
await p.evaluate(at => {
  fvs.bot('learned', 3); fvs.start(3, 12)
  // 拳の溜めの終わりごろで止める
  let n = 0
  while (n++ < 60 * 60) { fvs.run(1); const B = fvs.r().boss; if (B && B.act === 'fist' && B.n >= 1 + at && B.actT > B.tell * 0.82) break }
  fvs.bot(null)
}, at)
await p.evaluate(() => { document.querySelectorAll('.corner').forEach(e => e.style.display = 'none'); window.__noHud = true })
await p.evaluate(() => {
  const d = document.createElement('div')
  d.style.cssText = 'position:fixed;left:44px;top:66px;z-index:20;font-family:"Yusei Magic";color:#fff;text-shadow:0 4px 0 #000,0 0 18px rgba(0,0,0,.8)'
  d.innerHTML = '<div style="font-size:44px;color:#f3e9d2">禁煙三日目、</div><div style="font-size:104px;line-height:1;transform:rotate(-2deg)">煙の魔人</div><div style="margin-top:16px;font-size:26px;background:#f4ecd9;color:#1b1b22;display:inline-block;padding:6px 16px 3px;text-shadow:none;border:2.5px solid #1b1b22;box-shadow:5px 5px 0 #e8772e;transform:rotate(-1.5deg)">型を覚えて、布団ではじき返せ</div>'
  document.body.appendChild(d)
})
await p.waitForTimeout(300)
await p.screenshot({ path: ROOT + '/og.png', clip: { x: 0, y: 22, width: 1200, height: 630 } })
await b.close(); srv.kill()
console.log('og.png')
