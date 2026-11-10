/**
 * Metrifique-se CRM - Webhook Handler para WhatsApp (Evolution API / Z-API / Baileys)
 * Recebe eventos de mensagens, atualização de conexão e leitura de QR Code.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://syvqisjpulryjlgksjrk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_O0sjGeACkgzBZJOlMMGpaA_LMHn3Ihl';

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  return { ok: response.ok, status: response.status, data };
}

async function handleWhatsAppWebhook(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      service: 'Metrifique-se CRM WhatsApp Webhook',
      status: 'active',
      timestamp: new Date().toISOString()
    }));
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método não permitido. Use POST.' }));
  }

  try {
    // Ler o body da requisição
    let body = req.body;
    if (!body || typeof body === 'string') {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const dataStr = Buffer.concat(buffers).toString();
      try {
        body = dataStr ? JSON.parse(dataStr) : {};
      } catch (e) {
        body = {};
      }
    }

    const event = body.event || body.type || 'messages.upsert';
    const instance = body.instance || body.instanceName || 'metrifiquese-master';

    console.log(`[WhatsApp Webhook] Evento: ${event} | Instância: ${instance}`);

    // Tratar evento de mensagem recebida (messages.upsert)
    if (event.includes('messages') || event.includes('message')) {
      const msgData = body.data || body;
      const key = msgData.key || {};
      const remoteJid = key.remoteJid || body.remoteJid || '';
      const fromMe = key.fromMe === true || body.fromMe === true;

      // Ignora mensagens de grupos se terminar em @g.us
      if (remoteJid.endsWith('@g.us')) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, ignored: 'group_message' }));
      }

      // Extrai texto da mensagem
      const messageContent = msgData.message || body.message || {};
      const text = messageContent.conversation || 
                   messageContent.extendedTextMessage?.text || 
                   body.text || 
                   body.body || 
                   '';

      const pushName = msgData.pushName || body.pushName || 'Contato WhatsApp';
      const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

      if (cleanPhone && text) {
        console.log(`[WhatsApp Webhook] Mensagem de ${pushName} (${cleanPhone}): "${text}" (fromMe: ${fromMe})`);

        // Tenta localizar Lead com esse telefone no Supabase
        const { ok, data: matchedLeads } = await supabaseFetch(
          `leads?phone=ilike.%25${encodeURIComponent(cleanPhone.slice(-8))}%25&select=id,tenant_id,name,activities&limit=1`
        );

        if (ok && matchedLeads && matchedLeads.length > 0) {
          const lead = matchedLeads[0];
          const activities = lead.activities || [];
          activities.unshift({
            id: 'act-wpp-' + Date.now(),
            type: 'whatsapp',
            title: fromMe ? 'Mensagem WhatsApp enviada' : 'Mensagem WhatsApp recebida',
            text: text,
            date: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            user: fromMe ? 'Atendente' : (pushName || lead.name)
          });

          await supabaseFetch(`leads?id=eq.${lead.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ activities })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      processed: true,
      event: event,
      instance: instance
    }));

  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

module.exports = handleWhatsAppWebhook;
module.exports.default = handleWhatsAppWebhook;

