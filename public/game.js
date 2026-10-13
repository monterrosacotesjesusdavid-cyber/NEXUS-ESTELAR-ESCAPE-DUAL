// NEXUS ESTELAR: ESCAPE DUAL — versión 3D real (Three.js). Estilo low-poly industrial.
// El jugador 1 (PATO) es el "host" que simula la escena; el GATO la recibe. El servidor no cambia.
const cv = document.getElementById('c'), ctx = cv.getContext('2d'); // HUD 2D encima del 3D
const g3 = document.getElementById('g3');
const W = 960, H = 540, FL = 470, PW = 36, PH = 64;
cv.width = W; cv.height = H;
const socket = io();
const NAMES = ['PATO', 'GATO'];
let MEM = ['...'];
fetch('memorias.json').then((r) => r.json()).then((j) => { if (Array.isArray(j) && j.length) MEM = j; }).catch(() => {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const cx = (p) => p.x + PW / 2, cy = (p) => p.y + PH / 2;
const hs = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

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

// ---------- Utilidades de HUD (2D) ----------
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
const dust = () => {};
const VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
(() => { const g = VIG.getContext('2d'), r = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, W * 0.62); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,8,.6)'); g.fillStyle = r; g.fillRect(0, 0, W, H); })();

// ---------- Motor 3D ----------
const RW = 640, RH = 360; // resolución baja a propósito: look pixelado tipo PS1 / R.E.P.O.
const R = new THREE.WebGLRenderer({ canvas: g3, antialias: false });
R.setPixelRatio(1); R.setSize(RW, RH, false);
const T3 = new THREE.Scene();
const CAM = new THREE.PerspectiveCamera(50, RW / RH, 0.1, 400);
const CAMP = new THREE.Vector3(0, 4, 15), LOOK = new THREE.Vector3(0, 2, 0), TMP = new THREE.Vector3();
let camSnap = true;
let ROOT = null, SO = {}, FLK = [], ANIM = [];
const ZB = -4; // pared del fondo de las salas

// ---------- Texturas procedurales (sin imágenes) ----------
function mkTex(fn, s) {
  const c = document.createElement('canvas'); c.width = c.height = s || 64;
  const g = c.getContext('2d'); fn(g, c.width);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
const TX = {
  metal: mkTex((g, s) => {
    g.fillStyle = '#464e5e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { g.fillStyle = i % 3 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.07)'; g.fillRect(hs(i) * s, hs(i + 500) * s, 1 + (i % 2), 1 + (i % 3 === 0 ? 1 : 0)); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(150,72,28,.32)'; g.beginPath(); g.arc(hs(i * 7) * s, hs(i * 7 + 3) * s, 5 + hs(i) * 9, 0, 7); g.fill(); }
    g.strokeStyle = '#1a1f29'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
    g.fillStyle = '#9aa3b5'; [[5, 5], [s - 7, 5], [5, s - 7], [s - 7, s - 7]].forEach((p) => g.fillRect(p[0], p[1], 2, 2));
  }),
  floor: mkTex((g, s) => {
    g.fillStyle = '#343a48'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#14171f'; for (let i = 0; i < s; i += 8) { g.fillRect(i, 0, 2, s); g.fillRect(0, i, s, 2); }
    for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(hs(i + 9) * s, hs(i + 77) * s, 2, 2); }
    g.fillStyle = 'rgba(140,70,25,.25)'; g.beginPath(); g.arc(hs(3) * s, hs(8) * s, 14, 0, 7); g.fill();
  }),
  hazard: mkTex((g, s) => {
    g.fillStyle = '#e0a81c'; g.fillRect(0, 0, s, s); g.fillStyle = '#17171a';
    for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + 8, s); g.lineTo(i + 8 + s, 0); g.lineTo(i + s, 0); g.fill(); }
  }),
  sand: mkTex((g, s) => {
    g.fillStyle = '#cfae74'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? 'rgba(120,90,40,.22)' : 'rgba(255,240,200,.18)'; g.fillRect(hs(i) * s, hs(i + 40) * s, 2, 1); }
  })
};
const mt = (col, map, o) => new THREE.MeshPhongMaterial(Object.assign({ color: col, map: map || null, flatShading: true, shininess: 6 }, o || {}));
const bm = (col, o) => new THREE.MeshBasicMaterial(Object.assign({ color: col }, o || {}));

function boxG(w, h, d, ts) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
  return g;
}
function bx(p, w, h, d, m, x, y, z, ts) { const o = new THREE.Mesh(boxG(w, h, d, ts || 3), m); o.position.set(x, y, z); p.add(o); return o; }
function cyl(p, rt, rb, h, m, x, y, z, seg) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), m); o.position.set(x, y, z); p.add(o); return o; }
function sph(p, r, m, x, y, z, ws, hs2) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws || 8, hs2 || 6), m); o.position.set(x, y, z); p.add(o); return o; }
function seg(p, x1, y1, x2, y2, z, th, m) { const L = Math.hypot(x2 - x1, y2 - y1), b = bx(p, L, th, th, m, (x1 + x2) / 2, (y1 + y2) / 2, z, 1); b.rotation.z = Math.atan2(y2 - y1, x2 - x1); return b; }
function lamp(p, x, y, z, col, I, dist, flick) {
  const l = new THREE.PointLight(col, I, dist, 1.5); l.position.set(x, y, z); p.add(l);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.35), bm(col)); m.position.set(x, y + 0.3, z); p.add(m);
  l.userData.m = m;
  if (flick) FLK.push({ l, b: I, p: hs(x * 3 + y) * 9, f: 0.7 + hs(x) * 2 });
  return l;
}
function signMesh(root, text, x, y, z, w, h, col, bg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg || '#10131c'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = col || '#ffb347'; g.lineWidth = 4; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.fillStyle = col || '#ffb347'; g.font = 'bold ' + Math.round(c.height * 0.42) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); root.add(m); return m;
}
const HEART = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff5c8a'; g.fillText('\u2665', 32, 36); return new THREE.CanvasTexture(c); })();
const STAR = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, 'rgba(255,248,200,1)'); r.addColorStop(0.3, 'rgba(255,216,107,.8)'); r.addColorStop(1, 'rgba(255,216,107,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function makeHearts(root, n) {
  const a = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HEART, transparent: true, depthTest: false, fog: false })); s.visible = false; s.scale.set(0.6, 0.6, 1); s.renderOrder = 20; root.add(s); a.push(s); }
  return a;
}
function floatHearts(a, x, y, z, t, on) {
  a.forEach((s, i) => { s.visible = on; if (!on) return; const k = (t * 0.9 + i * 0.5) % 2.2; s.position.set(x + Math.sin(t * 3 + i * 2) * 0.7, y + k, z + Math.cos(t * 2 + i) * 0.3); s.material.opacity = 1 - k / 2.2; });
}

// ---------- Kit espacial ----------
function stars(root, n, r, up) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = up ? 0.06 + hs(i * 1.7 + 1) * 0.94 : hs(i * 1.7 + 1) * 2 - 1, th = hs(i * 3.1 + 2) * Math.PI * 2, s = Math.sqrt(1 - u * u), c = i % 4 === 0 ? [0.62, 0.8, 1] : i % 7 === 0 ? [1, 0.85, 0.6] : [1, 1, 1], b = 0.5 + hs(i) * 0.5;
    pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false }));
  root.add(p); return p;
}
function planet(root, x, y, z, r) {
  const tex = mkTex((g, s) => {
    g.fillStyle = '#1d57b0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? '#3f8a4a' : '#2f6f3a'; g.beginPath(); g.arc(hs(i * 5) * s, hs(i * 5 + 1) * s, 6 + hs(i) * 16, 0, 7); g.fill(); }
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(hs(i * 9) * s, hs(i * 9 + 4) * s, 10 + hs(i) * 16, 3 + hs(i + 3) * 4, 0, 0, 7); g.fill(); }
  }, 128);
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshPhongMaterial({ map: tex, shininess: 4, emissive: 0x0a1630, fog: false }));
  m.position.set(x, y, z); root.add(m);
  const a = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.22, side: THREE.BackSide, fog: false }));
  a.position.copy(m.position); root.add(a);
  ANIM.push((dt) => { m.rotation.y += dt * 0.02; });
  return m;
}
function motes(root, n, x0, x1, y1) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = x0 + hs(i) * (x1 - x0); pos[i * 3 + 1] = hs(i + 50) * y1; pos[i * 3 + 2] = -3 + hs(i + 90) * 9; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.45, fog: false, depthWrite: false })));
  ANIM.push((dt) => {
    const a = g.attributes.position.array;
    for (let i = 0; i < n; i++) { a[i * 3] += dt * 0.12 * (1 + (i % 3)); a[i * 3 + 1] += dt * 0.08; if (a[i * 3] > x1) a[i * 3] = x0; if (a[i * 3 + 1] > y1) a[i * 3 + 1] = 0.2; }
    g.attributes.position.needsUpdate = true;
  });
}

// ---------- Estación (sala modular sucia, estilo R.E.P.O.) ----------
function station(root, o) {
  o = Object.assign({ x0: -13, x1: 13, h: 6.5, zf: 8, tint: 0x8892a8, floorTint: 0x8a92a6, lamps: [-9, -3, 3, 9], lc: 0xffe0a8, seed: 1, noBack: false, noRight: false, noCeil: false }, o || {});
  const w = o.x1 - o.x0, cxm = (o.x0 + o.x1) / 2, dz = o.zf - ZB, zc = (o.zf + ZB) / 2;
  const metal = mt(o.tint, TX.metal), dark = mt(0x353b48, TX.metal);
  bx(root, w, 0.5, dz, mt(o.floorTint, TX.floor), cxm, -0.25, zc, 2);
  if (!o.noBack) bx(root, w, o.h, 0.5, metal, cxm, o.h / 2, ZB - 0.25, 3);
  if (!o.noCeil) bx(root, w, 0.5, dz, mt(0x555d6e, TX.metal), cxm, o.h + 0.25, zc, 3);
  bx(root, 0.5, o.h, dz, metal, o.x0 - 0.25, o.h / 2, zc, 3);
  if (!o.noRight) bx(root, 0.5, o.h, dz, metal, o.x1 + 0.25, o.h / 2, zc, 3);
  if (!o.noBack) bx(root, w, 0.5, 0.12, mt(0xffffff, TX.hazard), cxm, 0.25, ZB + 0.06, 0.5);
  for (let x = o.x0 + 2; x < o.x1; x += 6) bx(root, 0.55, o.h, 0.7, dark, x, o.h / 2, ZB + 0.35, 2);
  if (!o.noCeil) {
    [[0x7a4a2a, 0.22, 0.9], [0x58606e, 0.16, 1.6], [0x3a4a6a, 0.3, 2.3]].forEach((pp, i) => {
      const p = cyl(root, pp[1], pp[1], w, mt(pp[0], TX.metal), cxm, o.h - 0.5 - i * 0.12, ZB + pp[2], 8); p.rotation.z = Math.PI / 2;
      for (let x = o.x0 + 1.5; x < o.x1; x += 4.5) cyl(root, pp[1] * 1.3, pp[1] * 1.3, 0.2, dark, x, o.h - 0.5 - i * 0.12, ZB + pp[2], 8).rotation.z = Math.PI / 2;
    });
    for (let i = 0; i < 9; i++) { const len = 1 + hs(i * 3 + o.seed) * 2.5; cyl(root, 0.04, 0.04, len, bm(0x0d0d10), o.x0 + 2 + hs(i + o.seed) * (w - 4), o.h - len / 2, ZB + 1.2 + hs(i * 5) * 1.6, 4); }
  }
  const cols = [0x8a6a3a, 0x4d6b4a, 0x6b4a3a, 0x59627a];
  for (let i = 0; i < 7; i++) {
    const x = o.x0 + 1.5 + hs(i * 2.3 + o.seed) * (w - 3), s = 0.9 + hs(i + o.seed) * 0.9;
    if (i % 3 === 0) cyl(root, 0.45, 0.45, 1.1, mt(0x9c3a2a, TX.metal), x, 0.55, ZB + 1.1, 8);
    else bx(root, s, s * 0.9, s, mt(cols[i % 4], TX.metal), x, s * 0.45, ZB + 0.9 + s * 0.4, 1.2);
  }
  o.lamps.forEach((x, i) => lamp(root, x, o.h - 0.5, -0.5, i % 3 === 2 ? 0xff5a3c : o.lc, i % 3 === 2 ? 1.0 : 1.25, 17, true));
  addDamage(root, o);
}
function addDamage(root, o) {
  const red = bm(0xff4a3a);
  for (let k = 0; k < G.destroyed; k++) {
    const x = (((k * 277 + 90) % 780) + 75 - 480) / 40;
    bx(root, 4.2, o.h - 0.6, 0.2, mt(0x07070a), x, o.h / 2, ZB + 0.45, 1);
    for (let j = 0; j < 4; j++) seg(root, x + (j % 2 ? 0.7 : -0.7), o.h - 0.6 - j * 1.3, x + (j % 2 ? -0.7 : 0.7), o.h - 1.9 - j * 1.3, ZB + 0.6, 0.12, red);
    lamp(root, x, o.h - 1.3, ZB + 1.6, 0xff2a2a, 1.3, 9, true);
    for (let j = 0; j < 4; j++) bx(root, 0.5 + hs(k * 5 + j) * 0.7, 0.4 + hs(k + j) * 0.4, 0.6, mt(0x2b2f38, TX.metal), x - 1.6 + j, 0.2, -2.6 + hs(j + k) * 1.1, 1);
  }
  if (G.scars) {
    const pts = [[300, 0], [380, 150], [330, 300], [430, 430]].map((q) => [(q[0] - 480) / 40, o.h - q[1] / 70]);
    for (let j = 0; j < 3; j++) seg(root, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], ZB + 0.7, 0.3, bm(0xff9a5c));
  }
}

// ---------- Personajes 3D (PATO y GATO) ----------
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(text, 64, 17); g.fillStyle = '#fff'; g.fillText(text, 64, 17);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false }));
  s.scale.set(1.6, 0.4, 1); s.renderOrder = 30; return s;
}
function makeChar(idx) {
  const g = new THREE.Group(), u = g.userData, B = new THREE.Group(); g.add(B); u.body = B;
  const skin = idx ? 0xf08f3c : 0xf6f3ea, suitC = idx ? 0x3a66c8 : 0xd8dce8, dark = idx ? 0x24407f : 0x8d93a6, acc = idx ? 0xffd86b : 0xff8a2b;
  const sm = mt(suitC), dm = mt(dark), am = mt(acc), km = mt(skin);
  u.suitM = sm; u.suitC = suitC;
  [-1, 1].forEach((s) => {
    const l = new THREE.Group(); l.position.set(s * 0.2, 0.55, 0); B.add(l);
    bx(l, 0.24, 0.5, 0.28, dm, 0, -0.25, 0, 1); bx(l, 0.3, 0.14, 0.44, am, 0, -0.52, 0.07, 1); u[s < 0 ? 'legL' : 'legR'] = l;
  });
  cyl(B, 0.36, 0.42, 0.72, sm, 0, 0.92, 0, 8); cyl(B, 0.44, 0.44, 0.1, am, 0, 0.62, 0, 8);
  u.pack = new THREE.Group(); u.pack.position.set(0, 0.95, -0.42); B.add(u.pack);
  bx(u.pack, 0.5, 0.58, 0.24, mt(0x555c6c, TX.metal), 0, 0, 0, 1); bx(u.pack, 0.34, 0.08, 0.04, bm(0x4ff2a0), 0, 0.12, -0.13, 1);
  [-1, 1].forEach((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.47, 1.18, 0); B.add(a);
    bx(a, 0.2, 0.52, 0.22, sm, 0, -0.24, 0, 1); sph(a, 0.14, am, 0, -0.55, 0, 6, 5); u[s < 0 ? 'armL' : 'armR'] = a;
  });
  const hd = new THREE.Group(); hd.position.y = 1.62; B.add(hd); u.head = hd;
  sph(hd, 0.43, km, 0, 0, 0, 9, 7);
  u.pup = [];
  [-1, 1].forEach((s) => { sph(hd, 0.12, bm(0xffffff), s * 0.16, 0.1, 0.36, 6, 5); u.pup.push(sph(hd, 0.055, bm(0x000000), s * 0.16, 0.1, 0.47, 5, 4)); });
  if (idx === 0) {
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), am); k.rotation.x = Math.PI / 2; k.position.set(0, -0.1, 0.5); hd.add(k);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), am); f.position.set(0, 0.5, -0.05); hd.add(f);
    bx(B, 0.3, 0.16, 0.3, am, 0, 0.7, -0.5, 1);
  } else {
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), km); e.position.set(s * 0.27, 0.46, 0); e.rotation.z = -s * 0.25; hd.add(e);
      const i = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), bm(0xff9ab0)); i.position.set(s * 0.27, 0.43, 0.06); i.rotation.z = -s * 0.25; hd.add(i);
      bx(hd, 0.34, 0.02, 0.02, bm(0xffffff), s * 0.36, -0.1, 0.42, 1);
    });
    sph(hd, 0.06, bm(0xff7a9a), 0, -0.05, 0.43, 5, 4);
    u.tail = new THREE.Group(); u.tail.position.set(0, 0.6, -0.4); B.add(u.tail);
    for (let i = 0; i < 4; i++) bx(u.tail, 0.14, 0.2, 0.14, i === 3 ? mt(0x5a3a1e) : km, 0, 0.1 + i * 0.17, -0.1 - i * 0.07 - (i > 1 ? (i - 1) * 0.1 : 0), 1);
  }
  u.helm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), new THREE.MeshPhongMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.22, shininess: 80, depthWrite: false }));
  hd.add(u.helm);
  const sp = new THREE.SpotLight(0xfff2cc, 1.4, 16, 0.5, 0.6, 1.2); sp.position.set(0, 1.55, 0.4); g.add(sp); sp.target.position.set(0, 0.5, 7); g.add(sp.target); u.spot = sp;
  const lb = makeLabel(NAMES[idx]); lb.position.set(0, 2.55, 0); g.add(lb);
  g.scale.setScalar(0.82); u.base = 0.82;
  return g;
}
function poseChar(c, o) {
  const u = c.userData, t = performance.now() / 1000, s = Math.sin(o.an || 0) * (o.mv || 0);
  if (o.sit) {
    u.legL.rotation.set(-1.45, 0, 0.12); u.legR.rotation.set(-1.45, 0, -0.12); u.armL.rotation.set(-0.5, 0, 0.1); u.armR.rotation.set(-0.5, 0, -0.1);
    u.body.position.y = -0.52; u.body.rotation.x = 0.06;
  } else if (o.float) {
    u.legL.rotation.set(0.35 + Math.sin(t * 1.3) * 0.15, 0, 0.25); u.legR.rotation.set(0.2 + Math.sin(t * 1.1) * 0.15, 0, -0.25);
    u.armL.rotation.set(0, 0, 0.9 + Math.sin(t * 1.5) * 0.15); u.armR.rotation.set(0, 0, -0.9 - Math.sin(t * 1.7) * 0.15);
    u.body.position.y = 0; u.body.rotation.x = 0.25 * Math.sin(t * 0.7 + (c.userData.seed || 0));
  } else {
    u.legL.rotation.set(s * 0.9, 0, 0); u.legR.rotation.set(-s * 0.9, 0, 0); u.armL.rotation.set(-s * 0.8, 0, 0); u.armR.rotation.set(s * 0.8, 0, 0);
    u.body.position.y = Math.abs(s) * 0.08; u.body.rotation.x = 0;
  }
  if (u.tail) u.tail.rotation.y = Math.sin(t * 4) * 0.4;
  u.pup.forEach((p) => { p.position.x += (Math.sign(p.position.x) * 0.16 - p.position.x) * 0.2 + Math.sin(t * 0.9) * 0.002; });
  const b = u.base; c.scale.set(b * (o.sx || 1), b * (o.sy || 1), b * (o.sx || 1));
  u.helm.visible = !!o.helm; u.helm.scale.setScalar(o.helmS || 1);
  u.pack.visible = o.pack !== false;
  u.spot.visible = !o.noFlash;
}

// ---------- Mundo 3D: mapeo de coordenadas lógicas (2D) a 3D ----------
const X = (px) => (px - 480) / 40;
const K = 1.6; // tamaño de celda en la nave
const modeFor = (sc, i) => (typeof sc.mode === 'function' ? sc.mode(i) : sc.mode || 'g');
const modeOf = (sc) => modeFor(sc, me.idx);
function wp(p, idx) {
  const sc = SCENES[sceneI], md = modeFor(sc, idx), x = X(p.x + PW / 2);
  if (md === 'z') return { x, y: (FL - (p.y + PH)) / 40, z: idx ? 0.45 : -0.45 };
  const gy = p.gy !== undefined ? p.gy : p.y + PH, zc = sc.zc ? sc.zc(idx) : FL;
  return { x, y: (p.z || 0) / 40 + (sc.lift ? sc.lift(idx) : 0), z: (gy - zc) / 30 };
}
const A3 = new THREE.Group(); T3.add(A3);
const P3 = [makeChar(0), makeChar(1)]; P3.forEach((c, i) => { c.userData.seed = i * 2; A3.add(c); });
function placeActors(dt) {
  const sc = SCENES[sceneI];
  [0, 1].forEach((idx) => {
    const c = P3[idx], mine = me && me.idx === idx, p = mine ? me : (peer && peer.idx === idx ? pd : null);
    if (!p || sc.hideActors) { c.visible = false; return; }
    const md = modeFor(sc, idx), ov = sc.actor && S ? sc.actor(idx, S, p) : null;
    let o = { mv: p.mv || 0, an: p.an || 0, helm: sc.helm ? sc.helm(idx) : false, noFlash: sc.noFlash };
    if (ov && ov.hide) { c.visible = false; return; }
    c.visible = true;
    if (ov) {
      c.position.set(ov.x, ov.y, ov.z); c.rotation.y = ov.ry;
      Object.assign(o, ov.o || {});
    } else if (md === 'n') {
      if (p.px === undefined) { c.visible = false; return; }
      c.position.set(p.px * K, 0, p.py * K); c.rotation.y = Math.atan2(Math.cos(p.a || 0), Math.sin(p.a || 0));
    } else {
      const w = wp(p, idx); c.position.set(w.x, w.y, w.z);
      const tg = (p.f || 1) > 0 ? 1.15 : -1.15; c.rotation.y += (tg - c.rotation.y) * Math.min(1, dt * 14);
      if (md === 'z') o.float = true;
      else if (mine) {
        if ((me.z || 0) > 0) { const st = clamp((me.vz || 0) / 900, -0.12, 0.14); o.sy = 1 + st; o.sx = 1 - st * 0.6; }
        else if (me.land > 0) { const l = me.land / 0.14; o.sy = 1 - 0.16 * l; o.sx = 1 + 0.12 * l; }
      }
    }
    poseChar(c, o);
  });
}

// ---------- Escenas ----------
function console3(root, x, z, col) {
  bx(root, 1.8, 1.0, 0.8, mt(0x2a3158, TX.metal), x, 0.5, z, 1.5);
  bx(root, 1.6, 0.9, 0.08, bm(col), x, 1.45, z - 0.1, 1).rotation.x = -0.45;
  bx(root, 1.4, 0.06, 0.3, bm(0xffd86b), x, 1.02, z + 0.25, 1);
}

function reactorScene(title, hint) {
  return {
    title, hint, mode: 'g', band: [420, 520], cam: { d: 15, h: 4.2, ly: 2.6 },
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
    build(root) {
      T3.background = new THREE.Color(0x0a0c18); T3.fog = new THREE.FogExp2(0x0a0c18, 0.022);
      root.add(new THREE.AmbientLight(0x4a5470, 0.9));
      station(root, { h: 7, lamps: [-10, -5, -1], seed: 3 });
      [0, 1, 2, 3].forEach((i) => console3(root, -10.5 + i * 2.9, ZB + 1.0, i % 2 ? 0x3fb6ff : 0x4ff2a0));
      bx(root, 0.25, 0.06, 12, bm(0xffd86b), 2, 0.03, 2, 1);
      signMesh(root, 'SALA DEL REACTOR >>', 5, 5.4, ZB + 0.05, 5.4, 0.9);
      cyl(root, 4.6, 4.8, 0.3, mt(0xffffff, TX.hazard), 8, 0.15, 0.2, 16);
      SO.cm = bm(0xff8a3c);
      SO.core = cyl(root, 1.1, 1.1, 6.2, SO.cm, 8, 3.4, 0.2, 10);
      SO.rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.14, 6, 18), SO.cm); r.rotation.x = Math.PI / 2; r.position.set(8, 1.8 + i * 1.6, 0.2); root.add(r); return r; });
      SO.rl = new THREE.PointLight(0xff7a30, 2.2, 24, 1.4); SO.rl.position.set(8, 3.4, 2.5); root.add(SO.rl);
      motes(root, 60, -13, 13, 7);
    },
    anim(S, dt, t) {
      SO.rings.forEach((r, i) => { r.rotation.y = Math.sin(t * (1 + i * 0.4) + i) * 0.35; r.rotation.x = Math.PI / 2 + Math.cos(t * (0.8 + i * 0.3)) * 0.2; r.position.y = 1.8 + i * 1.6 + Math.sin(t * 2 + i) * 0.08; });
      const win = S.win > 0, hold = S.ph === 'hold';
      SO.cm.color.setHex(S.done ? 0x4ff2ff : win ? 0xffffff : 0xff8a3c);
      SO.rl.color.setHex(S.done ? 0x4ff2ff : 0xff7a30);
      SO.rl.intensity = win ? 7 : 2.2 + (hold ? S.prog * 2 : 0) + Math.sin(t * 5) * 0.2;
      const p = 1 + Math.sin(t * 5) * 0.04 + (win ? 0.25 : 0) + (hold ? S.prog * 0.15 : 0);
      SO.core.scale.set(p, 1, p);
    },
    post(S) {
      if (S.ph === 'hold') bar(300, 122, 360, 22, S.prog, '#4ff2a0');
      else for (let i = 0; i < 3; i++) { ctx.fillStyle = i < S.ok ? '#4ff2a0' : '#333a55'; ctx.fillRect(400 + i * 60, 122, 44, 22); }
      if (S.win > 0) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 0, W, H); txt('¡AHORA! Pulsen E', W / 2, 250, 40, '#fff', 'center'); }
    }
  };
}

function obsScene(n) {
  return {
    title: 'Observatorio · Recuerdo ' + n, mode: 'g', band: [452, 522], music: 'observatorio', cam: { d: 15, h: 3.8, ly: 3.0 },
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
    build(root) {
      T3.background = new THREE.Color(0x05071a); T3.fog = new THREE.FogExp2(0x0a0c20, 0.016);
      root.add(new THREE.AmbientLight(0x6a74a8, 0.95));
      station(root, { h: 7, noBack: true, lamps: [-9, 9], lc: 0xffc890, seed: 5, tint: 0x6a7288 });
      const wall = mt(0x6a7288, TX.metal), frame = mt(0x2a3158, TX.metal);
      bx(root, 9, 7, 0.5, wall, -8.5, 3.5, ZB - 0.25, 3); bx(root, 9, 7, 0.5, wall, 8.5, 3.5, ZB - 0.25, 3);
      bx(root, 8, 1.2, 0.5, wall, 0, 0.6, ZB - 0.25, 3); bx(root, 8, 1.0, 0.5, wall, 0, 6.5, ZB - 0.25, 3);
      [-4, 4].forEach((x) => bx(root, 0.3, 5.0, 0.7, frame, x, 3.7, ZB, 2));
      bx(root, 8.6, 0.25, 0.9, frame, 0, 1.25, ZB + 0.1, 2); bx(root, 8.6, 0.25, 0.7, frame, 0, 6.0, ZB, 2);
      SO.glass = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.8), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.08, depthWrite: false }));
      SO.glass.position.set(0, 3.6, ZB); root.add(SO.glass);
      stars(root, 700, 120); planet(root, -18, 10, -70, 20);
      const neb = new THREE.Mesh(new THREE.SphereGeometry(30, 10, 8), new THREE.MeshBasicMaterial({ color: 0x6a3aa8, transparent: true, opacity: 0.2, fog: false, depthWrite: false })); neb.position.set(30, 22, -100); root.add(neb);
      // telescopio
      const tm = mt(0x59627a, TX.metal);
      for (let i = 0; i < 3; i++) { const l = cyl(root, 0.05, 0.05, 1.8, tm, -6.5 + Math.cos(i * 2.1) * 0.5, 0.9, -2.2 + Math.sin(i * 2.1) * 0.5, 5); l.rotation.z = Math.cos(i * 2.1) * 0.25; l.rotation.x = Math.sin(i * 2.1) * 0.25; }
      const tube = cyl(root, 0.3, 0.38, 3, mt(0xd8dce8), -6.5, 2.3, -2.2, 8); tube.rotation.z = 0.9; tube.rotation.x = -0.4;
      // bancas
      [-2.6, 2.6].forEach((x) => { bx(root, 2.6, 0.5, 0.9, mt(0x4a3a6a, TX.metal), x, 0.25, -1.2, 1.5); bx(root, 2.6, 0.7, 0.2, mt(0x4a3a6a, TX.metal), x, 0.75, -1.65, 1.5); });
      // luces de feria en el techo
      for (let i = 0; i < 18; i++) bx(root, 0.14, 0.14, 0.14, bm(i % 2 ? 0xffd86b : 0xff9ab0), -12 + i * 1.4, 6.2 + Math.sin(i) * 0.15, ZB + 1.5, 1);
      SO.beam = new THREE.Mesh(new THREE.PlaneGeometry(8, 9), bm(0x9fd0ff, { transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }));
      SO.beam.rotation.x = -Math.PI / 2; SO.beam.position.set(0, 0.03, ZB + 4.5); root.add(SO.beam);
      SO.star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), bm(0xffd86b)); SO.star.position.set(0, 3.3, -1.5); SO.star.visible = false; root.add(SO.star);
      SO.sl = new THREE.PointLight(0xffd86b, 0, 14); SO.sl.position.set(0, 3.3, -0.5); root.add(SO.sl);
      motes(root, 50, -13, 13, 7);
    },
    anim(S, dt, t) {
      const sh = S.ph === 'show';
      SO.glass.material.opacity = 0.08 + (sh ? 0.12 : S.p * 0.15) + Math.sin(t) * 0.01;
      SO.beam.material.opacity = 0.07 + (sh ? 0.25 : S.p * 0.2);
      SO.star.visible = sh; SO.star.rotation.y += dt * 1.5; SO.star.position.y = 3.3 + Math.sin(t * 2) * 0.2;
      SO.sl.intensity = sh ? 2.5 : S.p * 1.2;
    },
    post(S) {
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
    title: 'Acto 1 · Gravedad cero', gives: 'Motor', mode: 'z', wall: 480, cam: { d: 17, h: 5.4, ly: 4.8, fixed: 1 },
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
    build(root) {
      T3.background = new THREE.Color(0x070a1a); T3.fog = new THREE.FogExp2(0x070a1a, 0.02);
      root.add(new THREE.AmbientLight(0x56648a, 1.0));
      station(root, { h: 11, lamps: [-9, -3, 3, 9], lc: 0x9fc4ff, seed: 7 });
      SO.field = new THREE.Mesh(new THREE.BoxGeometry(0.12, 11, 9), new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0.22, depthWrite: false }));
      SO.field.position.set(0, 5.5, 2); root.add(SO.field);
      bx(root, 0.6, 0.5, 9.2, mt(0x333a4a, TX.metal), 0, 0.25, 2, 1); bx(root, 0.6, 0.5, 9.2, mt(0x333a4a, TX.metal), 0, 10.75, 2, 1);
      signMesh(root, 'CAMPO DE FUERZA', 0, 8.6, ZB + 0.05, 4.2, 0.6, '#9fd0ff');
      SO.pan = [-1, 1].map((s) => {
        const g = new THREE.Group(); g.position.set(s * 8.25, 4.7, -1.2); root.add(g);
        bx(g, 2.2, 2.2, 0.5, mt(0x2a3158, TX.metal), 0, 0, 0, 1);
        const scr = bx(g, 1.7, 1.0, 0.06, bm(0x1fa06a), 0, 0.35, 0.28, 1);
        bx(g, 0.5, 0.3, 0.06, bm(0xffd86b), -0.5, -0.6, 0.28, 1); bx(g, 0.5, 0.3, 0.06, bm(0xffd86b), 0.5, -0.6, 0.28, 1);
        bx(g, 0.4, 0.4, 2.8, mt(0x59627a, TX.metal), 0, 0, -1.5, 1);
        signMesh(g, s < 0 ? 'PANEL IZQ (PATO)' : 'PANEL DER (GATO)', 0, 1.5, 0.05, 2.2, 0.4, '#9fd0ff');
        return scr;
      });
      SO.deb = [];
      for (let i = 0; i < 16; i++) { const m = bx(root, 0.2 + hs(i) * 0.4, 0.2 + hs(i + 3) * 0.3, 0.2, mt(0x8a7a6a, TX.metal), -11 + hs(i * 2) * 22, 1 + hs(i * 4) * 9, -2 + hs(i * 6) * 4, 1); m.userData.v = [(hs(i + 7) - 0.5) * 0.6, (hs(i + 9) - 0.5) * 0.4]; SO.deb.push(m); }
      motes(root, 70, -13, 13, 11);
    },
    anim(S, dt, t) {
      SO.field.material.opacity = 0.2 + Math.sin(t * 5) * 0.05;
      SO.pan.forEach((s) => s.material.color.setHex(S.p > 0.02 ? 0x4ff2a0 : 0x1fa06a));
      SO.deb.forEach((m, i) => {
        m.position.x += m.userData.v[0] * dt; m.position.y += m.userData.v[1] * dt; m.rotation.x += dt * 0.6; m.rotation.y += dt * 0.4;
        if (m.position.x > 12 || m.position.x < -12) m.userData.v[0] *= -1;
        if (m.position.y > 10 || m.position.y < 0.5) m.userData.v[1] *= -1;
      });
    },
    post(S) { bar(330, 122, 300, 18, S.p, '#4ff2a0'); }
  },
  {
    title: 'Acto 2 · Lluvia de asteroides', gives: 'Casco', mode: 'g', nojump: true, noTp: true,
    hint: 'GATO (exterior, arriba): coloca una placa con E donde caerá cada asteroide. PATO (interior, abajo): sella las grietas con E. Pulsen V para ver el otro lado.',
    band: (i) => (i ? [226, 262] : [445, 520]), spawn: (i) => [400, (i ? 244 : 490) - PH],
    zc: (i) => (i ? 244 : 490), lift: (i) => (i ? 7 : 0), helm: (i) => i === 1, cam: { d: 19, h: 3.6, ly: 3.6, fixed: 1 },
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
    build(root) {
      T3.background = new THREE.Color(0x030512); T3.fog = null;
      root.add(new THREE.AmbientLight(0x56648a, 0.95));
      const sun = new THREE.DirectionalLight(0xffe6b0, 0.7); sun.position.set(10, 20, 10); root.add(sun);
      station(root, { h: 6.3, lamps: [-9, -3, 3, 9], seed: 11 });
      bx(root, 26, 0.3, 11, mt(0x59627a, TX.metal), 0, 6.85, 2, 3);
      bx(root, 26, 0.1, 0.5, mt(0xffffff, TX.hazard), 0, 7.02, 6.5, 0.5);
      [-9, 8].forEach((x) => { bx(root, 4.2, 0.1, 2.6, mt(0x1c2f6e, TX.metal, { emissive: 0x0a1230 }), x, 8.2, -2, 1.5).rotation.z = 0.15; bx(root, 0.2, 1.2, 0.2, mt(0x59627a, TX.metal), x, 7.6, -2, 1); });
      cyl(root, 0.08, 0.08, 3.5, mt(0xd8dce8), -3.5, 8.7, -1.5, 5); sph(root, 0.25, bm(0xff5c5c), -3.5, 10.5, -1.5, 5, 4);
      stars(root, 600, 120); planet(root, 34, 20, -85, 24);
      SO.rocks = []; SO.rings = []; SO.plates = []; SO.flash = []; SO.cr = [];
      const pts = [[0, 6], [0.45, 4.6], [-0.35, 3.2], [0.4, 1.8], [0, 0.7]];
      for (let i = 0; i < 8; i++) {
        const g = new THREE.Group(), rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mt(0x8a7a6a)); g.add(rk); g.userData.rk = rk;
        const tr = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4, 6), bm(0xff9a3c, { transparent: true, opacity: 0.55 })); tr.position.y = 2.6; g.add(tr);
        g.rotation.z = -0.21; g.visible = false; root.add(g); SO.rocks.push(g);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 20), bm(0xff5c5c)); ring.rotation.x = Math.PI / 2; ring.visible = false; root.add(ring); SO.rings.push(ring);
        const pl = bx(root, 2, 0.12, 1.2, bm(0x4ff2a0), 0, 7.1, 0, 1); pl.visible = false; SO.plates.push(pl);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), bm(0xffc060, { transparent: true, opacity: 0.7 })); fl.visible = false; root.add(fl); SO.flash.push(fl);
        const cg = new THREE.Group(); cg.visible = false; root.add(cg);
        for (let j = 0; j < 4; j++) seg(cg, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], ZB + 0.55, 0.14, bm(0xff5c5c));
        cg.userData.bar = bx(cg, 1.4, 0.16, 0.05, bm(0x4ff2a0), 0, 6.4, ZB + 0.6, 1); SO.cr.push(cg);
      }
    },
    anim(S, dt, t) {
      const ev = S.ev || [], cr = S.cr || [];
      for (let i = 0; i < 8; i++) {
        const e = ev[i], rock = SO.rocks[i], ring = SO.rings[i], pl = SO.plates[i], fl = SO.flash[i];
        if (!e) { rock.visible = ring.visible = pl.visible = fl.visible = false; continue; }
        const x = X(e.x), k = clamp(e.t / 3, 0, 1), rr = (18 + Math.max(0, e.t) * 14) * 1.5 / 40;
        ring.visible = !e.h; ring.position.set(x, 7.06, 0); ring.scale.set(rr, rr, 1); ring.material.color.setHex(e.pl ? 0x4ff2a0 : 0xff5c5c);
        rock.visible = !e.h; rock.position.set(x + k * 3, 7.4 + k * 14, 0); rock.userData.rk.rotation.x += dt * 2; rock.userData.rk.rotation.z += dt * 1.3;
        pl.visible = !!e.pl; pl.position.x = x;
        const hit = e.h && !e.pl; fl.visible = !!hit;
        if (hit) { const kk = clamp(-e.t / 0.8, 0, 1); fl.position.set(x, 7.5, 0); fl.scale.setScalar(0.6 + kk * 2.6); fl.material.opacity = 0.8 * (1 - kk); }
      }
      SO.cr.forEach((g, i) => {
        const c = cr[i]; g.visible = !!c; if (!c) return;
        g.position.x = X(c.x); g.userData.bar.scale.x = Math.max(0.02, c.l / 4); g.userData.bar.material.color.setHex(c.l < 1.5 ? 0xff5c5c : 0x4ff2a0);
      });
    },
    post(S) {
      if (!vision) {
        const lane = me.idx ? 1 : 0;
        ctx.fillStyle = 'rgba(2,4,20,.93)'; ctx.fillRect(0, lane * 270, W, 270);
        txt('Pulsa V para ver lo que ve tu pareja', W / 2, lane * 270 + 140, 18, '#9fd0ff', 'center');
      }
      txt('EXTERIOR (GATO)', W - 12, 255, 12, '#9fd0ff', 'right'); txt('INTERIOR (PATO)', W - 12, 525, 12, '#9fd0ff', 'right');
      bar(330, 252, 300, 12, S.hp / 5, '#4ff2a0'); txt('CASCO', 322, 262, 11, '#fff', 'right');
    }
  },
  {
    title: 'Acto 3 · El exterior', gives: 'Navegación', mode: (i) => (i ? 'z' : 'g'), noTp: true, band: [438, 520], zy: [30, 390],
    hint: 'GATO sale a reparar la pieza (derecha): mantén E junto a ella. PATO controla desde el panel: mantén E = oxígeno, R = enfriar.',
    spawn: (i) => (i ? [100, 200] : [100, 428 - PH]), helm: (i) => i === 1, cam: { d: 17, h: 4.8, ly: 4.2, fixed: 1 },
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
    build(root) {
      T3.background = new THREE.Color(0x02030c); T3.fog = null;
      root.add(new THREE.AmbientLight(0x4a5470, 0.8));
      const sun = new THREE.DirectionalLight(0xffe0a0, 1.1); sun.position.set(14, 10, 8); root.add(sun);
      station(root, { x0: -13, x1: -3.5, h: 6.5, noRight: true, lamps: [-9, -5], seed: 13 });
      bx(root, 16.5, 0.5, 12, mt(0x8a92a6, TX.floor), 5.25, -0.25, 2, 2);
      bx(root, 16.5, 0.12, 0.12, mt(0xffd86b), 5.25, 1.1, 6.6, 1);
      for (let x = -2.5; x < 13.5; x += 3) bx(root, 0.12, 1.1, 0.12, mt(0xffd86b), x, 0.55, 6.6, 1);
      console3(root, -8, -1.2, 0x4ff2a0); signMesh(root, 'PANEL VITAL', -8, 2.4, -1.2, 2.4, 0.4, '#9fd0ff');
      stars(root, 700, 130); planet(root, -26, 18, -90, 22);
      sph(root, 7, bm(0xfff0b0, { fog: false }), 34, 24, -80, 14, 10);
      sph(root, 9.5, bm(0xffd080, { fog: false, transparent: true, opacity: 0.25, depthWrite: false }), 34, 24, -80, 14, 10);
      SO.piece = new THREE.Group(); SO.piece.position.set(9.5, 6, 0); root.add(SO.piece);
      bx(SO.piece, 1.6, 1.2, 1.2, mt(0xb0a070, TX.metal), 0, 0, 0, 1); bx(SO.piece, 3.2, 0.1, 1.5, mt(0x1c2f6e, TX.metal, { emissive: 0x0a1230 }), 1.8, 0.3, 0, 1).rotation.z = 0.3;
      cyl(SO.piece, 0.9, 0.2, 0.5, mt(0xd8dce8), -1.1, 0.8, 0, 8).rotation.z = 0.7;
      SO.pbar = bx(SO.piece, 1.6, 0.14, 0.06, bm(0x4ff2a0), 0, 1.2, 0.7, 1);
      lamp(root, 9.5, 6.4, 1.2, 0xffaa40, 1.3, 8, true);
      SO.tA = new THREE.Vector3(-8, 1.6, 0);
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
      SO.tl = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x9fd0ff })); SO.tl.frustumCulled = false; root.add(SO.tl);
      motes(root, 40, -13, 13, 9);
    },
    anim(S, dt, t) {
      SO.piece.rotation.y = Math.sin(t * 0.5) * 0.4; SO.piece.position.y = 6 + Math.sin(t * 1.2) * 0.15;
      SO.pbar.scale.x = Math.max(0.01, S.rep);
      const g = wp(pos(1), 1), a = SO.tA, b = TMP.set(g.x, g.y + 0.9, g.z), arr = SO.tl.geometry.attributes.position;
      for (let i = 0; i < 12; i++) { const u = i / 11; arr.setXYZ(i, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * 1.6, a.z + (b.z - a.z) * u); }
      arr.needsUpdate = true;
    },
    post(S) {
      if (S.tp > 60) { ctx.fillStyle = 'rgba(255,70,0,' + ((S.tp - 60) / 40) * 0.25 + ')'; ctx.fillRect(0, 0, W, H); }
      if (S.o2 < 30) { ctx.fillStyle = 'rgba(255,0,0,' + (0.1 + 0.08 * Math.sin(performance.now() / 150)) + ')'; ctx.fillRect(0, 0, W, H); }
      bar(12, 80, 160, 14, S.o2 / 100, S.o2 < 30 ? '#ff5c5c' : '#4fd0ff'); txt('OXÍGENO', 180, 92, 12, '#fff');
      bar(12, 104, 160, 14, S.tp / 100, S.tp > 70 ? '#ff5c5c' : '#ff9a5c'); txt('TEMPERATURA', 180, 116, 12, '#fff');
    }
  },
  reactorScene('Acto 3 · El reactor se desestabiliza', 'Al regresar, el reactor falla de nuevo. Ambos a la sala del reactor (derecha). Mantengan E y sincronícense.'),
  {
    title: 'Acto 4 · El monstruo', gives: 'Escudos', mode: 'g', noTp: true, band: [438, 520], cam: { d: 15, h: 4.2, ly: 3.2 },
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
    build(root) {
      T3.background = new THREE.Color(0x02030c); T3.fog = new THREE.FogExp2(0x03040e, 0.01);
      root.add(new THREE.AmbientLight(0x4a5470, 0.95));
      station(root, { h: 7, noBack: true, lamps: [-9, -2, 5, 10], seed: 17 });
      const wall = mt(0x8892a8, TX.metal), dk = mt(0x353b48, TX.metal);
      bx(root, 26, 1.2, 0.5, wall, 0, 0.6, ZB - 0.25, 3); bx(root, 26, 0.8, 0.5, wall, 0, 6.6, ZB - 0.25, 3);
      [-12.5, -4, 4, 12.5].forEach((x) => bx(root, 0.5, 7, 0.7, dk, x, 3.5, ZB, 2));
      stars(root, 700, 130); planet(root, -38, 14, -110, 22);
      SO.worm = new THREE.Group(); SO.worm.position.set(0, 4, -10); root.add(SO.worm);
      const wm = mt(0x4aa86a, null, { emissive: 0x0a2a14 });
      sph(SO.worm, 5, wm, 0, 0, 0, 12, 9);
      const mo = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.55, 6, 14), mt(0x8a2a3a)); mo.position.z = 4.2; SO.worm.add(mo);
      const di = new THREE.Mesh(new THREE.CircleGeometry(2.6, 14), bm(0x1a0408)); di.position.z = 4.3; SO.worm.add(di);
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 4), mt(0xf0ead0)); c.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 4.6); c.rotation.x = Math.PI / 2; SO.worm.add(c); }
      [-1, 1].forEach((s) => { sph(SO.worm, 0.7, bm(0xfff060), s * 2.9, 2.8, 3.4, 6, 5); sph(SO.worm, 0.3, bm(0x000000), s * 2.9, 2.8, 4.0, 5, 4); });
      SO.seg = [];
      for (let i = 0; i < 8; i++) SO.seg.push(sph(SO.worm, 4.4 - i * 0.38, wm, 0, 0, 0, 10, 8));
      // torreta
      const tu = new THREE.Group(); tu.position.set(X(850), 0, 0.6); root.add(tu);
      cyl(tu, 0.9, 1.1, 0.8, mt(0x59627a, TX.metal), 0, 0.4, 0, 8); bx(tu, 1.2, 0.6, 1.2, mt(0x2a3158, TX.metal), 0, 1.1, 0, 1);
      SO.barrel = new THREE.Group(); SO.barrel.position.set(0, 1.2, 0); SO.barrel.rotation.x = -0.7; tu.add(SO.barrel);
      cyl(SO.barrel, 0.2, 0.26, 2.4, mt(0xb0b6c8, TX.metal), 0, 1.2, 0, 8);
      SO.tl = new THREE.PointLight(0xffd86b, 0, 10); SO.tl.position.set(X(850), 3, 0); root.add(SO.tl);
      signMesh(root, 'TORRETA', X(850), 3.6, 0.6, 1.8, 0.4, '#9fd0ff');
      SO.ten = [];
      for (let i = 0; i < 8; i++) {
        const tg = new THREE.CylinderGeometry(0.5, 0.25, 1, 8); tg.translate(0, -0.5, 0);
        const g = new THREE.Group(), m = new THREE.Mesh(tg, mt(0x4aa86a, null, { emissive: 0x0a2a14 })); g.add(m); g.userData.m = m;
        g.position.set(0, 7, -1.2); g.visible = false; root.add(g); SO.ten.push(g);
      }
      motes(root, 50, -13, 13, 7);
    },
    anim(S, dt, t) {
      const sh = S.dist > 0.25 ? Math.sin(t * 30) * 0.12 : 0;
      SO.worm.position.set(X(150 + S.dist * 330 + 220) + sh, 4 + Math.sin(t * 0.8) * 0.4, -10);
      SO.seg.forEach((m, i) => m.position.set(5 + i * 3.4, Math.sin(t * 1.5 - i * 0.7) * 1.5, -(i + 1) * 1.4));
      SO.ten.forEach((g, i) => {
        const q = S.ten[i]; g.visible = !!q; if (!q) return;
        const len = 0.8 + q.g * 6.2, th = 0.6 + q.h * 0.25;
        g.position.x = X(q.x); g.scale.set(th, len, th); g.rotation.z = Math.sin(t * 3 + q.x) * 0.08 * q.g;
        g.userData.m.material.color.setHex(q.g > 0.7 ? 0xff5c5c : 0x4aa86a);
      });
      SO.tl.intensity = S.dist * 3; SO.barrel.rotation.x = -0.7 - S.dist * 0.15;
    },
    post(S) {
      bar(12, 80, 160, 14, S.dist, '#ffd86b'); txt('DISTRACCIÓN', 180, 92, 12, '#fff');
      bar(12, 104, 160, 14, S.hp / 5, '#4ff2a0'); txt('ESTRUCTURA', 180, 116, 12, '#fff');
    }
  },
  {
    title: 'Acto 5 · Punto de quiebre', gives: 'Soporte vital', mode: 'g', noTp: true, blur: true, band: [420, 520], cam: { d: 15, h: 4.2, ly: 2.8 },
    helm: (i) => i === 0,
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
    build(root) {
      T3.background = new THREE.Color(0x120608); T3.fog = new THREE.FogExp2(0x1a0a0a, 0.024);
      root.add(new THREE.AmbientLight(0x6a4a4a, 0.85));
      station(root, { h: 7.5, lamps: [-10, -4, 2, 8], lc: 0xff7a5a, seed: 23, tint: 0x8a7a80 });
      SO.zones = [0, 1, 2].map((i) => {
        const w = 190 / 40, m = new THREE.Mesh(new THREE.BoxGeometry(w, 6.2, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false }));
        m.position.set(X(220 + i * 190) + w / 2, 3.2, 0.6); root.add(m);
        bx(root, w, 0.4, 1.2, mt(0xffffff, TX.hazard), m.position.x, 7.2, ZB + 1.2, 0.5); return m;
      });
      signMesh(root, 'RADIACION', -1, 5.6, ZB + 0.05, 3.6, 0.7, '#ff5c5c');
      SO.core = sph(root, 0.9, bm(0xffe08a), 10, 1.6, 0.4, 10, 8);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 6, 16), bm(0xffb347)); rg.position.set(10, 1.6, 0.4); root.add(rg); SO.ring = rg;
      cyl(root, 1.7, 1.7, 0.4, mt(0xffffff, TX.hazard), 10, 0.2, 0.4, 14);
      SO.cl = new THREE.PointLight(0xffd070, 2, 18, 1.4); SO.cl.position.set(10, 2.2, 1.6); root.add(SO.cl);
      for (let i = 0; i < 4; i++) cyl(root, 0.35, 0.35, 5.5, bm(0x4ff2a0, { transparent: true, opacity: 0.5 }), 6.5 + i * 1.8, 2.9, ZB + 1.1, 8);
      motes(root, 60, -13, 13, 7);
    },
    anim(S, dt, t) {
      SO.zones.forEach((z, i) => {
        z.visible = me.idx === 1; const sh = S.sh[i], ac = S.act[i];
        z.material.color.setHex(sh ? 0x4fd0ff : ac ? 0xff3c3c : 0xffffff); z.material.opacity = sh ? 0.35 : ac ? 0.35 : 0.05;
      });
      SO.core.scale.setScalar(1 + Math.sin(t * 6) * 0.05 + S.p * 0.3); SO.cl.intensity = 2 + S.p * 3; SO.ring.rotation.x = t; SO.ring.rotation.y = t * 0.7;
    },
    post(S) {
      if (me.idx === 0) { bar(12, 80, 200, 14, S.dose / 100, '#ff5c5c'); txt('RADIACIÓN', 220, 92, 12, '#fff'); ctx.fillStyle = 'rgba(220,230,255,.14)'; ctx.fillRect(0, 0, W, H); }
      else { bar(12, 80, 200, 14, S.en / 100, '#4fd0ff'); txt('ENERGÍA ESCUDOS (1·2·3)', 220, 92, 12, '#fff'); }
      bar(W / 2 - 100, 122, 200, 14, S.p, '#4ff2a0'); txt('NÚCLEO', W / 2, 150, 12, '#ffe08a', 'center');
    }
  },
  reactorScene('Acto 6 · El escape', 'La estación se desintegra. Última estabilización: ambos a la sala del reactor, mantengan E y sincronícense. ¡Despeguen juntos!'),
  {
    title: 'Final', mode: 'g', custom: true, hint: '', init: () => ({}), hideActors: true,
    tick() {},
    build(root) {
      T3.background = new THREE.Color(0x1b1030); T3.fog = new THREE.Fog(0x2a1840, 50, 190);
      root.add(new THREE.AmbientLight(0x8c78b0, 0.95));
      const sun = new THREE.DirectionalLight(0xff9a6a, 0.8); sun.position.set(-20, 6, -30); root.add(sun);
      const sg = new THREE.SphereGeometry(220, 16, 12), pa = sg.attributes.position, cols = new Float32Array(pa.count * 3);
      const stops = [[-1, 0xff8a5c], [0, 0xff8a5c], [0.22, 0x6a3a8a], [0.55, 0x1a1650], [1, 0x05061a]];
      for (let i = 0; i < pa.count; i++) {
        const t = pa.getY(i) / 220; let c0 = stops[0], c1 = stops[stops.length - 1];
        for (let j = 0; j < stops.length - 1; j++) if (t >= stops[j][0] && t <= stops[j + 1][0]) { c0 = stops[j]; c1 = stops[j + 1]; break; }
        const a = new THREE.Color(c0[1]).lerp(new THREE.Color(c1[1]), clamp((t - c0[0]) / ((c1[0] - c0[0]) || 1), 0, 1));
        cols[i * 3] = a.r; cols[i * 3 + 1] = a.g; cols[i * 3 + 2] = a.b;
      }
      sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      root.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
      stars(root, 420, 200, true);
      sph(root, 7, bm(0xfff2cc, { fog: false }), 28, 52, -150, 14, 10);
      sph(root, 11, bm(0xfff2cc, { fog: false, transparent: true, opacity: 0.18, depthWrite: false }), 28, 52, -150, 14, 10);
      const seaG = new THREE.PlaneGeometry(420, 170, 36, 14); seaG.rotateX(-Math.PI / 2);
      SO.sb = Float32Array.from(seaG.attributes.position.array);
      SO.sea = new THREE.Mesh(seaG, new THREE.MeshPhongMaterial({ color: 0x1d3f7a, specular: 0xffb080, shininess: 60, flatShading: true }));
      SO.sea.position.set(0, -0.25, -93); root.add(SO.sea);
      SO.foam = bx(root, 420, 0.08, 1.2, bm(0xffffff, { transparent: true, opacity: 0.55 }), 0, 0.02, -8, 1);
      bx(root, 420, 0.5, 60, mt(0xffffff, TX.sand), 0, -0.25, 22, 8);
      [[-16, -2, 1], [14, 6, 1.1], [-24, 14, 0.9], [22, -4, 1.2]].forEach((q) => {
        cyl(root, 0.18, 0.3, 6 * q[2], mt(0x6a4a2a), q[0], 3 * q[2], q[1], 6).rotation.z = 0.12;
        for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set(q[0] + 0.7, 6 * q[2], q[1]); g.rotation.y = (i / 6) * Math.PI * 2; root.add(g); bx(g, 2.6, 0.08, 0.5, mt(0x2f6a3a), 1.3, 0, 0, 1).rotation.z = -0.35; }
      });
      for (let i = 0; i < 6; i++) sph(root, 0.6 + hs(i) * 0.9, mt(0x59525a), -26 + i * 11, 0.2, -3 + hs(i * 3) * 10, 6, 5);
      SO.ship = new THREE.Group(); SO.ship.position.set(-8, 0.1, 7); SO.ship.rotation.z = 0.1; SO.ship.scale.setScalar(1.2); root.add(SO.ship);
      cyl(SO.ship, 0.9, 1.1, 4.4, mt(0xc9d0f0), 0, 2.2, 0, 10);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 10), mt(0xff8a5c)); nose.position.y = 5.2; SO.ship.add(nose);
      sph(SO.ship, 0.45, bm(0x4fd0ff), 0, 3.4, 0.85, 8, 6);
      for (let i = 0; i < 3; i++) { const a = i * 2.094; bx(SO.ship, 0.15, 1.6, 1.2, mt(0xff5c5c), Math.cos(a) * 1.1, 0.8, Math.sin(a) * 1.1, 1).rotation.y = -a; }
      SO.flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 8), bm(0xffb347)); SO.flame.rotation.x = Math.PI; SO.flame.position.y = -1.2; SO.ship.add(SO.flame);
      SO.fc = [makeChar(0), makeChar(1)]; SO.fc.forEach((c) => { c.userData.spot.visible = false; c.visible = false; root.add(c); });
      SO.hearts = makeHearts(root, 6);
      SO.ms = [];
      for (let i = 0; i < G.mem; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: STAR, transparent: true, fog: false, depthWrite: false })); s.scale.set(10, 10, 1); s.position.set(-70 + i * 32, 70 + Math.sin(i * 2) * 16, -170); s.visible = false; root.add(s); SO.ms.push(s); }
    },
    anim(S, dt, t) {
      const T = S.t, k = (a, b) => clamp((T - a) / (b - a), 0, 1), ez = (v) => v * v * (3 - 2 * v);
      const arr = SO.sea.geometry.attributes.position;
      for (let i = 0; i < arr.count; i++) arr.setY(i, Math.sin(SO.sb[i * 3] * 0.12 + t * 1.1) * 0.22 + Math.cos(SO.sb[i * 3 + 2] * 0.25 + t * 0.9) * 0.18);
      arr.needsUpdate = true; SO.foam.position.z = -7.7 + Math.sin(t * 0.9) * 0.9;
      const u = Math.min(1, T / 4); SO.ship.position.y = 0.1 + 60 * (1 - u) * (1 - u); SO.flame.visible = T < 4; SO.flame.scale.y = 1 + Math.sin(t * 30) * 0.2;
      if (T >= 12) setMusic('final');
      const A = SO.fc[0], B = SO.fc[1];
      A.visible = B.visible = T >= 4;
      let ax = -5.2, az = 6.2, bxx = -3.4, bz = 6.2, ra = 0, rb = 0, mv = 0, sit = false;
      if (T >= 8) { const q = ez(k(8, 12)); ax = -5.2 + 0.5 * q; bxx = -3.4 - 0.5 * q; ra = Math.PI / 2; rb = -Math.PI / 2; }
      if (T >= 16) {
        const q = ez(k(16, 24)); ax = -4.7 + 6.1 * q; bxx = -3.9 + 6.4 * q; az = bz = 6.2 - 12.8 * q;
        ra = rb = Math.atan2(6.1, -12.8); mv = q < 1 ? 1 : 0;
      }
      if (T >= 24) { sit = true; ra = rb = Math.PI; mv = 0; }
      A.position.set(ax, 0, az); B.position.set(bxx, 0, bz); A.rotation.y = ra; B.rotation.y = rb;
      const suit = T < 8;
      A.userData.suitM.color.setHex(suit ? A.userData.suitC : 0xffd34d); B.userData.suitM.color.setHex(suit ? B.userData.suitC : 0xff7aa8);
      poseChar(A, { mv, an: T * 8, sit, helm: suit, pack: suit, noFlash: true }); poseChar(B, { mv, an: T * 8 + 1, sit, helm: suit, pack: suit, noFlash: true });
      floatHearts(SO.hearts, (ax + bxx) / 2, 1.8, az, t, (T >= 12 && T < 18) || (T >= 30 && T < 38));
      SO.ms.forEach((s, i) => { s.visible = T >= 34; s.material.opacity = clamp((T - 34) / 4, 0, 1) * (0.7 + 0.3 * Math.sin(t * 2 + i)); });
    },
    camFn(S) {
      const T = S.t;
      if (T < 16) return { p: [-1.5 + Math.sin(T * 0.2) * 0.4, 2.1, 13.5], l: [-4.2, 1.6, 6.5], fov: 48 };
      if (T < 24) { const q = (T - 16) / 8, mx = -4.3 + 6.3 * q, mz = 6.2 - 12.8 * q; return { p: [mx - 3 * (1 - q), 2.4, mz + 7.5], l: [mx, 1.5, mz], fov: 50 }; }
      const q = clamp((T - 26) / 24, 0, 1);
      return { p: [1.95 + 0.5 * Math.sin(T * 0.1), 1.9 + q * 5.5, -3.6 + q * 18], l: [1.95, 2.6 + q * 1.5, -9], fov: 50 + q * 8 };
    },
    post(S) {
      const t = S.t;
      if (t >= 8 && t < 8.5) { ctx.fillStyle = 'rgba(255,255,255,' + (8.5 - t) * 2 + ')'; ctx.fillRect(0, 0, W, H); }
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

// ---------- Acto 3a · Interior de la nave, caminable en 3D real ----------
const EVA = 1; // índice de quien sale al exterior: 0 = PATO, 1 = GATO
const HH = 3.1;
const NM = (() => {
  const m = Array.from({ length: 5 }, () => Array(25).fill(1));
  for (let y = 1; y < 4; y++) for (let x = 1; x < 21; x++) m[y][x] = 0;
  m[2][21] = 3; m[2][22] = m[2][23] = 0;               // esclusa
  for (let x = 2; x < 6; x++) m[0][x] = 2;               // casilleros de trajes
  m[0][17] = m[0][18] = 5;                               // panel de la esclusa
  for (let x = 11; x < 15; x++) m[4][x] = 4;             // ventana
  return m;
})();
const nSolid = (x, y) => { const t = (NM[Math.floor(y)] || [])[Math.floor(x)]; return t === undefined ? 1 : t === 3 ? !(S && S.door >= 1) : t !== 0; };
function nMove(dx, dy) {
  const r = 0.22, ok = (x, y) => !(nSolid(x - r, y - r) || nSolid(x + r, y - r) || nSolid(x - r, y + r) || nSolid(x + r, y + r));
  if (ok(me.px + dx, me.py)) me.px += dx; if (ok(me.px, me.py + dy)) me.py += dy;
}
const NAVE = {
  title: 'Acto 3 · Preparativos de la salida', mode: 'n', noTp: true, own: true,
  get hint() {
    if (!S || !me) return ''; const eva = me.idx === EVA, e = NAMES[EVA], o = NAMES[1 - EVA];
    return S.ph === 'walk' ? 'W/S caminar, A/D girar. Vayan los dos al cuarto de trajes (casilleros, izquierda). ' + e + ' mantiene E.' : S.ph === 'door' ? (eva ? 'Ve a la esclusa (derecha). ' + o + ' debe abrirte desde el panel.' : 'Ve al panel verde junto a la esclusa y mantén E para abrirle a ' + e + '.') : S.ph === 'out' ? (eva ? '' : 'Acércate a la ventana (pared sur, centro): ' + e + ' está afuera.') : '';
  },
  spawn: (i) => [2.5, i ? 3.2 : 1.8],
  init: () => ({ ph: 'walk', door: 0, pp: 0, ct: 0, lp: 0, suit: 0, out: 0, look: 0 }),
  tick(S, dt, P) {
    const near = (p, x, y, r) => p.px !== undefined && Math.hypot(p.px - x, p.py - y) < r, o = 1 - EVA;
    if (S.ph === 'walk') {
      if (P.every((p) => p.px < 7.5) && P[EVA].e) S.lp += dt / 1.5; else S.lp = Math.max(0, S.lp - dt);
      S.msg = S.lp > 0 ? 'Equipando traje...' : '';
      if (S.lp >= 1) { S.ph = 'cine'; S.ct = 0; S.msg = ''; }
    } else if (S.ph === 'cine') {
      S.ct += dt; if (S.ct >= 15) { S.ph = 'door'; S.suit = 1; }
    } else if (S.ph === 'door') {
      if (S.pp >= 1) S.door = Math.min(1, S.door + dt / 1.2);
      else if (near(P[o], 17.5, 1.2, 1.7) && P[o].e) S.pp = Math.min(1, S.pp + dt / 1.8); else S.pp = Math.max(0, S.pp - dt * 0.5);
      S.msg = S.door >= 1 ? '¡Esclusa abierta!' : '';
      if (S.door >= 1 && P[EVA].px > 22.3) { S.ph = 'out'; S.ct = 0; S.out = 1; S.msg = ''; }
    } else if (S.ph === 'out') {
      S.ct += dt; S.door = Math.max(0, S.door - dt * 0.8);
      if (near(P[o], 13, 3.2, 1.6)) S.look += dt; else S.look = Math.max(0, S.look - dt * 0.5);
      S.msg = S.look > 0 ? '♥' : '';
      if (S.look >= 3) { S.done = true; S.msg = '¡Se ven! Ahora, a reparar la pieza'; }
    }
  },
  helm: (i) => !!(S && S.suit && i === EVA),
  actor(idx, S) {
    const e = EVA, o = 1 - EVA, T = S.ct || 0, kk = (a, b) => clamp((T - a) / (b - a), 0, 1), ez = (v) => v * v * (3 - 2 * v);
    if (S.ph === 'cine') {
      const ex = 6.9, zz = 3.3;
      if (idx === e) {
        const hs3 = ez(kk(3, 5.5));
        return { x: ex, y: 0, z: zz, ry: T < 5.5 ? 0 : -Math.PI / 2, o: { helm: T > 3, helmS: 0.3 + 0.7 * hs3, noFlash: true } };
      }
      if (T < 5.5) return { hide: true };
      const w = kk(5.5, 8.5), nr = kk(8.5, 10);
      return { x: ex - 4.5 + 3.2 * w + 0.35 * nr, y: 0, z: zz, ry: Math.PI / 2, o: { mv: w < 1 ? 1 : 0, an: T * 10, noFlash: true } };
    }
    if (S.ph === 'out' && idx === e) return { x: 13 * K, y: 1.5 + Math.sin(performance.now() / 700) * 0.15, z: 10.6, ry: Math.PI, o: { float: true, helm: true } };
    return null;
  },
  camFn(S) {
    const T = S.ct || 0;
    if (S.ph === 'cine') return { p: [6.2 + Math.sin(T * 0.4) * 0.25, 1.8, 5.9], l: [6.0, 1.3, 3.2], fov: 46 };
    if (S.ph === 'out' && me.idx === EVA) { const t = performance.now() / 1000; return { p: [13 * K + 2.2 + Math.sin(t * 0.3) * 0.5, 2.6, 15.2], l: [13 * K, 2.0, 7.6], fov: 55 }; }
    const dx = Math.cos(me.a || 0), dz = Math.sin(me.a || 0), tx = me.px * K, tz = me.py * K;
    let d = 2.6; for (; d > 0.7; d -= 0.2) if (!nSolid((tx - dx * d) / K, (tz - dz * d) / K)) break;
    return { p: [tx - dx * d - dz * 0.3, 2.0, tz - dz * d + dx * 0.3], l: [tx + dx * 2.5, 1.2, tz + dz * 2.5], fov: 62 };
  },
  build(root) {
    T3.background = new THREE.Color(0x03041a); T3.fog = new THREE.FogExp2(0x0a0e20, 0.028);
    root.add(new THREE.AmbientLight(0x5a6890, 1.0));
    const metal = mt(0x6d7690, TX.metal), frame = mt(0x2a3158, TX.metal);
    bx(root, 25 * K, 0.4, 5 * K, mt(0x8890a8, TX.floor), 12.5 * K, -0.2, 2.5 * K, 1.6);
    bx(root, 25 * K, 0.4, 5 * K, mt(0x4a5266, TX.metal), 12.5 * K, HH + 0.2, 2.5 * K, 1.6);
    SO.pan = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 25; x++) {
      const t = NM[y][x]; if (t === 0 || t === 3) continue;
      const wx = (x + 0.5) * K, wz = (y + 0.5) * K;
      if (t === 4) { bx(root, K, 0.9, K, metal, wx, 0.45, wz, 1.6); bx(root, K, HH - 2.4, K, metal, wx, HH - (HH - 2.4) / 2, wz, 1.6); }
      else bx(root, K, HH, K, metal, wx, HH / 2, wz, 1.6);
    }
    // casilleros de trajes
    for (let x = 2; x < 6; x++) {
      bx(root, K * 0.85, HH * 0.8, 0.12, frame, (x + 0.5) * K, HH * 0.45, K + 0.06, 1);
      bx(root, K * 0.4, 0.35, 0.04, bm(0x6fd0ff), (x + 0.5) * K, HH * 0.68, K + 0.14, 1);
      if (x % 2 === 0) bx(root, 0.5, 1.1, 0.3, mt(0xd8dce8), (x + 0.5) * K, 1.1, K + 0.3, 1);
    }
    signMesh(root, 'TRAJES', 4 * K, HH - 0.35, K + 0.05, 3, 0.45);
    // panel de la esclusa
    [17, 18].forEach((x) => SO.pan.push(bx(root, K * 0.8, 0.9, 0.1, bm(0x1fa06a), (x + 0.5) * K, 1.3, K + 0.08, 1)));
    signMesh(root, 'ESCLUSA', 18 * K, HH - 0.35, K + 0.05, 3, 0.45, '#4ff2a0');
    // puerta de la esclusa
    SO.door = bx(root, K, HH, K * 0.9, mt(0xffffff, TX.hazard), 21.5 * K, HH / 2, 2.5 * K, 1);
    SO.dl = lamp(root, 20.4 * K, HH - 0.4, 2.5 * K, 0xff4a3a, 1.2, 8, false);
    // ventana (vidrio) y exterior del casco
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4 * K, 1.5), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(13 * K, 1.65, 4.5 * K); root.add(glass);
    bx(root, 4 * K + 0.3, 0.12, 0.3, frame, 13 * K, 0.95, 4.5 * K, 1); bx(root, 4 * K + 0.3, 0.12, 0.3, frame, 13 * K, 2.35, 4.5 * K, 1);
    bx(root, 25 * K, 0.25, 0.3, mt(0xffffff, TX.hazard), 12.5 * K, 0.3, 5 * K + 0.15, 0.5);
    for (let i = 0; i < 10; i++) bx(root, 0.2, 0.2, 0.1, bm(i % 3 ? 0x4ff2a0 : 0xff5c5c), (2 + i * 2.2) * K, 2.6 + (i % 2) * 0.2, 5 * K + 0.1, 1);
    [5, 21].forEach((x) => { cyl(root, 0.05, 0.05, 3, metal, x * K, HH + 1.5, 5 * K + 1, 5); sph(root, 0.15, bm(0xff5c5c), x * K, HH + 3.1, 5 * K + 1, 5, 4); });
    stars(root, 600, 130); planet(root, 26, 8, 85, 22);
    // luces
    [4.5, 11.5, 18].forEach((x) => lamp(root, x * K, HH - 0.5, 2.5 * K, 0xffe0b0, 1.2, 12, true));
    for (let x = 1; x < 21; x += 3) bx(root, 1.8, 0.08, 0.4, bm(0xdfe8ff), (x + 0.5) * K, HH - 0.04, 2.5 * K, 1);
    bx(root, 21 * K, 0.04, 0.12, bm(0xffd86b), 11.5 * K, 0.02, 2.5 * K, 1);
    SO.hearts = makeHearts(root, 6);
    motes(root, 50, 0, 40, HH);
  },
  anim(S, dt, t) {
    SO.door.position.y = HH / 2 + clamp(S.door || 0, 0, 1) * HH * 0.97;
    const c = S.door >= 1 ? 0x4ff2a0 : 0xff4a3a; SO.dl.color.setHex(c); SO.dl.userData.m.material.color.setHex(c);
    SO.pan.forEach((m) => m.material.color.setHex((S.pp || 0) > 0 ? 0x4ff2a0 : 0x1fa06a));
    const T = S.ct || 0;
    if (S.ph === 'cine') floatHearts(SO.hearts, 6.4, 1.6, 3.3, t, T > 10 && T < 14);
    else if (S.ph === 'out') floatHearts(SO.hearts, 13 * K, 2.0, 10.4, t, S.look > 0);
    else floatHearts(SO.hearts, 0, 0, 0, t, false);
  },
  post(S) {
    if (S.ph === 'walk' && S.lp > 0) bar(330, 130, 300, 18, S.lp, '#ffd86b');
    if (S.ph === 'door' && S.pp > 0 && S.door < 1) bar(330, 130, 300, 18, S.pp, '#4ff2a0');
    const T = S.ct || 0, e = EVA, o = 1 - EVA;
    if (S.ph === 'cine') {
      const cap = T < 3 ? NAMES[e] + ' se pone el traje...' : T < 5.5 ? 'Cierra el casco.' : T < 8.5 ? NAMES[o] + ' llega corriendo.' : T < 14 ? '"Vuelve conmigo."  Un beso, con el casco puesto.' : '';
      if (cap) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 340, H - 90, 680, 40); txt(cap, W / 2, H - 64, 18, '#fff', 'center'); }
      if (T > 14) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(T - 14, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
    } else if (S.ph === 'out' && me.idx === EVA) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 340, H - 90, 680, 40); txt('Estás afuera. ' + NAMES[o] + ' te mira desde la ventana.', W / 2, H - 64, 18, '#fff', 'center');
    }
  }
};

// 15 escenas: 5 observatorios = los 5 recuerdos de memorias.json
const SCENES = [BASE[0], BASE[1], obsScene(1), BASE[2], obsScene(2), NAVE, BASE[3], BASE[4], obsScene(3), BASE[5], obsScene(4), BASE[6], obsScene(5), BASE[7], BASE[8]];
const pos = (i) => (me.idx === i ? me : peer ? pd : { x: -99, y: -99 });

// ---------- Construcción y limpieza de la escena 3D ----------
function disposeTree(o) {
  o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose()); });
}
let builtKey = '';
function buildScene() {
  if (ROOT) { T3.remove(ROOT); disposeTree(ROOT); }
  FLK = []; ANIM = []; SO = {};
  ROOT = new THREE.Group(); T3.add(ROOT);
  T3.fog = null; T3.background = new THREE.Color(0x05071a);
  SCENES[sceneI].build(ROOT);
  builtKey = sceneI + ':' + G.destroyed + ':' + G.scars; camSnap = true;
}
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
  if (modeOf(sc) === 'n') { const q = sc.spawn(me.idx); me.px = q[0]; me.py = q[1]; me.a = 0; me.mv = 0; me.an = 0; return; }
  const sp = sc.spawn ? sc.spawn(me.idx) : [100 + me.idx * 70, bandOf(sc, me.idx)[1] - 30 - PH];
  placeAt(sp[0], sp[1]); me.jb = 0; me.coy = 0;
}
function startScene() {
  const sc = SCENES[sceneI];
  S = isHost() ? Object.assign(sc.init(), { t: 0 }) : null;
  myRs = 0; lastEc = [me.ec, peer ? peer.ec : 0]; respawn(); buildScene(); refreshButtons(); setMusic(sc.music || null);
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
  if (old && old.ct !== undefined && S.ct !== undefined && Math.abs(old.ct - S.ct) < 0.3) S.ct = old.ct;
  if ((S.rs || 0) !== myRs) { myRs = S.rs || 0; respawn(); }
});
setInterval(() => {
  if (!me) return;
  socket.emit('state', { x: me.x, y: me.y, gy: me.gy, z: me.z, f: me.f, idx: me.idx, e: me.e, r: me.r, k: me.k, ec: me.ec, px: me.px, py: me.py, a: me.a, mv: me.mv, an: me.an });
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
  if (md === 'n') {
    const fr = S && (S.ph === 'cine' || (S.ph === 'out' && me.idx === EVA)), sp = fr ? 0 : -iy * (iy < 0 ? 2.1 : 1.2);
    me.a = (me.a || 0) + (fr ? 0 : ix) * 2.3 * dt; nMove(Math.cos(me.a) * sp * dt, Math.sin(me.a) * sp * dt);
    me.mv = Math.min(1, Math.abs(sp) / 2.1); me.an += dt * 10 * me.mv; return;
  }
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
  if (peer.px !== undefined) {
    if (pd.px === undefined) { pd.px = peer.px; pd.py = peer.py; pd.a = peer.a || 0; }
    pd.px += (peer.px - pd.px) * 0.3; pd.py += (peer.py - pd.py) * 0.3; pd.a += Math.atan2(Math.sin((peer.a || 0) - pd.a), Math.cos((peer.a || 0) - pd.a)) * 0.35;
    pd.mv = peer.mv || 0; pd.an = peer.an || 0;
  }
}

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

// ---------- Cámara ----------
function updateCam(dt, sc) {
  let p, l, fov = 50;
  if (sc.camFn) { const r = sc.camFn(S, dt); p = r.p; l = r.l; fov = r.fov || 50; }
  else {
    const c = sc.cam || { d: 15, h: 4.2, ly: 2.6 };
    const a = wp(me, me.idx), b = peer ? wp(pd, peer.idx) : a, mx = c.fixed ? 0 : ((a.x + b.x) / 2) * 0.2;
    p = [mx, c.h, c.d]; l = [mx, c.ly, 0];
  }
  const k = camSnap ? 1 : 1 - Math.exp(-dt * 5);
  CAMP.lerp(TMP.set(p[0], p[1], p[2]), k); LOOK.lerp(TMP.set(l[0], l[1], l[2]), k); camSnap = false;
  CAM.position.copy(CAMP); CAM.lookAt(LOOK);
  if (Math.abs(CAM.fov - fov) > 0.01) { CAM.fov += (fov - CAM.fov) * (k > 0.99 ? 1 : 0.1); CAM.updateProjectionMatrix(); }
}

// ---------- Render ----------
function render(dt) {
  const sc = SCENES[sceneI], t = performance.now() / 1000;
  ctx.clearRect(0, 0, W, H);
  if (!S) {
    R.setClearColor(0x05071a); R.clear(); g3.style.filter = '';
    ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, W, H); txt('Sincronizando con tu pareja...', W / 2, H / 2, 20, '#ffd86b', 'center');
    return;
  }
  if (builtKey !== sceneI + ':' + G.destroyed + ':' + G.scars) buildScene();
  FLK.forEach((f) => { let k = 0.82 + 0.18 * Math.sin(t * f.f * 6 + f.p); if (hs(Math.floor(t * 8) + f.p) > 0.93) k *= 0.25; f.l.intensity = f.b * k; });
  ANIM.forEach((fn) => fn(dt, t));
  if (sc.anim) sc.anim(S, dt, t);
  placeActors(dt);
  updateCam(dt, sc);
  g3.style.filter = sc.blur && me.idx === 0 ? 'blur(3px) brightness(1.15)' : '';
  R.render(T3, CAM);
  ctx.drawImage(VIG, 0, 0);
  if (sc.post) sc.post(S);
  hud(sc);
}

// ---------- Bucle ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (me) {
    update(dt);
    me.e = !!keys.KeyE; me.r = !!keys.KeyR; me.k = (keys.Digit1 ? 1 : 0) | (keys.Digit2 ? 2 : 0) | (keys.Digit3 ? 4 : 0);
    if (peer) stepPeer(dt);
    if (isHost() && S && count >= 2) hostTick(dt);
    else if (!isHost() && S && SCENES[sceneI].custom) S.t += dt;
    else if (!isHost() && S && S.ph === 'cine' && S.ct !== undefined) S.ct += dt;
    render(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
