// 自動で遊ぶ役。sim.mjs（分布の確かめ）と、URL の #bot（画面で見る確認）で使う
// learned: 魔人の型を覚えた人。溜めを見て、決まった抜け方をする
// human:   覚えてはいるが、反応が 0.25 秒遅れ、押す時刻が ±0.06 秒ずれる人
// random:  型を知らない人。右へ進みながら、ボタンを適当に押す
// idle:    何もしない
import { CFG, GY, ARENA, STAGE, meBox } from './sim.js?v=4'

function rng(seed) { let s = (seed >>> 0) % 2147483647 || 7; return () => (s = (s * 48271) % 2147483647) / 2147483647 }

export function makeBot(kind, seed = 1) {
  const R = rng(seed * 13 + 5)
  const st = { kind, R, hold: {}, holdT: 0, jumpHold: 0, err: new Map(), react: 0, lastAct: null, lastActN: -1, target: null, home: ARENA.x0 + 330 }
  if (kind === 'idle') return () => ({})
  if (kind === 'random') return r => randomBot(st, r)
  if (kind === 'naive') return r => naiveBot(st, r)
  if (kind === 'sloppy') { st.errMax = 0.12; return r => smartBot(st, r, true) }   // 型は知っているが、押す時刻が ±0.12 秒ずれる
  return r => smartBot(st, r, kind === 'human')
}

function randomBot(st, r) {
  st.holdT -= 1 / 60
  if (st.holdT <= 0) {
    const R = st.R
    st.hold = { right: R() < 0.62, left: R() < 0.18, up: R() < 0.15, down: R() < 0.1, jump: R() < 0.35, shoot: R() < 0.8, dash: R() < 0.12, parry: R() < 0.12 }
    st.holdT = 0.15 + R() * 0.45
  }
  return st.hold
}

// naive: 道中は learned と同じ。魔人の型は知らない。何か飛んで来たら跳ぶだけで、拳の影や火の印は気にしない
function naiveBot(st, r) {
  if (!r.boss) return smartBot(st, r, true)
  const m = r.me, inp = { shoot: true, right: m.x < ARENA.x0 + 330 }
  let jump = false
  for (const g of r.rings) if (!g.back && g.vx < 0) { const d = g.x - g.hw - (m.x + CFG.w / 2); if (d < 50 && d > -20) jump = true }
  if (r.boss.sweep && r.boss.sweep.st === 'go') { const d = r.boss.sweep.x - 60 - (m.x + CFG.w / 2); if (d < 200 && d > 0) jump = true }
  for (const w of r.boss.waves) { const d = Math.abs(w.x - m.x); if (d < 60) jump = true }
  if (jump && st.jumpHold <= 0 && !st.jumpWas) st.jumpHold = 0.45
  inp.jump = st.jumpHold > 0; st.jumpHold -= 1 / 60; st.jumpWas = inp.jump
  return inp
}

// 物ごとに、押す時刻のずれ（秒）を1回だけ決める（人は毎回同じではない）
function errFor(st, id, human) {
  if (!human) return 0
  if (!st.err.has(id)) st.err.set(id, (st.R() * 2 - 1) * (st.errMax || 0.06))
  return st.err.get(id)
}

function smartBot(st, r, human) {
  const m = r.me, inp = { shoot: true }
  const B = r.boss
  let wantX = null, jump = false, duck = false, parry = false, up = false
  const nearFront = (g) => g.x - g.hw - (m.x + CFG.w / 2)   // 前の物までの距離

  // 煙の輪（道中の換気扇と、魔人の輪）
  for (const g of r.rings) {
    if (g.back || g.vx >= 0) continue
    const d = nearFront(g), v = -g.vx, e = errFor(st, g.id, human) * v
    if (g.x + g.hw < m.x - CFG.w / 2) continue
    if (g.kind === 'cream') { if (d < 30 + e && d > -30) parry = true }
    else if (g.kind === 'low') { if (d < 46 * v / 300 + e && d > -40) jump = true }
    else if (g.kind === 'high') { if (d < 90 + e) duck = true }
  }

  if (!B) {
    // 道中: 右へ。穴と箱は跳ぶ、広い穴は跳んでからダッシュ
    wantX = STAGE.end
    const ahead = m.x + CFG.w / 2
    for (const [a, b] of STAGE.floors) {
      if (b > m.x && b - ahead < 26 && b - ahead > -10 && m.ground) {
        const next = STAGE.floors.find(f => f[0] > b)
        jump = true; st.longJump = true
        st.gapDash = next && next[0] - b > 170 ? next[0] : 0
      }
    }
    if (st.gapDash && !m.ground && m.vy > -260 && m.airDash) inp.dash = true
    if (m.ground) st.gapDash = 0
    for (const k of STAGE.boxes) if (k.x0 > m.x && k.x0 - ahead < 50 && m.ground && m.y > k.y0) { jump = true; st.longJump = true }
    // 浮いている煙は斜め上で撃つ。吸い殻が跳ねて来たら跳び越えない（撃ち落とす）
    let near = null
    for (const e of r.foes) if (e.awake && e.x > m.x - 10 && e.x - m.x < 520 && (!near || e.x < near.x)) near = e
    if (near && near.k === 'puff' && near.y < m.y - 80 && near.x - m.x > 60) up = true
    if (near && near.x - m.x < 150 && near.x - m.x > 0) {
      // 近い敵は、倒すまで少し下がって撃つ
      wantX = m.x - 40
      if (near.k === 'puff' && near.y > m.y - 70 && near.y < m.y + 10 && near.x - m.x < 80) duck = true
    }
    if (r.mode === 'saving') wantX = null
  } else if (r.mode === 'boss' || r.mode === 'phase' || r.mode === 'intro') {
    wantX = st.home
    // 反応の遅れ: 型が始まってから react 秒は、前の場所のまま
    if (B.act && B.n !== st.lastActN) { st.lastActN = B.n; st.react = human ? 0.25 : 0.05 }
    st.react = Math.max(0, st.react - 1 / 60)
    const ready = st.react <= 0
    if (B.act === 'fist' && B.fist) {
      const F = B.fist
      if (ready || st.target != null) {
        if (st.target == null || st.targetFor !== B.n) { st.targetFor = B.n; st.target = F.x > ARENA.x0 + 290 ? ARENA.x0 + 40 : ARENA.x1 - 10 }
        if (F.st !== 'up') wantX = st.target
      }
      if (Math.abs(m.x - F.x) < 120 && F.st === 'tell' && B.actT > B.tell - 0.35 && m.dashCd <= 0) inp.dash = true
    } else if (B.act === 'flick' && B.flick && B.flick.st !== 'done') {
      const S = B.flick.spots
      if (ready) {
        let best = null
        for (let x = ARENA.x0; x <= ARENA.x1; x += 5) {
          if (S.every(s => Math.abs(x - s) > 30 + CFG.w / 2 + 8)) { if (best == null || Math.abs(x - m.x) < Math.abs(best - m.x)) best = x }
        }
        wantX = best
      } else wantX = null
    } else if (B.act === 'rings') wantX = ARENA.x0 + 250
    else if (B.act === 'sweep' && B.sweep) {
      const S = B.sweep, e = errFor(st, 'sw' + B.n, human) * 1250
      if (S.st === 'go') {
        const d = S.x - 60 - (m.x + CFG.w / 2)
        if (S.low) { if (d < 250 + e && d > -140) jump = true }
        else if (d < 200 && d > -140) duck = true
      } else if (!S.low && S.st === 'tell' && B.actT > B.tell - 0.2) duck = true
      wantX = null
    } else if (B.fires && B.fires.length) wantX = null
    // 衝撃波
    for (const w of B.waves) {
      const d = w.v < 0 ? (w.x - 18) - (m.x + CFG.w / 2) : (m.x - CFG.w / 2) - (w.x + 18)
      if (d < 26 && d > -30) jump = true
    }
  }
  // 燃えている所は通らない（消えるまで待つ）
  if (B && wantX != null) for (const f of B.fires) { const a = Math.min(m.x, wantX) - CFG.w / 2 - 4, b = Math.max(m.x, wantX) + CFG.w / 2 + 4; if (a < f.x + 30 && b > f.x - 30) { wantX = null; break } }
  if (wantX != null) {
    if (wantX > m.x + 6) inp.right = true
    else if (wantX < m.x - 6) inp.left = true
  }
  // 撃つ向き: 魔人の前では常に右を向く（左へ動いても）
  if (B && !inp.right) { if (inp.left && wantX != null && Math.abs(wantX - m.x) > 40) {} else inp.right = false }
  if (duck && m.ground) { inp.down = true; inp.left = inp.right = false }
  if (jump && st.jumpHold <= 0 && !st.jumpWas) { st.jumpHold = st.longJump ? 0.45 : 0.2; st.longJump = false }
  inp.jump = st.jumpHold > 0; st.jumpHold -= 1 / 60; st.jumpWas = inp.jump
  if (parry) inp.parry = !st.parryLast
  st.parryLast = !!inp.parry
  if (up) inp.up = true
  return inp
}
