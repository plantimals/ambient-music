class AmbientGenerator {
    constructor() {
        this.isPlaying = false;
        
        // Musical constants
        this.scales = {
            pentatonicMajor: ['C', 'D', 'E', 'G', 'A'],
            pentatonicMinor: ['C', 'Eb', 'F', 'G', 'Bb'],
            mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
            dorian: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
            lydian: ['C', 'D', 'E', 'F#', 'G', 'A', 'B']
        };

        // Initialize Tone.js components
        this.initializeComponents();
        this.setupEffects();
        this.setupInstruments();
        this.setupPatterns();
    }

    getRandomScale() {
        const scales = Object.keys(this.scales);
        return this.scales[scales[Math.floor(Math.random() * scales.length)]];
    }

    getRandomOctave() {
        return Math.floor(Math.random() * 3) + 3; // Random octave between 3-5
    }

    getRandomTiming() {
        const timings = ["2n", "2n.", "1n", "4n", "4n."];
        return timings[Math.floor(Math.random() * timings.length)];
    }

    async initializeComponents() {
        // Randomize tempo between 65-85 BPM
        Tone.Transport.bpm.value = Math.floor(Math.random() * 20) + 65;
        
        // Configure master output
        Tone.Destination.volume.value = -12;
        const limiter = new Tone.Limiter(-3).toDestination();
        const masterCompressor = new Tone.Compressor({
            threshold: -24,
            ratio: 12,
            attack: 0.003,
            release: 0.25
        }).connect(limiter);
        this.masterBus = masterCompressor;
    }

    setupEffects() {
        // Main reverb with random decay
        this.mainReverb = new Tone.Reverb({
            decay: Math.random() * 5 + 5, // 5-10 seconds
            preDelay: Math.random() * 0.2,
            wet: Math.random() * 0.3 + 0.4 // 0.4-0.7
        }).connect(this.masterBus);

        // Delay network with random timing
        this.delay = new Tone.FeedbackDelay({
            delayTime: this.getRandomTiming(),
            feedback: Math.random() * 0.3 + 0.2, // 0.2-0.5
            wet: Math.random() * 0.2 + 0.2 // 0.2-0.4
        }).connect(this.mainReverb);

        // Chorus with random parameters
        this.chorus = new Tone.Chorus({
            frequency: Math.random() * 0.5 + 0.2,
            delayTime: Math.random() * 5 + 2,
            depth: Math.random() * 0.5 + 0.3,
            wet: Math.random() * 0.3 + 0.2
        }).connect(this.delay);
    }

    setupInstruments() {
        const oscillatorTypes = ["sine", "triangle", "sine4", "sine8"];
        
        // Pad synth with random oscillator
        this.padSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)]
            },
            envelope: {
                attack: Math.random() * 2 + 1,
                decay: Math.random() * 0.5,
                sustain: Math.random() * 0.3 + 0.6,
                release: Math.random() * 3 + 2
            }
        }).connect(this.chorus);

        // Bass synth
        this.bassSynth = new Tone.Synth({
            oscillator: {
                type: "triangle"
            },
            envelope: {
                attack: Math.random() * 0.3 + 0.2,
                decay: Math.random() * 0.2,
                sustain: Math.random() * 0.2 + 0.7,
                release: Math.random() * 2 + 1
            }
        }).connect(this.mainReverb);

        // Texture synth with random FM settings
        this.textureSynth = new Tone.FMSynth({
            harmonicity: Math.random() * 2 + 1,
            modulationIndex: Math.random() * 5 + 1,
            envelope: {
                attack: Math.random() * 2 + 2,
                decay: Math.random() * 2 + 1,
                sustain: Math.random() * 0.3 + 0.6,
                release: Math.random() * 3 + 2
            }
        }).connect(this.chorus);
    }

    generateMelody() {
        const scale = this.getRandomScale();
        const sequence = [];
        const baseOctave = this.getRandomOctave();
        
        for (let i = 0; i < 8; i++) {
            const note = scale[Math.floor(Math.random() * scale.length)];
            const octave = Math.random() < 0.3 ? baseOctave + 1 : baseOctave;
            sequence.push(note + octave);
        }
        
        return sequence;
    }

    setupPatterns() {
        const melody = this.generateMelody();
        
        // Pad pattern with random timing
        this.padLoop = new Tone.Loop(time => {
            if (Math.random() < 0.8) { // 80% chance to play
                const note = melody[Math.floor(Math.random() * melody.length)];
                this.padSynth.triggerAttackRelease(note, this.getRandomTiming(), time);
            }
        }, "2n");

        // Bass pattern with occasional octave jumps
        this.bassLoop = new Tone.Loop(time => {
            if (Math.random() < 0.9) { // 90% chance to play
                const baseNote = melody[0];
                const octave = Math.random() < 0.2 ? -24 : -12; // Occasional two octave drop
                const note = Tone.Frequency(baseNote).transpose(octave);
                this.bassSynth.triggerAttackRelease(note, "1n", time);
            }
        }, "1n");

        // Texture pattern with varied timing
        this.textureLoop = new Tone.Loop(time => {
            if (Math.random() < 0.7) { // 70% chance to play
                const note = melody[Math.floor(Math.random() * melody.length)];
                const duration = this.getRandomTiming();
                this.textureSynth.triggerAttackRelease(note, duration, time);
            }
        }, "4n");
    }

    async togglePlayPause() {
        if (!this.isPlaying) {
            await Tone.start();
            this.padLoop.start();
            this.bassLoop.start();
            this.textureLoop.start();
            Tone.Transport.start();
        } else {
            Tone.Transport.pause();
        }
        
        this.isPlaying = !this.isPlaying;
        return this.isPlaying;
    }
}

// Initialize the generator
const generator = new AmbientGenerator();

// Setup UI control
const playPauseButton = document.getElementById('playPauseButton');
playPauseButton.addEventListener('click', async () => {
    const isPlaying = await generator.togglePlayPause();
    playPauseButton.textContent = isPlaying ? 'Pause' : 'Play';
}); 