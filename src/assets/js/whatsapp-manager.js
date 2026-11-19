/**
 * Metrifique-se CRM - WhatsApp Web & Multi-Tenant Conversation Engine
 * Handles QR Code pairing (Evolution API / Baileys / Sandbox simulation),
 * Live Chat messaging, Quick responses, and CRM Lead synchronization.
 */

class WhatsAppManager {
  constructor() {
    this.currentChatId = null;
    this.currentFilter = 'all'; // 'all', 'unread', 'leads'
    this.searchQuery = '';
    this.qrTimer = null;
    this.qrSecondsLeft = 45;
    this.init();
  }

  init() {
    this.pollRealWhatsAppServer();

    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.refreshConfigUI();
      this.linkLeadsWithChats();
      this.renderChatList();
      
      // Auto-select first chat or check query params
      const params = new URLSearchParams(window.location.search);
      const urlPhone = params.get('phone');
      const urlName = params.get('name');
      const urlLeadId = params.get('lead_id');

      if (urlPhone) {
        this.startChatWithNumber(urlPhone, urlName || '', '', false, urlLeadId);
      } else if (window.innerWidth >= 768) {
        const chats = window.crmStore ? window.crmStore.getWhatsAppChats() : [];
        if (chats.length > 0) {
          this.selectChat(chats[0].id);
        }
      }

      // Check real status immediately
      this.checkRealWhatsAppStatus();
    });

    // Polling periódico pausado quando a aba está oculta (economia de rede/bateria)
    this._statusInterval = setInterval(() => {
      if (!document.hidden) {
        this.checkRealWhatsAppStatus();
      }
    }, 2000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkRealWhatsAppStatus();
      }
    });

    window.addEventListener('whatsapp-chats-updated', () => {
      this.renderChatList();
      if (this.currentChatId) {
        const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
        if (chat) {
          this.renderMessages(chat);
          this.renderLeadPanel(chat);
        }
      }
    });

    window.addEventListener('whatsapp-message-received', (e) => {
      if (e.detail && e.detail.chatId === this.currentChatId) {
        this.scrollToBottom();
      }
    });

    window.addEventListener('whatsapp-config-updated', () => {
      this.refreshConfigUI();
    });
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-chats-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderChatList();
      });
    }

    // Filter pills
    document.querySelectorAll('[data-chat-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-chat-filter]').forEach(b => b.classList.remove('active', 'btn-primary'));
        document.querySelectorAll('[data-chat-filter]').forEach(b => b.classList.add('btn-light-secondary'));
        btn.classList.remove('btn-light-secondary');
        btn.classList.add('active', 'btn-primary');
        this.currentFilter = btn.getAttribute('data-chat-filter');
        this.renderChatList();
      });
    });

    // Message form submit
    const msgForm = document.getElementById('chat-message-form');
    if (msgForm) {
      msgForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
    }

    // Input IME-safe enter key (sizing handled via CSS field-sizing: content)
    const msgInput = document.getElementById('chat-message-input');
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        // Previne envio acidental durante composição IME (japonês/chinês/coreano/acento Safari)
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Quick responses buttons
    document.querySelectorAll('[data-quick-template]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const text = item.getAttribute('data-quick-template');
        if (msgInput && text) {
          msgInput.value = text;
          msgInput.focus();
        }
      });
    });
  }

  refreshConfigUI() {
    if (!window.crmStore) return;
    const cfg = window.crmStore.getWhatsAppConfig();
    const statusPill = document.getElementById('whatsapp-status-pill');
    const statusText = document.getElementById('whatsapp-status-text');
    const statusIcon = document.getElementById('whatsapp-status-icon');
    const connectBtn = document.getElementById('whatsapp-connect-btn');
    const phoneInfo = document.getElementById('whatsapp-phone-info');

    if (!statusPill) return;

    if (cfg.status === 'connected') {
      statusPill.className = 'badge bg-success-subtle text-success border border-success-subtle px-3 py-2 d-inline-flex align-items-center gap-2';
      statusIcon.className = 'ti ti-circle-filled text-success fs-3';
      statusText.textContent = `Online • ${cfg.phone_number || 'Conectado'}`;
      if (phoneInfo) phoneInfo.textContent = `Aparelho conectado: ${cfg.phone_number || '+55 (11) 98765-4321'} (${cfg.battery_level || 90}% bateria)`;
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="ti ti-settings me-1"></i> Gerenciar Conexão';
        connectBtn.className = 'btn btn-sm btn-outline-secondary';
      }
    } else if (cfg.status === 'qrcode' || cfg.status === 'connecting') {
      statusPill.className = 'badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-2 d-inline-flex align-items-center gap-2';
      statusIcon.className = 'ti ti-refresh text-warning fs-3 spin-animate';
      statusText.textContent = 'Aguardando Leitura do QR Code';
      if (phoneInfo) phoneInfo.textContent = 'Abra o WhatsApp no celular e leia o QR Code';
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="ti ti-qrcode me-1"></i> Abrir QR Code';
        connectBtn.className = 'btn btn-sm btn-warning';
      }
    } else {
      statusPill.className = 'badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 d-inline-flex align-items-center gap-2';
      statusIcon.className = 'ti ti-circle-filled text-danger fs-3';
      statusText.textContent = 'WhatsApp Desconectado';
      if (phoneInfo) phoneInfo.textContent = 'Nenhum aparelho pareado no momento';
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="ti ti-qrcode me-1"></i> Conectar WhatsApp';
        connectBtn.className = 'btn btn-sm btn-success';
      }
    }
  }

  pollRealWhatsAppServer() {
    this.serverUrls = ['http://localhost:8006', 'http://127.0.0.1:8006', ''];
  }

  async fetchApi(endpoint, options = {}) {
    for (const base of this.serverUrls) {
      try {
        const url = base ? `${base}${endpoint}` : endpoint;
        const res = await fetch(url, options);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return null;
  }

  async checkRealWhatsAppStatus() {
    const data = await this.fetchApi('/api/whatsapp/status');
    if (!data) return;

    const qrContainer = document.getElementById('qrcode-container');
    const qrStatusMsg = document.getElementById('qrcode-status-message');

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    if (data.status === 'qrcode' && data.qr) {
      if (qrContainer) {
        const safeQr = escAttr(safeUrl(data.qr, ''));
        qrContainer.innerHTML = `
          <div class="p-3 bg-white rounded border border-2 shadow-sm d-inline-block position-relative">
            <img src="${safeQr}" width="260" height="260" class="d-block rounded shadow-sm" alt="QR Code WhatsApp" style="image-rendering: crisp-edges;" />
            <div class="position-absolute top-50 start-50 translate-middle bg-white p-1 rounded-circle shadow-sm" aria-hidden="true">
              <i class="ti ti-brand-whatsapp text-success fs-7"></i>
            </div>
          </div>
        `;
      }
      if (qrStatusMsg) {
        qrStatusMsg.innerHTML = `
          <div class="text-success fw-bold fs-3 mb-1"><i class="ti ti-camera me-1" aria-hidden="true"></i>QR Code Oficial Ativo!</div>
          <span class="text-muted small">Aponte a câmera do WhatsApp no seu celular agora.</span>
        `;
      }

      // Atualiza pill
      const cfg = window.crmStore.getWhatsAppConfig();
      if (cfg.status !== 'qrcode') {
        window.crmStore.saveWhatsAppConfig({ status: 'qrcode' });
        this.refreshConfigUI();
      }
    } else if (data.status === 'connected') {
      const phone = data.user?.phone || '+55 (11) 98765-4321';
      const name = data.user?.name || 'WhatsApp Conectado';

      const cfg = window.crmStore.getWhatsAppConfig();
      if (cfg.status !== 'connected' || cfg.phone_number !== phone) {
        window.crmStore.saveWhatsAppConfig({
          status: 'connected',
          phone_number: phone,
          profile_name: name,
          battery_level: 95
        });
        this.refreshConfigUI();

        // Notifica
        if (window.crmStore && window.crmStore.addNotification) {
          window.crmStore.addNotification({
            title: 'WhatsApp Conectado',
            message: `Sua linha ${phone} foi conectada com sucesso no Metrifique-se!`
          });
        }
      }

      if (qrContainer && qrContainer.innerHTML.includes('img')) {
        qrContainer.innerHTML = `
          <div class="text-center py-4">
            <div class="rounded-circle bg-success text-white d-inline-flex align-items-center justify-content-center mb-3" style="width: 72px; height: 72px;" aria-hidden="true">
              <i class="ti ti-check fs-9"></i>
            </div>
            <h5 class="fw-bold text-dark">WhatsApp Pareado com Sucesso!</h5>
            <p class="text-muted mb-2">Linha conectada: <strong>${esc(phone)}</strong></p>
            <p class="text-success fw-semibold small"><i class="ti ti-circle-check me-1" aria-hidden="true"></i>Sessão ativa e sincronizada em tempo real</p>
            <div class="mt-4 d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.whatsAppManager.disconnectSession()">
                <i class="ti ti-power me-1" aria-hidden="true"></i> Desconectar
              </button>
              <button type="button" class="btn btn-success btn-sm" data-bs-dismiss="modal">
                <i class="ti ti-message-circle me-1" aria-hidden="true"></i> Ir para as Mensagens
              </button>
            </div>
          </div>
        `;
      }

      // Sincroniza chats reais
      this.syncRealChats();
    } else if (data.status === 'connecting') {
      if (qrContainer && (!qrContainer.innerHTML || qrContainer.innerHTML.includes('Expira') || qrContainer.innerHTML.includes('svg'))) {
        qrContainer.innerHTML = `
          <div class="p-5 text-center">
            <div class="spinner-border text-success mb-3" role="status"></div>
            <p class="fw-semibold text-dark mb-0">Gerando QR Code oficial do WhatsApp...</p>
          </div>
        `;
      }
    }
  }

  async syncRealChats() {
    const realChats = await this.fetchApi('/api/whatsapp/chats');
    if (realChats && Array.isArray(realChats) && realChats.length > 0) {
      let updated = false;
      realChats.forEach(rc => {
        const existing = window.crmStore.getWhatsAppChatById(rc.id);
        if (!existing) {
          window.crmStore.saveWhatsAppChat(rc);
          updated = true;
        } else if (rc.last_message && rc.last_message !== existing.last_message) {
          existing.last_message = rc.last_message;
          existing.last_message_time = rc.last_message_time;
          existing.messages = rc.messages || existing.messages;
          window.crmStore.saveWhatsAppChat(existing);
          updated = true;
        }
      });
      if (updated) {
        this.renderChatList();
        if (this.currentChatId) {
          const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
          if (chat) this.renderMessages(chat);
        }
      }
    }
  }

  openConnectModal() {
    const modalEl = document.getElementById('whatsappConnectModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Dispara inicialização do socket do WhatsApp Baileys
    this.fetchApi('/api/whatsapp/connect', { method: 'POST' });
    this.checkRealWhatsAppStatus();
  }

  renderQRCodeDisplay() {
    this.checkRealWhatsAppStatus();
  }

  async disconnectSession() {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Desconectar WhatsApp',
          message: 'Deseja realmente desconectar esta sessão do WhatsApp?',
          confirmLabel: 'Desconectar',
          danger: true
        })
      : false;
    if (confirmed) {
      await this.fetchApi('/api/whatsapp/disconnect', { method: 'POST' });

      window.crmStore.saveWhatsAppConfig({
        status: 'disconnected',
        phone_number: '',
        qrcode: '',
        battery_level: 0
      });
      this.refreshConfigUI();

      const qrContainer = document.getElementById('qrcode-container');
      if (qrContainer) {
        qrContainer.innerHTML = `
          <div class="p-4 text-center">
            <p class="text-muted mb-3">WhatsApp desconectado.</p>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.whatsAppManager.openConnectModal()">
              <i class="ti ti-qrcode me-1" aria-hidden="true"></i> Conectar Novamente
            </button>
          </div>
        `;
      }
      if (window.mqUI) window.mqUI.toast('Sessão do WhatsApp desconectada.', { type: 'info' });
    }
  }

  // --- LEAD INTEGRATION & NEW CHAT WORKFLOWS ---

  linkLeadsWithChats() {
    if (!window.crmStore) return;
    const leads = window.crmStore.getLeads();
    const chats = window.crmStore.getWhatsAppChats();
    let updated = false;

    chats.forEach(chat => {
      if (!chat.lead_id && chat.phone) {
        const cleanChatPhone = chat.phone.replace(/\D/g, '').slice(-8);
        if (cleanChatPhone) {
          const matchedLead = leads.find(l => {
            const cleanLeadPhone = (l.phone || '').replace(/\D/g, '').slice(-8);
            return cleanLeadPhone && cleanLeadPhone === cleanChatPhone;
          });
          if (matchedLead) {
            chat.lead_id = matchedLead.id;
            chat.name = matchedLead.name || chat.name;
            chat.company = matchedLead.company || chat.company;
            window.crmStore.saveWhatsAppChat(chat);
            updated = true;
          }
        }
      }
    });

    if (updated) {
      this.renderChatList();
    }
  }

  openNewChatModal() {
    const modalEl = document.getElementById('newChatModal');
    if (!modalEl) return;

    // Reset fields
    const phoneInput = document.getElementById('new-chat-phone');
    if (phoneInput) phoneInput.value = '';
    const nameInput = document.getElementById('new-chat-name');
    if (nameInput) nameInput.value = '';
    const msgInput = document.getElementById('new-chat-msg');
    if (msgInput) msgInput.value = '';

    // Update leads count badge
    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const countEl = document.getElementById('modal-leads-count');
    if (countEl) countEl.textContent = leads.length;

    this.renderModalCrmLeads();

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    setTimeout(() => {
      if (phoneInput) phoneInput.focus();
    }, 400);
  }

  renderModalCrmLeads(filterQuery = '') {
    const container = document.getElementById('modal-leads-list');
    if (!container || !window.crmStore) return;

    let leads = window.crmStore.getLeads();
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      leads = leads.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q))
      );
    }

    if (leads.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="ti ti-users-off fs-7 text-secondary mb-2"></i>
          <p class="small mb-0">Nenhum Lead encontrado no CRM com estes termos.</p>
        </div>
      `;
      return;
    }

    const stages = window.crmStore.getStages();
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    container.innerHTML = leads.map(lead => {
      const stage = stages.find(s => s.id === lead.stage_id) || { name: 'Novo Lead' };
      const hasPhone = !!lead.phone;
      const avatarSrc = escAttr(safeUrl(lead.avatar, '../assets/images/profile/user-1.jpg'));

      return `
        <div class="p-3 border-bottom d-flex align-items-center justify-content-between hover-bg-light">
          <div class="d-flex align-items-center gap-3">
            <img src="${avatarSrc}" alt="" width="42" height="42" class="rounded-circle object-fit-cover shadow-sm">
            <div>
              <div class="d-flex align-items-center gap-2">
                <h6 class="mb-0 fw-bold fs-3 text-dark">${esc(lead.name)}</h6>
                <span class="badge bg-light-primary text-primary" style="font-size: 10px;">${esc(stage.name)}</span>
              </div>
              <p class="mb-0 text-muted small">
                <i class="ti ti-building me-1" aria-hidden="true"></i>${esc(lead.company || 'Empresa não informada')} 
                ${hasPhone ? `<span class="mx-1">•</span> <i class="ti ti-phone me-1" aria-hidden="true"></i><strong>${esc(lead.phone)}</strong>` : '<span class="text-danger ms-2">• Sem telefone</span>'}
              </p>
            </div>
          </div>

          <div>
            ${hasPhone ? `
              <button type="button" class="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm px-3" 
                      onclick="window.whatsAppManager.startChatWithLead('${escAttr(lead.id)}')">
                <i class="ti ti-brand-whatsapp fs-4" aria-hidden="true"></i> Conversar
              </button>
            ` : `
              <button type="button" class="btn btn-sm btn-outline-secondary" disabled title="Lead sem telefone cadastrado">
                Sem telefone
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  filterModalLeads(query) {
    this.renderModalCrmLeads(query);
  }

  startChatWithLead(leadId) {
    if (!window.crmStore) return;
    const leads = window.crmStore.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.phone) {
      if (window.mqUI) window.mqUI.toast('Este lead não possui um telefone cadastrado.', { type: 'warning' });
      return;
    }

    this.startChatWithNumber(lead.phone, lead.name, '', false, lead.id);

    // Fecha o modal
    const modalEl = document.getElementById('newChatModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

  handleDirectNewChat(e) {
    if (e) e.preventDefault();
    const phoneInput = document.getElementById('new-chat-phone');
    const nameInput = document.getElementById('new-chat-name');
    const msgInput = document.getElementById('new-chat-msg');
    const createLeadInput = document.getElementById('new-chat-create-lead');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const msg = msgInput ? msgInput.value.trim() : '';
    const createLead = createLeadInput ? createLeadInput.checked : true;

    if (!phone) {
      if (window.mqUI) window.mqUI.toast('Por favor, informe o número do WhatsApp com DDD.', { type: 'warning' });
      return;
    }

    this.startChatWithNumber(phone, name, msg, createLead);

    // Fecha o modal
    const modalEl = document.getElementById('newChatModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

  startChatWithNumber(rawPhone, name = '', initialMsg = '', createLead = true, leadId = null) {
    if (!window.crmStore) return;

    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return;

    // Se tiver 10 ou 11 dígitos (DDD + número), adiciona código 55 do Brasil
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    const chatId = `chat-${cleanPhone}`;
    let chat = window.crmStore.getWhatsAppChatById(chatId);

    // Se já não tiver lead_id, verifica se bate com algum lead existente no CRM
    if (!leadId) {
      const leads = window.crmStore.getLeads();
      const last8 = cleanPhone.slice(-8);
      const matchedLead = leads.find(l => (l.phone || '').replace(/\D/g, '').endsWith(last8));
      if (matchedLead) {
        leadId = matchedLead.id;
        if (!name) name = matchedLead.name;
      }
    }

    // Se ainda não tem lead e createLead = true, cria um Lead no CRM agora
    if (!leadId && createLead) {
      const newLead = window.crmStore.saveLead({
        name: name || `Lead WhatsApp (+${cleanPhone})`,
        phone: rawPhone,
        company: 'Contato WhatsApp',
        source: 'WhatsApp',
        score: 30,
        lifecycle_stage: 'lead'
      });
      if (newLead) leadId = newLead.id;
    }

    if (!chat) {
      chat = {
        id: chatId,
        tenant_id: window.crmStore.getActiveTenantId(),
        lead_id: leadId,
        name: name || `+${cleanPhone}`,
        phone: rawPhone.includes('(') ? rawPhone : `+${cleanPhone}`,
        avatar: '../assets/images/profile/user-1.jpg',
        unread_count: 0,
        last_message: initialMsg || 'Conversa iniciada',
        last_message_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        messages: []
      };
      window.crmStore.saveWhatsAppChat(chat);
    } else {
      if (leadId && !chat.lead_id) chat.lead_id = leadId;
      if (name && chat.name.includes('+')) chat.name = name;
      window.crmStore.saveWhatsAppChat(chat);
    }

    // Atualiza a lista e seleciona o chat
    this.renderChatList();
    this.selectChat(chat.id);

    // Envia mensagem inicial se fornecida
    if (initialMsg && initialMsg.trim()) {
      window.crmStore.sendWhatsAppMessage(chat.id, initialMsg.trim());
      // Dispara envio real via Baileys
      this.sendRealWhatsAppMessage(cleanPhone, initialMsg.trim());
    }
  }

  async sendRealWhatsAppMessage(phone, text) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const payload = JSON.stringify({ phone: cleanPhone, text: text });

    // Tenta porta 8006 diretamente primeiro
    try {
      const res = await fetch('http://localhost:8006/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[WhatsApp Manager] Mensagem entregue ao Baileys:', data);
        return data;
      }
    } catch (err) {
      console.warn('[WhatsApp Manager] Erro no envio direto para 8006:', err);
    }

    // Fallback: endpoint relativo
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    return null;
  }

  // --- CHAT RENDERING ENGINE ---

  getFilteredChats() {
    if (!window.crmStore) return [];
    let chats = window.crmStore.getWhatsAppChats();
    const leads = window.crmStore.getLeads();

    // Sincroniza leads com chats existentes
    chats.forEach(chat => {
      if (!chat.lead_id && chat.phone) {
        const last8 = chat.phone.replace(/\D/g, '').slice(-8);
        const l = leads.find(lead => (lead.phone || '').replace(/\D/g, '').endsWith(last8));
        if (l) {
          chat.lead_id = l.id;
          chat.name = l.name || chat.name;
          chat.company = l.company || chat.company;
        }
      }
    });

    if (this.currentFilter === 'unread') {
      chats = chats.filter(c => c.unread_count > 0);
    } else if (this.currentFilter === 'leads') {
      // No filtro 'Leads CRM', exibe chats que são leads E também adiciona leads que ainda não têm chat aberto
      const chatPhoneSet = new Set(chats.map(c => (c.phone || '').replace(/\D/g, '').slice(-8)));
      const leadsWithoutChat = leads.filter(l => l.phone && !chatPhoneSet.has(l.phone.replace(/\D/g, '').slice(-8)));

      const virtualLeadChats = leadsWithoutChat.map(lead => ({
        id: `virtual-lead-${lead.id}`,
        is_virtual: true,
        lead_id: lead.id,
        name: lead.name,
        phone: lead.phone,
        company: lead.company,
        avatar: lead.avatar || '../assets/images/profile/user-1.jpg',
        last_message: 'Toque para iniciar atendimento no WhatsApp',
        last_message_time: 'Lead CRM',
        unread_count: 0
      }));

      chats = [...chats.filter(c => !!c.lead_id), ...virtualLeadChats];
    }

    if (this.searchQuery) {
      chats = chats.filter(c =>
        (c.name && c.name.toLowerCase().includes(this.searchQuery)) ||
        (c.phone && c.phone.includes(this.searchQuery)) ||
        (c.last_message && c.last_message.toLowerCase().includes(this.searchQuery)) ||
        (c.company && c.company.toLowerCase().includes(this.searchQuery))
      );
    }

    return chats;
  }

  renderChatList() {
    const container = document.getElementById('whatsapp-chat-list');
    if (!container) return;

    const chats = this.getFilteredChats();
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    // Se o usuário digitou algo na busca que parece um número de telefone, exibe botão para chamar direto
    const searchDigits = (this.searchQuery || '').replace(/\D/g, '');
    let directCallCard = '';
    if (searchDigits.length >= 8) {
      directCallCard = `
        <button type="button" class="w-100 text-start border-0 border-bottom p-3 bg-light-success hover-bg-light"
                onclick="window.whatsAppManager.startChatWithNumber('${escAttr(searchDigits)}', '', '', true)">
          <div class="d-flex align-items-center gap-2 text-success fw-bold fs-3">
            <i class="ti ti-message-plus fs-5" aria-hidden="true"></i>
            <span>Chamar no WhatsApp: ${esc(this.searchQuery)}</span>
          </div>
          <p class="text-muted small mb-0 mt-1">Toque para abrir a conversa e cadastrar no CRM</p>
        </button>
      `;
    }

    if (chats.length === 0 && !directCallCard) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="ti ti-messages-off fs-8 text-secondary mb-2" aria-hidden="true"></i>
          <p class="mb-0 small">Nenhuma conversa encontrada</p>
          <button type="button" class="btn btn-sm btn-primary mt-3" onclick="window.whatsAppManager.openNewChatModal()">
            <i class="ti ti-plus me-1" aria-hidden="true"></i> Iniciar Nova Conversa
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = directCallCard + chats.map(chat => {
      const isSelected = chat.id === this.currentChatId;
      const isLead = !!chat.lead_id;
      const isVirtual = !!chat.is_virtual;

      const unreadBadge = chat.unread_count > 0 
        ? `<span class="badge bg-success rounded-pill px-2 py-1 fs-1">${Number(chat.unread_count)}</span>` 
        : '';

      const leadTag = isVirtual
        ? `<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 10px;"><i class="ti ti-plus me-1" aria-hidden="true"></i>Iniciar</span>`
        : isLead 
        ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 10px;">Lead CRM</span>` 
        : `<span class="badge bg-light text-muted border" style="font-size: 10px;">Contato</span>`;

      const clickHandler = isVirtual 
        ? `window.whatsAppManager.startChatWithLead('${escAttr(chat.lead_id)}')`
        : `window.whatsAppManager.selectChat('${escAttr(chat.id)}')`;

      const avatarSrc = escAttr(safeUrl(chat.avatar, '../assets/images/profile/user-1.jpg'));

      return `
        <button type="button" class="chat-item w-100 text-start border-0 border-bottom p-3 ${isSelected ? 'bg-light-primary border-start border-4 border-primary' : 'bg-transparent hover-bg-light'}" 
                onclick="${clickHandler}" style="transition: all 0.15s ease;">
          <div class="d-flex align-items-center gap-3">
            <div class="position-relative flex-shrink-0">
              <img src="${avatarSrc}" width="46" height="46" class="rounded-circle object-fit-cover shadow-sm" alt="">
              <span class="position-absolute bottom-0 end-0 p-1 ${isVirtual ? 'bg-secondary' : 'bg-success'} border border-white rounded-circle" aria-hidden="true"></span>
            </div>
            <div class="flex-grow-1 overflow-hidden">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <h6 class="mb-0 fw-semibold text-truncate fs-3 text-dark">${esc(chat.name)}</h6>
                <span class="text-muted" style="font-size: 11px;">${esc(chat.last_message_time || '')}</span>
              </div>
              <div class="d-flex align-items-center justify-content-between">
                <p class="mb-0 text-muted text-truncate fs-2" style="max-width: 170px;">
                  ${esc(chat.last_message || 'Nenhuma mensagem')}
                </p>
                <div class="d-flex align-items-center gap-1">
                  ${leadTag}
                  ${unreadBadge}
                </div>
              </div>
            </div>
          </div>
        </button>
      `;
    }).join('');
  }

  selectChat(chatId) {
    this.currentChatId = chatId;
    const chat = window.crmStore.getWhatsAppChatById(chatId);
    if (!chat) return;

    // Mobile master-detail drill-down
    const shell = document.getElementById('whatsapp-shell');
    if (shell) shell.classList.add('mobile-chat-open');

    // Reset unread count
    if (chat.unread_count > 0) {
      chat.unread_count = 0;
      window.crmStore.saveWhatsAppChat(chat);
    }

    this.renderChatList();
    this.renderChatHeader(chat);
    this.renderMessages(chat);
    this.renderLeadPanel(chat);

    // Focus composer only on tablet/desktop to avoid unprompted keyboard pop on mobile
    const input = document.getElementById('chat-message-input');
    if (input && window.innerWidth >= 768) input.focus();
  }

  closeMobileChat() {
    const shell = document.getElementById('whatsapp-shell');
    if (shell) shell.classList.remove('mobile-chat-open');
  }

  renderChatHeader(chat) {
    const headerEl = document.getElementById('chat-active-header');
    if (!headerEl) return;

    const isLead = !!chat.lead_id;
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);
    const avatarSrc = escAttr(safeUrl(chat.avatar, '../assets/images/profile/user-1.jpg'));
    const cleanWaDigits = (chat.phone || '').replace(/\D/g, '');

    headerEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100 p-3 border-bottom bg-white">
        <div class="d-flex align-items-center gap-2 gap-md-3 min-w-0">
          <button type="button" class="btn btn-sm btn-light d-md-none flex-shrink-0" onclick="window.whatsAppManager.closeMobileChat()" aria-label="Voltar para a lista de conversas">
            <i class="ti ti-arrow-left fs-5" aria-hidden="true"></i>
          </button>
          <div class="position-relative flex-shrink-0">
            <img src="${avatarSrc}" alt="" width="42" height="42" class="rounded-circle object-fit-cover shadow-sm">
            <span class="position-absolute bottom-0 end-0 p-1 bg-success border border-white rounded-circle" aria-hidden="true"></span>
          </div>
          <div class="min-w-0">
            <div class="d-flex align-items-center gap-2">
              <h6 class="mb-0 fw-bold fs-3 text-dark text-truncate">${esc(chat.name)}</h6>
              ${isLead ? '<span class="badge bg-success-subtle text-success border border-success-subtle d-none d-sm-inline-flex align-items-center" style="font-size: 11px;"><i class="ti ti-check me-1" aria-hidden="true"></i>Lead Sincronizado</span>' : ''}
            </div>
            <p class="mb-0 text-muted fs-2 text-truncate">
              <i class="ti ti-phone me-1" aria-hidden="true"></i>${esc(chat.phone)} 
              <span class="mx-1">•</span> 
              <span class="text-success"><i class="ti ti-point-filled" aria-hidden="true"></i>Online no WhatsApp</span>
            </p>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <a class="btn btn-sm btn-outline-secondary d-none d-md-flex align-items-center gap-1" 
             title="Abrir no WhatsApp Web Oficial"
             href="https://wa.me/${encodeURIComponent(cleanWaDigits)}"
             target="_blank"
             rel="noopener noreferrer">
            <i class="ti ti-external-link" aria-hidden="true"></i>
            <span class="d-none d-lg-inline">Abrir Externo</span>
          </a>
          
          <button type="button" class="btn btn-sm btn-light-primary text-primary d-flex align-items-center gap-1"
                  onclick="window.whatsAppManager.toggleLeadDrawer()">
            <i class="ti ti-user-check" aria-hidden="true"></i>
            <span class="d-none d-sm-inline">${isLead ? 'Ver Lead' : 'Cadastrar Lead'}</span>
          </button>
        </div>
      </div>
    `;
  }

  renderMessages(chat) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const messages = chat.messages || [];
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted my-auto">
          <div class="bg-white rounded-circle p-3 d-inline-flex mb-3 shadow-sm" aria-hidden="true">
            <i class="ti ti-message-dots text-success fs-8"></i>
          </div>
          <h6>Nenhuma mensagem nesta conversa ainda</h6>
          <p class="small text-muted mb-0">Envie uma mensagem abaixo para iniciar o atendimento.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="text-center my-3">
        <span class="badge bg-white text-muted shadow-sm px-3 py-1 fw-normal border" style="font-size: 11px;">
          <i class="ti ti-lock me-1" aria-hidden="true"></i> Mensagens protegidas de ponta a ponta pelo WhatsApp
        </span>
      </div>
    `;

    messages.forEach(msg => {
      const isMe = msg.from_me;
      const checkIcon = isMe 
        ? `<i class="ti ti-checks text-info ms-1" style="font-size: 13px;" title="Entregue e Lida" aria-label="Entregue"></i>` 
        : '';

      html += `
        <div class="d-flex mb-2 ${isMe ? 'justify-content-end' : 'justify-content-start'}">
          <div class="message-bubble p-2 px-3 rounded-3 shadow-sm ${isMe ? 'bg-success text-white' : 'bg-white text-dark border'}" 
               style="max-width: 72%; min-width: 110px; word-break: break-word;">
            ${!isMe && msg.sender_name ? `<div class="fw-semibold mb-1 text-primary" style="font-size: 11px;">${esc(msg.sender_name)}</div>` : ''}
            <div class="fs-2 mb-1" style="line-height: 1.45; white-space: pre-wrap;">${esc(msg.text)}</div>
            <div class="text-end d-flex align-items-center justify-content-end" style="font-size: 10px; ${isMe ? 'color: rgba(255,255,255,0.85);' : 'color: #6b7280;'}">
              <span>${esc(msg.time || '')}</span>
              ${checkIcon}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.scrollToBottom();
  }

  scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  handleSendMessage() {
    const input = document.getElementById('chat-message-input');
    if (!input || !input.value.trim() || !this.currentChatId) return;

    const text = input.value.trim();
    input.value = '';

    const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
    window.crmStore.sendWhatsAppMessage(this.currentChatId, text);

    // Envio real via Baileys se conectado
    if (chat && chat.phone) {
      this.sendRealWhatsAppMessage(chat.phone, text).then(res => {
        if (res && res.success) {
          const c = window.crmStore.getWhatsAppChatById(this.currentChatId);
          if (c && c.messages && c.messages.length > 0) {
            c.messages[c.messages.length - 1].status = 'delivered';
            window.crmStore.saveWhatsAppChat(c);
            this.renderMessages(c);
          }
        }
      });
    }

    // Se for o contato de demonstração 3, simular uma resposta de lead após 2.5 segundos
    if (this.currentChatId === 'chat-demo-3') {
      setTimeout(() => {
        const answers = [
          'Legal! Qual seria o valor mensal desse plano para 5 vendedores?',
          'Obrigado pelo retorno rápido! Vocês oferecem treinamento inicial?',
          'Perfeito, vou compartilhar com os sócios da empresa e te confirmo hoje!'
        ];
        const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
        window.crmStore.receiveWhatsAppMessage('chat-demo-3', randomAnswer, 'Lucas Mendes');
      }, 2500);
    }
  }

  renderLeadPanel(chat) {
    const panel = document.getElementById('chat-lead-panel');
    if (!panel) return;

    const leads = window.crmStore.getLeads();
    const lead = chat.lead_id ? leads.find(l => l.id === chat.lead_id) : null;
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    if (lead) {
      // Estágios de Kanban
      const stages = window.crmStore.getStages();
      const avatarSrc = escAttr(safeUrl(lead.avatar || chat.avatar, '../assets/images/profile/user-1.jpg'));
      const safeLeadId = escAttr(lead.id);

      panel.innerHTML = `
        <div class="p-3 border-bottom bg-light d-flex align-items-center justify-content-between">
          <h6 class="mb-0 fw-bold fs-3 text-dark">
            <i class="ti ti-id me-1 text-primary" aria-hidden="true"></i> Lead Vinculado
          </h6>
          <span class="badge bg-primary px-2 py-1">${esc(lead.lifecycle_stage ? lead.lifecycle_stage.toUpperCase() : 'LEAD')}</span>
        </div>

        <div class="p-3 overflow-auto" style="max-height: calc(100dvh - 220px);">
          <div class="text-center mb-3">
            <img src="${avatarSrc}" alt="" width="64" height="64" class="rounded-circle shadow-sm mb-2 object-fit-cover">
            <h6 class="mb-0 fw-bold fs-4">${esc(lead.name)}</h6>
            <p class="text-muted small mb-1">${esc(lead.company || 'Empresa não informada')}</p>
            <div class="d-inline-flex align-items-center gap-1 badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">
              <i class="ti ti-flame" aria-hidden="true"></i> Score: ${Number(lead.score) || 30} pts
            </div>
          </div>

          <div class="mb-3">
            <label for="wa-stage-select" class="form-label small fw-semibold text-muted mb-1">Mover Etapa no Funil</label>
            <select id="wa-stage-select" class="form-select form-select-sm" onchange="window.whatsAppManager.handleUpdateLeadStage('${safeLeadId}', this.value)">
              ${stages.map(s => `
                <option value="${escAttr(s.id)}" ${s.id === (lead.stage_id || stages[0].id) ? 'selected' : ''}>
                  ${esc(s.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="list-group list-group-flush border rounded mb-3 small">
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-muted">Telefone:</span>
              <span class="fw-semibold text-dark">${esc(lead.phone || chat.phone)}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-muted">E-mail:</span>
              <span class="fw-semibold text-dark text-truncate" style="max-width: 150px;">${esc(lead.email || 'Não cadastrado')}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between py-2">
              <span class="text-muted">Origem:</span>
              <span class="badge bg-light-primary text-primary">${esc(lead.source || 'WhatsApp')}</span>
            </div>
          </div>

          <div class="d-grid gap-2">
            <a href="./leads.html?lead=${encodeURIComponent(lead.id)}" class="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center gap-1">
              <i class="ti ti-external-link" aria-hidden="true"></i> Abrir na Base de Leads
            </a>
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.whatsAppManager.showAddNoteModal('${safeLeadId}')">
              <i class="ti ti-note me-1" aria-hidden="true"></i> Anotar Observação
            </button>
          </div>

          <hr class="my-3">

          <h6 class="fs-2 fw-bold text-dark mb-2">Últimas Atividades</h6>
          <div class="activities-timeline" style="font-size: 11px;">
            ${(lead.activities && lead.activities.length > 0) ? lead.activities.slice(0, 4).map(act => `
              <div class="d-flex gap-2 mb-2 pb-2 border-bottom">
                <i class="ti ${act.type === 'whatsapp' ? 'ti-brand-whatsapp text-success' : 'ti-activity text-primary'} mt-1" aria-hidden="true"></i>
                <div>
                  <div class="fw-semibold text-dark">${esc(act.title)}</div>
                  <div class="text-muted text-truncate" style="max-width: 180px;">${esc(act.text || act.desc || '')}</div>
                  <div class="text-muted" style="font-size: 10px;">${esc(act.date || '')}</div>
                </div>
              </div>
            `).join('') : '<p class="text-muted small">Nenhuma atividade registrada ainda.</p>'}
          </div>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="p-3 border-bottom bg-light">
          <h6 class="mb-0 fw-bold fs-3 text-dark">
            <i class="ti ti-user-plus me-1 text-warning" aria-hidden="true"></i> Contato Não Cadastrado
          </h6>
        </div>

        <div class="p-4 text-center">
          <div class="bg-warning-subtle text-warning rounded-circle p-3 d-inline-flex mb-3" aria-hidden="true">
            <i class="ti ti-user-exclamation fs-8"></i>
          </div>
          <h6 class="fw-bold mb-1">${esc(chat.name)}</h6>
          <p class="text-muted small mb-3">${esc(chat.phone)}</p>
          <div class="alert alert-warning text-start small mb-3" style="font-size: 12px;">
            Este contato ainda não possui ficha na sua Base de Leads do Metrifique-se.
          </div>
          
          <button type="button" class="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onclick="window.whatsAppManager.convertContactToLead('${escAttr(chat.id)}')">
            <i class="ti ti-user-plus fs-5" aria-hidden="true"></i>
            <span>Converter em Lead CRM</span>
          </button>
        </div>
      `;
    }
  }

  toggleLeadDrawer() {
    const col = document.getElementById('chat-lead-drawer-col');
    if (col) {
      col.classList.toggle('d-none');
    }
  }

  convertContactToLead(chatId) {
    const newLead = window.crmStore.createLeadFromWhatsApp(chatId);
    if (newLead) {
      if (window.mqUI) window.mqUI.toast(`Lead "${newLead.name}" criado e sincronizado com sucesso no CRM!`, { type: 'success' });
      const chat = window.crmStore.getWhatsAppChatById(chatId);
      this.renderChatHeader(chat);
      this.renderLeadPanel(chat);
      this.renderChatList();
    }
  }

  handleUpdateLeadStage(leadId, stageId) {
    const leads = window.crmStore.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.stage_id = stageId;
      window.crmStore.saveLead(lead);

      // Adiciona atividade
      const stages = window.crmStore.getStages();
      const targetStage = stages.find(s => s.id === stageId);
      window.crmStore.addLeadActivity(leadId, {
        type: 'stage_change',
        title: 'Etapa alterada via WhatsApp Web',
        text: `Lead movido para a etapa: ${targetStage ? targetStage.name : stageId}`,
        user: (window.crmStore.getUser() || {}).full_name || 'Atendente'
      });

      if (window.mqUI) window.mqUI.toast('Etapa do Lead atualizada com sucesso!', { type: 'success' });
      if (this.currentChatId) {
        const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
        this.renderLeadPanel(chat);
      }
    }
  }

  async showAddNoteModal(leadId) {
    const note = window.mqUI
      ? await window.mqUI.prompt({
          title: 'Anotar observação no Lead',
          label: 'Observação para salvar na ficha deste contato',
          placeholder: 'Ex: Cliente pediu proposta atualizada para sexta-feira...',
          multiline: true,
          confirmLabel: 'Salvar observação',
          required: true
        })
      : null;
    if (note && note.trim()) {
      window.crmStore.addLeadActivity(leadId, {
        type: 'note',
        title: 'Observação adicionada via Chat WhatsApp',
        text: note.trim(),
        user: (window.crmStore.getUser() || {}).full_name || 'Atendente'
      });
      if (window.mqUI) window.mqUI.toast('Observação salva na timeline do Lead!', { type: 'success' });
      if (this.currentChatId) {
        const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
        this.renderLeadPanel(chat);
      }
    }
  }
}

// Global instance
window.whatsAppManager = new WhatsAppManager();

