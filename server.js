const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let db = {
  users: [],
  singleUseCode: { code: "45567", used: false },
  chat: [],
  emojis: ['😀', '😂', '🔥', '💀', '👍', '🪙', '😎', '🎉'],
  adminEmojis: [':bicho:', ':patio:', ':inutil:'],
  market: [
    { id: 1, type: 'extras', name: 'Llave Maestra 1', desc: 'Llave legendaria [item?_key1]', price: 1000, limited: false, copies: 0, endpoint: 'key1' }
  ],
  rolesBicho: [],
  events: [],
  missions: [
    { id: 1, text: 'Di hola en el chat', reward: 50 },
    { id: 2, text: 'Escribe en el chat', reward: 30 }
  ],
  ideas: [],
  keys: { key1: false, key2: false, key3: false }
};

// Anti-sleep worker
const RENDER_URL = 'https://la-web-inutil-servidor-supongo.onrender.com';
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Anti-Sleep] Ping estado: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[Anti-Sleep] Error:', err.message);
  });
}, 50000);

// Vistas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'code.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/401', (req, res) => res.status(401).send('<h1>Error 401: No autorizado</h1><a href="/">Volver</a>'));

// Endpoints API
app.get('/api/state', (req, res) => res.json(db));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user) res.json({ success: true, user });
  else res.status(401).json({ success: false, message: 'Credenciales inválidas' });
});

app.post('/api/register-owner', (req, res) => {
  const { code, username, password } = req.body;
  if (db.singleUseCode.used || db.singleUseCode.code !== code) {
    return res.status(400).json({ success: false, message: 'Código inválido o ya utilizado' });
  }
  db.singleUseCode.used = true;
  const newUser = {
    username, password, role: 'owner', coins: 1000,
    pfp: 'https://via.placeholder.com/150', inventory: [], posts: [], comments: [],
    restrictions: { blockPosts: false, removeEmojis: false, removeShop: false, removeChat: false, removeJail: false }
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.post('/api/chat', (req, res) => {
  const { username, text } = req.body;
  const user = db.users.find(u => u.username === username);
  if (user && user.restrictions?.removeChat) {
    return res.status(403).json({ success: false, message: 'Chat bloqueado' });
  }
  db.chat.push({ username, text, time: new Date().toLocaleTimeString() });
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
  const { username, password, role } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: 'Ya existe' });
  }
  const newUser = {
    username, password, role: role || 'miembro', coins: 100,
    pfp: 'https://via.placeholder.com/150', inventory: [], posts: [], comments: [],
    restrictions: { blockPosts: false, removeEmojis: false, removeShop: false, removeChat: false, removeJail: false }
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.post('/api/admin/emojis', (req, res) => {
  const { emojiTag } = req.body;
  if (emojiTag && !db.adminEmojis.includes(emojiTag)) db.adminEmojis.push(emojiTag);
  res.json({ success: true, adminEmojis: db.adminEmojis });
});

app.post('/api/market/item', (req, res) => {
  const item = req.body;
  item.id = db.market.length + 1;
  db.market.push(item);
  res.json({ success: true, market: db.market });
});

app.post('/api/market/buy', (req, res) => {
  const { username, itemId } = req.body;
  const user = db.users.find(u => u.username === username);
  const item = db.market.find(i => i.id === Number(itemId));
  if (!user || !item) return res.status(404).json({ success: false, message: 'No encontrado' });
  if (user.coins < item.price) return res.status(400).json({ success: false, message: 'Monedas insuficientes' });

  user.coins -= item.price;
  user.inventory.push(item);

  if (item.endpoint === 'key1' || item.desc?.includes('[item?_key1]')) {
    db.keys.key1 = true;
  }

  res.json({ success: true, user, market: db.market });
});

app.post('/api/ideas', (req, res) => {
  db.ideas.push(req.body);
  res.json({ success: true, ideas: db.ideas });
});

app.post('/api/keys/collect-key2', (req, res) => {
  db.keys.key2 = true;
  res.json({ success: true });
});

app.post('/api/jail/unlock', (req, res) => {
  const { lockNum } = req.body;
  if (lockNum === 1 && db.keys.key1) return res.json({ success: true, message: '¡Cerradura 1 abierta!' });
  if (lockNum === 2 && db.keys.key2) return res.json({ success: true, message: '¡Cerradura 2 abierta!' });
  res.status(400).json({ success: false, message: 'Cerradura bloqueada o requiere llave.' });
});

app.listen(PORT, () => {
  console.log(`Servidor en marcha en el puerto ${PORT}`);
});
