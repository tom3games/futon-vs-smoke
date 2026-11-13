// 遊びの中身（描画なし。node の bot でも同じものが回る）。固定 60Hz、乱数は種つき
// 座標は画面の px（y は下向き）。床の高さは GY。1本の長いステージ: 部屋 → 夜の路地 → 屋上の魔人
export const DT = 1 / 60
export const GY = 470
export const AX = 5400              // 屋上（ボスの部屋）の左端
export const VIEW_W = 960, VIEW_H = 540

export const CFG = {
  maxHP: 4, speed: 300, grav: 2300, jumpV: 840, jumpCut: 0.45, coyote: 0.09, buffer: 0.13, maxFall: 1100,
  dashV: 720, dashT: 0.18, dashCd: 0.42,
  w: 40, h: 60, hDuck: 30,
  shotEvery: 0.11, shotV: 1150, shotLife: 0.62, shotDmg: 1,
  parryT: 0.24, parryMissCd: 0.34, parryPad: 20, parryDmg: 24, parryI: 0.5,
  hurtI: 1.25, pitDmg: 1,
  bossHP: 680, phase2: 0.5
}

// ステージの形。床（穴はすき間）、上に乗れる台（下から抜けられる）、横もふさぐ箱
export const STAGE = {
  floors: [[-40, 1150], [1330, 2420], [2580, 3160], [3420, 4560], [4720, AX + 1000]],
  plats: [
    { x0: 2700, x1: 2790, y: 380 },            // 室外機
    { x0: 3230, x1: 3330, y: 400 },            // 穴の上の室外機（使わなくても渡れる）
    { x0: 4040, x1: 4200, y: 360 },            // 外階段の踊り場
    { x0: 4250, x1: 4390, y: 290 },
  ],
  boxes: [
    { x0: 380, x1: 440, y0: 395, y1: GY, k: 'manga' },     // 漫画の山（跳び越える）
    { x0: 2140, x1: 2220, y0: 345, y1: GY, k: 'vend' },    // 自販機
    { x0: 3700, x1: 3780, y0: 390, y1: GY, k: 'manga' },
  ],
  saves: [{ x: 60 }, { x: 1700 }, { x: 3540 }, { x: 5230 }],   // 0 は始まりの布団
  notes: [   // 壁に貼った付箋（遊び方）
    { x: 110, k: 'move' }, { x: 300, k: 'jump' }, { x: 640, k: 'shoot' }, { x: 960, k: 'dash' }, { x: 1440, k: 'parry' }, { x: 1600, k: 'save' }
  ],
  enemies: [
    { k: 'puff', x: 820, y: 430 },
    { k: 'puff', x: 2000, y: 420 }, { k: 'butt', x: 2330 }, { k: 'puff', x: 2500, y: 380 },
    { k: 'butt', x: 2900 }, { k: 'puff', x: 3050, y: 410 }, { k: 'butt', x: 3080 },
    { k: 'puff', x: 3950, y: 400 }, { k: 'butt', x: 4100 }, { k: 'puff', x: 4400, y: 330 }, { k: 'butt', x: 4480 },
    { k: 'puff', x: 4900, y: 420 }, { k: 'butt', x: 5000 }, { k: 'puff', x: 5100, y: 380 }
  ],
  vents: [   // 煙の輪を吐く換気扇。はじく練習
    { x: 1560, y: 420, every: 2.6, v: 150, kinds: ['cream'] },
    { x: 3360, y: 0, every: 0, v: 0, kinds: [] },
  ].filter(v => v.every > 0),
  end: AX + 960
}
export const ARENA = { x0: AX + 24, x1: AX + 600, bossX: AX + 760, headX: AX + 720, headY: 215, mouthX: AX + 660, mouthY: 230 }

const clamp = (v, a, b) => v < a ? a : v > b ? b : v
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
const emit = (r, k, o) => r.ev.push({ k, t: r.t, ...o })
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

export function meBox(m) { const h = m.duck ? CFG.hDuck : CFG.h; return { x0: m.x - CFG.w / 2, x1: m.x + CFG.w / 2, y0: m.y - h, y1: m.y } }

export function newRun(seed = 1, opt = {}) {
  const r = {
    seed, rnd: rng(seed), t: 0, frame: 0, ev: [], over: false, won: false,
    mode: 'stage', modeT: 0, save: opt.save || 0, maxX: 0,
    hp: CFG.maxHP, shots: [], foes: [], rings: [], fx: [], id: 1, hitstop: 0,
    me: null, boss: null, vents: [],
    stats: { hits: 0, parries: 0, deaths: 0, shots: 0, kills: 0, pits: 0, startT: 0, bossT: 0, bossBest: 1, hitsBoss: 0 },
    deathAt: null, saved: [true, false, false, false]
  }
  for (let i = 1; i <= r.save; i++) r.saved[i] = true
  spawnAt(r, r.save)
  return r
}

function spawnAt(r, si) {
  const x = STAGE.saves[si].x + 30
  r.me = { x, y: GY, vx: 0, vy: 0, ground: true, face: 1, duck: false, dashT: 0, dashCd: 0, dashDir: 1, airDash: true, iT: 0.6, parryT: 0, parryCd: 0, coy: 0, buf: 0, jumping: false, shotT: 0, aim: 0, lastSafe: x, knock: 0, wasJump: false, wasDash: false, wasParry: false, parryHit: false }
  r.hp = CFG.maxHP
  r.shots = []; r.rings = []; r.fx = []
  r.foes = STAGE.enemies.filter(e => e.x > x + 200).map(e => ({ ...e, id: r.id++, hp: e.k === 'puff' ? 3 : 2, y: e.k === 'butt' ? GY : e.y, by: e.y, vx: 0, vy: 0, t: 0, awake: false, dir: -1, hopT: 1 }))
  r.vents = STAGE.vents.map(v => ({ ...v, t: v.every * 0.6, n: 0 }))
  r.boss = null; r.mode = 'stage'; r.modeT = 0
  if (si === 3) r.stats.bossTries = (r.stats.bossTries || 0)
}

export const fraction = r => r.boss ? Math.max(0, r.boss.hp) / CFG.bossHP : 1
export const leftPct = r => Math.max(0, Math.ceil(fraction(r) * 100))
export const progress = x => clamp(x / STAGE.end, 0, 1)

function setMode(r, m) { r.mode = m; r.modeT = 0; emit(r, 'mode', { m }) }

function hurt(r, by, dmg = 1) {
  const m = r.me
  if (m.iT > 0 || r.over || r.mode === 'win' || r.mode === 'dead') return false
  r.hp -= dmg; r.stats.hits++
  if (r.boss) r.stats.hitsBoss++
  m.iT = CFG.hurtI; m.knock = 0.18; m.vx = -m.face * 260; m.vy = -380; m.ground = false; m.dashT = 0
  r.hitstop = 0.07
  emit(r, 'hurt', { by })
  if (r.hp <= 0) die(r, by)
  return true
}
function die(r, by) {
  r.hp = 0; r.stats.deaths++
  r.deathAt = { x: r.me.x, boss: r.boss ? fraction(r) : null, by, save: r.save }
  if (r.boss) r.stats.bossBest = Math.min(r.stats.bossBest, fraction(r))
  setMode(r, 'dead'); emit(r, 'die', { by })
}
// 死んだ後、最後に寝た布団から（opt で最初から）
export function respawn(r, fromStart = false) {
  if (fromStart) { r.save = 0; r.saved = [true, false, false, false]; r.stats = { hits: 0, parries: 0, deaths: 0, shots: 0, kills: 0, pits: 0, startT: r.t, bossT: 0, bossBest: 1, hitsBoss: 0 } }
  spawnAt(r, r.save); r.deathAt = null
  emit(r, 'respawn', { save: r.save })
}

// ------------------------------------------------------------ 地形
function solidsAt(x0, x1) { return STAGE.floors.some(([a, b]) => x1 > a && x0 < b) }
function moveX(r, m, dx) {
  m.x += dx
  const b = meBox(m)
  for (const k of STAGE.boxes) {
    if (b.y1 > k.y0 + 2 && b.y0 < k.y1 && b.x1 > k.x0 && b.x0 < k.x1) {
      if (dx > 0) m.x = k.x0 - CFG.w / 2; else if (dx < 0) m.x = k.x1 + CFG.w / 2
      else m.x = (m.x < (k.x0 + k.x1) / 2) ? k.x0 - CFG.w / 2 : k.x1 + CFG.w / 2
      m.vx = 0
    }
  }
  const L = r.boss ? ARENA.x0 : -20, R = r.boss ? ARENA.x1 : STAGE.end
  m.x = clamp(m.x, L, R)
}
function moveY(r, m, dy) {
  const prev = m.y
  m.y += dy
  m.ground = false
  if (dy < 0) {   // 頭を箱にぶつける
    const b = meBox(m)
    for (const k of STAGE.boxes) if (b.x1 > k.x0 && b.x0 < k.x1 && b.y0 < k.y1 && prev - (m.duck ? CFG.hDuck : CFG.h) >= k.y1 - 1) { m.y = k.y1 + (m.duck ? CFG.hDuck : CFG.h); m.vy = 0 }
    return
  }
  const x0 = m.x - CFG.w / 2 + 4, x1 = m.x + CFG.w / 2 - 4
  let top = Infinity
  if (prev <= GY + 0.01 && m.y >= GY && solidsAt(x0, x1)) top = GY
  for (const p of STAGE.plats) if (x1 > p.x0 && x0 < p.x1 && prev <= p.y + 0.01 && m.y >= p.y) top = Math.min(top, p.y)
  for (const k of STAGE.boxes) if (x1 > k.x0 && x0 < k.x1 && prev <= k.y0 + 0.01 && m.y >= k.y0) top = Math.min(top, k.y0)
  if (top < Infinity) { m.y = top; m.vy = 0; m.ground = true }
}

// ------------------------------------------------------------ 自分
// inp: { left, right, up, down, jump, shoot, dash, parry }（押している間 true）
function stepMe(r, inp, dt) {
  const m = r.me, C = CFG
  const jumpP = inp.jump && !m.wasJump, dashP = inp.dash && !m.wasDash, parryP = inp.parry && !m.wasParry
  m.wasJump = !!inp.jump; m.wasDash = !!inp.dash; m.wasParry = !!inp.parry
  m.iT = Math.max(0, m.iT - dt); m.dashCd = Math.max(0, m.dashCd - dt); m.parryCd = Math.max(0, m.parryCd - dt)
  m.knock = Math.max(0, m.knock - dt)
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0)
  if (dir && m.dashT <= 0) m.face = dir
  if (r.boss && inp.shoot && m.dashT <= 0) m.face = 1   // 魔人の前では、撃っている間は魔人の方を向いたまま下がれる
  m.duck = !!inp.down && m.ground && m.dashT <= 0
  m.aim = inp.up ? (dir ? 1 : 2) : 0   // 0 前 / 1 斜め上 / 2 真上

  // はじく（布団をばさっと払う）
  if (parryP && m.parryT <= 0 && m.parryCd <= 0) { m.parryT = C.parryT; m.parryHit = false; emit(r, 'parryTry') }
  if (m.parryT > 0) { m.parryT -= dt; if (m.parryT <= 0 && !m.parryHit) m.parryCd = C.parryMissCd }

  // ダッシュ（空中は1回）
  if (dashP && m.dashCd <= 0 && m.dashT <= 0 && (m.ground || m.airDash)) {
    m.dashT = C.dashT; m.dashDir = dir || m.face; m.face = m.dashDir; m.dashCd = C.dashCd; if (!m.ground) m.airDash = false; m.vy = 0
    r.stats.dashes = (r.stats.dashes || 0) + 1; emit(r, 'dash')
  }
  if (m.ground) { m.coy = C.coyote; m.airDash = true } else m.coy = Math.max(0, m.coy - dt)
  if (jumpP) m.buf = C.buffer; else m.buf = Math.max(0, m.buf - dt)

  if (m.dashT > 0) {
    m.dashT -= dt
    moveX(r, m, m.dashDir * C.dashV * dt)
    if (m.dashT <= 0) m.vx = m.dashDir * C.speed
  } else {
    if (m.knock > 0) { m.vx *= 0.9 } else m.vx = m.duck ? 0 : dir * C.speed
    if (m.buf > 0 && m.coy > 0) { m.vy = -C.jumpV; m.ground = false; m.coy = 0; m.buf = 0; m.jumping = true; m.duck = false; emit(r, 'jump') }
    if (m.jumping && !inp.jump && m.vy < 0) { m.vy *= C.jumpCut; m.jumping = false }
    if (m.vy >= 0) m.jumping = false
    m.vy = Math.min(C.maxFall, m.vy + C.grav * dt)
    moveX(r, m, m.vx * dt)
    const was = m.ground
    moveY(r, m, m.vy * dt)
    if (!was && m.ground) emit(r, 'land')
  }
  if (m.ground && solidsAt(m.x - 4, m.x + 4) && !r.boss) m.lastSafe = m.x
  if (m.ground) r.maxX = Math.max(r.maxX, m.x)

  // 穴に落ちた
  if (m.y > VIEW_H + 80) {
    r.stats.pits++
    emit(r, 'pit')
    m.iT = 0
    if (!hurt(r, 'pit', C.pitDmg) && r.mode !== 'dead') {}
    if (r.mode !== 'dead') {
      // 穴の手前の床に戻す
      let x = m.lastSafe
      for (const [a, b] of STAGE.floors) if (x >= a && x <= b) x = clamp(x - 60, a + 24, b - 24)
      m.x = x; m.y = GY; m.vy = 0; m.vx = 0; m.ground = true; m.iT = CFG.hurtI
    }
  }

  // 撃つ
  m.shotT = Math.max(0, m.shotT - dt)
  if (inp.shoot && m.shotT <= 0 && m.dashT <= 0 && m.knock <= 0) {
    m.shotT = C.shotEvery
    const a = m.aim, f = m.face
    const vx = a === 2 ? 0 : a === 1 ? f * C.shotV * 0.7071 : f * C.shotV
    const vy = a === 2 ? -C.shotV : a === 1 ? -C.shotV * 0.7071 : 0
    const hy = m.duck ? m.y - 16 : m.y - 34
    const sx = m.x + (a === 2 ? f * 6 : f * 24)
    r.shots.push({ id: r.id++, x: sx, y: a === 2 ? m.y - 64 : hy, vx, vy, life: C.shotLife, wob: (r.frame % 3) - 1 })
    r.stats.shots++
    emit(r, 'shot')
  }
}

// ------------------------------------------------------------ 道中の敵
function stepFoes(r, dt) {
  const m = r.me
  for (const e of r.foes) {
    if (!e.awake && Math.abs(e.x - m.x) < 640) e.awake = true
    if (!e.awake) continue
    e.t += dt
    if (e.hitT) e.hitT = Math.max(0, e.hitT - dt)
    if (e.k === 'puff') {
      // ふわふわ寄ってくる。上下にゆれて、撃つ高さを横切る
      e.x += (m.x < e.x ? -1 : 1) * 70 * dt
      e.y = e.by + Math.sin(e.t * 2.2) * 34
    } else {
      // 吸い殻: 歩いて、ときどき跳ねる。床の端で引き返す
      e.dir = m.x < e.x ? -1 : 1
      e.vy += CFG.grav * dt
      const nx = e.x + e.dir * 70 * dt
      if (solidsAt(nx - 10, nx + 10) || e.y < GY) e.x = nx
      e.y += e.vy * dt
      if (e.y >= GY && solidsAt(e.x - 10, e.x + 10)) { e.y = GY; e.vy = 0; e.hopT -= dt; if (e.hopT <= 0) { e.vy = -520; e.hopT = 1.6 } }
    }
    const b = e.k === 'puff' ? { x0: e.x - 24, x1: e.x + 24, y0: e.y - 22, y1: e.y + 22 } : { x0: e.x - 12, x1: e.x + 12, y0: e.y - 44, y1: e.y }
    e.box = b
    if (overlap(meBox(m), b)) hurt(r, e.k)
  }
  // 換気扇の煙の輪（道中のはじく練習）
  for (const v of r.vents) {
    if (Math.abs(v.x - m.x) > 700) continue
    v.t -= dt
    if (v.t <= 0) { v.t = v.every; const k = v.kinds[v.n++ % v.kinds.length]; r.rings.push(ringObj(r, v.x, v.y, -v.v, k, 'vent')) }
  }
}

function ringObj(r, x, y, vx, kind, from) {
  return { id: r.id++, x, y, vx, vy: 0, kind, from, back: false, hw: 16, hh: kind === 'cream' ? 24 : 24, life: 6 }
}

// ------------------------------------------------------------ 弾
function stepShots(r, dt) {
  const keep = []
  for (const s of r.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt
    let hit = false
    for (const e of r.foes) {
      if (!e.awake || !e.box || e.hp <= 0) continue
      if (s.x > e.box.x0 - 6 && s.x < e.box.x1 + 6 && s.y > e.box.y0 - 6 && s.y < e.box.y1 + 6) {
        e.hp -= CFG.shotDmg; e.hitT = 0.08; hit = true
        if (e.hp <= 0) { r.stats.kills++; emit(r, 'kill', { foe: e.k, x: e.x, y: e.y }) } else emit(r, 'tick', { x: s.x, y: s.y })
        break
      }
    }
    const B = r.boss
    if (!hit && B && B.hp > 0 && !B.inv && s.x > B.box.x0 && s.x < B.box.x1 && s.y > B.box.y0 && s.y < B.box.y1) {
      B.hp -= CFG.shotDmg; B.flash = Math.max(B.flash, 0.03); hit = true; emit(r, 'bossTick', { x: s.x, y: s.y })
    }
    if (!hit && s.life > 0 && s.y > -40) keep.push(s)
  }
  r.shots = keep
  r.foes = r.foes.filter(e => e.hp > 0)
}

function stepRings(r, dt) {
  const m = r.me, mb = meBox(m), keep = []
  for (const g of r.rings) {
    g.x += g.vx * dt; g.y += g.vy * dt; g.life -= dt
    if (g.back) {
      const B = r.boss
      if (B && Math.abs(g.x - ARENA.headX) < 70 && Math.abs(g.y - ARENA.headY) < 80) {
        if (!B.inv) { B.hp -= CFG.parryDmg; B.flash = 0.15 }
        emit(r, 'ringHit', { x: g.x, y: g.y }); continue
      }
      if (g.life > 0 && g.x < STAGE.end + 200 && g.y > -100) keep.push(g)
      continue
    }
    const gb = { x0: g.x - g.hw, x1: g.x + g.hw, y0: g.y - g.hh, y1: g.y + g.hh }
    // はじく: 受付中に、少し広めの箱に入ったら跳ね返す
    if (g.kind === 'cream' && m.parryT > 0) {
      const P = CFG.parryPad, pb = { x0: mb.x0 - P, x1: mb.x1 + P, y0: mb.y0 - P, y1: mb.y1 + P }
      if (overlap(pb, gb)) {
        m.parryHit = true; m.parryT = 0; m.parryCd = 0; m.iT = Math.max(m.iT, CFG.parryI); r.hitstop = 0.11
        r.stats.parries++
        if (!m.ground) { m.vy = -620; m.airDash = true }
        g.back = true
        if (r.boss) { const dx = ARENA.headX - g.x, dy = ARENA.headY - g.y, d = Math.hypot(dx, dy); g.vx = dx / d * 950; g.vy = dy / d * 950 }
        else { g.vx = 700 * Math.sign(g.x - m.x || 1); g.vy = -400; g.life = 1.2 }
        emit(r, 'parry', { x: g.x, y: g.y })
        keep.push(g); continue
      }
    }
    if (overlap(mb, gb)) { if (hurt(r, 'ring-' + g.kind)) continue }
    if (g.life > 0 && g.x > -100 && g.x < STAGE.end + 200) keep.push(g)
  }
  r.rings = keep
}

// ------------------------------------------------------------ 煙の魔人
// 型: fist（拳落とし）/ flick（吸い殻はじき）/ rings（煙の輪）/ sweep（薙ぎ払い・2段階だけ）
// どの型も「溜め」の間に、どこが危ないかを絵で出す（影・火の印・ほっぺ・手の高さ）
export const TELL = { fist: 0.95, flick: 0.6, rings: 0.85, sweep: 1.0 }
const ORDER1 = ['fist', 'rings', 'flick', 'fist', 'flick', 'rings']
const ORDER2 = ['sweep', 'fist', 'rings', 'flick', 'sweep', 'rings', 'fist', 'flick']
const FLICK_PATS = [[90, 250, 410, 570], [170, 330, 490], [60, 220, 380, 540]]
const RING_PATS1 = [['low', 'high', 'cream'], ['high', 'low', 'cream'], ['low', 'cream', 'high'], ['cream', 'high', 'low']]
const RING_PATS2 = [['low', 'high', 'cream', 'low', 'high'], ['high', 'low', 'high', 'cream', 'low'], ['low', 'low', 'cream', 'high', 'high']]

function enterBoss(r) {
  r.boss = {
    hp: CFG.bossHP, phase: 1, act: null, actT: 0, cool: 0, i: 0, n: 0, inv: true, flash: 0,
    box: { x0: AX + 645, x1: AX + 880, y0: 110, y1: GY }, say: null, sayT: 0,
    fist: null, flick: null, sweep: null, ringsLeft: [], fires: [], waves: [], tellX: null, pat: null, deadT: 0
  }
  r.foes = []; r.rings = []
  r.stats.bossTries = (r.stats.bossTries || 0) + 1
  r.stats.bossStartT = r.t
  setMode(r, 'intro'); bossSay(r, 'intro', 2.4)
  emit(r, 'bossIn')
}
function bossSay(r, k, t) { r.boss.say = k; r.boss.sayT = t; emit(r, 'say', { k }) }

function pickAct(r) {
  const B = r.boss, O = B.phase === 1 ? ORDER1 : ORDER2
  const a = O[B.i % O.length]; B.i++
  return a
}
function startAct(r, a) {
  const B = r.boss, m = r.me, sp = B.phase === 2 ? 0.85 : 1
  B.act = a; B.actT = 0; B.tell = Math.max(0.6, TELL[a] * sp); B.n++
  if (a === 'fist') B.fist = { x: clamp(m.x, ARENA.x0 + 50, ARENA.x1 - 30), st: 'tell', y: -200 }
  if (a === 'flick') { const P = FLICK_PATS[Math.floor(r.rnd() * FLICK_PATS.length)]; B.flick = { spots: P.map(s => AX + s), wave: 0, st: 'tell', butts: [] } }
  if (a === 'rings') { const P = B.phase === 1 ? RING_PATS1 : RING_PATS2; B.ringsLeft = P[Math.floor(r.rnd() * P.length)].slice(); B.ringT = 0 }
  if (a === 'sweep') B.sweep = { low: r.rnd() < 0.5, st: 'tell', x: ARENA.x1 + 60 }
  emit(r, 'act', { a })
}

function stepBoss(r, dt) {
  const B = r.boss, m = r.me
  B.flash = Math.max(0, B.flash - dt)
  if (B.sayT > 0) { B.sayT -= dt; if (B.sayT <= 0) B.say = null }
  // 火の跡と衝撃波
  for (const f of B.fires) { f.t -= dt; if (f.t > 0 && overlap(meBox(m), { x0: f.x - 30, x1: f.x + 30, y0: GY - 46, y1: GY })) hurt(r, 'fire') }
  B.fires = B.fires.filter(f => f.t > 0)
  for (const w of B.waves) { w.x += w.v * dt; if (overlap(meBox(m), { x0: w.x - 18, x1: w.x + 18, y0: GY - 34, y1: GY })) hurt(r, 'wave') }
  B.waves = B.waves.filter(w => w.x > ARENA.x0 - 60 && w.x < ARENA.x1 + 80)

  if (r.mode === 'intro') { if (r.modeT > 2.4) { B.inv = false; setMode(r, 'boss'); B.cool = 0.5 } return }
  if (r.mode === 'phase') {
    if (r.modeT > 2.3) { B.inv = false; setMode(r, 'boss'); B.cool = 0.4 }
    return
  }
  if (r.mode === 'win') return
  if (B.hp <= 0) {
    B.hp = 0; B.act = null; B.fist = B.flick = B.sweep = null; B.fires = []; B.waves = []; r.rings = r.rings.filter(g => g.back)
    r.won = true; r.over = true; r.stats.bossT = r.t - r.stats.bossStartT
    setMode(r, 'win'); bossSay(r, 'down', 3); emit(r, 'win'); return
  }
  if (B.phase === 1 && B.hp <= CFG.bossHP * CFG.phase2 && !B.act) {
    B.phase = 2; B.inv = true; B.i = 0; setMode(r, 'phase'); bossSay(r, 'phase2', 2.3); emit(r, 'phase2'); return
  }
  if (!B.act) {
    B.cool -= dt
    if (B.cool <= 0) startAct(r, pickAct(r))
    return
  }
  B.actT += dt
  const T = B.tell, t = B.actT
  if (B.act === 'fist') {
    const F = B.fist
    if (t < T) { F.st = 'tell' }
    else if (t < T + 0.1) { F.st = 'fall'; F.y = (t - T) / 0.1 }
    else if (t < T + 0.55) {
      if (F.st !== 'down') { F.st = 'down'; emit(r, 'slam', { x: F.x }); if (B.phase === 2) B.waves.push({ x: F.x - 70, v: -430 }, { x: F.x + 70, v: 430 }) }
      if (overlap(meBox(m), { x0: F.x - 72, x1: F.x + 72, y0: GY - 150, y1: GY })) hurt(r, 'fist')
    } else if (t < T + 1.0) F.st = 'up'
    else endAct(r)
  } else if (B.act === 'flick') {
    const K = B.flick
    // 弾く → 0.75 秒の放物線 → 落ちた所が 1.1 秒燃える。落ちる場所の印は弾く前から出ている
    if (t >= T && K.st === 'tell') {
      K.st = 'fly'; K.flyT = 0; emit(r, 'flick')
      K.butts = K.spots.map(x => ({ x, t: 0 }))
    }
    if (K.st === 'fly') {
      K.flyT += dt
      if (K.flyT >= 0.75) {
        for (const b of K.butts) B.fires.push({ x: b.x, t: B.phase === 2 ? 0.8 : 1.1 })
        emit(r, 'land', { fires: K.butts.length })
        K.butts = []
        if (B.phase === 2 && K.wave === 0) {
          K.wave = 1; K.st = 'tell2'; K.t2 = 0
          const all = FLICK_PATS.filter(p => p.map(s => AX + s).join() !== K.spots.join())
          K.spots = all[Math.floor(r.rnd() * all.length)].map(s => AX + s)
        } else K.st = 'done'
      }
    }
    if (K.st === 'tell2') { K.t2 += dt; if (K.t2 > 0.65) { K.st = 'fly'; K.flyT = 0; emit(r, 'flick'); K.butts = K.spots.map(x => ({ x, t: 0 })) } }
    if (K.st === 'done' && B.fires.length === 0) endAct(r)
  } else if (B.act === 'rings') {
    if (t >= T) {
      B.ringT -= dt
      if (B.ringT <= 0 && B.ringsLeft.length) {
        const k = B.ringsLeft.shift(), y = k === "high" ? GY - 74 : GY - 26
        const g = ringObj(r, ARENA.mouthX - 20, y, B.phase === 2 ? -360 : -300, k, 'boss')
        r.rings.push(g); B.ringT = B.phase === 2 ? 0.62 : 0.75; emit(r, 'ring', { kind: k })
      }
      if (!B.ringsLeft.length && !r.rings.some(g => !g.back && g.from === 'boss')) endAct(r)
    }
  } else if (B.act === 'sweep') {
    const S = B.sweep
    if (t >= T && S.st === 'tell') { S.st = 'go'; emit(r, 'sweep', { low: S.low }) }
    if (S.st === 'go') {
      S.x -= 1250 * dt
      const band = S.low ? { y0: GY - 54, y1: GY } : { y0: GY - 150, y1: GY - 40 }
      if (overlap(meBox(m), { x0: S.x - 60, x1: S.x + 60, ...band })) hurt(r, 'sweep')
      if (S.x < ARENA.x0 - 160) { S.st = 'back'; S.bt = 0 }
    }
    if (S.st === 'back') { S.bt += dt; if (S.bt > 0.45) endAct(r) }
  }
}
function endAct(r) {
  const B = r.boss
  B.act = null; B.fist = null; B.sweep = null; if (B.flick && B.flick.st === 'done') B.flick = null
  B.cool = B.phase === 2 ? 0.55 : 0.85
}

// ------------------------------------------------------------ 1コマ
export function step(r, inp = {}, dt = DT) {
  r.ev.length = 0
  r.frame++; r.t += dt; r.modeT += dt
  if (r.mode === 'dead' || (r.mode === 'win' && r.modeT > 6)) return r
  if (r.hitstop > 0) { r.hitstop -= dt; return r }
  if (r.mode === 'saving') { if (r.modeT > 0.9) setMode(r, 'stage'); return r }
  stepMe(r, r.mode === 'win' || r.mode === 'intro' ? {} : inp, dt)
  if (r.mode === 'dead') return r
  stepShots(r, dt)
  if (!r.boss) {
    stepFoes(r, dt)
    // 布団を敷く（セーブ）
    for (let i = 1; i < STAGE.saves.length; i++) {
      if (!r.saved[i] && r.me.x >= STAGE.saves[i].x - 10 && r.me.ground) {
        r.saved[i] = true; r.save = i; r.hp = CFG.maxHP; r.rings = []
        setMode(r, 'saving'); emit(r, 'save', { i }); break
      }
    }
    if (r.me.x > AX + 40 && r.mode === 'stage') enterBoss(r)
  } else stepBoss(r, dt)
  stepRings(r, dt)
  return r
}

export function snapshot(r) {
  return JSON.stringify({ f: r.frame, x: Math.round(r.me.x * 100), y: Math.round(r.me.y * 100), hp: r.hp, m: r.mode, b: r.boss && r.boss.hp, s: r.shots.length, g: r.rings.length })
}
