/* ---------- DATA ----------
 fwd:     only ask term -> definition
 hex:     color swatch shown next to the term
 glyph:   the term is a Greek letter, so written and spoken answers are always the name
 parts:   long answers are learned piece by piece in Learn modes before the whole thing
 ordered: the words must be said in order
*/
const GREEK = [
 ['Α α','Alpha'],['Β β','Beta'],['Γ γ','Gamma'],['Δ δ','Delta'],['Ε ε','Epsilon'],['Ζ ζ','Zeta'],
 ['Η η','Eta'],['Θ θ','Theta'],['Ι ι','Iota'],['Κ κ','Kappa'],['Λ λ','Lambda'],['Μ μ','Mu'],
 ['Ν ν','Nu'],['Ξ ξ','Xi'],['Ο ο','Omicron'],['Π π','Pi'],['Ρ ρ','Rho'],['Σ σ','Sigma'],
 ['Τ τ','Tau'],['Υ υ','Upsilon'],['Φ φ','Phi'],['Χ χ','Chi'],['Ψ ψ','Psi'],['Ω ω','Omega'],
];
const NAMES = GREEK.map(g => g[1]);

const CARDS = [
 {id:'star',cat:'Symbols',term:'Star',def:'Denotes fixedness of our purpose',img:'images/star.png'},
 {id:'crescent',cat:'Symbols',term:'Crescent',def:'The everlasting glory of our fraternity',img:'images/crescent.png'},
 {id:'sword',cat:'Symbols',term:'Sword and spear',def:'The zeal with which we defend our brothers while living',img:'images/sword-spear.png'},
 {id:'monument',cat:'Symbols',term:'Monument',def:'The respect due to our brothers’ memory when dead',img:'images/monument.png'},
 {id:'flower',cat:'Symbols',term:'The flower',def:'The lily of the valley',img:'images/lily-of-the-valley.png'},
 {id:'colors',cat:'Colors',term:'Colors',def:'White, Green, Black'},
 {id:'white',cat:'Colors',term:'White',def:'Purity of our purpose',hex:'#ffffff'},
 {id:'green',cat:'Colors',term:'Green',def:'The jealousy with which we guard our interests',hex:'#185932'},
 {id:'black',cat:'Colors',term:'Black',def:'The veil of perfect secrecy drawn over all our concerns',hex:'#111111'},
 {id:'motto',cat:'Motto & Mission',term:'Motto',def:'Manus Multae Cor Unum'},
 {id:'mottoen',cat:'Motto & Mission',term:'Motto in English',def:'Many hands, one heart'},
 {id:'mission',cat:'Motto & Mission',fwd:true,term:'Mission statement',
  def:'The mission of the Alpha Delta Phi Fraternity is to provide a comprehensive and positive personal growth experience for all undergraduate and alumni brothers: social, ethical, leadership, scholastic, community service, and literary.',
  parts:['The mission of the Alpha Delta Phi Fraternity is to provide','a comprehensive and positive personal growth experience','for all undergraduate and alumni brothers:','social, ethical, leadership, scholastic, community service, and literary.']},
 ...GREEK.map(([g, n]) => ({id:'gk-' + n.toLowerCase(),cat:'Greek Alphabet',glyph:true,term:g,def:n})),
 {id:'greek',cat:'Greek Alphabet',fwd:true,ordered:true,thr:.9,term:'Recite the Greek alphabet in order',def:NAMES.join(', '),
  parts:[0,6,12,18].map(i => NAMES.slice(i, i + 6).join(', '))},
];

/* ---------- history ----------
 From the chapter's history presentation. Every card is asked term -> answer only (fwd), because the
 "term" is a question. Besides the cards, three other kinds of data feed the history-only modes:
 TIMELINE (Timeline), SORTS (Sort) and LISTS (List Recall).
*/
const H = (cat, rows) => rows.map(([id, term, def, extra]) => ({id: 'h-' + id, cat, fwd: true, term, def, ...extra}));
CARDS.push(
 ...H('Greek Life History', [
  ['pbk', 'What was the first Greek letter organization?', 'Phi Beta Kappa'],
  ['pbkdate', 'When was Phi Beta Kappa founded?', 'December 5th, 1776'],
  ['pbkwhere', 'Where was Phi Beta Kappa founded?', 'William and Mary'],
  ['pbk1779', 'Which two schools had Phi Beta Kappa chapters by 1779?', 'Yale and Harvard'],
  ['pbkmason', 'What pressure pushed Phi Beta Kappa away from secrecy?', 'Anti-Masonic pressure', {alt: ['Anti Masonic']}],
  ['pbk1831', 'What did Phi Beta Kappa become in 1831?', 'A national academic honor society', {alt: ['National Academic Honor Society']}],
  ['kas', 'Which society was founded at Union College in 1825?', 'Kappa Alpha Society'],
  ['union27', 'Which two societies followed at Union College in 1827?', 'Sigma Phi and Delta Phi'],
  ['union', 'Which three societies make up the Union Triad?', 'Kappa Alpha Society, Sigma Phi, Delta Phi'],
  ['unionwhy', 'What did the early society members mainly meet to discuss?', 'Their disagreements with the university administrators, and world issues', {alt: ['Disagreements with administrators and world issues']}],
  ['miami', 'Which three fraternities make up the Miami Triad?', 'Sigma Chi, Phi Delta Theta, Beta Theta Pi'],
  ['miamiwhere', 'Where was Greek life really brought to life?', 'In the Midwest, through the Miami Triad', {alt: ['The Midwest']}],
  ['lex', 'Which three fraternities make up the Lexington Triad?', 'Alpha Tau Omega, Kappa Alpha Order, Sigma Nu'],
  ['lexwhen', 'When was the Lexington Triad formed?', 'Right after the Civil War', {alt: ['After the Civil War']}],
  ['lexregion', 'Which region did the Lexington Triad bring Greek life to?', 'The Deep South', {alt: ['Deep South']}],
  ['lexvmi', 'Which two Lexington Triad fraternities were founded at Virginia Military Institute?', 'Alpha Tau Omega and Sigma Nu', {alt: ['ATO and SNU', 'ATO and Sigma Nu']}],
  ['lexwl', 'Which Lexington Triad fraternity was founded at Washington and Lee University?', 'Kappa Alpha Order'],
 ]),
 ...H('ADPhi Founding', [
  ['eells', 'Who founded Alpha Delta Phi?', 'Samuel Eells', {alt: ['Eells']}],
  ['hamilton', 'At which college did Samuel Eells found Alpha Delta Phi?', 'Hamilton College', {alt: ['Hamilton']}],
  ['lit', 'What two literary societies did Eells find at Hamilton College?', 'The Phoenix and the Philopeuthian', {alt: ['Phoenix and Philolpeuthian', 'Phoenix and Philopeuthian']}],
  ['whyeells', 'Why did Eells want to start his own society?', 'He disliked their recruitment tactics and small size, and wanted a society that did not promote jealousy or hatred', {alt: ['He disliked the recruitment tactics and small size of the societies and wanted one that did not promote jealousy or hatred']}],
  ['1830', 'What did Eells do in 1830?', 'Selected 2 men from each society and founded a new society', {alt: ['He selected two men from each society']}],
  ['ideals', 'What were the new society’s ideals based on?', 'The loftiest of intellectual and moral ideas', {alt: ['The loftiest of intellectual and moral ideals']}],
  ['1832', 'By what year had Eells founded Alpha Delta Phi?', '1832'],
  ['nfounders', 'How many founders did Alpha Delta Phi have?', '5', {alt: ['Five']}],
  ['founders', 'Who were the 5 founders of Alpha Delta Phi?', 'Samuel Eells, Lorenzo Latham, John Curtiss Underwood, Oliver Andrew Morse, Henry Lemuel Storrs', {thr: .7}],
  ['emblem', 'Who designed the fraternity’s emblem and symbols?', 'Eells and Latham', {alt: ['Samuel Eells and Lorenzo Latham']}],
  ['birthplace', 'What is the birthplace of ADPhi?', 'Kirkland House', {alt: ['Kirkland House at Hamilton College']}],
  ['cornell', 'What was special about the ADPhi chapter at Cornell in 1878?', 'It was the first established residential chapter home of any fraternity', {alt: ['First residential chapter home of any fraternity']}],
  ['first12', 'ADPhi was the first Greek letter fraternity on how many of the listed campuses?', '12', {alt: ['Twelve']}],
  ['second3', 'ADPhi was the second Greek letter fraternity at which three campuses?', 'Hamilton College, University of Alabama, McGill University', {alt: ['Hamilton, Alabama, McGill']}],
 ]),
 ...H('Illinois Chapter', [
  ['pitheta', 'What was the Illinois chapter before it became ADPhi?', 'Pi Theta'],
  ['charter', 'When was Pi Theta officially granted a charter?', '1911'],
  ['installed', 'When was the Illinois chapter installed?', 'January 13th, 1912', {alt: ['January 13, 1912']}],
  ['installedwhere', 'Where was the Illinois chapter installed?', 'The University Club in Chicago', {alt: ['University Club in Chicago']}],
  ['mansion', 'Where did the chapter live from 1915 to 1922?', 'The mansion of the first President of the University', {alt: ['The first President’s mansion']}],
  ['historic', 'When was the Historic Chapter House built?', '1924 to 1925', {alt: ['1924-1925', '1924 and 1925']}],
  ['nrhp', 'When was the Historic Chapter House placed on the National Register of Historical Places?', '1990'],
  ['standup', 'What was ADPhi always known as?', 'A house of stand-up men', {alt: ['A house of standup men']}],
  ['h1', 'Where was the chapter house from 1910 to 1915?', '206 East Green Street (Pi Theta)', {alt: ['206 East Green Street']}],
  ['h2', 'Where was the chapter house from 1915 to 1922?', '709 South Fourth Street (President’s mansion)', {alt: ['709 South Fourth Street']}],
  ['h3', 'Where was the temporary quarters from 1923 to 1924?', '205 Green Street', {alt: ['205 Green']}],
  ['h4', 'Where was “The New House”, from 1924 to 2018?', '310 East John Street', {alt: ['310 East John']}],
  ['ww2', 'What happened to most fraternities on campus from Fall 1943 to Spring 1946?', 'They became army barracks and women’s residences because of World War 2', {alt: ['Army barracks and women’s residence because of WW2']}],
  ['h6', 'Where is the chapter house from 2020 and beyond?', '401 East Daniel Street', {alt: ['401 East Daniel']}],
  ['kicked', 'When were the brothers kicked out of the house?', '2015'],
  ['whykicked', 'Why were the brothers kicked out of the house?', 'Hazing, destruction of the house (throwing kegs out of the window), and not caring for the house', {alt: ['Hazing, destruction of the house, and people not taking care of the house'], thr: .7}],
  ['notuni', 'Was the chapter kicked off campus by the University?', 'No, the alumni pulled the chapter off campus', {alt: ['No, the alumni pulled this chapter off campus']}],
  ['demolished', 'What happened to the old house after the 2018 shutdown?', 'It was demolished and sold for the apartment buildings that are there today', {alt: ['Demolished and sold for apartment buildings']}],
  ['akl', 'Which recently abandoned house did the money from the sale buy?', 'The Alpha Kappa Lambda house', {alt: ['Alpha Kappa Lambda']}],
  ['architects', 'Who designed the new and improved house?', 'ADPhi alumni architects', {alt: ['Alumni architects']}],
  ['kept', 'Which historic features of the old house were kept in the new one?', 'Wood panel ceilings, paintings, and the fire pit', {alt: ['Wood panel ceilings, paintings, fire pit']}],
  ['built', 'When did construction of the new house begin and finish?', 'Began in 2020, finished in Fall of 2021', {alt: ['2020 to Fall 2021', 'Began 2020 and finished Fall 2021']}],
  ['nfound', 'How many founding fathers did the refounded Illinois chapter have?', '6', {alt: ['Six']}],
  ['found6', 'Who were the 6 founding fathers of the refounded chapter?', 'Jacob Byrkit, Henry Byrkit, D.J. Dutton, Paul Rampersaud, Zach Harrison, Cam Ezell', {thr: .7}],
  ['first', 'Who was the first president of the refounded chapter?', 'Zach Harrison, the Supreme Leader', {alt: ['Zach Harrison']}],
  ['pres', 'Who have been the presidents of the refounded chapter, in order?', 'Zach Harrison, Clayton Haase, Carter Evans, Mitchell Cappell, Luke Wittenborn', {ordered: true, thr: .7}],
  ['p2223', 'Who was president in 2022 to 2023?', 'Clayton Haase'],
  ['p2324', 'Who was president in 2023 to 2024?', 'Carter Evans'],
  ['p2425', 'Who was president in 2024 to 2025?', 'Mitchell Cappell'],
  ['p25', 'Who became president in 2025?', 'Luke Wittenborn'],
 ]),
);

/* TIMELINE: y = year, m = month (optional, orders events inside a year), g = group */
const TL_GROUPS = ['Houses', 'Presidents'];
const TIMELINE = [
 {id: 'h1', y: 1910, g: 0, t: 'The chapter lives at 206 East Green Street (Pi Theta house)'},
 {id: 'h2', y: 1915, g: 0, t: 'The chapter moves into the President’s mansion at 709 S Fourth Street'},
 {id: 'h3', y: 1923, g: 0, t: 'The chapter lives in temporary quarters at 205 Green Street'},
 {id: 'h4', y: 1924, g: 0, t: 'The chapter moves into The New House at 310 East John Street'},
 {id: 'h5', y: 2018, g: 0, t: 'The chapter leaves 310 East John Street and the house is demolished'},
 {id: 'h6', y: 2020, g: 0, t: 'The chapter’s new house at 401 East Daniel Street (2020 and beyond)'},
 {id: 'p1', y: 2020, m: 2, g: 1, t: 'Zach Harrison becomes our first president (Supreme Leader)'},
 {id: 'p2', y: 2022, g: 1, t: 'Clayton Haase becomes president'},
 {id: 'p3', y: 2023, g: 1, t: 'Carter Evans becomes president'},
 {id: 'p4', y: 2024, g: 1, t: 'Mitchell Cappell becomes president'},
 {id: 'p5', y: 2025, g: 1, t: 'Luke Wittenborn becomes president'},
];

/* SORTS: items go into buckets. item = [text, bucket index] */
const SORTS = [
 {id: 'house', title: 'Which chapter house?', ask: 'Match the years to the address',
  buckets: ['206 East Green Street', '709 S Fourth Street', '205 Green Street', '310 East John Street', '401 East Daniel Street'],
  items: [['1910 to 1915', 0], ['1915 to 1922', 1], ['1923 to 1924', 2], ['1924 to 2018', 3], ['2020 and beyond', 4],
    ['Pi Theta’s house', 0], ['The President’s mansion', 1], ['Temporary quarters', 2], ['The New House', 3], ['Where we are now', 4]]},
 {id: 'people', title: 'Which group of people?', ask: 'Sort the names into the group they belong to',
  buckets: ['Founders of ADPhi (1832)', 'Refounders of the Illinois chapter', 'Presidents since the refounding'],
  items: [['Samuel Eells', 0], ['Lorenzo Latham', 0], ['John Curtiss Underwood', 0], ['Oliver Andrew Morse', 0], ['Henry Lemuel Storrs', 0],
    ['Jacob Byrkit', 1], ['Henry Byrkit', 1], ['D.J. Dutton', 1], ['Paul Rampersaud', 1], ['Cam Ezell', 1],
    ['Clayton Haase', 2], ['Carter Evans', 2], ['Mitchell Cappell', 2], ['Luke Wittenborn', 2]], pickN: 9},
 {id: 'term', title: 'Which president?', ask: 'Match each term to its president',
  buckets: ['Zach Harrison', 'Clayton Haase', 'Carter Evans', 'Mitchell Cappell', 'Luke Wittenborn'],
  items: [['2020 to 2021', 0], ['2021 to 2022', 0], ['2022 to 2023', 1], ['2023 to 2024', 2], ['2024 to 2025', 3], ['2025 on', 4]]},
];

/* LISTS (List Recall): type the items in any order. clue = shown beside the blank. alt = other accepted answers */
const LISTS = [
 {id: 'founders', title: 'Our 5 founders (1832)', ask: 'Name the five founders of Alpha Delta Phi', items: [
  {a: 'Samuel Eells', alt: ['Eells']}, {a: 'Lorenzo Latham', alt: ['Latham']}, {a: 'John Curtiss Underwood', alt: ['Underwood', 'John Underwood']},
  {a: 'Oliver Andrew Morse', alt: ['Morse', 'Oliver Morse']}, {a: 'Henry Lemuel Storrs', alt: ['Storrs', 'Henry Storrs']}]},
 {id: 'fathers', title: 'Our 6 refounders', ask: 'Name the six refounders (founding fathers) of the Illinois chapter', items: [
  {a: 'Jacob Byrkit', clue: 'Class of ’23', alt: ['Jacob']}, {a: 'Henry Byrkit', clue: 'Class of ’24', alt: ['Henry']}, {a: 'D.J. Dutton', clue: 'Class of ’24', alt: ['DJ Dutton', 'Dutton']},
  {a: 'Paul Rampersaud', clue: 'Class of ’24', alt: ['Rampersaud', 'Paul']}, {a: 'Zach Harrison', clue: 'Class of ’24', alt: ['Harrison', 'Zach']}, {a: 'Cam Ezell', clue: 'Transferred', alt: ['Ezell', 'Cameron Ezell']}]},
 {id: 'pres', title: 'Our presidents', ask: 'Name each president of the refounded chapter', items: [
  {a: 'Zach Harrison', clue: '2020 to 2022 (two terms)', alt: ['Harrison', 'Zach']}, {a: 'Clayton Haase', clue: '2022 to 2023', alt: ['Haase', 'Clayton']}, {a: 'Carter Evans', clue: '2023 to 2024', alt: ['Evans', 'Carter']},
  {a: 'Mitchell Cappell', clue: '2024 to 2025', alt: ['Cappell', 'Mitchell']}, {a: 'Luke Wittenborn', clue: '2025 on', alt: ['Wittenborn', 'Luke']}]},
 {id: 'houses', title: 'Our chapter houses', ask: 'Give the address of each chapter house', items: [
  {a: '206 East Green Street', clue: '1910 to 1915 (Pi Theta)', alt: ['206 Green Street', '206 East Green']},
  {a: '709 South Fourth Street', clue: '1915 to 1922 (President’s mansion)', alt: ['709 S Fourth Street', '709 Fourth Street']},
  {a: '205 Green Street', clue: '1923 to 1924 (temporary quarters)', alt: ['205 Green']},
  {a: '310 East John Street', clue: '1924 to 2018 (The New House)', alt: ['310 John Street', '310 East John']},
  {a: '401 East Daniel Street', clue: '2020 and beyond', alt: ['401 Daniel Street', '401 East Daniel']}]},
];

/* ---------- the song ----------
 text: one lyric line per line. A [Name] line or a blank line starts a new part.
 A line can start with its time in the recording, [m:ss.cc]. These were placed by
 Whisper small (forced alignment of each pair of lines) and can be redone on the Song
 page (Sync). Use "Copy lyrics" there and paste the result here to share new timings.
 end: when the last note finishes.
*/
const SONG = {
 title: 'XAIPE',
 by: 'Cornell University Alumni Chorus, Douglas Jimerson',
 audio: 'audio/xaipe.mp3',
 tune: 'O Tannenbaum (O Christmas Tree)',
 end: 139.9,                            // the last note; the recording opens with ~34 s of humming
 text: `
[Verse 1]
[0:34.08] Kaire Alpha Delta Phi!
[0:39.16] Ace ai-oh-nah thallan.
[0:42.74] Owk-sah-noi-oh doonamai,
[0:46.84] Kath hapantah neekahn.

[Chorus]
[0:51.40] Selenay tik-toh-menay,
[0:55.84] Astron kai marmairon,
[1:00.26] Melpsomen yoo-froh-zoo-nay,
[1:04.46] Hoomin azmah faidron.

[Verse 2]
[1:09.14] Entheday kah-lee-oh-pay,
[1:13.20] Soon pasais moo-sah-ahn.
[1:17.32] Nai-eh-tai en soo-nah-fay,
[1:21.38] Haymas prah-ohs treffahn.

[Chorus, 2nd time]
[1:26.00] Selenay tik-toh-menay,
[1:30.44] Astron kai marmairon,
[1:34.50] Melpsomen yoo-froh-zoo-nay,
[1:38.98] Hoomin azmah faidron.

[Verse 3]
[1:42.98] Nah-ohs kahloo kai-gah-thoo,
[1:47.64] Ace ai-oh-nah staysahn.
[1:52.10] Erah-oh-men soo hiroo,
[1:56.40] Erah-oh-men koodahn.

[Chorus, last time]
[2:01.18] Selenay tik-toh-menay,
[2:05.24] Astron kai marmairon,
[2:09.52] Melpsomen yoo-froh-zoo-nay,
[2:14.04] Hoomin azmah faidron.
`,
};
