/**
 * Metrifique-se CRM - WhatsApp Web & Multi-Channel Conversation Engine
 * Handles Multiple Concurrent WhatsApp Instances in Accessible Tabs,
 * QR Code pairing (Baileys / Evolution API), Live Chat messaging,
 * Quick responses, and CRM Lead synchronization.
 */

class WhatsAppManager {
  constructor() {
    this.currentChatId = null;
    this.currentFilter = 'all'; // 'all', 'unread', 'leads'
    this.searchQuery = '';
    this.activeAccountFilter = 'default';
    this.pairingAccountId = 'default';
    this.liveQrByAccount = {};
    this.serverAvailable = false;
    this.tablistObserver = null;
    this.init();
  }

  init() {
    this.pollRealWhatsAppServer();

    document.addEventListener('DOMContentLoaded', () => {
      this.normalizeActiveTab();
      this.bindEvents();
      this.bindTablistAccessibility();
      this.renderAccountTabs();
      this.refreshConfigUI();
      this.linkLeadsWithChats();
      this.renderChatList();

      const params = new URLSearchParams(window.location.search);
      const urlPhone = params.get('phone');
      const urlName = params.get('name');
      const urlLeadId = params.get('lead_id');
      const urlAccount = params.get('account_id');

      if (urlPhone) {
        this.startChatWithNumber(urlPhone, urlName || '', '', false, urlLeadId, urlAccount);
      } else if (window.innerWidth >= 768) {
        const chats = this.getFilteredChats();
        if (chats.length > 0 && !chats[0].is_virtual) {
          this.selectChat(chats[0].id);
        } else {
          this.renderEmptyThreadState();
        }
      }

      this.checkRealWhatsAppStatus();
    });

    // Polling periodico pausado quando a aba esta oculta
    this._statusInterval = setInterval(() => {
      if (!document.hidden) {
        this.checkRealWhatsAppStatus();
      }
    }, 2500);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkRealWhatsAppStatus();
      }
    });

    window.addEventListener('whatsapp-chats-updated', () => {
      this.renderAccountTabs();
      this.renderChatList();
      if (this.currentChatId) {
        const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
        if (chat) {
          this.renderMessages(chat);
          this.renderLeadPanel(chat);
          this.updateComposerIndicator(chat);
        }
      }
    });

    window.addEventListener('whatsapp-accounts-updated', () => {
      this.normalizeActiveTab();
      this.renderAccountTabs();
      this.refreshConfigUI();
      this.renderAccountsManagerList();
      this.renderPairingBanner();
      this.renderChatList();
    });

    window.addEventListener('whatsapp-message-received', (e) => {
      if (e.detail && e.detail.chatId === this.currentChatId) {
        this.scrollToBottom();
      }
    });

    window.addEventListener('whatsapp-config-updated', () => {
      this.renderAccountTabs();
      this.refreshConfigUI();
      this.renderAccountsManagerList();
      this.renderPairingBanner();
    });
  }

  getAccounts() {
    return window.crmStore ? window.crmStore.getWhatsAppAccounts() : [];
  }

  getAccountById(accountId) {
    return window.crmStore ? window.crmStore.getWhatsAppAccountById(accountId) : null;
  }

  normalizeActiveTab() {
    const accounts = this.getAccounts();
    if (accounts.length <= 1) {
      this.activeAccountFilter = accounts[0] ? accounts[0].id : 'default';
      this.pairingAccountId = this.activeAccountFilter;
      return;
    }

    let saved = null;
    try {
      saved = sessionStorage.getItem('mq_wa_active_tab');
    } catch (_) {}

    if (saved && (saved === 'all' || accounts.some(a => a.id === saved))) {
      this.activeAccountFilter = saved;
    } else if (!this.activeAccountFilter || (this.activeAccountFilter !== 'all' && !accounts.some(a => a.id === this.activeAccountFilter))) {
      this.activeAccountFilter = 'all';
    }

    if (!accounts.some(a => a.id === this.pairingAccountId)) {
      this.pairingAccountId = accounts[0].id;
    }
  }

  bindEvents() {
    const searchInput = document.getElementById('search-chats-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderChatList();
      });
    }

    // Segmented filter pills
    document.querySelectorAll('[data-chat-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-chat-filter]').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        this.currentFilter = btn.getAttribute('data-chat-filter');
        this.renderChatList();
      });
    });

    const msgForm = document.getElementById('chat-message-form');
    if (msgForm) {
      msgForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
    }

    const msgInput = document.getElementById('chat-message-input');
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

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

  // --- ACCESSIBLE MULTI-WHATSAPP TABS ---

  bindTablistAccessibility() {
    const tablist = document.getElementById('whatsapp-account-tabs');
    if (!tablist || tablist.dataset.tabsBound === 'true') return;
    tablist.dataset.tabsBound = 'true';

    tablist.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      const tabId = tab.getAttribute('data-wa-tab');
      if (tabId) {
        this.selectAccountTab(tabId, { focusTab: true });
      }
    });

    tablist.addEventListener('keydown', (e) => {
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      if (tabs.length <= 1) return;
      const currentIdx = tabs.indexOf(document.activeElement);
      if (currentIdx === -1) return;

      let nextIdx = -1;
      if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = tabs.length - 1;

      if (nextIdx !== -1) {
        e.preventDefault();
        const nextTab = tabs[nextIdx];
        const tabId = nextTab.getAttribute('data-wa-tab');
        if (tabId) this.selectAccountTab(tabId, { focusTab: true });
      }
    });

    window.addEventListener('resize', () => this.updateTablistScrollHints());
  }

  updateTablistScrollHints() {
    const tablist = document.getElementById('whatsapp-account-tabs');
    if (!tablist) return;

    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()')) {
      return;
    }

    if (this.tablistObserver) {
      this.tablistObserver.disconnect();
      this.tablistObserver = null;
    }

    tablist.classList.remove('more-start', 'more-end');
    const first = tablist.firstElementChild;
    const last = tablist.lastElementChild;
    if (!first || !last || first === last) return;

    this.tablistObserver = new IntersectionObserver((entries) => {
      for (const { target, intersectionRatio } of entries) {
        if (target === first) {
          tablist.classList.toggle('more-start', intersectionRatio < 1);
        } else if (target === last) {
          tablist.classList.toggle('more-end', intersectionRatio < 1);
        }
      }
    }, { root: tablist, threshold: 1, rootMargin: '1px' });

    this.tablistObserver.observe(first);
    this.tablistObserver.observe(last);
  }

  renderAccountTabs() {
    const tablist = document.getElementById('whatsapp-account-tabs');
    const shell = document.getElementById('whatsapp-shell');
    if (!tablist) return;

    const accounts = this.getAccounts();
    const allChats = window.crmStore ? window.crmStore.getWhatsAppChats() : [];
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;

    const unreadByAccount = {};
    let totalUnread = 0;
    allChats.forEach(c => {
      const accId = c.account_id || 'default';
      const u = Number(c.unread_count) || 0;
      unreadByAccount[accId] = (unreadByAccount[accId] || 0) + u;
      totalUnread += u;
    });

    const tabsData = [];
    if (accounts.length > 1) {
      tabsData.push({
        id: 'all',
        label: 'Todos os Canais',
        dotClass: 'wa-status-dot--all',
        dotStyle: '',
        unread: totalUnread,
        sub: ''
      });
    }

    accounts.forEach(acc => {
      const dotClass = acc.status === 'connected'
        ? 'wa-status-dot--online'
        : (acc.status === 'qrcode' || acc.status === 'connecting')
          ? 'wa-status-dot--pending'
          : 'wa-status-dot--offline';
      const dotStyle = acc.status === 'connected' && acc.color ? `background-color: ${/^#[0-9a-fA-F]{6}$/.test(acc.color) ? acc.color : '#15803D'};` : '';

      tabsData.push({
        id: acc.id,
        label: acc.label || 'WhatsApp',
        dotClass,
        dotStyle,
        unread: unreadByAccount[acc.id] || 0,
        sub: acc.status === 'connected' && acc.phone_number ? acc.phone_number : ''
      });
    });

    if (!tabsData.some(t => t.id === this.activeAccountFilter)) {
      this.activeAccountFilter = tabsData[0] ? tabsData[0].id : 'default';
    }

    tablist.innerHTML = tabsData.map(tab => {
      const isSelected = tab.id === this.activeAccountFilter;
      const safeId = escAttr(tab.id);
      return `
        <button type="button"
                role="tab"
                class="wa-tab"
                id="wa-tab-${safeId}"
                data-wa-tab="${safeId}"
                aria-selected="${isSelected ? 'true' : 'false'}"
                tabindex="${isSelected ? '0' : '-1'}"
                ${isSelected ? 'focusgroupstart' : ''}>
          <span class="wa-status-dot ${tab.dotClass}" style="${tab.dotStyle}" aria-hidden="true"></span>
          <span>${esc(tab.label)}</span>
          ${tab.sub ? `<span class="text-muted d-none d-lg-inline" style="font-size: 11px; font-weight: 500;">${esc(tab.sub)}</span>` : ''}
          ${tab.unread > 0 ? `<span class="wa-tab-badge">${tab.unread > 99 ? '99+' : tab.unread}</span>` : ''}
        </button>
      `;
    }).join('');

    if (shell) {
      shell.setAttribute('aria-labelledby', `wa-tab-${this.activeAccountFilter}`);
    }

    this.updateSidebarChannelTitle();
    this.updateTablistScrollHints();
  }

  selectAccountTab(accountId, { focusTab = false } = {}) {
    this.activeAccountFilter = accountId;
    try {
      sessionStorage.setItem('mq_wa_active_tab', accountId);
    } catch (_) {}

    if (accountId !== 'all') {
      this.pairingAccountId = accountId;
    }

    const tablist = document.getElementById('whatsapp-account-tabs');
    const shell = document.getElementById('whatsapp-shell');
    if (tablist) {
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      let activeEl = null;
      tabs.forEach(tab => {
        const isSelected = tab.getAttribute('data-wa-tab') === accountId;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
        tab.toggleAttribute('focusgroupstart', isSelected);
        if (isSelected) activeEl = tab;
      });

      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (focusTab) activeEl.focus();
      }
    }

    if (shell) {
      shell.setAttribute('aria-labelledby', `wa-tab-${accountId}`);
    }

    this.updateSidebarChannelTitle();
    this.refreshConfigUI();
    this.renderChatList();

    // Se a conversa selecionada nao pertencer a esta aba, muda para a primeira conversa da aba
    const filtered = this.getFilteredChats().filter(c => !c.is_virtual);
    const currentStillVisible = filtered.some(c => c.id === this.currentChatId);
    if (!currentStillVisible) {
      if (filtered.length > 0 && window.innerWidth >= 768) {
        this.selectChat(filtered[0].id);
      } else {
        this.currentChatId = null;
        this.renderEmptyThreadState();
      }
    }
  }

  updateSidebarChannelTitle() {
    const titleEl = document.getElementById('wa-active-channel-title');
    if (!titleEl) return;
    if (this.activeAccountFilter === 'all') {
      titleEl.textContent = 'Todos os Canais';
      return;
    }
    const acc = this.getAccountById(this.activeAccountFilter);
    titleEl.textContent = acc ? acc.label : 'WhatsApp';
  }

  refreshConfigUI() {
    if (!window.crmStore) return;
    const accounts = this.getAccounts();
    const connectedAccounts = accounts.filter(a => a.status === 'connected');
    const pendingAccounts = accounts.filter(a => a.status === 'qrcode' || a.status === 'connecting');

    const statusPill = document.getElementById('whatsapp-status-pill');
    const statusText = document.getElementById('whatsapp-status-text');
    const statusIcon = document.getElementById('whatsapp-status-icon');
    const connectBtn = document.getElementById('whatsapp-connect-btn');
    const phoneInfo = document.getElementById('whatsapp-phone-info');

    if (statusPill && statusText && statusIcon) {
      if (connectedAccounts.length > 1) {
        statusPill.className = 'badge bg-success-subtle text-success border px-2 px-md-3 py-2 d-inline-flex align-items-center gap-2 cursor-pointer';
        statusIcon.className = 'ti ti-circle-filled text-success fs-3';
        statusText.textContent = `${connectedAccounts.length} WhatsApps Online`;
      } else if (connectedAccounts.length === 1) {
        const active = connectedAccounts[0];
        statusPill.className = 'badge bg-success-subtle text-success border px-2 px-md-3 py-2 d-inline-flex align-items-center gap-2 cursor-pointer';
        statusIcon.className = 'ti ti-circle-filled text-success fs-3';
        statusText.textContent = `${active.label}: ${active.phone_number || 'Online'}`;
      } else if (pendingAccounts.length > 0) {
        statusPill.className = 'badge bg-light-warning border px-2 px-md-3 py-2 d-inline-flex align-items-center gap-2 cursor-pointer';
        statusIcon.className = 'ti ti-refresh fs-3 spin-animate';
        statusText.textContent = 'Aguardando QR Code';
      } else {
        statusPill.className = 'badge bg-light-danger text-danger border px-2 px-md-3 py-2 d-inline-flex align-items-center gap-2 cursor-pointer';
        statusIcon.className = 'ti ti-circle-filled text-danger fs-3';
        statusText.textContent = 'WhatsApp Desconectado';
      }
    }

    if (connectBtn) {
      if (connectedAccounts.length > 0) {
        connectBtn.innerHTML = '<i class="ti ti-plug-connected fs-5" aria-hidden="true"></i> <span class="d-none d-md-inline">Gerenciar Canais</span>';
        connectBtn.className = 'btn btn-sm btn-outline-secondary d-flex align-items-center gap-1';
      } else {
        connectBtn.innerHTML = '<i class="ti ti-qrcode fs-5" aria-hidden="true"></i> <span class="d-none d-md-inline">Conectar WhatsApp</span>';
        connectBtn.className = 'btn btn-sm btn-primary d-flex align-items-center gap-1 shadow-sm';
      }
    }

    if (phoneInfo) {
      if (this.activeAccountFilter === 'all') {
        phoneInfo.textContent = connectedAccounts.length > 0
          ? `${connectedAccounts.length} de ${accounts.length} canais conectados`
          : `${accounts.length} canais configurados (nenhum pareado agora)`;
      } else {
        const acc = this.getAccountById(this.activeAccountFilter);
        if (acc && acc.status === 'connected') {
          phoneInfo.textContent = `${acc.label}: ${acc.phone_number || 'Online'} (${acc.battery_level || 95}% bateria)`;
        } else if (acc && (acc.status === 'qrcode' || acc.status === 'connecting')) {
          phoneInfo.textContent = `${acc.label}: aguardando leitura do QR Code`;
        } else {
          phoneInfo.textContent = `${acc ? acc.label : 'Canal'}: nenhum aparelho pareado`;
        }
      }
    }
  }

  // --- REAL WHATSAPP SERVER POLLING (MULTI-INSTANCE) ---

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
    const accountsList = await this.fetchApi('/api/whatsapp/accounts');
    let anyConnected = false;

    if (Array.isArray(accountsList)) {
      this.serverAvailable = true;
      const localAccounts = this.getAccounts();

      accountsList.forEach(remote => {
        const match = localAccounts.find(a => a.id === remote.id);
        if (!match) return;

        if (remote.qr) {
          this.liveQrByAccount[match.id] = remote.qr;
        } else if (remote.status === 'connected') {
          delete this.liveQrByAccount[match.id];
        }

        const nextPhone = remote.user?.phone || '';
        const nextName = remote.user?.name || match.profile_name;
        const changed = match.status !== remote.status || (nextPhone && match.phone_number !== nextPhone);

        if (changed) {
          const wasConnected = match.status === 'connected';
          window.crmStore.updateWhatsAppAccount(match.id, {
            status: remote.status,
            phone_number: nextPhone || match.phone_number,
            profile_name: nextName,
            battery_level: remote.status === 'connected' ? 95 : match.battery_level
          });

          if (!wasConnected && remote.status === 'connected' && window.crmStore.addNotification) {
            window.crmStore.addNotification({
              title: 'WhatsApp Conectado',
              message: `Canal "${match.label}" (${nextPhone}) conectado com sucesso!`
            });
          }
        }

        if (remote.status === 'connected') anyConnected = true;
      });
    } else {
      // Fallback para servidor single-instance
      const targetId = this.pairingAccountId || 'default';
      const data = await this.fetchApi(`/api/whatsapp/status?accountId=${encodeURIComponent(targetId)}`);
      if (data) {
        this.serverAvailable = true;
        if (data.qr) this.liveQrByAccount[targetId] = data.qr;
        const localAcc = this.getAccountById(targetId);
        if (localAcc) {
          const nextPhone = data.user?.phone || '';
          if (localAcc.status !== data.status || (nextPhone && localAcc.phone_number !== nextPhone)) {
            window.crmStore.updateWhatsAppAccount(targetId, {
              status: data.status,
              phone_number: nextPhone || localAcc.phone_number,
              profile_name: data.user?.name || localAcc.profile_name
            });
          }
        }
        if (data.status === 'connected') anyConnected = true;
      } else {
        this.serverAvailable = false;
      }
    }

    // Se a conta sendo pareada tiver Evolution API configurada, verificar status/QR nela tambem
    await this.checkEvolutionPairingStatus();

    const modalEl = document.getElementById('whatsappConnectModal');
    if (modalEl && modalEl.classList.contains('show')) {
      this.renderPairingQRCodeArea();
    }

    if (anyConnected) {
      this.syncRealChats();
    }
  }

  async checkEvolutionPairingStatus() {
    const acc = this.getAccountById(this.pairingAccountId);
    if (!acc || !acc.server_url) return;

    const baseUrl = acc.server_url.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (acc.api_key) headers.apikey = acc.api_key;

    try {
      const stateRes = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(acc.instance_name)}`, { headers });
      if (!stateRes.ok) return;
      const stateData = await stateRes.json();
      const stateVal = stateData?.instance?.state || stateData?.state || '';

      if (stateVal === 'open' || stateVal === 'connected') {
        delete this.liveQrByAccount[acc.id];
        if (acc.status !== 'connected') {
          window.crmStore.updateWhatsAppAccount(acc.id, { status: 'connected' });
        }
      } else {
        const modalEl = document.getElementById('whatsappConnectModal');
        if (modalEl && modalEl.classList.contains('show')) {
          const qrRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(acc.instance_name)}`, { headers });
          if (qrRes.ok) {
            const qrJson = await qrRes.json();
            const rawBase64 = qrJson.base64 || qrJson.qrcode?.base64 || '';
            if (rawBase64) {
              this.liveQrByAccount[acc.id] = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
              if (acc.status !== 'qrcode') {
                window.crmStore.updateWhatsAppAccount(acc.id, { status: 'qrcode' });
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  async syncRealChats() {
    const realChats = await this.fetchApi('/api/whatsapp/chats?accountId=all');
    if (realChats && Array.isArray(realChats) && realChats.length > 0) {
      let updated = false;
      realChats.forEach(rc => {
        rc.account_id = rc.account_id || 'default';
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
        this.renderAccountTabs();
        this.renderChatList();
        if (this.currentChatId) {
          const chat = window.crmStore.getWhatsAppChatById(this.currentChatId);
          if (chat) this.renderMessages(chat);
        }
      }
    }
  }

  // --- MULTI-ACCOUNT MANAGEMENT MODAL ---

  openAddAccountFlow() {
    const modalEl = document.getElementById('whatsappConnectModal');
    if (!modalEl) return;

    const addForm = document.getElementById('add-wa-account-form');
    if (addForm) addForm.classList.remove('d-none');

    this.renderAccountsManagerList();
    this.renderPairingBanner();
    this.renderPairingQRCodeArea();
    this.populateEvolutionFormForAccount(this.pairingAccountId);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    setTimeout(() => {
      const labelInput = document.getElementById('new-wa-account-label');
      if (labelInput) labelInput.focus();
    }, 300);
  }

  toggleAddAccountForm() {
    const addForm = document.getElementById('add-wa-account-form');
    if (!addForm) return;
    addForm.classList.toggle('d-none');
    if (!addForm.classList.contains('d-none')) {
      const labelInput = document.getElementById('new-wa-account-label');
      if (labelInput) labelInput.focus();
    }
  }

  handleCreateAccount(e) {
    if (e) e.preventDefault();
    if (!window.crmStore) return;

    const labelEl = document.getElementById('new-wa-account-label');
    const colorEl = document.getElementById('new-wa-account-color');
    const label = labelEl ? labelEl.value.trim() : '';
    const color = colorEl ? colorEl.value : '#1D4ED8';

    if (!label) return;

    const newAcc = window.crmStore.addWhatsAppAccount({ label, color });
    if (labelEl) labelEl.value = '';
    const addForm = document.getElementById('add-wa-account-form');
    if (addForm) addForm.classList.add('d-none');

    this.pairingAccountId = newAcc.id;
    this.selectAccountTab(newAcc.id);
    this.renderAccountsManagerList();
    this.renderPairingBanner();
    this.populateEvolutionFormForAccount(newAcc.id);

    // Inicia sessao no servidor Baileys local se disponivel
    window.crmStore.updateWhatsAppAccount(newAcc.id, { status: 'connecting' });
    this.fetchApi('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: newAcc.id, label: newAcc.label })
    }).then(() => this.checkRealWhatsAppStatus());

    if (window.mqUI) {
      window.mqUI.toast(`Canal "${newAcc.label}" criado! Escaneie o QR Code ou configure a Evolution API.`, { type: 'success' });
    }
  }

  openConnectModal(accountId = null) {
    const modalEl = document.getElementById('whatsappConnectModal');
    if (!modalEl) return;

    if (accountId && accountId !== 'all') {
      this.pairingAccountId = accountId;
    } else if (this.activeAccountFilter && this.activeAccountFilter !== 'all') {
      this.pairingAccountId = this.activeAccountFilter;
    }

    const addForm = document.getElementById('add-wa-account-form');
    if (addForm) addForm.classList.add('d-none');

    this.renderAccountsManagerList();
    this.renderPairingBanner();
    this.populateEvolutionFormForAccount(this.pairingAccountId);
    this.renderPairingQRCodeArea();

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    const acc = this.getAccountById(this.pairingAccountId);
    this.fetchApi('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: this.pairingAccountId, label: acc?.label || '' })
    }).then(() => this.checkRealWhatsAppStatus());
  }

  selectPairingAccount(accountId) {
    this.pairingAccountId = accountId;
    this.renderAccountsManagerList();
    this.renderPairingBanner();
    this.populateEvolutionFormForAccount(accountId);
    this.renderPairingQRCodeArea();

    const acc = this.getAccountById(accountId);
    if (acc && acc.status !== 'connected') {
      this.fetchApi('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, label: acc.label })
      }).then(() => this.checkRealWhatsAppStatus());
    }
  }

  refreshPairingQRCode() {
    const acc = this.getAccountById(this.pairingAccountId);
    this.fetchApi('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: this.pairingAccountId, label: acc?.label || '' })
    }).then(() => this.checkRealWhatsAppStatus());
  }

  populateEvolutionFormForAccount(accountId) {
    const acc = this.getAccountById(accountId);
    if (!acc) return;
    const instEl = document.getElementById('evo-instance-name');
    const urlEl = document.getElementById('evo-server-url');
    const keyEl = document.getElementById('evo-api-key');
    if (instEl) instEl.value = acc.instance_name || '';
    if (urlEl) urlEl.value = acc.server_url || '';
    if (keyEl) keyEl.value = acc.api_key || '';
  }

  saveEvolutionApiSettings() {
    const instEl = document.getElementById('evo-instance-name');
    const urlEl = document.getElementById('evo-server-url');
    const keyEl = document.getElementById('evo-api-key');

    const instance_name = instEl ? instEl.value.trim() : '';
    const server_url = urlEl ? urlEl.value.trim() : '';
    const api_key = keyEl ? keyEl.value.trim() : '';

    if (window.crmStore) {
      window.crmStore.updateWhatsAppAccount(this.pairingAccountId, {
        ...(instance_name ? { instance_name } : {}),
        server_url,
        api_key
      });
    }

    this.checkEvolutionPairingStatus();
    if (window.mqUI) {
      window.mqUI.toast('Configurações do servidor salvas para este canal!', { type: 'success' });
    }
  }

  renderAccountsManagerList() {
    const listEl = document.getElementById('whatsapp-accounts-manager-list');
    if (!listEl) return;

    const accounts = this.getAccounts();
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;

    listEl.innerHTML = accounts.map(acc => {
      const isSelected = acc.id === this.pairingAccountId;
      const safeId = escAttr(acc.id);
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(acc.color || '') ? acc.color : '#143E2B';
      const isConnected = acc.status === 'connected';
      const isPending = acc.status === 'qrcode' || acc.status === 'connecting';
      const statusLabel = isConnected
        ? (acc.phone_number || 'Conectado')
        : isPending
          ? 'Aguardando QR Code'
          : 'Desconectado';
      const statusClass = isConnected
        ? 'bg-light-success text-success'
        : isPending
          ? 'bg-light-warning text-warning'
          : 'bg-light text-muted border';

      return `
        <div class="wa-account-card ${isSelected ? 'is-active' : ''}">
          <div class="d-flex align-items-center gap-2 min-w-0">
            <span class="rounded-circle flex-shrink-0" style="width: 12px; height: 12px; background-color: ${safeColor};" aria-hidden="true"></span>
            <div class="min-w-0">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <strong class="fs-3 text-dark text-truncate">${esc(acc.label)}</strong>
                <span class="badge ${statusClass}" style="font-size: 11px;">${esc(statusLabel)}</span>
              </div>
              <small class="text-muted text-truncate d-block">Instância: ${esc(acc.instance_name)}${acc.server_url ? ' • Evolution API' : ''}</small>
            </div>
          </div>
          <div class="d-flex align-items-center gap-1 flex-shrink-0">
            <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'} px-2 py-1"
                    onclick="window.whatsAppManager.selectPairingAccount('${safeId}')" title="Selecionar este canal para parear ou configurar">
              <i class="ti ti-qrcode" aria-hidden="true"></i>
              <span class="d-none d-sm-inline">${isConnected ? 'Gerenciar' : 'Parear'}</span>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary px-2 py-1"
                    onclick="window.whatsAppManager.renameAccountPrompt('${safeId}')" title="Renomear canal" aria-label="Renomear canal ${escAttr(acc.label)}">
              <i class="ti ti-pencil" aria-hidden="true"></i>
            </button>
            ${accounts.length > 1 && acc.id !== 'default' ? `
              <button type="button" class="btn btn-sm btn-light-danger px-2 py-1"
                      onclick="window.whatsAppManager.deleteAccountPrompt('${safeId}')" title="Remover canal" aria-label="Remover canal ${escAttr(acc.label)}">
                <i class="ti ti-trash" aria-hidden="true"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  renderPairingBanner() {
    const acc = this.getAccountById(this.pairingAccountId);
    if (!acc) return;
    const labelEl = document.getElementById('pairing-account-label');
    const dotEl = document.getElementById('pairing-account-dot');
    const badgeEl = document.getElementById('pairing-account-badge');

    if (labelEl) labelEl.textContent = acc.label;
    if (dotEl) {
      dotEl.className = 'wa-status-dot ' + (acc.status === 'connected' ? 'wa-status-dot--online' : (acc.status === 'qrcode' || acc.status === 'connecting') ? 'wa-status-dot--pending' : 'wa-status-dot--offline');
    }
    if (badgeEl) {
      if (acc.status === 'connected') {
        badgeEl.className = 'badge bg-light-success text-success';
        badgeEl.textContent = `Conectado • ${acc.phone_number || ''}`;
      } else if (acc.status === 'qrcode' || acc.status === 'connecting') {
        badgeEl.className = 'badge bg-light-warning text-warning';
        badgeEl.textContent = 'Aguardando QR Code';
      } else {
        badgeEl.className = 'badge bg-light text-muted border';
        badgeEl.textContent = 'Desconectado';
      }
    }
  }

  renderPairingQRCodeArea() {
    const qrContainer = document.getElementById('qrcode-container');
    const qrStatusMsg = document.getElementById('qrcode-status-message');
    if (!qrContainer) return;

    const acc = this.getAccountById(this.pairingAccountId);
    if (!acc) return;

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);
    const liveQr = this.liveQrByAccount[acc.id];

    if (acc.status === 'connected') {
      qrContainer.innerHTML = `
        <div class="text-center py-3">
          <div class="rounded-circle bg-light-success text-success d-inline-flex align-items-center justify-content-center mb-3" style="width: 68px; height: 68px;" aria-hidden="true">
            <i class="ti ti-check fs-9"></i>
          </div>
          <h6 class="fw-bold text-dark mb-1">${esc(acc.label)} pareado!</h6>
          <p class="text-muted small mb-2">Linha conectada: <strong>${esc(acc.phone_number || 'Online')}</strong></p>
          <div class="mt-3 d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.whatsAppManager.disconnectSession('${escAttr(acc.id)}')">
              <i class="ti ti-power me-1" aria-hidden="true"></i> Desconectar
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-bs-dismiss="modal">
              <i class="ti ti-message-circle me-1" aria-hidden="true"></i> Ver Conversas
            </button>
          </div>
        </div>
      `;
      if (qrStatusMsg) {
        qrStatusMsg.innerHTML = `<span class="text-success fw-semibold"><i class="ti ti-circle-check me-1" aria-hidden="true"></i>Sessão ativa em tempo real</span>`;
      }
      return;
    }

    if (liveQr) {
      const safeQr = escAttr(safeUrl(liveQr, ''));
      qrContainer.innerHTML = `
        <div class="p-3 bg-white rounded border shadow-sm d-inline-block position-relative">
          <img src="${safeQr}" width="240" height="240" class="d-block rounded" alt="QR Code WhatsApp para ${escAttr(acc.label)}" style="image-rendering: crisp-edges;" />
        </div>
      `;
      if (qrStatusMsg) {
        qrStatusMsg.innerHTML = `
          <div class="text-success fw-bold fs-3 mb-1"><i class="ti ti-camera me-1" aria-hidden="true"></i>QR Code Pronto (${esc(acc.label)})</div>
          <span class="text-muted small">Abra o WhatsApp no celular e aponte a câmera agora.</span>
        `;
      }
      return;
    }

    if (this.serverAvailable || acc.server_url) {
      qrContainer.innerHTML = `
        <div class="p-4 text-center">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <p class="fw-semibold text-dark mb-1">Gerando QR Code para ${esc(acc.label)}...</p>
          <span class="text-muted small">Aguarde alguns segundos.</span>
        </div>
      `;
      if (qrStatusMsg) {
        qrStatusMsg.innerHTML = `<span class="text-muted">Iniciando instância ${esc(acc.instance_name)}...</span>`;
      }
    } else {
      qrContainer.innerHTML = `
        <div class="p-4 bg-light border rounded-3 text-center w-100">
          <i class="ti ti-server-off fs-8 text-muted d-block mb-2" aria-hidden="true"></i>
          <h6 class="fw-bold text-dark mb-1">Motor WhatsApp local offline neste navegador</h6>
          <p class="text-muted small mb-3">
            Para parear pelo QR Code em nuvem, configure sua <strong>Evolution API</strong> abaixo ou inicie o servidor local <code>node server/whatsapp-server.js</code>.
          </p>
          <button type="button" class="btn btn-sm btn-outline-primary" data-bs-toggle="collapse" data-bs-target="#evolutionApiConfigCollapse">
            <i class="ti ti-settings me-1" aria-hidden="true"></i> Configurar Evolution API
          </button>
        </div>
      `;
      if (qrStatusMsg) {
        qrStatusMsg.innerHTML = `<span class="text-muted">Configure um servidor ou inicie o serviço Baileys.</span>`;
      }
    }
  }

  async renameAccountPrompt(accountId) {
    const acc = this.getAccountById(accountId);
    if (!acc) return;

    const nextLabel = window.mqUI
      ? await window.mqUI.prompt({
          title: 'Renomear Canal WhatsApp',
          label: 'Nome exibido na aba deste número (ex: Comercial, Suporte)',
          defaultValue: acc.label,
          confirmLabel: 'Salvar Nome',
          required: true
        })
      : null;

    if (nextLabel && nextLabel.trim()) {
      window.crmStore.updateWhatsAppAccount(accountId, { label: nextLabel.trim() });
      if (window.mqUI) window.mqUI.toast('Nome do canal atualizado!', { type: 'success' });
    }
  }

  async deleteAccountPrompt(accountId) {
    const acc = this.getAccountById(accountId);
    if (!acc) return;

    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Remover Canal WhatsApp',
          message: `Deseja desconectar e remover o canal "${acc.label}" das abas?`,
          confirmLabel: 'Remover Canal',
          danger: true
        })
      : false;

    if (confirmed) {
      await this.fetchApi('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, remove: true })
      });
      delete this.liveQrByAccount[accountId];
      window.crmStore.removeWhatsAppAccount(accountId);
      if (window.mqUI) window.mqUI.toast(`Canal "${acc.label}" removido.`, { type: 'info' });
    }
  }

  renderQRCodeDisplay() {
    this.checkRealWhatsAppStatus();
  }

  async disconnectSession(accountId = null) {
    const targetId = accountId || this.pairingAccountId || 'default';
    const acc = this.getAccountById(targetId);

    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Desconectar WhatsApp',
          message: `Deseja realmente desconectar o canal "${acc ? acc.label : targetId}"?`,
          confirmLabel: 'Desconectar',
          danger: true
        })
      : false;

    if (confirmed) {
      await this.fetchApi('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: targetId })
      });

      delete this.liveQrByAccount[targetId];
      window.crmStore.updateWhatsAppAccount(targetId, {
        status: 'disconnected',
        phone_number: '',
        qrcode: '',
        battery_level: 0
      });

      this.renderAccountsManagerList();
      this.renderPairingBanner();
      this.renderPairingQRCodeArea();
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

    const phoneInput = document.getElementById('new-chat-phone');
    if (phoneInput) phoneInput.value = '';
    const nameInput = document.getElementById('new-chat-name');
    if (nameInput) nameInput.value = '';
    const msgInput = document.getElementById('new-chat-msg');
    if (msgInput) msgInput.value = '';

    // Popula seletor de canal quando houver 2+ contas
    const accounts = this.getAccounts();
    const accWrapper = document.getElementById('new-chat-account-wrapper');
    const accSelect = document.getElementById('new-chat-account-select');
    if (accWrapper && accSelect) {
      if (accounts.length > 1) {
        accWrapper.classList.remove('d-none');
        const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
        const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
        const preferred = this.activeAccountFilter !== 'all'
          ? this.activeAccountFilter
          : (accounts.find(a => a.status === 'connected')?.id || accounts[0].id);

        accSelect.innerHTML = accounts.map(a => `
          <option value="${escAttr(a.id)}" ${a.id === preferred ? 'selected' : ''}>
            ${esc(a.label)} ${a.phone_number ? `(${esc(a.phone_number)})` : a.status === 'connected' ? '(Online)' : '(Desconectado)'}
          </option>
        `).join('');
      } else {
        accWrapper.classList.add('d-none');
      }
    }

    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const countEl = document.getElementById('modal-leads-count');
    if (countEl) countEl.textContent = leads.length;

    this.renderModalCrmLeads();

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    setTimeout(() => {
      if (phoneInput) phoneInput.focus();
    }, 350);
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
            <img src="${avatarSrc}" alt="" width="42" height="42" class="rounded-circle object-fit-cover shadow-sm" onerror="this.src='../assets/images/profile/user-1.jpg'">
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
              <button type="button" class="btn btn-sm btn-primary d-flex align-items-center gap-1 px-3" 
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

  getSelectedModalAccountId() {
    const accounts = this.getAccounts();
    const accSelect = document.getElementById('new-chat-account-select');
    if (accSelect && accounts.length > 1 && accSelect.value) {
      return accSelect.value;
    }
    if (this.activeAccountFilter && this.activeAccountFilter !== 'all') {
      return this.activeAccountFilter;
    }
    return accounts[0] ? accounts[0].id : 'default';
  }

  startChatWithLead(leadId) {
    if (!window.crmStore) return;
    const leads = window.crmStore.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.phone) {
      if (window.mqUI) window.mqUI.toast('Este lead não possui um telefone cadastrado.', { type: 'warning' });
      return;
    }

    const accountId = this.getSelectedModalAccountId();
    this.startChatWithNumber(lead.phone, lead.name, '', false, lead.id, accountId);

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

    const accountId = this.getSelectedModalAccountId();
    this.startChatWithNumber(phone, name, msg, createLead, null, accountId);

    const modalEl = document.getElementById('newChatModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

  startChatWithNumber(rawPhone, name = '', initialMsg = '', createLead = true, leadId = null, accountId = null) {
    if (!window.crmStore) return;

    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return;

    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    const accounts = this.getAccounts();
    const targetAccountId = accountId || (this.activeAccountFilter && this.activeAccountFilter !== 'all' ? this.activeAccountFilter : (accounts[0]?.id || 'default'));
    const chatId = targetAccountId === 'default' ? `chat-${cleanPhone}` : `chat-${targetAccountId}-${cleanPhone}`;

    // Verifica se ja existe chat para esse numero nessa conta
    const existingAccountChats = window.crmStore.getWhatsAppChats(targetAccountId);
    const last8 = cleanPhone.slice(-8);
    let chat = existingAccountChats.find(c =>
      c.id === chatId ||
      (last8 && (c.phone || '').replace(/\D/g, '').endsWith(last8))
    );

    if (!leadId) {
      const leads = window.crmStore.getLeads();
      const matchedLead = leads.find(l => (l.phone || '').replace(/\D/g, '').endsWith(last8));
      if (matchedLead) {
        leadId = matchedLead.id;
        if (!name) name = matchedLead.name;
      }
    }

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
      chat = window.crmStore.saveWhatsAppChat({
        id: chatId,
        tenant_id: window.crmStore.getActiveTenantId(),
        account_id: targetAccountId,
        lead_id: leadId,
        name: name || `+${cleanPhone}`,
        phone: rawPhone.includes('(') ? rawPhone : `+${cleanPhone}`,
        avatar: '../assets/images/profile/user-1.jpg',
        unread_count: 0,
        last_message: initialMsg || 'Conversa iniciada',
        last_message_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        messages: []
      });
    } else {
      if (leadId && !chat.lead_id) chat.lead_id = leadId;
      if (name && chat.name.includes('+')) chat.name = name;
      chat = window.crmStore.saveWhatsAppChat(chat);
    }

    // Se o usuário estava filtrando outra aba que nao contem este canal, muda para 'all' ou para o canal
    if (this.activeAccountFilter !== 'all' && this.activeAccountFilter !== targetAccountId) {
      this.selectAccountTab(accounts.length > 1 ? 'all' : targetAccountId);
    }

    this.renderAccountTabs();
    this.renderChatList();
    this.selectChat(chat.id);

    if (initialMsg && initialMsg.trim()) {
      window.crmStore.sendWhatsAppMessage(chat.id, initialMsg.trim());
      this.sendRealWhatsAppMessage(cleanPhone, initialMsg.trim(), targetAccountId);
    }
  }

  async sendRealWhatsAppMessage(phone, text, accountId = 'default') {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const payload = JSON.stringify({ accountId: accountId || 'default', phone: cleanPhone, text });

    try {
      const res = await fetch('http://localhost:8006/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[WhatsApp Manager] Erro no envio direto para 8006:', err);
    }

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
    const filterAccount = this.activeAccountFilter === 'all' ? null : this.activeAccountFilter;
    let chats = window.crmStore.getWhatsAppChats(filterAccount);
    const leads = window.crmStore.getLeads();

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
      const chatPhoneSet = new Set(chats.map(c => (c.phone || '').replace(/\D/g, '').slice(-8)));
      const leadsWithoutChat = leads.filter(l => l.phone && !chatPhoneSet.has(l.phone.replace(/\D/g, '').slice(-8)));

      const virtualLeadChats = leadsWithoutChat.map(lead => ({
        id: `virtual-lead-${lead.id}`,
        is_virtual: true,
        account_id: filterAccount || 'default',
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
    const accounts = this.getAccounts();
    const showChannelChips = accounts.length > 1 && this.activeAccountFilter === 'all';
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

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
      const channelObj = this.activeAccountFilter !== 'all' ? this.getAccountById(this.activeAccountFilter) : null;
      container.innerHTML = `
        <div class="text-center py-5 px-3 text-muted">
          <i class="ti ti-messages-off fs-8 text-secondary mb-2 d-block" aria-hidden="true"></i>
          <p class="mb-1 fw-semibold text-dark fs-3">Nenhuma conversa ${channelObj ? `em ${esc(channelObj.label)}` : 'encontrada'}</p>
          <p class="small mb-3">Inicie um novo atendimento ou pareie este número no QR Code.</p>
          <button type="button" class="btn btn-sm btn-primary" onclick="window.whatsAppManager.openNewChatModal()">
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
      const chatAcc = accounts.find(a => a.id === (chat.account_id || 'default'));
      const safeAccColor = chatAcc && /^#[0-9a-fA-F]{6}$/.test(chatAcc.color || '') ? chatAcc.color : '#143E2B';

      const unreadBadge = chat.unread_count > 0
        ? `<span class="badge bg-primary rounded-pill px-2 py-1 fs-1">${Number(chat.unread_count)}</span>`
        : '';

      const leadTag = isVirtual
        ? `<span class="badge bg-light-success text-success" style="font-size: 10px;"><i class="ti ti-plus me-1" aria-hidden="true"></i>Iniciar</span>`
        : isLead
          ? `<span class="badge bg-light-primary text-primary" style="font-size: 10px;">Lead CRM</span>`
          : `<span class="badge bg-light text-muted border" style="font-size: 10px;">Contato</span>`;

      const channelChip = showChannelChips && chatAcc
        ? `<span class="wa-channel-chip text-truncate" title="Canal: ${escAttr(chatAcc.label)}"><span class="wa-status-dot" style="width:6px;height:6px;background-color:${safeAccColor};" aria-hidden="true"></span><span class="text-truncate">${esc(chatAcc.label)}</span></span>`
        : '';

      const clickHandler = isVirtual
        ? `window.whatsAppManager.startChatWithLead('${escAttr(chat.lead_id)}')`
        : `window.whatsAppManager.selectChat('${escAttr(chat.id)}')`;

      const avatarSrc = escAttr(safeUrl(chat.avatar, '../assets/images/profile/user-1.jpg'));

      return `
        <button type="button" class="wa-chat-item ${isSelected ? 'is-selected' : ''}" onclick="${clickHandler}">
          <div class="d-flex align-items-center gap-3">
            <div class="position-relative flex-shrink-0">
              <img src="${avatarSrc}" width="44" height="44" class="rounded-circle object-fit-cover shadow-sm" alt="" onerror="this.src='../assets/images/profile/user-1.jpg'">
              <span class="position-absolute bottom-0 end-0 p-1 ${isVirtual ? 'bg-secondary' : 'bg-success'} border border-white rounded-circle" aria-hidden="true"></span>
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                <h6 class="mb-0 fw-semibold text-truncate fs-3 text-dark">${esc(chat.name)}</h6>
                <span class="text-muted flex-shrink-0" style="font-size: 11px;">${esc(chat.last_message_time || '')}</span>
              </div>
              <p class="mb-1 text-muted text-truncate fs-2">
                ${esc(chat.last_message || 'Nenhuma mensagem')}
              </p>
              <div class="d-flex align-items-center justify-content-between gap-1">
                <div class="d-flex align-items-center gap-1 min-w-0">
                  ${leadTag}
                  ${channelChip}
                </div>
                ${unreadBadge}
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

    const shell = document.getElementById('whatsapp-shell');
    if (shell) shell.classList.add('mobile-chat-open');

    if (chat.unread_count > 0) {
      chat.unread_count = 0;
      window.crmStore.saveWhatsAppChat(chat);
      this.renderAccountTabs();
    }

    this.renderChatList();
    this.renderChatHeader(chat);
    this.renderMessages(chat);
    this.renderLeadPanel(chat);
    this.updateComposerIndicator(chat);

    const input = document.getElementById('chat-message-input');
    if (input && window.innerWidth >= 768) input.focus();
  }

  closeMobileChat() {
    const shell = document.getElementById('whatsapp-shell');
    if (shell) shell.classList.remove('mobile-chat-open');
  }

  updateComposerIndicator(chat) {
    const indicator = document.getElementById('wa-composer-channel-indicator');
    if (!indicator) return;
    const accounts = this.getAccounts();
    if (!chat || accounts.length <= 1) {
      indicator.classList.add('d-none');
      indicator.classList.remove('d-flex');
      return;
    }

    const acc = this.getAccountById(chat.account_id || 'default');
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const safeColor = acc && /^#[0-9a-fA-F]{6}$/.test(acc.color || '') ? acc.color : '#143E2B';

    indicator.classList.remove('d-none');
    indicator.classList.add('d-flex');
    indicator.innerHTML = `
      <span class="wa-status-dot" style="width:7px;height:7px;background-color:${safeColor};" aria-hidden="true"></span>
      <span>Respondendo via <strong>${esc(acc ? acc.label : 'WhatsApp Principal')}</strong>${acc?.phone_number ? ` (${esc(acc.phone_number)})` : ''}</span>
    `;
  }

  renderEmptyThreadState() {
    const headerEl = document.getElementById('chat-active-header');
    const msgContainer = document.getElementById('chat-messages-container');
    const panel = document.getElementById('chat-lead-panel');
    const indicator = document.getElementById('wa-composer-channel-indicator');

    if (indicator) {
      indicator.classList.add('d-none');
      indicator.classList.remove('d-flex');
    }

    if (headerEl) {
      headerEl.innerHTML = `
        <div class="d-flex align-items-center justify-content-between w-100 p-3 border-bottom bg-white">
          <span class="fw-semibold text-muted fs-2">Selecione uma conversa ao lado ou inicie um novo atendimento</span>
        </div>
      `;
    }

    if (msgContainer) {
      msgContainer.innerHTML = `
        <div class="text-center py-5 text-muted my-auto">
          <div class="bg-white rounded-circle p-3 d-inline-flex mb-3 shadow-sm border" aria-hidden="true">
            <i class="ti ti-brand-whatsapp text-success fs-8"></i>
          </div>
          <h6 class="fw-bold text-dark">Central de Atendimento WhatsApp</h6>
          <p class="small text-muted mb-3">Escolha um contato na lista ao lado ou clique em "Novo" para enviar uma mensagem.</p>
          <button type="button" class="btn btn-sm btn-primary" onclick="window.whatsAppManager.openNewChatModal()">
            <i class="ti ti-message-plus me-1" aria-hidden="true"></i> Iniciar Conversa
          </button>
        </div>
      `;
    }

    if (panel) {
      panel.innerHTML = `
        <div class="p-4 text-center text-muted">
          <i class="ti ti-id fs-8 d-block mb-2 opacity-50" aria-hidden="true"></i>
          <p class="small mb-0">Os detalhes do Lead no CRM aparecem aqui ao selecionar uma conversa.</p>
        </div>
      `;
    }
  }

  renderChatHeader(chat) {
    const headerEl = document.getElementById('chat-active-header');
    if (!headerEl) return;

    const accounts = this.getAccounts();
    const chatAcc = accounts.find(a => a.id === (chat.account_id || 'default'));
    const isLead = !!chat.lead_id;
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);
    const avatarSrc = escAttr(safeUrl(chat.avatar, '../assets/images/profile/user-1.jpg'));
    const cleanWaDigits = (chat.phone || '').replace(/\D/g, '');
    const safeAccColor = chatAcc && /^#[0-9a-fA-F]{6}$/.test(chatAcc.color || '') ? chatAcc.color : '#143E2B';

    headerEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100 p-3 border-bottom bg-white">
        <div class="d-flex align-items-center gap-2 gap-md-3 min-w-0">
          <button type="button" class="btn btn-sm btn-light d-md-none flex-shrink-0" onclick="window.whatsAppManager.closeMobileChat()" aria-label="Voltar para a lista de conversas">
            <i class="ti ti-arrow-left fs-5" aria-hidden="true"></i>
          </button>
          <div class="position-relative flex-shrink-0">
            <img src="${avatarSrc}" alt="" width="42" height="42" class="rounded-circle object-fit-cover shadow-sm" onerror="this.src='../assets/images/profile/user-1.jpg'">
            <span class="position-absolute bottom-0 end-0 p-1 bg-success border border-white rounded-circle" aria-hidden="true"></span>
          </div>
          <div class="min-w-0">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h6 class="mb-0 fw-bold fs-3 text-dark text-truncate">${esc(chat.name)}</h6>
              ${isLead ? '<span class="badge bg-light-success text-success d-none d-sm-inline-flex align-items-center" style="font-size: 11px;"><i class="ti ti-check me-1" aria-hidden="true"></i>Lead Sincronizado</span>' : ''}
              ${accounts.length > 1 && chatAcc ? `<span class="wa-channel-chip d-none d-sm-inline-flex"><span class="wa-status-dot" style="width:6px;height:6px;background-color:${safeAccColor};" aria-hidden="true"></span>via ${esc(chatAcc.label)}</span>` : ''}
            </div>
            <p class="mb-0 text-muted fs-2 text-truncate">
              <i class="ti ti-phone me-1" aria-hidden="true"></i>${esc(chat.phone)} 
              <span class="mx-1">•</span> 
              <span class="text-success fw-semibold"><i class="ti ti-point-filled" aria-hidden="true"></i>WhatsApp ativo</span>
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
          <div class="bg-white rounded-circle p-3 d-inline-flex mb-3 shadow-sm border" aria-hidden="true">
            <i class="ti ti-message-dots text-primary fs-8"></i>
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
        ? `<i class="ti ti-checks wa-bubble-out-check ms-1" title="Entregue e Lida" aria-label="Entregue"></i>`
        : '';

      html += `
        <div class="d-flex mb-2 ${isMe ? 'justify-content-end' : 'justify-content-start'}">
          <div class="message-bubble p-2 px-3 ${isMe ? 'wa-bubble-out' : 'wa-bubble-in'}" 
               style="max-width: 72%; min-width: 110px; word-break: break-word;">
            ${!isMe && msg.sender_name ? `<div class="fw-semibold mb-1 text-primary" style="font-size: 11px;">${esc(msg.sender_name)}</div>` : ''}
            <div class="fs-2 mb-1" style="line-height: 1.45; white-space: pre-wrap;">${esc(msg.text)}</div>
            <div class="text-end d-flex align-items-center justify-content-end ${isMe ? 'wa-bubble-out-meta' : 'wa-bubble-in-meta'}">
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

    if (chat && chat.phone) {
      this.sendRealWhatsAppMessage(chat.phone, text, chat.account_id || 'default').then(res => {
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

    if (this.currentChatId === 'chat-demo-3') {
      setTimeout(() => {
        const answers = [
          'Legal! Qual seria o valor mensal desse plano para 5 vendedores?',
          'Obrigado pelo retorno rápido! Vocês oferecem treinamento inicial?',
          'Perfeito, vou compartilhar com os sócios da empresa e te confirmo hoje!'
        ];
        const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
        window.crmStore.receiveWhatsAppMessage('chat-demo-3', randomAnswer, 'Lucas Mendes', 'default');
      }, 2500);
    }
  }

  renderLeadPanel(chat) {
    const panel = document.getElementById('chat-lead-panel');
    if (!panel) return;

    const accounts = this.getAccounts();
    const chatAcc = accounts.find(a => a.id === (chat.account_id || 'default'));
    const leads = window.crmStore.getLeads();
    const lead = chat.lead_id ? leads.find(l => l.id === chat.lead_id) : null;
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    if (lead) {
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
            <img src="${avatarSrc}" alt="" width="64" height="64" class="rounded-circle shadow-sm mb-2 object-fit-cover" onerror="this.src='../assets/images/profile/user-1.jpg'">
            <h6 class="mb-0 fw-bold fs-4">${esc(lead.name)}</h6>
            <p class="text-muted small mb-2">${esc(lead.company || 'Empresa não informada')}</p>
            <div class="d-inline-flex align-items-center gap-1 badge bg-light-warning text-warning px-2 py-1">
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
            ${accounts.length > 1 && chatAcc ? `
              <div class="list-group-item d-flex justify-content-between py-2">
                <span class="text-muted">Canal:</span>
                <span class="fw-semibold text-dark">${esc(chatAcc.label)}</span>
              </div>
            ` : ''}
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
        <div class="p-3 border-bottom bg-light d-flex align-items-center justify-content-between">
          <h6 class="mb-0 fw-bold fs-3 text-dark">
            <i class="ti ti-user-plus me-1 text-primary" aria-hidden="true"></i> Contato Não Cadastrado
          </h6>
          ${accounts.length > 1 && chatAcc ? `<span class="wa-channel-chip">${esc(chatAcc.label)}</span>` : ''}
        </div>

        <div class="p-4 text-center">
          <div class="bg-light-primary text-primary rounded-circle p-3 d-inline-flex mb-3" aria-hidden="true">
            <i class="ti ti-user-plus fs-7"></i>
          </div>
          <h6 class="fw-bold mb-1 text-dark">${esc(chat.name)}</h6>
          <p class="text-muted small mb-3">${esc(chat.phone)}</p>
          <div class="p-3 rounded-3 bg-light border text-start small text-muted mb-3" style="font-size: 12px;">
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
