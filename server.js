const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares obligatorios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos completa en memoria (Estado Global de La Web Inútil)
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
    { id: 1, text: 'Di hola en el chat', reward: 50, template: 'di hola en el chat' },
    { id: 2, text: 'Escribe en el chat', reward: 30, template: 'escribe en el chat' }
  ],
  ideas: [],
  trimsterFormOpen: false,
  keys: { key1: false, key2: false, key3: false }
};

// Anti-sleep ping cada 50 segundos para evitar que Render duerma la web
const RENDER_URL = 'https://la-web-inutil-servidor-supongo.onrender.com';
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Anti-Sleep] Ping estado: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[Anti-Sleep] Error:', err.message);
  });
}, 50000);

// ==========================================
// 📄 RUTAS DE VISTAS (HTMLs)
// ==========================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(500).send('Error al cargar index.html');
  });
});

app.get('/code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'code.html'), (err) => {
    if (err) res.status(500).send('Error al cargar code.html');
  });
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'), (err) => {
    if (err) res.status(500).send('Error al cargar home.html');
  });
});

app.get('/401', (req, res) => {
  res.status(401).send(`
    <body style="background:#121212; color:#ff4444; font-family:sans-serif; text-align:center; padding-top:100px;">
      <h1>Error 401: No autorizado</h1>
      <p>Credenciales incorrectas o acceso denegado.</p>
      <a href="/" style="color:#fff; text-decoration:underline;">Volver al Login</a>
    </body>
  `);
});

// ==========================================
// 🔌 API ENDPOINTS (RESPONDEN A TODAS LAS PETICIONES)
// ==========================================

// 1. Obtener estado general de la base de datos
app.get('/api/state', (req, res) => {
  res.json(db);
});

// 2. Login de usuarios
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }
});

// 3. Registro de cuenta Owner con código único (45567)
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
    adminActionsCount: 0,
    restrictions: { blockPosts: false, removeEmojis: false, removeShop: false, removeChat: false, removeJail: false }
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

// 4. Chat general con restricciones de baneo/bloqueo
app.post('/api/chat', (req, res) => {
  const { username, text } = req.body;
  const user = db.users.find(u => u.username === username);
  if (user && user.restrictions && user.restrictions.removeChat) {
    return res.status(403).json({ success: false, message: 'Tienes el chat bloqueado por un administrador.' });
  }
  const msg = { username, text, time: new Date().toLocaleTimeString() };
  db.chat.push(msg);
  res.json({ success: true, chat: db.chat });
});

// 5. Panel del Banquero (Sumar o restar Inútil Coins)
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

// 6. Panel de Administración y Owner (Crear / Editar cuentas y restricciones)
app.post('/api/admin/users', (req, res) => {
  const { username, password, restrictions, role, actionType } = req.body;
  
  if (actionType === 'edit') {
    const existing = db.users.find(u => u.username === username);
    if (!existing) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (password) existing.password = password;
    if (restrictions) existing.restrictions = restrictions;
    if (role) existing.role = role;
    return res.json({ success: true, user: existing });
  }

  const existing = db.users.find(u => u.username === username);
  if (existing) {
    return res.status(400).json({ success: false, message: 'El usuario ya existe' });
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
    adminActionsCount: 0,
    restrictions: restrictions || { blockPosts: false, removeEmojis: false, removeShop: false, removeChat: false, removeJail: false }
  };
  db.users.push(newUser);
  res.json({ success: true, user: newUser });
});

// 7. Subida de emojis mensuales de administrador
app.post('/api/admin/emojis', (req, res) => {
  const { emojiTag } = req.body;
  if (emojiTag && !db.adminEmojis.includes(emojiTag)) {
    db.adminEmojis.push(emojiTag);
  }
  res.json({ success: true, adminEmojis: db.adminEmojis });
});

// 8. Panel de Vendedor / Admin: Crear ítems en el mercado
app.post('/api/market/item', (req, res) => {
  const item = req.body;
  item.id = db.market.length + 1;
  db.market.push(item);
  res.json({ success: true, market: db.market });
});

// 9. Comprar ítems del mercado
app.post('/api/market/buy', (req, res) => {
  const { username, itemId } = req.body;
  const user = db.users.find(u => u.username === username);
  const item = db.market.find(i => i.id === Number(itemId));
  
  if (!user || !item) return res.status(404).json({ success: false, message: 'Usuario o ítem no encontrado' });
  if (user.coins < item.price) return res.status(400).json({ success: false, message: 'No tienes suficientes Inútil Coins' });

  user.coins -= item.price;
  user.inventory.push(item);

  // Activador automático de Llave 1
  if (item.endpoint === 'key1' || (item.desc && item.desc.includes('[item?_key1]'))) {
    db.keys.key1 = true;
  }

  res.json({ success: true, user, market: db.market });
});

// 10. Crear Eventos
app.post('/api/events', (req, res) => {
  db.events.push(req.body);
  res.json({ success: true, events: db.events });
});

// 11. Crear Misiones
app.post('/api/missions', (req, res) => {
  db.missions.push(req.body);
  res.json({ success: true, missions: db.missions });
});

// 12. Buzón de Ideas
app.post('/api/ideas', (req, res) => {
  const { username, idea } = req.body;
  db.ideas.push({ username, idea, time: new Date().toLocaleString() });
  res.json({ success: true, ideas: db.ideas });
});

// 13. Publicaciones en perfiles
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  if (user.restrictions && user.restrictions.blockPosts) {
    return res.status(403).json({ success: false, message: 'Tienes prohibido hacer publicaciones.' });
  }
  user.posts.push({ content, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

// 14. Comentarios en perfiles
app.post('/api/profile/comment', (req, res) => {
  const { profileUser, author, comment } = req.body;
  const user = db.users.find(u => u.username === profileUser);
  if (!user) return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
  if (!user.comments) user.comments = [];
  user.comments.push({ author, comment, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

// 15. Actualizar perfil (foto de perfil)
app.post('/api/profile/update', (req, res) => {
  const { username, pfp } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false });
  if (pfp) user.pfp = pfp;
  res.json({ success: true, user });
});

// 16. Desbloquear Cárcel de Mario
app.post('/api/jail/unlock', (req, res) => {
  const { lockNum } = req.body;

  if (lockNum === 1) {
    if (db.keys.key1) {
      return res.json({ success: true, message: '¡Cerradura 1 abierta con éxito!' });
    }
    return res.status(400).json({ success: false, message: 'Necesitas comprar la Llave 1 en la tienda.' });
  } else if (lockNum === 2) {
    if (db.keys.key2) {
      return res.json({ success: true, message: '¡Cerradura 2 abierta con éxito!' });
    }
    return res.status(400).json({ success: false, message: 'No has recogido la llave verde oculta en perfiles.' });
  } else if (lockNum === 3) {
    return res.status(400).json({ success: false, message: 'Cerradura reservada para la versión 2.0.' });
  }
  res.status(400).json({ success: false, message: 'Cerradura inválida.' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de La Web Inútil funcionando en el puerto ${PORT}`);
});
