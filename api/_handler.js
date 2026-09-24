/**
 * Metrifiquese CRM - Endpoint / Webhook Handler para Captura de Leads
 * Recebe leads do Chatbot WhatsApp, Landing Pages e integrações externas (RCA Advocacia, Meta Ads, Google Ads).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://syvqisjpulryjlgksjrk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_O0sjGeACkgzBZJOlMMGpaA_LMHn3Ihl';

// Cache em memória para resolução rápida de pipelines por tenant
const TENANT_CACHE = {
  'tenant-1785603277353': {
    name: 'RCA Advocacia',
    pipelineId: 'pipe-tenant-1785603277353',
    stageId: 'stage-tenant-1785603277353-1' // Novo Lead
  },
  'tenant-demo-001': {
    name: 'Metrifique-se CRM (Master)',
    pipelineId: 'pipe-1',
    stageId: 'stage-1' // Novo Lead
  }
};

/**
 * Função utilitária para chamar a REST API do Supabase
 */
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

/**
 * Resolve o tenant_id adequado com base na query string, body ou origem do sistema
 */
async function resolveTenant(reqQuery, body) {
  const paramTenant = reqQuery?.tenant_id || reqQuery?.tenant || body?.tenant_id || body?.tenant;
  const origem = (body?.origem_sistema || '').toLowerCase();
  const landingPage = (body?.rastreamento?.landing_page || '').toLowerCase();

  // Se especificado explicitamente
  if (paramTenant) {
    if (paramTenant === 'rca' || paramTenant === 'tenant-1785603277353') {
      return 'tenant-1785603277353';
    }
    if (paramTenant === 'master' || paramTenant === 'demo' || paramTenant === 'tenant-demo-001') {
      return 'tenant-demo-001';
    }
    // Pode ser um ID completo de tenant
    return paramTenant;
  }

  // Detecção automática por origem ou landing page
  if (origem.includes('rca') || landingPage.includes('rcaadvocacia')) {
    return 'tenant-1785603277353'; // Tenant RCA Advocacia
  }

  // Fallback padrão: se o request vier do ecossistema RCA, usa o tenant RCA, senão tenant master
  return 'tenant-1785603277353';
}

/**
 * Obtém ou descobre o pipeline e estágio inicial do tenant
 */
async function getPipelineForTenant(tenantId) {
  if (TENANT_CACHE[tenantId]) {
    return TENANT_CACHE[tenantId];
  }

  try {
    const { ok, data } = await supabaseFetch(
      `pipelines?tenant_id=eq.${encodeURIComponent(tenantId)}&select=id,pipeline_stages(id,display_order)&order=created_at.asc&limit=1`
    );

    if (ok && Array.isArray(data) && data.length > 0) {
      const pipe = data[0];
      const stages = pipe.pipeline_stages || [];
      stages.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const stageId = stages[0]?.id || `stage-${tenantId}-1`;

      const resolved = {
        name: 'Funil Padrão',
        pipelineId: pipe.id,
        stageId: stageId
      };
      TENANT_CACHE[tenantId] = resolved;
      return resolved;
    }
  } catch (e) {
    console.warn('[Webhook] Erro ao buscar pipeline do tenant:', e);
  }

  // Fallback se não encontrar
  return {
    name: 'Funil Padrão',
    pipelineId: `pipe-${tenantId}`,
    stageId: `stage-${tenantId}-1`
  };
}

/**
 * Helper para extrair body em ambientes Node padrão ou Serverless
 */
async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }

  return new Promise((resolve) => {
    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
    });
    req.on('end', () => {
      try {
        resolve(bodyStr ? JSON.parse(bodyStr) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Manipulador principal da rota Webhook / Leads API
 */
async function handleLeadsWebhook(req, res) {
  // 1. Configurar cabeçalhos CORS completos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Tenant-Id');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // 2. Health check via GET
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      status: 'active',
      service: 'Metrifiquese CRM - Inbound Leads Webhook API',
      version: '1.0.0',
      description: 'Endpoint pronto para receber leads via POST JSON do Chatbot WhatsApp e Landing Pages.',
      supported_methods: ['POST', 'OPTIONS', 'GET'],
      sample_payload: {
        lead: {
          nome: 'Nome do Lead',
          telefone: '11988887777',
          whatsapp: '11988887777',
          email: 'opcional@email.com',
          area_interesse: 'Direito Previdenciário',
          resumo_caso: 'Aposentadoria negada pelo INSS',
          qualificacao: 'alta'
        },
        rastreamento: {
          utm_source: 'google_ads',
          utm_campaign: 'inss_negado',
          gclid: 'abc123xyz'
        },
        origem_sistema: 'rca_chatbot_whatsapp_sim'
      }
    }, null, 2));
  }

  // 3. Apenas aceitar POST
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    return res.end(JSON.stringify({
      success: false,
      error: 'Método não permitido. Utilize POST para enviar dados de leads.'
    }));
  }

  try {
    const rawBody = await parseRequestBody(req);

    // Suporte tanto para { lead: {...}, rastreamento: {...} } quanto para campos planos
    const leadData = rawBody.lead || rawBody;
    const trackingData = rawBody.rastreamento || rawBody.tracking || {};
    const origemSistema = rawBody.origem_sistema || rawBody.source || 'rca_chatbot_whatsapp_sim';

    // Extração e normalização dos dados do Lead
    const nome = (leadData.nome || leadData.name || leadData.full_name || '').trim();
    const rawPhone = (leadData.whatsapp || leadData.telefone || leadData.phone || '').trim();
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
    let email = (leadData.email || '').trim();

    // Validações básicas de campos essenciais
    if (!nome) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({
        success: false,
        error: 'Campo obrigatório ausente: informe o "nome" do lead.'
      }));
    }

    if (!cleanPhoneDigits && !rawPhone) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({
        success: false,
        error: 'Campo obrigatório ausente: informe o "telefone" ou "whatsapp" com DDD.'
      }));
    }

    // A tabela `leads` no Supabase exige `email NOT NULL`.
    // Se o lead veio do WhatsApp sem e-mail, geramos um identificador amigável.
    if (!email || !email.includes('@')) {
      email = cleanPhoneDigits 
        ? `${cleanPhoneDigits}@lead.rcaadvocacia.com.br` 
        : `lead-${Date.now()}@metrifiquese.com.br`;
    }

    // Detalhes do Caso e Qualificação
    const areaInteresse = leadData.area_interesse || leadData.area || '';
    const resumoCaso = leadData.resumo_caso || leadData.caso || leadData.mensagem || '';
    const respostasTriagem = Array.isArray(leadData.respostas_triagem) ? leadData.respostas_triagem : [];
    const qualificacao = (leadData.qualificacao || 'media').toLowerCase();
    const dataCaptura = leadData.data_captura || new Date().toISOString();

    // Rastreamento de Tráfego / UTMs
    const utmSource = trackingData.utm_source || leadData.utm_source || '';
    const utmMedium = trackingData.utm_medium || leadData.utm_medium || '';
    const utmCampaign = trackingData.utm_campaign || leadData.utm_campaign || '';
    const utmContent = trackingData.utm_content || leadData.utm_content || '';
    const utmTerm = trackingData.utm_term || leadData.utm_term || '';
    const gclid = trackingData.gclid || leadData.gclid || '';
    const fbclid = trackingData.fbclid || leadData.fbclid || '';
    const referrer = trackingData.referrer || leadData.referrer || '';
    const landingPage = trackingData.landing_page || leadData.landing_page || '';
    const pageTitle = trackingData.page_title || leadData.page_title || '';

    // Resolver Tenant
    const urlQuery = req.query || {};
    const tenantId = await resolveTenant(urlQuery, rawBody);
    const pipelineInfo = await getPipelineForTenant(tenantId);

    // Calcular Score do Lead
    let score = 30;
    if (qualificacao === 'alta') score = 65;
    else if (qualificacao === 'media') score = 45;
    else if (qualificacao === 'baixa') score = 20;

    if (resumoCaso && resumoCaso.length > 10) score += 10;
    if (gclid || utmCampaign) score += 10; // Tráfego pago com intenção

    // Tags Contextualizadas
    const tags = ['Chatbot WhatsApp'];
    if (areaInteresse) tags.push(areaInteresse);
    if (qualificacao) tags.push(`Qualificação: ${qualificacao.toUpperCase()}`);
    if (utmSource) tags.push(`UTM: ${utmSource}`);
    if (utmCampaign) tags.push(`Campanha: ${utmCampaign}`);

    // Objeto Lead ID
    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const dealId = `deal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const notifId = `notif-${Date.now()}`;

    // Montar Custom Fields com Rastreamento Completo
    const customFields = {
      area_interesse: areaInteresse,
      resumo_caso: resumoCaso,
      respostas_triagem: respostasTriagem,
      qualificacao: qualificacao,
      data_captura: dataCaptura,
      origem_sistema: origemSistema,
      rastreamento: {
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_content: utmContent,
        utm_term: utmTerm,
        gclid: gclid,
        fbclid: fbclid,
        referrer: referrer,
        landing_page: landingPage,
        page_title: pageTitle
      }
    };

    // Montar Atividade Histórica Inicial
    const initialActivity = {
      id: `act-${Date.now()}`,
      type: 'note',
      title: 'Captura via Chatbot WhatsApp (RCA Advocacia)',
      content: `Área de Interesse: ${areaInteresse || 'Geral'}\n` +
               `Resumo do Caso: ${resumoCaso || 'Não detalhado'}\n` +
               (respostas_triagem_formatada(respostasTriagem) ? `Triagem: ${respostas_triagem_formatada(respostasTriagem)}\n` : '') +
               `Rastreamento: ${utmSource ? `${utmSource} / ${utmCampaign}` : 'Direto/Orgânico'}${gclid ? ` (GCLID: ${gclid})` : ''}`,
      author: 'Chatbot IA RCA',
      date: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    // Determinar Origem Exibida
    let displaySource = 'Chatbot WhatsApp';
    if (utmSource) {
      displaySource = utmCampaign ? `${utmSource} (${utmCampaign})` : utmSource;
    }

    // 4. Salvar na Tabela `leads` do Supabase
    const leadPayload = {
      id: leadId,
      tenant_id: tenantId,
      name: nome,
      email: email,
      phone: rawPhone,
      company: 'RCA Advocacia',
      job_title: areaInteresse || 'Lead Inbound WhatsApp',
      lifecycle_stage: qualificacao === 'alta' ? 'sql' : 'lead',
      score: score,
      source: displaySource,
      tags: tags,
      custom_fields: customFields,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const leadInsertRes = await supabaseFetch('leads', {
      method: 'POST',
      body: JSON.stringify(leadPayload)
    });

    if (!leadInsertRes.ok) {
      console.error('[Webhook] Falha ao inserir lead no Supabase:', leadInsertRes.status, leadInsertRes.data);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      return res.end(JSON.stringify({
        success: false,
        error: 'Erro ao persistir contato no banco de dados do Supabase.',
        details: leadInsertRes.data
      }));
    }

    // 5. Criar Oportunidade / Deal no Kanban
    const dealPayload = {
      id: dealId,
      tenant_id: tenantId,
      lead_id: leadId,
      pipeline_id: pipelineInfo.pipelineId,
      stage_id: pipelineInfo.stageId,
      title: `${nome} - ${areaInteresse || 'Atendimento WhatsApp'}`,
      value: 0.00,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const dealInsertRes = await supabaseFetch('deals', {
      method: 'POST',
      body: JSON.stringify(dealPayload)
    });

    if (!dealInsertRes.ok) {
      console.warn('[Webhook] Falha secundária ao inserir deal (lead foi salvo):', dealInsertRes.data);
    }

    // 6. Criar Notificação no Sistema para o Tenant
    const notifPayload = {
      id: notifId,
      tenant_id: tenantId,
      title: '🚨 Novo Lead via Chatbot WhatsApp',
      message: `${nome} enviou solicitação sobre ${areaInteresse || 'caso jurídico'}. WhatsApp: ${rawPhone}`,
      time: 'Agora',
      is_read: false,
      created_at: new Date().toISOString()
    };

    await supabaseFetch('notifications', {
      method: 'POST',
      body: JSON.stringify(notifPayload)
    });

    // 7. Retorno de Sucesso (201 Created)
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 201;
    return res.end(JSON.stringify({
      success: true,
      message: 'Lead capturado e salvo com sucesso no Metrifiquese!',
      data: {
        lead_id: leadId,
        deal_id: dealId,
        tenant_id: tenantId,
        tenant_name: pipelineInfo.name || 'RCA Advocacia',
        lead: {
          nome: nome,
          telefone: rawPhone,
          email: email,
          area_interesse: areaInteresse,
          score: score,
          qualificacao: qualificacao
        },
        rastreamento: {
          utm_source: utmSource,
          utm_campaign: utmCampaign,
          gclid: gclid
        }
      }
    }, null, 2));

  } catch (error) {
    console.error('[Webhook] Erro inesperado ao processar requisição:', error);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      success: false,
      error: 'Erro interno ao processar o webhook de leads.',
      message: error.message
    }));
  }
}

function respostas_triagem_formatada(triagem) {
  if (!Array.isArray(triagem) || triagem.length === 0) return '';
  return triagem.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return Object.values(item).join(' - ');
    }
    return '';
  }).filter(Boolean).join('; ');
}

module.exports = handleLeadsWebhook;
module.exports.default = handleLeadsWebhook;
module.exports.handleLeadsWebhook = handleLeadsWebhook;
