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

/* ---------- the song ----------
 text: one lyric line per line. A [Name] line or a blank line starts a new part.
 A line can start with its time in the recording, [m:ss.cc], which the Song page
 fills in when you tap along (Sync). Use "Copy lyrics" on the Song page and paste
 the result here to put the words and timings on the site for everyone.
*/
const SONG = {
 title: 'XAIPE',
 by: 'Cornell University Alumni Chorus, Douglas Jimerson',
 audio: 'audio/xaipe.mp3',
 tune: 'O Tannenbaum (O Christmas Tree)',
 text: `
[Verse 1]
[0:34.68] Kaire Alpha Delta Phi!
[0:39.14] Ace ai-oh-nah thallan.
[0:43.24] Owk-sah-noi-oh doonamai,
[0:47.36] Kath hapantah neekahn.

[Chorus]
[0:51.60] Selenay tik-toh-menay,
[0:55.98] Astron kai marmairon,
[1:00.42] Melpsomen yoo-froh-zoo-nay,
[1:04.74] Hoomin azmah faidron.

[Verse 2]
[1:09.16] Entheday kah-lee-oh-pay,
[1:13.52] Soon pasais moo-sah-ahn.
[1:17.78] Nai-eh-tai en soo-nah-fay,
[1:21.96] Haymas prah-ohs treffahn.

[Chorus, 2nd time]
[1:26.24] Selenay tik-toh-menay,
[1:30.62] Astron kai marmairon,
[1:34.94] Melpsomen yoo-froh-zoo-nay,
[1:39.18] Hoomin azmah faidron.

[Verse 3]
[1:43.60] Nah-ohs kahloo kai-gah-thoo,
[1:48.06] Ace ai-oh-nah staysahn.
[1:52.46] Erah-oh-men soo hiroo,
[1:56.78] Erah-oh-men koodahn.

[Chorus, last time]
[2:01.26] Selenay tik-toh-menay,
[2:05.64] Astron kai marmairon,
[2:10.00] Melpsomen yoo-froh-zoo-nay,
[2:14.48] Hoomin azmah faidron.
`,
};
