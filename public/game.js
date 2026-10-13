// NEXUS ESTELAR: ESCAPE DUAL — cliente. El jugador 1 (PATO) es el "host" que simula la escena; el GATO la recibe.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 960, H = 540, FL = 470, PW = 36, PH = 64;
cv.width = W; cv.height = H;
const socket = io();
const NAMES = ['PATO', 'GATO'];
const IMG = {};
['estacion', 'reactor', 'espacio', 'observatorio', 'playa', 'gusano'].forEach((n) => { const i = new Image(); i.src = 'assets/' + n + '.png'; IMG[n] = i; });
const SPR = ['pato', 'gato'].map((n) => { const i = new Image(); i.src = 'assets/' + n + '.png'; return i; });
const ready = (i) => i && i.complete && i.naturalWidth > 0;
let MEM = ['...'];
fetch('memorias.json').then((r) => r.json()).then((j) => { if (Array.isArray(j) && j.length) MEM = j; }).catch(() => {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const cx = (p) => p.x + PW / 2, cy = (p) => p.y + PH / 2;

// ---------- Estado ----------
let me = null, peer = null, pd = { x: 0, y: 0, gy: 0, z: 0, f: 1, an: 0, mv: 0, t2: 0 }, count = 1, code = '';
let sceneI = 0, G = { parts: [], mem: 0, destroyed: 0, scars: 0 }, S = null, vision = false, myRs = 0, lastEc = [0, 0];
const keys = {};
const isHost = () => me && me.idx === 0;

// ---------- Música (opcional: public/assets/musica/*.mp3) ----------
let cur = null, curName = null;
function setMusic(n) {
  if (n === curName) return; curName = n;
  const old = cur; cur = null;
  if (old) { let v = old.volume; const f = setInterval(() => { v -= 0.08; if (v <= 0) { clearInterval(f); old.pause(); } else old.volume = v; }, 60); }
  if (n) { try { cur = new Audio('assets/musica/' + n + '.mp3'); cur.loop = true; cur.volume = 0.6; cur.play().catch(() => {}); } catch (e) {} }
}
addEventListener('pointerdown', () => { if (cur && cur.paused) cur.play().catch(() => {}); });

// ---------- Utilidades de dibujo ----------
function txt(t, x, y, sz, col, al) { ctx.font = sz + 'px monospace'; ctx.fillStyle = col || '#fff'; ctx.textAlign = al || 'left'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }
function wrap(t, x, y, mw, lh, sz, col, al) {
  ctx.font = sz + 'px monospace'; let l = '';
  String(t).split(' ').forEach((w) => {
    const tt = l ? l + ' ' + w : w;
    if (ctx.measureText(tt).width > mw && l) { txt(l, x, y, sz, col, al); y += lh; l = w; } else l = tt;
  });
  txt(l, x, y, sz, col, al);
}
function bar(x, y, w, h, v, col) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(v, 0, 1), h - 4);
  ctx.strokeStyle = '#6c78c9'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function damage() {
  for (let k = 0; k < G.destroyed; k++) {
    const x = (k * 277 + 90) % 780;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, 0, 150, H - 70);
    ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 40, 120); ctx.lineTo(x + 10, 230); ctx.lineTo(x + 70, 360); ctx.stroke();
  }
  if (G.scars) { ctx.strokeStyle = '#ff9a5c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(380, 150); ctx.lineTo(330, 300); ctx.lineTo(430, 430); ctx.stroke(); }
}
function bg(n) {
  if (ready(IMG[n])) ctx.drawImage(IMG[n], 0, 0, W, H); else { ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, W, H); }
  damage();
}
// ---------- Jugador (sombra, profundidad, animación) ----------
function drawPlayer(x, y, f, idx, sc, o) {
  sc = sc || 1; o = o || {}; const s = SPR[idx], ds = o.ds || 1, z = o.z || 0;
  const base = o.gy !== undefined ? o.gy : y + PH;
  if (!o.noShadow) {
    const k = 1 - Math.min(1, z / 150), sz = (0.6 + 0.4 * k) * sc * ds;
    ctx.save(); ctx.globalAlpha = 0.12 + 0.3 * k; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x + PW / 2, base + 3, 27 * sz, 7 * sz, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  const h = 80 * sc * ds, bob = o.bob || 0;
  ctx.save();
  if (ready(s)) {
    const w = (s.width * h) / s.height;
    ctx.translate(x + PW / 2, y + PH + 4 - bob); ctx.rotate(o.lean || 0); ctx.scale(f * (o.sx || 1), o.sy || 1);
    ctx.drawImage(s, -w / 2, -h, w, h);
  } else { ctx.fillStyle = idx ? '#f5a142' : '#fff'; ctx.fillRect(x, y, PW, PH); }
  ctx.restore();
  txt(NAMES[idx], x + PW / 2, y + PH + 4 - bob - h - 6, 12, '#fff', 'center');
}
// suelo metálico para escenas cuyo fondo no tiene piso
function deck(y0) {
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(10,16,40,0)'); g.addColorStop(0.22, 'rgba(14,20,52,.78)'); g.addColorStop(1, 'rgba(6,8,26,.94)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  ctx.strokeStyle = 'rgba(130,150,230,.22)'; ctx.lineWidth = 1;
  for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 44, y0 + 6); ctx.lineTo(W / 2 + i * 150, H); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const yy = y0 + (H - y0) * Math.pow((k + 1) / 4, 1.7); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
}
// polvo, partículas ambientales y viñeta
const FX = [];
function dust(x, y, n, sp) {
  for (let i = 0; i < n && FX.length < 120; i++) FX.push({ x: x + rnd(-8, 8), y: y + rnd(-2, 2), vx: rnd(-30, 30) * (sp || 1), vy: rnd(-34, -6), l: 0.45, m: 0.45, r: rnd(2, 5) });
}
function stepFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) { const p = FX[i]; p.l -= dt; if (p.l <= 0) { FX.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; }
}
function drawFX() {
  FX.forEach((p) => { ctx.globalAlpha = (p.l / p.m) * 0.5; ctx.fillStyle = '#cfd6ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.7 - p.l / p.m), 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
}
const MOTES = Array.from({ length: 34 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, s: 0.3 + (i % 5) * 0.15, r: 1 + (i % 3) }));
function drawMotes() {
  const t = performance.now() / 1000; ctx.fillStyle = 'rgba(190,215,255,.32)';
  MOTES.forEach((m) => ctx.fillRect((m.x + t * 9 * m.s) % W, (((m.y - t * 6 * m.s + Math.sin(t * 0.6 + m.x) * 10) % H) + H) % H, m.r, m.r));
}
const VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
(() => { const g = VIG.getContext('2d'), r = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, W * 0.62); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,10,.55)'); g.fillStyle = r; g.fillRect(0, 0, W, H); })();
const pos = (i) => (me.idx === i ? me : peer ? pd : { x: -99, y: -99 });

// ---------- Escenas ----------
const modeOf = (sc) => (typeof sc.mode === 'function' ? sc.mode(me.idx) : sc.mode || 'g');

function reactorScene(title, hint) {
  return {
    title, hint, mode: 'g', band: [420, 520],
    init: () => ({ prog: 0, ph: 'hold', ok: 0, wait: 0, win: 0, tp: [0, 0] }),
    tick(S, dt, P, tap) {
      if (S.ph === 'hold') {
        const inR = P.every((p) => cx(p) > 560);
        if (inR && P[0].e && P[1].e) { S.prog += dt / 2.5; S.msg = 'Mantengan E juntos...'; }
        else { S.prog = Math.max(0, S.prog - dt * 0.6); S.msg = inR ? 'Mantengan E los dos a la vez' : 'Ambos deben entrar a la sala del reactor (derecha)'; }
        if (S.prog >= 1) { S.ph = 'pulse'; S.prog = 0; S.wait = rnd(1, 2.5); S.win = 0; S.ok = 0; S.tp = [0, 0]; S.msg = 'Prepárense...'; }
      } else if (S.win > 0) {
        tap.forEach((t, i) => { if (t) S.tp[i] = 1; });
        if (S.tp[0] && S.tp[1]) {
          S.ok++; S.win = 0; S.tp = [0, 0]; S.wait = rnd(1, 2.5);
          if (S.ok >= 3) { S.done = true; S.msg = '¡Reactor estabilizado!'; } else S.msg = '¡Sincronizados! ' + S.ok + '/3';
        } else {
          S.win -= dt;
          if (S.win <= 0) { G.destroyed++; S.ph = 'hold'; S.prog = 0; S.ok = 0; S.tp = [0, 0]; S.msg = 'Fallaron: una zona de la estación se destruyó para siempre'; }
        }
      } else { S.wait -= dt; if (S.wait <= 0) { S.win = 1.2; S.tp = [0, 0]; } }
    },
    draw(S) {
      bg('reactor');
      const t = performance.now(), p = Math.sin(t / 200) * 5;
      ctx.fillStyle = S.done ? 'rgba(79,255,255,.25)' : 'rgba(255,120,40,.18)';
      ctx.beginPath(); ctx.arc(800, 280, 150 + p, 0, 7); ctx.fill();
      txt('SALA DEL REACTOR  →', 580, 60, 14, '#6c78c9');
      if (S.ph === 'hold') bar(300, 90, 360, 22, S.prog, '#4ff2a0');
      else for (let i = 0; i < 3; i++) { ctx.fillStyle = i < S.ok ? '#4ff2a0' : '#333a55'; ctx.fillRect(400 + i * 60, 90, 44, 22); }
      if (S.win > 0) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 0, W, H); txt('¡AHORA! Pulsen E', W / 2, 220, 40, '#fff', 'center'); }
    }
  };
}
function panel(x, y, label) {
  ctx.fillStyle = '#252d5c'; ctx.fillRect(x - 28, y - 34, 56, 68);
  ctx.fillStyle = '#4ff2a0'; ctx.fillRect(x - 20, y - 26, 40, 22);
  ctx.fillStyle = '#ffd86b'; ctx.fillRect(x - 20, y + 4, 12, 8); ctx.fillRect(x + 8, y + 4, 12, 8);
  txt('PANEL ' + label, x, y - 42, 12, '#9fd0ff', 'center');
}

function obsScene(n) {
  return {
    title: 'Observatorio · Recuerdo ' + n, mode: 'g', band: [452, 522], music: 'observatorio',
    hint: 'Momento de respiro. Vayan juntos a la ventana (centro) y mantengan E para desbloquear un recuerdo.',
    init: () => ({ p: 0, ph: 'hold', sh: 0 }),
    tick(S, dt, P, tap) {
      if (S.ph === 'hold') {
        const at = P.every((p) => cx(p) > 320 && cx(p) < 640);
        if (at && P[0].e && P[1].e) S.p += dt / 2; else S.p = Math.max(0, S.p - dt * 0.5);
        S.msg = at ? 'Mantengan E juntos' : 'Acérquense a la ventana';
        if (S.p >= 1) { S.ph = 'show'; S.mem = MEM[G.mem % MEM.length]; G.mem++; S.sh = 0; }
      } else {
        S.sh += dt; S.msg = S.sh > 3 ? 'Pulsen E para continuar' : '';
        if (S.sh > 3 && (tap[0] || tap[1])) S.done = true;
      }
    },
    draw(S) {
      bg('observatorio'); deck(440);
      ctx.fillStyle = 'rgba(159,208,255,.10)'; ctx.fillRect(320, 20, 320, 450);
      if (S.ph === 'hold') bar(330, 130, 300, 18, S.p, '#9fd0ff');
      else {
        ctx.fillStyle = 'rgba(5,7,26,.85)'; ctx.fillRect(170, 120, 620, 190);
        ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 3; ctx.strokeRect(170, 120, 620, 190);
        txt('★ Recuerdo desbloqueado ★', W / 2, 160, 18, '#ffd86b', 'center');
        wrap(S.mem, W / 2, 205, 560, 26, 20, '#fff', 'center');
      }
    }
  };
}

const BASE = [
  reactorScene('Acto 1 · Despertar', 'Ambos a la sala del reactor (derecha). Mantengan E juntos y luego pulsen E a la vez cuando destelle.'),
  {
    title: 'Acto 1 · Gravedad cero', gives: 'Motor', mode: 'z', wall: 480,
    hint: 'Sin gravedad. El PATO opera el panel izquierdo y el GATO el derecho: crucen con Q (intercambiar) o T (teletransporte). Mantengan E.',
    spawn: (i) => (i ? [130, 250] : [770, 250]),
    init: () => ({ p: 0 }),
    tick(S, dt, P) {
      const a = Math.hypot(cx(P[0]) - 150, cy(P[0]) - 282) < 90 && P[0].e;
      const b = Math.hypot(cx(P[1]) - 810, cy(P[1]) - 282) < 90 && P[1].e;
      if (a && b) { S.p += dt / 2.5; S.msg = 'Reiniciando generador...'; }
      else { S.p = Math.max(0, S.p - dt * 0.5); S.msg = a || b ? 'Falta tu pareja en el otro panel' : 'Cada uno en su panel, manteniendo E'; }
      if (S.p >= 1) { S.done = true; S.msg = '¡Generador reiniciado! Motor básico instalado'; }
    },
    draw(S) {
      bg('estacion'); const t = performance.now();
      ctx.fillStyle = 'rgba(120,200,255,' + (0.25 + 0.1 * Math.sin(t / 150)) + ')'; ctx.fillRect(476, 0, 8, H - 70);
      txt('CAMPO DE FUERZA', 480, 200, 12, '#9fd0ff', 'center');
      panel(150, 282, 'IZQ (PATO)'); panel(810, 282, 'DER (GATO)');
      for (let i = 0; i < 10; i++) { ctx.fillStyle = '#6c78c9'; ctx.fillRect((i * 97 + t / 40) % W, 100 + ((i * 53) % 300) + Math.sin(t / 500 + i) * 14, 8, 8); }
      bar(330, 80, 300, 18, S.p, '#4ff2a0');
    }
  },
  {
    title: 'Acto 2 · Lluvia de asteroides', gives: 'Casco', mode: 'g', nojump: true, noTp: true,
    hint: 'GATO (exterior, arriba): coloca una placa con E donde caerá cada asteroide. PATO (interior, abajo): sella las grietas con E. Pulsen V para ver el otro lado.',
    band: (i) => (i ? [226, 262] : [445, 520]), spawn: (i) => [400, (i ? 244 : 490) - PH],
    init: () => ({ hp: 5, n: 0, next: 2, ev: [], cr: [] }),
    tick(S, dt, P, tap) {
      S.next -= dt;
      if (S.n < 10 && S.next <= 0) { S.n++; S.next = 3; S.ev.push({ x: rnd(100, 860), t: 3, pl: 0 }); }
      if (tap[1]) S.ev.forEach((e) => { if (!e.pl && !e.h && Math.abs(e.x - cx(P[1])) < 70) e.pl = 1; });
      S.ev.forEach((e) => { e.t -= dt; if (e.t <= 0 && !e.h) { e.h = 1; if (!e.pl) S.cr.push({ x: e.x, l: 4 }); } });
      S.ev = S.ev.filter((e) => !(e.h && e.t < -0.8));
      if (tap[0]) { const k = S.cr.findIndex((c) => Math.abs(c.x - cx(P[0])) < 70); if (k >= 0) S.cr.splice(k, 1); }
      S.cr.forEach((c) => (c.l -= dt));
      const lost = S.cr.filter((c) => c.l <= 0).length;
      if (lost) { S.hp -= lost; S.cr = S.cr.filter((c) => c.l > 0); }
      if (S.hp <= 0) { retry('El casco cedió. Una zona se destruyó', 1); return; }
      if (S.n >= 10 && !S.ev.length && !S.cr.length) { S.done = true; S.msg = '¡Casco reforzado!'; }
      else S.msg = 'Asteroides: ' + S.n + '/10';
    },
    draw(S) {
      if (ready(IMG.espacio)) ctx.drawImage(IMG.espacio, 0, 0, W, H, 0, 0, W, 270); else { ctx.fillStyle = '#04061a'; ctx.fillRect(0, 0, W, 270); }
      if (ready(IMG.estacion)) ctx.drawImage(IMG.estacion, 0, 0, W, H, 0, 270, W, 270); else { ctx.fillStyle = '#161d44'; ctx.fillRect(0, 270, W, 270); }
      ctx.fillStyle = '#ffd86b'; ctx.fillRect(0, 268, W, 4);
      S.ev.forEach((e) => {
        if (!e.h) {
          ctx.strokeStyle = e.pl ? '#4ff2a0' : '#ff5c5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, 244, (18 + e.t * 14) * 1.5, (18 + e.t * 14) * 0.4, 0, 0, 7); ctx.stroke();
          txt(e.t.toFixed(1), e.x, 200, 14, '#fff', 'center');
          ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.arc(e.x, 20 + (1 - e.t / 3) * 215, 12, 0, 7); ctx.fill();
        } else if (!e.pl) { ctx.fillStyle = 'rgba(255,200,100,.5)'; ctx.fillRect(e.x - 40, 234, 80, 22); }
        if (e.pl) { ctx.fillStyle = '#4ff2a0'; ctx.fillRect(e.x - 40, 246, 80, 8); }
      });
      S.cr.forEach((c) => {
        ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 4; ctx.beginPath();
        ctx.moveTo(c.x, 300); ctx.lineTo(c.x + 14, 370); ctx.lineTo(c.x - 10, 430); ctx.lineTo(c.x + 8, 500); ctx.stroke();
        bar(c.x - 30, 282, 60, 8, c.l / 4, '#ff5c5c');
      });
      txt('EXTERIOR (GATO)', W - 12, 255, 12, '#9fd0ff', 'right'); txt('INTERIOR (PATO)', W - 12, 525, 12, '#9fd0ff', 'right');
    },
    post(S) {
      if (!vision) {
        const lane = me.idx ? 1 : 0;
        ctx.fillStyle = 'rgba(2,4,20,.93)'; ctx.fillRect(0, lane * 270, W, 270);
        txt('Pulsa V para ver lo que ve tu pareja', W / 2, lane * 270 + 140, 18, '#9fd0ff', 'center');
      }
      bar(330, 252, 300, 12, S.hp / 5, '#4ff2a0'); txt('CASCO', 322, 262, 11, '#fff', 'right');
    }
  },
  {
    title: 'Acto 3 · El exterior', gives: 'Navegación', mode: (i) => (i ? 'z' : 'g'), noTp: true, band: [438, 520], zy: [30, 390],
    hint: 'GATO sale a reparar la pieza (derecha): mantén E junto a ella. PATO controla desde el panel: mantén E = oxígeno, R = enfriar.',
    spawn: (i) => (i ? [100, 200] : [100, 428 - PH]),
    init: () => ({ o2: 100, tp: 25, rep: 0 }),
    tick(S, dt, P) {
      const nearC = cx(P[0]) < 300;
      S.o2 = clamp(S.o2 - 7 * dt + (nearC && P[0].e ? 22 * dt : 0), 0, 100);
      S.tp = clamp(S.tp + (cx(P[1]) > 380 ? 10 : -4) * dt - (nearC && P[0].r ? 26 * dt : 0), 0, 100);
      if (S.o2 <= 0 || S.tp >= 100) { retry(S.o2 <= 0 ? 'Sin oxígeno. Reintenten' : 'Sobrecalentamiento. Reintenten', 0); return; }
      const near = Math.hypot(cx(P[1]) - 860, cy(P[1]) - 230) < 80;
      if (near && P[1].e) S.rep += dt / 2.5; else S.rep = Math.max(0, S.rep - dt * 0.4);
      if (S.rep >= 1) { S.done = true; S.msg = '¡Pieza reparada! Navegación lista'; }
      else S.msg = near ? 'Reparando... mantén E' : 'Mantengan estables el oxígeno y la temperatura';
    },
    draw(S) {
      bg('espacio');
      ctx.fillStyle = 'rgba(255,220,120,.08)'; ctx.fillRect(380, 0, 580, 430); txt('ZONA SOLEADA: se calienta', 670, 120, 12, '#ffd86b', 'center');
      ctx.fillStyle = '#252d5c'; ctx.fillRect(60, 400, 200, 32); txt('PANEL VITAL', 160, 394, 11, '#9fd0ff', 'center');
      ctx.fillStyle = '#ffd86b'; ctx.fillRect(840, 215, 40, 30); ctx.strokeStyle = '#fff'; ctx.strokeRect(840, 215, 40, 30);
      bar(840, 190, 40, 8, S.rep, '#4ff2a0');
      const g = pos(1); ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(160, 420); ctx.quadraticCurveTo((160 + cx(g)) / 2, 440 + 40, cx(g), cy(g)); ctx.stroke();
      bar(12, 80, 160, 14, S.o2 / 100, S.o2 < 30 ? '#ff5c5c' : '#4fd0ff'); txt('OXÍGENO', 180, 92, 12, '#fff');
      bar(12, 104, 160, 14, S.tp / 100, S.tp > 70 ? '#ff5c5c' : '#ff9a5c'); txt('TEMPERATURA', 180, 116, 12, '#fff');
    }
  },
  reactorScene('Acto 3 · El reactor se desestabiliza', 'Al regresar, el reactor falla de nuevo. Ambos a la sala del reactor (derecha). Mantengan E y sincronícense.'),
  {
    title: 'Acto 4 · El monstruo', gives: 'Escudos', mode: 'g', noTp: true, band: [438, 520],
    hint: 'GATO (torreta, derecha): toca E rápido para distraer al gusano. PATO: corta cada tentáculo pulsando E 3 veces a su lado.',
    spawn: (i) => (i ? [820, 428 - PH] : [100, 428 - PH]),
    init: () => ({ hp: 5, ten: [], cut: 0, dist: 0, next: 1.5, n: 0 }),
    tick(S, dt, P, tap) {
      if (tap[1] && cx(P[1]) > 700) S.dist = Math.min(1, S.dist + 0.2);
      S.dist = Math.max(0, S.dist - 0.3 * dt);
      S.next -= dt;
      if (S.n < 8 && S.next <= 0) { S.n++; S.next = 2.4; S.ten.push({ x: rnd(80, 640), g: 0, h: 3 }); }
      S.ten.forEach((t) => (t.g += dt / (S.dist > 0.25 ? 10 : 4.5)));
      if (tap[0]) {
        const t = S.ten.find((q) => Math.abs(q.x - cx(P[0])) < 70);
        if (t) { t.h--; if (t.h <= 0) { S.cut++; S.ten = S.ten.filter((q) => q !== t); } }
      }
      const gone = S.ten.filter((t) => t.g >= 1).length;
      if (gone) { S.hp -= gone; S.ten = S.ten.filter((t) => t.g < 1); }
      if (S.hp <= 0) { retry('La estructura cedió. Una zona se destruyó', 1); return; }
      if (S.cut >= 8) { S.done = true; G.scars = 1; S.msg = '¡Gusano ahuyentado! Quedó una cicatriz en la estación'; }
      else S.msg = 'Tentáculos cortados: ' + S.cut + '/8';
    },
    draw(S) {
      bg('espacio'); const t = performance.now();
      S.ten.forEach((q) => {
        ctx.strokeStyle = q.g > 0.7 ? '#ff5c5c' : '#4aa86a'; ctx.lineWidth = 14; ctx.beginPath();
        ctx.moveTo(q.x, 120); ctx.quadraticCurveTo(q.x + Math.sin(t / 300 + q.x) * 30, 120 + q.g * 150, q.x, 150 + q.g * 270); ctx.stroke();
        txt('✂'.repeat(Math.max(0, q.h)), q.x, 110, 14, '#fff', 'center');
      });
      if (ready(IMG.gusano)) { const gw = 440, gh = gw * IMG.gusano.naturalHeight / IMG.gusano.naturalWidth; ctx.drawImage(IMG.gusano, 150 + S.dist * 330 + Math.sin(t / 80) * 4, 10, gw, gh); }
      ctx.fillStyle = '#252d5c'; ctx.fillRect(800, 396, 100, 36); ctx.fillStyle = '#9aa5e8'; ctx.fillRect(780, 380, 70, 14); txt('TORRETA', 850, 372, 11, '#9fd0ff', 'center');
      bar(12, 80, 160, 14, S.dist, '#ffd86b'); txt('DISTRACCIÓN', 180, 92, 12, '#fff');
      bar(12, 104, 160, 14, S.hp / 5, '#4ff2a0'); txt('ESTRUCTURA', 180, 116, 12, '#fff');
    }
  },
  {
    title: 'Acto 5 · Punto de quiebre', gives: 'Soporte vital', mode: 'g', noTp: true, blur: true, band: [420, 520],
    hint: 'PATO entra a la cámara (visión borrosa) y cambia el núcleo (derecha, mantén E). GATO lo guía y blinda las zonas con 1, 2 y 3 (la energía es limitada).',
    spawn: (i) => [60 + i * 40, FL - PH],
    init: () => ({ dose: 0, p: 0, en: 100, act: [0, 0, 0], sh: [0, 0, 0] }),
    tick(S, dt, P) {
      const bits = [0, 1, 2].map((i) => (P[1].k >> i) & 1), n = bits[0] + bits[1] + bits[2];
      if (n && S.en > 0) { S.en = Math.max(0, S.en - 25 * dt * n); S.sh = bits; }
      else { S.sh = [0, 0, 0]; if (!n) S.en = Math.min(100, S.en + 18 * dt); }
      S.act = [0, 1, 2].map((i) => ((S.t + i * 1.1) % 4.4 < 2.4 ? 1 : 0));
      const x = cx(P[0]); let hit = false;
      [0, 1, 2].forEach((i) => { if (x > 220 + i * 190 && x < 410 + i * 190 && S.act[i] && !S.sh[i]) hit = true; });
      S.dose = hit ? S.dose + 45 * dt : Math.max(0, S.dose - 20 * dt);
      if (S.dose >= 100) { retry('Demasiada radiación. Reintentando', 0); return; }
      if (x > 830 && P[0].e) S.p += dt / 2.5; else S.p = Math.max(0, S.p - dt * 0.4);
      if (S.p >= 1) { S.done = true; S.msg = '¡Núcleo cambiado! Soporte vital instalado'; }
      else S.msg = 'Cruzar la cámara y mantener E en el núcleo';
    },
    draw(S) {
      bg('reactor');
      if (me.idx === 1) [0, 1, 2].forEach((i) => {
        ctx.fillStyle = S.sh[i] ? 'rgba(79,208,255,.35)' : S.act[i] ? 'rgba(255,60,60,.35)' : 'rgba(255,255,255,.05)';
        ctx.fillRect(220 + i * 190, 40, 190, 430); txt('ZONA ' + (i + 1), 315 + i * 190, 70, 14, '#fff', 'center');
      });
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(880, 420, 26, 0, 7); ctx.fill(); txt('NÚCLEO', 880, 380, 12, '#ffe08a', 'center');
      bar(860, 440, 40, 8, S.p, '#4ff2a0');
    },
    post(S) {
      if (me.idx === 0) { bar(12, 80, 200, 14, S.dose / 100, '#ff5c5c'); txt('RADIACIÓN', 220, 92, 12, '#fff'); }
      else { bar(12, 80, 200, 14, S.en / 100, '#4fd0ff'); txt('ENERGÍA ESCUDOS (1·2·3)', 220, 92, 12, '#fff'); }
    }
  },
  reactorScene('Acto 6 · El escape', 'La estación se desintegra. Última estabilización: ambos a la sala del reactor, mantengan E y sincronícense. ¡Despeguen juntos!'),
  {
    title: 'Final', mode: 'g', custom: true, hint: '', init: () => ({}),
    tick() {},
    draw(S) {
      const t = S.t; ctx.fillStyle = '#03041a'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) { ctx.fillStyle = i % 3 ? '#fff' : '#9fd0ff'; if (Math.sin(t * 2 + i) > -0.3) ctx.fillRect((i * 137) % W, (i * 71) % H, 2, 2); }
      const z = t < 26 ? 1 : Math.max(0.5, 1 - (t - 26) * 0.02);
      ctx.save(); ctx.translate(W / 2, H * 0.62); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.62);
      if (ready(IMG.playa)) ctx.drawImage(IMG.playa, 0, 0, W, H);
      const u = Math.min(1, t / 4), sy = -200 + 590 * (1 - (1 - u) * (1 - u)), sx = 150;
      ctx.fillStyle = '#c9d0f0'; ctx.fillRect(sx, sy + 30, 50, 80);
      ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.moveTo(sx, sy + 30); ctx.lineTo(sx + 25, sy - 5); ctx.lineTo(sx + 50, sy + 30); ctx.fill();
      ctx.fillStyle = '#4fd0ff'; ctx.beginPath(); ctx.arc(sx + 25, sy + 55, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5c5c'; ctx.fillRect(sx - 14, sy + 85, 14, 25); ctx.fillRect(sx + 50, sy + 85, 14, 25);
      if (t < 4) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(sx + 8, sy + 110); ctx.lineTo(sx + 25, sy + 150 + Math.random() * 20); ctx.lineTo(sx + 42, sy + 110); ctx.fill(); }
      const gy = 500 - PH; let a = 300, b = 370;
      if (t >= 8 && t < 12) { const k = (t - 8) / 4; a = 300 + k * 30; b = 370 - k * 30; }
      if (t >= 12) { a = 330; b = 340; }
      if (t >= 16) { const k = Math.min(1, (t - 16) / 8); a = 330 + k * 230; b = 340 + k * 265; }
      const sit = t >= 24;
      if (t >= 4) { drawPlayer(a, gy + (sit ? 14 : 0), 1, 0, sit ? 0.85 : 1); drawPlayer(b, gy + (sit ? 14 : 0), -1, 1, sit ? 0.85 : 1); }
      if (t >= 12 && t < 18) for (let i = 0; i < 5; i++) txt('♥', (a + b) / 2 + 18 + Math.sin(t * 3 + i) * 22, gy - 10 - ((t * 40 + i * 30) % 110), 22, '#ff5c8a', 'center');
      ctx.restore();
      if (t >= 8 && t < 8.5) { ctx.fillStyle = 'rgba(255,255,255,' + (8.5 - t) * 2 + ')'; ctx.fillRect(0, 0, W, H); }
      if (t >= 12) setMusic('final');
      const cap = t < 4 ? 'La nave entra en la atmósfera terrestre...' : t < 8 ? 'Aterrizan de emergencia en una playa desierta, al anochecer' : t < 12 ? 'Se quitan los trajes y se miran...' : t < 16 ? 'Y se besan' : t < 24 ? 'Caminan hasta la orilla del mar' : t < 50 ? 'Se sientan juntos en la arena y miran las estrellas' : 'FIN';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 340, H - 90, 680, 40); txt(cap, W / 2, H - 64, 18, '#fff', 'center');
      if (t >= 34) {
        txt('Recuerdos desbloqueados: ' + G.mem + '/' + MEM.length, W / 2, 90, 18, '#ffd86b', 'center');
        txt(G.mem >= MEM.length ? 'Cada recuerdo brilla ahora en el cielo.' : 'Aún quedan estrellas por encender.', W / 2, 118, 16, '#fff', 'center');
        txt(G.destroyed ? 'La estación perdió ' + G.destroyed + ' zona(s), pero ustedes no.' : 'La estación quedó intacta.', W / 2, 144, 16, '#fff', 'center');
      }
    }
  }
];

// 14 escenas: 5 observatorios = los 5 recuerdos de memorias.json
const SCENES = [BASE[0], BASE[1], obsScene(1), BASE[2], obsScene(2), BASE[3], BASE[4], obsScene(3), BASE[5], obsScene(4), BASE[6], obsScene(5), BASE[7], BASE[8]];

// ---------- Flujo de escenas ----------
const IS_TOUCH = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
if (IS_TOUCH) document.body.classList.add('touch');
const bandOf = (sc, i) => { const b = typeof sc.band === 'function' ? sc.band(i) : sc.band; return b || [FL - 50, FL + 50]; };
// y = parte superior del cuerpo
function placeAt(x, y) {
  const sc = SCENES[sceneI];
  me.x = clamp(x, 0, W - PW); me.vx = 0; me.vy = 0; me.vz = 0; me.vd = 0; me.z = 0;
  if (modeOf(sc) === 'z') me.y = y;
  else { const b = bandOf(sc, me.idx); me.gy = clamp(y + PH, b[0], b[1]); me.y = me.gy - PH; }
}
function respawn() {
  const sc = SCENES[sceneI];
  const sp = sc.spawn ? sc.spawn(me.idx) : [100 + me.idx * 70, bandOf(sc, me.idx)[1] - 30 - PH];
  placeAt(sp[0], sp[1]); me.jb = 0; me.coy = 0;
}
function startScene() {
  const sc = SCENES[sceneI];
  S = isHost() ? Object.assign(sc.init(), { t: 0 }) : null;
  myRs = 0; lastEc = [me.ec, peer ? peer.ec : 0]; FX.length = 0; respawn(); refreshButtons(); setMusic(sc.music || null);
}
function retry(msg, destroy) {
  if (destroy) G.destroyed++;
  const rs = (S.rs || 0) + 1;
  S = SCENES[sceneI].init(); S.t = 0; S.rs = rs; S.msg = msg; respawn();
}
function hostTick(dt) {
  const sc = SCENES[sceneI];
  const op = peer || { x: -999, y: -999, e: 0, r: 0, k: 0, ec: 0 };
  const P = [me, op], tap = [me.ec !== lastEc[0], op.ec !== lastEc[1]];
  lastEc = [me.ec, op.ec];
  S.t += dt;
  if (!S.done && sc.tick) sc.tick(S, dt, P, tap);
  if (S.done && !S.fd) { S.fd = 1; S.dt = 0; if (sc.gives && !G.parts.includes(sc.gives)) G.parts.push(sc.gives); }
  if (S.done && S.fd) {
    S.dt += dt;
    if (S.dt > 2.2 && !S.adv && sceneI < SCENES.length - 1) { S.adv = 1; socket.emit('next', { scene: sceneI + 1, g: G }); }
  }
}

// ---------- Red ----------
const q = new URLSearchParams(location.search).get('sala');
if (q) document.getElementById('code').value = q;
function enterFS() {
  try {
    const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { const p = rq.call(el); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); }
  } catch (e) {}
}
document.getElementById('go').onclick = () => { if (IS_TOUCH) enterFS(); socket.emit('join', document.getElementById('code').value); };
socket.on('full', () => (document.getElementById('msg').textContent = 'Sala llena (máx. 2 jugadores)'));
socket.on('joined', (d) => {
  code = d.code; G = d.g; sceneI = d.scene;
  me = { idx: d.idx, x: 0, y: 0, gy: 0, z: 0, vx: 0, vy: 0, vz: 0, vd: 0, f: 1, ground: true, e: false, r: false, k: 0, ec: 0, jb: 0, coy: 0, jprev: false, an: 0, mv: 0, land: 0, t2: 0 };
  document.getElementById('lobby').style.display = 'none';
  document.body.classList.add('playing');
  startScene();
});
socket.on('count', (n) => { count = n; if (n < 2) peer = null; });
socket.on('peer', (p) => {
  if (!peer) { pd.x = p.x; pd.y = p.y; pd.gy = p.gy !== undefined ? p.gy : p.y + PH; pd.z = p.z || 0; pd.an = 0; pd.mv = 0; pd.t2 = 0; }
  peer = p;
});
socket.on('setpos', (p) => { if (!me || SCENES[sceneI].noTp) return; placeAt(p.x, p.y); });
socket.on('scene', (d) => { sceneI = d.scene; G = d.g; startScene(); });
socket.on('sc', (d) => {
  if (!me || isHost() || d.i !== sceneI) return;
  const old = S; S = d.s; G = d.g;
  if (old && SCENES[sceneI].custom && Math.abs(old.t - S.t) < 0.3) S.t = old.t;
  if ((S.rs || 0) !== myRs) { myRs = S.rs || 0; respawn(); }
});
setInterval(() => {
  if (!me) return;
  socket.emit('state', { x: me.x, y: me.y, gy: me.gy, z: me.z, f: me.f, idx: me.idx, e: me.e, r: me.r, k: me.k, ec: me.ec });
  if (isHost() && S && count >= 2) socket.emit('sc', { i: sceneI, s: S, g: G });
}, 50);

// ---------- Controles (teclado + joystick + botones) ----------
const joy = { ax: 0, ay: 0 };
function down(c) {
  if (keys[c]) return; keys[c] = true;
  if (!me) return;
  const sc = SCENES[sceneI];
  if (c === 'KeyE') me.ec++;
  if (c === 'KeyT' && peer && !sc.noTp) placeAt(peer.x + 40, peer.y);
  if (c === 'KeyQ' && !sc.noTp) socket.emit('swap');
  if (c === 'KeyV') vision = !vision;
}
const up = (c) => { keys[c] = false; };
addEventListener('keydown', (e) => { if (me && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); down(e.code); });
addEventListener('keyup', (e) => up(e.code));
addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); });

const BTN = {};
document.querySelectorAll('.tb').forEach((b) => {
  const c = b.dataset.k; BTN[c] = b;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} down(c); b.classList.add('on'); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => { up(c); b.classList.remove('on'); }));
});
function refreshButtons() {
  if (!me) return;
  const sc = SCENES[sceneI], t = sc.title, md = modeOf(sc), brk = /quiebre/.test(t) && me.idx === 1;
  const on = { KeyE: 1, Space: md === 'g' && !sc.nojump, KeyR: /exterior/.test(t) && me.idx === 0, KeyT: !sc.noTp, KeyQ: !sc.noTp, KeyV: /Lluvia/.test(t), Digit1: brk, Digit2: brk, Digit3: brk };
  Object.keys(BTN).forEach((c) => (BTN[c].style.display = on[c] ? 'flex' : 'none'));
}
const jz = document.getElementById('joy'), kn = document.getElementById('knob'); let jid = null;
const dz = (v) => (Math.abs(v) < 0.22 ? 0 : v);
function joyAt(e) {
  const r = jz.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  kn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; joy.ax = dz(dx / R); joy.ay = dz(dy / R);
}
function joyEnd() { jid = null; joy.ax = joy.ay = 0; kn.style.transform = 'translate(0,0)'; }
jz.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; try { jz.setPointerCapture(jid); } catch (x) {} joyAt(e); });
jz.addEventListener('pointermove', (e) => { if (e.pointerId === jid) joyAt(e); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => jz.addEventListener(ev, joyEnd));

// ---------- Física del jugador local ----------
function update(dt) {
  const sc = SCENES[sceneI], md = modeOf(sc);
  const L = keys.ArrowLeft || keys.KeyA, R = keys.ArrowRight || keys.KeyD, U = keys.ArrowUp || keys.KeyW, D = keys.ArrowDown || keys.KeyS;
  const ix = clamp((R ? 1 : 0) - (L ? 1 : 0) + joy.ax, -1, 1), iy = clamp((D ? 1 : 0) - (U ? 1 : 0) + joy.ay, -1, 1);
  const px = me.x;
  if (md === 'z') {
    me.vx += ix * 700 * dt; me.vy += iy * 700 * dt;
    const dr = Math.pow(0.3, dt); me.vx *= dr; me.vy *= dr;
    const sp = Math.hypot(me.vx, me.vy); if (sp > 260) { me.vx *= 260 / sp; me.vy *= 260 / sp; }
    me.x += me.vx * dt; me.y += me.vy * dt;
    const zy = sc.zy || [30, FL - PH]; me.y = clamp(me.y, zy[0], zy[1]);
    if (Math.abs(me.vx) > 5) me.f = me.vx > 0 ? 1 : -1;
    me.z = 0; me.mv = 0;
  } else {
    const b = bandOf(sc, me.idx), gr = me.z <= 0.01, k = gr ? 16 : 7;
    me.vx += (ix * 230 - me.vx) * Math.min(1, k * dt);
    me.vd += ((b[1] - b[0] < 20 ? 0 : iy * 135) - me.vd) * Math.min(1, k * dt);
    if (Math.abs(ix) > 0.05) me.f = ix > 0 ? 1 : -1;
    me.x += me.vx * dt; me.gy = clamp(me.gy + me.vd * dt, b[0], b[1]);
    // salto con "coyote time" y buffer
    const jp = !!keys.Space;
    if (jp && !me.jprev) me.jb = 0.13;
    me.jprev = jp; me.jb = Math.max(0, me.jb - dt);
    me.coy = gr ? 0.1 : Math.max(0, me.coy - dt);
    if (me.jb > 0 && me.coy > 0 && !sc.nojump) { me.vz = 640; me.z = 0.01; me.jb = 0; me.coy = 0; dust(me.x + PW / 2, me.gy, 4, 1.5); }
    if (me.z > 0 || me.vz > 0) {
      me.vz -= (jp ? 1700 : 3200) * dt; me.z += me.vz * dt;
      if (me.z <= 0) { me.z = 0; if (me.vz < -220) { me.land = 0.14; dust(me.x + PW / 2, me.gy, 5, 1.8); } me.vz = 0; }
    }
    me.land = Math.max(0, me.land - dt);
    me.y = me.gy - PH - me.z; me.ground = me.z <= 0.01;
    me.mv = Math.min(1, Math.hypot(me.vx, me.vd * 1.6) / 200);
    if (me.ground && me.mv > 0.08) me.an += dt * 14 * me.mv;
    me.t2 -= dt; if (me.ground && me.mv > 0.4 && me.t2 <= 0) { dust(me.x + PW / 2, me.gy, 1); me.t2 = 0.16; }
  }
  me.x = clamp(me.x, 0, W - PW);
  if (sc.wall !== undefined) {
    const w = sc.wall, a = px + PW / 2, bb = me.x + PW / 2;
    if (a < w && bb >= w) { me.x = w - PW / 2 - 1; me.vx = 0; }
    if (a > w && bb <= w) { me.x = w - PW / 2 + 1; me.vx = 0; }
  }
}
function stepPeer(dt) {
  const tg = peer.gy !== undefined ? peer.gy : peer.y + PH, ox = pd.x, og = pd.gy;
  pd.x += (peer.x - pd.x) * 0.3; pd.y += (peer.y - pd.y) * 0.3; pd.gy += (tg - pd.gy) * 0.3; pd.z += ((peer.z || 0) - pd.z) * 0.3; pd.f = peer.f;
  pd.mv = clamp(Math.hypot(pd.x - ox, (pd.gy - og) * 1.6) / Math.max(dt, 0.001) / 200, 0, 1);
  if (pd.z < 1) pd.an += dt * 14 * pd.mv;
  pd.t2 -= dt; if (pd.mv > 0.4 && pd.z < 1 && pd.t2 <= 0) { dust(pd.x + PW / 2, pd.gy, 1); pd.t2 = 0.16; }
}

// ---------- HUD y render ----------
const PARTS = ['Motor', 'Casco', 'Navegación', 'Escudos', 'Soporte vital'];
function hud(sc) {
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, 72); ctx.fillRect(W - 176, 0, 176, 140);
  txt(sc.title, 12, 22, 18, '#ffd86b');
  if (sc.hint) wrap(sc.hint, 12, 42, 740, 17, 14, '#cfd6ff', 'left');
  txt('NAVE', W - 12, 22, 13, '#9fd0ff', 'right');
  PARTS.forEach((p, i) => { const ok = G.parts.includes(p); txt((ok ? '✔ ' : '· ') + p, W - 12, 40 + i * 16, 13, ok ? '#4ff2a0' : '#6c78c9', 'right'); });
  if (G.destroyed) txt('Zonas destruidas: ' + G.destroyed, W - 12, 128, 12, '#ff5c5c', 'right');
  if (S && S.msg && !sc.custom) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 300, 78, 600, 34); txt(S.msg, W / 2, 101, 16, S.done ? '#4ff2a0' : '#ffd86b', 'center'); }
  if (!IS_TOUCH) {
    txt('Sala ' + code + ' · comparte: ' + location.origin + '?sala=' + code, 12, H - 22, 11, '#6c78c9');
    txt('Mover WASD/flechas (↑↓ profundidad) · Espacio saltar · E acción · R · T ir con pareja · Q intercambiar · V visión · 1 2 3', 12, H - 8, 11, '#6c78c9');
  } else if (count < 2) txt('Sala ' + code + ' · ' + location.origin + '?sala=' + code, 12, H - 10, 13, '#9fb0ff');
  if (count < 2) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(W / 2 - 220, 150, 440, 44); txt('Esperando a tu pareja...', W / 2, 179, 20, '#ffd86b', 'center'); }
}
function actorOpts(p, idx, mine) {
  const sc = SCENES[sceneI], md = mine ? modeOf(sc) : typeof sc.mode === 'function' ? sc.mode(idx) : sc.mode || 'g';
  if (md === 'z') return { noShadow: 1, bob: Math.sin(performance.now() / 400 + idx * 2) * 3 };
  const b = bandOf(sc, idx), th = b[1] - b[0], gy = p.gy !== undefined ? p.gy : p.y + PH, mv = p.mv || 0, z = p.z || 0, an = p.an || 0;
  let sx = 1, sy = 1;
  if (z > 0) { const st = clamp((p.vz || 0) / 900, -0.12, 0.14); sy = 1 + st; sx = 1 - st * 0.6; }
  else if (p.land > 0) { const l = p.land / 0.14; sy = 1 - 0.16 * l; sx = 1 + 0.12 * l; }
  return { gy, z, ds: th < 20 ? 1 : 0.86 + 0.26 * clamp((gy - b[0]) / th, 0, 1), bob: z > 0 ? 0 : Math.abs(Math.sin(an)) * 5 * mv, lean: (p.f || 1) * 0.07 * mv * Math.sin(an), sx, sy };
}
function drawActors() {
  drawFX();
  const L = [{ p: me, idx: me.idx, m: 1 }]; if (peer) L.push({ p: pd, idx: peer.idx, m: 0 });
  const gyOf = (p) => (p.gy !== undefined ? p.gy : p.y + PH);
  L.sort((a, b) => gyOf(a.p) - gyOf(b.p));
  L.forEach((a) => drawPlayer(a.p.x, a.p.y, a.p.f || 1, a.idx, 1, actorOpts(a.p, a.idx, a.m)));
}
function render() {
  const sc = SCENES[sceneI];
  if (!S) { ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, W, H); txt('Sincronizando con tu pareja...', W / 2, H / 2, 20, '#ffd86b', 'center'); return; }
  const blur = sc.blur && me.idx === 0;
  if (blur) ctx.filter = 'blur(5px)';
  sc.draw(S);
  if (!sc.custom) drawActors();
  ctx.filter = 'none';
  if (blur) { ctx.fillStyle = 'rgba(220,230,255,.18)'; ctx.fillRect(0, 0, W, H); }
  drawMotes(); ctx.drawImage(VIG, 0, 0);
  if (sc.post) sc.post(S);
  hud(sc);
}

// ---------- Bucle ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.filter = 'none'; ctx.clearRect(0, 0, W, H);
  if (me) {
    update(dt);
    me.e = !!keys.KeyE; me.r = !!keys.KeyR; me.k = (keys.Digit1 ? 1 : 0) | (keys.Digit2 ? 2 : 0) | (keys.Digit3 ? 4 : 0);
    if (peer) stepPeer(dt);
    stepFX(dt);
    if (isHost() && S && count >= 2) hostTick(dt);
    else if (!isHost() && S && SCENES[sceneI].custom) S.t += dt;
    render();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
