/**
 * Metrifique-se CRM - Real WhatsApp Baileys Engine
 * Runs a real WhatsApp Multi-Device WebSocket client, generates authentic QR codes,
 * and synchronizes messages and contacts in real time with the CRM.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');

const PORT = process.env.WHATSAPP_PORT || 8006;
const AUTH_DIR = path.join(__dirname, '../.whatsapp_auth');

// In-memory state
let sock = null;
let connectionState = {
  status: 'disconnected', // 'disconnected', 'connecting', 'qrcode', 'connected'
  qr: null,
  qrRaw: null,
  user: null,
  lastError: null,
  updatedAt: new Date().toISOString()
};

const chatsMap = new Map();

async function startWhatsApp() {
  if (sock && connectionState.status === 'connected') {
    return;
  }

  connectionState.status = 'connecting';
  connectionState.updatedAt = new Date().toISOString();

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    if (state.creds && state.creds.me) {
      const me = state.creds.me;
      const phone = (me.id || '').split(':')[0] || (me.id || '').split('@')[0];
      connectionState.status = 'connected';
      connectionState.qr = null;
      connectionState.qrRaw = null;
      connectionState.user = {
        id: me.id,
        phone: `+${phone}`,
        name: me.name || 'WhatsApp Conectado'
      };
      console.log(`[Baileys] Sessão autenticada carregada: +${phone} (${connectionState.user.name})`);
    }

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Metrifique-se CRM', 'Chrome', '120.0.0.0'],
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Se temos dados do usuário em creds ou sock.user, já está conectado!
      if (sock.user || state.creds?.me) {
        const me = sock.user || state.creds?.me;
        const phone = (me.id || '').split(':')[0] || (me.id || '').split('@')[0];
        connectionState.status = 'connected';
        connectionState.qr = null;
        connectionState.qrRaw = null;
        connectionState.user = {
          id: me.id,
          phone: `+${phone}`,
          name: me.name || 'WhatsApp Conectado'
        };
        connectionState.updatedAt = new Date().toISOString();
      }

      if (qr && !state.creds?.me && !sock.user) {
        connectionState.status = 'qrcode';
        connectionState.qrRaw = qr;
        try {
          connectionState.qr = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            color: {
              dark: '#111827',
              light: '#FFFFFF'
            }
          });
        } catch (err) {
          console.error('[Baileys] Erro ao renderizar QR code para dataURL:', err);
        }
        connectionState.updatedAt = new Date().toISOString();
        console.log('[Baileys] Novo QR Code real gerado pronto para leitura no celular!');
      }

      if (connection === 'open') {
        const userId = sock.user?.id || state.creds?.me?.id || '';
        const phone = userId.split(':')[0] || userId.split('@')[0];
        const name = sock.user?.name || state.creds?.me?.name || 'WhatsApp Metrifique-se';

        connectionState.status = 'connected';
        connectionState.qr = null;
        connectionState.qrRaw = null;
        connectionState.user = {
          id: userId,
          phone: `+${phone}`,
          name: name
        };
        connectionState.updatedAt = new Date().toISOString();
        console.log(`[Baileys] CONECTADO COM SUCESSO! Telefone: +${phone} (${name})`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Baileys] Conexão encerrada. Motivo: ${statusCode}. Reconectar? ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          connectionState.status = 'disconnected';
          connectionState.user = null;
          connectionState.qr = null;
          connectionState.qrRaw = null;
          // Limpa sessão local
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
        } else {
          connectionState.status = 'connecting';
          setTimeout(() => {
            startWhatsApp();
          }, 3000);
        }
        connectionState.updatedAt = new Date().toISOString();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
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

        let chat = chatsMap.get(jid);
        if (!chat) {
          chat = {
            id: `chat-${phone}`,
            jid: jid,
            phone: `+${phone}`,
            name: pushName,
            avatar: '../assets/images/profile/user-1.jpg',
            last_message: text,
            last_message_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            unread_count: isMe ? 0 : 1,
            messages: []
          };
          chatsMap.set(jid, chat);
        }

        if (text) {
          chat.last_message = text;
          chat.last_message_time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          if (!isMe) chat.unread_count++;

          chat.messages.push({
            id: key.id || 'msg-' + Date.now(),
            from_me: isMe,
            text: text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: isMe ? 'delivered' : 'read',
            sender_name: isMe ? 'Atendente' : pushName
          });

          // Mantém as últimas 100 mensagens
          if (chat.messages.length > 100) {
            chat.messages.shift();
          }
        }
      }
    });

  } catch (err) {
    console.error('[Baileys Error]', err);
    connectionState.status = 'disconnected';
    connectionState.lastError = err.message;
    connectionState.updatedAt = new Date().toISOString();
  }
}

async function resolveWhatsAppJid(rawNumber) {
  let clean = (rawNumber || '').replace(/\D/g, '');
  if (!clean) return null;

  // Se tiver 10 ou 11 dígitos, é celular brasileiro (DDD + número): adiciona 55!
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  } else if (clean.length === 8 || clean.length === 9) {
    // Se tiver 8 ou 9 dígitos, usa DDD 48 (Florianópolis) ou o DDD do usuário conectado
    const myDdd = (connectionState.user?.phone || '5548').slice(2, 4) || '48';
    clean = '55' + myDdd + clean;
  }

  // Tenta verificar existência no WhatsApp via sock.onWhatsApp
  if (sock) {
    try {
      // 1. Tenta com o número exato
      const check1 = await sock.onWhatsApp(clean);
      if (check1 && check1.length > 0 && check1[0].exists) {
        console.log(`[Baileys JID Check] Número ${clean} validado: ${check1[0].jid}`);
        return check1[0].jid;
      }

      // 2. Se for número brasileiro com 9º dígito (13 dígitos: 55 + DDD + 9 + 8 dígitos), tenta sem o 9
      if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
        const without9 = clean.slice(0, 4) + clean.slice(5);
        const check2 = await sock.onWhatsApp(without9);
        if (check2 && check2.length > 0 && check2[0].exists) {
          console.log(`[Baileys JID Check] Número validado sem o 9º dígito: ${check2[0].jid}`);
          return check2[0].jid;
        }
      }

      // 3. Se for número brasileiro sem 9º dígito (12 dígitos: 55 + DDD + 8 dígitos), tenta com o 9
      if (clean.startsWith('55') && clean.length === 12) {
        const with9 = clean.slice(0, 4) + '9' + clean.slice(4);
        const check3 = await sock.onWhatsApp(with9);
        if (check3 && check3.length > 0 && check3[0].exists) {
          console.log(`[Baileys JID Check] Número validado com o 9º dígito: ${check3[0].jid}`);
          return check3[0].jid;
        }
      }
    } catch (err) {
      console.warn('[Baileys onWhatsApp Check Failed]', err);
    }
  }

  return `${clean}@s.whatsapp.net`;
}

// Inicia servidor HTTP
const server = http.createServer(async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ROTA 1: Status e QR Code
  if (pathname === '/api/whatsapp/status' || pathname === '/status') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(connectionState));
  }

  // ROTA 2: Solicitar Conexão / Gerar QR Code
  if (pathname === '/api/whatsapp/connect' || pathname === '/connect') {
    if (connectionState.status !== 'connected') {
      startWhatsApp();
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      message: 'Iniciando conexão com WhatsApp...',
      state: connectionState
    }));
  }

  // ROTA 3: Desconectar
  if (pathname === '/api/whatsapp/disconnect' || pathname === '/disconnect') {
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {}
    }
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch (e) {}

    sock = null;
    connectionState = {
      status: 'disconnected',
      qr: null,
      qrRaw: null,
      user: null,
      lastError: null,
      updatedAt: new Date().toISOString()
    };
    chatsMap.clear();

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true, message: 'WhatsApp desconectado com sucesso.' }));
  }

  // ROTA 4: Listar Chats
  if (pathname === '/api/whatsapp/chats' || pathname === '/chats') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(Array.from(chatsMap.values())));
  }

  // ROTA 5: Enviar Mensagem Real
  if (pathname === '/api/whatsapp/send' || pathname === '/send') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: 'Use POST' }));
    }

    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const phone = (body.phone || body.number || '').replace(/\D/g, '');
        const text = body.text || body.message || '';

        if (!phone || !text) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'phone e text são obrigatórios.' }));
        }

        if (!sock || connectionState.status !== 'connected') {
          res.statusCode = 503;
          return res.end(JSON.stringify({ error: 'WhatsApp não está conectado no momento.' }));
        }

        const targetJid = await resolveWhatsAppJid(phone);
        console.log(`[Baileys Send] Enviando mensagem para JID: ${targetJid} (Entrada: ${phone}) | Texto: "${text}"`);

        const sent = await sock.sendMessage(targetJid, { text: text });
        console.log(`[Baileys Send] Mensagem entregue com sucesso! ID: ${sent.key.id}`);

        // Atualiza chat local
        let chat = chatsMap.get(targetJid);
        if (chat) {
          chat.last_message = text;
          chat.last_message_time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          chat.messages.push({
            id: sent.key.id || 'msg-' + Date.now(),
            from_me: true,
            text: text,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered',
            sender_name: 'Atendente'
          });
        }

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, messageId: sent.key.id }));
      } catch (err) {
        console.error('[Send Error]', err);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

server.listen(PORT, () => {
  console.log(`[Metrifique-se WhatsApp Server] Rodando na porta ${PORT}`);
  // Inicia Baileys imediatamente para já preparar QR code se não estiver conectado
  startWhatsApp();
});

