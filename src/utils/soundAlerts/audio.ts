// Institutional Web Audio Synthesizer & Visual Lighting Alert Engine
// Zero-dependency audio generator for Trade Entry, Loss, Medium Profit, High Profit,
// +50% Buy-Price Jackpot Milestone, Holding Profit, and Daily Market Session Start/End bells.

export type AlertCategory =
  | 'TRADE_ENTRY'
  | 'LOSS_ALERT'
  | 'PROFIT_MEDIUM'
  | 'PROFIT_HIGH'
  | 'PROFIT_50_PERCENT_JACKPOT'
  | 'HOLDING_PROFIT'
  | 'SESSION_START'
  | 'SESSION_END';

export interface VisualLightAlert {
  id: string;
  category: AlertCategory;
  titleMl: string;
  titleEn: string;
  subtitleMl: string;
  subtitleEn: string;
  timestamp: string;
  colorTheme: 'cyan' | 'rose' | 'emerald' | 'amber' | 'gold_jackpot' | 'indigo';
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playToneNote(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  peakGain = 0.22
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffsetSec);

  gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffsetSec);
  gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + startOffsetSec + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + startOffsetSec + durationSec
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startOffsetSec);
  osc.stop(ctx.currentTime + startOffsetSec + durationSec + 0.02);
}

export function playTradingAlertSound(category: AlertCategory, enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    switch (category) {
      case 'TRADE_ENTRY': {
        // Crisp 3-step institutional execution chime (D5 -> F#5 -> A5)
        playToneNote(ctx, 587.33, 0.0, 0.14, 'triangle', 0.24);
        playToneNote(ctx, 739.99, 0.12, 0.14, 'triangle', 0.24);
        playToneNote(ctx, 880.0, 0.24, 0.28, 'sine', 0.28);
        break;
      }

      case 'LOSS_ALERT': {
        // Urgent descending 3-tone stop-loss / drawdown warning siren
        playToneNote(ctx, 440.0, 0.0, 0.18, 'sawtooth', 0.22);
        playToneNote(ctx, 349.23, 0.18, 0.18, 'sawtooth', 0.24);
        playToneNote(ctx, 261.63, 0.36, 0.35, 'triangle', 0.28);
        break;
      }

      case 'PROFIT_MEDIUM': {
        // Pleasant ascending Major Triad profit chime (C5 -> E5 -> G5)
        playToneNote(ctx, 523.25, 0.0, 0.14, 'sine', 0.22);
        playToneNote(ctx, 659.25, 0.12, 0.14, 'sine', 0.24);
        playToneNote(ctx, 783.99, 0.24, 0.30, 'triangle', 0.26);
        break;
      }

      case 'PROFIT_HIGH': {
        // Radiant 4-note high-profit fanfare (C5 -> E5 -> G5 -> C6)
        playToneNote(ctx, 523.25, 0.0, 0.12, 'triangle', 0.24);
        playToneNote(ctx, 659.25, 0.11, 0.12, 'triangle', 0.25);
        playToneNote(ctx, 783.99, 0.22, 0.14, 'triangle', 0.26);
        playToneNote(ctx, 1046.5, 0.35, 0.42, 'sine', 0.30);
        break;
      }

      case 'PROFIT_50_PERCENT_JACKPOT': {
        // Special 6-Note Golden Jackpot Symphony for +50% Buy-Price Profit Milestone!
        playToneNote(ctx, 523.25, 0.0, 0.11, 'triangle', 0.26); // C5
        playToneNote(ctx, 659.25, 0.10, 0.11, 'triangle', 0.26); // E5
        playToneNote(ctx, 783.99, 0.20, 0.11, 'triangle', 0.28); // G5
        playToneNote(ctx, 1046.5, 0.30, 0.14, 'sine', 0.30); // C6
        playToneNote(ctx, 1318.5, 0.43, 0.16, 'sine', 0.30); // E6
        playToneNote(ctx, 1567.98, 0.58, 0.55, 'triangle', 0.34); // G6
        break;
      }

      case 'HOLDING_PROFIT': {
        // Crystal bell chime when Holdings are in profit (E5 -> B5 -> E6)
        playToneNote(ctx, 659.25, 0.0, 0.15, 'sine', 0.20);
        playToneNote(ctx, 987.77, 0.14, 0.18, 'sine', 0.22);
        playToneNote(ctx, 1318.5, 0.30, 0.35, 'triangle', 0.25);
        break;
      }

      case 'SESSION_START': {
        // Exchange Opening Bell (Rich resonant brass bell chord)
        playToneNote(ctx, 587.33, 0.0, 0.25, 'triangle', 0.26);
        playToneNote(ctx, 880.0, 0.0, 0.25, 'sine', 0.20);
        playToneNote(ctx, 587.33, 0.28, 0.25, 'triangle', 0.26);
        playToneNote(ctx, 1174.66, 0.56, 0.55, 'sine', 0.30);
        break;
      }

      case 'SESSION_END': {
        // Exchange Closing Bell (Resonant descending bell cadence)
        playToneNote(ctx, 880.0, 0.0, 0.22, 'triangle', 0.25);
        playToneNote(ctx, 659.25, 0.24, 0.22, 'triangle', 0.25);
        playToneNote(ctx, 440.0, 0.48, 0.50, 'sine', 0.28);
        break;
      }
    }
  } catch {
    // Ignore audio context autoplay errors until user interacts
  }
}

