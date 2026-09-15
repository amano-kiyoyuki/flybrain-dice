/*
 * Browser adaptation of the eight-group MockBrain concept from
 * Frankweb33/Himas1211's flybrain-robot-bridge (MIT License).
 * This is a hand-designed leaky activity model, not a connectome simulation.
 */

const GROUPS = [
  { name: "LEFT MOTION", short: "LM", angle: -2.75, color: "#40e6d3" },
  { name: "RIGHT MOTION", short: "RM", angle: -0.39, color: "#40e6d3" },
  { name: "LOOMING", short: "LO", angle: -1.57, color: "#ff7a45" },
  { name: "BALANCE L", short: "BL", angle: 2.75, color: "#a57bff" },
  { name: "BALANCE R", short: "BR", angle: 0.39, color: "#a57bff" },
  { name: "LEFT MOTOR", short: "ML", angle: 2.05, color: "#caff32" },
  { name: "RIGHT MOTOR", short: "MR", angle: 1.09, color: "#caff32" },
  { name: "ESCAPE", short: "ES", angle: 1.57, color: "#ff7a45" }
];

const els = {
  canvas: document.getElementById("brainCanvas"),
  status: document.getElementById("status"),
  statusText: document.getElementById("statusText"),
  signalValue: document.getElementById("signalValue"),
  motorValue: document.getElementById("motorValue"),
  motorMeter: document.getElementById("motorMeter"),
  motorBar: document.getElementById("motorBar"),
  thresholdValue: document.getElementById("thresholdValue"),
  thresholdMarker: document.getElementById("thresholdMarker"),
  die: document.getElementById("die"),
  diceStage: document.querySelector(".dice-stage"),
  rollCount: document.getElementById("rollCount"),
  lastEvent: document.getElementById("lastEvent"),
  bars: document.getElementById("bars"),
  averageValue: document.getElementById("averageValue"),
  toggleButton: document.getElementById("toggleButton"),
  toggleLabel: document.getElementById("toggleLabel"),
  toggleIcon: document.querySelector(".button-icon"),
  singleRollButton: document.getElementById("singleRollButton"),
  resetButton: document.getElementById("resetButton"),
  speedRange: document.getElementById("speedRange")
};

const ctx = els.canvas.getContext("2d");
const threshold = 0.62;
let state = new Array(8).fill(0);
let running = false;
let lastFrame = performance.now();
let elapsed = 0;
let lastRollAt = -Infinity;
let previousSignal = 0;
let forcedStimulusUntil = 0;
let counts = new Array(6).fill(0);
let rollTotal = 0;
let rollSum = 0;
let flash = 0;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function createBars() {
  els.bars.innerHTML = "";
  counts.forEach((_, index) => {
    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `<div class="bar-track"><span class="bar-fill" data-bar="${index}" style="height:2%"></span></div><span>${index + 1}</span>`;
    els.bars.appendChild(item);
  });
}

function randomDie() {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return (values[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(signal, source = "brain") {
  const value = randomDie();
  counts[value - 1] += 1;
  rollTotal += 1;
  rollSum += value;
  lastRollAt = elapsed;
  flash = 1;

  els.die.classList.remove("rolling");
  void els.die.offsetWidth;
  els.die.dataset.face = String(value);
  els.die.setAttribute("aria-label", `サイコロの目は${value}`);
  els.die.classList.add("rolling");
  els.diceStage.classList.add("fired");
  window.setTimeout(() => els.diceStage.classList.remove("fired"), 430);

  els.rollCount.textContent = String(rollTotal).padStart(4, "0");
  els.averageValue.textContent = (rollSum / rollTotal).toFixed(2);
  els.lastEvent.textContent = source === "manual"
    ? `外部刺激 → ROLL → ${value}`
    : `活動 ${Math.round(signal * 100)}% → ROLL → ${value}`;

  const maxCount = Math.max(1, ...counts);
  counts.forEach((count, index) => {
    const bar = document.querySelector(`[data-bar="${index}"]`);
    bar.style.height = `${Math.max(2, (count / maxCount) * 100)}%`;
    bar.parentElement.setAttribute("aria-label", `${index + 1}の出目 ${count}回`);
  });

  // The result returns to the virtual environment as a short sensory event.
  // 1–3 bias left, 4–6 bias right, and 1/6 act as stronger looming cues.
  forcedStimulusUntil = elapsed + 0.23 + value * 0.018;
}

function sensoryInput(t) {
  const pace = Number(els.speedRange.value);
  const phase = t * (0.6 + pace * 0.19);
  const waveA = (Math.sin(phase * 1.7) + 1) / 2;
  const waveB = (Math.sin(phase * 2.31 + 1.8) + 1) / 2;
  const eventPulse = t < forcedStimulusUntil ? 0.92 : 0;
  const restGate = Math.pow((Math.sin(phase * 0.57 - 1.2) + 1) / 2, 3);

  return {
    leftMotion: clamp(waveA * 0.54 + restGate * 0.25 + eventPulse * 0.22),
    rightMotion: clamp(waveB * 0.54 + restGate * 0.25 + eventPulse * 0.18),
    looming: clamp(Math.max(0, Math.sin(phase * 0.83 - 2.1)) * 0.72 + eventPulse * 0.3),
    balance: Math.sin(phase * 0.4) * 0.13
  };
}

function brainStep(sensory, dt) {
  const balance = clamp(sensory.balance, -1, 1);
  const drive = [
    sensory.leftMotion,
    sensory.rightMotion,
    sensory.looming,
    Math.max(balance, 0),
    Math.max(-balance, 0),
    0.15 + sensory.rightMotion * 0.7 - Math.max(balance, 0),
    0.15 + sensory.leftMotion * 0.7 - Math.max(-balance, 0),
    sensory.looming
  ].map(value => clamp(value));

  const leak = 1 - Math.exp(-dt / 0.12);
  state = state.map((value, index) => value + (drive[index] - value) * leak);
  return Math.max(state[5], state[6], state[7]);
}

function setRunning(next) {
  running = next;
  els.status.dataset.state = next ? "running" : (rollTotal ? "paused" : "idle");
  els.statusText.textContent = next ? "RUNNING" : (rollTotal ? "PAUSED" : "STANDBY");
  els.toggleButton.classList.toggle("is-running", next);
  els.toggleLabel.textContent = next ? "一時停止" : (rollTotal ? "実験を再開" : "実験を開始");
  els.toggleIcon.textContent = next ? "Ⅱ" : "▶";
}

function updateMetrics(signal) {
  const percent = Math.round(signal * 100);
  els.signalValue.textContent = signal.toFixed(3);
  els.motorValue.textContent = String(percent);
  els.motorBar.style.width = `${clamp(signal) * 100}%`;
  els.motorMeter.setAttribute("aria-valuenow", String(percent));
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function hexToRgba(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawBrain(signal) {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2 + 8;
  const rx = Math.min(width * 0.31, 220);
  const ry = Math.min(height * 0.35, 150);
  const nodeRadius = width < 520 ? 21 : 27;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * .82, ry * .9, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -ry * .88);
  ctx.lineTo(0, ry * .88);
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.stroke();
  ctx.restore();

  const positions = GROUPS.map((group, index) => {
    const inward = index >= 5 ? 0.73 : 1;
    return {
      x: cx + Math.cos(group.angle) * rx * inward,
      y: cy + Math.sin(group.angle) * ry * inward
    };
  });

  const links = [[0,5],[1,6],[2,7],[3,5],[4,6],[5,7],[6,7],[0,6],[1,5],[5,6]];
  links.forEach(([from, to], index) => {
    const a = positions[from];
    const b = positions[to];
    const activity = Math.max(state[from], state[to]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const bend = (index % 2 ? 1 : -1) * 14;
    ctx.quadraticCurveTo((a.x + b.x) / 2 + bend, (a.y + b.y) / 2 - bend, b.x, b.y);
    ctx.strokeStyle = activity > .5 ? `rgba(202,255,50,${.12 + activity * .48})` : `rgba(255,255,255,${.035 + activity * .1})`;
    ctx.lineWidth = activity > .5 ? 1.5 : 1;
    ctx.stroke();

    if (running && activity > .38) {
      const progress = (elapsed * (.55 + activity) + index * .13) % 1;
      const x = (1-progress)*(1-progress)*a.x + 2*(1-progress)*progress*((a.x+b.x)/2+bend) + progress*progress*b.x;
      const y = (1-progress)*(1-progress)*a.y + 2*(1-progress)*progress*((a.y+b.y)/2-bend) + progress*progress*b.y;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#caff32";
      ctx.fill();
    }
  });

  GROUPS.forEach((group, index) => {
    const { x, y } = positions[index];
    const activity = state[index];
    const glow = activity * 22 + flash * (index >= 5 ? 14 : 0);

    ctx.save();
    ctx.shadowColor = group.color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius + activity * 4, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(group.color, .09 + activity * .26);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(group.color, .28 + activity * .7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#f5f7f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(group.short, x, y - 2);
    ctx.fillStyle = "rgba(245,247,242,.52)";
    ctx.font = "600 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`${Math.round(activity * 100)}`, x, y + 12);

    const labelOffset = nodeRadius + 18;
    const labelX = x + Math.cos(group.angle) * labelOffset;
    const labelY = y + Math.sin(group.angle) * labelOffset;
    ctx.fillStyle = "rgba(245,247,242,.55)";
    ctx.font = "600 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = Math.cos(group.angle) < -.2 ? "right" : Math.cos(group.angle) > .2 ? "left" : "center";
    ctx.fillText(group.name, labelX, labelY);
  });

  if (signal >= threshold) {
    ctx.beginPath();
    ctx.arc(cx, cy, 56 + flash * 12, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(202,255,50,${.28 + flash * .5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (running) {
    elapsed += dt;
    const sensory = sensoryInput(elapsed);
    const signal = brainStep(sensory, dt);
    const cooldown = 1.05 - Number(els.speedRange.value) * 0.12;

    if (signal >= threshold && previousSignal < threshold && elapsed - lastRollAt > cooldown) {
      rollDice(signal);
    }
    // Sustained activity can initiate another roll after a refractory period.
    if (signal >= threshold + .09 && elapsed - lastRollAt > cooldown * 1.65) {
      rollDice(signal);
    }
    previousSignal = signal;
    updateMetrics(signal);
    flash = Math.max(0, flash - dt * 2.7);
    drawBrain(signal);
  } else {
    const signal = Math.max(state[5], state[6], state[7]);
    updateMetrics(signal);
    drawBrain(signal);
  }

  requestAnimationFrame(frame);
}

els.toggleButton.addEventListener("click", () => setRunning(!running));

els.singleRollButton.addEventListener("click", () => {
  forcedStimulusUntil = elapsed + .45;
  if (!running) {
    // Advance the same leaky model with a brief synthetic input before rolling.
    const stimulus = { leftMotion: .9, rightMotion: .75, looming: .62, balance: 0 };
    for (let i = 0; i < 12; i += 1) brainStep(stimulus, 1 / 60);
    const signal = Math.max(state[5], state[6], state[7]);
    updateMetrics(signal);
    rollDice(signal, "manual");
  }
});

els.resetButton.addEventListener("click", () => {
  setRunning(false);
  state = new Array(8).fill(0);
  counts = new Array(6).fill(0);
  rollTotal = 0;
  rollSum = 0;
  elapsed = 0;
  previousSignal = 0;
  lastRollAt = -Infinity;
  els.rollCount.textContent = "0000";
  els.averageValue.textContent = "—";
  els.lastEvent.textContent = "脳活動の開始を待っています";
  els.die.dataset.face = "1";
  createBars();
});

window.addEventListener("resize", resizeCanvas);
els.thresholdValue.textContent = String(Math.round(threshold * 100));
els.thresholdMarker.style.left = `${threshold * 100}%`;
createBars();
resizeCanvas();
requestAnimationFrame(frame);
