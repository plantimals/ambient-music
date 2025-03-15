# Ambient Music Generator

A web-based generative ambient music system that creates endless, unique musical pieces using Tone.js. Each generated piece is deterministic based on a seed value, allowing you to share and replay specific musical compositions.

## Features

- Generative ambient music using three synth layers:
  - Pad synth for atmospheric harmonies
  - Bass synth for deep, foundational tones
  - Texture synth (FM) for complex, evolving sounds
- Randomized but musical parameters:
  - Scale selection (Pentatonic Major/Minor, Mixolydian, Dorian, Lydian)
  - Tempo (65-85 BPM)
  - Note patterns and timings
  - Synth parameters (attack, decay, sustain, release)
- Rich effects chain:
  - Reverb with randomized decay
  - Delay network with musical timing
  - Chorus for movement and width
  - Master compression and limiting
- Seed-based generation system:
  - Share specific pieces via URL
  - Replay the exact same composition using the same seed
  - Automatic random seed generation for new pieces

## Usage

1. Open the page in a web browser
2. Click the "Play" button to start generating music
3. Click "Pause" to stop playback
4. To share a specific piece:
   - Note the seed number displayed on the page
   - Add it to the URL as a parameter: `?seed=1234567`
   - Share the URL with others

## Technical Details

- Built with [Tone.js](https://tonejs.github.io/) for audio synthesis and scheduling
- Uses Mulberry32 algorithm for seeded random number generation
- All randomization is deterministic based on the seed value
- Audio initialization follows web browser autoplay policies

## Dependencies

- Tone.js v14.8.49

## License

MIT License 