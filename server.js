const express = require('express');
const http = require('http');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let db = {
  users: [],
  singleUseCode: { code: "45567", used: false },
  chat: [],
  emojis: ['😀', '😂', '🔥', '💀', '👍', '🪙'],
  adminEmojis: [':bicho:', ':patio:', ':inutil:'],
  market: [
    { id: 1, type: 'extras', name: 'Llave Maestra 1', desc: 'Llave legendaria [item?_key1]', price: 1000, limited: false, copies: 0, endpoint: 'key1' }
  ],
  rolesBicho: [],
  events: [],
  missions: [
    { id: 1, text: 'Di hola en el chat', reward: 50, template: 'di hola en el chat' },
    { id: 2, text: 'Escribe en el chat', reward: 30, template: 'escribe en el chat' }
  ],
  keys: { key1: false, key2: false, key3: false }
};

// Anti-sleep ping cada 50 segundos para Render
const RENDER_URL = 'https://la-web-inutil-servidor-supongo.onrender.com';
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Anti-Sleep] Ping estado: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[Anti-Sleep] Error:', err.message);
  });
}, 50000);

// Rutas Principales
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'code.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/401', (req, res) => {
  res.status(401).send(`
    <body style="background:#111; color:#ff4444; font-family:sans-serif; text-align:center; padding-top:100px;">
      <h1>Error 401: No autorizado</h1>
      <p>Credenciales incorrectas o acceso denegado.</p>
      <a href="/" style="color:#fff; text-decoration:underline;">Volver al Login</a>
    </body>
  `);
});

// API Endpoints
app.get('/api/state', (req, res) => {
  res.json(db);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }
});

app.post('/api/register-owner', (req, res) => {
  const { code, username, password } = req.body;
  if (db.singleUseCode.used || db.singleUseCode.code !== code) {
    return res.status(400).json({ success: false, message: 'Código inválido o ya utilizado' });
  }
  db.singleUseCode.used = true;
  const newUser = {
    username,
    password,
    role: 'owner',
    coins: 500,
    pfp: 'https://via.placeholder.com/150',
    inventory: [],
    posts: [],
    comments: [],
    restrictions: { blockPosts: false, removeEmojis: false, removeShop: false, removeChat: false, removeJail: false }
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.post('/api/chat', (req, res) => {
  const { username, text } = req.body;
  const user = db.users.find(u => u.username === username);
  if (user && user.restrictions && user.restrictions.removeChat) {
    return res.status(403).json({ success: false, message: 'Chat bloqueado' });
  }
  const msg = { username, text, time: new Date().toLocaleTimeString() };
  db.chat.push(msg);
  res.json({ success: true, chat: db.chat });
});

app.post('/api/banquero/money', (req, res) => {
  const { username, amount } = req.body;
  const user = db.users.find(u => u.username === username);
  if (user) {
    user.coins += Number(amount);
    res.json({ success: true, user });
  } else {
    res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }
});

app.post('/api/admin/users', (req, res) => {
  const { username, password, restrictions, role } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: 'Ya existe' });
  }
  const newUser = {
    username,
    password,
    role: role || 'miembro',
    coins: 100,
    pfp: 'https://via.placeholder.com/150',
    inventory: [],
    posts: [],
    comments: [],
    restrictions: restrictions || {}
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.post('/api/admin/emojis', (req, res) => {
  const { emojiTag } = req.body;
  if (emojiTag && !db.adminEmojis.includes(emojiTag)) {
    db.adminEmojis.push(emojiTag);
  }
  res.json({ success: true, adminEmojis: db.adminEmojis });
});

app.post('/api/market/item', (req, res) => {
  const item = req.body;
  item.id = db.market.length + 1;
  db.market.push(item);
  res.json({ success: true, market: db.market });
});

app.post('/api/events', (req, res) => {
  db.events.push(req.body);
  res.json({ success: true, events: db.events });
});

app.post('/api/missions', (req, res) => {
  db.missions.push(req.body);
  res.json({ success: true, missions: db.missions });
});

app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false });
  if (user.restrictions && user.restrictions.blockPosts) {
    return res.status(403).json({ success: false });
  }
  user.posts.push({ content, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
