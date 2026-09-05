/* Overworld definition. Terrain is rasterized deterministically by world.js from these regions,
   roads and rivers, then hand-placed structures are stamped on top. Coordinates are tile units. */
window.WORLDMAP = {
  w: 64, h: 56, seed: 20240517,
  // Biome regions painted in order (later wins). kinds: grass, forest, hills, mountain, swamp, sand, water
  regions: [
    { kind: 'grass', x: 0, y: 0, w: 64, h: 56 },
    { kind: 'forest', x: 0, y: 3, w: 44, h: 21, density: 0.55 },
    { kind: 'forest', x: 0, y: 24, w: 6, h: 8, density: 0.4 },
    { kind: 'mountain', x: 0, y: 0, w: 64, h: 3 },
    { kind: 'mountain', x: 56, y: 0, w: 8, h: 18 },
    { kind: 'hills', x: 46, y: 6, w: 12, h: 26, density: 0.5 },
    { kind: 'swamp', x: 0, y: 26, w: 15, h: 26, density: 0.6 },
    { kind: 'forest', x: 46, y: 48, w: 18, h: 8, density: 0.5 },
    { kind: 'grass', x: 15, y: 24, w: 30, h: 26 }, // town clearing
    { kind: 'graveyard', x: 47, y: 38, w: 12, h: 10 },
    { kind: 'sand', x: 0, y: 53, w: 64, h: 1 },
    { kind: 'water', x: 0, y: 54, w: 64, h: 2 },
  ],
  // River: polyline of points; width 2
  rivers: [[[44, 0], [44, 12], [46, 20], [45, 30], [45, 40], [46, 50], [46, 54]]],
  bridges: [{ x: 44, y: 36, w: 4, h: 1 }],
  // Roads: polylines (tile centers)
  roads: [
    [[31, 46], [31, 39], [31, 33]],            // south road into square
    [[31, 33], [31, 27], [30, 24], [30, 10], [30, 6]], // north to caves
    [[31, 36], [43, 36], [48, 36], [53, 36], [53, 24], [53, 20]], // east across bridge to fort
    [[53, 36], [53, 44], [51, 45]],           // to graveyard
    [[53, 20], [55, 14], [57, 9]],            // mountain mine
    [[31, 36], [17, 36], [10, 36], [10, 40]], // west to swamp hamlet
    [[10, 36], [7, 30], [6, 27]],             // drowned village
    [[10, 40], [8, 46], [5, 48]],             // sunken temple
    [[30, 10], [22, 12], [12, 12], [9, 13]],  // forest den
    [[31, 46], [31, 51]],                     // to the shore
  ],
  // Buildings: footprint solid; door tile is on the south face (y+h). enter: ui id or interior map
  buildings: [
    { id: 'tavern', name: 'The Rusty Flagon', x: 19, y: 29, w: 8, h: 5, roof: '#8a3a2a', wall: '#7a5a3a', door: 23, enter: 'interior:tavern', sign: 'Inn & Tavern' },
    { id: 'temple', name: 'Temple of the Dawn', x: 28, y: 25, w: 7, h: 5, roof: '#5a6a8a', wall: '#8a8a90', door: 31, enter: 'ui:temple', sign: 'Temple', spire: true },
    { id: 'smith', name: 'Ironbelly Smithy', x: 36, y: 29, w: 6, h: 4, roof: '#5a4a4a', wall: '#6a5a4a', door: 38, enter: 'ui:smith', sign: 'Blacksmith', chimney: true },
    { id: 'merchant', name: 'Quill\'s Curiosities', x: 36, y: 39, w: 6, h: 4, roof: '#3a6a4a', wall: '#8a7a5a', door: 38, enter: 'ui:merchant', sign: 'General Store' },
    { id: 'guild', name: 'Adventurers\' Guild', x: 20, y: 39, w: 7, h: 4, roof: '#8a6a2a', wall: '#6a5a4a', door: 23, enter: 'ui:guild', sign: 'Guild Hall', banner: true },
    { id: 'house1', name: 'Cottage', x: 16, y: 26, w: 3, h: 3, roof: '#8a4a3a', wall: '#8a7a5a', door: 17, enter: 'talk:mabel' },
    { id: 'house2', name: 'Cottage', x: 40, y: 45, w: 3, h: 3, roof: '#6a5a8a', wall: '#8a7a5a', door: 41, enter: 'talk:fenwick' },
    { id: 'house3', name: 'Cottage', x: 24, y: 46, w: 3, h: 3, roof: '#5a7a4a', wall: '#8a7a5a', door: 25, enter: 'talk:locked' },
    { id: 'house4', name: 'Cottage', x: 40, y: 25, w: 3, h: 3, roof: '#8a6a3a', wall: '#8a7a5a', door: 41, enter: 'talk:locked' },
    // Brackenmoor hamlet (unlocked in Act 3)
    { id: 'btavern', name: 'The Soggy Boot', x: 6, y: 38, w: 5, h: 4, roof: '#4a5a3a', wall: '#5a5a4a', door: 8, enter: 'ui:btavern', sign: 'Tavern', locked: 'brackenmoor' },
    { id: 'bmerchant', name: 'Bog Goods', x: 12, y: 38, w: 4, h: 3, roof: '#5a4a3a', wall: '#5a5a4a', door: 13, enter: 'ui:bmerchant', sign: 'Trader', locked: 'brackenmoor' },
  ],
  props: [ // decorative/interactive props in the world
    { kind: 'questBoard', x: 34, y: 35, name: 'Quest Board' }, { kind: 'well', x: 29, y: 37 },
    { kind: 'stall', x: 27, y: 35, color: '#c04040' }, { kind: 'stall', x: 27, y: 37, color: '#4080c0' }, { kind: 'stall', x: 35, y: 38, color: '#40a050' },
    { kind: 'signpost', x: 30, y: 23, text: 'North: Gnawtooth Caverns (goblins, probably)\nWest fork: Bramblewood' },
    { kind: 'signpost', x: 48, y: 37, text: 'East: Redwatch Fort — TOLL ROAD (bring coin)\nSouth: Ashwood Graveyard' },
    { kind: 'signpost', x: 16, y: 35, text: 'West: Brackenmoor. Mind the bog. Mind the lights.' },
    { kind: 'lamp', x: 30, y: 33 }, { kind: 'lamp', x: 33, y: 39 }, { kind: 'lamp', x: 22, y: 36 }, { kind: 'lamp', x: 38, y: 34 },
    { kind: 'statue', x: 31, y: 36, name: 'Statue of the Unknown Adventurer', text: 'The plaque reads: "They went in. They came out. Mostly."' },
    { kind: 'campfire', x: 10, y: 41, locked: 'brackenmoor' },
    { kind: 'questBoard', x: 10, y: 37, name: 'Brackenmoor Notice Post', locked: 'brackenmoor' },
  ],
  // Dungeon sites on the overworld
  dungeons: [
    { id: 'caves', name: 'Gnawtooth Caverns', theme: 'cave', x: 30, y: 5, kind: 'cave', region: 'forest' },
    { id: 'den', name: 'Bramblewood Den', theme: 'forest', x: 8, y: 13, kind: 'hollow', region: 'forest' },
    { id: 'fort', name: 'Redwatch Fort', theme: 'fort', x: 53, y: 19, kind: 'fort', region: 'hills' },
    { id: 'mine', name: 'The Old Copperworks', theme: 'mine', x: 58, y: 8, kind: 'mine', region: 'mountain' },
    { id: 'crypt', name: 'The Ashwood Crypt', theme: 'crypt', x: 51, y: 44, kind: 'crypt', region: 'graveyard' },
    { id: 'village', name: 'The Drowned Village', theme: 'swamp', x: 6, y: 26, kind: 'ruin', region: 'swamp' },
    { id: 'temple', name: 'The Sunken Temple', theme: 'temple', x: 4, y: 49, kind: 'temple', region: 'swamp', locked: 'act5' },
    { id: 'seacave', name: 'Gullwater Sea Cave', theme: 'cave', x: 31, y: 52, kind: 'cave', region: 'shore' },
  ],
  // Wandering NPCs in town (x,y start; they idle nearby)
  npcs: [
    { id: 'guard', name: 'Guard Hobb', x: 31, y: 44, sprite: { skin: '#d9a37a', cloth: '#5a5a7a', hair: '#3a2a1a', hat: 'helm', weapon: 'spear' }, dialog: 'guard' },
    { id: 'tilly', name: 'Tilly Farrow', x: 26, y: 36, sprite: { skin: '#f1c9a5', cloth: '#c06060', hair: '#c05020', sex: 'f' }, dialog: 'tilly' },
    { id: 'roderic', name: 'Big Roderic', x: 36, y: 36, sprite: { skin: '#b97a52', cloth: '#4a6a3a', hair: '#1a1a1a', scale: 1.1 }, dialog: 'roderic' },
    { id: 'sprig', name: 'Auntie Sprig', x: 18, y: 35, sprite: { skin: '#e0b08a', cloth: '#7a5a8a', hair: '#e0e0e0', sex: 'f', scale: 0.75 }, dialog: 'sprig' },
    { id: 'quill', name: 'Master Quill', x: 38, y: 44, sprite: { skin: '#d9a37a', cloth: '#3a6a4a', hair: '#8a8a8a', hat: 'cap' }, dialog: 'quill' },
    { id: 'bogwitch', name: 'Old Nettle', x: 9, y: 42, sprite: { skin: '#a9a08a', cloth: '#3a4a3a', hair: '#8a9a7a', sex: 'f', hat: 'hood' }, dialog: 'nettle', locked: 'brackenmoor' },
  ],
  // Tavern interior map. Legend: # wall, . floor, = bar counter, t table, o stool, F fireplace, c barrel, > trapdoor (cellar), D exit door, B bed, r rug, k keg, p plant, w window
  tavernInterior: {
    name: 'The Rusty Flagon', theme: 'tavern',
    rows: [
      '################',
      '#kkk=.......wF.#',
      '#ccc=..t.t...F.#',
      '#...=.oo.oo....#',
      '#..............#',
      '#.t.t.....t.t..#',
      '#.oo.oo...oo.oo#',
      '#..............#',
      '#p...t.t......>#',
      '#....oo.oo..c..#',
      '#......D.......#',
      '################',
    ],
    exit: { x: 7, y: 10 }, cellar: { x: 14, y: 8 }, wake: { x: 12, y: 8 },
    npcs: [
      { id: 'grell', name: 'Bosun Grell', x: 2, y: 3, sprite: { skin: '#c9906a', cloth: '#8a3a2a', hair: '#3a2a1a', beard: true, scale: 1.05 }, dialog: 'grell', role: 'barkeep' },
      { id: 'wren', name: 'Wren Ashby', x: 8, y: 2, sprite: { skin: '#f1c9a5', cloth: '#2a4a6a', hair: '#2a2a2a', sex: 'f', hat: 'hood' }, dialog: 'wren', role: 'quest' },
      { id: 'tam', name: 'Brother Tam', x: 12, y: 5, sprite: { skin: '#d9a37a', cloth: '#e0c060', hair: '#8a8a8a' }, dialog: 'tam' },
      { id: 'drunk', name: 'Carrow the Tinker', x: 3, y: 5, sprite: { skin: '#e0b08a', cloth: '#5a4a3a', hair: '#c05020', hat: 'cap', scale: 0.8 }, dialog: 'carrow' },
      { id: 'bard', name: 'Jonquil', x: 13, y: 2, sprite: { skin: '#b97a52', cloth: '#a040a0', hair: '#f0e060', sex: 'f' }, dialog: 'jonquil' },
    ],
    searchables: [
      { x: 9, y: 8, text: 'Under the table: a sticky coin and a very old chicken bone.', gold: 1, once: true },
      { x: 12, y: 9, text: 'The barrel is empty except for a note: "IOU one barrel — Carrow".', once: true },
      { x: 1, y: 2, text: 'Behind the barrels you find a dusty bottle. Grell would not approve.', item: 'potionHealing', once: true, dc: { skill: 'investigation', dc: 10 } },
      { x: 13, y: 1, text: 'The fireplace is warm. Something glints in the ash: a copper ring. Worthless, but shiny.', gold: 2, once: true },
    ],
  },
};
