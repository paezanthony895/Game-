import type { SoundTrigger } from '../engine/matchEngine';
import type { GameSettings } from '../types/football';

/**
 * TUNABLE AUDIO MIXING CONSTANTS
 */
export const AUDIO_MIX_CONFIG = {
  /** Factor de reducción (ducking) del público y SFX mientras habla el relator */
  COMMENTARY_DUCKING_FACTOR: 0.48,
  /** Volumen base del cántico/insulto de hinchada respecto al volumen de público */
  CROWD_CHANT_GAIN_MULTIPLIER: 0.58,
  /** Volumen máximo permitido de la hinchada para nunca tapar al relator */
  MAX_CROWD_AMBIENCE_GAIN: 0.52,
} as const;

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private audioSettings: GameSettings['audio'] | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private lastFootstepAt = 0;
  private lastChantPulseAt = 0;
  private lastWhistleBooAt = 0;
  private commentaryDuckingActive = false;
  private currentDangerLevel = 0.25;
  private autoUnlockBound = false;
  private unlockedWarmupDone = false;

  constructor() {
    this.installAutoUnlock();
  }

  private installAutoUnlock(): void {
    if (typeof window === 'undefined' || this.autoUnlockBound) return;
    this.autoUnlockBound = true;
    const unlock = () => {
      if (this.audioSettings?.masterMuted) return;
      const ctx = this.ensureContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (!this.unlockedWarmupDone && ctx.state === 'running') {
          this.unlockedWarmupDone = true;
          try {
            const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
            const src = ctx.createBufferSource();
            src.buffer = silentBuf;
            src.connect(ctx.destination);
            src.start(0);
          } catch {
            // ignore
          }
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.resume();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public setSettings(audio: GameSettings['audio']): void {
    this.audioSettings = audio;
    if (audio.masterMuted || !audio.stadiumAmbienceEnabled) {
      this.stopMatchAmbience();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && audio.masterMuted) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.audioSettings?.masterMuted) return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Activa o desactiva el "audio ducking" automático: baja el volumen de ambiente
   * y tribuna mientras el relator o comentarista está hablando.
   */
  public setCommentaryDucking(active: boolean): void {
    this.commentaryDuckingActive = active;
    if (!this.ctx || !this.ambienceGain) return;
    const crowdVol = this.audioSettings?.crowdVolume ?? 0.78;
    const duckMult = active ? AUDIO_MIX_CONFIG.COMMENTARY_DUCKING_FACTOR : 1.0;
    const targetGain = Math.min(
      AUDIO_MIX_CONFIG.MAX_CROWD_AMBIENCE_GAIN,
      (0.16 + this.currentDangerLevel * 0.24) * crowdVol * duckMult
    );
    this.ambienceGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  /**
   * Updates continuous stadium crowd murmur, chants, and dynamic volume based on play danger (0..1).
   * Also triggers hostile crowd whistles when the rival holds possession for long periods.
   */
  public updateMatchAmbience(dangerLevel: number, active: boolean, rivalHasPossession = false): void {
    if (
      !active ||
      this.audioSettings?.masterMuted ||
      this.audioSettings?.stadiumAmbienceEnabled === false
    ) {
      this.stopMatchAmbience();
      return;
    }
    const crowdVol = this.audioSettings?.crowdVolume ?? 0.78;
    if (crowdVol <= 0.01) {
      this.stopMatchAmbience();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.ambienceSource) {
      const bufSize = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.035;
        b1 = 0.985 * b1 + white * 0.042;
        b2 = 0.95 * b2 + white * 0.055;
        data[i] = (b0 + b1 + b2) * 0.48;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 560;
      filter.Q.value = 0.65;

      const gain = ctx.createGain();
      gain.gain.value = 0.18 * crowdVol;

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();

      this.ambienceSource = src;
      this.ambienceFilter = filter;
      this.ambienceGain = gain;
    }

    const now = ctx.currentTime;
    const clampedDanger = Math.max(0, Math.min(1, dangerLevel));
    this.currentDangerLevel = clampedDanger;
    const duckMult = this.commentaryDuckingActive ? AUDIO_MIX_CONFIG.COMMENTARY_DUCKING_FACTOR : 1.0;

    if (this.ambienceGain && this.ambienceFilter) {
      const targetGain = Math.min(
        AUDIO_MIX_CONFIG.MAX_CROWD_AMBIENCE_GAIN,
        (0.16 + clampedDanger * 0.24) * crowdVol * duckMult
      );
      const targetFreq = 480 + clampedDanger * 580;
      this.ambienceGain.gain.setTargetAtTime(targetGain, now, 0.15);
      this.ambienceFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
    }

    // Rhythmic stadium chant / bombo drum pulse every ~1.15s
    if (now - this.lastChantPulseAt > 1.15) {
      this.lastChantPulseAt = now;
      const drumOsc = ctx.createOscillator();
      const drumGain = ctx.createGain();
      drumOsc.type = 'sine';
      drumOsc.frequency.setValueAtTime(98, now);
      drumOsc.frequency.exponentialRampToValueAtTime(46, now + 0.16);
      drumGain.gain.setValueAtTime((0.09 + clampedDanger * 0.08) * crowdVol * duckMult, now);
      drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      drumOsc.connect(drumGain).connect(ctx.destination);
      drumOsc.start(now);
      drumOsc.stop(now + 0.19);
    }

    // Silbidos de la tribuna local cuando el rival tiene la pelota en campo ofensivo
    if (rivalHasPossession && now - this.lastWhistleBooAt > 3.2) {
      this.lastWhistleBooAt = now;
      this.playCrowdWhistleBoo(crowdVol * duckMult * 0.55);
    }
  }

  /**
   * Reproduce silbidos múltiples de desaprobación de la hinchada cuando el rival maneja la pelota
   * o el árbitro cobra en contra.
   */
  public playCrowdWhistleBoo(gainLevel = 0.18): void {
    const ctx = this.ensureContext();
    if (!ctx || gainLevel <= 0.01) return;
    const now = ctx.currentTime;
    const freqs = [2450, 2720, 3110];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = now + idx * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 90, t0);
      osc.frequency.linearRampToValueAtTime(f - 180, t0 + 0.35);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(gainLevel * 0.14, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }

  /**
   * Reproduce un audio de cántico o insulto de tribuna multiplicado en efecto coro de estadio
   * (3 voces desfasadas con filtro de megáfono/tribuna) siempre por debajo del volumen del relator.
   */
  public async playStadiumCrowdChorusWav(base64Wav: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const crowdVol = this.audioSettings?.crowdVolume ?? 0.65;
    if (crowdVol <= 0.02 || this.audioSettings?.masterMuted) return;

    try {
      const binary = atob(base64Wav);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const now = ctx.currentTime;
      const duckMult = this.commentaryDuckingActive ? 0.55 : 0.85;
      const baseGain = crowdVol * AUDIO_MIX_CONFIG.CROWD_CHANT_GAIN_MULTIPLIER * duckMult;

      // 3-layer stadium chorus (delays & pitch detune) so it sounds like a crowd section shouting together
      const voices = [
        { delay: 0.0, rate: 0.97, pan: -0.35, gain: baseGain },
        { delay: 0.035, rate: 1.02, pan: 0.0, gain: baseGain * 0.9 },
        { delay: 0.07, rate: 1.06, pan: 0.35, gain: baseGain * 0.8 },
      ];

      for (const v of voices) {
        const src = ctx.createBufferSource();
        src.buffer = audioBuffer;
        src.playbackRate.value = v.rate;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1150;
        filter.Q.value = 0.65;

        const gainNode = ctx.createGain();
        gainNode.gain.value = v.gain;

        src.connect(filter).connect(gainNode).connect(ctx.destination);
        src.start(now + v.delay);
      }
    } catch {
      // Fallback procedural roar/boo if decode fails
      this.trigger('foul_boo');
    }
  }

  public stopMatchAmbience(): void {
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
      } catch {
        // ignore
      }
      this.ambienceSource = null;
      this.ambienceFilter = null;
      this.ambienceGain = null;
    }
  }

  public trigger(kind: SoundTrigger): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const duckMult = this.commentaryDuckingActive ? 0.72 : 1.0;
    const sfxVol = (this.audioSettings?.sfxVolume ?? 0.88) * duckMult;
    const crowdVol = (this.audioSettings?.crowdVolume ?? 0.78) * duckMult;
    const musicVol = (this.audioSettings?.musicVolume ?? 0.55) * duckMult;
    const now = ctx.currentTime;

    switch (kind) {
      case 'kick_light':
      case 'kick_hard':
      case 'header_thud': {
        if (sfxVol <= 0.01) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = kind === 'kick_hard' ? 148 : kind === 'header_thud' ? 118 : 185;
        osc.frequency.setValueAtTime(baseFreq * (0.94 + Math.random() * 0.12), now);
        osc.frequency.exponentialRampToValueAtTime(36, now + (kind === 'kick_hard' ? 0.16 : 0.10));
        gain.gain.setValueAtTime((kind === 'kick_hard' ? 0.54 : 0.36) * sfxVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }

      case 'footstep_grass': {
        if (sfxVol <= 0.01 || now - this.lastFootstepAt < 0.22) return;
        this.lastFootstepAt = now;
        const bufSize = Math.floor(ctx.sampleRate * 0.045);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1650;
        const gain = ctx.createGain();
        gain.gain.value = 0.09 * sfxVol;
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        break;
      }

      case 'body_clash': {
        if (sfxVol <= 0.01) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(102, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.12);
        gain.gain.setValueAtTime(0.28 * sfxVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }

      case 'net_swish': {
        if (sfxVol <= 0.01) return;
        const bufSize = Math.floor(ctx.sampleRate * 0.28);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        const gain = ctx.createGain();
        gain.gain.value = 0.36 * sfxVol;
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        break;
      }

      case 'whistle_start':
      case 'whistle_short':
      case 'whistle_fulltime': {
        if (sfxVol <= 0.01) return;
        const pulses = kind === 'whistle_fulltime' ? [0, 0.24, 0.5] : [0];
        const dur = kind === 'whistle_start' ? 0.38 : kind === 'whistle_fulltime' ? 0.30 : 0.20;
        for (const offset of pulses) {
          const osc = ctx.createOscillator();
          const mod = ctx.createOscillator();
          const modGain = ctx.createGain();
          const gain = ctx.createGain();

          // Pea whistle trill modulation
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2860, now + offset);
          mod.type = 'sine';
          mod.frequency.setValueAtTime(48, now + offset);
          modGain.gain.setValueAtTime(110, now + offset);
          mod.connect(modGain).connect(osc.frequency);

          gain.gain.setValueAtTime(0.001, now + offset);
          gain.gain.linearRampToValueAtTime(0.28 * sfxVol, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + offset);
          mod.start(now + offset);
          osc.stop(now + offset + dur + 0.02);
          mod.stop(now + offset + dur + 0.02);
        }
        break;
      }

      case 'post': {
        if (sfxVol <= 0.01) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(295, now + 0.28);
        gain.gain.setValueAtTime(0.35 * sfxVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case 'save_clap':
      case 'near_miss_gasp': {
        if (sfxVol <= 0.01 && crowdVol <= 0.01) return;
        const bufSize = Math.floor(ctx.sampleRate * 0.55);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          const env = Math.sin((i / bufSize) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(kind === 'near_miss_gasp' ? 620 : 1150, now);
        filter.frequency.exponentialRampToValueAtTime(kind === 'near_miss_gasp' ? 380 : 950, now + 0.5);
        filter.Q.value = 2.2;
        const gain = ctx.createGain();
        gain.gain.value = 0.44 * Math.max(sfxVol, crowdVol);
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        break;
      }

      case 'goal_roar': {
        if (crowdVol > 0.01) {
          const bufSize = Math.floor(ctx.sampleRate * 2.4);
          const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) {
            const env = Math.sin((i / bufSize) * Math.PI);
            data[i] = (Math.random() * 2 - 1) * env;
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1080;
          const gain = ctx.createGain();
          gain.gain.value = 0.56 * crowdVol;
          src.connect(filter).connect(gain).connect(ctx.destination);
          src.start(now);
        }
        if (musicVol > 0.02) {
          const notes = [261.63, 329.63, 392.0, 523.25];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const t0 = now + 0.15 + idx * 0.14;
            const dur = idx === notes.length - 1 ? 0.55 : 0.16;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t0);
            g.gain.setValueAtTime(0.14 * musicVol, t0);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            osc.connect(g).connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + dur + 0.02);
          });
        }
        break;
      }

      case 'foul_card':
      case 'foul_boo': {
        if (sfxVol <= 0.01 && crowdVol <= 0.01) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(215, now);
        osc.frequency.linearRampToValueAtTime(145, now + 0.28);
        gain.gain.setValueAtTime(0.24 * Math.max(sfxVol, crowdVol), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
        this.playCrowdWhistleBoo(crowdVol * 0.65);
        break;
      }

      case 'thunder': {
        if (sfxVol <= 0.01 && crowdVol <= 0.01) return;
        const vol = Math.max(sfxVol, crowdVol, 0.85);
        // Electric crackle burst + deep booming thunder roll
        const bufSize = Math.floor(ctx.sampleRate * 1.75);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          const t = i / bufSize;
          const env = t < 0.07 ? 1.0 : Math.exp(-(t - 0.07) * 2.9);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2100, now);
        filter.frequency.exponentialRampToValueAtTime(95, now + 1.65);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.75 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        break;
      }
    }
  }

  public playKickWithPower(power01: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const duckMult = this.commentaryDuckingActive ? 0.72 : 1.0;
    const sfxVol = (this.audioSettings?.sfxVolume ?? 0.88) * duckMult;
    if (sfxVol <= 0.01) return;

    const p = Math.max(0.15, Math.min(1.0, power01));
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startFreq = 195 - p * 60;
    const dur = 0.09 + p * 0.10;
    osc.frequency.setValueAtTime(startFreq * (0.96 + Math.random() * 0.08), now);
    osc.frequency.exponentialRampToValueAtTime(32, now + dur);
    gain.gain.setValueAtTime((0.28 + p * 0.36) * sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sfxVol = this.audioSettings?.sfxVolume ?? 0.6;
    if (sfxVol <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.04);
    gain.gain.setValueAtTime(0.08 * sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const soundEngine = new ProceduralSoundEngine();
export const AudioManager = soundEngine;

