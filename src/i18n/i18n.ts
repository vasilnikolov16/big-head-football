/**
 * Tiny i18n: every visible string lives here in Bulgarian and English.
 * `t('key', { n: 3 })` replaces {n} placeholders.
 */
export type Lang = 'bg' | 'en';

let lang: Lang = 'bg';
const listeners: Array<() => void> = [];

export const getLang = (): Lang => lang;

export function setLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  document.documentElement.lang = l;
  document.title = t('game.name');
  for (const fn of listeners) fn();
}

export function onLangChange(fn: () => void): void {
  listeners.push(fn);
}

/** Pick the right variant of a { bg, en } pair. */
export const tr = (pair: { bg: string; en: string }): string => pair[lang];

const S: Record<string, [string, string]> = {
  // game
  'game.name': ['Кратунбол', 'Kratunball'],
  'game.title1': ['КРАТУН', 'KRATUN'],
  'game.title2': ['БОЛ', 'BALL'],
  'game.subtitle': ['футбол с големи глави', 'big head football'],

  // common
  back: ['Назад', 'Back'],
  done: ['Готово', 'Done'],
  on: ['Вкл.', 'On'],
  off: ['Изкл.', 'Off'],
  auto: ['Авто', 'Auto'],
  or: ['или', 'or'],
  sec: ['{n} сек', '{n} sec'],
  player1: ['Играч 1', 'Player 1'],
  player2: ['Играч 2', 'Player 2'],
  you: ['ТИ', 'YOU'],
  cpu: ['CPU', 'CPU'],
  'diff.easy': ['Лесно', 'Easy'],
  'diff.medium': ['Средно', 'Medium'],
  'diff.hard': ['Трудно', 'Hard'],
  'tag.easy': ['CPU · лесно', 'CPU · easy'],
  'tag.medium': ['CPU · средно', 'CPU · medium'],
  'tag.hard': ['CPU · трудно', 'CPU · hard'],
  soon: ['скоро', 'soon'],
  keyboardOnly: ['клавиатура', 'keyboard'],

  // main menu
  'menu.cpu': ['Срещу компютъра', 'Vs computer'],
  'menu.pvp': ['Двама играчи', 'Two players'],
  'menu.tournament': ['Турнир', 'Tournament'],
  'menu.stats': ['Статистика и постижения', 'Stats & achievements'],
  'menu.howto': ['Как се играе', 'How to play'],
  'menu.settings': ['Настройки', 'Settings'],
  'menu.hints': ['↑ ↓ избор   ·   Enter избери', '↑ ↓ choose   ·   Enter select'],

  // vs cpu setup
  'cpu.title': ['Срещу компютъра', 'Vs computer'],
  'cpu.difficulty': ['Трудност', 'Difficulty'],
  'cpu.desc.easy': ['Бавен, мисли дълго и често греши. За загрявка.', 'Slow, thinks a lot and makes mistakes. A warm-up.'],
  'cpu.desc.medium': ['Чете траекторията, пази вратата и отвръща на удара.', 'Reads the flight, guards the goal and hits back.'],
  'cpu.desc.hard': [
    'Безмилостен: предвижда всичко, засича ударите с глава и не прощава.',
    'Merciless: predicts everything, wins the headers and never forgives.',
  ],
  'cpu.controls': ['Твоите контроли', 'Your controls'],
  'cpu.duration': ['Продължителност', 'Match length'],
  'cpu.pick': ['Избери герой ▸', 'Pick hero ▸'],

  // settings
  'settings.title': ['Настройки', 'Settings'],
  'tab.sound': ['Звук', 'Sound'],
  'tab.game': ['Игра', 'Game'],
  'tab.controls': ['Контроли', 'Controls'],
  'tab.language': ['Език', 'Language'],
  'settings.sfx': ['Звукови ефекти', 'Sound effects'],
  'settings.music': ['Музика', 'Music'],
  'settings.crowd': ['Публика', 'Crowd'],
  'settings.powerups': ['Бонуси на терена', 'Power-ups'],
  'settings.replays': ['Повторение на гола', 'Goal replay'],
  'settings.cpuDiff': ['Трудност (компютър)', 'CPU difficulty'],
  'settings.touch': ['Бутони на екрана', 'On-screen buttons'],
  'settings.fps': ['Брояч на FPS', 'FPS counter'],
  'settings.language': ['Език на играта', 'Game language'],
  'settings.tabHint': ['Q / E — смяна на раздела', 'Q / E — switch tab'],
  'settings.reset': ['Изтрий прогреса', 'Reset progress'],
  'settings.resetConfirm': ['Натисни пак, за да изтриеш всичко', 'Press again to erase everything'],
  'settings.resetDone': ['Прогресът е изтрит.', 'Progress erased.'],

  // controls editor
  'act.left': ['Наляво', 'Left'],
  'act.right': ['Надясно', 'Right'],
  'act.jump': ['Скок', 'Jump'],
  'act.kick': ['Ритник', 'Kick'],
  'act.super': ['Супер удар', 'Super shot'],
  'act.superShort': ['Супер', 'Super'],
  'controls.p1': ['Играч 1 · ляв', 'Player 1 · left'],
  'controls.p2': ['Играч 2 · десен', 'Player 2 · right'],
  'controls.help': [
    'Избери действие, натисни Enter (или кликни), после натисни новия клавиш.',
    'Pick an action, press Enter (or click), then press the new key.',
  ],
  'controls.press': ['Натисни клавиш…', 'Press a key…'],
  'controls.pressHint': ['Натисни новия клавиш (Esc — отказ).', 'Press the new key (Esc — cancel).'],
  'controls.cancelled': ['Отказано.', 'Cancelled.'],
  'controls.reserved': ['{k} е запазен (пауза/меню) — избери друг клавиш.', '{k} is reserved (pause/menu) — pick another key.'],
  'controls.swapped': ['{k} беше „{a}“ на {p} — сега там е {o}.', '{k} was “{a}” of {p} — that is now {o}.'],
  'controls.set': ['Готово: {a} = {k}', 'Done: {a} = {k}'],
  'controls.reset': ['По подразбиране', 'Defaults'],
  'controls.resetDone': ['Върнато е стандартното управление.', 'Default controls restored.'],

  // how to play
  'howto.title': ['Как се играе', 'How to play'],
  'howto.move': ['движение', 'move'],
  'howto.jump': ['скок (задръж = по-високо)', 'jump (hold = higher)'],
  'howto.kick': ['ритник', 'kick'],
  'howto.super': ['супер удар', 'super shot'],
  'howto.dash': ['даш (бързо 2 пъти в една посока)', 'dash (tap a direction twice quickly)'],
  'howto.tip1': [
    'Ритникът е най-силен, ако го натиснеш малко преди топката да стигне до крака. Късният ритник праща топката високо.',
    'Kicks are strongest if you press just before the ball reaches your foot. A late kick lobs the ball high.',
  ],
  'howto.tip2': [
    'Лентата за супер удар се пълни сама с времето и по-бързо, когато докосваш топката. Пълна лента → супер бутона → героят светва, а следващото му докосване хваща топката: играта замръзва за миг, топката се зарежда и ударът изригва. Зареденият удар остава и след гол, но не може да се ползва, докато се празнува гол.',
    'The super bar fills by itself over time and faster when you touch the ball. Full bar → super button → your hero glows, and the next touch catches the ball: the game freezes for a moment, the ball charges up and the shot erupts. An armed shot stays armed after a goal, but it can’t be used during goal celebrations.',
  ],
  'howto.tip3': ['Удряй бонусите с топката (или ги докосни), за да ги вземеш.', 'Hit power-ups with the ball (or touch them) to collect them.'],
  'howto.tip4': ['При равенство след края на времето — златен гол: следващият печели.', 'A draw at full time means golden goal: next goal wins.'],
  'howto.tip5': [
    'Esc или P — пауза (оттам са и настройките). Клавишите се сменят от Настройки → Контроли.',
    'Esc or P — pause (settings are there too). Rebind keys in Settings → Controls.',
  ],
  'howto.tip6': [
    'Турнир: победи всички герои един след друг. Победеният заключен герой се отключва.',
    'Tournament: beat every hero in a row. A locked hero you beat gets unlocked.',
  ],
  'howto.touchTitle': ['На телефон / таблет', 'On phone / tablet'],
  'howto.touch': [
    '◀ ▶ долу вляво — движение, бързо докосни два пъти за даш. Вдясно: ⚡ супер (светва при пълна лента), 👟 ритник, ⬆ скок. ❚❚ — пауза.',
    '◀ ▶ bottom left — move, tap twice quickly to dash. On the right: ⚡ super (lights up when the bar is full), 👟 kick, ⬆ jump. ❚❚ — pause.',
  ],
  'howto.ok': ['Разбрах!', 'Got it!'],

  // pause
  'pause.title': ['Пауза', 'Paused'],
  'pause.resume': ['Продължи', 'Resume'],
  'pause.restart': ['Започни отначало', 'Restart'],
  'pause.settings': ['Настройки', 'Settings'],
  'pause.quit': ['Към менюто', 'Quit to menu'],

  // post match
  'post.win': ['ПОБЕДА!', 'VICTORY!'],
  'post.lose': ['ЗАГУБА', 'DEFEAT'],
  'post.draw': ['РАВЕНСТВО', 'DRAW'],
  'post.winner': ['ПЕЧЕЛИ {n}!', '{n} WINS!'],
  'post.golden': ['решено със златен гол', 'decided by a golden goal'],
  'post.rematch': ['Реванш', 'Rematch'],
  'post.change': ['Смени герой', 'Change hero'],
  'post.menu': ['Меню', 'Menu'],
  'post.hints': ['← → избор   ·   Enter избери', '← → choose   ·   Enter select'],
  'post.continue': ['Към турнира ▸', 'Back to tournament ▸'],
  'post.retry': ['Опитай пак', 'Try again'],
  'stat.shots': ['Удари', 'Shots'],
  'stat.headers': ['Удари с глава', 'Headers'],
  'stat.touches': ['Докосвания', 'Touches'],
  'stat.jumps': ['Скокове', 'Jumps'],
  'stat.possession': ['Владеене %', 'Possession %'],
  'stat.supers': ['Супер удари', 'Super shots'],

  // hero select
  'sel.pickHero': ['Избери герой', 'Pick your hero'],
  'sel.pickOpp': ['Избери противник', 'Pick your opponent'],
  'sel.allReady': ['Всичко е готово!', 'All set!'],
  'sel.pressStart': ['Натисни СТАРТ', 'Press START'],
  'sel.browse': ['Разгледай героите и избери с кого ще играеш', 'Browse the heroes and pick who you play'],
  'sel.vsWho': ['Срещу кого ще играеш? ({l})', 'Who do you play against? ({l})'],
  'sel.pvpTitle': ['Изберете герои', 'Pick your heroes'],
  'sel.pvpSub': ['Разгледайте героите — всеки избира сам', 'Browse the heroes — everyone picks on their own'],
  'sel.start': ['СТАРТ ▸', 'START ▸'],
  'sel.waitBoth': ['Чакаме двамата играчи…', 'Waiting for both players…'],
  'sel.pickBoth': ['Избери двамата', 'Pick both'],
  'sel.ready': ['Готов ✓', 'Ready ✓'],
  'sel.change': ['Промени', 'Change'],
  'sel.stamp': ['ГОТОВ!', 'READY!'],
  'sel.firstPick': ['Първо избери своя герой', 'Pick your own hero first'],
  'sel.super': ['СУПЕР УДАР', 'SUPER SHOT'],
  'sel.speed': ['Скорост', 'Speed'],
  'sel.jumpStat': ['Скок', 'Jump'],
  'sel.power': ['Сила', 'Power'],
  'sel.head': ['Глава', 'Head'],
  'sel.locked': ['Победи го в турнира', 'Beat them in the tournament'],
  'sel.hint.cpu0': ['← → ↑ ↓ разглеждане   ·   Enter готов   ·   Esc назад', '← → ↑ ↓ browse   ·   Enter ready   ·   Esc back'],
  'sel.hint.cpu1': [
    '← → ↑ ↓ разглеждане   ·   Enter готов   ·   R случаен   ·   Esc назад',
    '← → ↑ ↓ browse   ·   Enter ready   ·   R random   ·   Esc back',
  ],
  'sel.hint.ready': ['Enter — старт   ·   Esc — промени', 'Enter — start   ·   Esc — change'],
  'sel.hint.pvpReady': ['{a} или {b} — старт   ·   Esc — промени', '{a} or {b} — start   ·   Esc — change'],
  'sel.hint.pvp': ['P1: {a}   ·   P2: {b}   ·   Esc назад', 'P1: {a}   ·   P2: {b}   ·   Esc back'],
  'sel.keys': ['{m} избор · {o} готов', '{m} browse · {o} ready'],
  'sel.tournament': ['Турнир: избери своя герой', 'Tournament: pick your hero'],

  // hud / match
  'hud.golden': ['ЗЛАТЕН ГОЛ', 'GOLDEN GOAL'],
  'hud.superReady': ['СУПЕР УДАР — ГОТОВ!', 'SUPER SHOT READY!'],
  'hud.charged': ['ЗАРЕДЕН — ДОКОСНИ ТОПКАТА!', 'CHARGED — TOUCH THE BALL!'],
  'banner.ready': ['ГОТОВИ?', 'READY?'],
  'banner.goal': ['ГОЛ!', 'GOAL!'],
  'banner.goldenGoal': ['ЗЛАТЕН ГОЛ!', 'GOLDEN GOAL!'],
  'banner.golden': ['ЗЛАТЕН ГОЛ', 'GOLDEN GOAL'],
  'banner.nextWins': ['Следващият гол печели!', 'Next goal wins!'],
  'replay.title': ['ПОВТОРЕНИЕ', 'REPLAY'],
  'replay.skip': ['натисни клавиш, за да пропуснеш', 'press any key to skip'],
  'touch.rotate': ['Завърти телефона хоризонтално', 'Rotate your phone to landscape'],

  // ad boards (fictional brands)
  'ad.1': ['КРАТУН-КОЛА', 'KRATUN COLA'],
  'ad.2': ['ЛЮТЕНИЦА PRO', 'LUTENITSA PRO'],
  'ad.3': ['БАНИЧКА+', 'BANITSA+'],
  'ad.4': ['ГЛАВА ТВ', 'HEAD TV'],
  'ad.5': ['ШОПСКА ЕНЕРДЖИ', 'SHOPSKA ENERGY'],
  'ad.6': ['ТИКВА БАНК', 'PUMPKIN BANK'],

  // tournament
  'tour.title': ['Турнир', 'Tournament'],
  'tour.round': ['Рунд {n}', 'Round {n}'],
  'tour.final': ['ФИНАЛ', 'FINAL'],
  'tour.play': ['Играй рунд {n} ▸', 'Play round {n} ▸'],
  'tour.playFinal': ['Играй финала ▸', 'Play the final ▸'],
  'tour.new': ['Нов турнир', 'New tournament'],
  'tour.newConfirm': ['Натисни пак — текущият турнир ще се изгуби', 'Press again — the current run will be lost'],
  'tour.sub': ['Победи всички {n} героя един след друг. Накрая те чака купа!', 'Beat all {n} heroes in a row. A trophy awaits!'],
  'tour.hero': ['Твоят герой: {h}', 'Your hero: {h}'],
  'tour.losses': ['Загуби: {n}', 'Losses: {n}'],
  'tour.lockedOpp': ['Заключен — победи го, за да го отключиш', 'Locked — beat them to unlock'],
  'tour.champion': ['ШАМПИОН!', 'CHAMPION!'],
  'tour.cupText': ['Спечели купата на Кратунбол с {h}!', 'You won the Kratunball cup with {h}!'],
  'tour.flawless': ['Без нито една загуба!', 'Without a single loss!'],
  'tour.unlocked': ['Отключен: {h}', 'Unlocked: {h}'],
  'tour.wins': ['Спечелени купи: {n}', 'Cups won: {n}'],

  // stats
  'stats.title': ['Статистика', 'Statistics'],
  'stats.tab.stats': ['Числа', 'Numbers'],
  'stats.tab.ach': ['Постижения', 'Achievements'],
  'stats.played': ['Изиграни мачове', 'Matches played'],
  'stats.cpuRecord': ['Срещу компютъра (П/З)', 'Vs computer (W/L)'],
  'stats.pvp': ['Мачове за двама', 'Two-player matches'],
  'stats.goals': ['Вкарани голове', 'Goals scored'],
  'stats.conceded': ['Допуснати голове', 'Goals conceded'],
  'stats.supers': ['Супер удари', 'Super shots'],
  'stats.powerups': ['Взети бонуси', 'Power-ups collected'],
  'stats.perfect': ['Перфектни ритници', 'Perfect kicks'],
  'stats.cups': ['Спечелени купи', 'Cups won'],
  'stats.bestWin': ['Най-голяма победа', 'Biggest win'],
  'stats.mostGoals': ['Най-много голове в мач', 'Most goals in a match'],
  'stats.fastest': ['Най-бърз гол след начален удар', 'Fastest goal after kick-off'],
  'stats.streak': ['Най-дълга серия победи', 'Longest win streak'],
  'stats.favHero': ['Любим герой', 'Favourite hero'],
  'stats.heroes': ['Отключени герои', 'Heroes unlocked'],
  'stats.achProgress': ['{a} от {b} постижения', '{a} of {b} achievements'],
  'stats.none': ['—', '—'],
  'ach.unlocked': ['Ново постижение!', 'Achievement unlocked!'],

  // online
  'menu.online': ['Онлайн игра', 'Play online'],
  'online.title': ['Онлайн игра', 'Online play'],
  'online.desc': [
    'Играйте един срещу друг от два компютъра или телефона. Единият създава стая и праща кода, а другият влиза с него.',
    'Play each other from two computers or phones. One of you creates a room and shares the code, the other joins with it.',
  ],
  'online.name': ['Твоето име', 'Your name'],
  'online.namePh': ['напиши име', 'type a name'],
  'online.defaultName': ['Играч {n}', 'Player {n}'],
  'online.needName': ['Първо си напиши име, за да те познае приятелят ти.', 'Type a name first so your friend knows it is you.'],
  'online.create': ['Създай стая', 'Create a room'],
  'online.join': ['Влез в стая', 'Join a room'],
  'online.code': ['Код на стаята', 'Room code'],
  'online.codePh': ['K7QX', 'K7QX'],
  'online.creating': ['Създавам стая…', 'Creating a room…'],
  'online.joining': ['Свързване със стая {c}…', 'Connecting to room {c}…'],
  'online.err.notFound': ['Няма стая с код {c}. Провери кода — стаята изчезва, ако домакинът излезе.', 'There is no room {c}. Check the code — a room disappears when its host leaves.'],
  'online.err.network': ['Няма връзка със сървъра за стаи. Провери интернета и опитай пак.', 'Cannot reach the room server. Check your internet and try again.'],
  'online.err.full': ['Стаята е пълна — в нея вече се играе.', 'The room is full — a match is already on.'],
  'online.err.version': ['Имате различни версии на играта. Презаредете страницата (Ctrl+F5) и опитайте пак.', 'You have different versions of the game. Reload the page (Ctrl+F5) and try again.'],
  'online.err.unsupported': ['Този браузър не поддържа онлайн игра. Опитай с Chrome, Edge, Firefox или Safari.', 'This browser cannot play online. Try Chrome, Edge, Firefox or Safari.'],
  'online.err.timeout': ['Свързването отне твърде дълго. Опитай пак — понякога помага друга мрежа (Wi‑Fi вместо мобилни данни).', 'Connecting took too long. Try again — another network sometimes helps (Wi‑Fi instead of mobile data).'],
  'online.err.taken': ['Не успях да създам стая. Опитай пак.', 'Could not create a room. Try again.'],
  'online.err.code': ['Кодът е от 4 знака.', 'The code has 4 characters.'],
  'online.lobby': ['Стая', 'Room'],
  'online.share': ['Прати кода или линка на приятел', 'Send the code or the link to a friend'],
  'online.copyCode': ['Копирай кода', 'Copy code'],
  'online.copyLink': ['Копирай линк', 'Copy link'],
  'online.copied': ['Копирано!', 'Copied!'],
  'online.waiting': ['Чакаме приятел…', 'Waiting for a friend…'],
  'online.host': ['домакин', 'host'],
  'online.you': ['ти', 'you'],
  'online.ping': ['{n} ms', '{n} ms'],
  'online.toHeroes': ['Към героите ▸', 'Pick heroes ▸'],
  'online.hostPicks': ['Домакинът избира настройките и пуска избора на герои.', 'The host picks the settings and opens hero select.'],
  'online.leave': ['Напусни стаята', 'Leave the room'],
  'online.matchSettings': ['Настройки на мача', 'Match settings'],
  'online.left': ['{n} напусна.', '{n} left.'],
  'online.lost': ['Връзката с {n} прекъсна.', 'Lost the connection to {n}.'],
  'online.hostLeft': ['Домакинът затвори стаята.', 'The host closed the room.'],
  'online.selTitle': ['Изберете герои', 'Pick your heroes'],
  'online.selSub': ['Разгледай и натисни „Готов“. Виждаш какво избира {n}.', 'Browse and press Ready. You can see what {n} is picking.'],
  'online.waitHost': ['Чакаме домакина…', 'Waiting for the host…'],
  'online.waitOpp': ['Чакаме {n}…', 'Waiting for {n}…'],
  'online.pressStartHost': ['Двамата сте готови — натисни СТАРТ!', 'You are both ready — press START!'],
  'online.pressStartGuest': ['Двамата сте готови — домакинът пуска мача.', 'You are both ready — the host starts the match.'],
  'online.selHint': ['← → ↑ ↓ разглеждане   ·   Enter готов   ·   Esc към стаята', '← → ↑ ↓ browse   ·   Enter ready   ·   Esc back to the room'],
  'online.slow': ['Връзката се бави…', 'Connection hiccup…'],
  'online.waitingOpp': ['Чакаме противника…', 'Waiting for the opponent…'],
  'online.rematchWait': ['Чакаме {n} да приеме реванша…', 'Waiting for {n} to accept…'],
  'online.rematchAsk': ['{n} иска реванш!', '{n} wants a rematch!'],
  'online.rematchCancel': ['Отказ от реванш', 'Cancel rematch'],
  'online.menuTitle': ['Меню', 'Menu'],
  'online.noPause': ['Мачът продължава — онлайн няма пауза.', 'The match goes on — there is no pause online.'],
  'online.quitMatch': ['Напусни мача', 'Leave the match'],
  'online.emotes': ['Емотикони: 1 2 3 4', 'Emotes: 1 2 3 4'],
  'online.back': ['Назад', 'Back'],
  'tab.online': ['Онлайн', 'Online'],
  'settings.onlineName': ['Име на играча', 'Player name'],
  'settings.netBuffer': ['Плавност онлайн', 'Online smoothness'],
  'settings.netBufferDesc': [
    'Важи, когато влизаш в чужда стая: „Бързо“ = най-малко забавяне, „Гладко“ = по-плавно при слаб интернет.',
    'Applies when you join someone else’s room: "Fast" = least delay, "Smooth" = steadier on a weak connection.',
  ],
  'settings.showPing': ['Показвай пинга', 'Show ping'],
  'buf.fast': ['Бързо', 'Fast'],
  'buf.normal': ['Нормално', 'Normal'],
  'buf.smooth': ['Гладко', 'Smooth'],
  'stats.online': ['Онлайн мачове (П/З)', 'Online matches (W/L)'],
  'menu.installIos': [
    '📲 На цял екран като приложение: Сподели ⬆ → „Добави към началния екран“',
    '📲 Full screen, like an app: Share ⬆ → “Add to Home Screen”',
  ],
  'menu.installAndroid': [
    '📲 На цял екран като приложение: менюто ⋮ на браузъра → „Инсталирай приложението“',
    '📲 Full screen, like an app: browser menu ⋮ → “Install app”',
  ],
  'howto.tip8': [
    'Дашът (2 бързи натискания наляво или надясно) те изстрелва напред: стига се топка, която ти е избягала, а ако се засилиш в противника — събаряш го за миг. После трябва малко време, преди да можеш пак.',
    'Dash (tap left or right twice quickly) shoots you forward: catch a ball that got away, or charge into your opponent to knock them over for a moment. It needs a short rest before the next one.',
  ],
  'howto.tip7': [
    'Онлайн игра: единият създава стая, другият влиза с кода (или с линка). По време на мача 1 2 3 4 пращат емотикони.',
    'Online: one player creates a room, the other joins with the code (or the link). During the match 1 2 3 4 send emotes.',
  ],
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const e = S[key];
  let s = e ? e[lang === 'bg' ? 0 : 1] : key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
