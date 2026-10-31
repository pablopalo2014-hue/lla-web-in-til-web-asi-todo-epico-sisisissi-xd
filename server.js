/**
 * ============================================================================
 * LA WEB INÚTIL - BACKEND SERVER OFICIAL & ROBUSTO
 * Desarrollado para la gestión del grupo del patio y comunidad privada.
 * Arquitectura Express de Alta Disponibilidad con Sincronización en Memoria.
 * ============================================================================
 */

'use strict';

const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Acepta ambas estructuras:
// 1) proyecto/public/index.html (recomendado)
// 2) proyecto/index.html (HTML junto a server.js)
const fs = require('fs');
const PUBLIC_DIR = path.join(__dirname, 'public');
const WEB_ROOT = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? PUBLIC_DIR : __dirname;

// ============================================================================
// SECCIÓN 1: CONFIGURACIÓN DE MIDDLEWARES Y SEGURIDAD BÁSICA
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'El cuerpo JSON enviado no es válido.' });
  }
  console.error('[Middleware Error]:', err);
  return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
});

// Middleware de cabeceras CORS permisivas para evitar bloqueos de red en Render
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware de logging de peticiones HTTP detalladas para depuración instantánea
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[HTTP Request] [${timestamp}] ${req.method} -> ${req.url}`);
  next();
});

// Servir únicamente recursos web. No exponer server.js, package.json ni archivos de datos.
app.use((req, res, next) => {
  const pathname = decodeURIComponent((req.path || '/').toLowerCase());
  if (/(^|\/)(server|package|database|\.env)(\.|\/|$)/i.test(pathname)) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(WEB_ROOT, {
  index: false,
  dotfiles: 'ignore',
  extensions: ['html']
}));

// ============================================================================
// SECCIÓN 2: BASE DE DATOS EN MEMORIA (ESTADO GLOBAL COMPLETO Y PERSISTENTE)
// ============================================================================

let db = {
  metadata: {
    projectName: "La Web Inútil",
    version: "1.0.0-production",
    bootTime: new Date().toISOString()
  },
  users: [],
  singleUseCode: { 
    code: "45567", 
    used: false,
    description: "Código de un solo uso para inicializar el rol Owner" 
  },
  chat: [
    { id: 1, username: "Sistema", text: "¡Bienvenidos al chat oficial de La Web Inútil!", time: "00:00:00" }
  ],
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
      desc: 'Un elegante marco de oro brillante para destacar tu foto de perfil en la comunidad.',
      price: 250,
      limited: false,
      copies: 0,
      endpoint: 'marco_oro'
    },
    {
      id: 3,
      type: 'roles',
      name: 'Rol de Bicho Legendario',
      desc: 'Te otorga el rango especial de Bicho Supremo en los torneos del patio.',
      price: 500,
      limited: true,
      copies: 5,
      endpoint: 'rol_bicho'
    }
  ],
  rolesBicho: [
    { id: 1, name: 'Bicho Común', desc: 'Bicho básico para juegos de velocidad.', price: 100 },
    { id: 2, name: 'Bicho Alfa', desc: 'Líder de patrulla en el patio.', price: 300 }
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
  activeEvent: null,
  logs: []
};

// ============================================================================
// SECCIÓN 3: WORKER ANTI-SLEEP (PING AUTOMÁTICO CADA 50 SEGUNDOS)
// ============================================================================

// No se hace ping a un dominio fijo: el dominio anterior no corresponde necesariamente
// a este servicio y podía generar errores de conexión engañosos en los logs.
function startAntiSleepWorker() {
  console.log('[Render] Servicio iniciado. Health check disponible en /health.');
}

// ============================================================================
// SECCIÓN 4: RUTAS DE VISTAS (ENRUTAMIENTO DE ARCHIVOS HTML)
// ============================================================================

// Ruta principal -> Pantalla de Login (index.html)
app.get('/', (req, res) => {
  const filePath = path.join(WEB_ROOT, 'index.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[Error de Ruta] No se pudo servir index.html:', err.message);
      res.status(500).send('Error crítico: No se encuentra index.html. Colócalo junto a server.js o dentro de /public.');
    }
  });
});

// Ruta de código de un solo uso -> code.html
app.get('/code', (req, res) => {
  const filePath = path.join(WEB_ROOT, 'code.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[Error de Ruta] No se pudo servir code.html:', err.message);
      res.status(500).send('Error crítico: No se encuentra code.html. Colócalo junto a server.js o dentro de /public.');
    }
  });
});

// Ruta principal privada -> home.html
app.get('/home', (req, res) => {
  const filePath = path.join(WEB_ROOT, 'home.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[Error de Ruta] No se pudo servir home.html:', err.message);
      res.status(500).send('Error crítico: No se encuentra home.html. Colócalo junto a server.js o dentro de /public.');
    }
  });
});

// Ruta de error 401 personalizada para credenciales inválidas
app.get('/401', (req, res) => {
  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>La Web Inútil - Error 401</title>
      <style>
        body { background: #121212; color: #ff4444; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding-top: 100px; }
        .card { background: #1e1e1e; max-width: 400px; margin: 0 auto; padding: 40px; border-radius: 12px; border: 1px solid #333; box-shadow: 0 8px 30px rgba(0,0,0,0.7); }
        h1 { color: #ff4444; font-size: 24px; margin-bottom: 15px; }
        p { color: #bbb; font-size: 14px; margin-bottom: 25px; }
        a { color: #ffcc00; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Error 401: No Autorizado</h1>
        <p>Credenciales incorrectas o sesión no iniciada correctamente.</p>
        <a href="/">← Volver a la pantalla de Login</a>
      </div>
    </body>
    </html>
  `);
});

// Endpoint de comprobación de salud del servidor (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    activeUsers: db.users.length,
    chatMessagesCount: db.chat.length
  });
});

// ============================================================================
// SECCIÓN 5: API ENDPOINTS - AUTENTICACIÓN, LOGIN Y REGISTRO OWNER
// ============================================================================

// Obtener estado completo de la base de datos sincronizada
app.get('/api/state', (req, res) => {
  try {
    res.status(200).json(db);
  } catch (error) {
    console.error('[API Error] /api/state:', error);
    res.status(500).json({ success: false, message: 'Error interno al sincronizar el estado.' });
  }
});

// Autenticación de usuarios (Login)
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: username o password.' });
    }

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    const user = db.users.find(u => u.username === cleanUser && u.password === cleanPass);
    
    if (user) {
      console.log(`[Auth Success] Usuario conectado con éxito: ${cleanUser} (${user.role})`);
      db.logs.push({ type: 'LOGIN', user: cleanUser, time: new Date().toISOString() });
      return res.status(200).json({ success: true, user });
    } else {
      console.warn(`[Auth Failed] Intento de acceso fallido para el usuario: ${cleanUser}`);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario no registrado.' });
    }
  } catch (error) {
    console.error('[API Error] /api/login:', error);
    return res.status(500).json({ success: false, message: 'Error interno en el servidor durante el login.' });
  }
});

// Registro de cuenta Owner mediante el código de un solo uso (45567)
app.post('/api/register-owner', (req, res) => {
  try {
    const { code, username, password } = req.body;

    if (!code || !username || !password) {
      return res.status(400).json({ success: false, message: 'Faltan datos obligatorios para registrar al Owner.' });
    }

    const cleanCode = code.trim();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (db.singleUseCode.used) {
      return res.status(400).json({ success: false, message: 'El código de un solo uso ya ha sido utilizado anteriormente.' });
    }

    if (db.singleUseCode.code !== cleanCode) {
      return res.status(400).json({ success: false, message: 'Código de acceso incorrecto.' });
    }

    // Marcar código como consumido
    db.singleUseCode.used = true;

    // Verificar si el usuario ya existe
    const existing = db.users.find(u => u.username === cleanUser);
    if (existing) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está ocupado.' });
    }

    const newOwner = {
      username: cleanUser,
      password: cleanPass,
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
      },
      createdAt: new Date().toISOString()
    };

    db.users.push(newOwner);
    console.log(`[Owner Registered] Cuenta Owner inicializada con éxito para: ${cleanUser}`);
    db.logs.push({ type: 'REGISTER_OWNER', user: cleanUser, time: new Date().toISOString() });

    return res.status(200).json({ success: true, user: newOwner });
  } catch (error) {
    console.error('[API Error] /api/register-owner:', error);
    return res.status(500).json({ success: false, message: 'Error interno al registrar la cuenta Owner.' });
  }
});

// ============================================================================
// SECCIÓN 6: API ENDPOINTS - SISTEMA DE CHAT Y EMOJIS
// ============================================================================

// Envío de mensajes al chat general
app.post('/api/chat', (req, res) => {
  try {
    const { username, text } = req.body;

    if (!username || !text) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros de usuario o texto.' });
    }

    const cleanUser = username.trim();
    const cleanText = text.trim();

    const userObj = db.users.find(u => u.username === cleanUser);
    if (!userObj) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en la base de datos.' });
    }

    // Comprobar restricciones de chat impuestas por administración
    if (userObj.restrictions && userObj.restrictions.removeChat) {
      return res.status(403).json({ success: false, message: 'Tienes la función de chat bloqueada por un administrador.' });
    }

    const chatMessage = {
      id: db.chat.length + 1,
      username: cleanUser,
      text: cleanText,
      time: new Date().toLocaleTimeString()
    };

    db.chat.push(chatMessage);

    // Mantener el búfer de chat en un límite prudente de 400 mensajes
    if (db.chat.length > 400) {
      db.chat.shift();
    }

    return res.status(200).json({ success: true, chat: db.chat });
  } catch (error) {
    console.error('[API Error] /api/chat:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar el mensaje de chat.' });
  }
});

// Obtener historial completo de chat
app.get('/api/chat/history', (req, res) => {
  try {
    return res.status(200).json({ success: true, chat: db.chat });
  } catch (error) {
    console.error('[API Error] /api/chat/history:', error);
    return res.status(500).json({ success: false, message: 'Error al recuperar el historial del chat.' });
  }
});

// ============================================================================
// SECCIÓN 7: API ENDPOINTS - BANQUERO Y GESTIÓN ECONÓMICA
// ============================================================================

// Modificar Inútil Coins (Sumar / Restar dinero por parte del Banquero, Admin u Owner)
app.post('/api/banquero/money', (req, res) => {
  try {
    const { username, amount, operatorUsername } = req.body;

    if (!username || amount === undefined || !operatorUsername) {
      return res.status(400).json({ success: false, message: 'Faltan datos en la solicitud económica.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
      return res.status(403).json({ success: false, message: 'Permisos insuficientes. Se requiere rol de Banquero, Admin u Owner.' });
    }

    const target = db.users.find(u => u.username === username.trim());
    if (!target) {
      return res.status(404).json({ success: false, message: 'Usuario destinatario no localizado.' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser un valor numérico válido.' });
    }

    target.coins += numericAmount;
    if (target.coins < 0) target.coins = 0; // Evitar saldos negativos

    console.log(`[Banca] Operación realizada por ${operator.username}: ${numericAmount} coins a ${target.username}. Nuevo saldo: ${target.coins}`);
    db.logs.push({ type: 'MONEY_MODIFY', operator: operator.username, target: target.username, amount: numericAmount, time: new Date().toISOString() });

    return res.status(200).json({ success: true, user: target });
  } catch (error) {
    console.error('[API Error] /api/banquero/money:', error);
    return res.status(500).json({ success: false, message: 'Error interno al actualizar la economía.' });
  }
});

// ============================================================================
// SECCIÓN 8: API ENDPOINTS - ADMINISTRACIÓN, OWNER Y RESTRICCIONES
// ============================================================================

// Crear o editar cuentas de usuario y sus restricciones
app.post('/api/admin/users', (req, res) => {
  try {
    const { operatorUsername, actionType, username, password, role, restrictions } = req.body;

    if (!operatorUsername) {
      return res.status(400).json({ success: false, message: 'Falta el nombre de usuario del operador.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Acceso administrativo denegado.' });
    }

    // ACCIÓN: Editar cuenta existente
    if (actionType === 'edit') {
      const targetUser = db.users.find(u => u.username === username.trim());
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Usuario a editar no encontrado.' });
      }

      if (password) targetUser.password = password.trim();
      if (role) targetUser.role = role.trim();
      if (restrictions) targetUser.restrictions = restrictions;

      console.log(`[Admin Edit] Usuario ${targetUser.username} modificado por ${operator.username}`);
      return res.status(200).json({ success: true, user: targetUser });
    }

    // ACCIÓN: Crear nueva cuenta
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Faltan username y password para la nueva cuenta.' });
    }

    const cleanNewUser = username.trim();
    const cleanNewPass = password.trim();

    const alreadyExists = db.users.find(u => u.username === cleanNewUser);
    if (alreadyExists) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado.' });
    }

    const newUser = {
      username: cleanNewUser,
      password: cleanNewPass,
      role: role || 'miembro',
      coins: 100,
      pfp: 'https://via.placeholder.com/150',
      inventory: [],
      posts: [],
      comments: [],
      adminActionsCount: 0,
      restrictions: restrictions || {
        blockPosts: false,
        removeEmojis: false,
        removeShop: false,
        removeChat: false,
        removeJail: false
      },
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    if (operator.role === 'admin') {
      operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
    }

    console.log(`[Admin Create] Nueva cuenta creada por ${operator.username}: ${cleanNewUser} (${newUser.role})`);
    return res.status(200).json({ success: true, user: newUser });
  } catch (error) {
    console.error('[API Error] /api/admin/users:', error);
    return res.status(500).json({ success: false, message: 'Error interno al gestionar cuentas de usuario.' });
  }
});

// Subida de emojis mensuales por parte de administradores u owner
app.post('/api/admin/emojis', (req, res) => {
  try {
    const { emojiTag, operatorUsername } = req.body;

    if (!emojiTag || !operatorUsername) {
      return res.status(400).json({ success: false, message: 'Faltan datos para subir el emoji.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'No tienes permisos de administrador para subir emojis.' });
    }

    const cleanTag = emojiTag.trim();
    if (!db.adminEmojis.includes(cleanTag)) {
      db.adminEmojis.push(cleanTag);
      if (operator.role === 'admin') {
        operator.adminActionsCount = (operator.adminActionsCount || 0) + 1;
      }
      console.log(`[Emoji Admin] Nuevo emoji mensual añadido por ${operator.username}: ${cleanTag}`);
    }

    return res.status(200).json({ success: true, adminEmojis: db.adminEmojis });
  } catch (error) {
    console.error('[API Error] /api/admin/emojis:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar el emoji mensual.' });
  }
});

// Solicitud de cambio de nombre de usuario o contraseña enviada a los admins
app.post('/api/users/request-change', (req, res) => {
  try {
    const { username, newUsername, newPassword } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Falta el nombre de usuario.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (newUsername) user.requestedUsername = newUsername.trim();
    if (newPassword) user.requestedPassword = newPassword.trim();

    console.log(`[Solicitud Cambio] El usuario ${user.username} ha solicitado cambios de credenciales.`);
    return res.status(200).json({ success: true, message: 'Solicitud registrada y enviada a los administradores.' });
  } catch (error) {
    console.error('[API Error] /api/users/request-change:', error);
    return res.status(500).json({ success: false, message: 'Error interno al registrar la solicitud.' });
  }
});

// ============================================================================
// SECCIÓN 9: API ENDPOINTS - MERCADO, TIENDA, VENDEDOR E INVENTARIO
// ============================================================================

// Subir nuevo ítem al mercado (Vendedor, Admin u Owner)
app.post('/api/market/item', (req, res) => {
  try {
    const { name, desc, price, type, limited, copies, endpoint, operatorUsername } = req.body;

    if (!name || price === undefined || !operatorUsername) {
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para crear el ítem.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'vendedor')) {
      return res.status(403).json({ success: false, message: 'Permiso denegado. Se requiere rol de Vendedor, Admin u Owner.' });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0 || numericPrice > 9000000000) {
      return res.status(400).json({ success: false, message: 'Precio inválido (debe estar entre 0 y 9 billones).' });
    }

    const newItem = {
      id: db.market.length + 1,
      name: name.trim(),
      desc: desc ? desc.trim() : '',
      price: numericPrice,
      type: type || 'cosmeticos',
      limited: Boolean(limited),
      copies: Number(copies) || 0,
      endpoint: endpoint ? endpoint.trim() : '',
      seller: operator.username,
      createdAt: new Date().toISOString()
    };

    db.market.push(newItem);
    console.log(`[Mercado] Nuevo ítem publicado por ${operator.username}: ${newItem.name} (${newItem.price} coins)`);

    return res.status(200).json({ success: true, market: db.market });
  } catch (error) {
    console.error('[API Error] /api/market/item:', error);
    return res.status(500).json({ success: false, message: 'Error interno al subir el ítem al mercado.' });
  }
});

// Comprar ítem del mercado
app.post('/api/market/buy', (req, res) => {
  try {
    const { username, itemId } = req.body;

    if (!username || itemId === undefined) {
      return res.status(400).json({ success: false, message: 'Faltan username o itemId.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    const item = db.market.find(i => i.id === Number(itemId));

    if (!user || !item) {
      return res.status(404).json({ success: false, message: 'Usuario o ítem del mercado no encontrado.' });
    }

    if (user.restrictions && user.restrictions.removeShop) {
      return res.status(403).json({ success: false, message: 'Tienes la tienda bloqueada por administración.' });
    }

    if (user.coins < item.price) {
      return res.status(400).json({ success: false, message: 'Inútil Coins insuficientes para realizar esta compra.' });
    }

    // Comprobación de copias limitadas (Limited U)
    if (item.limited) {
      if (item.copies <= 0) {
        return res.status(400).json({ success: false, message: 'Este ítem Limited U se encuentra agotado.' });
      }
      item.copies -= 1;
    }

    user.coins -= item.price;
    const inventoryItem = {
      ...item,
      inventoryId: Date.now() + Math.random(),
      equipped: false,
      acquiredAt: new Date().toLocaleString()
    };

    user.inventory.push(inventoryItem);

    // Activación automática de la Llave 1 si el ítem contiene el endpoint o marcador
    if (item.endpoint === 'key1' || (item.desc && item.desc.includes('[item?_key1]'))) {
      db.keys.key1 = true;
      console.log(`[Llave Desbloqueada] ¡La Llave 1 ha sido activada en el sistema general!`);
    }

    console.log(`[Compra Exitosa] ${user.username} compró ${item.name} por ${item.price} coins.`);
    return res.status(200).json({ success: true, user, market: db.market });
  } catch (error) {
    console.error('[API Error] /api/market/buy:', error);
    return res.status(500).json({ success: false, message: 'Error interno durante el proceso de compra.' });
  }
});

// Reventa de ítems Limited U una vez agotadas las copias
app.post('/api/market/resell', (req, res) => {
  try {
    const { username, itemId, resellPrice } = req.body;

    if (!username || itemId === undefined || resellPrice === undefined) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros para la reventa.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const itemIndex = user.inventory.findIndex(i => i.id === Number(itemId) || i.inventoryId === Number(itemId));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'El ítem no se encuentra en tu inventario.' });
    }

    const itemToResell = user.inventory[itemIndex];
    if (!itemToResell.limited) {
      return res.status(400).json({ success: false, message: 'Solo se pueden revender ítems marcados como Limited U.' });
    }

    // Remover del inventario del usuario
    user.inventory.splice(itemIndex, 1);

    // Publicar de nuevo en el mercado como reventa
    const resellItem = {
      id: db.market.length + 1,
      name: `${itemToResell.name} (Reventa de ${user.username})`,
      desc: itemToResell.desc,
      price: Number(resellPrice),
      type: itemToResell.type,
      limited: true,
      copies: 1,
      endpoint: itemToResell.endpoint,
      seller: user.username,
      createdAt: new Date().toISOString()
    };

    db.market.push(resellItem);
    console.log(`[Reventa Limited] ${user.username} ha revendido ${itemToResell.name} por ${resellPrice} coins.`);

    return res.status(200).json({ success: true, user, market: db.market });
  } catch (error) {
    console.error('[API Error] /api/market/resell:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar la reventa.' });
  }
});

// Equipar o desequipar cosméticos en el perfil
app.post('/api/inventory/equip', (req, res) => {
  try {
    const { username, itemId } = req.body;

    if (!username || itemId === undefined) {
      return res.status(400).json({ success: false, message: 'Faltan datos para equipar el ítem.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const invItem = user.inventory.find(i => i.id === Number(itemId) || i.inventoryId === Number(itemId));
    if (!invItem) {
      return res.status(404).json({ success: false, message: 'El ítem no pertenece al inventario del usuario.' });
    }

    invItem.equipped = !invItem.equipped;
    console.log(`[Equipamiento] ${user.username} cambió estado de ${invItem.name} a equipped=${invItem.equipped}`);

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('[API Error] /api/inventory/equip:', error);
    return res.status(500).json({ success: false, message: 'Error interno al equipar el ítem.' });
  }
});

// ============================================================================
// SECCIÓN 10: API ENDPOINTS - MISIONES, EVENTOS Y BUZÓN DE IDEAS
// ============================================================================

// Crear misiones personalizadas (Hasta 3 misiones activas elegidas por el banquero/admin)
app.post('/api/missions', (req, res) => {
  try {
    const { text, reward, operatorUsername } = req.body;

    if (!text || reward === undefined || !operatorUsername) {
      return res.status(400).json({ success: false, message: 'Faltan datos para crear la misión.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin' && operator.role !== 'banquero')) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para crear misiones.' });
    }

    const numericReward = Number(reward);
    if (isNaN(numericReward) || numericReward < 1 || numericReward > 100) {
      return res.status(400).json({ success: false, message: 'Las misiones deben otorgar entre 1 y 100 Inútil Coins.' });
    }

    // Limitar a máximo 3 misiones activas como se especificó
    if (db.missions.length >= 3) {
      db.missions.shift(); // Eliminar la más antigua
    }

    const newMission = {
      id: db.missions.length + 1,
      text: text.trim(),
      reward: numericReward,
      createdBy: operator.username,
      createdAt: new Date().toLocaleTimeString()
    };

    db.missions.push(newMission);
    console.log(`[Misión Creada] ${operator.username} creó misión: "${newMission.text}" (+${numericReward} coins)`);

    return res.status(200).json({ success: true, missions: db.missions });
  } catch (error) {
    console.error('[API Error] /api/missions:', error);
    return res.status(500).json({ success: false, message: 'Error interno al crear la misión.' });
  }
});

// Crear eventos especiales de administración
app.post('/api/events', (req, res) => {
  try {
    const { name, desc, banner, operatorUsername } = req.body;

    if (!name || !operatorUsername) {
      return res.status(400).json({ success: false, message: 'Faltan el nombre del evento o el operador.' });
    }

    const operator = db.users.find(u => u.username === operatorUsername.trim());
    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Solo los administradores u owner pueden crear eventos.' });
    }

    const newEvent = {
      id: db.events.length + 1,
      name: name.trim(),
      desc: desc ? desc.trim() : '',
      banner: banner ? banner.trim() : '',
      createdAt: new Date().toLocaleString()
    };

    db.events.push(newEvent);
    db.activeEvent = newEvent;

    console.log(`[Evento Creado] ${operator.username} lanzó el evento: ${newEvent.name}`);
    return res.status(200).json({ success: true, events: db.events });
  } catch (error) {
    console.error('[API Error] /api/events:', error);
    return res.status(500).json({ success: false, message: 'Error interno al crear el evento.' });
  }
});

// Buzón de ideas y sugerencias para juegos en el patio
app.post('/api/ideas', (req, res) => {
  try {
    const { username, idea } = req.body;

    if (!username || !idea) {
      return res.status(400).json({ success: false, message: 'Faltan username o texto de la idea.' });
    }

    const cleanUser = username.trim();
    const cleanIdea = idea.trim();

    const newIdea = {
      id: db.ideas.length + 1,
      username: cleanUser,
      idea: cleanIdea,
      time: new Date().toLocaleString()
    };

    db.ideas.push(newIdea);
    console.log(`[Buzón de Ideas] Nueva sugerencia de ${cleanUser}: ${cleanIdea}`);

    return res.status(200).json({ success: true, ideas: db.ideas });
  } catch (error) {
    console.error('[API Error] /api/ideas:', error);
    return res.status(500).json({ success: false, message: 'Error interno al registrar la idea.' });
  }
});

// Formulario trimestral (Abierto 1 mes por trimestre)
app.post('/api/trimster/apply', (req, res) => {
  try {
    const { applicantName, reason } = req.body;

    if (!db.trimsterFormOpen) {
      return res.status(400).json({ success: false, message: 'El formulario de admisión trimestral se encuentra cerrado actualmente.' });
    }

    if (!applicantName || !reason) {
      return res.status(400).json({ success: false, message: 'Faltan datos en la postulación.' });
    }

    db.trimsterApplications.push({
      applicantName: applicantName.trim(),
      reason: reason.trim(),
      time: new Date().toLocaleString()
    });

    console.log(`[Formulario Trimestral] Nueva solicitud recibida de: ${applicantName}`);
    return res.status(200).json({ success: true, message: 'Postulación enviada correctamente.' });
  } catch (error) {
    console.error('[API Error] /api/trimster/apply:', error);
    return res.status(500).json({ success: false, message: 'Error al procesar la solicitud trimestral.' });
  }
});

// Alternar apertura/cierre del formulario trimestral
app.post('/api/trimster/toggle', (req, res) => {
  try {
    const { operatorUsername, open } = req.body;
    const operator = db.users.find(u => u.username === operatorUsername?.trim());

    if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Permiso denegado.' });
    }

    db.trimsterFormOpen = Boolean(open);
    console.log(`[Trimestre] Formulario trimestral establecido en: ${db.trimsterFormOpen}`);

    return res.status(200).json({ success: true, trimsterFormOpen: db.trimsterFormOpen });
  } catch (error) {
    console.error('[API Error] /api/trimster/toggle:', error);
    return res.status(500).json({ success: false, message: 'Error interno al cambiar estado trimestral.' });
  }
});

// ============================================================================
// SECCIÓN 11: API ENDPOINTS - PERFILES, PUBLICACIONES Y COMENTARIOS
// ============================================================================

// Publicar en el feed del perfil
app.post('/api/posts', (req, res) => {
  try {
    const { username, content } = req.body;

    if (!username || !content) {
      return res.status(400).json({ success: false, message: 'Faltan usuario o contenido de la publicación.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.restrictions && user.restrictions.blockPosts) {
      return res.status(403).json({ success: false, message: 'Tienes prohibido hacer publicaciones en tu perfil.' });
    }

    const newPost = {
      id: user.posts.length + 1,
      content: content.trim(),
      time: new Date().toLocaleString()
    };

    user.posts.push(newPost);
    console.log(`[Publicación] ${user.username} ha publicado en su perfil.`);

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('[API Error] /api/posts:', error);
    return res.status(500).json({ success: false, message: 'Error interno al crear la publicación.' });
  }
});

// Comentarios en muros de perfil de otros usuarios
app.post('/api/profile/comment', (req, res) => {
  try {
    const { profileUser, author, comment } = req.body;

    if (!profileUser || !author || !comment) {
      return res.status(400).json({ success: false, message: 'Faltan datos para registrar el comentario.' });
    }

    const targetUser = db.users.find(u => u.username === profileUser.trim());
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Perfil de usuario no localizado.' });
    }

    if (!targetUser.comments) targetUser.comments = [];

    const newComment = {
      id: targetUser.comments.length + 1,
      author: author.trim(),
      comment: comment.trim(),
      time: new Date().toLocaleString()
    };

    targetUser.comments.push(newComment);
    console.log(`[Comentario de Perfil] ${author} comentó en el perfil de ${targetUser.username}`);

    return res.status(200).json({ success: true, user: targetUser });
  } catch (error) {
    console.error('[API Error] /api/profile/comment:', error);
    return res.status(500).json({ success: false, message: 'Error interno al publicar el comentario.' });
  }
});

// Actualizar foto de perfil (pfp)
app.post('/api/profile/update', (req, res) => {
  try {
    const { username, pfp } = req.body;

    if (!username || !pfp) {
      return res.status(400).json({ success: false, message: 'Faltan username o URL de la foto de perfil.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    user.pfp = pfp.trim();
    console.log(`[Actualización PFP] ${user.username} cambió su foto de perfil.`);

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('[API Error] /api/profile/update:', error);
    return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
  }
});

// ============================================================================
// SECCIÓN 12: API ENDPOINTS - CÁRCEL DE MARIO Y SISTEMA DE LLAVES
// ============================================================================

// Intentar desbloquear las cerraduras de la Cárcel de Mario
app.post('/api/jail/unlock', (req, res) => {
  try {
    const { lockNum, username } = req.body;

    if (lockNum === undefined || !username) {
      return res.status(400).json({ success: false, message: 'Faltan número de cerradura o username.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.restrictions && user.restrictions.removeJail) {
      return res.status(403).json({ success: false, message: 'Tienes prohibido interactuar con la Cárcel de Mario.' });
    }

    const numericLock = Number(lockNum);

    if (numericLock === 1) {
      if (db.keys.key1) {
        db.keys.lock1 = true;
        return res.status(200).json({ success: true, message: '¡Cerradura 1 abierta con éxito utilizando la Llave Maestra de la tienda!' });
      }
      return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Necesitas comprar la Llave Maestra 1 en los extras de la tienda por 1000 Inútil Coins.' });
    } 
    else if (numericLock === 2) {
      if (db.keys.key2) {
        db.keys.lock2 = true;
        return res.status(200).json({ success: true, message: '¡Cerradura 2 abierta con éxito utilizando la llave verde oculta en perfiles!' });
      }
      return res.status(400).json({ success: false, message: 'Cerradura bloqueada. Debes encontrar y recoger la pequeña llave verde oculta en la esquina de los perfiles.' });
    } 
    else if (numericLock === 3) {
      return res.status(400).json({ success: false, message: 'Cerradura 3 impenetrable. Sellada mágicamente y reservada para la versión 2.0.' });
    }

    return res.status(400).json({ success: false, message: 'Número de cerradura inválido.' });
  } catch (error) {
    console.error('[API Error] /api/jail/unlock:', error);
    return res.status(500).json({ success: false, message: 'Error interno al intentar abrir la cerradura.' });
  }
});

// Recoger la Llave 2 verde escondida en la pestaña de perfiles
app.post('/api/keys/collect-key2', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Falta el nombre de usuario.' });
    }

    const user = db.users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    db.keys.key2 = true;
    console.log(`[Llave Verde] ${user.username} ha recogido la Llave 2 verde de la esquina de perfiles.`);

    return res.status(200).json({ success: true, message: '¡Has recogido la Llave 2 verde con éxito!' });
  } catch (error) {
    console.error('[API Error] /api/keys/collect-key2:', error);
    return res.status(500).json({ success: false, message: 'Error al recoger la llave verde.' });
  }
});

// ============================================================================
// SECCIÓN 13: ARRANQUE OFICIAL DEL SERVIDOR HTTP Y WORKERS
// ============================================================================

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log('=================================================================');
  console.log(`🚀 LA WEB INÚTIL - SERVIDOR BACKEND ACTIVO Y ESCUCHANDO`);
  console.log(`🌐 Puerto asignado: ${PORT}`);
  console.log(`⏰ Hora de arranque: ${new Date().toLocaleString()}`);
  console.log('=================================================================');
  
  // Iniciar worker anti-sleep para Render
  startAntiSleepWorker();
});

// Manejo robusto de errores no capturados para evitar caídas del servidor
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL Uncaught Exception]:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL Unhandled Rejection]:', reason);
});
