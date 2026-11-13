// 画面・音・入力。遊びの中身は shared/sim.js（固定 60Hz）
import { newRun, step, respawn, DT, GY, AX, STAGE, ARENA, CFG, fraction, leftPct, progress } from '../shared/sim.js?v=4'
import { makeBot } from '../shared/bot.js?v=4'
import { ART } from './art.js?v=4'
import { TEXT } from './text.js?v=4'

window.__jsUp = true
const $ = id => document.getElementById(id)
const cv = $('cv'), ctx = cv.getContext('2d')
const W = 960, H = 540
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
const ease = k => k * k * (3 - 2 * k)

// ------------------------------------------------------------ 言葉
let lang = 'ja'
try { lang = localStorage.getItem('fvs_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en') } catch (e) {}
const T = () => TEXT[lang]
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k])

// ------------------------------------------------------------ 絵
const IMG = {}
const NEED = Object.keys(ART)
let loaded = 0
function loadImg(n) {
  return new Promise(res => {
    const im = new Image(); im.decoding = 'async'
    im.onload = () => { IMG[n] = im; loaded++; bootStep(); res() }
    im.onerror = () => { loaded++; bootStep(); res() }
    im.src = 'img/' + n + '.webp?v=3'
  })
}
function bootStep() { const b = $('bootBar'); if (b) b.style.transform = 'scaleX(' + Math.min(1, loaded / NEED.length) + ')' }
// 危ない煙の輪（暗い色）を、白い輪の絵から作る
const DARK = {}
function makeDark() {
  const r = IMG.p_ring; if (!r) return
  const c = document.createElement('canvas'); c.width = r.width; c.height = r.height
  const g = c.getContext('2d'); g.drawImage(r, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(58,60,78,.86)'; g.fillRect(0, 0, c.width, c.height)
  DARK.ring = c
}

// ------------------------------------------------------------ 音
const SND = {
  cloth: ['snd/cloth1.mp3', 'snd/cloth2.mp3', 'snd/cloth3.mp3', 'snd/cloth4.mp3'], step: ['snd/step1.mp3', 'snd/step2.mp3'],
  whap: ['snd/whap1.mp3', 'snd/whap2.mp3', 'snd/whap3.mp3'], slam: ['snd/slam1.mp3', 'snd/slam2.mp3'], crack: 'snd/crack.mp3',
  swish: ['snd/swish1.mp3', 'snd/swish2.mp3', 'snd/swish3.mp3'], pop: ['snd/pop1.mp3', 'snd/pop2.mp3', 'snd/pop3.mp3'],
  grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], save: 'snd/save.mp3', win: 'snd/win.mp3', lose: 'snd/lose.mp3', phase: 'snd/phase.mp3',
  click: 'snd/click.mp3', spray: 'snd/spray.mp3', cough: 'snd/cough.mp3', whoosh: 'snd/whoosh.mp3'
}
Snd.def(SND)
let muted = false
try { muted = localStorage.getItem('fvs_mute') === '1' } catch (e) {}
Snd.setMute(muted)
function sfx(n, o) { Snd.play(n, o) }
let bedKey = ''
function setBed(k) {
  if (k === bedKey || !Snd.ctx) return; bedKey = k
  if (k === 'title') { Snd.loop('bgm', 'snd/bgm_stage.mp3', 0.16); Snd.loop('amb', 'snd/crickets.mp3', 0.12) }
  if (k === 'room') { Snd.loop('bgm', 'snd/bgm_stage.mp3', 0.2); Snd.loop('amb', 'snd/crickets.mp3', 0.14) }
  if (k === 'street') { Snd.loop('bgm', 'snd/bgm_stage.mp3', 0.2); Snd.loop('amb', 'snd/street_loop.mp3', 0.22) }
  if (k === 'roof') { Snd.loop('bgm', 'snd/bgm_stage.mp3', 0.16); Snd.loop('amb', 'snd/wind_loop.mp3', 0.16) }
  if (k === 'boss') { Snd.loop('bgm', 'snd/bgm_boss.mp3', 0.3); Snd.loop('amb', 'snd/wind_loop.mp3', 0.12) }
  if (k === 'quiet') { Snd.loop('bgm', null); Snd.loop('amb', 'snd/wind_loop.mp3', 0.1) }
}

// ------------------------------------------------------------ 入力
const keys = new Set(), tapped = new Set()   // tapped: 短く押して、コマの間に離した分も1コマは押したことにする
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'shoot', KeyJ: 'shoot', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash', KeyC: 'parry', Semicolon: 'parry'
}
let device = matchMedia('(pointer:coarse)').matches ? 'touch' : 'key'
const touch = { left: 0, right: 0, up: 0, down: 0, jump: 0, dash: 0, parry: 0 }
let shootToggle = false
addEventListener('keydown', e => {
  const k = KEYMAP[e.code]
  if (k) { keys.add(k); if (!e.repeat) tapped.add(k); device = 'key'; if (scene === 'play') e.preventDefault() }
  if (e.repeat) return
  if (e.code === 'Escape' || e.code === 'KeyP') { if (scene === 'play') pause(true); else if (scene === 'pause') pause(false) }
  if (e.code === 'Enter' || ((e.code === 'KeyZ' || e.code === 'Space') && scene !== 'play')) {
    if (scene === 'title') { e.preventDefault(); $('btnStart').click() }
    else if (scene === 'dead' || scene === 'win') { if (diaryReadyT && performance.now() > diaryReadyT) { e.preventDefault(); $('btnA').click() } }
    else if (scene === 'pause') { e.preventDefault(); pause(false) }
  }
})
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k) })
addEventListener('blur', () => { keys.clear(); for (const k in touch) touch[k] = 0; stickEnd() })
// パッド（Gamepad API の標準の並び）
let padPrev = {}
function readPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null
  if (!gp) return null
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes || []
  const o = {
    left: b(14) || ax[0] < -0.4, right: b(15) || ax[0] > 0.4, up: b(12) || ax[1] < -0.55, down: b(13) || ax[1] > 0.55,
    jump: b(0), shoot: b(2) || b(7), dash: b(5) || b(6), parry: b(1) || b(4), start: b(9)
  }
  if (Object.values(o).some(Boolean)) device = 'pad'
  if (o.start && !padPrev.start) { if (scene === 'play') pause(true); else if (scene === 'pause') pause(false) }
  if (o.jump && !padPrev.jump && scene !== 'play') {
    if (scene === 'title') $('btnStart').click()
    else if ((scene === 'dead' || scene === 'win') && diaryReadyT && performance.now() > diaryReadyT) $('btnA').click()
  }
  padPrev = o
  return o
}
let padNow = null
function readInput() {
  const p = padNow || {}
  const g = k => keys.has(k) || tapped.has(k) || !!touch[k] || !!p[k]
  return { left: g('left'), right: g('right'), up: g('up'), down: g('down'), jump: g('jump'), shoot: g('shoot') || shootToggle, dash: g('dash'), parry: g('parry') }
}
// 左下のスティック（スマホ）。指を置いた所が中心になり、そこからの向きで動く
// 横は左右に動く、上に倒すと上へ撃つ、下に倒すとしゃがむ。斜めは両方
const stick = { id: null, ox: 0, oy: 0, R: 52, used: false }
const STICK = { dead: 12, vDead: 24 }
function stickDirs(dx, dy) {
  const d = Math.hypot(dx, dy)
  const o = { left: 0, right: 0, up: 0, down: 0 }
  if (d < STICK.dead) return o
  if (Math.abs(dx) > d * 0.5) { if (dx < 0) o.left = 1; else o.right = 1 }
  if (d > STICK.vDead && Math.abs(dy) > d * 0.6) { if (dy < 0) o.up = 1; else o.down = 1 }
  return o
}
function stickShow(x, y, kx, ky, live) {
  const el = $('stick'); el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.toggle('idle', !live)
  $('knob').style.transform = `translate(${kx}px,${ky}px)`
}
function stickHome() {
  const z = $('stickZone').getBoundingClientRect()
  return { x: Math.min(z.width * 0.42, stick.R + 40), y: z.height - Math.max(stick.R + 24, Math.min(z.height * 0.42, 120)) }
}
function stickEnd() {
  stick.id = null; touch.left = touch.right = touch.up = touch.down = 0
  const h = stickHome(); stickShow(h.x, h.y, 0, 0, false)
}
{
  const z = $('stickZone')
  const loc = e => { const b = z.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] }
  const move = e => {
    if (e.pointerId !== stick.id) return
    e.preventDefault()
    const [x, y] = loc(e)
    let dx = x - stick.ox, dy = y - stick.oy
    // 指が輪の外まで行ったら、中心が指についてくる（大きく動かしても戻しやすい）
    const d = Math.hypot(dx, dy), lim = stick.R * 1.25
    if (d > lim) { stick.ox = x - dx / d * lim; stick.oy = y - dy / d * lim; dx = x - stick.ox; dy = y - stick.oy }
    Object.assign(touch, stickDirs(dx, dy))
    const k = Math.min(1, stick.R / Math.max(1, Math.hypot(dx, dy)))
    stickShow(stick.ox, stick.oy, dx * k, dy * k, true)
  }
  z.addEventListener('pointerdown', e => {
    e.preventDefault(); device = 'touch'; Snd.init()
    if (stick.id !== null) return
    const [x, y] = loc(e)
    stick.id = e.pointerId; stick.ox = x; stick.oy = y
    if (!stick.used) { stick.used = true; $('stickHint').classList.add('hidden') }
    stickShow(x, y, 0, 0, true)
    try { z.setPointerCapture(e.pointerId) } catch (er) {}
  })
  z.addEventListener('pointermove', move)
  const up = e => { if (e.pointerId === stick.id) stickEnd() }
  z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up); z.addEventListener('lostpointercapture', up)
  z.addEventListener('contextmenu', e => e.preventDefault())
}
// 右下の丸（スマホ）。撃つは1回で入りっぱなし
for (const el of document.querySelectorAll('#pad button')) {
  const k = el.dataset.k, ids = new Set()
  const down = e => {
    e.preventDefault(); device = 'touch'; Snd.init()
    if (k === 'shoot') { shootToggle = !shootToggle; el.classList.toggle('on', shootToggle); return }
    ids.add(e.pointerId); touch[k] = 1; tapped.add(k); el.classList.add('on')
    try { el.setPointerCapture(e.pointerId) } catch (er) {}
  }
  const up = e => { if (!ids.has(e.pointerId)) return; ids.delete(e.pointerId); if (!ids.size) { touch[k] = 0; el.classList.remove('on') } }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up)
  el.addEventListener('contextmenu', e => e.preventDefault())
}

// ------------------------------------------------------------ 配置（PC は横一画面。スマホは縦なら下にボタン、横なら重ねる）
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window
let scaleCss = 1
// 右下の丸を親指の弧に並べる。跳ぶが角（いちばん大きい）、撃つが左、ダッシュが上、はじくが斜め
function placeActs(J, a, g) {
  const acts = document.querySelector('#pad .acts')
  const d = Math.max(J / 2 + a / 2 + g, (a + g) / (2 * Math.sin(Math.PI / 8)))
  const size = Math.ceil(d + a / 2 + J / 2) + 2
  acts.style.width = acts.style.height = size + 'px'
  const c = size - J / 2, set = (k, x, y, s) => { const b = document.querySelector(`#pad [data-k=${k}]`); Object.assign(b.style, { left: (x - s / 2) + 'px', top: (y - s / 2) + 'px', width: s + 'px', height: s + 'px', fontSize: Math.round(s * 0.24) + 'px' }) }
  const q = Math.SQRT1_2
  set('jump', c, c, J); set('shoot', c - d, c, a); set('parry', c - d * q, c - d * q, a); set('dash', c, c - d, a)
  return size
}
function layout() {
  const vw = innerWidth, vh = innerHeight, portrait = vh > vw
  const pad = $('pad'), scr = $('screen')
  let sw, sh, padH = 0
  pad.classList.toggle('hidden', !isTouch || scene === 'title')
  const t = T(); for (const k of ['jump', 'shoot', 'dash', 'parry']) document.querySelector(`#pad [data-k=${k}] span`).textContent = t.btn[k]
  $('stickHint').textContent = t.stickHint
  const zone = $('stickZone'), acts = document.querySelector('#pad .acts')
  const safeB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inapp-bot')) || 0
  if (isTouch && portrait) {
    pad.classList.remove('over')
    const padH0 = scene === 'title' ? 0 : Math.round(Math.min(300, vh * 0.42))
    const s = Math.min(vw / W, (vh - padH0 - 24) / H)
    sw = W * s; sh = H * s
    // 操作は親指の届く画面の下に寄せる。余った高さは画面の上（横向きの案内）へ
    padH = scene === 'title' ? 0 : Math.round(Math.max(padH0, Math.min(vh - sh - 64, 380)))
    pad.style.height = padH + 'px'
    $('app').classList.toggle('port', scene !== 'title')
    const J = clamp(vw * 0.25, 84, 108), a = clamp(vw * 0.19, 66, 82)
    const size = placeActs(J, a, 10)
    acts.style.right = '14px'; acts.style.bottom = (14 + safeB) + 'px'
    zone.style.width = Math.max(150, vw - size - 28) + 'px'; zone.style.height = '100%'; zone.style.bottom = '0'
  } else {
    pad.classList.toggle('over', isTouch)
    pad.style.height = ''
    $('app').classList.remove('port')
    const s = Math.min(vw / W, vh / H); sw = W * s; sh = H * s
    const J = clamp(vh * 0.23, 76, 104), a = clamp(vh * 0.175, 62, 80)
    const size = placeActs(J, a, 8)
    acts.style.right = Math.max(12, (vw - sw) / 2 - size * 0.25) + 'px'; acts.style.bottom = (10 + safeB) + 'px'
    // 左は画面の左半分の、上の印（体力）より下ぜんぶ
    zone.style.width = Math.round(vw * 0.46) + 'px'; zone.style.height = Math.round(vh - 56) + 'px'; zone.style.bottom = '0'
  }
  $('stick').style.setProperty('--sr', stick.R * 2 + 'px')
  if (stick.id === null) stickEnd()
  const h = stickHome(), sh2 = $('stickHint'); sh2.style.left = h.x + 'px'; sh2.style.top = (h.y + stick.R + 8) + 'px'
  sh2.classList.toggle('hidden', stick.used || h.y + stick.R + 26 > zone.getBoundingClientRect().height)
  scr.style.width = Math.floor(sw) + 'px'; scr.style.height = Math.floor(sh) + 'px'
  const dpr = Math.min(2, devicePixelRatio || 1)
  cv.width = Math.round(Math.floor(sw) * dpr); cv.height = Math.round(Math.floor(sh) * dpr)
  scaleCss = sw / W
  const hint = $('rotHint'); hint.textContent = T().rot
  hint.classList.toggle('hidden', !(isTouch && portrait))
  hint.style.top = Math.max(0, (vh - sh - padH) / 2 - 24) + 'px'
}
addEventListener('resize', layout)

// ------------------------------------------------------------ 状態
let scene = 'boot', r = null, bot = null, botKind = null
let cam = 0, shake = 0, fx = [], smokeT = 0, toastT = 0, bossLook = { hurtT: 0, headA: 0, headV: 0, lastHp: 0 }, diaryReadyT = 0
let hero = { animT: 0, lastShotT: 9, flapT: 0, runD: 0 }
let bestSave = 0
try { bestSave = +localStorage.getItem('fvs_save') || 0 } catch (e) {}

function start(save = 0, seed) {
  Snd.init()
  r = newRun(seed || (Date.now() & 0xffff) + 1, { save })
  cam = clamp(r.me.x - 360, 0, AX); fx = []
  scene = "play"; hideSheets(); layout(); tapped.clear()
  if (shootToggle) { shootToggle = false; document.querySelector('.b-shoot').classList.remove('on') }
  stickEnd()
  sfx('cloth', { vol: 0.8 })
}
function hideSheets() { for (const id of ['title', 'diary', 'pauseBox']) $(id).classList.add('hidden') }
function pause(on) {
  if (on) { scene = 'pause'; $('pTxt').textContent = T().pause; $('btnResume').textContent = T().resume; $('pauseBox').classList.remove('hidden'); keys.clear() }
  else { scene = 'play'; $('pauseBox').classList.add('hidden'); last = performance.now() }
}
$('btnResume').onclick = () => pause(false)
$('btnPause').onclick = () => { if (scene === 'play') pause(true); else if (scene === 'pause') pause(false) }
$('btnMute').onclick = () => { muted = !muted; Snd.init(); Snd.setMute(muted); $('btnMute').classList.toggle('off', muted); try { localStorage.setItem('fvs_mute', muted ? '1' : '0') } catch (e) {} }
$('btnMute').classList.toggle('off', muted)

function showTitle() {
  scene = 'title'
  const t = T()
  $('t1').textContent = t.title1; $('t2').textContent = t.title2; $('story').textContent = t.story
  $('btnStart').textContent = t.start
  $('btnCont').textContent = fmt(t.cont, { n: t.saveNames[bestSave] || '' }); $('btnCont').classList.toggle('hidden', !bestSave)
  $('keys').textContent = isTouch && !matchMedia('(pointer:fine)').matches ? t.keysTouch : t.keysPC
  $('btnLang').textContent = t.lang; $('credit').textContent = t.credit
  hideSheets(); $('title').classList.remove('hidden')
  r = newRun(3); cam = 0
  layout()
}
$('btnStart').onclick = () => { sfx('click'); start(0) }
$('btnCont').onclick = () => { sfx('click'); start(bestSave) }
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('fvs_lang', lang) } catch (e) {} document.documentElement.lang = lang; showTitle() }
document.documentElement.lang = lang
addEventListener('pointerdown', () => Snd.init(), { capture: true })

// ------------------------------------------------------------ 1コマ
function tick() {
  const inp = bot ? bot(r) : readInput()
  step(r, inp); tapped.clear()
  for (const e of r.ev) onEvent(e, inp)
  if (r.mode === 'dead' && scene === 'play') { scene = 'dying'; dyingT = 0 }
  if (r.won && scene === 'play' && r.modeT > 3.2) showDiary(true)
}
let dyingT = 0
function onEvent(e, inp) {
  const m = r.me
  switch (e.k) {
    case 'jump': sfx('cloth', { vol: 0.55 }); break
    case 'land': if (!r.boss || e.fires == null) { sfx('step', { vol: 0.5 }); puff(m.x, m.y, 3, '#c9c3b5') } else { sfx('pop', { vol: 0.7, rate: 0.7 }); shake = Math.max(shake, 3) } break
    case 'shot': if (r.stats.shots % 3 === 1) sfx('spray', { vol: 0.3, jitter: 0.1 }); hero.lastShotT = 0; break
    case 'kill': sfx('pop', { vol: 0.8 }); puff(e.x, e.y - (e.foe === 'butt' ? 20 : 0), 9, '#a9adbd'); break
    case 'hurt': sfx('grunt', { vol: 0.9 }); sfx('whap', { vol: 0.4, rate: 0.8 }); shake = 8; flash = 0.18; break
    case 'pit': sfx('whoosh', { vol: 0.6 }); break
    case 'dash': sfx('swish', { vol: 0.7 }); puff(m.x - m.face * 20, m.y - 20, 4, '#d8d2c2'); break
    case 'parryTry': sfx('cloth', { vol: 0.7, rate: 1.2 }); hero.flapT = 0.28; break
    case 'parry': sfx('whap', { vol: 1 }); hero.flapT = 0.3; puff(e.x, e.y, 10, '#fff4dc'); toast(T().parried, 0.9); shake = 4; break
    case 'save': sfx('save', { vol: 0.8 }); sfx('cloth', { vol: 0.6 }); toast(T().saved, 1.6); if (r.save > bestSave) { bestSave = r.save; try { localStorage.setItem('fvs_save', String(bestSave)) } catch (er) {} } break
    case 'bossIn': setBed('boss'); sfx('cough', { vol: 0.8, rate: 0.85 }); break
    case 'act': if (e.a === 'rings') sfx('whoosh', { vol: 0.35, rate: 0.6 }); if (e.a === 'fist' || e.a === 'sweep') sfx('swish', { vol: 0.5, rate: 0.6 }); break
    case 'slam': sfx('slam', { vol: 1 }); sfx('crack', { vol: 0.6 }); shake = 12; puff(e.x, GY, 14, '#9da2b4'); break
    case 'flick': sfx('swish', { vol: 0.8 }); break
    case 'ring': sfx('whoosh', { vol: 0.3, rate: 1.3 }); break
    case 'sweep': sfx('whoosh', { vol: 0.8, rate: 0.9 }); shake = 4; break
    case 'ringHit': sfx('whap', { vol: 0.9, rate: 0.8 }); sfx('cough', { vol: 0.5, rate: 1.1 }); bossLook.hurtT = 0.5; shake = 6; puff(e.x, e.y, 12, '#fff4dc'); break
    case 'phase2': sfx('phase', { vol: 0.8 }); sfx('cough', { vol: 0.9 }); Snd.duck(0.4, 2); break
    case 'win': sfx('win', { vol: 0.9 }); Snd.loop('bgm', null); shake = 10; for (let i = 0; i < 4; i++) puff(ARENA.headX + (i - 2) * 40, 200 + i * 40, 12, '#9da2b4'); break
    case 'die': sfx('lose', { vol: 0.8 }); Snd.duck(0.3, 2); break
  }
}
let flash = 0
function puff(x, y, n, col) { for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, r: 6 + Math.random() * 10, t: 0, life: 0.5 + Math.random() * 0.4, col }) }
function toast(s, t) { const el = $('toast'); el.textContent = s; el.classList.remove('hidden'); toastT = t }

// ------------------------------------------------------------ 手帳（倒れた時・勝った時）
function showDiary(won) {
  scene = won ? 'win' : 'dead'
  const t = T(), page = $('diary'), rows = $('dRows'), st = $('stamp')
  $('dHead').textContent = won ? t.winHead : t.deadHead
  $('dSub').textContent = won ? t.winSub : fmt(t.deadSub, { d: r.stats.deaths })
  rows.innerHTML = ''
  const row = (k, v, cls) => { const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.className = 'v ' + (cls || ''); b.textContent = v; rows.append(a, b) }
  if (won) {
    const sec = Math.round(r.t - (r.stats.startT || 0)), ts = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
    row(t.rowTime, ts); row(t.rowHit, String(r.stats.hits), r.stats.hits ? '' : 'big'); row(t.rowParry, String(r.stats.parries)); row(t.rowDeath, String(r.stats.deaths))
    const rank = r.stats.hits === 0 && r.stats.deaths === 0 ? 's' : r.stats.hits <= 2 && r.stats.deaths === 0 ? 'a' : r.stats.deaths === 0 ? 'b' : 'c'
    st.textContent = t.stamp[rank]; st.classList.remove('hidden', 'pop'); void st.offsetWidth; st.classList.add('pop')
    $('btnA').textContent = t.again; $('btnAgain').textContent = t.fromStart; $('btnAgain').classList.add('hidden')
    const post = $('btnPost'); post.classList.remove('hidden'); post.textContent = t.post
    post.href = 'https://x.com/intent/post?text=' + encodeURIComponent(fmt(t.postText, { h: r.stats.hits, t: ts })) + '&url=' + encodeURIComponent('https://tom3games.com/play/futon-vs-smoke/')
    bestSave = 0; try { localStorage.setItem('fvs_save', '0') } catch (e) {}
    setBed('quiet')
  } else {
    st.classList.add('hidden'); $('btnPost').classList.add('hidden'); $('btnAgain').classList.remove('hidden')
    const d = r.deathAt
    if (d.boss != null) row(t.bossLeft, Math.max(1, Math.ceil(d.boss * 100)) + '%', 'big')
    row(t.stageGot, Math.round(progress(r.maxX) * 100) + '%')
    $('btnA').textContent = t.fromSave + '（' + t.saveNames[r.save] + '）'; $('btnAgain').textContent = t.fromStart
  }
  drawMap(won)
  page.classList.remove('hidden')
  diaryReadyT = performance.now() + 450
  setTimeout(() => { if (scene === 'dead' || scene === 'win') $('btnA').focus({ preventScroll: true }) }, 60)
}
$('btnA').onclick = () => {
  sfx('click')
  if (scene === 'win') { start(0); return }
  if (scene === 'dead') { respawn(r); fx = []; scene = 'play'; hideSheets(); cam = clamp(r.me.x - 360, 0, AX); bedKey = ''; sfx('cloth') }
}
$('btnAgain').onclick = () => { sfx('click'); if (scene === 'dead') { respawn(r, true); fx = []; scene = 'play'; hideSheets(); cam = 0; bedKey = '' } else start(0) }

// 手帳の地図: 道の線・布団（セーブ）・倒れた所・魔人の残り
function drawMap(won) {
  const c = $('dmap'), g = c.getContext('2d'), w = c.width, h = c.height
  g.clearRect(0, 0, w, h)
  const L = 30, R = w - 190, y = 120, X = x => L + (R - L) * progress(x)
  g.lineCap = 'round'; g.strokeStyle = '#2a2a35'; g.lineWidth = 3
  // 道（穴は切れ目）
  for (const [a, b] of STAGE.floors) { g.beginPath(); g.moveTo(X(Math.max(0, a)), y); g.lineTo(X(Math.min(b, STAGE.end)), y); g.stroke() }
  // 進んだ所まで太く
  g.strokeStyle = '#2f3a6b'; g.lineWidth = 7; g.globalAlpha = 0.55
  g.beginPath(); g.moveTo(L, y); g.lineTo(X(won ? STAGE.end : r.maxX), y); g.stroke(); g.globalAlpha = 1
  // 布団
  STAGE.saves.forEach((s, i) => {
    const x = X(s.x), im = r.saved[i] ? IMG.p_futon2 : IMG.p_futon
    if (im) { const k = 34 / im.width; g.globalAlpha = r.saved[i] ? 1 : 0.4; g.drawImage(im, x - 17, y - 8 - im.height * k, 34, im.height * k); g.globalAlpha = 1 }
    g.fillStyle = '#4b4a55'; g.font = '16px "Yusei Magic",sans-serif'; g.textAlign = 'center'; g.fillText(T().saveNames[i], x, y + 30)
  })
  // 魔人
  const bx = R + 95
  if (IMG[won ? 'b_small' : 'b_head'] || IMG.b_head) { const im = IMG[won ? 'b_small' : 'b_head'] || IMG.b_head; const k = 110 / Math.max(im.width, im.height); g.globalAlpha = won ? 0.9 : 1; g.drawImage(im, bx - im.width * k / 2, 6, im.width * k, im.height * k); g.globalAlpha = 1 }
  if (!won) {
    // 魔人の残りの帯
    const f = r.deathAt.boss
    g.fillStyle = '#d8d0bd'; g.fillRect(bx - 70, 132, 140, 16)
    if (f != null) { g.fillStyle = '#5a5f78'; g.fillRect(bx - 70, 132, 140 * f, 16) }
    g.strokeStyle = '#2a2a35'; g.lineWidth = 2; g.strokeRect(bx - 70, 132, 140, 16)
    if (f == null) { g.fillStyle = '#4b4a55'; g.font = '15px "Yusei Magic",sans-serif'; g.textAlign = 'center'; g.fillText('?', bx, 146) }
    // 倒れた所
    const x = X(r.deathAt.x)
    g.strokeStyle = '#c0392b'; g.lineWidth = 5
    g.beginPath(); g.moveTo(x - 11, y - 11); g.lineTo(x + 11, y + 11); g.moveTo(x + 11, y - 11); g.lineTo(x - 11, y + 11); g.stroke()
    g.fillStyle = '#c0392b'; g.font = '17px "Yusei Magic",sans-serif'; g.textAlign = 'center'; g.fillText(T().deadWhere, clamp(x, 50, R - 40), y - 22)
  } else {
    g.strokeStyle = '#c0392b'; g.lineWidth = 4; g.beginPath(); g.arc(X(STAGE.end), y, 14, 0, 7); g.stroke()
  }
}

// ------------------------------------------------------------ 描く
function img(n) { return IMG[n] }
function sprite(n, x, y, k, flip = false, ax = 0.5, ay = 1, rot = 0, alpha = 1) {
  const im = IMG[n]; if (!im) return
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1)
  if (alpha < 1) ctx.globalAlpha = alpha
  ctx.drawImage(im, -im.width * k * ax, -im.height * k * ay, im.width * k, im.height * k)
  ctx.restore()
}
const SECTIONS = [{ x: -1e9, bg: 'bg_room', bed: 'room' }, { x: 1760, bg: 'bg_street', bed: 'street' }, { x: 4700, bg: 'bg_roof', bed: 'roof' }]
function sectionAt(x) { let s = SECTIONS[0]; for (const q of SECTIONS) if (x >= q.x) s = q; return s }
// 背景は区間ごとに1枚。並べて繰り返さず、区間の中のカメラの位置に合わせて少しだけ横にずらす（奥行き）
const BG_CAM = { bg_room: [0, 1760 - 380], bg_street: [1760 - 380, 4700 - 380], bg_roof: [4700 - 380, AX] }
function drawBg(cx) {
  const mid = cx + W / 2
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i], next = SECTIONS[i + 1]
    const a0 = i === 0 ? 1 : clamp((mid - s.x + 160) / 320, 0, 1)
    const a1 = next ? clamp((next.x - mid + 160) / 320, 0, 1) : 1
    const a = Math.min(a0, a1); if (a <= 0) continue
    const im = IMG[s.bg]; if (!im) continue
    const k = Math.max(600 / im.height, (W + 60) / im.width), iw = im.width * k, ih = im.height * k
    const [c0, c1] = BG_CAM[s.bg], u = clamp((cx - c0) / Math.max(1, c1 - c0), 0, 1)
    ctx.globalAlpha = a
    ctx.drawImage(im, -u * (iw - W), 0, iw, ih)
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = 'rgba(12,14,32,.28)'; ctx.fillRect(0, 0, W, H)
}
function groundStyle(x) { return x < 1760 ? 'room' : x < 4700 ? 'street' : 'roof' }
function drawGround(cx) {
  for (const [a, b] of STAGE.floors) {
    const x0 = Math.max(a, cx - 20), x1 = Math.min(b, cx + W + 20); if (x1 <= x0) continue
    // 区間ごとに色を変える
    let x = x0
    while (x < x1) {
      const st = groundStyle(x), end = Math.min(x1, st === 'room' ? 1760 : st === 'street' ? 4700 : 1e9)
      const sx = x - cx, sw = end - x
      if (st === 'room') {
        ctx.fillStyle = '#6b4f33'; ctx.fillRect(sx, GY, sw, 12)
        ctx.fillStyle = '#b6a674'; ctx.fillRect(sx, GY + 12, sw, H - GY)
        ctx.strokeStyle = 'rgba(70,60,30,.5)'; ctx.lineWidth = 2
        for (let t = Math.ceil(x / 180) * 180; t < end; t += 180) { ctx.beginPath(); ctx.moveTo(t - cx, GY + 12); ctx.lineTo(t - cx - 30, H); ctx.stroke() }
      } else if (st === 'street') {
        ctx.fillStyle = '#7d8190'; ctx.fillRect(sx, GY, sw, 9)
        ctx.fillStyle = '#2b2e3c'; ctx.fillRect(sx, GY + 9, sw, H - GY)
        ctx.fillStyle = 'rgba(255,255,255,.08)'
        for (let t = Math.ceil(x / 140) * 140; t < end; t += 140) ctx.fillRect(t - cx, GY + 40, 60, 5)
      } else {
        ctx.fillStyle = '#9a9ca6'; ctx.fillRect(sx, GY, sw, 8)
        ctx.fillStyle = '#5d5f6b'; ctx.fillRect(sx, GY + 8, sw, H - GY)
        ctx.strokeStyle = 'rgba(30,30,40,.35)'; ctx.lineWidth = 1.5
        for (let t = Math.ceil(x / 230) * 230; t < end; t += 230) { ctx.beginPath(); ctx.moveTo(t - cx, GY + 8); ctx.lineTo(t - cx + 14, GY + 30); ctx.lineTo(t - cx + 4, H); ctx.stroke() }
      }
      // 手描きの質感: ふちの影・かすれた点
      const gr = ctx.createLinearGradient(0, GY, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,.45)'); ctx.fillStyle = gr; ctx.fillRect(sx, GY, sw, H - GY)
      ctx.fillStyle = 'rgba(20,20,30,.22)'
      for (let q = Math.ceil(x / 23) * 23; q < end; q += 23) { const h1 = (q * 7919) % 97, yy = GY + 14 + (h1 % 50); ctx.fillRect(q - cx + (h1 % 11), yy, 2 + (h1 % 3), 2) }
      ctx.strokeStyle = 'rgba(20,20,30,.35)'; ctx.lineWidth = 1.5
      for (let q = Math.ceil(x / 61) * 61; q < end; q += 61) { const h1 = (q * 104729) % 89; ctx.beginPath(); ctx.moveTo(q - cx, GY + 20 + h1 % 40); ctx.lineTo(q - cx + 14 + h1 % 9, GY + 21 + h1 % 40); ctx.stroke() }
      ctx.strokeStyle = '#15151d'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(sx, GY); for (let q = sx; q < sx + sw; q += 40) ctx.lineTo(Math.min(q + 40, sx + sw), GY + Math.sin(q * 0.7) * 0.8); ctx.stroke()
      x = end
    }
    // 床の端（穴の縁）
    for (const e of [a, b]) if (e > cx - 10 && e < cx + W + 10 && e > 0 && e < STAGE.end) { ctx.strokeStyle = '#15151d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e - cx, GY); ctx.lineTo(e - cx, H); ctx.stroke() }
  }
  // 穴の底の暗さ
  for (let i = 0; i < STAGE.floors.length - 1; i++) {
    const a = STAGE.floors[i][1], b = STAGE.floors[i + 1][0]
    if (b < cx || a > cx + W) continue
    const gr = ctx.createLinearGradient(0, GY, 0, H); gr.addColorStop(0, 'rgba(5,5,12,.2)'); gr.addColorStop(1, 'rgba(5,5,12,.9)')
    ctx.fillStyle = gr; ctx.fillRect(a - cx, GY, b - a, H - GY)
  }
}
function drawProps(cx, t) {
  for (const k of STAGE.boxes) {
    if (k.x1 < cx - 40 || k.x0 > cx + W + 40) continue
    const im = IMG.p_manga; if (!im) continue
    const w = (k.x1 - k.x0) + 14, h = k.y1 - k.y0 + 6
    ctx.drawImage(im, k.x0 - cx - 7, k.y0 - 6, w, h)
  }
  for (const p of STAGE.plats) {
    if (p.x1 < cx - 40 || p.x0 > cx + W + 40) continue
    const x = p.x0 - cx, w = p.x1 - p.x0
    if (p.y > 370) {   // 室外機
      ctx.fillStyle = '#d5d6d0'; ctx.strokeStyle = '#15151d'; ctx.lineWidth = 3
      roundRect(x, p.y, w, 58, 6); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(x + w * 0.38, p.y + 29, 19, 0, 7); ctx.fillStyle = '#9fa2a3'; ctx.fill(); ctx.stroke()
      ctx.save(); ctx.translate(x + w * 0.38, p.y + 29); ctx.rotate(t * 9); ctx.strokeStyle = '#555'; ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) { ctx.rotate(2.09); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -6, 14, -2); ctx.stroke() } ctx.restore()
      ctx.strokeStyle = '#15151d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * 0.5, p.y + 58); ctx.lineTo(x + w * 0.5, GY); ctx.stroke()
    } else {       // 外階段の踊り場（鉄の板）
      ctx.fillStyle = '#4a5a6b'; ctx.strokeStyle = '#15151d'; ctx.lineWidth = 3
      ctx.fillRect(x, p.y, w, 12); ctx.strokeRect(x, p.y, w, 12)
      ctx.strokeStyle = '#2a3440'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(x + 8, p.y + 12); ctx.lineTo(x + 8, GY); ctx.moveTo(x + w - 8, p.y + 12); ctx.lineTo(x + w - 8, GY); ctx.stroke()
      ctx.strokeStyle = 'rgba(200,210,220,.35)'; ctx.lineWidth = 1
      for (let i = 10; i < w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, p.y + 2); ctx.lineTo(x + i, p.y + 10); ctx.stroke() }
    }
  }
  // 付箋
  if (scene === 'title') return
  const nt = device === 'touch' ? T().noteT : device === 'pad' ? T().noteP : T().note
  ctx.textAlign = 'center'
  for (const n of STAGE.notes) {
    if (n.x < cx - 120 || n.x > cx + W + 120) continue
    const [a, b] = nt[n.k], x = n.x - cx, y = 290
    ctx.save(); ctx.translate(x, y); ctx.rotate(((n.x * 7) % 9 - 4) * 0.012)
    ctx.font = '20px "Yusei Magic",sans-serif'; let nw = ctx.measureText(a).width
    ctx.font = '15px "Yusei Magic",sans-serif'; for (const l of b.split('\n')) nw = Math.max(nw, ctx.measureText(l).width)
    nw = Math.max(152, nw + 26); const nl = -2 - nw / 2
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(nl + 4, -40, nw, 88)
    ctx.fillStyle = '#f2df7a'; ctx.fillRect(nl, -44, nw, 88)
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(nl, -44, nw, 14)
    ctx.fillStyle = '#20202a'; ctx.font = '20px "Yusei Magic",sans-serif'; ctx.fillText(a, -2, -6)
    ctx.font = '15px "Yusei Magic",sans-serif'; b.split('\n').forEach((l, i) => ctx.fillText(l, -2, 18 + i * 17))
    ctx.restore()
  }
  // 灰皿の台（はじく練習の換気扇の代わり）
  for (const v of STAGE.vents) {
    if (Math.abs(v.x - cx - W / 2) > W) continue
    const x = v.x - cx
    ctx.fillStyle = '#5b3d25'; ctx.strokeStyle = '#15151d'; ctx.lineWidth = 3
    ctx.fillRect(x - 46, GY - 34, 92, 10); ctx.strokeRect(x - 46, GY - 34, 92, 10)
    ctx.fillRect(x - 40, GY - 24, 8, 24); ctx.fillRect(x + 32, GY - 24, 8, 24)
    sprite('b_tray', x, GY - 33, 0.2)
  }
  // 布団（セーブ）
  STAGE.saves.forEach((s, i) => {
    if (i === 0 || s.x < cx - 120 || s.x > cx + W + 120) return
    const done = r.saved[i]
    sprite(done ? 'p_futon2' : 'p_futon', s.x - cx + 30, GY + 4, done ? 0.62 : 0.55)
    if (!done) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); ctx.fillStyle = '#ffe7a8'; ctx.beginPath(); ctx.ellipse(s.x - cx + 30, GY - 2, 56, 10, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1 }
  })
}
function roundRect(x, y, w, h, r0) { ctx.beginPath(); ctx.moveTo(x + r0, y); ctx.arcTo(x + w, y, x + w, y + h, r0); ctx.arcTo(x + w, y + h, x, y + h, r0); ctx.arcTo(x, y + h, x, y, r0); ctx.arcTo(x, y, x + w, y, r0); ctx.closePath() }

function drawFoes(cx, t) {
  for (const e of r.foes) {
    const x = e.x - cx; if (x < -80 || x > W + 80) continue
    const hit = e.hitT > 0
    if (e.k === 'puff') sprite('p_puff', x, e.y + 26, 0.42, r.me.x > e.x, 0.5, 1, Math.sin(t * 3 + e.id) * 0.08, hit ? 0.55 : 1)
    else sprite('p_butt', x, e.y + 2, 0.36, r.me.x > e.x, 0.5, 1, Math.sin(t * 12 + e.id) * 0.1, hit ? 0.55 : 1)
  }
}
function drawRings(cx, t) {
  for (const g of r.rings) {
    const x = g.x - cx; if (x < -80 || x > W + 80) continue
    const cream = g.kind === 'cream', im = cream ? IMG.p_ring : DARK.ring; if (!im) continue
    ctx.save(); ctx.translate(x, g.y)
    if (g.back) ctx.rotate(t * 14)
    else ctx.rotate(Math.PI / 2)
    if (cream) { ctx.shadowColor = 'rgba(255,240,200,.9)'; ctx.shadowBlur = 14 + Math.sin(t * 10) * 5 }
    else { ctx.shadowColor = 'rgba(232,119,46,.75)'; ctx.shadowBlur = 8 }
    const k = 0.46; ctx.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k)
    ctx.restore()
  }
}
function drawShots(cx) {
  for (const s of r.shots) {
    const x = s.x - cx
    ctx.fillStyle = 'rgba(190,230,250,.35)'; ctx.beginPath(); ctx.arc(x - s.vx * 0.012, s.y - s.vy * 0.012, 7, 0, 7); ctx.fill()
    ctx.fillStyle = '#bfe6f7'; ctx.strokeStyle = '#2b5c78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, s.y + s.wob, 5.5, 0, 7); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 1.5, s.y + s.wob - 1.5, 1.8, 0, 7); ctx.fill()
  }
}
function heroSprite(m, rt) {
  if (r.mode === 'saving') return 'h_sleep'
  if (r.mode === 'win' && r.modeT > 1) return 'h_cheer'
  if (m.knock > 0 || m.iT > CFG.hurtI - 0.25) return 'h_hurt'
  if (hero.flapT > 0) return 'h_flap'
  if (m.dashT > 0) return 'h_dash'
  if (!m.ground) return 'h_jump'
  if (m.duck) return 'h_duck'
  const shooting = hero.lastShotT < 0.15
  if (shooting && m.aim === 2) return 'h_up'
  if (Math.abs(m.vx) > 10) return (Math.floor(hero.runD / 46) % 2) ? 'h_run2' : 'h_run1'
  if (shooting) return 'h_shoot'
  return 'h_idle'
}
function drawHero(cx, t) {
  const m = r.me, n = heroSprite(m)
  if (m.iT > 0 && r.mode !== 'saving' && Math.floor(t * 20) % 2 === 0 && n !== 'h_hurt') return
  let x = m.x - cx, y = m.y + 3, k = 0.5
  if (n === 'h_sleep') { const s = STAGE.saves[r.save]; x = s.x - cx + 30; y = GY - 6; k = 0.5 }
  const breath = n === 'h_idle' ? 1 + Math.sin(t * 2.4) * 0.015 : 1
  ctx.save(); ctx.translate(x, y); ctx.scale(1, breath); ctx.translate(-x, -y)
  // 影
  if (m.ground || r.mode === 'saving') { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, GY + 1, 30, 6, 0, 0, 7); ctx.fill() }
  sprite(n, x, y, k, m.face < 0)
  ctx.restore()
  // 撃っている時の霧
  if (hero.lastShotT < 0.08 && n !== 'h_up' && n !== 'h_shoot' && n !== 'h_hurt') {
    ctx.fillStyle = 'rgba(220,240,250,.5)'; ctx.beginPath(); ctx.arc(x + m.face * 34, m.y - (m.duck ? 16 : 34), 6, 0, 7); ctx.fill()
  }
}

// ------------------------------------------------------------ 煙の魔人（1枚絵を部品に分け、関節でつないで動かす）
// 部品ごとに「軸（親とつながる所）」と「先（子がつながる所）」を絵の中の割合で持つ
const RIG = {
  b_torso: { piv: [0.42, 0.97], neck: [0.5, 0.06], shL: [0.14, 0.2], shR: [0.86, 0.22], k: 0.9 },
  b_head: { piv: [0.56, 0.9], k: 0.78 },
  b_uarmL: { piv: [0.5, 0.1], tip: [0.56, 0.88], k: 0.82 },
  b_farmL: { piv: [0.74, 0.09], tip: [0.32, 0.74], k: 0.82 },
  b_uarmR: { piv: [0.56, 0.08], tip: [0.38, 0.9], k: 0.78 },
  b_farmR: { piv: [0.1, 0.72], tip: [0.78, 0.3], k: 0.78 }
}
function partPt(n, f) { const im = IMG[n]; return [im.width * f[0], im.height * f[1]] }
function boneRest(n) { const a = partPt(n, RIG[n].piv), b = partPt(n, RIG[n].tip); return { ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: Math.hypot(b[0] - a[0], b[1] - a[1]) * RIG[n].k } }
// 骨を「world の角度・伸び」で描く。伸びは骨の向きにだけかける（煙なので伸びてよい）
function drawBone(n, x, y, ang, stretch = 1, glow = 0) {
  const im = IMG[n]; if (!im) return
  const R0 = RIG[n], rest = boneRest(n), [px, py] = partPt(n, R0.piv)
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(stretch, 1); ctx.rotate(-rest.ang); ctx.scale(R0.k, R0.k)
  ctx.drawImage(im, -px, -py)
  if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow; ctx.drawImage(im, -px, -py) }
  ctx.restore()
}
// 2本の骨で手を目標へ。届かなければ一直線に伸ばす。肘は bend の向きに曲げる
function arm(up, fore, sx, sy, hx, hy, bend) {
  const a = boneRest(up), b = boneRest(fore), d = Math.hypot(hx - sx, hy - sy), base = Math.atan2(hy - sy, hx - sx)
  if (d >= (a.len + b.len) * 0.98) { const s = d / (a.len + b.len); return { a1: base, a2: base, s, ex: sx + Math.cos(base) * a.len * s, ey: sy + Math.sin(base) * a.len * s } }
  const c = clamp((a.len * a.len + d * d - b.len * b.len) / (2 * a.len * d), -1, 1)
  const a1 = base + bend * Math.acos(c), ex = sx + Math.cos(a1) * a.len, ey = sy + Math.sin(a1) * a.len
  return { a1, a2: Math.atan2(hy - ey, hx - ex), s: 1, ex, ey }
}
const bossAnim = { lean: 0, leanV: 0, headA: 0, headV: 0, hand: null, handR: null, inhale: 0, scale: 1 }
function spring(o, key, vKey, target, k, d, dt) { const a = (target - o[key]) * k - o[vKey] * d; o[vKey] += a * dt; o[key] += o[vKey] * dt }
function drawBoss(cx, t, dt) {
  const B = r.boss; if (!B || !IMG.b_torso) return
  const ox = -cx
  // 倒した後: 小さくなって煙が抜ける
  if (r.mode === 'win') {
    const k = clamp(r.modeT / 1.2, 0, 1)
    sprite('b_tray', ARENA.bossX + ox, GY + 14, 0.92)
    if (k < 1) { ctx.globalAlpha = 1 - k; drawBossBody(ox, t, dt, 1 - k * 0.6); ctx.globalAlpha = 1 }
    sprite(IMG.b_small ? 'b_small' : 'b_head', ARENA.bossX + ox - 20, GY - 38 - Math.sin(r.modeT * 3) * 4, IMG.b_small ? 0.55 * Math.min(1, k * 1.5) : 0.3 * k)
    return
  }
  drawBossBody(ox, t, dt, 1)
}
function drawBossBody(ox, t, dt, sc) {
  const B = r.boss, A = bossAnim
  // 体の傾き: 溜めで後ろへ、打つ時に前へ。首は遅れてついてくる
  let leanT = Math.sin(t * 1.3) * 0.03, handT = null, handRT = null, inh = 0, glowL = 0
  const baseX = ARENA.bossX + 14 + ox, baseY = GY - 30
  const T2 = B.tell || 1, at = B.actT || 0, tk = clamp(at / T2, 0, 1)
  const restHand = [baseX - 150, baseY - 70 + Math.sin(t * 2) * 8]
  if (B.act === 'fist' && B.fist) {
    const F = B.fist, fx2 = F.x + ox
    if (F.st === 'tell') { leanT = 0.1 * ease(tk); handT = [lerp(restHand[0], fx2 + 60, ease(tk)), lerp(restHand[1], 40, ease(tk)) + (tk > 0.75 ? Math.sin(t * 60) * 3 : 0)]; glowL = tk > 0.6 ? 0.25 : 0 }
    else if (F.st === 'fall') { leanT = -0.14; handT = [fx2, lerp(40, GY - 70, F.y)] }
    else if (F.st === 'down') { leanT = -0.16; handT = [fx2, GY - 70] }
    else { leanT = -0.05; handT = [lerp(fx2, restHand[0], ease(clamp((at - T2 - 0.55) / 0.45, 0, 1))), lerp(GY - 70, restHand[1], ease(clamp((at - T2 - 0.55) / 0.45, 0, 1)))] }
  } else if (B.act === 'sweep' && B.sweep) {
    const S = B.sweep, by = S.low ? GY - 30 : GY - 95
    if (S.st === 'tell') { leanT = 0.12 * ease(tk); handT = [lerp(restHand[0], baseX + 40, ease(tk)), lerp(restHand[1], by - 10, ease(tk))]; glowL = tk > 0.5 ? 0.3 : 0 }
    else if (S.st === 'go') { leanT = -0.18; handT = [S.x + ox, by] }
    else { leanT = -0.08; handT = [lerp(ARENA.x0 - 160 + ox, restHand[0], ease(clamp(S.bt / 0.45, 0, 1))), lerp(by, restHand[1], ease(clamp(S.bt / 0.45, 0, 1)))] }
  } else if (B.act === 'rings') { inh = at < T2 ? ease(tk) : Math.max(0, 1 - (at - T2) * 3); leanT = at < T2 ? 0.06 * tk : -0.04 }
  if (B.act === 'flick' && B.flick) {
    const K = B.flick
    if (K.st === 'tell' || K.st === 'tell2') { const u = K.st === 'tell' ? tk : clamp(K.t2 / 0.65, 0, 1); handRT = [baseX + 40, lerp(baseY - 150, baseY - 250, ease(u))]; leanT = 0.05 * u }
    else if (K.st === 'fly') { handRT = [baseX - 20, baseY - 230]; leanT = -0.05 }
  }
  if (r.mode === 'phase') leanT = Math.sin(t * 18) * 0.06
  const dtc = Math.min(dt, 1 / 30)
  spring(A, 'lean', 'leanV', leanT, 120, 16, dtc)
  spring(A, 'headA', 'headV', A.lean * 1.3, 60, 9, dtc)   // 首は遅れる
  if (!A.hand) A.hand = restHand.slice(), A.handR = [baseX + 120, baseY - 130]
  const hT = handT || restHand, fast = B.fist && (B.fist.st === 'fall' || B.fist.st === 'down') || (B.sweep && B.sweep.st === 'go')
  if (fast) A.hand = hT.slice(); else { A.hand[0] = lerp(A.hand[0], hT[0], 1 - Math.pow(0.0005, dtc)); A.hand[1] = lerp(A.hand[1], hT[1], 1 - Math.pow(0.0005, dtc)) }
  const hR = handRT || [baseX + 125, baseY - 120 + Math.sin(t * 1.7 + 1) * 8]
  A.handR[0] = lerp(A.handR[0], hR[0], 1 - Math.pow(0.002, dtc)); A.handR[1] = lerp(A.handR[1], hR[1], 1 - Math.pow(0.002, dtc))
  A.inhale = lerp(A.inhale, inh, 0.2)

  const rot = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)]
  const tor = RIG.b_torso, tim = IMG.b_torso, tk2 = tor.k * sc
  const tp = partPt('b_torso', tor.piv)
  const at2 = (f) => { const p = partPt('b_torso', f); const v = rot((p[0] - tp[0]) * tk2, (p[1] - tp[1]) * tk2, A.lean); return [baseX + v[0], baseY + v[1]] }
  const neck = at2(tor.neck), shL = at2(tor.shL), shR = at2(tor.shR)
  const flashA = B.flash > 0.05 ? 0.45 : B.flash > 0 && r.frame % 4 < 2 ? 0.1 : 0
  // 灰皿の奥側の煙
  smokeTrail(baseX, baseY + 10, t)
  // 後ろの腕（右・開いた手）
  const aR = arm('b_uarmR', 'b_farmR', shR[0], shR[1], A.handR[0], A.handR[1], -1)
  drawBone('b_uarmR', shR[0], shR[1], aR.a1, aR.s, flashA); drawBone('b_farmR', aR.ex, aR.ey, aR.a2, aR.s, flashA)
  // 胴
  ctx.save(); ctx.translate(baseX, baseY); ctx.rotate(A.lean); ctx.scale(tk2, tk2 * (1 + A.inhale * 0.04)); ctx.drawImage(tim, -tp[0], -tp[1])
  if (flashA) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flashA; ctx.drawImage(tim, -tp[0], -tp[1]) }
  ctx.restore()
  // 灰皿（手前）
  sprite('b_tray', ARENA.bossX + ox, GY + 14, 0.92)
  // 頭
  let hn = 'b_head'
  if (B.phase === 2 && IMG.b_angry) hn = 'b_angry'
  if (A.inhale > 0.3 && IMG.b_inhale) hn = 'b_inhale'
  if (r.mode === 'phase' && IMG.b_cough) hn = 'b_cough'
  if (bossLook.hurtT > 0 && IMG.b_hurt) hn = 'b_hurt'
  const him = IMG[hn], hk = RIG.b_head.k * sc * (1 + A.inhale * 0.12)
  const hpiv = [him.width * RIG.b_head.piv[0], him.height * RIG.b_head.piv[1]]
  ctx.save(); ctx.translate(neck[0], neck[1]); ctx.rotate(A.headA); ctx.scale(hk, hk); ctx.drawImage(him, -hpiv[0], -hpiv[1])
  if (flashA) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flashA; ctx.drawImage(him, -hpiv[0], -hpiv[1]) }
  ctx.restore()
  // 前の腕（左・拳）
  const aL = arm('b_uarmL', 'b_farmL', shL[0], shL[1], A.hand[0], A.hand[1], 1)
  drawBone('b_uarmL', shL[0], shL[1], aL.a1, aL.s, Math.max(flashA, glowL)); drawBone('b_farmL', aL.ex, aL.ey, aL.a2, aL.s, Math.max(flashA, glowL))
  // 弾く手の先の吸い殻
  if (B.flick && (B.flick.st === 'tell' || B.flick.st === 'tell2')) sprite('p_cig', A.handR[0], A.handR[1], 0.32, false, 0.5, 0.5, -0.6)
  bossLook.hurtT = Math.max(0, bossLook.hurtT - dt)
}
let smokeParts = []
function smokeTrail(x, y, t) {
  smokeT += 1
  if (smokeT % 4 === 0) smokeParts.push({ x: x + (Math.random() - 0.5) * 120, y: y - Math.random() * 120, r: 10 + Math.random() * 18, t: 0, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30 })
  smokeParts = smokeParts.filter(p => p.t < 2.4)
  for (const p of smokeParts) {
    p.t += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60
    ctx.fillStyle = `rgba(150,156,178,${0.22 * (1 - p.t / 2.4)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t), 0, 7); ctx.fill()
  }
}
function drawBossTells(cx, t) {
  const B = r.boss; if (!B) return
  const ox = -cx
  // 拳の影
  if (B.fist && (B.fist.st === 'tell' || B.fist.st === 'fall')) {
    const k = B.fist.st === 'fall' ? 1 : ease(clamp(B.actT / B.tell, 0, 1))
    ctx.fillStyle = `rgba(10,8,20,${0.25 + 0.45 * k})`; ctx.beginPath(); ctx.ellipse(B.fist.x + ox, GY + 2, 40 + 40 * k, 9 + 5 * k, 0, 0, 7); ctx.fill()
    if (k > 0.6) { ctx.strokeStyle = `rgba(232,119,46,${0.5 + 0.5 * Math.sin(t * 30)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(B.fist.x + ox, GY + 2, 78, 14, 0, 0, 7); ctx.stroke() }
  }
  // 吸い殻の落ちる所（弾く前から）
  if (B.flick && B.flick.st !== 'done') {
    const K = B.flick
    for (const x of K.spots) {
      const sx = x + ox, pulse = 0.5 + 0.5 * Math.sin(t * 12)
      ctx.strokeStyle = `rgba(232,119,46,${0.45 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([7, 6])
      ctx.beginPath(); ctx.ellipse(sx, GY + 2, 32, 8, 0, 0, 7); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = 'rgba(232,119,46,.35)'; ctx.beginPath(); ctx.arc(sx, GY - 2, 4 + pulse * 3, 0, 7); ctx.fill()
    }
    if (K.st === 'fly') {
      const u = clamp(K.flyT / 0.75, 0, 1), hx = bossAnim.handR ? bossAnim.handR[0] : ARENA.bossX + ox, hy = bossAnim.handR ? bossAnim.handR[1] : 120
      for (const b of K.butts) {
        const x = lerp(hx, b.x + ox, u), y = lerp(hy, GY - 10, u) - Math.sin(Math.PI * u) * 170
        sprite('p_cig', x, y, 0.3, false, 0.5, 0.5, u * 9)
      }
    }
  }
  // 薙ぎ払いの高さ
  if (B.sweep && B.sweep.st === 'tell') {
    const by = B.sweep.low ? GY - 30 : GY - 95, k = clamp(B.actT / B.tell, 0, 1)
    ctx.fillStyle = `rgba(232,119,46,${0.08 + 0.14 * k + 0.06 * Math.sin(t * 25)})`
    ctx.fillRect(ARENA.x0 - 30 + ox, by - (B.sweep.low ? 26 : 50), ARENA.x1 - ARENA.x0 + 80, B.sweep.low ? 52 : 100)
  }
}
function drawFires(cx, t) {
  const B = r.boss; if (!B) return
  for (const f of B.fires) {
    const x = f.x - cx, fl = Math.min(1, f.t * 4)
    ctx.fillStyle = 'rgba(232,119,46,.25)'; ctx.beginPath(); ctx.ellipse(x, GY, 38, 9, 0, 0, 7); ctx.fill()
    sprite('p_butt', x, GY + 2, 0.24, false, 0.5, 1, 0.2, 0.9)
    for (let i = -1; i <= 1; i++) {
      const h = (34 + 12 * Math.sin(t * 17 + i * 2 + f.x)) * fl
      ctx.fillStyle = i ? '#e8772e' : '#f6c44c'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x + i * 14 - 9, GY); ctx.quadraticCurveTo(x + i * 14 - 10, GY - h * 0.6, x + i * 14 + Math.sin(t * 9 + i) * 4, GY - h); ctx.quadraticCurveTo(x + i * 14 + 10, GY - h * 0.6, x + i * 14 + 9, GY); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
  }
  for (const w of B.waves) {
    const x = w.x - cx
    ctx.fillStyle = '#8d93a8'; ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 2.5
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (i - 1) * 13, GY - 10 - (i === 1 ? 10 : 0), 13, Math.PI, 0); ctx.fill(); ctx.stroke() }
  }
}
function drawFx(cx, dt) {
  fx = fx.filter(p => (p.t += dt) < p.life)
  for (const p of fx) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94
    const k = p.t / p.life
    ctx.globalAlpha = 0.7 * (1 - k); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x - cx, p.y, p.r * (1 + k), 0, 7); ctx.fill()
  }
  ctx.globalAlpha = 1
}
function drawHud(t) {
  // 枕＝体力
  for (let i = 0; i < CFG.maxHP; i++) {
    const x = 18 + i * 42, y = 16, on = i < r.hp
    ctx.save(); ctx.translate(x + 17, y + 12); ctx.rotate(-0.06 + i * 0.04)
    if (on && r.hp === 1) ctx.scale(1 + Math.sin(t * 10) * 0.06, 1 + Math.sin(t * 10) * 0.06)
    ctx.fillStyle = on ? '#f3ead6' : 'rgba(243,234,214,.18)'; ctx.strokeStyle = on ? '#1b1b22' : 'rgba(243,234,214,.35)'; ctx.lineWidth = 2.5
    roundRect(-17, -11, 34, 22, 9); ctx.fill(); ctx.stroke()
    if (on) { ctx.strokeStyle = 'rgba(60,60,80,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, 3, 8, -2); ctx.stroke() }
    ctx.restore()
  }
  // 魔人のセリフ
  const B = r.boss
  if (B && B.say) {
    const s = T().say[B.say]; if (s) {
      ctx.font = '22px "Yusei Magic",sans-serif'; const w = ctx.measureText(s).width + 30, x = clamp(ARENA.headX - cam - 150 - w / 2, 10, W - w - 10), y = 40
      ctx.fillStyle = '#f4ecd9'; ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 3
      roundRect(x, y, w, 40, 14); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + w - 30, y + 40); ctx.lineTo(x + w + 6, y + 64); ctx.lineTo(x + w - 52, y + 40); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#f4ecd9'; ctx.fillRect(x + w - 50, y + 36, 18, 6)
      ctx.fillStyle = '#1b1b22'; ctx.textAlign = 'left'; ctx.fillText(s, x + 15, y + 28)
    }
  }
}

// ------------------------------------------------------------ ループ（演出も中身も固定 60Hz で数える）
let last = performance.now(), acc = 0
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now
  padNow = readPad()
  advance(dt)
  render(dt)
  requestAnimationFrame(frame)
}
function advance(dt) {
  if (scene === 'play' || scene === 'dying' || scene === 'win') {
    acc += dt; let n = 0
    while (acc >= DT && n < 6) { tick(); acc -= DT; n++ }
    if (n === 6) acc = 0
    if (scene === 'dying') { dyingT += dt; if (dyingT > 1.0) showDiary(false) }
  }
}
function render(dt) {
  if (!r) return
  const dpr = cv.width / W
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = performance.now() / 1000
  const m = r.me
  // カメラ
  const target = r.boss ? AX : clamp(m.x - 380, 0, AX)
  cam = scene === 'title' ? Math.min(AX, cam + dt * 30) : lerp(cam, target, 1 - Math.pow(0.002, dt))
  if (Math.abs(cam - target) < 0.5) cam = target
  shake = Math.max(0, shake - dt * 40)
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake
  ctx.save(); ctx.translate(sx, sy)
  drawBg(cam)
  drawGround(cam)
  drawProps(cam, t)
  if (r.boss) { drawBossTells(cam, t); drawBoss(cam, t, dt) }
  drawFires(cam, t)
  if (scene !== 'title') drawFoes(cam, t)
  if (scene !== 'title') drawHero(cam, t)
  drawShots(cam)
  drawRings(cam, t)
  drawFx(cam, dt)
  ctx.restore()
  if (flash > 0) { flash -= dt; ctx.fillStyle = `rgba(200,40,30,${flash})`; ctx.fillRect(0, 0, W, H) }
  if (scene !== 'title' && !window.__noHud) drawHud(t)
  // 音の場所
  if (scene === 'play' && Snd.ctx) setBed(r.boss ? (r.mode === 'win' ? 'quiet' : 'boss') : sectionAt(m.x).bed)
  if (scene === 'title' && Snd.ctx) setBed('title')
  hero.lastShotT += dt; hero.flapT = Math.max(0, hero.flapT - dt); hero.runD += Math.abs(m.vx) * dt
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden') }
}

// ------------------------------------------------------------ 検証用の窓口
window.fvs = {
  r: () => r, scene: () => scene, input: () => readInput(), device: () => device,
  start: (s, seed) => start(s || 0, seed),
  bot: (kind, seed = 1) => { botKind = kind; bot = kind ? makeBot(kind, seed) : null },
  run: n => { for (let i = 0; i < n && (scene === 'play' || scene === 'dying' || scene === 'win'); i++) advance(DT) },
  // 好きな描画の間隔（秒の列）で進める。60Hz と 120Hz で中身が同じか見る
  feed: dts => { for (const d of dts) advance(d) },
  snap: () => ({ f: r.frame, x: Math.round(r.me.x * 100), y: Math.round(r.me.y * 100), hp: r.hp, m: r.mode, b: r.boss && r.boss.hp, s: r.shots.length }),
  pause: on => { paused = on },
  diary: () => !$('diary').classList.contains('hidden'),
  frac: () => fraction(r), left: () => leftPct(r)
}
let paused = false

async function boot() {
  await Promise.all(NEED.map(loadImg))
  makeDark()
  try { await Promise.race([document.fonts.load('20px "Yusei Magic"'), new Promise(r => setTimeout(r, 1500))]) } catch (e) {}
  window.__bootDone = true
  $('boot').classList.add('gone')
  showTitle()
  const bm = location.hash.match(/^#bot(?:-([a-z]+))?(?:-save(\d))?/)
  if (bm) { fvs.bot(bm[1] || 'learned', 7); start(+(bm[2] || 0)) }
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame) })
  window.__fvsReady = true
}
boot()
