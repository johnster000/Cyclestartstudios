/* Story content: intro, main quest acts (with twists), random quest templates, dungeon events, riddles, NPC dialogue.
   Dialogue nodes: {speaker, text, choices:[{text, next, check:{skill,dc}, pass, fail, set:{flag:true}, req:{flag}, action:'id'}]}
   Text may include {name} (hero name), {class}, {race}, {giver}, {dungeon}. */
(function () {
  const S = {};
  S.intro = [
    'Your head hurts. Your mouth tastes like copper and cheap ale.',
    'You are lying under a table in a tavern. Someone has tucked a bar rag under your head as a pillow, which was kind.',
    'Your coin purse is gone. Your memory of the last three days is gone with it.',
    'You remember your name. You remember how to fight. You do not remember how you got here.',
    'Somewhere behind the bar, a very large man is polishing a glass and watching you with the patience of someone who has seen this before.',
  ];
  S.dialogs = {
    grell: {
      start: { speaker: 'Bosun Grell', text: 'Ah. The sleeper wakes. You came in three nights ago with two hooded fellows, drank one cup of my worst ale and went down like a felled oak. They paid for your room and left. You never made it to the room.', choices: [
        { text: 'Hooded fellows? Who were they?', next: 'hooded' },
        { text: 'Three nights?! Who took my coin purse?', next: 'purse' },
        { text: '[Intimidation] Tell me everything, barkeep.', check: { skill: 'intimidation', dc: 12 }, pass: 'intimidated', fail: 'intimidateFail' },
        { text: 'Is there work? I\'m broke.', next: 'work' },
      ] },
      hooded: { speaker: 'Bosun Grell', text: 'Didn\'t catch faces. One had a tattoo on the neck, a spiral like a snail with eyes. Paid in good coin. Too good for this place, frankly.', choices: [{ text: 'A spiral with eyes…', next: 'work', set: { heardSpiral: true } }, { text: 'Is there work?', next: 'work' }] },
      purse: { speaker: 'Bosun Grell', text: 'Not me, and not my regulars, they know better. But I\'ll tell you what: the rats in my cellar have been dragging off anything shiny for a week. If your purse is anywhere, it\'s down there. Along with whatever\'s been eating my cheese.', choices: [{ text: 'You want me to clear your cellar.', next: 'work' }] },
      intimidated: { speaker: 'Bosun Grell', text: '…Fine. FINE. One of them came back the next morning. Asked if you\'d "said anything strange in your sleep." Slipped me a gold piece to keep quiet. Here, take it, it gives me the creeps. Spiral stamped right on it.', choices: [{ text: 'Take the coin.', next: 'work', action: 'giveSigilCoinEarly', set: { heardSpiral: true } }] },
      intimidateFail: { speaker: 'Bosun Grell', text: 'Friend, I have thrown out ogres. Sit down before you fall down. Now: about my cellar…', choices: [{ text: 'Your cellar?', next: 'work' }] },
      work: { speaker: 'Bosun Grell', text: 'Rats. Big ones. My cellar\'s crawling and I\'ve lost a cask of Redwatch brandy to the little fiends. Clear it out, find whatever they\'ve been hoarding, and I\'ll feed and bed you for a week. The trapdoor\'s in the corner. Mind the steps. And if you\'d rather not go alone, the Guild Hall across the square owes me a favour: your first companion is on the house.', choices: [
        { text: 'I\'ll do it. (Accept: Something in the Cellar)', action: 'acceptQuest:act1', next: 'accepted' },
        { text: 'Let me look around first.', next: null }] },
      accepted: { speaker: 'Bosun Grell', text: 'Good. Oh, and take this, it\'s for the smell. Mostly.', action: 'giveItem:torch', choices: [{ text: 'Thanks.', next: null }] },
      idle: { speaker: 'Bosun Grell', text: '{gossip}', choices: [{ text: 'Rest here for the night (long rest).', action: 'longRest', next: null }, { text: 'Buy a round for the room. (5 gp, party morale)', action: 'buyRound', next: null }, { text: 'Just passing through.', next: null }] },
    },
    wren: {
      start: { speaker: 'Wren Ashby', text: 'You\'re the one who\'s been asleep under table four. Don\'t look so surprised, it\'s a small tavern. I\'m Wren. I find things people lose. For a fee.', choices: [
        { text: 'I lost three days and a purse.', next: 'lost' },
        { text: '[Insight] You already know something about me.', check: { skill: 'insight', dc: 12 }, pass: 'insight', fail: 'insightFail' },
        { text: 'Nice to meet you.', next: null }] },
      lost: { speaker: 'Wren Ashby', text: 'Three days is a lot to lose. Purses come back. Days don\'t. Whoever did this to you used something nasty. Come find me when you have a lead and I\'ll help you pull the thread.', choices: [{ text: 'I will.', next: null }] },
      insight: { speaker: 'Wren Ashby', text: '…Sharp. Yes. The men who brought you in weren\'t just hooded, they were nervous. Nervous men don\'t pay in advance. Somebody wanted you kept here, asleep, and watched. I don\'t know why yet. I intend to find out.', choices: [{ text: 'Then we want the same thing.', next: null, set: { wrenAlly: true } }] },
      insightFail: { speaker: 'Wren Ashby', text: 'I know you snore. That\'s all I\'ll admit to for free.', choices: [{ text: 'Fair.', next: null }] },
      idle: { speaker: 'Wren Ashby', text: 'Still pulling threads. Anything with a spiral on it, bring it to me.', choices: [{ text: 'Will do.', next: null }] },
    },
    tam: { start: { speaker: 'Brother Tam', text: 'Bless you, traveller. If you\'re hurt, the temple up the road mends bones and worse. Sister Odile is… direct, but she\'s good at it.', choices: [{ text: 'Thanks, Brother.', next: null }] } },
    carrow: { start: { speaker: 'Carrow the Tinker', text: '*hic* I saw \'em. The hood men. One dropped a coin and it ROLLED. Rolled right under the floorboards. Rats got it. Rats get everything. Rats\'ll have my TOOLS next.', choices: [{ text: 'Sober up, Carrow.', next: null }, { text: '[Persuasion] Tell me more about the coin.', check: { skill: 'persuasion', dc: 10 }, pass: 'coin', fail: 'coinFail' }] }, coin: { speaker: 'Carrow the Tinker', text: 'Gold. Stamped funny. Spiral. Like… like a snail that\'s watching you. *hic*', choices: [{ text: 'Noted.', next: null, set: { heardSpiral: true } }] }, coinFail: { speaker: 'Carrow the Tinker', text: '*snore*', choices: [{ text: '…', next: null }] } },
    jonquil: { start: { speaker: 'Jonquil', text: '♪ Oh the sleeper slept for three long nights, and woke without a coin ♪ — sorry, sorry, it\'s a work in progress. You\'re the sleeper, yes? Give me a good story and I\'ll make you famous.', choices: [{ text: 'Working on it.', next: null }, { text: '[Performance] Let me show you how it\'s done.', check: { skill: 'performance', dc: 13 }, pass: 'perf', fail: 'perfFail' }] }, perf: { speaker: 'Jonquil', text: 'Oh, you\'re GOOD. Here, a tip from the crowd. Don\'t spend it on ale.', action: 'giveGold:5', choices: [{ text: 'Cheers.', next: null }] }, perfFail: { speaker: 'Jonquil', text: 'Well. Stick to the dungeon work.', choices: [{ text: 'Ouch.', next: null }] } },
    guard: { start: { speaker: 'Guard Hobb', text: 'Welcome to Hollowmere. No fighting in the square, no fireballs near the thatch, and if you see anyone with a spiral tattoo, you tell me. Or don\'t. Honestly they scare me.', choices: [{ text: 'Understood.', next: null }] } },
    tilly: { start: { speaker: 'Tilly Farrow', text: 'Fresh bread! Well, fresh-ish. Hey, you\'re the one who slept at the Flagon for three days! Grell drew a little moustache on you. It\'s gone now. Mostly.', choices: [{ text: '…Thanks, Tilly.', next: null }] } },
    roderic: { start: { speaker: 'Big Roderic', text: 'Used to adventure myself. Then a goblin took my kneecap. Not broke it. TOOK it. Anyway, the guild hall recruits companions if you don\'t fancy going alone.', choices: [{ text: 'Good tip.', next: null }] } },
    sprig: { start: { speaker: 'Auntie Sprig', text: 'Ooh, an adventurer. Take a biscuit. Take two. You look like you\'ve been under a table for three days.', action: 'giveItem:goodberry', choices: [{ text: 'Thank you, Auntie.', next: null }] } },
    quill: { start: { speaker: 'Master Quill', text: 'My shop\'s just there. Potions, scrolls, and things I bought from adventurers who didn\'t come back to reclaim them. Very reasonable prices. Very.', choices: [{ text: 'I\'ll take a look.', next: null }] } },
    mabel: { start: { speaker: 'Old Mabel', text: 'The graveyard sang again last night, dearie. Hymns. Old ones. Backwards. You might mention it to someone with a sword. Oh — you have a sword.', choices: [{ text: 'I\'ll look into it.', next: null }] } },
    fenwick: { start: { speaker: 'Fenwick the Cooper', text: 'Barrels. I make barrels. Grell buys my barrels. Grell says rats are eating his barrels. That\'s not barrel quality, that\'s a rat problem.', choices: [{ text: 'Agreed.', next: null }] } },
    locked: { start: { speaker: 'Door', text: 'The door is locked. Someone inside coughs and pretends not to be home.', choices: [{ text: 'Leave them be.', next: null }] } },
    cottager: { start: { speaker: 'Sela Ord', text: 'You just walked into my house. That is a thing adventurers do, apparently. Mind the rug — it is the only nice thing I own.', choices: [{ text: 'Sorry. Nice rug.', next: null }] } },
    cottager2: { start: { speaker: 'Rooke', text: 'I heard the caves out north went quiet last week. Quiet is worse than loud. Loud you can find.', choices: [{ text: 'Noted.', next: null }] } },
    nettle: { start: { speaker: 'Old Nettle', text: 'Bog witch, they call me. I prefer "consultant." You smell of the Spiral Eye\'s brew, child. Grey mist. Memory-thief. There\'s only one who brews it, and he lives under the water to the south.', choices: [{ text: 'The Sunken Temple?', next: 'temple' }] }, temple: { speaker: 'Old Nettle', text: 'Aye. Bring me a vial of the grey mist and I\'ll tell you how to drink it without losing what\'s left of you.', choices: [{ text: 'I have one.', req: { flag: 'hasMemoryVial' }, next: 'vial' }, { text: 'I\'ll find one.', next: null }] }, vial: { speaker: 'Old Nettle', text: 'Then here is the trick: you don\'t drink it. You pour it over the one who brewed it. Memory flows back to where it was stolen from.', choices: [{ text: 'Understood.', next: null, set: { nettleHint: true } }] } },
    priest: { start: { speaker: 'Sister Odile', text: 'Welcome to the temple. Healing is free for those who can\'t pay and cheap for those who can. Curses cost extra. What do you need?', choices: [] } },
  };

  // Main story quests. objective types: boss (kill boss), item (find item in boss room), rescue (free prisoner), clue (story event)
  S.acts = [
    { id: 'act1', act: 1, title: 'Something in the Cellar', giver: 'Bosun Grell', dungeon: 'cellar', theme: 'cellar', level: 1, rooms: 5, objective: { type: 'boss', item: 'sigilCoin' },
      summary: 'Clear the rats from the Rusty Flagon\'s cellar and find whatever they\'ve been hoarding.',
      twist: 'The rats have a king. And the king has your purse: empty except for one gold coin stamped with a spiral of eyes.',
      bossIntro: 'Atop a throne of stolen cheese and broken casks sits a rat the size of a dog, wearing a bottlecap for a crown. Something glints in its nest: a coin purse. Yours.',
      complete: { speaker: 'Bosun Grell', text: 'A rat KING? In MY cellar? …Well. That explains the tiny crown I found in the drain. That coin, though: same as the one the hooded man paid with. Take it to the temple, Sister Odile collects odd coins. Keep the room; you\'ve earned it.', reward: { gold: 25, xp: 300, item: 'potionHealing' } },
      unlocks: 'act2' },
    { id: 'act2', act: 2, title: 'The Spiral Coin', giver: 'Sister Odile', dungeon: 'caves', theme: 'cave', level: 2, rooms: 7, objective: { type: 'boss', item: 'cultLetter' },
      summary: 'Sister Odile recognizes the sigil: the Spiral Eye, a cult that trades with the goblins of Gnawtooth Caverns. Find out what the goblins know.',
      twist: 'The goblin boss, cornered, offers a deal: he sold "the sleeper" to hooded men for two hundred gold. He has their letter. The sleeper was you.',
      bossIntro: 'The goblin boss rises from a throne of stolen saddles, crown askew. "Wait, wait, WAIT. I know you. You\'re the sleeper! They said you wouldn\'t wake up for a YEAR!"',
      bossChoice: { text: 'The Goblin Boss drops his scimitars and holds up a folded letter. "Two hundred gold they gave me for you. Take the letter. Take the gold. Just don\'t take my crown."', options: [
        { text: '[Persuasion DC 12] "Tell me everything and walk away."', check: { skill: 'persuasion', dc: 12 }, pass: 'The boss babbles: hooded men, a temple under the swamp, a brewer named Voskar. He flees with his crown. The letter and gold are yours.', fail: 'He squints. "You\'re bluffing." The goblins attack!', spare: true },
        { text: '[Intimidation DC 10] "The crown too."', check: { skill: 'intimidation', dc: 10 }, pass: 'He throws the crown, the letter, and the gold, and runs squealing into the dark. You now own a goblin crown.', fail: 'He shrieks "NEVER!" and the goblins attack!', spare: true, extraGold: 20 },
        { text: 'No deals. Attack!', fight: true }] },
      complete: { speaker: 'Sister Odile', text: 'A letter. "The forgetful one wakes at the Flagon. Watch them." Written in the cult\'s hand. They didn\'t kidnap you at random, {name}: they\'re afraid of what you know. Old Mabel says the graveyard\'s been singing. The Spiral Eye raises the dead when it wants a congregation. Go and see.', reward: { gold: 60, xp: 600, item: 'scroll_bless' } },
      unlocks: 'act3' },
    { id: 'act3', act: 3, title: 'Whispers in the Crypt', giver: 'Sister Odile', dungeon: 'crypt', theme: 'crypt', level: 3, rooms: 8, objective: { type: 'boss', item: 'memoryVial' },
      summary: 'Cultists of the Spiral Eye are raising the dead in the Ashwood Crypt. Stop the ritual and learn why they fear you.',
      twist: 'The cult fanatic leading the ritual knows your face. "You came to STOP us. You nearly did. Voskar took your memories instead of your life. He\'s sentimental like that."',
      bossIntro: 'Candles guttering, a fanatic in violet stands over an open sarcophagus. She turns. Her eyes widen. "The investigator. You\'re supposed to be asleep. Voskar said the brew would hold for a YEAR."',
      complete: { speaker: 'Sister Odile', text: 'So you were hunting them before they caught you. That\'s… actually comforting. This vial: grey mist, the brew that took your memory. There\'s a bog witch in Brackenmoor, west road, who knows that kind of alchemy. And Wren says the bandits at Redwatch Fort were paid to deliver "a sleeper." Follow the money.', reward: { gold: 100, xp: 900, item: 'ringProtection' }, unlockTown: 'brackenmoor' },
      unlocks: 'act4' },
    { id: 'act4', act: 4, title: 'The Toll Road', giver: 'Wren Ashby', dungeon: 'fort', theme: 'fort', level: 4, rooms: 8, objective: { type: 'boss', item: 'captainLedger', rescue: true },
      summary: 'The Redwatch bandits were paid to carry you to the Flagon. Take their fort, take their ledger, and free whoever else they\'re holding.',
      twist: 'The Bandit Captain is done with the cult: they paid in cursed coin and half her crew won\'t sleep. She\'ll trade the ledger for her life. And a prisoner in the cells is an adventurer who was hunting the cult with you.',
      bossIntro: 'The Bandit Captain leans on a table piled with spiral-stamped coins. "Let me guess. The sleeper. You know those bastards paid us with coins that whisper? Half my lads haven\'t slept in a week."',
      bossChoice: { text: '"Here\'s my offer. The ledger, the prisoner, and the cursed coin. You walk out, we ride out, and nobody bleeds."', options: [
        { text: '[Insight DC 13] Is she telling the truth?', check: { skill: 'insight', dc: 13 }, pass: 'She is. Terrified, in fact. She hands over the ledger and the keys, and the bandits file out into the hills. The cursed coins you leave behind.', fail: 'You can\'t read her. She takes your hesitation as refusal and draws steel!', spare: true },
        { text: 'Take the deal.', spare: true, pass: 'She tosses you the ledger and the keys and is gone within the minute. Smart woman.' },
        { text: 'Bandits don\'t get deals. Attack!', fight: true }] },
      complete: { speaker: 'Wren Ashby', text: 'The ledger: "Delivered the sleeper. 200gp. — V." Voskar. Voice of the Spiral Eye. He\'s in the Sunken Temple south of Brackenmoor, and the bog witch says the mist can be turned back on him. This is it, {name}. Finish it.', reward: { gold: 150, xp: 1200, item: 'potionGreaterHealing', companion: true } },
      unlocks: 'act5' },
    { id: 'act5', act: 5, title: 'The Sunken Temple', giver: 'Wren Ashby', dungeon: 'temple', theme: 'temple', level: 5, rooms: 9, objective: { type: 'boss' },
      summary: 'Descend into the Sunken Temple and confront Voskar, Voice of the Spiral Eye, the man who stole your memories.',
      twist: 'Voskar offers your memories back, freely, if you kneel. He remembers the person you were. He liked them better.',
      bossIntro: 'Water drips into a black pool. Voskar turns, smiling like an old friend. "{name}! You found your way back. You always were stubborn. Kneel, and I\'ll give you back every day I took. You\'ll remember why you came the first time. You\'ll remember that you almost said yes."',
      bossChoice: { text: 'The Voice of the Spiral Eye holds out a vial of grey mist. Your mist.', options: [
        { text: '[Wisdom save DC 15] Resist his voice and attack.', save: 'wis', dc: 15, pass: 'His words slide off you like rain. "Pity," he sighs, and the temple erupts.', fail: 'For a moment you almost kneel. He laughs. That laugh is the only thing that saves you: nobody kneels to a laugh like that. Roll initiative, at disadvantage.', fight: true },
        { text: 'Throw the memory vial at him (bog witch\'s trick).', req: 'nettleHint', pass: 'The mist bursts across his face. He screams. Memories, yours and his, pour back into you like cold water. He staggers, weakened. Now: finish it.', fight: true, weakenBoss: true },
        { text: '"I don\'t need to remember to know I\'d say no." Attack!', fight: true }] },
      complete: { speaker: 'Wren Ashby', text: 'It\'s over. Voskar\'s gone, the cult\'s scattered, and Hollowmere can sleep. Including you, if you like. Under a table, even. As for your memories… the mist is broken. What comes back will come back. And if it doesn\'t? You made a pretty good life in a week. Make another.', reward: { gold: 300, xp: 2000, item: 'diceOfFate' } },
      unlocks: 'endless' },
  ];

  // Random quest templates for the quest board. {dungeon} chosen from unlocked sites. Twists chosen randomly.
  S.randomQuests = [
    { id: 'missing', title: 'Missing Villagers', text: 'Three villagers went to {dungeon} on a dare and never came back. Find them.', objective: 'rescue', twists: [
      'The villagers were not kidnapped. They joined. One of them tries to convince you the monsters are "misunderstood."',
      'Only one villager remains. The other two were eaten. She is very calm about it.',
      'The villagers are alive but the monsters are holding them for ransom. The ransom is a pie.'] },
    { id: 'hunt', title: 'Monster Hunt', text: 'Something in {dungeon} has been taking livestock. The farmers will pay for its head.', objective: 'boss', twists: [
      'The beast is guarding a litter of young. Killing it is easy. Deciding to is not.',
      'The "beast" is a very large, very hungry man in a bear pelt. He surrenders immediately.',
      'The monster was already dead when you arrived. Something bigger killed it. Something still here.'] },
    { id: 'artifact', title: 'The Cursed Artifact', text: 'A relic in {dungeon} has been making the locals dream of teeth. Bring it back for the temple to cleanse.', objective: 'item', item: 'templeIdol', twists: [
      'The relic is not cursed. The temple acolyte who posted the quest is. He wanted it for himself.',
      'The relic whispers offers of power as you carry it. It is quite persuasive.',
      'The relic is a very ordinary idol. The dreams were caused by the cheese from the same farm.'] },
    { id: 'caravan', title: 'The Lost Caravan', text: 'A merchant caravan vanished near {dungeon}. Recover the manifest and any cargo that survived.', objective: 'item', item: 'caravanManifest', twists: [
      'The caravan was carrying cult reagents. The merchant knew exactly who he was selling to.',
      'The caravan\'s guards took the cargo and staged the attack themselves.',
      'The cargo was a single, very angry mimic. It has eaten two bandits and is grateful for the company.'] },
    { id: 'ruins', title: 'Ancient Ruins', text: 'A scholar wants the runes in {dungeon} transcribed. Bring back the tablet.', objective: 'item', item: 'ancientTablet', twists: [
      'The runes are a recipe. A very good one, for bread.',
      'The tablet is a warning: DO NOT REMOVE THE TABLET. You have removed the tablet.',
      'The scholar is a lich in disguise. Well, was. He\'s retired. He just really likes runes.'] },
    { id: 'locket', title: 'The Lost Locket', text: 'An old woman lost a silver locket in {dungeon} fifty years ago. She would like it back before she dies. She is very specific about that.', objective: 'item', item: 'lostLocket', twists: [
      'The locket holds a portrait of the monster now living in the dungeon. It was her husband.',
      'The old woman is the monster\'s mother. She wanted the locket to remember him by.',
      'The locket contains a map to a second, much better treasure. She knew.'] },
    { id: 'escort', title: 'Escort the Pilgrim', text: 'A pilgrim needs safe passage to a shrine deep in {dungeon}. Keep them alive.', objective: 'boss', escort: true, twists: [
      'The pilgrim is the boss\'s long-lost sibling. The reunion is awkward but bloodless.',
      'The pilgrim is a cult spy. He tries to slip away at the shrine.',
      'The pilgrim is extremely competent and mostly wants company. Also snacks.'] },
    { id: 'investigation', title: 'Strange Lights', text: 'Lights and chanting in {dungeon} at midnight. Investigate.', objective: 'clue', twists: [
      'It\'s a birthday party for a goblin. You were, technically, not invited.',
      'It\'s a cult ritual. The cult is very small. It is two people and a goat.',
      'The lights are a trapped will-o\'-wisp begging to be freed. Freeing it is a terrible idea. You will do it anyway.'] },
  ];

  // Dungeon story events at '!' markers. Choice checks resolve to outcomes: {text, gold, item, xp, heal, damage, status, spawn, companion}
  S.events = [
    { id: 'woundedGoblin', text: 'A goblin lies against the wall, clutching a wounded leg. It looks up at you with enormous, wet eyes. "Please. No stab. Have gold. Have SECRET."', choices: [
      { text: '[Medicine DC 10] Bandage its leg.', check: { skill: 'medicine', dc: 10 }, pass: { text: 'It blinks, stunned. "Big-folk is… nice?" It tells you where a hidden cache is and limps away.', revealSecret: true, xp: 50 }, fail: { text: 'You make it worse. It screams, hobbles off, and the whole dungeon probably heard.', alert: true } },
      { text: '[Intimidation DC 10] "The secret. Now."', check: { skill: 'intimidation', dc: 10 }, pass: { text: '"Chest in the back room is TRAP. Real gold under the loose stone!" It hands you a pouch and flees.', gold: 15, xp: 50 }, fail: { text: 'It sneers, throws a rock at you (1 damage), and vanishes down a crack in the wall.', damage: 1 } },
      { text: 'Take its gold and leave it.', pass: { text: 'You take the pouch. It mutters something rude in Goblin.', gold: 8 } }] },
    { id: 'ghostMerchant', text: 'A translucent merchant floats beside a ghostly cart. "Wares! Fine wares! Slightly dead wares!" He wants payment in gold. He is very insistent that ghosts still need gold.', choices: [
      { text: 'Buy a mystery potion. (20 gp)', cost: 20, pass: { text: 'He hands you a glowing bottle and fades, whispering "no refunds."', item: 'random:potion' } },
      { text: '[Persuasion DC 13] Haggle.', check: { skill: 'persuasion', dc: 13 }, pass: { text: '"For YOU? Free. Take it and stop making eye contact."', item: 'random:potion', xp: 50 }, fail: { text: '"Cheapskate!" He vanishes, cart and all.' } },
      { text: 'Walk away from the dead salesman.', pass: { text: 'He shouts prices after you until you turn the corner.' } }] },
    { id: 'cursedIdol', text: 'An idol of the Spiral Eye sits on a plinth. Its eyes track you. A voice like wet velvet whispers: "Take me. I know what you\'ve forgotten."', choices: [
      { text: '[Wisdom save DC 12] Resist and smash it.', save: 'wis', dc: 12, pass: { text: 'You bring your weapon down. It shatters with a scream and leaves behind a handful of gemstones.', gold: 30, xp: 75 }, fail: { text: 'Your hand freezes. You hear a name you almost recognise. When you come to, the idol is gone and you feel weaker.', status: 'weakened' } },
      { text: '[Arcana DC 12] Study the enchantment first.', check: { skill: 'arcana', dc: 12 }, pass: { text: 'A memory-trap keyed to the mist. You disarm it with a word and pocket the gems.', gold: 30, xp: 100 }, fail: { text: 'Poking it was a mistake. Psychic backlash: 1d6 damage.', damageRoll: '1d6' } },
      { text: 'Leave it alone.', pass: { text: 'Wise. The whispering follows you out of the room.' } }] },
    { id: 'trappedAdventurer', text: 'A dwarf hangs upside down in a snare, arms crossed, dignified. "Don\'t. Say. Anything."', choices: [
      { text: '[Athletics DC 10] Cut her down carefully.', check: { skill: 'athletics', dc: 10 }, pass: { text: 'She lands on her feet, dusts herself off, and hands you a potion. "We never speak of this."', item: 'potionHealing', xp: 50 }, fail: { text: 'She lands on her head. "…Thanks." She limps off with what dignity remains.', xp: 25 } },
      { text: 'Say something.', pass: { text: '"Hanging around?" She frees herself with a knife out of pure spite and leaves.' } }] },
    { id: 'shrine', text: 'A small shrine to a forgotten god. A bowl for offerings sits before it, holding two copper pieces and a button.', choices: [
      { text: 'Offer 10 gold.', cost: 10, pass: { text: 'Warmth floods through you. The party is blessed.', partyStatus: 'bless' } },
      { text: '[Religion DC 11] Say the proper rite.', check: { skill: 'religion', dc: 11 }, pass: { text: 'The old words come easily. Everyone feels restored.', healParty: '2d8', xp: 50 }, fail: { text: 'You mispronounce the god\'s name. The button vanishes. Nothing else happens. Probably.' } },
      { text: 'Take the copper.', pass: { text: 'You take two copper and a button. You feel a little worse about yourself.', gold: 1 } }] },
    { id: 'prisoner', text: 'A figure sits in a locked cage: an adventurer, bruised but alive. "About time. Get me out and I owe you a favour."', rescue: true, choices: [
      { text: '[Sleight of Hand DC 12] Pick the lock.', check: { skill: 'sleightOfHand', dc: 12, tools: true }, pass: { text: 'Click. The cage swings open.', companion: true, xp: 75 }, fail: { text: 'The pick snaps. "Try the other way."', retry: true } },
      { text: '[Athletics DC 14] Bend the bars.', check: { skill: 'athletics', dc: 14 }, pass: { text: 'The bars groan and give. "…Remind me not to arm-wrestle you."', companion: true, xp: 75 }, fail: { text: 'The bars win. The prisoner sighs politely.', retry: true } },
      { text: 'Look for a key elsewhere.', pass: { text: 'You leave them for now. The key must be somewhere in this dungeon.', retry: true } }] },
    { id: 'library', text: 'Shelves of mouldering books. One is chained shut and hums faintly.', choices: [
      { text: '[Investigation DC 12] Search the shelves.', check: { skill: 'investigation', dc: 12 }, pass: { text: 'Behind a false book: a scroll case.', item: 'random:scroll', xp: 50 }, fail: { text: 'You find a recipe for goblin stew and a lot of dust.' } },
      { text: '[Arcana DC 14] Open the chained book.', check: { skill: 'arcana', dc: 14 }, pass: { text: 'Knowledge floods your mind. You feel wiser and slightly ill.', xp: 150 }, fail: { text: 'The book bites you. 1d4 damage. Books should not bite.', damageRoll: '1d4' } },
      { text: 'Leave the books.', pass: { text: 'The humming follows you out.' } }] },
    { id: 'fountain', text: 'A fountain of dark water. Coins glitter at the bottom. The water is perfectly still.', choices: [
      { text: 'Drink.', save: 'con', dc: 11, pass: { text: 'Cold and clean. You feel refreshed.', healParty: '1d8' }, fail: { text: 'It tastes of pennies. You are poisoned.', status: 'poisoned' } },
      { text: '[Sleight of Hand DC 10] Fish out the coins.', check: { skill: 'sleightOfHand', dc: 10 }, pass: { text: 'Quick fingers, dry sleeves.', gold: 12 }, fail: { text: 'Something in the water grabs your wrist. You yank free, minus a coin or two, plus a scratch.', damage: 2 } },
      { text: 'Leave it.', pass: { text: 'Still water. Best left still.' } }] },
    { id: 'gambler', text: 'A skeleton sits at a table with a cup of dice. It rattles the cup at you invitingly.', choices: [
      { text: 'Roll against it. (10 gp)', cost: 10, contest: true, pass: { text: 'You roll higher! The skeleton slumps, defeated, and slides over its winnings.', gold: 30, xp: 50 }, fail: { text: 'It rolls a 20. Of course it does. It rattles smugly.' } },
      { text: 'Smash the skeleton.', pass: { text: 'It doesn\'t fight back. Under its ribs: a few coins.', gold: 6 } },
      { text: 'Decline politely.', pass: { text: 'It shrugs. Bones clatter.' } }] },
  ];
  S.riddles = [
    { q: 'I have keys but open no locks. I have space but no room. You can enter but not go inside. What am I?', a: ['keyboard', 'a keyboard'], options: ['A keyboard', 'A dungeon', 'A coffin', 'A map'], correct: 0 },
    { q: 'The more you take, the more you leave behind. What am I?', options: ['Gold', 'Footsteps', 'Time', 'Breath'], correct: 1 },
    { q: 'I am not alive, but I grow. I have no lungs, but I need air. I have no mouth, but water kills me.', options: ['A tree', 'A shadow', 'Fire', 'Rust'], correct: 2 },
    { q: 'What has one eye but cannot see?', options: ['A cyclops', 'A needle', 'A storm', 'A wizard'], correct: 1 },
    { q: 'Feed me and I live. Give me a drink and I die.', options: ['A goblin', 'A fire', 'A sword', 'A rat'], correct: 1 },
    { q: 'I speak without a mouth and hear without ears. I have no body but come alive with wind.', options: ['A ghost', 'A bell', 'An echo', 'A flute'], correct: 2 },
    { q: 'What can run but never walks, has a mouth but never talks, has a bed but never sleeps?', options: ['A river', 'A dog', 'A sleeper', 'A road'], correct: 0 },
  ];
  S.leverHints = ['"First the sun, then the moon, then the stars, then the dark." (The levers are marked with those signs.)', '"Left is right when the eye is closed." (The order is reversed: right to left.)', '"Pull the odd ones first."'];
  S.dungeonFlavor = {
    cellar: ['The smell of sour ale and wet fur.', 'Something scurries behind the casks.', 'Cheese. Someone has been hoarding cheese.'],
    cave: ['Water drips somewhere ahead.', 'Goblin graffiti covers the wall. It is rude.', 'The tunnel narrows. Torchlight flickers on damp stone.'],
    crypt: ['The air is cold and tastes of dust.', 'Names on the wall niches have been scratched out.', 'Somewhere, faintly, someone is singing a hymn backwards.'],
    forest: ['Roots twist through the ceiling.', 'Webs. Lots of webs.', 'Bones of small animals, arranged neatly.'],
    fort: ['Banners of a fallen house rot on the walls.', 'Fresh boot prints. Lots of them.', 'Someone has been gambling here. Recently.'],
    temple: ['Water laps against black stone.', 'The spiral is carved everywhere. It watches.', 'Chanting echoes from deeper in.'],
    mine: ['Timbers creak overhead.', 'A pickaxe lies abandoned mid-swing.', 'Copper glints in the walls.'],
    swamp: ['Everything is damp.', 'The green light flickers between drowned houses.', 'Frogs. So many frogs.'],
  };
  window.STORY = S;
})();
