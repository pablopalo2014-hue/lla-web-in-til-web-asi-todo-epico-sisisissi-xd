/**
 * ============================================================================
 * LA WEB INÚTIL - SERVIDOR BACKEND OFICIAL
 * Desarrollado para la gestión del grupo del patio y comunidad privada.
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. MIDDLEWARES Y CONFIGURACIÓN ESTÁTICA
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 2. BASE DE DATOS EN MEMORIA (ESTADO GLOBAL COMPLETO)
// ============================================================================
let db = {
  users: [],
  singleUseCode: { code: "45567", used: false },
  chat: [],
  emojis: ['😀', '😂', '🔥', '💀', '👍', '🪙', '😎', '🎉', '🤡', '🚀'],
  adminEmojis: [':bicho:', ':patio:', ':inutil:', ':pro:', ':ban:'],
  market: [
    { 
      id: 1, 
      type: 'extras', 
      name: 'Llave Maestra 1', 
      desc: 'Llave legendaria para abrir la primera cerradura [item?_key1]', 
      price: 1000, 
      limited: false, 
      copies: 0, 
      endpoint: 'key1' 
    }
  ],
  rolesBicho: [],
  events: [],
  missions: [
    { id: 1, text: 'Di hola en el chat', reward: 50, template: 'di hola en el chat' },
    { id: 2, text: 'Escribe en el chat', reward: 30, template: 'escribe en el chat' },
    { id: 3, text: 'Publica algo en tu perfil', reward: 70, template: 'publica algo' }
  ],
  ideas: [],
  trimsterFormOpen: false,
  trimsterApplications: [],
  keys: { key1: false, key2: false, key3: false },
  activeEvent: null
};

// ============================================================================
// 3. SISTEMA ANTI-SLEEP PARA RENDER (PING CADA 50 SEGUNDOS)
// ============================================================================
const RENDER_URL = 'https://la-web-inutil-servidor-supongo.onrender.com';
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Anti-Sleep Worker] Ping enviado con éxito. Código de estado: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[Anti-Sleep Worker] Error al enviar ping:', err.message);
  });
}, 50000);

// ============================================================================
// 4. RUTAS DE VISTAS (HTMLs PRINCIPALES)
// ============================================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(500).send('Error crítico: No se encuentra index.html en la carpeta public.');
  });
});

app.get('/code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'code.html'), (err) => {
    if (err) res.status(500).send('Error crítico: No se encuentra code.html en la carpeta public.');
  });
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'), (err) => {
    if (err) res.status(500).send('Error crítico: No se encuentra home.html en la carpeta public.');
  });
});

app.get('/401', (req, res) => {
  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><title>401 No Autorizado</title></head>
    <body style="background:#121212; color:#ff4444; font-family:sans-serif; text-align:center; padding-top:100px;">
      <h1>Error 401: Acceso Denegado</h1>
      <p>Tus credenciales son incorrectas o no tienes autorización para entrar aquí.</p>
      <a href="/" style="color:#fff; text-decoration:underline;">Volver al Login principal</a>
    </body>
    </html>
  `);
});

// ============================================================================
// 5. API ENDPOINTS - AUTENTICACIÓN Y REGISTRO INICIAL
// ============================================================================

// Sincronizar estado completo con el cliente
app.get('/api/state', (req, res) => {
  res.json(db);
});

// Inicio de sesión
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
  }
  
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
  }
});

// Creación de cuenta Owner mediante código de un solo uso (45567)
app.post('/api/register-owner', (req, res) => {
  const { code, username, password } = req.body;
  if (!code || !username || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos en la solicitud.' });
  }

  if (db.singleUseCode.used || db.singleUseCode.code !== code) {
    return res.status(400).json({ success: false, message: 'Código inválido o ya ha sido utilizado previamente.' });
  }

  // Marcar código como inservible
  db.singleUseCode.used = true;

  const newOwner = {
    username,
    password,
    role: 'owner',
    coins: 1000,
    pfp: 'https://via.placeholder.com/150',
    inventory: [],
    posts: [],
    comments: [],
    adminActionsCount: 0,
    restrictions: { 
      blockPosts: false, 
      removeEmojis: false, 
      removeShop: false, 
      removeChat: false, 
      removeJail: false 
    }
  };

  db.users.push(newOwner);
  res.json({ success: true, user: newOwner });
});

// ============================================================================
// 6. API ENDPOINTS - CHAT Y COMUNICACIÓN
// ============================================================================
app.post('/api/chat', (req, res) => {
  const { username, text } = req.body;
  if (!username || !text) {
    return res.status(400).json({ success: false, message: 'Mensaje vacío.' });
  }

  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
  }

  // Comprobar restricciones de chat impuestas por administradores
  if (user.restrictions && user.restrictions.removeChat) {
    return res.status(403).json({ success: false, message: 'Tienes el chat bloqueado por un administrador.' });
  }

  const messageObject = {
    username,
    text,
    time: new Date().toLocaleTimeString()
  };

  db.chat.push(messageObject);
  
  // Limitar historial de chat a los últimos 200 mensajes para optimizar memoria
  if (db.chat.length > 200) {
    db.chat.shift();
  }

  res.json({ success: true, chat: db.chat });
});

// ============================================================================
// 7. API ENDPOINTS - BANQUERO Y ECONOMÍA
// ============================================================================
app.post('/api/banquero/money', (req, res) => {
  const { username, amount, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);
  
  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
    return res.status(403).json({ success: false, message: 'No tienes permisos de Banquero.' });
  }

  const targetUser = db.users.find(u => u.username === username);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuario destinatario no encontrado.' });
  }

  targetUser.coins += Number(amount);
  res.json({ success: true, user: targetUser });
});

// ============================================================================
// 8. API ENDPOINTS - ADMINISTRACIÓN Y GESTIÓN DE CUENTAS
// ============================================================================
app.post('/api/admin/users', (req, res) => {
  const { operatorUsername, actionType, username, password, role, restrictions } = req.body;
  
  const operator = db.users.find(u => u.username === operatorUsername);
  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Acceso denegado.' });
  }

  // ACCIÓN: Editar usuario existente
  if (actionType === 'edit') {
    const targetUser = db.users.find(u => u.username === username);
    if (!targetUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    
    if (password) targetUser.password = password;
    if (role) targetUser.role = role;
    if (restrictions) targetUser.restrictions = restrictions;

    return res.json({ success: true, user: targetUser });
  }

  // ACCIÓN: Crear nueva cuenta
  const existingUser = db.users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado.' });
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

  // Registrar contador de acciones administrativas si fue un admin normal (para la regla de degradación)
  if (operator.role === 'admin') {
    operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
  }

  res.json({ success: true, user: newUser });
});

// Subida de nuevos Emojis mensuales por admins/owner
app.post('/api/admin/emojis', (req, res) => {
  const { emojiTag, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);
  
  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'No autorizado.' });
  }

  if (emojiTag && !db.adminEmojis.includes(emojiTag)) {
    db.adminEmojis.push(emojiTag);
    if (operator.role === 'admin') operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
  }

  res.json({ success: true, adminEmojis: db.adminEmojis });
});

// ============================================================================
// 9. API ENDPOINTS - MERCADO, TIENDA Y LLAVES DE LA CÁRCEL
// ============================================================================

// Subir ítem al mercado (Vendedor / Admin / Owner)
app.post('/api/market/item', (req, res) => {
  const { name, desc, price, type, limited, copies, endpoint, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'vendedor')) {
    return res.status(403).json({ success: false, message: 'No tienes permisos para vender.' });
  }

  const newItem = {
    id: db.market.length + 1,
    name,
    desc,
    price: Number(price),
    type: type || 'cosmeticos',
    limited: Boolean(limited),
    copies: Number(copies) || 0,
    endpoint: endpoint || ''
  };

  db.market.push(newItem);
  res.json({ success: true, market: db.market });
});

// Comprar ítem del mercado
app.post('/api/market/buy', (req, res) => {
  const { username, itemId } = req.body;
  const user = db.users.find(u => u.username === username);
  const item = db.market.find(i => i.id === Number(itemId));

  if (!user || !item) {
    return res.status(404).json({ success: false, message: 'Usuario o ítem no encontrado.' });
  }

  if (user.coins < item.price) {
    return res.status(400).json({ success: false, message: 'No tienes suficientes Inútil Coins.' });
  }

  // Verificar stock si es limited
  if (item.limited) {
    if (item.copies <= 0) {
      return res.status(400).json({ success: false, message: 'Este ítem limited se ha agotado.' });
    }
    item.copies -= 1;
  }

  user.coins -= item.price;
  user.inventory.push({ ...item, acquiredAt: new Date().toLocaleString() });

  // Detección automática de la Llave 1 en la descripción o endpoint
  if (item.endpoint === 'key1' || (item.desc && item.desc.includes('[item?_key1]'))) {
    db.keys.key1 = true;
  }

  res.json({ success: true, user, market: db.market });
});

// ============================================================================
// 10. API ENDPOINTS - MISIONES, EVENTOS Y BUZÓN DE IDEAS
// ============================================================================
app.post('/api/missions', (req, res) => {
  const { text, reward, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);
  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
    return res.status(403).json({ success: false, message: 'No autorizado para crear misiones.' });
  }

  db.missions.push({ id: db.missions.length + 1, text, reward: Number(reward) });
  res.json({ success: true, missions: db.missions });
});

app.post('/api/events', (req, res) => {
  const { name, desc, banner, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);
  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'No autorizado para gestionar eventos.' });
  }

  const newEvent = { name, desc, banner, time: new Date().toLocaleString() };
  db.events.push(newEvent);
  db.activeEvent = newEvent;
  res.json({ success: true, events: db.events });
});

app.post('/api/ideas', (req, res) => {
  const { username, idea } = req.body;
  if (!username || !idea) return res.status(400).json({ success: false, message: 'Idea vacía.' });

  db.ideas.push({ username, idea, time: new Date().toLocaleString() });
  res.json({ success: true, ideas: db.ideas });
});

// ============================================================================
// 11. API ENDPOINTS - PERFILES, PUBLICACIONES Y COMENTARIOS
// ============================================================================
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (user.restrictions && user.restrictions.blockPosts) {
    return res.status(403).json({ success: false, message: 'Tienes prohibido hacer publicaciones.' });
  }

  user.posts.push({ content, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

app.post('/api/profile/comment', (req, res) => {
  const { profileUser, author, comment } = req.body;
  const user = db.users.find(u => u.username === profileUser);
  if (!user) return res.status(404).json({ success: false, message: 'Perfil no encontrado.' });

  if (!user.comments) user.comments = [];
  user.comments.push({ author, comment, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

app.post('/api/profile/update', (req, res) => {
  const { username, pfp } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (pfp) user.pfp = pfp;
  res.json({ success: true, user });
});

// ============================================================================
// 12. API ENDPOINTS - CÁRCEL DE MARIO Y LLAVES
// ============================================================================
app.post('/api/jail/unlock', (req, res) => {
  const { lockNum, username } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (user.restrictions && user.restrictions.removeJail) {
    return res.status(403).json({ success: false, message: 'Tienes prohibido interactuar con la cárcel.' });
  }

  if (lockNum === 1) {
    if (db.keys.key1) {
      db.keys.lock1 = true;
      return res.json({ success: true, message: '¡Cerradura 1 abierta con éxito utilizando la Llave Maestra!' });
    }
    return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Necesitas comprar la Llave 1 en la tienda.' });
  } 
  else if (lockNum === 2) {
    if (db.keys.key2) {
      db.keys.lock2 = true;
      return res.json({ success: true, message: '¡Cerradura 2 abierta con éxito utilizando la llave verde oculta!' });
    }
    return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Debes encontrar la llave verde oculta en los perfiles.' });
  } 
  else if (lockNum === 3) {
    return res.status(400).json({ success: false, message: 'Cerradura 3 impenetrable. Reservada para la versión 2.0.' });
  }

  res.status(400).json({ success: false, message: 'Número de cerradura inválido.' });
});

// Recoger llave verde oculta en perfiles
app.post('/api/keys/collect-key2', (req, res) => {
  const { username } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false });

  db.keys.key2 = true;
  res.json({ success: true, message: '¡Has recogido la Llave 2 verde!' });
});

// ============================================================================
// 13. INICIO DEL SERVIDOR WEB
// ============================================================================
app.listen(PORT, () => {
  console.log(`[Servidor OK] La Web Inútil está corriendo en el puerto ${PORT}`);
});
