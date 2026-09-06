/* Handcrafted room pieces for the dungeon generator.
   Legend:  # wall   . floor   + door candidate (border)   s secret door candidate (border)
            @ party entry  X exit  M monster spawn  B boss spawn  m elite/minion spawn
            C chest  c container (barrel/crate/coffin/ore)  T trap candidate  P pillar  S statue  A altar
            b bookshelf  t table  f brazier  w water (difficult)  ~ rubble (difficult)  L lever  r rune tile
            k key pedestal  ! story event  G cage (prisoner)  g grave (may hold undead)  R rest spot (campfire)
   Each template: {role, w,h, rows:[...], tags} — role: entrance|combat|treasure|puzzle|story|boss|secret|rest|hall */
window.ROOMS = [
  // ---- Entrance rooms ----
  { role: 'entrance', rows: ['###+###', '#.....#', '#..@..#', '#.....#', '#c...c#', '###+###'] },
  { role: 'entrance', rows: ['#########', '#..~....+', '#..@....#', '+.......#', '#....c..#', '####+####'] },
  { role: 'entrance', rows: ['###+###', '#f...f#', '#.....#', '+..@..+', '#.....#', '#f...f#', '###+###'] },
  // ---- Combat rooms ----
  { role: 'combat', rows: ['####+####', '#.......#', '#.M...M.#', '+...P...+', '#.M...M.#', '#.......#', '####+####'] },
  { role: 'combat', rows: ['#####+#####', '#....~....#', '#.M.....M.#', '+....T....+', '#...M.M...#', '#c.......c#', '#####+#####'] },
  { role: 'combat', rows: ['###+####', '#..M...#', '#.P..P.#', '+......+', '#.P..P.#', '#...M..#', '#..M...#', '####+###'] },
  { role: 'combat', rows: ['####+####', '#..#....#', '#M.#.M..#', '+..#....+', '#....#..#', '#.M..#M.#', '####+####'] },
  { role: 'combat', rows: ['######+######', '#...........#', '#.M.......M.#', '#.....f.....#', '+...........+', '#.M...c...M.#', '#...........#', '######+######'] },
  { role: 'combat', rows: ['##+###', '#M...#', '#....+', '+..M.#', '#....#', '#M...#', '###+##'] },
  { role: 'combat', rows: ['#####+#####', '#ww.....ww#', '#w..M.M..w#', '+.........+', '#w..M....w#', '#ww.c...ww#', '#####+#####'] },
  { role: 'combat', rows: ['####+####', '#~~....M#', '#~.....~#', '+.M....~+', '#~.....~#', '#M....~~#', '####+####'] },
  // ---- Treasure rooms ----
  { role: 'treasure', rows: ['###+###', '#c...c#', '#..C..#', '#.T.T.#', '#c...c#', '###s###'] },
  { role: 'treasure', rows: ['####+####', '#b.....b#', '#...C...#', '+.T...T.+', '#...M...#', '#c.....c#', '####s####'] },
  { role: 'treasure', rows: ['###+####', '#.....P#', '#.....C#', '+.T....#', '#....c.#', '#c.....#', '########'] },
  { role: 'treasure', rows: ['#####+#####', '#g.g...g.g#', '#.........#', '+....C....+', '#.........#', '#g.g.g.g.g#', '###########'] },
  // ---- Puzzle rooms ----
  { role: 'puzzle', puzzle: 'levers', rows: ['####+####', '#L.....L#', '#.......#', '+...S...+', '#.......#', '#L..C..L#', '#########'] },
  { role: 'puzzle', puzzle: 'runes', rows: ['####+####', '#r.r.r.r#', '#.......#', '+..S.C..#', '#.......#', '#r.r.r.r#', '####+####'] },
  { role: 'puzzle', puzzle: 'riddle', rows: ['###+###', '#.....#', '#..S..#', '#.....#', '#C...C#', '#..D..#', '###+###'] },
  { role: 'puzzle', puzzle: 'altar', rows: ['####+####', '#f.....f#', '#...A...#', '+.......+', '#.......#', '#f..C..f#', '#########'] },
  { role: 'puzzle', puzzle: 'pressure', rows: ['#####+#####', '#.........#', '#.T.T.T.T.#', '+....k....+', '#.T.T.T.T.#', '#....C....#', '###########'] },
  // ---- Story / event rooms ----
  { role: 'story', rows: ['####+####', '#t.....t#', '#...!...#', '+.......+', '#c.....c#', '####+####'] },
  { role: 'story', rows: ['###+###', '#G...G#', '#.....#', '+..!..+', '#.....#', '###+###'] },
  { role: 'story', rows: ['#####+#####', '#b.b...b.b#', '#.........#', '+...t!t...+', '#.........#', '#b.b...b.b#', '#####+#####'] },
  { role: 'story', rows: ['####+####', '#w.....w#', '#w..!..w#', '+.......+', '#.......#', '####+####'] },
  { role: 'story', rows: ['###+####', '#.....g#', '#.g.!g.#', '+......+', '#..g...#', '####+###'] },
  // ---- Rest rooms ----
  { role: 'rest', rows: ['###+###', '#.....#', '#..R..#', '#c...c#', '###+###'] },
  { role: 'rest', rows: ['####+####', '#..w....#', '#..w.R..#', '+..w....+', '#.......#', '####+####'] },
  // ---- Boss rooms ----
  { role: 'boss', rows: ['######+######', '#P.........P#', '#...m...m...#', '#.....B.....#', '#...........#', '#.f...X...f.#', '#P.........P#', '#############'] },
  { role: 'boss', rows: ['#####+#####', '#~.......~#', '#..m...m..#', '#....B....#', '#.........#', '#c...X...c#', '###########'] },
  { role: 'boss', rows: ['#######+#######', '#w...........w#', '#w..m.....m..w#', '#......B......#', '#.............#', '#..S...X...S..#', '#w...........w#', '###############'] },
  { role: 'boss', rows: ['####+####', '#A.....A#', '#..m.m..#', '#...B...#', '#.......#', '#...X...#', '#########'] },
  // ---- Secret rooms ----
  { role: 'secret', rows: ['#####', 's.C.#', '#...#', '#c.c#', '#####'] },
  { role: 'secret', rows: ['###s###', '#.....#', '#.C.C.#', '#..!..#', '#######'] },
  // ---- Halls (connectors, may hold a monster) ----
  { role: 'hall', rows: ['###+###', '#.....#', '+..M..+', '#.....#', '###+###'] },
  { role: 'hall', rows: ['##+##', '#...#', '#...#', '+...+', '#...#', '#...#', '##+##'] },
  { role: 'hall', rows: ['#####+#####', '#P.......P#', '+....T....+', '#P.......P#', '#####+#####'] },
];
// Theme palettes for the renderer + decoration remaps
window.THEMES = {
  cellar: { name: 'Cellar', floor: ['#544236', '#5c4a3c', '#4c3c30'], wall: '#2e231c', wallTop: '#7a6654', accent: '#8a6a3a', container: 'barrel', light: 0.8, ambient: '#2a1a10' },
  cave: { name: 'Cave', floor: ['#514d48', '#5a554e', '#47433e'], wall: '#2e2a26', wallTop: '#7a736a', accent: '#6a8a4a', container: 'crate', light: 0.7, ambient: '#101418' },
  crypt: { name: 'Crypt', floor: ['#3e465a', '#464e62', '#363e50'], wall: '#22263a', wallTop: '#6c7290', accent: '#8a8aa0', container: 'coffin', light: 0.65, ambient: '#0a0c18' },
  forest: { name: 'Den', floor: ['#46563a', '#4e5e44', '#405034'], wall: '#33261a', wallTop: '#7a6448', accent: '#7ac060', container: 'crate', light: 0.8, ambient: '#0c140c' },
  fort: { name: 'Fort', floor: ['#66625c', '#6e6a64', '#5e5a54'], wall: '#3e3630', wallTop: '#9a8e80', accent: '#a03030', container: 'crate', light: 0.9, ambient: '#141210' },
  temple: { name: 'Temple', floor: ['#46586c', '#4e6076', '#3e5062'], wall: '#26304a', wallTop: '#7c94b8', accent: '#c040a0', container: 'urn', light: 0.7, ambient: '#0a0a1a' },
  mine: { name: 'Mine', floor: ['#584c42', '#60544a', '#50443a'], wall: '#362c24', wallTop: '#8c7c6a', accent: '#c08a3a', container: 'cart', light: 0.6, ambient: '#100c08' },
  swamp: { name: 'Bog', floor: ['#465646', '#4e5e4e', '#3e4e3e'], wall: '#26321e', wallTop: '#6e7e5a', accent: '#60c080', container: 'crate', light: 0.7, ambient: '#08140c' },
};
