/**
 * Metrifique-se CRM - Kanban Sales Funnel Manager
 * Handles Drag and Drop, Column Creation, Column Editing & Interactive Searchable Contact Selection.
 */

class KanbanManager {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.renderKanbanBoard();
        this.bindEvents();
        this.setupLeadSearch();
      });
    } else {
      this.renderKanbanBoard();
      this.bindEvents();
      this.setupLeadSearch();
    }

    window.addEventListener('deals-synced', () => this.renderKanbanBoard());
    window.addEventListener('leads-synced', () => {
      this.renderKanbanBoard();
      this.setupLeadSearch();
    });
  }

  bindEvents() {
    const dealForm = document.getElementById('new-deal-form');
    if (dealForm) {
      dealForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateDeal();
      });
    }

    const stageForm = document.getElementById('new-stage-form');
    if (stageForm) {
      stageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateStage();
      });
    }

    const addDealBtn = document.querySelectorAll('[data-bs-target="#addDealModal"]');
    addDealBtn.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setupLeadSearch();
      });
    });
  }

  setupLeadSearch() {
    const searchInput = document.getElementById('deal-lead-search');
    const resultsContainer = document.getElementById('deal-lead-results');
    const hiddenSelect = document.getElementById('deal-lead-select');
    const clearBtn = document.getElementById('deal-lead-clear-btn');

    if (!searchInput || !resultsContainer || !hiddenSelect) return;

    if (searchInput.dataset.searchBound === 'true') return;
    searchInput.dataset.searchBound = 'true';

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;

    if (!resultsContainer.dataset.delegatedBound) {
      resultsContainer.dataset.delegatedBound = 'true';
      resultsContainer.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.js-kanban-lead-pick');
        if (!btn) return;
        this.selectLeadForDeal(btn.dataset.leadId, btn.dataset.leadName, btn.dataset.leadCompany);
      });
    }

    const renderResults = (query = '') => {
      const leads = window.crmStore ? window.crmStore.getLeads() : [];
      const cleanQuery = query.toLowerCase().trim();

      const filtered = leads.filter(l => {
        if (!cleanQuery) return true;
        const nameMatch = (l.name || '').toLowerCase().includes(cleanQuery);
        const companyMatch = (l.company || '').toLowerCase().includes(cleanQuery);
        const emailMatch = (l.email || '').toLowerCase().includes(cleanQuery);
        return nameMatch || companyMatch || emailMatch;
      });

      if (filtered.length === 0) {
        resultsContainer.innerHTML = `
          <div class="list-group-item text-muted text-center py-3 fs-2 bg-white">
            <i class="ti ti-user-x d-block fs-5 opacity-50 mb-1" aria-hidden="true"></i>
            Nenhum contato encontrado
          </div>
        `;
        resultsContainer.style.display = 'block';
        return;
      }

      resultsContainer.innerHTML = filtered.map(l => `
          <button type="button" class="list-group-item list-group-item-action px-3 py-2 border-bottom d-flex align-items-center justify-content-between text-start bg-white js-kanban-lead-pick"
                  data-lead-id="${escAttr(l.id)}"
                  data-lead-name="${escAttr(l.name || '')}"
                  data-lead-company="${escAttr(l.company || '')}">
            <div class="d-flex align-items-center gap-2">
              <div class="bg-light-primary text-primary p-2 rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; flex-shrink: 0;" aria-hidden="true">
                <i class="ti ti-user fs-4"></i>
              </div>
              <div>
                <strong class="text-dark fs-2 d-block mb-0">${esc(l.name)}</strong>
                <small class="text-muted fs-1">${l.company ? esc(l.company) + ' • ' : ''}${esc(l.email || 'Sem e-mail')}</small>
              </div>
            </div>
            <span class="badge bg-light text-primary border fs-1">Selecionar</span>
          </button>
        `).join('');

      resultsContainer.style.display = 'block';
    };

    searchInput.addEventListener('focus', () => {
      if (!hiddenSelect.value) {
        renderResults(searchInput.value);
      }
    });

    searchInput.addEventListener('input', (e) => {
      hiddenSelect.value = '';
      if (clearBtn) clearBtn.classList.add('d-none');
      renderResults(e.target.value);
    });

    document.addEventListener('click', (e) => {
      const isInside = searchInput.contains(e.target) || resultsContainer.contains(e.target);
      if (!isInside) {
        resultsContainer.style.display = 'none';
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        hiddenSelect.value = '';
        searchInput.value = '';
        searchInput.readOnly = false;
        clearBtn.classList.add('d-none');
        resultsContainer.style.display = 'none';
        searchInput.focus();
      });
    }
  }

  selectLeadForDeal(leadId, leadName, company) {
    const searchInput = document.getElementById('deal-lead-search');
    const resultsContainer = document.getElementById('deal-lead-results');
    const hiddenSelect = document.getElementById('deal-lead-select');
    const clearBtn = document.getElementById('deal-lead-clear-btn');

    if (hiddenSelect) hiddenSelect.value = leadId;
    if (searchInput) {
      searchInput.value = company ? `${leadName} (${company})` : leadName;
      searchInput.readOnly = true;
    }
    if (clearBtn) clearBtn.classList.remove('d-none');
    if (resultsContainer) resultsContainer.style.display = 'none';
  }

  openDealModal(leadId) {
    this.setupLeadSearch();
    if (leadId) {
      const leads = window.crmStore ? window.crmStore.getLeads() : [];
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        this.selectLeadForDeal(lead.id, lead.name, lead.company);
      }
    } else {
      const searchInput = document.getElementById('deal-lead-search');
      const hiddenSelect = document.getElementById('deal-lead-select');
      const clearBtn = document.getElementById('deal-lead-clear-btn');
      if (hiddenSelect) hiddenSelect.value = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.readOnly = false;
      }
      if (clearBtn) clearBtn.classList.add('d-none');
    }

    const modalEl = document.getElementById('addDealModal');
    if (modalEl && window.bootstrap) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  announceKanban(message) {
    const liveEl = document.getElementById('kanban-live-status');
    if (liveEl) {
      liveEl.textContent = '';
      setTimeout(() => { liveEl.textContent = message; }, 20);
    } else if (window.mqUI && window.mqUI.ariaNotify) {
      window.mqUI.ariaNotify(message);
    }
  }

  moveDealAndFocus(dealId, targetStageId, restoreFocus = false) {
    const stages = window.crmStore.getStages();
    const deals = window.crmStore.getDeals();
    const deal = deals.find(d => d.id === dealId);
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!deal || !targetStage || deal.stage_id === targetStageId) return;

    window.crmStore.moveDealStage(dealId, targetStageId);
    this.renderKanbanBoard();

    const msg = `Oportunidade "${deal.title}" movida para ${targetStage.name}.`;
    this.announceKanban(msg);
    if (window.mqUI) window.mqUI.toast(msg, { type: 'success', duration: 2800 });

    if (restoreFocus) {
      setTimeout(() => {
        const handle = document.querySelector(`#deal-card-${CSS.escape(dealId)} .kanban-drag-handle`);
        if (handle) handle.focus();
      }, 30);
    }
  }

  handleHandleKeydown(e, dealId, currentStageIdx) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const stages = window.crmStore.getStages();
    const nextIdx = e.key === 'ArrowRight' ? currentStageIdx + 1 : currentStageIdx - 1;
    if (nextIdx >= 0 && nextIdx < stages.length) {
      e.preventDefault();
      this.moveDealAndFocus(dealId, stages[nextIdx].id, true);
    }
  }

  renderKanbanBoard() {
    const boardContainer = document.getElementById('kanban-board-container');
    if (!boardContainer) return;

    const stages = window.crmStore.getStages();
    const deals = window.crmStore.getDeals();
    const leads = window.crmStore.getLeads();

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;

    if (!boardContainer.dataset.delegatedBound) {
      boardContainer.dataset.delegatedBound = 'true';
      boardContainer.addEventListener('click', (ev) => {
        const renameBtn = ev.target.closest('.js-rename-stage-btn');
        if (renameBtn) {
          this.editStagePrompt(renameBtn.dataset.stageId, renameBtn.dataset.stageName);
          return;
        }
        const moveBtn = ev.target.closest('.js-move-deal-stage-btn');
        if (moveBtn) {
          this.moveDealAndFocus(moveBtn.dataset.dealId, moveBtn.dataset.stageId, false);
        }
      });
    }

    boardContainer.innerHTML = stages.map((stage, stageIdx) => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
      const safeStageId = escAttr(stage.id);
      const safeStageName = esc(stage.name);
      const safeStageColor = /^#[0-9a-fA-F]{6}$/.test(stage.color || '') ? stage.color : '#143E2B';

      const cardsHtml = stageDeals.map(deal => {
        const lead = leads.find(l => l.id === deal.lead_id) || { name: 'Contato não associado', company: '' };
        const safeDealId = escAttr(deal.id);
        const safeDealTitle = esc(deal.title);
        const stageProgressMap = { 'stage-1': 20, 'stage-2': 40, 'stage-3': 60, 'stage-4': 80, 'stage-5': 100 };
        const progressPct = stageProgressMap[stage.id] || 50;

        const moveStageMenuItems = stages
          .filter(s => s.id !== stage.id)
          .map(s => `
            <li>
              <button type="button" class="dropdown-item js-move-deal-stage-btn" data-deal-id="${safeDealId}" data-stage-id="${escAttr(s.id)}">
                <i class="ti ti-arrow-right me-2" aria-hidden="true"></i>${esc(s.name)}
              </button>
            </li>
          `).join('');

        return `
          <div class="card mb-3 kanban-card shadow-sm border bg-white rounded" 
               draggable="true" 
               ondragstart="window.kanbanManager.handleDragStart(event, '${safeDealId}')"
               ondragend="window.kanbanManager.handleDragEnd(event)"
               id="deal-card-${safeDealId}">
            <div class="card-body p-3">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                <span class="badge bg-light-primary text-primary fw-semibold text-truncate" style="max-width: 140px;">${esc(lead.company || 'Empresa')}</span>
                <div class="d-flex align-items-center gap-1">
                  <span class="fw-bold text-success fs-3 text-nowrap">R$ ${(parseFloat(deal.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <button type="button"
                          class="btn btn-sm btn-link text-muted p-1 kanban-drag-handle"
                          title="Arrastar ou usar setas ← → para mover de coluna"
                          aria-label="Mover oportunidade ${escAttr(deal.title)} com setas esquerda/direita ou arrastar"
                          onkeydown="window.kanbanManager.handleHandleKeydown(event, '${safeDealId}', ${stageIdx})">
                    <i class="ti ti-grip-vertical fs-4" aria-hidden="true"></i>
                  </button>
                </div>
              </div>

              <h6 class="card-title fw-bold mb-1 fs-3 text-dark">${safeDealTitle}</h6>
              <p class="text-muted fs-2 mb-2"><i class="ti ti-user me-1" aria-hidden="true"></i> ${esc(lead.name)}</p>

              <div class="hs-deal-progress mb-2">
                <div class="hs-deal-progress-bar" style="width: ${progressPct}%;"></div>
              </div>
              
              <div class="d-flex align-items-center justify-content-between pt-2 border-top">
                <small class="text-muted fs-1"><i class="ti ti-calendar me-1" aria-hidden="true"></i> ${new Date(deal.created_at).toLocaleDateString('pt-BR')}</small>
                <div class="d-flex align-items-center gap-1">
                  <button type="button" class="btn btn-sm btn-light-success text-success p-1 rounded-circle" onclick="window.kanbanManager.openWhatsAppModal('${safeDealId}', '${escAttr(deal.lead_id)}')" title="Enviar WhatsApp Rápido" aria-label="Enviar WhatsApp rápido para ${escAttr(lead.name)}">
                    <i class="ti ti-brand-whatsapp fs-4" aria-hidden="true"></i>
                  </button>
                  <div class="dropdown">
                    <button type="button" class="btn btn-sm btn-light p-1 rounded-circle" data-bs-toggle="dropdown" aria-label="Ações para oportunidade ${escAttr(deal.title)}">
                      <i class="ti ti-dots-vertical fs-3" aria-hidden="true"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm fs-2">
                      ${moveStageMenuItems ? `<li class="dropdown-header fs-1 text-uppercase">Mover para etapa</li>${moveStageMenuItems}<li><hr class="dropdown-divider"></li>` : ''}
                      <li><button type="button" class="dropdown-item text-success" onclick="window.kanbanManager.markDealStatus('${safeDealId}', 'stage-5')"><i class="ti ti-trophy me-2" aria-hidden="true"></i>Marcar Ganho</button></li>
                      <li><button type="button" class="dropdown-item text-warning" onclick="window.kanbanManager.markDealStatus('${safeDealId}', 'stage-lost')"><i class="ti ti-x me-2" aria-hidden="true"></i>Marcar Perdido</button></li>
                      <li><hr class="dropdown-divider"></li>
                      <li><button type="button" class="dropdown-item text-danger" onclick="window.kanbanManager.deleteDealPrompt('${safeDealId}')"><i class="ti ti-trash me-2" aria-hidden="true"></i>Excluir Oportunidade</button></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="col-10 col-sm-6 col-md-4 col-lg-3 mb-4 flex-shrink-0">
          <div class="kanban-column p-3 rounded bg-light border"
               ondragover="window.kanbanManager.handleDragOver(event)"
               ondragleave="window.kanbanManager.handleDragLeave(event)"
               ondrop="window.kanbanManager.handleDrop(event, '${safeStageId}')">
            
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center gap-2 min-w-0">
                <span class="badge rounded-circle p-2 flex-shrink-0" style="background-color: ${safeStageColor};" aria-hidden="true"></span>
                <h6 class="fw-bold mb-0 text-dark text-truncate">${safeStageName}</h6>
                <span class="badge bg-white text-dark border px-2 py-1">${stageDeals.length}</span>
              </div>

              <!-- DROPDOWN DE EDICAO DE ETAPA -->
              <div class="dropdown">
                <button type="button" class="btn btn-sm btn-light p-1" data-bs-toggle="dropdown" aria-label="Opções da coluna ${escAttr(stage.name)}">
                  <i class="ti ti-dots-vertical" aria-hidden="true"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end fs-2">
                  <li><button type="button" class="dropdown-item js-rename-stage-btn" data-stage-id="${safeStageId}" data-stage-name="${escAttr(stage.name)}"><i class="ti ti-edit me-1" aria-hidden="true"></i> Renomear Coluna</button></li>
                  <li><button type="button" class="dropdown-item text-danger" onclick="window.kanbanManager.deleteStage('${safeStageId}')"><i class="ti ti-trash me-1" aria-hidden="true"></i> Excluir Coluna</button></li>
                </ul>
              </div>
            </div>

            <div class="mb-3 fs-2 text-muted fw-semibold">
              Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div class="kanban-cards-wrapper" style="min-height: 450px;">
              ${cardsHtml || '<div class="text-center py-4 text-muted fs-2 border border-dashed rounded">Arraste negociações para cá ou use o menu do cartão</div>'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const selectStage = document.getElementById('deal-stage-select');
    if (selectStage) {
      selectStage.innerHTML = stages.map(s => `<option value="${escAttr(s.id)}">${esc(s.name)}</option>`).join('');
    }

    this.setupLeadSearch();
  }

  handleDragStart(e, dealId) {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('is-dragging');
  }

  handleDragEnd(e) {
    e.currentTarget.classList.remove('is-dragging');
    document.querySelectorAll('.kanban-column.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('is-drag-over');
  }

  handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('is-drag-over');
    }
  }

  handleDrop(e, targetStageId) {
    e.preventDefault();
    e.currentTarget.classList.remove('is-drag-over');
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId) {
      this.moveDealAndFocus(dealId, targetStageId, false);
    }
  }

  markDealStatus(dealId, targetStageId) {
    this.moveDealAndFocus(dealId, targetStageId, false);
  }

  handleCreateDeal() {
    const title = document.getElementById('deal-title-input').value;
    const leadId = document.getElementById('deal-lead-select').value;
    const value = parseFloat(document.getElementById('deal-value-input').value) || 0;
    const stageId = document.getElementById('deal-stage-select').value || 'stage-1';

    if (!title || !leadId) {
      if (window.mqUI) window.mqUI.toast('Preencha o título da oportunidade e selecione um contato na busca.', { type: 'warning' });
      return;
    }

    const newDeal = {
      title,
      lead_id: leadId,
      stage_id: stageId,
      value,
      status: 'open'
    };

    window.crmStore.saveDeal(newDeal);

    const modalEl = document.getElementById('addDealModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('new-deal-form').reset();
    const searchInput = document.getElementById('deal-lead-search');
    const hiddenSelect = document.getElementById('deal-lead-select');
    const clearBtn = document.getElementById('deal-lead-clear-btn');
    if (hiddenSelect) hiddenSelect.value = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.readOnly = false;
    }
    if (clearBtn) clearBtn.classList.add('d-none');

    this.renderKanbanBoard();
    if (window.mqUI) window.mqUI.toast('Oportunidade adicionada ao funil!', { type: 'success' });
  }

  handleCreateStage() {
    const name = document.getElementById('stage-name-input').value;
    const color = document.getElementById('stage-color-input').value;

    if (!name) {
      if (window.mqUI) window.mqUI.toast('Preencha o nome da nova etapa/coluna.', { type: 'warning' });
      return;
    }

    window.crmStore.saveStage({ name, color });

    const modalEl = document.getElementById('addStageModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('new-stage-form').reset();
    this.renderKanbanBoard();
    if (window.mqUI) window.mqUI.toast('Nova coluna criada no Kanban!', { type: 'success' });
  }

  async editStagePrompt(stageId, currentName) {
    const newName = window.mqUI
      ? await window.mqUI.prompt({
          title: 'Renomear etapa',
          label: 'Nome da coluna do Kanban',
          defaultValue: currentName,
          confirmLabel: 'Salvar nome',
          required: true
        })
      : null;
    if (newName && newName.trim() !== '') {
      window.crmStore.saveStage({ id: stageId, name: newName.trim() });
      this.renderKanbanBoard();
      if (window.mqUI) window.mqUI.toast('Nome da coluna atualizado.', { type: 'success' });
    }
  }

  async deleteStage(stageId) {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Excluir coluna do Kanban',
          message: 'Tem certeza que deseja excluir esta coluna do Kanban?',
          confirmLabel: 'Excluir coluna',
          danger: true
        })
      : false;
    if (confirmed) {
      if (window.crmStore.deleteStage(stageId)) {
        this.renderKanbanBoard();
        if (window.mqUI) window.mqUI.toast('Coluna removida.', { type: 'success' });
      }
    }
  }

  async deleteDealPrompt(dealId) {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Excluir oportunidade comercial',
          message: 'Tem certeza que deseja excluir esta oportunidade comercial permanentemente?',
          confirmLabel: 'Excluir oportunidade',
          danger: true
        })
      : false;
    if (confirmed) {
      window.crmStore.deleteDeal(dealId);
      this.renderKanbanBoard();
      if (window.mqUI) window.mqUI.toast('Oportunidade excluída.', { type: 'success' });
    }
  }

  openWhatsAppModal(dealId, leadId) {
    const deals = window.crmStore ? window.crmStore.getDeals() : [];
    const leads = window.crmStore ? window.crmStore.getLeads() : [];

    const deal = deals.find(d => d.id === dealId);
    const lead = leads.find(l => l.id === (leadId || (deal ? deal.lead_id : '')));

    const recipientInput = document.getElementById('wa-recipient-name');
    const phoneInput = document.getElementById('wa-lead-phone');
    const dealIdInput = document.getElementById('wa-deal-id');
    const templateSelect = document.getElementById('wa-template-select');
    const msgText = document.getElementById('wa-message-text');

    if (dealIdInput) dealIdInput.value = dealId;
    if (phoneInput) phoneInput.value = lead ? (lead.phone || '') : '';
    if (recipientInput) recipientInput.value = lead ? `${lead.name} (${lead.company || lead.phone || 'Sem Telefone'})` : 'Contato Desconhecido';
    if (templateSelect) templateSelect.value = 'custom';
    if (msgText) msgText.value = '';

    const modalEl = document.getElementById('quickWhatsAppModal');
    if (modalEl && window.bootstrap) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  onWhatsAppTemplateChange() {
    const select = document.getElementById('wa-template-select');
    const msgText = document.getElementById('wa-message-text');
    const dealId = document.getElementById('wa-deal-id').value;

    const deals = window.crmStore ? window.crmStore.getDeals() : [];
    const leads = window.crmStore ? window.crmStore.getLeads() : [];

    const deal = deals.find(d => d.id === dealId) || { title: 'Negócio', value: 0 };
    const lead = leads.find(l => l.id === deal.lead_id) || { name: 'Cliente', company: 'Empresa' };

    const name = lead.name || 'Cliente';
    const company = lead.company || 'sua empresa';
    const val = parseFloat(deal.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const templates = {
      welcome: `Olá ${name}, tudo bem? Vi seu interesse no Metrifique-se CRM para a ${company}. Como posso te ajudar a alavancar suas vendas hoje?`,
      proposal: `Olá ${name}, tudo bem? Acabei de preparar a proposta comercial para a ${company} no valor de R$ ${val}. Consegue dar uma olhada agora?`,
      meeting: `Olá ${name}! Confirmando nossa reunião agendada para conversarmos sobre a ${company}. Qualquer dúvida estou por aqui!`,
      reactivation: `Olá ${name}, tudo bem? Como estão as coisas por aí na ${company}? Passando para saber se faz sentido retomarmos nossa conversa.`,
      post_sale: `Olá ${name}! Seja muito bem-vindo ao Metrifique-se CRM! Segue o link de acesso da ${company} e os primeiros passos de configuração.`
    };

    if (select && msgText && templates[select.value]) {
      msgText.value = templates[select.value];
    }
  }

  sendWhatsAppMessage() {
    const phoneInput = document.getElementById('wa-lead-phone');
    const msgText = document.getElementById('wa-message-text');

    const rawPhone = (phoneInput ? phoneInput.value : '').replace(/[^0-9]/g, '');
    const text = msgText ? msgText.value : '';

    if (!text.trim()) {
      if (window.mqUI) window.mqUI.toast('Por favor, selecione um modelo de mensagem ou digite um texto para enviar.', { type: 'warning' });
      return;
    }

    const cleanPhone = rawPhone ? (rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone) : '';
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank', 'noopener,noreferrer');

    const modalEl = document.getElementById('quickWhatsAppModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

  async applyTemplatePrompt(segmentKey) {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Aplicar modelo de funil',
          message: 'As colunas do seu Kanban serão atualizadas para a estrutura do segmento selecionado. Deseja aplicar o novo modelo?',
          confirmLabel: 'Aplicar modelo'
        })
      : false;
    if (confirmed) {
      if (window.crmStore && window.crmStore.applySegmentTemplate(segmentKey)) {
        const modalEl = document.getElementById('segmentTemplateModal');
        if (modalEl && window.bootstrap) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        this.renderKanbanBoard();
        if (window.mqUI) window.mqUI.toast('Modelo de funil aplicado ao Kanban!', { type: 'success' });
      }
    }
  }
}

window.kanbanManager = new KanbanManager();
