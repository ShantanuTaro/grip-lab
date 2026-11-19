# Brag script: Grip Lab, "Not animated. Simulated."

**Run it** (from this folder):

- With a narrator: `/brag --voice --duration 75 Use brag-script.md as the plan. Keep its scenes, words and numbers.`
- On-screen text only (on Opus 5.5 this runs /brag-slim): `/brag --duration 75 Use brag-script.md as the plan. Keep its scenes, words and numbers.`

**Note for /brag:** the user asked for the full feature tour, so 75 s is on purpose and overrides the 15–25 s default.
The reading-time rules still apply. A 20 s teaser cut is at the end.

## What it is
A web app: photograph how you hold a cricket ball, confirm the grip, and watch the delivery in 3D. The physics comes
from the Laws of Cricket, wind tunnels, spinners measured in labs and Hawk-Eye tracking of Test matches.

## The angle
It looks like a broadcast graphic, but it is a physics simulation, and it shows its receipts. The video takes the viewer
through the app (capture, bowl, change it in a coach's words, ball, ground, your own data), then shows where the numbers
come from and how they were checked against real matches.

## Tone, format, look
- Tone: `polished`. Direction: the ball-tracking segment of a Test match broadcast, with the receipts on screen. It is confident and calm, with no hype words.
- Format: landscape 1920×1080, 30 fps, 75 s.
- Dark mode (a night match under floodlights) until the outro, which switches to light mode (a day match).
- Colours, from `src/index.css`: background `#0e0f11`, panels `#17191c` / `#1f2226`, border `#2a2d33`, text `#f3f4f6`,
  muted `#a1a6af`, leather-red accent `#d21f33` (the Bowl it button, ball path and At the batter border), ball `#b61426`,
  grass `#1e6b45`, pitch `#c9b27a`, stumps `#f2e6c4`, ball stamp gold `#E9C46A`.
- Fonts: Barlow Condensed 600/700 in upper case for headings and big numbers, and Inter for everything else. Both are loaded from Google Fonts, as `index.html` does.
- Logo: the favicon in `index.html` (a red ball with a dashed cream seam) beside "GRIP LAB".
- Show the real app (routes `/simulator`, `/capture`, `/grounds`) rather than redrawn screens.
- Default state: kph, right-arm over, right-handed batter, new Kookaburra, Standard pitch, day 1, dry, playback 0.25×.

## Audio
- Music: confident, mid-tempo (about 100 BPM), with a broadcast-sport feel. It stays sparse under the voice, lifts at scene 9 and resolves at the outro.
- SFX:
  - a leather-on-turf thud at each bounce
  - a soft whoosh on each camera move
  - quiet ticks for taps and count-ups
  - one stumps clatter, in the outro only
- Leave out crowd noise and anything that sounds like TV commentary.

## Storyboard

### 1. Hook (0:00–0:03, 3 s)
- **Show:** Ball view. The red Kookaburra rides toward the batter under floodlights with its seam upright, leaving a red trail. It pitches with a thud.
- **On screen:** "NOT ANIMATED." then "SIMULATED." (in leather red)
- **Voice:** "This ball isn't animated. It's simulated."
- **Cut:** a hard cut on the beat.

### 2. Reveal (0:03–0:07, 4 s)
- **Show:** the logo and the "GRIP LAB" wordmark on `#0e0f11`.
- **On screen:** "GRIP LAB" and "Photograph a grip. Watch the delivery in 3D."
- **Voice:** "Grip Lab. Photograph a grip, watch the delivery in 3D."

### 3. Capture (0:07–0:13, 6 s), in a phone frame, since you shoot the grip on a phone
- **Show:** `/capture`, headed "CAPTURE YOUR GRIP".
  1. The three slots fill one by one: Side on (`photo2.jpeg`), Seam, front on (`photo1.jpeg`), Release position (`photo3.jpeg`).
  2. Tap "Find the closest grips".
  3. "Which grip is this?" appears. Tap **Seam-up**, which is the grip in the photos.
  4. The button reads "Simulate Seam-up".
- **On screen:** "You confirm the grip."
- **Voice:** "Three photos. It suggests the closest grips — you confirm yours."
- **Percentages:** use the ones from a real run of the matcher (Groq, through `npm run dev`), or leave them off. Never show the Sample-data stub as a reading.

### 4. Bowl it (0:13–0:21, 8 s)
- **Show:** `/simulator`, desktop layout, with Seam-up lit in the grip library.
  - Press "Bowl it". The camera glides Bowler → Batter → Umpire → Ball (about 2 s each).
  - The pitch map in the corner draws the path and the bounce ring.
  - The five tiles fill one by one:
    - Release speed **132 kph** · Good length
    - Swing in air **0 cm** · Straight
    - Off the pitch **0 cm** · 0.0° · Holds its line
    - Time to batter **0.58 s** · Release to stumps
    - At the batter **Hitting** · 71 cm high
- **On screen:** only the app's own text.
- **Voice:** "Bowl it. Watch from the bowler, the batter, the umpire — or ride right behind the ball."

### 5. A coach's words (0:21–0:26, 5 s)
- **Show:** tap Off-break. Under Spinner's level, tap Club, then Elite.
  - Revs goes from 1,100 to 1,700 rpm.
  - Off the pitch goes from 17 cm to **27 cm** · 3.4° · Into the batter.
- **On screen:** "No rpm. No degrees. A coach's words."
- **Voice:** "No one knows their revs. So it asks like a coach."

### 6. Work it back (0:26–0:31, 5 s)
- **Show:** two helpers side by side, each starting from the Outswinger preset. Hold both results for 2 s or more.
  - "Match a ball you saw": swing 12 cm, Away. Press "Set the seam to match". Seam becomes **13° to slips**.
  - "Time it on a video": 240 frames a second, 128 frames to the stumps. Press "Set the speed to match". Speed becomes **143 kph**.
- **Voice:** "Saw it swing? Timed it on your phone? It works backwards to the numbers."

### 7. Five balls (0:31–0:38, 7 s)
- **Start:** the Outswinger preset (132 kph, seam 22°), new ball.
- **Show:** under Which ball, tap Kookaburra, then Dukes. Swing in air goes from **16 cm** to **31 cm**, Away from the batter, and the path bends further.
  Keep the Dukes, tap Old ball and set 145 kph. It now swings **17 cm · Into the batter**.
- **On screen:** "Same outswinger. Five balls." Then "Old and quick: it reverses."
- **Voice:** "Five match balls. Same outswinger: sixteen centimetres with a Kookaburra, thirty-one with a Dukes."

### 8. Grounds (0:38–0:46, 8 s)
- **Start:** Seam-up, new Kookaburra, Standard pitch, day 1. It is Hitting · 71 cm high.
- **Show:** under Ground, pick "The Gabba, Brisbane".
  - The chips read "Bounce +20% · Turn −5% · Seam +32% · 27°C".
  - The tile changes to **Over the top · 92 cm high**.
  - Tap Day 5. The chips change to "Bounce +14% · Turn +28%", the pitch map shows "5 cracks", and the tile reads Over the top · 88 cm high.
- **On screen:** "19 famous grounds". Then a chip, "Gabba bounce: fitted to Hawk-Eye". Then "Day 5: −5% bounce, fitted to 61 Tests".
- **Voice:** "Nineteen famous grounds. At the Gabba, the same ball flies over the stumps. And pitches wear over five days."

### 9. Receipts: the bounce (0:46–0:56, 10 s)
- **Show:** data cards in the app's panel style, each in Barlow numbers.
  1. A counter runs from 0 to **527,165**, labelled "Hawk-Eye-tracked Test balls". Small text under it: "317 men's Tests, 2012–2021".
  2. "First guess: **16 cm** too low" is struck through in red. Under it: "Fitted to 6,420 balls from 214 Tests: within **3 cm**".
     Small text, which must stay readable: "median gap at the stumps, every length · 6 cm for bouncers".
- **Voice:** "Then we checked it against real Hawk-Eye tracking from over two hundred Tests — and fixed what it got wrong."

### 10. Receipts: swing and spin (0:56–1:03, 7 s)
- **Show:** two cards, one after the other.
  - SWING: "Wind tunnels at Bath & Cambridge". Under it: "Sim: Dukes **1.00°** · Tests in England **0.97–1.15°** (CricViz)".
  - SPIN: "Measured on real spinners, club to England squad". Under it: "**1,100–2,500 rpm**".
- **Voice:** "Swing comes from wind tunnels, checked against real Tests. Spin, from spinners measured in a lab."

### 11. Your own ground (1:03–1:10, 7 s)
- **Show:** go to `/grounds` ("MY GROUNDS") and pick New ground.
  - The tabs read Paste notes · Measurements · Tracking. Open Tracking and choose "Try real Hawk-Eye data: The Gabba".
  - It reads "100 deliveries read". The notes then show:
    - "Fitted to 100 tracked deliveries"
    - "**Bounce 118% ± 1**: from the tracking"
    - "Grip: the tracking **could not pin it down**, so it is left as it was"
- **On screen:** "Bring your own ground". Highlight the two bold phrases above.
- **Voice:** "Bring your own ground. It fits the physics — and says what your data can't pin down."

### 12. Outro (1:10–1:15, 5 s)
- **Show:** the night match turns into a day match as the app switches to light mode. Seam-up on the Standard pitch hits the stumps with a clatter. The wordmark comes in.
- **On screen:** "GRIP LAB" and "Every number has a source. Or it says 'estimate'." Small text under them: "8 grips · 4 cameras · 5 balls · 19 grounds · your own data".
- **Voice:** "Grip Lab. Every number has a source — or says it's a guess."
- **End:** the music resolves, then 0.5 s of silence.

## Rules that keep it true
- Don't change, round or add any number. The app's own code produced each one on 15 Nov 2026 (see the table below). If the running app shows something different, use the app's value and flag it.
- "Within 3 cm" is the median gap at each length. Never say every ball lands within 3 cm: a single ball is typically about 15 cm off.
- Only the bounce is fitted to Hawk-Eye. Say "bounce fitted to Hawk-Eye", never "physics fitted to Hawk-Eye".
- Don't claim grip recognition is accurate. It gives a first guess and you confirm it.
- Name Hawk-Eye, the ICC, CricViz and The Cricket Monthly as sources only. Use no logos and no graphics that copy a broadcaster's look.
- Show fit results, not rows from the tracking CSVs, because the HawkeyeStats data carries no licence.
- Never show `.env.local`, the Groq key or a browser address bar.

## The receipts behind each number
| On screen | Where it comes from | Checked |
|---|---|---|
| Seam-up tiles, 132 kph · 0.58 s · Hitting 71 cm | `simulate()` | re-run 15 Nov |
| Off-break, Club 1,100 → Elite 1,700 rpm; 17 → 27 cm | `LEVELS` in `grips.ts` (Beach 2012 … Sanders 2019) | re-run |
| 12 cm → 13° to slips; 240 fps · 128 frames → 143 kph | `seamFor()`, `speedFor()` in `match.ts` | re-run |
| Outswinger: Kookaburra 16 cm, Dukes 31 cm; old Dukes at 145 reverses 17 cm | `BALLS` (Scobie 2020, Grimshaw 2024, Deshpande 2018) | re-run |
| Gabba: +20% bounce, over the top at 92 cm; day 5: 88 cm, 5 cracks | `venues.ts` (Hawk-Eye fit), `wear()` | re-run |
| Gabba demo: Bounce 118% ± 1 from 100 real balls | `fitGround()` on `src/ground/demo/gabba.csv` | re-run |
| 527,165 balls, 317 Tests; 16 cm low → within 3 cm; 6,420 balls, 214 Tests; −5% by day 5 over 61 Tests | `scripts/hawkeye/`, README "Real tracking data" | README; not re-run (the raw data is outside the repo) |
| Dukes 1.00° vs 0.97–1.15° (CricViz) | README "The balls, checked against match tracking" | README |
| 43 tests | `npm test` | 43/43 pass |

## Share copy (draft)
Grip Lab: photograph a cricket grip, watch the delivery in 3D. The bounce is fitted to Hawk-Eye tracking from 214 Tests,
the swing comes from wind tunnels, the spin from spinners measured in labs, and every number has a source or says it's a guess.

## Teaser cut (20 s, on-screen text only)
Use scenes 1 (3 s), 4 (5 s, the cameras), 7 (4 s, Kookaburra → Dukes), 9 (5 s, the 16 cm → 3 cm card) and 12 (3 s).
