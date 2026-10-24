/* 中文 for TT Paper Route (送报小骑手). Loaded after js/keys.js. The kit (kit/lang.js) translates the page from this
   dictionary as it changes; canvas words go through Kit.lang.t() where they are drawn. Names stay in English. */
(function () {
  'use strict';
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Claude Code']);
  const DAY = { MONDAY: '星期一', TUESDAY: '星期二', WEDNESDAY: '星期三', THURSDAY: '星期四', FRIDAY: '星期五', SATURDAY: '星期六', SUNDAY: '星期天' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const WHY = {
    'GOT SOAKED': '被淋湿了', 'SLIPPED ON A SKATEBOARD': '踩到滑板滑倒了', 'BUMPED A ROBOT MOWER': '撞到机器人割草机了',
    'GOT LICKED BY A PUPPY': '被小狗舔了', 'BUMPED A CAR': '碰到汽车了', TUMBLED: '摔了一跤',
  };
  const N = '(TEDDY|TOMMY)';
  const D = '(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)';
  L.add(DAY);
  L.add({
    // the title page
    'TT Paper Route': '送报小骑手',
    'Toss the papers. Keep your customers. Ride all week!': '扔报纸，留住客户，骑满一星期！',
    '📰 1 PLAYER': '📰 单人', 'call your brother to help': '叫兄弟来帮忙',
    '👫 2 PLAYERS': '👫 双人', 'take turns, one day each': '轮流骑，一人一天',
    RIDER: '骑手', Rider: '骑手', Difficulty: '难度',
    'slower, big mailboxes, 5 lives': '慢一点，大信箱，5 条命', 'for big kids': '大孩子玩',
    steer: '转向', 'faster · slower': '加速 · 减速', 'throw left · right': '往左扔 · 往右扔',
    "The round pad steers (up is faster). The two paper buttons throw left and right. Tap your brother's face to call him.":
      '圆盘控制方向（往上是加速）。两个报纸按钮往左、往右扔报纸。点兄弟的头像叫他来帮忙。',
    '↻ Turn sideways for a bigger street!': '↻ 横过来，街道更大！',
    // the ? panel
    'throw a paper left · right': '往左 · 往右扔报纸', Or: '或',
    'Throw papers into the mailboxes (or onto the doormats) of the bright houses with a 📰 over them. Houses you miss stop ordering! With two players you take turns, one day each, and T is a high five.':
      '把报纸扔进头上有 📰 的彩色房子的信箱（或者门垫上）。错过的客户就不订报纸了！双人时轮流骑，一人一天，T 是击掌。',
    "The round pad steers (up is faster, down is slower). The two paper buttons throw left and right. Tap your brother's face to call him.":
      '圆盘控制方向（往上加速，往下减速）。两个报纸按钮往左、往右扔报纸。点兄弟的头像叫他来帮忙。',
    // the HUD and the touch buttons
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'next turn': '下一个', 'HIGH FIVE': '击掌', '📰 THROW': '📰 扔',
    'HI-SCORE': '最高分',
    // screens
    'P · Esc to go on · Q for the menu · M sound': 'P · Esc 继续 · Q 回菜单 · M 声音',
    'Enter to go on · Esc for the menu': '回车继续 · Esc 回菜单',
    'KEEP GOING': '接着骑', 'NEW!': '新纪录！',
    'WEEK DONE!': '一周送完啦！', 'Every paper day, Monday to Sunday!': '从星期一一直送到星期天！',
    'NO MORE CUSTOMERS!': '没有客户了！', 'Everybody stopped ordering. Try again!': '大家都不订报纸了。再试一次！',
    'OOPS!': '哎呀！', 'Out of lives. Keep going or try again!': '命用完了。接着骑，或者重新来！', "IT'S A TIE!": '平局！',
    'SEE WHO WON ▶': '看看谁赢了 ▶', 'SEE THE WEEK ▶': '看看这一周 ▶',
    '⭐ A perfect day! One house ordered again': '⭐ 完美的一天！又有一家订报纸了',
    // banners and toasts
    'READY!': '准备！', 'out of lives': '命用完了', 'BONUS PARK!': '奖励公园！', 'jump the ramps · hit the targets': '跳坡道 · 扔靶子',
    'TAP THE PAPER BUTTONS TO THROW!': '点报纸按钮扔报纸！', 'THROW WITH Z (LEFT) AND X (RIGHT)!': '用 Z（往左）和 X（往右）扔报纸！',
    'NO PAPERS LEFT! RIDE OVER A BUNDLE 📰': '报纸没了！骑过一捆报纸 📰',
    // words in the street (drawn on the canvas)
    'IN THE MAILBOX!': '进信箱啦！', 'ON THE MAT!': '放在门垫上！', 'NO PAPER HERE!': '这家没订！', 'GOT ONE ALREADY!': '已经有啦！',
    'BONK!': '咚！', 'GOOD PUPPY!': '乖狗狗！', 'ACHOO!': '阿嚏！', 'WHOOSH!': '嗖！', 'SPLASH!': '哗啦！', 'WHOOPS!': '哎哟！', 'BUMP!': '砰！',
    'LICK LICK!': '舔舔！', 'BEEP! OOPS!': '嘀！哎呀！', 'MISSED!': '错过了！', 'BOING!': '嘣！', 'WOOF WOOF!': '汪汪！', 'BEEP BEEP!': '嘀嘀！',
    'HIGH FIVE!': '击掌！', 'BONUS PARK': '奖励公园', FINISH: '终点', 'DAILY TT': 'TT 日报',
  });
  L.rule(/^SCORE (\d+)$/, '得分 $1');
  L.rule(/^HI-SCORE (\d+)$/, '最高分 $1');
  L.rule(new RegExp(`^${D} · THE DAILY TT$`), (m, d) => `${DAY[d]} · TT 日报`);
  L.rule(new RegExp(`^${D} ▶$`), (m, d) => `${DAY[d]} ▶`);
  L.rule(new RegExp(`^${D} DONE!$`), (m, d) => `${DAY[d]}送完啦！`);
  L.rule(new RegExp(`^PERFECT ${D}!$`), (m, d) => `完美的${DAY[d]}！`);
  L.rule(new RegExp(`^${N} IS OUT OF LIVES!$`), '$1 没有命了！');
  L.rule(new RegExp(`^${N} DELIVERS (\\d+) PAPERS?!$`), '$1 送了 $2 份报纸！');
  L.rule(new RegExp(`^${N} stops here this week\\.$`), '$1 这星期就到这里。');
  L.rule(new RegExp(`^${N}'S TURN ▶$`), '轮到 $1 ▶');
  L.rule(new RegExp(`^${N}'S TURN!$`), '轮到 $1 了！');
  L.rule(new RegExp(`^${N} WINS!$`), '$1 赢了！');
  L.rule(new RegExp(`^${N} (\\d+) · ${N} (\\d+)$`), '$1 $2 · $3 $4');
  L.rule(/^📰 (\d+) of (\d+) customers got a paper$/, '📰 $2 个客户里，$1 个收到了报纸');
  L.rule(/^😢 (\d+) stopped ordering$/, '😢 $1 家不订报纸了');
  L.rule(/^🏡 (\d+) new neighbours ordered a paper$/, '🏡 $1 家新邻居订了报纸');
  L.rule(/^(\d+) · 🏠 (\d+) customers$/, '$1 · 🏠 $2 个客户');
  L.rule(/^\+(\d+) for finishing$/, '骑到终点 +$1');
  L.rule(/^\+(\d+) BONUS PAPERS!$/, '奖励 $1 份报纸！');
  L.rule(/^\+(\d+) PAPERS$/, '+$1 份报纸');
  L.rule(/^✋ HIGH FIVE! \+(\d+) PAPERS$/, '✋ 击掌！+$1 份报纸');
  L.rule(/^CLANG! \+(\d+)$/, '哐！+$1');
  L.rule(/^BONK! \+(\d+)$/, '咚！+$1');
  L.rule(/^BULLSEYE! \+(\d+)$/, '正中靶心！+$1');
  L.rule(/^WHEEE! \+(\d+)$/, '呜呼！+$1');
  L.rule(new RegExp(`^${N} DELIVERED ONE!$`), '$1 送了一份！');
  L.rule(new RegExp(`^${N} IS HERE!$`), '$1 来了！');
  L.rule(new RegExp(`^✋ ${N} RIDES BY!$`), '✋ $1 骑过来了！');
  L.rule(new RegExp(`^${N} SAYS: I'LL DO THE NEXT (\\d+) HOUSES!$`), '$1 说：接下来 $2 家我来送！');
  L.rule(new RegExp(`^${N} SAYS: (\\d+) MORE HOUSES!$`), '$1 说：再帮你送 $2 家！');
  L.rule(new RegExp(`^${N} SAYS: BYE BYE!$`), '$1 说：拜拜！');
  L.rule(new RegExp(`^(\\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM ${N}!$`), (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(new RegExp(`^${N} (GOT SOAKED|SLIPPED ON A SKATEBOARD|BUMPED A ROBOT MOWER|GOT LICKED BY A PUPPY|BUMPED A CAR|TUMBLED)! HEE HEE!$`), (m, who, why) => `${who} ${WHY[why]}！嘻嘻！`);
})();
