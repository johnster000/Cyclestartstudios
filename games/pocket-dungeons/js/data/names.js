/* Names, companion personalities, and bark lines. */
(function () {
  const N = {};
  N.first = {
    human: { m: ['Aldric', 'Bram', 'Cedric', 'Doran', 'Edwin', 'Garrett', 'Hal', 'Jory', 'Marcus', 'Osric', 'Piers', 'Rowan', 'Tobias', 'Wil'], f: ['Ada', 'Brenna', 'Cora', 'Elspeth', 'Gwen', 'Isolde', 'Jenna', 'Liss', 'Mara', 'Nell', 'Petra', 'Sabine', 'Tamsin', 'Wren'] },
    elf: { m: ['Aelar', 'Erevan', 'Galinndan', 'Ivellios', 'Laucian', 'Quarion', 'Soveliss', 'Thamior', 'Varis'], f: ['Adrie', 'Caelynn', 'Enna', 'Keyleth', 'Lia', 'Naivara', 'Quelenna', 'Shava', 'Valanthe'] },
    dwarf: { m: ['Adrik', 'Baern', 'Dain', 'Eberk', 'Harbek', 'Orsik', 'Rurik', 'Thoradin', 'Vondal'], f: ['Amber', 'Bardryn', 'Diesa', 'Gunnloda', 'Helja', 'Kathra', 'Riswynn', 'Torbera', 'Vistra'] },
    halfling: { m: ['Alton', 'Cade', 'Eldon', 'Garret', 'Lyle', 'Merric', 'Osborn', 'Perrin', 'Roscoe', 'Wellby'], f: ['Andry', 'Bree', 'Callie', 'Cora', 'Kithri', 'Lavinia', 'Merla', 'Nedda', 'Seraphina', 'Verna'] },
    gnome: { m: ['Alston', 'Boddynock', 'Dimble', 'Fonkin', 'Gimble', 'Namfoodle', 'Roondar', 'Wrenn', 'Zook'], f: ['Bimpnottin', 'Carlin', 'Donella', 'Ellyjobell', 'Lilli', 'Nissa', 'Orla', 'Roywyn', 'Tana'] },
    halforc: { m: ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Ront', 'Thokk'], f: ['Baggi', 'Emen', 'Engong', 'Kansif', 'Myev', 'Neega', 'Ovak', 'Ownka', 'Shautha', 'Vola'] },
    tiefling: { m: ['Akmenos', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Mordai', 'Skamos', 'Therai'], f: ['Akta', 'Bryseis', 'Damaia', 'Kallista', 'Lerissa', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'] },
    dragonborn: { m: ['Arjhan', 'Balasar', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Nadarr', 'Torinn'], f: ['Akra', 'Biri', 'Farideh', 'Harann', 'Kava', 'Korinn', 'Mishann', 'Perra', 'Sora', 'Thava'] },
  };
  N.epithets = ['the Bold', 'the Quiet', 'Half-Boot', 'of the Fens', 'Two-Coins', 'the Younger', 'Ironbelly', 'Quickfingers', 'the Unlucky', 'Goldtooth', 'the Patient', 'Nine-Lives', 'Ashwalker', 'the Lost'];
  N.random = (race, sex, rng) => { const r = rng || Math.random; const list = (N.first[race] || N.first.human)[sex === 'f' ? 'f' : 'm']; return list[Math.floor(r() * list.length)]; };

  // Companion personalities: id, name, barks (arrays), and a quirk used by dialogue
  N.personalities = [
    { id: 'cheerful', name: 'Cheerful', quirk: 'hums while fighting', barks: { greet: ['Oh, a real adventure! I brought snacks.', 'Lead the way, friend! Try not to die, it makes me sad.'], combat: ['Here we go! Everyone stretch first!', 'Ooh, dice time!'], kill: ['Sorry! Well, not that sorry.', 'That one\'s for the snacks it would have eaten.'], hurt: ['Ow! Rude!', 'I felt that in my teeth.'], loot: ['Shiny! Is it mine? Can it be mine?'], levelUp: ['I feel taller. Am I taller?'], down: ['Just… resting my eyes…'] } },
    { id: 'grim', name: 'Grim', quirk: 'sharpens a blade at every rest', barks: { greet: ['I go where the fight is. Try to keep up.', 'Fine. But I don\'t do speeches.'], combat: ['Finally.', 'Kill them before they kill us. Simple.'], kill: ['Next.', 'They should have stayed home.'], hurt: ['Tch. A scratch.', 'I\'ve had worse from breakfast.'], loot: ['Take it. We\'ll need every coin.'], levelUp: ['Stronger. Good.'], down: ['…not… yet…'] } },
    { id: 'scholar', name: 'Scholarly', quirk: 'takes notes on every monster', barks: { greet: ['Fascinating. A dungeon expedition! I\'ll document everything.', 'I have read extensively about this. Mostly.'], combat: ['Observe the enemy formation. Then hit it.', 'For science!'], kill: ['Noted: vulnerable to being hit with things.', 'A textbook result.'], hurt: ['That is going in my report.', 'Fascinating. Painful, but fascinating.'], loot: ['Let me catalogue that before anyone touches it.'], levelUp: ['My hypotheses grow stronger, as do I.'], down: ['Tell the… archive…'] } },
    { id: 'coward', name: 'Nervous', quirk: 'checks every door for traps twice', barks: { greet: ['Is it dangerous? It\'s dangerous, isn\'t it. Okay. Okay, I\'m in.', 'I\'ll come but I\'m staying behind the big one.'], combat: ['Oh no. Oh no no no. Okay. Fighting.', 'Why are they looking at ME?'], kill: ['I did that? I did that!', 'It\'s dead! Is it dead? Poke it.'], hurt: ['I KNEW this would happen!', 'Ow! I want to go home!'], loot: ['Is it cursed? It looks cursed.'], levelUp: ['Maybe I\'ll survive after all.'], down: ['I told… you…'] } },
    { id: 'noble', name: 'Noble', quirk: 'refuses to sit on barrels', barks: { greet: ['You may have the honor of my company.', 'I suppose someone competent should come along.'], combat: ['Have at you, ruffians!', 'Do try to fight with some dignity.'], kill: ['Dispatched. As expected.', 'A fitting end for a brute.'], hurt: ['You DARE?', 'That was my good cloak!'], loot: ['Modest. But acceptable.'], levelUp: ['Excellence, naturally.'], down: ['Tell mother… I fought well…'] } },
    { id: 'greedy', name: 'Greedy', quirk: 'bites every coin', barks: { greet: ['Split the loot even and we\'ll get along fine.', 'Gold first, glory second, safety a distant third.'], combat: ['Anyone who kills it gets first pick!', 'Careful! Don\'t damage the loot!'], kill: ['Check its pockets!', 'Ka-ching.'], hurt: ['That\'ll cost you!', 'Healing potions aren\'t free, you know!'], loot: ['Now THAT is why I came.', 'Mine. I\'m calling it.'], levelUp: ['Worth more by the day.'], down: ['My… gold…'] } },
    { id: 'pious', name: 'Pious', quirk: 'blesses the dice before every roll', barks: { greet: ['The light guides us. Also, I brought bandages.', 'Faith and a good mace. That\'s all we need.'], combat: ['Stand firm! The light is with us!', 'Repent! Or don\'t. Either works.'], kill: ['Go in peace. Quickly.', 'May you find rest. Elsewhere.'], hurt: ['A test of faith. A painful one.', 'I forgive you. I also hit back.'], loot: ['A blessing in a box.'], levelUp: ['I am renewed.'], down: ['Into… the light…'] } },
    { id: 'wild', name: 'Wild', quirk: 'talks to spiders', barks: { greet: ['The forest says you\'re alright. Let\'s go.', 'Smells like adventure. And goblins.'], combat: ['Circle them like wolves!', 'Teeth out!'], kill: ['Nature reclaims.', 'The pack grows stronger.'], hurt: ['Grr!', 'I\'ll remember that smell.'], loot: ['Shiny things. Humans love shiny things.'], levelUp: ['I feel the wild in me.'], down: ['The earth… calls…'] } },
  ];

  N.townsfolk = ['Old Mabel', 'Fenwick the Cooper', 'Sister Odile', 'Bosun Grell', 'Tilly Farrow', 'Master Quill', 'Hobb', 'Wren Ashby', 'Big Roderic', 'Auntie Sprig', 'Jonquil', 'Brother Tam', 'Ysolde', 'Carrow the Tinker'];
  N.tavernGossip = [
    'They say the goblins in the north caves have started wearing matching hats. Unsettling.',
    'Old Mabel swears the graveyard sang last night. In harmony.',
    'A merchant caravan went missing on the hill road. Third one this season.',
    'Don\'t drink the "special" ale. It\'s special because Grell found it in the cellar.',
    'The temple bells rang twice at midnight. Sister Odile says she didn\'t ring them.',
    'Someone\'s been buying up all the lamp oil in town. Fenwick thinks it\'s for a party.',
    'I saw a man with a spiral tattoo on his neck asking about "the sleeper." Whatever that means.',
    'The swamp light is back. Green, this time. Green is worse than blue.',
    'The blacksmith says his anvil is haunted. It hums a shanty.',
    'Rumor is the old Sunken Temple isn\'t as sunk as it used to be.',
  ];
  N.dungeonNames = {
    cave: ['Gnawtooth Caverns', 'the Whistling Hollow', 'Rattleback Caves', 'the Mossy Deep', 'Stonewhisper Burrows'],
    crypt: ['the Ashwood Crypt', 'the Weeping Barrow', 'Saint Merrow\'s Tomb', 'the Hollow Ossuary', 'the Silent Vaults'],
    forest: ['the Bramblewood Den', 'Thornhollow', 'the Root Warren', 'Widow\'s Thicket', 'the Owl\'s Larder'],
    fort: ['Redwatch Fort', 'the Broken Keep', 'Grimstone Outpost', 'Wolf\'s Rest Tower', 'the Toll House'],
    temple: ['the Sunken Temple', 'the Spiral Sanctum', 'the Drowned Chapel', 'the Eye\'s Vestibule', 'the Chanting Halls'],
    mine: ['the Old Copperworks', 'Deepdelve Mine', 'the Collapsed Seam', 'Ironroot Shaft', 'the Lantern Pits'],
    swamp: ['the Drowned Village', 'Fenmire Hovels', 'the Rotting Bog', 'Willowdrown', 'the Green Light Marsh'],
    cellar: ['the Flagon Cellar', 'the Rat Warren', 'the Undercroft', 'Grell\'s Cellar', 'the Sour Casks'],
  };
  N.bossModifiers = [
    { id: 'frenzied', name: 'Frenzied', desc: '+1 die of damage on every hit.', apply: (m) => { m.frenzied = true; } },
    { id: 'armored', name: 'Armored', desc: '+2 AC.', apply: (m) => { m.ac += 2; } },
    { id: 'vampiric', name: 'Vampiric', desc: 'Heals for half the damage it deals.', apply: (m) => { m.vampiric = true; } },
    { id: 'swift', name: 'Swift', desc: '+10 ft speed and advantage on initiative.', apply: (m) => { m.speed += 10; m.swift = true; } },
    { id: 'towering', name: 'Towering', desc: '+50% hit points.', apply: (m) => { m.hp = Math.floor(m.hp * 1.5); m.maxHp = m.hp; } },
    { id: 'cursed', name: 'Cursed', desc: 'Its hits reduce healing on you for a round.', apply: (m) => { m.cursedHits = true; } },
    { id: 'zealous', name: 'Zealous', desc: 'Fights on to 0 HP once (Relentless).', apply: (m) => { m.relentlessOnce = true; } },
  ];
  window.NAMES = N;
})();
