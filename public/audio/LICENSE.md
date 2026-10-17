# BLOOM original procedural score

`bloom-study-v1.wav` is an original, deterministic 32-second ambient composition
created for BLOOM by mathematical synthesis in `scripts/generate-score.mjs`.
The composition and recording use only generated sine oscillators, envelopes,
soft low-frequency pulses, and a seeded arrangement. There are no external
recordings, samples, melodies, or other third-party audio assets.

To the extent permitted by law, the creators dedicate this composition and
recording to the public domain under the
[CC0 1.0 Universal dedication](https://creativecommons.org/publicdomain/zero/1.0/).
Attribution is welcome but is not required.

Format: RIFF/WAVE, 22,050 Hz, mono, 16-bit signed PCM. The 32-second loop has
periodic oscillator phases and smooth overlapping envelopes. Regenerate it with
`node scripts/generate-score.mjs` from the BLOOM directory, or invoke the script
by its absolute path from any directory.
