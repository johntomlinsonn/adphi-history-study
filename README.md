# ADPhi Study

A Quizlet-style study site for the Alpha Delta Phi symbols, colors, flower, motto, mission, the Greek alphabet and our history.

Modes: **Flashcards**, **Learn**, **Spoken Learn**, **Test**, **Spoken Test**, **Alphabet Drill**, **XAIPE Song**, **Reference**, plus three history modes: **Timeline**, **Sort** and **List Recall**.

## Use it online

**https://johntomlinsonn.github.io/adphi-history-study/** (GitHub Pages, no install).

Spoken modes work there too. Pick a voice engine on the Spoken Learn or Spoken Test start screen
(Auto picks the first one that works):

| Engine | Where it runs | Notes |
|---|---|---|
| **Mac (MLX)** | Your Mac's GPU, via `server.py` | Fastest and most accurate (Whisper large-v3-turbo). Works from the online site too while the server runs. |
| **In-browser Whisper** | Inside the browser (WebGPU, or the CPU as a fallback) | Nothing to install. Downloads Whisper base (~150 MB) once, then cached. Fully on-device. |
| **Browser speech** | The browser's built-in recognizer | No download. Chrome sends audio to Google; Safari uses Apple's recognizer. |

## Run it on your Mac

```bash
uv run server.py
```

Then open http://localhost:8000. On the first run the server downloads
`mlx-community/whisper-large-v3-turbo` (about 1.6 GB) from Hugging Face. After that,
everything runs offline on the Apple Silicon GPU via MLX. Audio never leaves the Mac.

Use a smaller or faster model with `uv run server.py --model mlx-community/whisper-small-mlx`.

While the server is running, the online site can use it as well: it looks for `http://localhost:8000`.
Chrome may ask to allow the site to access devices on your local network; allow it. If you fork this
repo, add your own Pages address with `uv run server.py --allow-origin https://<you>.github.io`.

## Spoken modes

- The card shows a term. Say the definition out loud. Settings let you flip this or mix both directions.
- The mic listens on its own, stops when you pause, and transcribes (about 0.2 s per answer on an M-series chip).
- Grading checks for the answer's key words and tolerates filler ("um, I think it's…"), spoken numbers
  and small transcription misspellings.
- **Spoken Learn:** get each card right twice to master it. If you miss one, you say the correct answer back
  once before moving on.
- **Spoken Test:** choose instant feedback after every answer, or feedback at the end like an oral exam.
  You can flip any verdict the grader got wrong.
- Keys: `Space` talk/stop, `Enter` next, `S` don't know/skip, `R` redo (test), `O` "I was right", `H` hint, `L` hear it, `T` type instead.

## Alphabet Drill

Type the 24 Greek letter names in order against the clock. A letter locks in as soon as what you've typed can
only be that letter: `a` for Alpha, `ep` for Epsilon, `et` for Eta, `omi` for Omicron, `ome` for Omega.
Full names work too, with or without spaces. Your best clean (no-mistake) time is saved. Letters you got wrong
count as misses in the other modes, so they come up first in Learn.

## XAIPE Song

Learn the fraternity song a part at a time, singing along with lyrics that follow the recording
(Cornell University Alumni Chorus, hosted with the site as `audio/xaipe.mp3`).

The lyrics come built in, split into Verse 1, Chorus, Verse 2, Chorus, Verse 3, Chorus. Each line's start was placed
with Whisper small by forced alignment (Whisper is given two known lines over their audio and marks where the second
begins). The recording opens with about 34 seconds of humming, so the whole song starts at the first words.

1. **Sing along**: the current line lights up and a bar under it shows when the next line comes. Tap parts to practice them: pick one, or several at once (say Verse 1 + Verse 3), and playback loops through just those, skipping the rest. Tap a part again to drop it.
   Switch from **Words** to **Hints** (first letters) to **Hidden** as you learn it. Hidden lines show once they've been
   sung so you can check yourself. Mark parts learned, then use **Sing it from the start** to chain them together.
2. **Fix timing** if it ever drifts: nudge the words earlier/later, edit the lyrics, or **Sync** a part again by tapping
   `Space` as each line starts.

The song plays right on the page, with a seek bar and speeds of 0.75×, 0.9× and 1× for learning the words.

Lyrics and timings are saved in your browser. To put them on the site for everyone, use **Copy lyrics with timings**
and paste the text into `SONG.text` in `js/data.js`. Each line looks like `[0:12.50] words of the line`.

## History

Three topics (**Greek Life History**, **ADPhi Founding**, **Illinois Chapter**, about 70 cards) come from the
chapter history presentation. They work in every mode above (Flashcards, Learn, Spoken Learn, Test, Spoken Test).
Three modes fit this kind of material better, under the **History** tab:

- **Timeline**: a handful of events are shuffled; tap them in the order they happened, then check. Dates appear
  after checking, and events you misplace come back more often. Filter by Greek life, ADPhi or Illinois.
- **Sort**: drop each name in its group (fraternity into Union / Miami / Lexington Triad, fraternity to founding school,
  campus to first or second, years to chapter house address, name to founders / refounders / presidents).
  A wrong group shakes and counts as a miss. Keys `1`-`5` drop the highlighted item.
- **List Recall**: type every item of a list in any order (the 5 founders, 6 founding fathers, presidents, house addresses,
  the 12 campuses where we were first). Answers use the same forgiving grading as the other modes, so a last name
  or a short name ("NYU", "Eells") works. `Tab` shows first-letter hints, and your best clean time is saved.

The data is in `js/data.js` (`CARDS` via `H(...)`, `TIMELINE`, `SORTS`, `LISTS`); the modes are in `js/history.js`.
Topics added after your last visit are switched on automatically.

## Learning features

- **Test with instant feedback:** the Test and Spoken Test setups have a Feedback switch (instant, or at the end).
- **Weakest cards first:** every card has a 0–5 strength score saved in the browser. Learn sessions start
  with cards you missed last time, then new cards, then strong ones.
- **Spacing within a session:** at most 6 cards are in play. A missed card comes back two cards later.
- **Building up long answers:** the mission statement and the alphabet recitation are learned in parts first,
  then as a whole.
- **Preview new cards** (Spoken Learn): see the answer and read it aloud once before you're asked for it.
- **Hints** (`H`): first letters, then half of each word. A hinted answer doesn't count toward mastery.
- **Type it back** (Learn): after a written miss, type the correct answer once.
- **Hear it** (`L`): the answer is read aloud by your Mac's built-in voice. You can turn on auto-read after a miss.

## Files

- `index.html`, `css/app.css`: page and styles (official brand palette)
- `js/data.js`: the cards
- `js/grade.js`: answer grading
- `js/voice.js`: mic capture, pause detection, and the three voice engines
- `js/whisper-worker.js`: in-browser Whisper (transformers.js) in a Web Worker
- `js/app.js`: all study modes
- `js/song.js`: the XAIPE Song section (lyrics, playback, sync, sing-along)
- `js/history.js`: Timeline, Sort and List Recall
- `audio/xaipe.mp3`: the recording
- `server.py`: static server plus `/api/transcribe` (MLX Whisper), callable from the Pages site
- `images/`: add `star.png`, `crescent.png`, `sword-spear.png`, `monument.png`, `lily-of-the-valley.png` (see `images/README.md`)
