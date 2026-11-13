import { newRun, step, respawn } from '../shared/sim.js'
import { makeBot } from '../shared/bot.js'
const [kind = 'learned', save = 0, from = 0, to = 99999, every = 6] = process.argv.slice(2)
const r = newRun(101, { save: +save }), bot = makeBot(kind, 101)
for (let f = 0; f < 60 * 300; f++) {
  const inp = bot(r); step(r, inp)
  const evs = r.ev.filter(e => !['shot', 'tick', 'bossTick'].includes(e.k)).map(e => e.k + (e.by ? ':' + e.by : '') + (e.a ? ':' + e.a : '')).join(',')
  if (r.me.x >= +from && r.me.x <= +to && (f % +every === 0 || evs)) console.log(f, r.mode, 'x', r.me.x.toFixed(0), 'y', r.me.y.toFixed(0), 'hp', r.hp, Object.keys(inp).filter(k => inp[k]).join('+'), evs, r.boss ? 'B' + r.boss.hp + ' ' + (r.boss.act || '') : '')
  if (r.mode === 'dead') { console.log('DEAD', JSON.stringify(r.deathAt)); if (r.stats.deaths > 1) break; respawn(r) }
  if (r.won) { console.log('WON', r.t.toFixed(1), JSON.stringify(r.stats)); break }
}
