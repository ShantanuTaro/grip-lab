# Hyperframes Composition Brief: Grip Lab

## Objective
A 75 s narrated feature tour of Grip Lab. It shows the real app and the sources behind its physics.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1920x1080, 30 fps
- Duration: 75 s (the user's `--duration 75`)

## Source material
- Project root: `/Users/shantanu/Documents/grip-lab`
- Files read: `README.md`, `SPEC.md`, `index.html`, `src/index.css`, `src/screens/*.tsx`, `src/physics/*.ts`, `src/ground/*.ts`, and `brag-script.md`
- Product name: Grip Lab
- Tagline: "Photograph a grip. Watch the delivery in 3D." (from the README's first line)
- Key UI: the simulator (four cameras, five readout tiles, the pitch map, the Delivery panel), the capture screen and My grounds. All of it is recorded from the running app into `assets/clips/*.mp4` at 2880×1620 (desktop) and 1170×2532 (phone).
- Copy that must appear verbatim: the on-screen lines in `brag-script.md`, scene by scene. Its numbers must not change.

## Creative direction
- Tone preset: polished. Direction: the ball-tracking segment of a Test match broadcast, with the receipts on screen.
- Angle, hook and outro: see `brag-plan.md`.
- Avoid generic SaaS language, abstract filler, any redesign of the app's look, logos of the data sources, and anything that copies a broadcaster's look.

## Visual identity
- Background `#0e0f11`; panels `#17191c` / `#1f2226`; border `#2a2d33`; text `#f3f4f6`; muted `#a1a6af`
- Accent: leather red `#d21f33`; ball `#b61426`
- Fonts: Barlow Condensed 600/700 and Inter, both shipped in `assets/fonts/`
- References: the app's card radius (14 px), its upper-case Barlow eyebrows and numbers, and its readout tiles

## Storyboard
`brag-plan.md` holds the storyboard and the voiceover script. Scene lengths flex to the generated voice lines.

## Audio
- Role: cinematic support under the narrator
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`. It sits at about 0.34 with no voice and about 0.14 under the voice, fades in over 1 s and fades out over the last 2.5 s.
- Music cues: the bundled preset (110 BPM). Lock 1–3 major moments (the reveal wordmark, the receipts counter, the outro wordmark) to strong cues, and keep everything else on natural timing for readability.
- Audio-reactive: subtle glow on the wordmarks from the bed's RMS. If extraction is unavailable, document it and skip.
- SFX: sparse and low-HF picks from the brag library, copied into `assets/sfx/`.
- Voiceover: `assets/vo/vo01.wav` to `vo12.wav` (Kokoro `af_heart`), on their own tracks.

## Hyperframes instructions
Follow `/hyperframes-core`'s contract: one paused GSAP timeline, `data-*` timing, no `crossorigin`, an id on every `<audio>`, and local fonts and GSAP. Run `npx hyperframes check` as the gate, open the preview, and render only after approval. Keep everything local.
