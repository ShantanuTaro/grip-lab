# Brag Plan: Grip Lab

The creative contract is `../brag-script.md`: its scenes, on-screen words, numbers and truth rules. This file adds what /brag
needs on top: the rubric, the voiceover as generated, the music cues, and the footage recorded for each scene.

**Duration: 75 s on purpose.** The user ran `/brag --voice --duration 75` and asked for the full feature tour, which overrides
the 15–25 s default. Reading-time rules still apply.

## Rubric
1. **What is the app?** Photograph a cricket ball grip, confirm which grip it is, and watch the delivery in 3D from the bowler's, batter's and umpire's view (README).
2. **Most impressive claim:** the bounce is fitted to Hawk-Eye tracking from 214 Tests (restitution 0.631 ± 0.001, from 6,420 balls). The brief's guess left balls a median 16 cm low at the stumps; the fit brings that within 3 cm at every length, or 6 cm for bouncers. Swing comes from wind tunnels and spin from spinners measured in labs.
3. **Visual hook:** the floodlit 3D ground from the Ball view: the red ball riding toward the stumps with its trail.
4. **Real UI to show:** `/capture` on a phone, then `/simulator` (four cameras, five readout tiles, the pitch map, the Delivery panel in a coach's words, the five balls, the grounds, day 5), and `/grounds` (the real Hawk-Eye fit).
5. **Shortest satisfying video:** 20 s, which is the teaser cut in `brag-script.md`. The user asked for the full 75 s.
6. **Tone:** `polished`. Direction: the ball-tracking segment of a Test match broadcast, with the receipts on screen.
7. **Audio:** a steady, clean music bed under a calm narrator, a soft thud at the bounces, quiet clicks on the key taps, a wood knock at the stumps and one bell on the wordmark.
8. **Share caption:** see below.
9. **User flow:** take three photos, confirm the grip and Simulate. Then Bowl it and change it in a coach's words. The result is the readouts and the verdict at the batter.

## The angle
The video looks like a TV graphic, but every frame is the real app, and it shows where its numbers come from.

## Hook (0–3 s)
A full-frame Ball view at night, with the outswinger riding at the stumps. "NOT ANIMATED." lands, then "SIMULATED." in leather red.

## Key moments
- The real Groq matcher reads your three demo photos: Seam-up 80%, Outswinger 10%, Inswinger 10%. You confirm Seam-up.
- Four cameras on one delivery: Hitting · 71 cm high.
- Coach words: Club → Elite turns 17 → 27 cm. Work it back: 128 frames → 143 kph, and 12 cm → the seam angle to match.
- The same outswinger: Kookaburra 16 cm, Dukes 31 cm. An old Dukes at 145 kph reverses 17 cm.
- The Gabba: Over the top · 92 cm. Day 5: 88 cm, and 5 cracks.
- The receipts: 527,165 Hawk-Eye-tracked balls; 16 cm too low → within 3 cm; wind tunnels; CricViz; spinners measured in labs.
- My grounds: 100 real Gabba balls → Bounce 118% ± 1, plus what the tracking could not pin down.

## Outro
The night match turns into a day match as seam-up hits the stumps. GRIP LAB, then "Every number has a source. Or it says 'estimate'."

## Tone
- Preset: polished
- Creative direction: a Test-match ball-tracking segment, with the receipts on screen
- Interpretation: calm, confident and specific. There is one idea per scene and real UI in every app scene. Data cards are in the app's own panel style. Transitions are soft fades and slides, never flashy.

## Format: landscape — 1920x1080, 30 fps
## Duration: 75 s

## Visual identity (from `src/index.css`)
- Background `#0e0f11`; panels `#17191c` and `#1f2226`; border `#2a2d33`; text `#f3f4f6`; muted text `#a1a6af`
- Accent: leather red `#d21f33` (night) and `#b61426` (the ball, the SG red)
- Display font: Barlow Condensed 600/700, upper case. Body font: Inter.
- Strongest visual element: the floodlit ground from the Ball view, and the five readout tiles

## Share copy (draft)
Grip Lab: photograph a cricket grip, watch the delivery in 3D. The bounce is fitted to Hawk-Eye tracking from 214 Tests, the swing comes from wind tunnels and the spin from spinners measured in labs.

## Audio direction
- Role: cinematic support under the narrator
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (110 BPM, "steady and clean"). It plays at about 0.34 alone and ducks to about 0.14 under the voice. It fades in over 1 s and out over the last 2.5 s.
- Music cue guidance: bundled preset `cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`, with a beat every 0.545 s.
  - Strong cues near the wordmark (about 4–5 s), the receipts counter (about 46 s) and the outro wordmark (about 72–73 s) are the 1–3 locks.
- Audio-reactive treatment: subtle. The wordmark's glow breathes with the bed's RMS, with no waveform visuals.
- SFX posture: sparse.
  - A soft thud at the bounces in the full-frame shots, and a wood knock at the stumps in the outro.
  - Quiet clicks on a few key taps, a soft impact as each receipts card lands, and one bell under the outro wordmark.
- Restraint rule: no crowd, no commentary-style sounds, and nothing loud over the narrator.

## Footage (recorded from the running app by `work/capture.mjs`, frame by frame at 30 fps on a virtual clock)
| Clip | What it shows |
|---|---|
| `hook.mp4` | Full-frame Ball view at night, outswinger, at 0.2× speed |
| `capture.mp4` | Phone, `/capture`: demo photos, the real Groq matcher (Seam-up 80%), confirm, Simulate |
| `bowl.mp4` | Desktop, seam-up from Bowler, Batter, Umpire and Ball, each with Bowl it |
| `coach.mp4` | Off-break; spinner's level Club → Elite |
| `workback.mp4` | Time it on a video (128 frames → 143 kph); Match a ball you saw (12 cm) |
| `balls.mp4` | Umpire view, outswinger: Kookaburra 16 → Dukes 31 cm; old ball at 145 kph, 17 cm in |
| `grounds.mp4` | Seam-up: Standard pitch, Hitting 71 cm → the Gabba, Over the top 92 cm → day 5, 88 cm |
| `own.mp4` | `/grounds`: New ground → Tracking → The Gabba → Fit → Bounce 118% ± 1 |
| `outro-night.mp4`, `outro-day.mp4` | Full-frame Ball view, seam-up hitting the stumps, night then day |

The left column in the simulator shows your own grip photo and the matcher's result, carried over from the capture.

## Storyboard as built (seconds; timed to the generated voice; full edit tables in `work/build.mjs`)
1. Hook — 0–3 — `hook.mp4`, full frame; "NOT ANIMATED." then "SIMULATED."
2. Reveal — 3–7 — logo and wordmark, with "Photograph a grip. Watch the delivery in 3D."
3. Capture — 7–13 — `capture.mp4` in a phone frame at 1.65×, beside the app's own steps; "You confirm the grip."
4. Bowl it — 13–20 — `bowl.mp4`: bowler, then quick cuts to batter and umpire, then the Ball view slowed to the stumps. The five readout tiles are lit one by one.
5. A coach's words — 20–24.5 — `coach.mp4`, zoomed onto the level chips and the Off the pitch tile; "No rpm. No degrees. A coach's words."
6. Work it back — 24.5–30.5 — `workback.mp4`, zoomed 1.5× on the Delivery panel: "Swung 12 cm away → 13° to slips", then "128 frames at 240 fps → 143 kph".
7. Five balls — 30.5–38.5 — the Kookaburra outswinger from the ball (16 cm), then `balls.mp4`: Dukes 31 cm, and an old Dukes at 145 kph swinging 17 cm in. "Same outswinger. Five balls.", then "Old and quick: it reverses."
8. Grounds — 38.5–46 — `grounds.mp4`; "19 famous grounds", "Gabba bounce: fitted to Hawk-Eye", "Day 5: −5% bounce, fitted to 61 Tests".
9. Receipts: the bounce — 46–55.5 — data cards: 527,165; 16 cm too low → within 3 cm (median, every length; 6 cm for bouncers).
10. Receipts: swing and spin — 55.5–62.5 — cards: wind tunnels, Dukes 1.00° vs 0.97–1.15° (CricViz); spinners measured in labs, 1,100–2,500 rpm.
11. Your own ground — 62.5–69 — `own.mp4`; "Bring your own ground"; the fit notes highlighted.
12. Outro — 69–75 — `outro-night.mp4` crossfading into `outro-day.mp4`, then a hold on its last frame; GRIP LAB; "Every number has a source. Or it says 'estimate'."

Audio-reactive treatment: left out on purpose. The bed sits at 0.15 under near-continuous narration, so a glow keyed to it would barely move, and the polished tone favours stillness. Beat locks: the reveal mark on the 3.27 s beat, the counter landing on the 48.02 s strong cue, and the outro strip on 72.02 s.

## Voiceover script
ElevenLabs "Daniel – Steady Broadcaster" (eleven_multilingual_v2), one file per line, placed in its scene. The earlier Kokoro takes are in `composition/assets/vo/kokoro/`.
1. This ball isn't animated. It's simulated.
2. Grip Lab. Photograph a grip, watch the delivery in 3D.
3. Three photos. It suggests the closest grips — you confirm yours.
4. Bowl it. Watch from the bowler, the batter, the umpire — or ride right behind the ball.
5. No one knows their revs. So it asks like a coach.
6. Saw it swing? It works out the seam angle. Timed it on your phone? It works out the speed.
7. Five match balls. Same outswinger: sixteen centimetres with a Kookaburra, thirty-one with a Dukes.
8. Nineteen famous grounds. At the Gabba, the same ball flies over the stumps. And pitches wear over five days.
9. Then we checked it against real Hawk-Eye tracking from over two hundred Tests — and fixed what it got wrong.
10. Swing comes from wind tunnels, checked against real Tests. Spin, from spinners measured in a lab.
11. Bring your own ground. It fits the physics — and says what your data can't pin down.
12. Grip Lab. Every number has a source — or says it's a guess.

**Music mood:** steady and confident. **Audio summary:** the bed comes up under the night hook, the narrator carries the tour, the receipts lift the bed slightly, and a wood knock and bell land the outro before the music fades.
