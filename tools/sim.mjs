// bot の分布。node tools/sim.mjs [回数] [始める布団 0-3]
// 死んだら最後の布団から再開（人と同じ）。10回倒れるか 15 分で打ち切り
import { newRun, step, respawn, fraction, DT } from '../shared/sim.js'
import { makeBot } from '../shared/bot.js'
const N = +process.argv[2] || 12, SAVE = +process.argv[3] || 0
const kinds = (process.argv[4] || 'learned,human,random,idle').split(',')
for (const kind of kinds) {
  const rows = []
  for (let i = 0; i < N; i++) {
    const seed = 101 + i * 7, r = newRun(seed, { save: SAVE }), bot = makeBot(kind, seed)
    let bossFirst = null, frames = 0, firstDeath = null
    while (frames < 60 * 900) {
      step(r, bot(r)); frames++
      if (r.mode === 'dead') {
        if (!firstDeath) firstDeath = { x: Math.round(r.deathAt.x), boss: r.deathAt.boss, by: r.deathAt.by }
        if (r.stats.deaths >= 10) break
        respawn(r)
      }
      if (r.won && r.modeT > 0.5) break
    }
    rows.push({ won: r.won, t: Math.round(r.t), hits: r.stats.hits, bossHits: r.stats.hitsBoss, deaths: r.stats.deaths, parries: r.stats.parries, kills: r.stats.kills, bossLeft: r.won ? 0 : Math.round(Math.min(r.stats.bossBest, fraction(r)) * 100), reached: r.maxX | 0, firstDeath })
  }
  const won = rows.filter(x => x.won), med = a => a.length ? a.sort((x, y) => x - y)[a.length >> 1] : '-'
  console.log(`\n== ${kind}  勝ち ${won.length}/${N}  被弾ゼロで勝ち ${won.filter(x => x.hits === 0).length}  時間(中央) ${med(won.map(x => x.t))}s  倒れた回数(中央) ${med(rows.map(x => x.deaths))}  被弾(中央) ${med(rows.map(x => x.hits))}  はじき(中央) ${med(rows.map(x => x.parries))}  魔人の残り(負け・中央) ${med(rows.filter(x => !x.won).map(x => x.bossLeft))}%`)
  for (const x of rows.slice(0, 6)) console.log(JSON.stringify(x))
}
