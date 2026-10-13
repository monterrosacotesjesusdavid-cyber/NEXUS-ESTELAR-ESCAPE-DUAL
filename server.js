const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const rooms = {};
const LAST = 9; // índice de la última escena

io.on('connection', (s) => {
  s.on('join', (raw) => {
    if (s.code) return;
    const code = String(raw || 'SALA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SALA';
    const r = rooms[code] || (rooms[code] = { players: {}, scene: 0, g: { parts: [], mem: 0, destroyed: 0, scars: 0 } });
    const ids = Object.keys(r.players);
    if (ids.length >= 2) return s.emit('full');
    const idx = ids.some((i) => r.players[i].idx === 0) ? 1 : 0;
    r.players[s.id] = { idx, x: 0, y: 0 };
    s.join(code);
    s.code = code;
    s.emit('joined', { idx, code, scene: r.scene, g: r.g });
    io.to(code).emit('count', Object.keys(r.players).length);
  });

  s.on('state', (p) => {
    const r = rooms[s.code];
    if (!r || !r.players[s.id] || !p) return;
    r.players[s.id].x = p.x;
    r.players[s.id].y = p.y;
    s.to(s.code).emit('peer', p);
  });

  s.on('sc', (d) => {
    const r = rooms[s.code];
    if (!r || !r.players[s.id] || r.players[s.id].idx !== 0 || !d) return;
    if (d.g) r.g = d.g;
    s.to(s.code).emit('sc', d);
  });

  s.on('next', (d) => {
    const r = rooms[s.code];
    if (!r || !r.players[s.id] || r.players[s.id].idx !== 0 || !d) return;
    if (typeof d.scene !== 'number' || d.scene < 0 || d.scene > LAST) return;
    r.scene = d.scene;
    if (d.g) r.g = d.g;
    io.to(s.code).emit('scene', { scene: r.scene, g: r.g });
  });

  s.on('swap', () => {
    const r = rooms[s.code];
    if (!r) return;
    const ids = Object.keys(r.players);
    if (ids.length < 2) return;
    const [a, b] = ids;
    const pa = { x: r.players[a].x, y: r.players[a].y };
    const pb = { x: r.players[b].x, y: r.players[b].y };
    io.to(a).emit('setpos', pb);
    io.to(b).emit('setpos', pa);
  });

  s.on('disconnect', () => {
    const r = rooms[s.code];
    if (!r) return;
    delete r.players[s.id];
    io.to(s.code).emit('count', Object.keys(r.players).length);
    if (!Object.keys(r.players).length) delete rooms[s.code];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Servidor en puerto ' + PORT));
