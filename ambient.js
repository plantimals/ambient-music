class AmbientGenerator {
    constructor(seed = Date.now()) {
        this.isPlaying = false;
        this.seed = seed;
        this.rng = this.createRNG(seed);
        this.initialized = false;
        
        // Musical constants
        this.scales = {
            pentatonicMajor: ['C', 'D', 'E', 'G', 'A'],
            pentatonicMinor: ['C', 'Eb', 'F', 'G', 'Bb'],
            mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
            dorian: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
            lydian: ['C', 'D', 'E', 'F#', 'G', 'A', 'B'],
            harmonicMinor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B'],
            wholeTone: ['C', 'D', 'E', 'F#', 'G#', 'A#'],
            octatonic: ['C', 'D', 'Eb', 'F', 'F#', 'G#', 'A', 'B'],
            chromatic: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        };

        // Chord types for progression generation
        this.chordTypes = {
            major: [0, 4, 7],
            minor: [0, 3, 7],
            diminished: [0, 3, 6],
            augmented: [0, 4, 8],
            sus2: [0, 2, 7],
            sus4: [0, 5, 7],
            major7: [0, 4, 7, 11],
            minor7: [0, 3, 7, 10],
            dominant7: [0, 4, 7, 10]
        };

        // Common chord progressions templates (scale degrees)
        this.progressionTemplates = [
            [1, 4, 5, 1],        // I-IV-V-I
            [1, 6, 4, 5],        // I-vi-IV-V
            [2, 5, 1, 6],        // ii-V-I-vi
            [1, 4, 6, 5],        // I-IV-vi-V
            [6, 4, 1, 5],        // vi-IV-I-V
            [1, 5, 6, 4]         // I-V-vi-IV
        ];
    }

    async initialize() {
        if (!this.initialized) {
            // Ensure Tone.js is started before any initialization
            await Tone.start();
            
            // Reset any existing transport state
            Tone.Transport.cancel(0);
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            
            // Initialize evolution parameters
            this.evolutionState = {
                currentSection: 0,
                sectionDuration: 32, // measures per section
                lastSectionChange: 0,
                parameterChanges: this.initializeParameterChanges()
            };
            
            // Initialize components
            await this.initializeComponents();
            this.setupEffects();
            this.setupInstruments();
            this.setupPatterns();
            
            // Setup evolution callback
            Tone.Transport.scheduleRepeat(time => {
                this.evolveParameters(time);
            }, "4n");
            
            this.initialized = true;
        }
    }

    createRNG(seed) {
        return function() {
            seed = seed >>> 0;
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    random() {
        return this.rng();
    }

    getRandomScale() {
        const scales = Object.keys(this.scales);
        const selectedScale = this.scales[scales[Math.floor(this.random() * scales.length)]];
        
        // Occasionally add chromatic passing tones
        if (this.random() < 0.2) {
            const chromaticNotes = this.scales.chromatic;
            const numPassingTones = Math.floor(this.random() * 2) + 1;
            
            for (let i = 0; i < numPassingTones; i++) {
                const passingNote = chromaticNotes[Math.floor(this.random() * chromaticNotes.length)];
                if (!selectedScale.includes(passingNote)) {
                    selectedScale.push(passingNote);
                }
            }
        }
        
        return selectedScale;
    }

    getRandomOctave() {
        return Math.floor(this.random() * 3) + 3; // Random octave between 3-5
    }

    getRandomTiming() {
        const timings = ["2n", "2n.", "1n", "4n", "4n."];
        return timings[Math.floor(this.random() * timings.length)];
    }

    async initializeComponents() {
        // Randomize tempo between 65-85 BPM
        Tone.Transport.bpm.value = Math.floor(this.random() * 20) + 65;
        
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
            decay: this.random() * 5 + 5, // 5-10 seconds
            preDelay: this.random() * 0.2,
            wet: this.random() * 0.3 + 0.4 // 0.4-0.7
        }).connect(this.masterBus);

        // Delay network with random timing
        this.delay = new Tone.FeedbackDelay({
            delayTime: this.getRandomTiming(),
            feedback: this.random() * 0.3 + 0.2, // 0.2-0.5
            wet: this.random() * 0.2 + 0.2 // 0.2-0.4
        }).connect(this.mainReverb);

        // Chorus with random parameters
        this.chorus = new Tone.Chorus({
            frequency: this.random() * 0.5 + 0.2,
            delayTime: this.random() * 5 + 2,
            depth: this.random() * 0.5 + 0.3,
            wet: this.random() * 0.3 + 0.2
        }).connect(this.delay);
    }

    setupInstruments() {
        const oscillatorTypes = [
            "sine", "triangle", "sine4", "sine8", "square", "sawtooth",
            "fatsawtooth", "amsine", "fmsine", "pulse",
            {
                type: "custom",
                partials: Array.from({length: 8}, () => this.random())
            }
        ];
        
        // Helper function to create synth configuration with enhanced options
        const createSynthConfig = () => {
            const synthType = this.random();
            
            if (synthType < 0.3) { // FM Synthesis
                return {
                    type: 'FM',
                    config: {
                        harmonicity: this.random() * 4 + 0.5,
                        modulationIndex: this.random() * 10 + 1,
                        oscillator: {
                            type: oscillatorTypes[Math.floor(this.random() * oscillatorTypes.length)]
                        },
                        envelope: this.createComplexEnvelope(),
                        modulation: {
                            type: oscillatorTypes[Math.floor(this.random() * oscillatorTypes.length)]
                        },
                        modulationEnvelope: this.createComplexEnvelope()
                    }
                };
            } else if (synthType < 0.6) { // AM Synthesis
                return {
                    type: 'AM',
                    config: {
                        harmonicity: this.random() * 3 + 0.5,
                        oscillator: {
                            type: oscillatorTypes[Math.floor(this.random() * oscillatorTypes.length)]
                        },
                        envelope: this.createComplexEnvelope(),
                        modulation: {
                            type: oscillatorTypes[Math.floor(this.random() * oscillatorTypes.length)]
                        },
                        modulationEnvelope: this.createComplexEnvelope()
                    }
                };
            } else { // Enhanced Poly Synth
                return {
                    type: 'Poly',
                    config: {
                        oscillator: {
                            type: oscillatorTypes[Math.floor(this.random() * oscillatorTypes.length)],
                            count: Math.floor(this.random() * 3) + 1,
                            spread: this.random() * 40
                        },
                        envelope: this.createComplexEnvelope(),
                        filter: {
                            type: this.random() < 0.5 ? 'lowpass' : 'highpass',
                            frequency: this.random() * 10000 + 100,
                            Q: this.random() * 5 + 1,
                            envelope: {
                                attack: this.random() * 2,
                                decay: this.random() * 2,
                                sustain: this.random() * 0.5 + 0.2,
                                release: this.random() * 3
                            }
                        }
                    }
                };
            }
        };

        // Create synth configurations with enhanced options
        const synthConfigs = Array.from({length: 4}, () => createSynthConfig());
        
        // Initialize synths with filters and modulation
        this.synths = synthConfigs.map(config => {
            let synth;
            if (config.type === 'FM') {
                synth = new Tone.FMSynth(config.config);
            } else if (config.type === 'AM') {
                synth = new Tone.AMSynth(config.config);
            } else {
                synth = new Tone.PolySynth(Tone.Synth, config.config);
            }
            
            // Add filter modulation
            const filter = new Tone.Filter({
                type: this.random() < 0.5 ? 'lowpass' : 'highpass',
                frequency: this.random() * 10000 + 100,
                Q: this.random() * 5 + 1
            });
            
            // Add LFO for filter modulation
            const filterLFO = new Tone.LFO({
                frequency: this.random() * 0.5 + 0.1,
                min: 100,
                max: 5000
            }).connect(filter.frequency);
            
            filterLFO.start();
            
            return synth.chain(filter, this.chorus);
        });
        
        [this.padSynth, this.bassSynth, this.textureSynth, this.texture2Synth] = this.synths;
    }

    createComplexEnvelope() {
        return {
            attack: this.random() * 2 + 0.1,
            decay: this.random() * 2 + 0.1,
            sustain: this.random() * 0.5 + 0.3,
            release: this.random() * 4 + 1,
            attackCurve: ['linear', 'exponential', 'sine', 'cosine'][Math.floor(this.random() * 4)],
            releaseCurve: ['linear', 'exponential', 'sine', 'cosine'][Math.floor(this.random() * 4)]
        };
    }

    generateMelody() {
        const scale = this.getRandomScale();
        const sequence = [];
        const baseOctave = this.getRandomOctave();
        
        for (let i = 0; i < 8; i++) {
            const note = scale[Math.floor(this.random() * scale.length)];
            const octave = this.random() < 0.3 ? baseOctave + 1 : baseOctave;
            sequence.push(note + octave);
        }
        
        return sequence;
    }

    setupPatterns() {
        const melody = this.generateMelody();
        
        // Pad pattern with random timing
        this.padLoop = new Tone.Loop(time => {
            if (this.random() < 0.8) { // 80% chance to play
                const note = melody[Math.floor(this.random() * melody.length)];
                this.padSynth.triggerAttackRelease(note, this.getRandomTiming(), time);
            }
        }, "2n");

        // Bass pattern with occasional octave jumps
        this.bassLoop = new Tone.Loop(time => {
            if (this.random() < 0.9) { // 90% chance to play
                const baseNote = melody[0];
                const octave = this.random() < 0.2 ? -24 : -12; // Occasional two octave drop
                const note = Tone.Frequency(baseNote).transpose(octave);
                this.bassSynth.triggerAttackRelease(note, "1n", time);
            }
        }, "1n");

        // Texture pattern with varied timing
        this.textureLoop = new Tone.Loop(time => {
            if (this.random() < 0.7) { // 70% chance to play
                const note = melody[Math.floor(this.random() * melody.length)];
                const duration = this.getRandomTiming();
                this.textureSynth.triggerAttackRelease(note, duration, time);
            }
        }, "4n");

        // Second texture pattern with different timing and probability
        this.texture2Loop = new Tone.Loop(time => {
            if (this.random() < 0.6) { // 60% chance to play
                const note = melody[Math.floor(this.random() * melody.length)];
                const duration = this.getRandomTiming();
                this.texture2Synth.triggerAttackRelease(note, duration, time);
            }
        }, "2n");
    }

    async togglePlayPause() {
        try {
            if (!this.isPlaying) {
                // Initialize only when needed and after user gesture
                if (!this.initialized) {
                    await this.initialize();
                }
                // Reset transport before starting
                Tone.Transport.cancel(0);
                Tone.Transport.stop();
                Tone.Transport.position = 0;
                
                this.padLoop.start(0);
                this.bassLoop.start("0:1");  // Start bass loop slightly offset
                this.textureLoop.start("0:2");  // Start texture loop even more offset
                this.texture2Loop.start("0:3");  // Start second texture loop with more offset
                Tone.Transport.start();
            } else {
                this.padLoop.stop();
                this.bassLoop.stop();
                this.textureLoop.stop();
                this.texture2Loop.stop();
                Tone.Transport.stop();
                Tone.Transport.position = 0;
            }
            
            this.isPlaying = !this.isPlaying;
            return this.isPlaying;
        } catch (error) {
            console.error('Error toggling playback:', error);
            return false;
        }
    }

    generateChordProgression(scale) {
        // Select a progression template based on seed
        const template = this.progressionTemplates[Math.floor(this.random() * this.progressionTemplates.length)];
        const progression = [];
        
        // Convert scale degrees to actual chords
        for (const degree of template) {
            // Get the root note for this degree
            const rootIndex = (degree - 1) % scale.length;
            const rootNote = scale[rootIndex];
            
            // Select a chord type based on the scale degree and seed
            let chordTypeNames = Object.keys(this.chordTypes);
            let chordType;
            
            // Use musical theory to select appropriate chord types
            if (degree === 1 || degree === 4) {
                // I and IV are often major
                chordType = this.random() < 0.8 ? this.chordTypes.major : this.chordTypes.major7;
            } else if (degree === 5) {
                // V is often dominant
                chordType = this.random() < 0.7 ? this.chordTypes.dominant7 : this.chordTypes.major;
            } else if (degree === 6) {
                // vi is often minor
                chordType = this.random() < 0.8 ? this.chordTypes.minor : this.chordTypes.minor7;
            } else {
                // Random selection for other degrees
                chordType = this.chordTypes[chordTypeNames[Math.floor(this.random() * chordTypeNames.length)]];
            }
            
            // Build the chord by adding intervals to the root note
            const chord = chordType.map(interval => {
                const noteIndex = (rootIndex + Math.floor(interval / 2)) % scale.length;
                return scale[noteIndex];
            });
            
            progression.push(chord);
        }
        
        return progression;
    }

    initializeParameterChanges() {
        // Create seeded parameter evolution paths
        return {
            filterFrequency: {
                min: 200,
                max: 8000,
                current: 2000,
                rate: this.random() * 0.1,
                direction: 1
            },
            reverbDecay: {
                min: 2,
                max: 10,
                current: 5,
                rate: this.random() * 0.05,
                direction: 1
            },
            delayFeedback: {
                min: 0.1,
                max: 0.6,
                current: 0.3,
                rate: this.random() * 0.03,
                direction: 1
            },
            chorusDepth: {
                min: 0.2,
                max: 0.8,
                current: 0.5,
                rate: this.random() * 0.04,
                direction: 1
            }
        };
    }

    evolveParameters(time) {
        const transportTime = Tone.Transport.position;
        const [bars] = transportTime.split(':').map(Number);
        
        // Check for section change
        if (bars >= (this.evolutionState.currentSection + 1) * this.evolutionState.sectionDuration) {
            this.evolutionState.currentSection++;
            this.transitionToNewSection(time);
        }

        // Update continuous parameters
        Object.values(this.evolutionState.parameterChanges).forEach(param => {
            // Update direction with some probability
            if (this.random() < 0.05) {
                param.direction *= -1;
            }

            // Update parameter value
            param.current += param.rate * param.direction;

            // Bounce at boundaries
            if (param.current > param.max) {
                param.current = param.max;
                param.direction = -1;
            } else if (param.current < param.min) {
                param.current = param.min;
                param.direction = 1;
            }
        });

        // Apply parameter changes
        const params = this.evolutionState.parameterChanges;
        
        // Update filter frequencies
        this.synths.forEach(synth => {
            if (synth.filter) {
                synth.filter.frequency.rampTo(params.filterFrequency.current, 0.1);
            }
        });

        // Update effects
        this.mainReverb.decay = params.reverbDecay.current;
        this.delay.feedback.rampTo(params.delayFeedback.current, 0.1);
        this.chorus.depth.rampTo(params.chorusDepth.current, 0.1);
    }

    transitionToNewSection(time) {
        // Generate new musical material based on seed and section number
        const newScale = this.getRandomScale();
        const newProgression = this.generateChordProgression(newScale);
        
        // Update patterns with new musical material
        this.updatePatterns(newScale, newProgression, time);
        
        // Randomize some synth parameters
        this.synths.forEach(synth => {
            if (this.random() < 0.3) { // 30% chance to update each synth
                const newEnvelope = this.createComplexEnvelope();
                synth.set({
                    envelope: newEnvelope
                });
            }
        });
    }

    updatePatterns(scale, progression, time) {
        // Update existing patterns with new musical material
        const baseOctave = this.getRandomOctave();
        
        // Update pad pattern
        this.padLoop.callback = time => {
            if (this.random() < 0.8) {
                const chordIndex = Math.floor(Tone.Transport.position.split(':')[0] % progression.length);
                const chord = progression[chordIndex];
                const note = chord[Math.floor(this.random() * chord.length)] + baseOctave;
                this.padSynth.triggerAttackRelease(note, this.getRandomTiming(), time);
            }
        };

        // Update bass pattern
        this.bassLoop.callback = time => {
            if (this.random() < 0.9) {
                const chordIndex = Math.floor(Tone.Transport.position.split(':')[0] % progression.length);
                const rootNote = progression[chordIndex][0];
                const octave = this.random() < 0.2 ? -24 : -12;
                const note = Tone.Frequency(rootNote).transpose(octave);
                this.bassSynth.triggerAttackRelease(note, "1n", time);
            }
        };

        // Update texture patterns with more variation
        this.textureLoop.callback = time => {
            if (this.random() < 0.7) {
                const note = scale[Math.floor(this.random() * scale.length)] + (baseOctave + 1);
                const duration = this.getRandomTiming();
                this.textureSynth.triggerAttackRelease(note, duration, time);
            }
        };

        this.texture2Loop.callback = time => {
            if (this.random() < 0.6) {
                const chordIndex = Math.floor(Tone.Transport.position.split(':')[0] % progression.length);
                const chord = progression[chordIndex];
                const note = chord[Math.floor(this.random() * chord.length)] + (baseOctave + 2);
                const duration = this.getRandomTiming();
                this.texture2Synth.triggerAttackRelease(note, duration, time);
            }
        };
    }
}

// NIP-07 Login functionality
class NostrLogin {
    constructor() {
        this.pubkey = null;
        this.generator = null;
        this.loginButton = document.getElementById('loginButton');
        this.userInfo = document.getElementById('userInfo');
        this.playPauseButton = document.getElementById('playPauseButton');
        
        // Wait for DOM to be fully loaded before attempting auto-login
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.attemptAutoLogin();
            });
        } else {
            this.setupEventListeners();
            this.attemptAutoLogin();
        }
    }

    setupEventListeners() {
        this.loginButton.addEventListener('click', () => this.login());
        
        // Add space bar event listener
        document.addEventListener('keydown', async (event) => {
            if (event.code === 'Space' && !event.repeat && !event.target.matches('input, textarea')) {
                event.preventDefault();
                await this.togglePlay();
            }
        });
    }

    async attemptAutoLogin() {
        // Wait a small amount of time to ensure nostr extension is loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        if (typeof window.nostr !== 'undefined') {
            try {
                const pubkey = await window.nostr.getPublicKey();
                if (pubkey) {
                    await this.handleSuccessfulLogin(pubkey);
                }
            } catch (error) {
                console.log('Auto-login failed, manual login required:', error);
                this.loginButton.style.display = 'inline-block';
            }
        } else {
            console.log('Nostr not available, showing login button');
            this.loginButton.style.display = 'inline-block';
        }
    }

    async fetchProfile(pubkey) {
        try {
            const pool = new NostrTools.SimplePool();
            const relays = [
                'wss://relay.damus.io',
                'wss://nos.lol',
                'wss://relay.nostr.band',
                'wss://nostr.mom'
            ];

            try {
                // Set a timeout of 5 seconds for the relay query
                const profileEvent = await Promise.race([
                    pool.get(
                        relays,
                        {
                            kinds: [0],
                            authors: [pubkey]
                        }
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
                    )
                ]);

                if (profileEvent) {
                    try {
                        const content = JSON.parse(profileEvent.content);
                        return {
                            picture: content.picture || null,
                            name: content.name || content.display_name || null
                        };
                    } catch (e) {
                        console.error("Error parsing profile content:", e);
                    }
                }
            } finally {
                // Always clean up the pool
                pool.close(relays);
            }

            return { picture: null, name: null };
        } catch (error) {
            console.error("Error fetching profile:", error);
            return { picture: null, name: null };
        }
    }

    async updateUserDisplay(avatarUrl, displayName) {
        const avatar = this.userInfo.querySelector('.avatar');
        const npub = NostrTools.nip19.npubEncode(this.pubkey);
        const shortNpub = `${npub.slice(0, 8)}...${npub.slice(-4)}`;

        // Update avatar
        if (avatarUrl) {
            avatar.innerHTML = `<img src="${avatarUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatar.textContent = shortNpub.slice(0, 2).toUpperCase();
        }

        // Update display name/npub
        const npubSpan = this.userInfo.querySelector('.npub');
        npubSpan.textContent = displayName || shortNpub;
        // Add title with full npub for hover
        npubSpan.title = npub;
    }

    async handleSuccessfulLogin(pubkey) {
        this.pubkey = pubkey;
        const numericSeed = this.pubkey.split('').reduce((acc, char) => {
            return (acc * 31 + char.charCodeAt(0)) >>> 0;
        }, 0);
        
        this.loginButton.style.display = 'none';
        this.userInfo.style.display = 'flex';
        
        // Set default display while loading
        await this.updateUserDisplay(null, null);
        
        // Fetch and update profile
        const profile = await this.fetchProfile(this.pubkey);
        await this.updateUserDisplay(profile.picture, profile.name);
        
        // Add the start audio button to the main content
        const mainContent = document.querySelector('.main-content');
        const startButton = document.createElement('button');
        startButton.id = 'startAudioButton';
        startButton.style.background = '#8257e6';
        startButton.style.color = '#ffffff';
        startButton.textContent = 'Start Audio';
        mainContent.insertBefore(startButton, this.playPauseButton);

        // Add click handler for the start audio button
        startButton.addEventListener('click', async () => {
            try {
                await Tone.start();
                console.log("Tone.js started successfully");
                
                this.generator = new AmbientGenerator(numericSeed);
                await this.generator.initialize();
                console.log("Generator initialized");
                
                // Start playback
                const isPlaying = await this.generator.togglePlayPause();
                console.log("Playback started:", isPlaying);
                
                // Show play/pause button and hide start button
                startButton.style.display = 'none';
                this.playPauseButton.style.display = 'inline-block';
                this.playPauseButton.textContent = 'Pause';
            } catch (error) {
                console.error("Audio initialization error:", error);
            }
        });
    }

    login() {
        if (typeof window.nostr === 'undefined') {
            alert('Please install a Nostr extension (like nos2x or Alby)');
            return;
        }

        window.nostr.getPublicKey()
            .then(async pubkey => {
                if (!pubkey) {
                    throw new Error('No public key received');
                }
                await this.handleSuccessfulLogin(pubkey);
            })
            .catch(error => {
                console.error('Error in getPublicKey:', error);
                alert('Failed to get public key. Please make sure your Nostr extension is properly configured.');
            });
    }

    logout() {
        this.pubkey = null;
        this.loginButton.style.display = 'inline-block';
        this.userInfo.style.display = 'none';
        this.playPauseButton.style.display = 'none';
        
        // Remove start button if it exists
        const startButton = document.getElementById('startAudioButton');
        if (startButton) {
            startButton.remove();
        }
        
        // Stop any playing audio
        if (this.generator && this.generator.isPlaying) {
            Tone.Transport.stop();
            this.generator.isPlaying = false;
            this.playPauseButton.textContent = 'Play';
        }
        this.generator = null;
    }

    async togglePlay() {
        if (!this.pubkey) {
            alert('Please login first');
            return;
        }

        // If we're logged in but haven't initialized audio yet, simulate clicking the start button
        const startButton = document.getElementById('startAudioButton');
        if (startButton && startButton.style.display !== 'none') {
            startButton.click();
            return;
        }

        try {
            await Tone.start();
            const isPlaying = await this.generator.togglePlayPause();
            this.playPauseButton.textContent = isPlaying ? 'Pause' : 'Play';
        } catch (error) {
            console.error('Error toggling playback:', error);
            alert('Failed to start audio playback. Please try again.');
        }
    }
}

// Initialize Nostr login
const nostrLogin = new NostrLogin(); 