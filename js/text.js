// 画面の文言（日英）
export const TEXT = {
  ja: {
    title1: '禁煙三日目、', title2: '煙の魔人',
    story: '禁煙して三日目の夜。灰皿から煙の魔人が出てきて「一本だけ吸えよ」と言う。布団にくるまったまま、屋上まで追いかけて追い払え。',
    start: '布団から出る', cont: '布団から（{n}）', lang: 'English',
    keysPC: '移動 ← → ／ 下でしゃがむ ／ 上で上に撃つ\nZ・スペース 跳ぶ　X 撃つ（押しっぱなし）\nシフト ダッシュ　C はじく\nパッド: A 跳ぶ / X 撃つ / RB ダッシュ / B はじく',
    keysTouch: '左下に指を置いて、そのまま倒すと移動（上に倒すと上へ撃つ・下でしゃがむ）。\n右下のいちばん大きい丸で跳ぶ。撃つは1回押すと撃ちっぱなし、もう1回で止まる。\nゲームパッドをつなぐとパッドでも遊べる。横向きにすると広く見える。',
    btn: { jump: '跳ぶ', shoot: '撃つ', dash: 'ダッシュ', parry: 'はじく' }, stickHint: '指を置いて倒す',
    rot: '横向きにすると広く見えます',
    note: {
      move: ['移動', '← →'], jump: ['跳ぶ', 'Z / スペース'], shoot: ['撃つ', 'X 押しっぱなし\n上を押すと上へ'], dash: ['穴はダッシュで', 'シフト'],
      parry: ['白い輪は はじける', 'C を当たる直前に'], save: ['布団で寝ると', 'ここから再開']
    },
    noteT: { move: ['移動', '左下に指を置いて\nそのまま左右へ'], jump: ['跳ぶ', '右下の大きい丸'], shoot: ['撃つ', '1回で撃ちっぱなし\n指を上に倒すと上へ'], dash: ['穴はダッシュで', '跳んでから押す'], parry: ['白い輪は はじける', '当たる直前に押す'], save: ['布団で寝ると', 'ここから再開'] },
    noteP: { move: ['移動', 'スティック'], jump: ['跳ぶ', 'A'], shoot: ['撃つ', 'X 押しっぱなし'], dash: ['穴はダッシュで', 'RB'], parry: ['白い輪は はじける', 'B を直前に'], save: ['布団で寝ると', 'ここから再開'] },
    saved: '布団を敷いた', parried: 'はじいた',
    say: { intro: 'おまえ、三日目で？ 一本だけ吸えって', phase2: 'ゴホッ…今日だけ。今日だけな', down: '…明日から、本気出すわ', hurt: 'あっつ' },
    deadHead: '禁煙手帳', deadSub: '{d}回目の夜ふかし', deadWhere: 'ここで倒れた', bossLeft: '魔人の残り', stageGot: '進んだ道',
    fromSave: '布団から', fromStart: '最初から', saveNames: ['部屋', '路地の入口', '外階段', '屋上の前'],
    winHead: '禁煙手帳', winSub: '三日目の夜　煙の魔人をはらった',
    rowTime: 'かかった時間', rowHit: '被弾', rowParry: 'はじいた', rowDeath: '倒れた', again: 'もう一回', post: 'Xでポスト',
    stamp: { s: '一本も\n吸わず', a: '四日目へ', b: 'ぎりぎり\n我慢', c: '明日も\nがんばる' },
    postText: '禁煙三日目、煙の魔人を被弾{h}回・{t}で追い払った #禁煙三日目煙の魔人',
    pause: '一時停止中', resume: 'つづける', mute: '音', credit: '音: CC0 / Public domain の録音（CREDITS）'
  },
  en: {
    title1: 'Day 3', title2: 'Without Smokes',
    story: 'Night three of quitting smoking. A smoke genie climbs out of the ashtray: "Just one, come on." Chase it to the rooftop, still wrapped in your futon.',
    start: 'Get up', cont: 'From the futon ({n})', lang: '日本語',
    keysPC: 'Move ← → / Down to duck / Up to aim up\nZ or Space jump   X shoot (hold)\nShift dash   C flap (parry)\nPad: A jump / X shoot / RB dash / B flap',
    keysTouch: 'Put a thumb down at the bottom left and push to move (push up to aim up, down to duck).\nThe big button at the bottom right jumps. Shoot toggles on and off.\nA gamepad works too. Turn sideways for a wider view.',
    btn: { jump: 'Jump', shoot: 'Shoot', dash: 'Dash', parry: 'Flap' }, stickHint: 'Thumb here, push',
    rot: 'Turn sideways for a wider view',
    note: {
      move: ['Move', '← →'], jump: ['Jump', 'Z / Space'], shoot: ['Shoot', 'hold X\nUp to aim up'], dash: ['Dash over gaps', 'Shift'],
      parry: ['White rings can be flapped', 'C right before'], save: ['Sleep on a futon', 'to save']
    },
    noteT: { move: ['Move', 'thumb down bottom left\nand push'], jump: ['Jump', 'big bottom-right button'], shoot: ['Shoot', 'tap once to keep firing\npush the stick up to aim up'], dash: ['Dash over gaps', 'jump, then dash'], parry: ['White rings can be flapped', 'press right before'], save: ['Sleep on a futon', 'to save'] },
    noteP: { move: ['Move', 'stick'], jump: ['Jump', 'A'], shoot: ['Shoot', 'hold X'], dash: ['Dash over gaps', 'RB'], parry: ['White rings can be flapped', 'B right before'], save: ['Sleep on a futon', 'to save'] },
    saved: 'Futon laid out', parried: 'Flapped',
    say: { intro: 'Day three, you? Just one, come on', phase2: '*cough* Just today. Only today', down: '...Fine. I quit. Tomorrow.', hurt: 'Hot!' },
    deadHead: 'Quit Diary', deadSub: 'Late night no. {d}', deadWhere: 'Fell here', bossLeft: 'Genie left', stageGot: 'Distance',
    fromSave: 'From the futon', fromStart: 'From the start', saveNames: ['Room', 'Alley', 'Stairs', 'Rooftop door'],
    winHead: 'Quit Diary', winSub: 'Night three. Smoke genie cleared out',
    rowTime: 'Time', rowHit: 'Hits taken', rowParry: 'Flapped', rowDeath: 'Fell', again: 'Again', post: 'Post on X',
    stamp: { s: 'Not\na puff', a: 'On to\nday four', b: 'Barely\nheld on', c: 'Try again\ntomorrow' },
    postText: 'Day 3 Without Smokes: cleared with {h} hits in {t} #Day3WithoutSmokes',
    pause: 'Paused', resume: 'Resume', mute: 'Sound', credit: 'Sound: CC0 / Public domain recordings (CREDITS)'
  }
}
