/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: PR.TITLE,
  cols: ['Keys', 'Or'],
  keys: [
    ['steer', '← →', 'A D'],
    ['faster · slower', '↑ ↓', 'W S'],
    ['throw a paper left · right', 'Z X', ', .'],
    ['call your brother', 'T', ''],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: 'Throw papers into the mailboxes (or onto the doormats) of the bright houses with a 📰 over them. Houses you miss stop ordering! With two players you take turns, one day each, and T is a high five.',
  touch: 'The round pad steers (up is faster, down is slower). The two paper buttons throw left and right. Tap your brother\'s face to call him.',
});
