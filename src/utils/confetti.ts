import confetti from 'canvas-confetti';

/**
 * Plays a cheerful, harmonic synthesizer chime for positive attendance feedback.
 */
export function playSuccessChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major chord flourish)

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + 0.45);
    });
  } catch {
    // Gracefully handle any browser audio autoplay policy restrictions
  }
}

/**
 * Triggers a multi-stage celebration confetti burst.
 * 1. Center pop burst
 * 2. Left and right side cannon waves
 */
export function triggerAttendanceSuccessConfetti(): void {
  // Sound effect
  playSuccessChime();

  // Stage 1: Vibrant center pop
  confetti({
    particleCount: 70,
    spread: 70,
    origin: { y: 0.62 },
    colors: ['#2563eb', '#10b981', '#f59e0b', '#06b6d4', '#6366f1', '#ec4899'],
    startVelocity: 35,
    scalar: 1.1,
    ticks: 200,
    zIndex: 9999,
  });

  // Stage 2: Left and right celebratory cannons after 180ms
  setTimeout(() => {
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 55,
      origin: { x: 0.1, y: 0.75 },
      colors: ['#10b981', '#3b82f6', '#fbbf24', '#34d399'],
      startVelocity: 45,
      zIndex: 9999,
    });
    confetti({
      particleCount: 45,
      angle: 120,
      spread: 55,
      origin: { x: 0.9, y: 0.75 },
      colors: ['#2563eb', '#f59e0b', '#10b981', '#818cf8'],
      startVelocity: 45,
      zIndex: 9999,
    });
  }, 180);

  // Stage 3: Gentle star drift after 350ms
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.45 },
      shapes: ['star', 'circle'],
      colors: ['#fbbf24', '#f59e0b', '#10b981'],
      scalar: 0.8,
      startVelocity: 20,
      ticks: 220,
      zIndex: 9999,
    });
  }, 350);
}
