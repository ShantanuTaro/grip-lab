<!-- Original brief, saved 2026-11-11. UI design canvas: https://claude.ai/artifact/5iWRZZgpdrMq2CFHTSxjSn -->

Build "Grip Lab" (placeholder name): a web app that takes a photo of a cricket ball grip, matches it to a known grip, and simulates the delivery in 3D from the bowler's, batter's and umpire's point of view.

## Stack
- Vite + React + TypeScript, three.js via @react-three/fiber and drei, Zustand for state, Tailwind for styling, Vitest for tests.
- Everything runs in the browser. No backend in this phase.
- Mobile-first responsive: it must work at 390 px wide and at 1440 px.

## Screens (two routes)
1. /capture
   - Upload or camera-capture up to three photos (side on, seam front on, release position).
   - Show a "what the photos show" panel (seam orientation, fingers, thumb, hand) and a ranked list of the three closest grips with confidence.
   - The user must confirm or change the grip ("None of these, choose from the library") before a "Simulate this grip" button goes to /simulator. The match is only a suggestion.
2. /simulator
   - Left: the user's grip photo with the closest matches, and a grip library of 8 presets in a 2-column grid.
   - Centre: POV tabs (Bowler / Batter / Umpire), the 3D viewport, a playback bar (Bowl/Pause button, scrubber, elapsed / total seconds), and five readout tiles: release speed, swing in air (cm and direction), deviation off the pitch (degrees and direction), time to batter, and at the stumps (Hitting / Missing off / Missing leg / Over the top, plus height in cm).
   - Right: delivery controls: bowling arm (right/left), release speed 70-150 kph, seam angle -30 to +30 degrees, spin -2500 to +2500 rpm, length 1-11 m from the batter's stumps, line -50 to +50 cm, ball condition (new/old), and a top-down pitch map showing the path and bounce point.
   - Picking a grip loads its preset values and replays the delivery. Moving any slider redraws the path live.
   - On a phone: POV tabs, viewport, playback, three readouts, grip chips in a horizontal scroll row, and the remaining controls in a bottom sheet.

## Visual design
- Dark broadcast style. Background #0C120F, panels #141B17, borders #26322B, text #EEF2EC, muted text #A3AFA6.
- Accent (trajectory, selected states, primary buttons): gold #E9C46A with dark text #16130A. Ball: red #D43840.
- Outfield #153423, pitch #A08A58, crease lines #F4EEDD, stumps #F2E6C4.
- Fonts: Barlow Condensed (600/700, uppercase) for headings and big numbers, Inter for everything else.
- 14 px card radius, 44 px minimum touch targets, real buttons/labels/inputs, visible focus states, text contrast of at least 4.5:1.

## Grip presets (starting values)
Seam-up: 132 kph, seam 0, spin 0, length 6.5 m
Outswinger: 132 kph, seam +22, spin 0, length 5.5 m
Inswinger: 130 kph, seam -22, spin 0, length 5.5 m
Off-cutter: 122 kph, spin +900, length 6.5 m
Leg-cutter: 122 kph, spin -900, length 6.5 m
Off-break: 86 kph, spin +2000, length 4.5 m
Leg-break: 84 kph, spin -2200, length 4.5 m
Googly: 82 kph, spin +1800, length 4.5 m
Positive seam angle points to the slips (swings away from a right-hander). Positive spin turns into a right-hander. Keep these in one typed config file so they are easy to tune.

## Physics (src/physics, pure TypeScript, no React or three.js imports)
- Coordinates: z runs down the pitch from the bowler's stumps (0) to the batter's stumps (20.12 m), y is height, x is lateral. Popping creases at 1.22 m and 18.9 m, pitch width 3.05 m, stump height 0.711 m, stump spacing 0.1143 m, ball radius 0.036 m, mass 0.156 kg.
- Integrate the flight with RK4 at a 1 ms step. Forces: gravity, drag (Cd about 0.45), Magnus force from the spin vector, and a seam-swing side force that depends on seam angle, speed and ball condition (strongest around 110-135 kph with a new ball, weaker with an old ball).
- Bounce: coefficient of restitution about 0.55, horizontal speed loss about 12%, and lateral deviation from spin and seam at impact.
- Solve the release angles so the ball pitches at the chosen length and line. Release height 2.1 m, release 0.4 m to the side of the stumps on the bowling-arm side (over the wicket).
- Put every coefficient in one constants file with a comment on its source or the fact that it is an estimate. These need tuning against published cricket ball aerodynamics later.
- Output: a list of timestamped positions, the bounce point, swing in cm, deviation in degrees, time to the stumps, and the stumps verdict.
- Unit tests: no swing or spin gives a straight path; an outswinger moves away from a right-hander; an off-break turns in; a slower ball takes longer and bounces lower; the ball pitches within 5 cm of the requested length and line.

## 3D scene
- Pitch, creases, both sets of stumps, outfield plane, ball with a visible seam that rotates with the spin vector, a ground shadow under the ball, a gold trail for the path travelled, a faint line for the full path, and a ring at the bounce point.
- Cameras: Bowler (behind the arm at release height), Umpire (centred, about 3 m behind the bowler's stumps, 1.7 m high), Batter (eye height at the batter's crease, looking back up the pitch). Animate the transition between cameras.
- Playback runs at 0.25x real time by default, with the scrubber tied to simulation time.

## Grip recognition (src/vision)
- Phase A (build now): define an interface `classifyGrip(images): Promise<{ features, matches: { gripId, confidence }[] }>` and ship a stub that returns fixed sample output, clearly marked as sample data in the UI.
- Phase B (scaffold only, behind the same interface): MediaPipe Hand Landmarker for finger positions, a seam-line detector for seam orientation, and a small classifier over those features. No public dataset of labelled grip photos exists, so add a simple in-app labelling tool that saves a photo with its confirmed grip label and exports the set as JSON, so we can collect our own.

## Constraints and order of work
- Batter is right-handed in this phase; structure the code so handedness can be added.
- A photo cannot measure speed or spin rate; say so in the UI next to the controls.
- Order: 1) physics module with tests, 2) 3D scene with the three cameras and playback, 3) simulator screen wired to the store, 4) capture screen with the stub classifier, 5) labelling tool, 6) Phase B scaffold.
- After each step, run the tests and the app, and tell me what works and what does not before moving on.
- Write a README covering setup, the physics model and its assumptions, and how to tune the constants.
