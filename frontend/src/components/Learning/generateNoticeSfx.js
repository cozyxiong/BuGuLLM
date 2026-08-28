let ctx = null;

function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(ac, t, freq, peak, attack, release) {
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2800;
  o.connect(lp).connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + attack + release + 0.02);
}

export function unlockGenerateNoticeSfx() {
  audioCtx();
}

export function playGenerateDoneSfx() {
  const ac = audioCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.001;
  tone(ac, t, 783.99, 0.048, 0.012, 0.22);
  tone(ac, t + 0.1, 1174.66, 0.042, 0.012, 0.28);
  tone(ac, t + 0.2, 1567.98, 0.032, 0.01, 0.36);
}

export function playGenerateErrorSfx() {
  const ac = audioCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.001;
  tone(ac, t, 392.0, 0.05, 0.01, 0.2);
  tone(ac, t + 0.12, 293.66, 0.044, 0.012, 0.32);
}
