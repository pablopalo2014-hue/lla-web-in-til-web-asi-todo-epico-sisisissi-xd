const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. MIDDLEWARES Y CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 2. BASE DE DATOS COMPLETA EN MEMORIA (ESTADO GLOBAL DE LA WEB INÚTIL)
// ============================================================================
let db = {
  users: [],
  singleUseCode: { code: "45567", used: false },
  chat: [],
  emojis: ['😀', '😂', '🔥', '💀', '👍', '🪙', '😎', '🎉', '🤡', '🚀', '❤️', '👀'],
  adminEmojis: [':bicho:', ':patio:', ':inutil:', ':pro:', ':ban:', ':mario:', ':llave:'],
  market: [
    { 
      id: 1, 
      type: 'extras', 
      name: 'Llave Maestra 1', 
      desc: 'Llave legendaria indispensable para abrir la primera cerradura de la Cárcel de Mario [item?_key1]', 
      price: 1000, 
      limited: false, 
      copies: 0, 
      endpoint: 'key1' 
    },
    {
      id: 2,
      type: 'cosmeticos',
      name: 'Marco Dorado de Perfil',
      desc: 'Un elegante marco de oro brillante para tu foto de perfil.',
      price: 250,
      limited: false,
      copies: 0,
      endpoint: 'marco_oro'
    },
    {
      id: 3,
      type: 'roles',
      name: 'Rol de Bicho Legendario',
      desc: 'Te otorga el rango especial de Bicho Supremo en los juegos del patio.',
      price: 500,
      limited: true,
      copies: 5,
      endpoint: 'rol_bicho'
    }
  ],
  rolesBicho: [
    { name: 'Bicho Común', desc: 'Bicho básico para juegos de velocidad.', price: 100 },
    { name: 'Bicho Alfa', desc: 'Líder de patrulla en el patio.', price: 300 }
  ],
  events: [],
  missions: [
    { id: 1, text: 'Di hola en el chat', reward: 50, template: 'di hola en el chat' },
    { id: 2, text: 'Escribe en el chat', reward: 30, template: 'escribe en el chat' },
    { id: 3, text: 'Di pepe en el chat', reward: 40, template: 'di pepe en el chat' },
    { id: 4, text: 'Publica algo en tu perfil', reward: 70, template: 'publica algo' }
  ],
  ideas: [],
  trimsterFormOpen: false,
  trimsterApplications: [],
  keys: { key1: false, key2: false, key3: false },
  activeEvent: null
};

// ============================================================================
// 3. WORKER ANTI-SLEEP PARA MANTENER EL SERVIDOR ACTIVO EN RENDER
// ============================================================================
const RENDER_URL = 'https://la-web-inutil-servidor-supongo.onrender.com';
setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[Anti-Sleep Ping] Estado de Render: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[Anti-Sleep Ping] Error de conexión:', err.message);
  });
}, 50000);

// ============================================================================
// 4. RUTAS DE NAVEGACIÓN Y VISTAS HTML
// ============================================================================

// Ruta principal (Login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(500).send('Error al cargar index.html desde public/');
  });
});

// Ruta de registro con código de un solo uso
app.get('/code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'code.html'), (err) => {
    if (err) res.status(500).send('Error al cargar code.html desde public/');
  });
});

// Ruta principal interna tras el login
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'), (err) => {
    if (err) res.status(500).send('Error al cargar home.html desde public/');
  });
});

// Redirección de error de autenticación 401
app.get('/401', (req, res) => {
  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Error 401 - No Autorizado</title>
      <style>
        body { background: #121212; color: #ff4444; font-family: Arial, sans-serif; text-align: center; padding-top: 100px; }
        a { color: #fff; text-decoration: underline; margin-top: 20px; display: inline-block; }
      </style>
    </head>
    <body>
      <h1>Error 401: Acceso Denegado</h1>
      <p>Tus credenciales son incorrectas o tu sesión ha expirado.</p>
      <a href="/">Volver a la pantalla de Login</a>
    </body>
    </html>
  `);
});

// ============================================================================
// 5. API ENDPOINTS - AUTENTICACIÓN Y REGISTRO
// ============================================================================

// Obtener todo el estado global sincronizado
app.get('/api/state', (req, res) => {
  res.json(db);
});

// Endpoint de Login
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

// Endpoint de Registro Owner con código 45567
app.post('/api/register-owner', (req, res) => {
  const { code, username, password } = req.body;
  if (!code || !username || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos.' });
  }

  if (db.singleUseCode.used || db.singleUseCode.code !== code) {
    return res.status(400).json({ success: false, message: 'Código de un solo uso inválido o consumido.' });
  }

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
// 6. API ENDPOINTS - SISTEMA DE CHAT Y EMOJIS
// ============================================================================

// Enviar mensajes al chat general
app.post('/api/chat', (req, res) => {
  const { username, text } = req.body;
  if (!username || !text) {
    return res.status(400).json({ success: false, message: 'El contenido no puede estar vacío.' });
  }

  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
  }

  if (user.restrictions && user.restrictions.removeChat) {
    return res.status(403).json({ success: false, message: 'Tienes la función de chat bloqueada por administración.' });
  }

  const msg = {
    id: db.chat.length + 1,
    username,
    text,
    time: new Date().toLocaleTimeString()
  };

  db.chat.push(msg);

  if (db.chat.length > 300) {
    db.chat.shift();
  }

  res.json({ success: true, chat: db.chat });
});

// Obtener historial del chat
app.get('/api/chat/history', (req, res) => {
  res.json({ success: true, chat: db.chat });
});

// ============================================================================
// 7. API ENDPOINTS - BANQUERO Y GESTIÓN ECONÓMICA
// ============================================================================

// Modificar Inútil Coins de un usuario
app.post('/api/banquero/money', (req, res) => {
  const { username, amount, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
    return res.status(403).json({ success: false, message: 'Permiso de Banquero denegado.' });
  }

  const targetUser = db.users.find(u => u.username === username);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuario destinatario no localizado.' });
  }

  targetUser.coins += Number(amount);
  if (targetUser.coins < 0) targetUser.coins = 0;

  res.json({ success: true, user: targetUser });
});

// ============================================================================
// 8. API ENDPOINTS - ADMINISTRACIÓN Y OWNER
// ============================================================================

// Crear o modificar usuarios desde el panel de admin
app.post('/api/admin/users', (req, res) => {
  const { operatorUsername, actionType, username, password, role, restrictions } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Acceso administrativo denegado.' });
  }

  // Edición de un usuario existente
  if (actionType === 'edit') {
    const target = db.users.find(u => u.username === username);
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    if (password) target.password = password;
    if (role) target.role = role;
    if (restrictions) target.restrictions = restrictions;

    return res.json({ success: true, user: target });
  }

  // Creación de una cuenta nueva
  const exists = db.users.find(u => u.username === username);
  if (exists) {
    return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe.' });
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

  if (operator.role === 'admin') {
    operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
  }

  res.json({ success: true, user: newUser });
});

// Subida de emojis mensuales por administradores
app.post('/api/admin/emojis', (req, res) => {
  const { emojiTag, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'No autorizado para subir emojis.' });
  }

  if (emojiTag && !db.adminEmojis.includes(emojiTag)) {
    db.adminEmojis.push(emojiTag);
    if (operator.role === 'admin') operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
  }

  res.json({ success: true, adminEmojis: db.adminEmojis });
});

// Solicitud de cambio de usuario o contraseña enviada a los admins
app.post('/api/users/request-change', (req, res) => {
  const { username, newUsername, newPassword } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (newUsername) user.requestedUsername = newUsername;
  if (newPassword) user.requestedPassword = newPassword;

  res.json({ success: true, message: 'Solicitud enviada a los administradores.' });
});

// ============================================================================
// 9. API ENDPOINTS - MERCADO, VENDEDOR Y EQUIPAMIENTO
// ============================================================================

// Subir ítem al mercado
app.post('/api/market/item', (req, res) => {
  const { name, desc, price, type, limited, copies, endpoint, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'vendedor')) {
    return res.status(403).json({ success: false, message: 'Sin permisos de Vendedor.' });
  }

  const newItem = {
    id: db.market.length + 1,
    name,
    desc,
    price: Number(price) || 0,
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
    return res.status(404).json({ success: false, message: 'Ítem o usuario no válido.' });
  }

  if (user.restrictions && user.restrictions.removeShop) {
    return res.status(403).json({ success: false, message: 'Tienes la tienda bloqueada.' });
  }

  if (user.coins < item.price) {
    return res.status(400).json({ success: false, message: 'Inútil Coins insuficientes.' });
  }

  if (item.limited) {
    if (item.copies <= 0) {
      return res.status(400).json({ success: false, message: 'Las copias limitadas de este ítem se han agotado.' });
    }
    item.copies -= 1;
  }

  user.coins -= item.price;
  user.inventory.push({ ...item, equipped: false, acquiredAt: new Date().toLocaleString() });

  if (item.endpoint === 'key1' || (item.desc && item.desc.includes('[item?_key1]'))) {
    db.keys.key1 = true;
  }

  res.json({ success: true, user, market: db.market });
});

// Reventa de ítems limitados
app.post('/api/market/resell', (req, res) => {
  const { username, itemId, resellPrice } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  const itemIndex = user.inventory.findIndex(i => i.id === Number(itemId));
  if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Ítem no está en tu inventario.' });

  const item = user.inventory[itemIndex];
  if (!item.limited) {
    return res.status(400).json({ success: false, message: 'Solo se pueden revender ítems Limited U.' });
  }

  user.inventory.splice(itemIndex, 1);
  db.market.push({
    id: db.market.length + 1,
    name: item.name + ' (Reventa de ' + username + ')',
    desc: item.desc,
    price: Number(resellPrice),
    type: item.type,
    limited: true,
    copies: 1,
    endpoint: item.endpoint
  });

  res.json({ success: true, user, market: db.market });
});

// Equipar o desequipar cosméticos
app.post('/api/inventory/equip', (req, res) => {
  const { username, itemId } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  const item = user.inventory.find(i => i.id === Number(itemId));
  if (!item) return res.status(404).json({ success: false, message: 'Ítem no encontrado en el inventario.' });

  item.equipped = !item.equipped;
  res.json({ success: true, user });
});

// ============================================================================
// 10. API ENDPOINTS - MISIONES, EVENTOS Y BUZÓN DE IDEAS
// ============================================================================

// Crear misiones personalizadas
app.post('/api/missions', (req, res) => {
  const { text, reward, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
    return res.status(403).json({ success: false, message: 'No autorizado para añadir misiones.' });
  }

  const rewardNum = Number(reward);
  if (rewardNum < 1 || rewardNum > 100) {
    return res.status(400).json({ success: false, message: 'Las misiones deben otorgar entre 1 y 100 Inútil Coins.' });
  }

  if (db.missions.length >= 3) {
    db.missions.shift();
  }

  db.missions.push({ id: db.missions.length + 1, text, reward: rewardNum });
  res.json({ success: true, missions: db.missions });
});

// Crear eventos especiales de administración
app.post('/api/events', (req, res) => {
  const { name, desc, banner, operatorUsername } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'No autorizado para gestionar eventos.' });
  }

  const newEvent = { id: db.events.length + 1, name, desc, banner, createdAt: new Date().toLocaleString() };
  db.events.push(newEvent);
  db.activeEvent = newEvent;

  res.json({ success: true, events: db.events });
});

// Enviar sugerencias al buzón de ideas
app.post('/api/ideas', (req, res) => {
  const { username, idea } = req.body;
  if (!username || !idea) {
    return res.status(400).json({ success: false, message: 'Falta información requerida.' });
  }

  db.ideas.push({ id: db.ideas.length + 1, username, idea, time: new Date().toLocaleString() });
  res.json({ success: true, ideas: db.ideas });
});

// Formulario trimestral de admisión de nuevos miembros
app.post('/api/trimster/apply', (req, res) => {
  const { applicantName, reason } = req.body;
  if (!db.trimsterFormOpen) {
    return res.status(400).json({ success: false, message: 'El formulario de admisión trimestral no está abierto actualmente.' });
  }

  db.trimsterApplications.push({ applicantName, reason, time: new Date().toLocaleString() });
  res.json({ success: true, message: 'Postulación enviada correctamente.' });
});

// Abrir o cerrar el formulario trimestral (Admin / Owner)
app.post('/api/trimster/toggle', (req, res) => {
  const { operatorUsername, open } = req.body;
  const operator = db.users.find(u => u.username === operatorUsername);

  if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Permiso denegado.' });
  }

  db.trimsterFormOpen = Boolean(open);
  res.json({ success: true, trimsterFormOpen: db.trimsterFormOpen });
});

// ============================================================================
// 11. API ENDPOINTS - PERFILES, PUBLICACIONES Y COMENTARIOS
// ============================================================================

// Publicar un mensaje de rol en el feed del perfil
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (user.restrictions && user.restrictions.blockPosts) {
    return res.status(403).json({ success: false, message: 'Tienes prohibido hacer publicaciones.' });
  }

  user.posts.push({ id: user.posts.length + 1, content, time: new Date().toLocaleString() });
  res.json({ success: true, user });
});

// Comentarios en muros de perfil
app.post('/api/profile/comment', (req, res) => {
  const { profileUser, author, comment } = req.body;
  const user = db.users.find(u => u.username === profileUser);
  if (!user) return res.status(404).json({ success: false, message: 'Perfil de usuario no localizado.' });

  if (!user.comments) user.comments = [];
  user.comments.push({ author, comment, time: new Date().toLocaleString() });

  res.json({ success: true, user });
});

// Cambiar foto de perfil
app.post('/api/profile/update', (req, res) => {
  const { username, pfp } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (pfp) user.pfp = pfp;
  res.json({ success: true, user });
});

// ============================================================================
// 12. API ENDPOINTS - CÁRCEL DE MARIO Y SISTEMA DE 3 LLAVES
// ============================================================================

// Interacción con las 3 cerraduras de la cárcel
app.post('/api/jail/unlock', (req, res) => {
  const { lockNum, username } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  if (user.restrictions && user.restrictions.removeJail) {
    return res.status(403).json({ success: false, message: 'Tienes la función de cárcel bloqueada por un administrador.' });
  }

  if (lockNum === 1) {
    if (db.keys.key1) {
      db.keys.lock1 = true;
      return res.json({ success: true, message: '¡Primera cerradura abierta con la Llave 1 comprada en la tienda!' });
    }
    return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Necesitas comprar la Llave Maestra 1 en los extras de la tienda por 1000 Inútil Coins.' });
  } 
  else if (lockNum === 2) {
    if (db.keys.key2) {
      db.keys.lock2 = true;
      return res.json({ success: true, message: '¡Segunda cerradura abierta con la llave verde del perfil!' });
    }
    return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Busca la pequeña llave verde escondida en la esquina del perfil.' });
  } 
  else if (lockNum === 3) {
    return res.status(400).json({ success: false, message: 'La tercera cerradura está sellada mágicamente hasta la versión 2.0.' });
  }

  res.status(400).json({ success: false, message: 'Número de cerradura no válido.' });
});

// Recoger la Llave 2 verde en la pestaña de perfiles
app.post('/api/keys/collect-key2', (req, res) => {
  const { username } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

  db.keys.key2 = true;
  res.json({ success: true, message: '¡Llave 2 verde recogida y guardada!' });
});

// ============================================================================
// 13. INICIALIZACIÓN DEL SERVIDOR HTTP
// ============================================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SERVIDOR DE LA WEB INÚTIL ESCUCHANDO EN PUERTO ${PORT}`);
  console.log(`=======================================================`);
});
