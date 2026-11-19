/**
 * Metrifique-se CRM - Multi-Instance WhatsApp Baileys Engine
 * Runs multiple concurrent WhatsApp Multi-Device WebSocket sessions,
 * generates authentic QR codes per account, and synchronizes messages in real time.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');

const PORT = process.env.WHATSAPP_PORT || 8006;
const DEFAULT_AUTH_DIR = path.join(__dirname, '../.whatsapp_auth');
const SESSIONS_ROOT = path.join(__dirname, '../.whatsapp_auth_sessions');

// Multi-instance registry keyed by sanitized accountId
const instances = new Map();

function sanitizeAccountId(raw) {
  const cleaned = String(raw || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || 'default';
}

function getAuthDir(accountId) {
  return accountId === 'default' ? DEFAULT_AUTH_DIR : path.join(SESSIONS_ROOT, accountId);
}

function createInitialState(accountId, label) {
  return {
    accountId,
    label: label || (accountId === 'default' ? 'WhatsApp Principal' : accountId),
    status: 'disconnected', // 'disconnected', 'connecting', 'qrcode', 'connected'
    qr: null,
    qrRaw: null,
    user: null,
    lastError: null,
    updatedAt: new Date().toISOString()
  };
}

function getOrCreateInstance(rawAccountId = 'default', label = '') {
  const accountId = sanitizeAccountId(rawAccountId);
  let inst = instances.get(accountId);
  if (!inst) {
    inst = {
      id: accountId,
      label: label || (accountId === 'default' ? 'WhatsApp Principal' : accountId),
      authDir: getAuthDir(accountId),
      sock: null,
      starting: false,
      reconnectTimer: null,
      state: createInitialState(accountId, label),
      chatsMap: new Map()
    };
    instances.set(accountId, inst);
  } else if (label && label.trim()) {
    inst.label = label.trim();
    inst.state.label = inst.label;
  }
  return inst;
}

function serializeAccountSummary(inst) {
  return {
    id: inst.id,
    label: inst.label,
    status: inst.state.status,
    qr: inst.state.qr,
    user: inst.state.user,
    lastError: inst.state.lastError,
    updatedAt: inst.state.updatedAt,
    chatsCount: inst.chatsMap.size
  };
}

async function startWhatsApp(rawAccountId = 'default', label = '') {
  const inst = getOrCreateInstance(rawAccountId, label);
  if ((inst.sock && inst.state.status === 'connected') || inst.starting) {
    return inst;
  }

  if (inst.reconnectTimer) {
    clearTimeout(inst.reconnectTimer);
    inst.reconnectTimer = null;
  }

  inst.starting = true;
  inst.state.status = 'connecting';
  inst.state.lastError = null;
  inst.state.updatedAt = new Date().toISOString();

  if (!fs.existsSync(inst.authDir)) {
    fs.mkdirSync(inst.authDir, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(inst.authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    if (state.creds && state.creds.me) {
      const me = state.creds.me;
      const phone = (me.id || '').split(':')[0] || (me.id || '').split('@')[0];
      inst.state.status = 'connected';
      inst.state.qr = null;
      inst.state.qrRaw = null;
      inst.state.user = {
        id: me.id,
        phone: `+${phone}`,
        name: me.name || inst.label || 'WhatsApp Conectado'
      };
      console.log(`[Baileys:${inst.id}] Sessao autenticada carregada: +${phone} (${inst.state.user.name})`);
    }

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Metrifique-se CRM', 'Chrome', '120.0.0.0'],
      syncFullHistory: false
    });

    inst.sock = sock;
    inst.starting = false;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (sock.user || state.creds?.me) {
        const me = sock.user || state.creds?.me;
        const phone = (me.id || '').split(':')[0] || (me.id || '').split('@')[0];
        inst.state.status = 'connected';
        inst.state.qr = null;
        inst.state.qrRaw = null;
        inst.state.user = {
          id: me.id,
          phone: `+${phone}`,
          name: me.name || inst.label || 'WhatsApp Conectado'
        };
        inst.state.updatedAt = new Date().toISOString();
      }

      if (qr && !state.creds?.me && !sock.user) {
        inst.state.status = 'qrcode';
        inst.state.qrRaw = qr;
        try {
          inst.state.qr = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: {
              dark: '#09090B',
              light: '#FFFFFF'
            }
          });
        } catch (err) {
          console.error(`[Baileys:${inst.id}] Erro ao renderizar QR code:`, err);
        }
        inst.state.updatedAt = new Date().toISOString();
        console.log(`[Baileys:${inst.id}] Novo QR Code real gerado pronto para leitura!`);
      }

      if (connection === 'open') {
        const userId = sock.user?.id || state.creds?.me?.id || '';
        const phone = userId.split(':')[0] || userId.split('@')[0];
        const name = sock.user?.name || state.creds?.me?.name || inst.label || 'WhatsApp Metrifique-se';

        inst.state.status = 'connected';
        inst.state.qr = null;
        inst.state.qrRaw = null;
        inst.state.user = {
          id: userId,
          phone: `+${phone}`,
          name
        };
        inst.state.updatedAt = new Date().toISOString();
        console.log(`[Baileys:${inst.id}] CONECTADO! Telefone: +${phone} (${name})`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Baileys:${inst.id}] Conexao encerrada. Motivo: ${statusCode}. Reconectar? ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          inst.sock = null;
          inst.state.status = 'disconnected';
          inst.state.user = null;
          inst.state.qr = null;
          inst.state.qrRaw = null;
          try {
            fs.rmSync(inst.authDir, { recursive: true, force: true });
          } catch (e) {}
        } else if (instances.has(inst.id)) {
          inst.sock = null;
          inst.state.status = 'connecting';
          inst.reconnectTimer = setTimeout(() => {
            startWhatsApp(inst.id, inst.label);
          }, 3000);
        }
        inst.state.updatedAt = new Date().toISOString();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!messages || messages.length === 0) return;

      for (const m of messages) {
        const key = m.key;
        if (!key || !key.remoteJid) continue;
        const jid = key.remoteJid;
        if (jid.endsWith('@g.us')) continue; // ignora grupos

        const text = m.message?.conversation ||
                     m.message?.extendedTextMessage?.text ||
                     m.message?.imageMessage?.caption ||
                     '';

        const phone = jid.split('@')[0];
        const isMe = key.fromMe === true;
        const pushName = m.pushName || (isMe ? 'Eu' : `+${phone}`);

        let chat = inst.chatsMap.get(jid);
        if (!chat) {
          chat = {
            id: inst.id === 'default' ? `chat-${phone}` : `chat-${inst.id}-${phone}`,
            account_id: inst.id,
            jid,
            phone: `+${phone}`,
            name: pushName,
            avatar: '../assets/images/profile/user-1.jpg',
            last_message: text,
            last_message_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            unread_count: isMe ? 0 : 1,
            messages: []
          };
          inst.chatsMap.set(jid, chat);
        }

        if (text) {
          chat.last_message = text;
          chat.last_message_time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          if (!isMe) chat.unread_count++;

          chat.messages.push({
            id: key.id || 'msg-' + Date.now(),
            from_me: isMe,
            text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: isMe ? 'delivered' : 'read',
            sender_name: isMe ? 'Atendente' : pushName
          });

          if (chat.messages.length > 100) {
            chat.messages.shift();
          }
        }
      }
    });

    return inst;
  } catch (err) {
    console.error(`[Baileys:${inst.id} Error]`, err);
    inst.starting = false;
    inst.sock = null;
    inst.state.status = 'disconnected';
    inst.state.lastError = err.message;
    inst.state.updatedAt = new Date().toISOString();
    return inst;
  }
}

async function resolveWhatsAppJid(inst, rawNumber) {
  let clean = (rawNumber || '').replace(/\D/g, '');
  if (!clean) return null;

  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  } else if (clean.length === 8 || clean.length === 9) {
    const myDdd = (inst.state.user?.phone || '5548').slice(2, 4) || '48';
    clean = '55' + myDdd + clean;
  }

  if (inst.sock) {
    try {
      const check1 = await inst.sock.onWhatsApp(clean);
      if (check1 && check1.length > 0 && check1[0].exists) {
        return check1[0].jid;
      }

      if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
        const without9 = clean.slice(0, 4) + clean.slice(5);
        const check2 = await inst.sock.onWhatsApp(without9);
        if (check2 && check2.length > 0 && check2[0].exists) {
          return check2[0].jid;
        }
      }

      if (clean.startsWith('55') && clean.length === 12) {
        const with9 = clean.slice(0, 4) + '9' + clean.slice(4);
        const check3 = await inst.sock.onWhatsApp(with9);
        if (check3 && check3.length > 0 && check3[0].exists) {
          return check3[0].jid;
        }
      }
    } catch (err) {
      console.warn(`[Baileys:${inst.id}] onWhatsApp check failed:`, err);
    }
  }

  return `${clean}@s.whatsapp.net`;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', () => {
      try {
        resolve(bodyStr ? JSON.parse(bodyStr) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// HTTP API server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const queryAccountId = url.searchParams.get('accountId');

  // ROUTE 0: List all WhatsApp instances
  if (pathname === '/api/whatsapp/accounts' || pathname === '/accounts') {
    getOrCreateInstance('default');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(Array.from(instances.values()).map(serializeAccountSummary)));
  }

  // ROUTE 1: Status and QR Code for a specific accountId
  if (pathname === '/api/whatsapp/status' || pathname === '/status') {
    const inst = getOrCreateInstance(queryAccountId || 'default');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(inst.state));
  }

  // ROUTE 2: Start connection / generate QR code for accountId
  if (pathname === '/api/whatsapp/connect' || pathname === '/connect') {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const targetId = body.accountId || queryAccountId || 'default';
    const label = body.label || url.searchParams.get('label') || '';
    const inst = await startWhatsApp(targetId, label);

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      message: `Iniciando conexao com WhatsApp (${inst.id})...`,
      state: inst.state
    }));
  }

  // ROUTE 3: Disconnect / remove instance
  if (pathname === '/api/whatsapp/disconnect' || pathname === '/disconnect') {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const targetId = sanitizeAccountId(body.accountId || queryAccountId || 'default');
    const shouldRemove = body.remove === true || url.searchParams.get('remove') === '1';
    const inst = instances.get(targetId);

    if (inst) {
      if (inst.reconnectTimer) {
        clearTimeout(inst.reconnectTimer);
        inst.reconnectTimer = null;
      }
      if (inst.sock) {
        try {
          await inst.sock.logout();
        } catch (e) {}
        try {
          inst.sock.end();
        } catch (e) {}
      }
      try {
        fs.rmSync(inst.authDir, { recursive: true, force: true });
      } catch (e) {}

      inst.sock = null;
      inst.starting = false;
      inst.chatsMap.clear();
      inst.state = createInitialState(inst.id, inst.label);

      if (shouldRemove && inst.id !== 'default') {
        instances.delete(inst.id);
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      accountId: targetId,
      message: `WhatsApp (${targetId}) desconectado com sucesso.`
    }));
  }

  // ROUTE 4: List chats (specific accountId or all)
  if (pathname === '/api/whatsapp/chats' || pathname === '/chats') {
    const filterId = queryAccountId;
    let allChats = [];
    if (filterId && filterId !== 'all') {
      const inst = instances.get(sanitizeAccountId(filterId));
      allChats = inst ? Array.from(inst.chatsMap.values()) : [];
    } else {
      for (const inst of instances.values()) {
        allChats.push(...inst.chatsMap.values());
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(allChats));
  }

  // ROUTE 5: Send real WhatsApp message using target accountId
  if (pathname === '/api/whatsapp/send' || pathname === '/send') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: 'Use POST' }));
    }

    const body = await readJsonBody(req);
    try {
      const targetId = sanitizeAccountId(body.accountId || queryAccountId || 'default');
      const phone = (body.phone || body.number || '').replace(/\D/g, '');
      const text = body.text || body.message || '';

      if (!phone || !text) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'phone e text sao obrigatorios.' }));
      }

      const inst = instances.get(targetId);
      if (!inst || !inst.sock || inst.state.status !== 'connected') {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: `WhatsApp (${targetId}) nao esta conectado no momento.` }));
      }

      const targetJid = await resolveWhatsAppJid(inst, phone);
      console.log(`[Baileys:${inst.id}] Enviando mensagem para JID: ${targetJid}`);

      const sent = await inst.sock.sendMessage(targetJid, { text });

      const chat = inst.chatsMap.get(targetJid);
      if (chat) {
        chat.last_message = text;
        chat.last_message_time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        chat.messages.push({
          id: sent.key.id || 'msg-' + Date.now(),
          from_me: true,
          text,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'delivered',
          sender_name: 'Atendente'
        });
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, accountId: inst.id, messageId: sent.key.id }));
    } catch (err) {
      console.error('[Send Error]', err);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Rota nao encontrada' }));
});

server.listen(PORT, () => {
  console.log(`[Metrifique-se WhatsApp Multi-Instance Server] Rodando na porta ${PORT}`);
  startWhatsApp('default', 'WhatsApp Principal');

  // Auto-restore secondary paired sessions
  try {
    if (fs.existsSync(SESSIONS_ROOT)) {
      const dirs = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true }).filter(d => d.isDirectory());
      dirs.forEach(d => {
        const credsPath = path.join(SESSIONS_ROOT, d.name, 'creds.json');
        if (fs.existsSync(credsPath)) {
          startWhatsApp(d.name);
        }
      });
    }
  } catch (e) {
    console.warn('[WhatsApp Server] Erro ao restaurar sessoes secundarias:', e);
  }
});
