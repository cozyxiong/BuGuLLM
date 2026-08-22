let ctx = null;

function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function envGain(ac, t, peak, attack, release) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return g;
}

function playWood(ac, t, pitch) {
  const dur = 0.055;
  const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.16));
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 380 * pitch;
  bp.Q.value = 1.35;
  const g = envGain(ac, t, 0.2, 0.004, 0.07);
  noise.connect(bp).connect(g).connect(ac.destination);
  noise.start(t);
  noise.stop(t + 0.09);

  const thud = ac.createOscillator();
  thud.type = "triangle";
  thud.frequency.setValueAtTime(196 * pitch, t);
  thud.frequency.exponentialRampToValueAtTime(88 * pitch, t + 0.08);
  const tg = envGain(ac, t, 0.14, 0.003, 0.08);
  thud.connect(tg).connect(ac.destination);
  thud.start(t);
  thud.stop(t + 0.1);
}

function playDing(ac, t, pitch) {
  const tones = [
    [1567.98, 0.055, 0],
    [2093.0, 0.042, 0.012],
    [2637.02, 0.028, 0.022],
  ];
  tones.forEach(([freq, peak, delay]) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * pitch;
    const g = envGain(ac, t + delay, peak, 0.008, 0.52);
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    o.connect(hp).connect(g).connect(ac.destination);
    o.start(t + delay);
    o.stop(t + delay + 0.58);
  });
}

export function playKnockSfx() {
  const ac = audioCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.001;
  const pitch = 0.97 + Math.random() * 0.07;
  playWood(ac, t, pitch);
  playDing(ac, t + 0.012, pitch);
}

export function unlockKnockSfx() {
  audioCtx();
}
