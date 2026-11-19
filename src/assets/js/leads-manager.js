/**
 * Metrifique-se CRM - Leads Manager Module (Interactive 3-Column Profile View)
 * Manages Leads List, Real-time Filters, Scoring, Interactive Tabs, and Lead Property Editing.
 */

class LeadsManager {
  constructor() {
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.currentModalLeadId = null;
    this.activeTab = 'all';
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.renderLeadsTable();
      this.bindEvents();
    });

    window.addEventListener('leads-synced', () => {
      this.renderLeadsTable();
    });
  }

  bindEvents() {
    const searchInput = document.getElementById('search-leads-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderLeadsTable();
      });
    }

    const filterSelect = document.getElementById('filter-stage-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.renderLeadsTable();
      });
    }

    const newLeadForm = document.getElementById('new-lead-form');
    if (newLeadForm) {
      newLeadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateLead();
      });
    }

    const editLeadForm = document.getElementById('edit-lead-form');
    if (editLeadForm) {
      editLeadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveEditedLead();
      });
    }
  }

  getFilteredLeads() {
    let leads = window.crmStore ? window.crmStore.getLeads() : [];

    if (this.currentFilter !== 'all') {
      leads = leads.filter(l => l.lifecycle_stage === this.currentFilter);
    }

    if (this.searchQuery) {
      leads = leads.filter(l =>
        (l.name && l.name.toLowerCase().includes(this.searchQuery)) ||
        (l.email && l.email.toLowerCase().includes(this.searchQuery)) ||
        (l.company && l.company.toLowerCase().includes(this.searchQuery)) ||
        (l.phone && l.phone.includes(this.searchQuery))
      );
    }

    return leads;
  }

  renderLeadsTable() {
    const container = document.getElementById('leads-table-body');
    if (!container) return;

    const leads = this.getFilteredLeads();

    if (leads.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            <i class="ti ti-users-minus fs-8 d-block mb-2"></i>
            Nenhum contato encontrado com os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;

    container.innerHTML = leads.map(lead => {
      const scoreBadgeClass = lead.score >= 80 ? 'bg-success text-white' : lead.score >= 40 ? 'bg-primary text-white' : 'bg-secondary text-white';
      const stageBadges = {
        lead: '<span class="badge bg-light-secondary text-secondary px-3 py-1-5 fw-semibold">Lead</span>',
        mql: '<span class="badge bg-light-info text-info px-3 py-1-5 fw-semibold">MQL</span>',
        sql: '<span class="badge bg-light-warning text-warning px-3 py-1-5 fw-semibold">SQL</span>',
        opportunity: '<span class="badge bg-light-primary text-primary px-3 py-1-5 fw-semibold">Oportunidade</span>',
        customer: '<span class="badge bg-light-success text-success px-3 py-1-5 fw-semibold">Cliente</span>',
        lost: '<span class="badge bg-light-danger text-danger px-3 py-1-5 fw-semibold">Perdido</span>'
      };

      const tagsHtml = (lead.tags || []).map(t => `<span class="badge bg-light text-dark me-1 border">${esc(t)}</span>`).join('');
      const safeId = escAttr(lead.id);
      const safeName = esc(lead.name);
      const initial = esc(((lead.name || 'L').charAt(0) || 'L').toUpperCase());

      return `
        <tr>
          <td data-label="Contato">
            <div class="d-flex align-items-center">
              <div class="avatar-sm rounded-circle bg-light-primary text-primary fw-bold me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;" aria-hidden="true">
                ${initial}
              </div>
              <div>
                <h6 class="mb-0 fw-semibold text-dark">${safeName}</h6>
                <small class="text-muted">${esc(lead.job_title || 'Cargo não informado')}</small>
              </div>
            </div>
          </td>
          <td data-label="Empresa / E-mail">
            <div class="fw-semibold text-dark">${esc(lead.company || '-')}</div>
            <small class="text-muted">${esc(lead.email || '')}</small>
          </td>
          <td data-label="Estágio">${stageBadges[lead.lifecycle_stage] || esc(lead.lifecycle_stage)}</td>
          <td data-label="Lead Score">
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${scoreBadgeClass} rounded-pill px-3 py-1 fs-2 shadow-sm">${Number(lead.score) || 0} pts</span>
              <button type="button" class="btn btn-sm btn-light-primary text-primary rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 28px; height: 28px;" title="+10 Pontos de Score" aria-label="Adicionar 10 pontos de score para ${escAttr(lead.name)}" onclick="window.leadsManager.adjustScore('${safeId}', 10)">
                <i class="ti ti-plus fs-4" aria-hidden="true"></i>
              </button>
            </div>
          </td>
          <td data-label="Origem">
            <span class="badge bg-light-primary text-primary px-3 py-1.5 rounded-pill fw-semibold border border-primary border-opacity-10">
              ${esc(lead.source || 'Direto')}
            </span>
          </td>
          <td data-label="Tags">${tagsHtml || '<small class="text-muted">Sem tags</small>'}</td>
          <td data-label="Ações" class="text-end text-nowrap pe-4">
            <div class="d-inline-flex align-items-center justify-content-end gap-2">
              ${lead.phone ? `
                <a href="./whatsapp.html?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.name)}&lead_id=${encodeURIComponent(lead.id)}" 
                   class="btn btn-sm btn-success text-white px-2 py-1-5 d-inline-flex align-items-center gap-1 shadow-sm" 
                   title="Conversar no WhatsApp"
                   aria-label="Conversar no WhatsApp com ${escAttr(lead.name)}">
                  <i class="ti ti-brand-whatsapp fs-4" aria-hidden="true"></i>
                </a>
              ` : ''}
              <button type="button" class="btn btn-sm btn-primary text-nowrap fw-semibold px-3 py-1-5 d-inline-flex align-items-center gap-1 shadow-sm" onclick="window.leadsManager.openLeadModal('${safeId}')" title="Perfil Completo do Contato">
                <i class="ti ti-id fs-4" aria-hidden="true"></i>
                <span>Ver Perfil</span>
              </button>
              <button type="button" class="btn btn-sm btn-light-danger text-danger rounded-circle p-0 d-inline-flex align-items-center justify-content-center" style="width: 32px; height: 32px;" onclick="window.leadsManager.deleteLead('${safeId}')" title="Excluir Contato" aria-label="Excluir contato ${escAttr(lead.name)}">
                <i class="ti ti-trash fs-4" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const totalEl = document.getElementById('total-leads-count');
    if (totalEl) totalEl.innerText = leads.length;
  }

  adjustScore(leadId, amount) {
    const leads = window.crmStore.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.score = Math.max(0, (lead.score || 0) + amount);
      if (lead.score >= 80 && lead.lifecycle_stage === 'lead') {
        lead.lifecycle_stage = 'mql';
        if (!lead.tags) lead.tags = [];
        if (!lead.tags.includes('MQL Automático')) lead.tags.push('MQL Automático');
      }
      window.crmStore.saveLead(lead);
      this.renderLeadsTable();
      if (this.currentModalLeadId === leadId) this.openLeadModal(leadId);
    }
  }

  handleCreateLead() {
    const name = document.getElementById('lead-name-input').value;
    const email = document.getElementById('lead-email-input').value;
    const phone = document.getElementById('lead-phone-input').value;
    const company = document.getElementById('lead-company-input').value;
    const source = document.getElementById('lead-source-input').value;
    const initialScore = parseInt(document.getElementById('lead-score-input').value) || 10;

    if (!name || !email) {
      if (window.mqUI) window.mqUI.toast('Por favor, preencha nome e email do contato.', { type: 'warning' });
      return;
    }

    const newLead = {
      name,
      email,
      phone,
      company,
      lifecycle_stage: 'lead',
      score: initialScore,
      source: source || 'Manual',
      tags: ['Inbound Manual']
    };

    window.crmStore.saveLead(newLead);
    
    const modalEl = document.getElementById('addLeadModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('new-lead-form').reset();
    this.renderLeadsTable();
    if (window.mqUI) window.mqUI.toast('Contato adicionado ao CRM!', { type: 'success' });
  }

  // 3-COLUMN PROFILE MODAL (INTERACTIVE TABS & EDITING)
  openLeadModal(leadId) {
    this.currentModalLeadId = leadId;
    const lead = window.crmStore.getLeads().find(l => l.id === leadId);
    if (!lead) return;

    const deals = window.crmStore.getDeals().filter(d => d.lead_id === lead.id);

    const nameParts = lead.name.split(' ');
    const firstName = nameParts[0] || lead.name;
    const lastName = nameParts.slice(1).join(' ') || '';

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    const safeId = escAttr(lead.id);
    const pendingTasks = (lead.activities || []).filter(a => a.type === 'task' && !a.done).length;

    const modalBody = document.getElementById('lead-modal-details');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="row g-3">
          <!-- COLUNA ESQUERDA: DADOS DO CONTATO -->
          <div class="col-lg-3 border-end">
            <div class="text-center pb-3 mb-3 border-bottom">
              <div class="avatar-lg rounded-circle bg-info-subtle text-info fw-bold mx-auto d-flex align-items-center justify-content-center mb-2" style="width: 72px; height: 72px; font-size: 28px;" aria-hidden="true">
                ${esc(firstName.charAt(0).toUpperCase())}
              </div>
              <h5 class="fw-bold mb-0 text-dark">${esc(lead.name)}</h5>
              <small class="text-muted d-block mb-3">${esc(lead.job_title || 'Cargo não informado')}</small>

              <!-- ACTION PILLS CIRCULARES -->
              <div class="d-flex align-items-center justify-content-center gap-2 mb-3 flex-wrap">
                ${lead.phone ? `
                  <a href="./whatsapp.html?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.name)}&lead_id=${encodeURIComponent(lead.id)}" 
                     class="hs-action-pill text-success" title="Chamar no WhatsApp" aria-label="Chamar ${escAttr(lead.name)} no WhatsApp" style="background-color: #dcfce7; color: #15803d !important;">
                    <i class="ti ti-brand-whatsapp" aria-hidden="true"></i>
                  </a>
                ` : ''}
                <button type="button" class="hs-action-pill border-0" title="Criar Nota" aria-label="Criar Nota" onclick="window.leadsManager.promptAddActivity('${safeId}', 'note')"><i class="ti ti-notes" aria-hidden="true"></i></button>
                <button type="button" class="hs-action-pill border-0" title="Enviar E-mail" aria-label="Registrar E-mail" onclick="window.leadsManager.promptAddActivity('${safeId}', 'email')"><i class="ti ti-mail" aria-hidden="true"></i></button>
                <button type="button" class="hs-action-pill border-0" title="Ligar" aria-label="Registrar Ligação" onclick="window.leadsManager.promptAddActivity('${safeId}', 'call')"><i class="ti ti-phone" aria-hidden="true"></i></button>
                <button type="button" class="hs-action-pill border-0" title="Registrar Tarefa" aria-label="Registrar Tarefa" onclick="window.leadsManager.promptAddActivity('${safeId}', 'task')"><i class="ti ti-circle-plus" aria-hidden="true"></i></button>
                <button type="button" class="hs-action-pill border-0" title="Agendar Reunião" aria-label="Agendar Reunião" onclick="window.leadsManager.promptAddActivity('${safeId}', 'meeting')"><i class="ti ti-calendar" aria-hidden="true"></i></button>
              </div>
            </div>

            <!-- PROPRIEDADES DO CONTATO (EDITÁVEIS) -->
            <div class="px-1">
              <div class="d-flex align-items-center justify-content-between mb-3 text-dark fw-bold">
                <span><i class="ti ti-chevron-down me-1" aria-hidden="true"></i> Sobre este contato</span>
                <button type="button" class="btn btn-sm btn-link p-0 text-primary fw-semibold fs-2" onclick="window.leadsManager.openEditLeadModal('${safeId}')">Editar Dados</button>
              </div>
              
              <div class="fs-2 text-muted mb-1">Primeiro nome</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${esc(firstName)}</div>

              <div class="fs-2 text-muted mb-1">Sobrenome</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${esc(lastName || '-')}</div>

              <div class="fs-2 text-muted mb-1">E-mail</div>
              <div class="fw-semibold mb-2 fs-3 text-primary text-truncate">${esc(lead.email || '-')}</div>

              <div class="fs-2 text-muted mb-1">Telefone</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${esc(lead.phone || '-')}</div>

              <div class="fs-2 text-muted mb-1">Empresa</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${esc(lead.company || '-')}</div>

              <div class="fs-2 text-muted mb-1">Lead Score</div>
              <div class="badge bg-primary px-3 py-2 fs-3 mb-3">${Number(lead.score) || 0} pontos</div>

              ${this.renderChatbotDetailsHtml(lead)}
            </div>
          </div>

          <!-- COLUNA CENTRAL: ABAS DE ATIVIDADES E RECENTES -->
          <div class="col-lg-6 px-lg-3 border-end">
            <!-- ABAS DA TIMELINE -->
            <div class="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
              <ul class="nav nav-tabs hs-nav-tabs border-0 flex-grow-1" id="lead-timeline-tabs" role="tablist">
                <li class="nav-item" role="presentation"><button type="button" class="nav-link ${this.activeTab === 'all' ? 'active' : ''}" onclick="window.leadsManager.switchTab('all')">Atividades</button></li>
                <li class="nav-item" role="presentation"><button type="button" class="nav-link ${this.activeTab === 'note' ? 'active' : ''}" onclick="window.leadsManager.switchTab('note')">Notas</button></li>
                <li class="nav-item" role="presentation"><button type="button" class="nav-link ${this.activeTab === 'email' ? 'active' : ''}" onclick="window.leadsManager.switchTab('email')">E-mails</button></li>
                <li class="nav-item" role="presentation"><button type="button" class="nav-link ${this.activeTab === 'call' ? 'active' : ''}" onclick="window.leadsManager.switchTab('call')">Chamadas</button></li>
                <li class="nav-item" role="presentation"><button type="button" class="nav-link ${this.activeTab === 'task' ? 'active' : ''}" onclick="window.leadsManager.switchTab('task')">Tarefas</button></li>
              </ul>
              <button type="button" class="btn btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;" title="Adicionar Atividade" aria-label="Adicionar nova atividade" onclick="window.leadsManager.promptAddActivity('${safeId}', 'note')">
                <i class="ti ti-plus fs-4" aria-hidden="true"></i>
              </button>
            </div>

            <div class="d-flex align-items-center justify-content-between mb-3 text-muted fs-2">
              <div>Filtrar por: <strong class="text-dark">Todos os usuários</strong></div>
              <div class="text-muted fs-1">${(lead.activities || []).length} registro(s)</div>
            </div>

            <!-- TIMELINE REAL DO LEAD -->
            <div class="timeline-container">
              ${this.renderLeadActivitiesHtml(lead)}
            </div>
          </div>

          <!-- COLUNA DIREITA: OBJETOS ASSOCIADOS (DEALS, EMPRESAS, TAREFAS) -->
          <div class="col-lg-3">
            <div class="accordion" id="leadRightAccordion">
              <!-- ACORDEÃO DEALS -->
              <div class="accordion-item border-0 mb-3">
                <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1" aria-hidden="true"></i> Oportunidades (${deals.length})</span>
                  <button type="button" class="btn btn-link btn-sm p-0 fs-2 text-primary fw-semibold text-decoration-none" onclick="window.kanbanManager && window.kanbanManager.openDealModal('${safeId}')">+ Add deal</button>
                </div>

                ${deals.length > 0 ? deals.map(d => `
                  <div class="card mb-2 border p-2 shadow-none rounded">
                    <div class="fw-bold text-primary fs-3">R$ ${(parseFloat(d.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div class="fs-2 text-dark fw-semibold mb-1">${esc(d.title)}</div>
                    <div class="fs-2 text-muted mb-2">Status: <span class="badge bg-light-primary text-primary">${esc((d.status || 'open').toUpperCase())}</span></div>
                    
                    <div class="hs-deal-progress mb-1">
                      <div class="hs-deal-progress-bar" style="width: 75%;"></div>
                    </div>
                  </div>
                `).join('') : `
                  <div class="p-3 text-center text-muted fs-2 border border-dashed rounded">
                    Nenhuma oportunidade criada para este contato.
                  </div>
                `}
              </div>

              <!-- ACORDEÃO EMPRESA -->
              <div class="accordion-item border-0 mb-3">
                <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1" aria-hidden="true"></i> Empresa</span>
                  <button type="button" class="btn btn-link btn-sm p-0 fs-2 text-primary fw-semibold text-decoration-none" onclick="window.leadsManager.openEditLeadModal('${safeId}')">${lead.company ? 'Editar empresa' : '+ Add company'}</button>
                </div>
                <div class="card p-2 border shadow-none rounded">
                  <div class="fw-bold text-dark fs-2">${esc(lead.company || 'Empresa não informada')}</div>
                  <small class="text-muted">1 contato associado</small>
                </div>
              </div>

              <!-- ACORDEÃO TAREFAS -->
              <div class="accordion-item border-0 mb-3">
                <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1" aria-hidden="true"></i> Tarefas (${pendingTasks})</span>
                  <button type="button" class="btn btn-link btn-sm p-0 fs-2 text-primary fw-semibold text-decoration-none" onclick="window.leadsManager.promptAddActivity('${safeId}', 'task')">+ Add tarefa</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const modalEl = document.getElementById('leadDetailModal');
    if (modalEl && window.bootstrap) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  switchTab(tabType) {
    this.activeTab = tabType;
    if (this.currentModalLeadId) {
      this.openLeadModal(this.currentModalLeadId);
    }
  }

  renderLeadActivitiesHtml(lead) {
    let activities = lead.activities || [];

    if (this.activeTab !== 'all') {
      activities = activities.filter(a => a.type === this.activeTab);
    }

    if (activities.length === 0) {
      return `
        <div class="text-center py-4 text-muted fs-2 border border-dashed rounded">
          Nenhuma atividade registrada nesta categoria. Clique no botão (+) para adicionar.
        </div>
      `;
    }

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    return activities.map((act, idx) => {
      const iconMap = {
        note: 'ti-message-dots text-primary',
        email: 'ti-mail text-info',
        call: 'ti-phone text-warning',
        task: 'ti-circle-check text-danger',
        meeting: 'ti-calendar text-success'
      };

      const now = new Date();
      let dueBadge = '';
      if (act.due_date) {
        const dt = new Date(act.due_date);
        const isOverdue = dt < now && !act.done;
        const fmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        dueBadge = isOverdue
          ? `<span class="badge bg-danger-subtle text-danger ms-2"><i class="ti ti-clock me-1" aria-hidden="true"></i>${esc(fmt)}</span>`
          : `<span class="badge bg-light text-muted ms-2"><i class="ti ti-calendar me-1" aria-hidden="true"></i>${esc(fmt)}</span>`;
      }

      const doneStyle = act.done ? 'opacity-60' : '';
      const doneDecor = act.done ? 'text-decoration-line-through text-muted' : 'text-dark';

      return `
        <div class="card mb-3 border shadow-none ${doneStyle}">
          <div class="card-body p-3">
            <div class="d-flex align-items-start gap-2">
              <i class="ti ${iconMap[act.type] || 'ti-notes text-primary'} fs-5 mt-1 me-1" aria-hidden="true"></i>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center fs-2 text-muted mb-1">
                  <strong class="${doneDecor}">${esc(act.title || 'Atividade')}${dueBadge}</strong>
                  <div class="d-flex gap-1 align-items-center">
                    <span>${esc(act.date || 'Recente')}</span>
                    ${act.type === 'task' && !act.done ? `<button type="button" class="btn btn-sm btn-outline-success p-1 ms-2" style="line-height:1" title="Marcar concluída" aria-label="Marcar atividade como concluída" onclick="window.tasksManager && window.tasksManager.markTaskDone('${escAttr(lead.id)}', ${idx})"><i class="ti ti-check fs-3" aria-hidden="true"></i></button>` : ''}
                    ${act.done ? '<span class="badge bg-success-subtle text-success ms-1">Concluída</span>' : ''}
                  </div>
                </div>
                <p class="mb-0 fs-2 text-muted">${esc(act.desc || '')}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  promptAddActivity(leadId, type) {
    // Delegate to TasksManager modal (replaces prompt())
    if (window.tasksManager) {
      window.tasksManager.openTaskModal(leadId, type);
    }
  }

  openEditLeadModal(leadId) {
    const lead = window.crmStore.getLeads().find(l => l.id === leadId);
    if (!lead) return;

    const modalEl = document.getElementById('editLeadModal');
    if (modalEl && window.bootstrap) {
      document.getElementById('edit-lead-id').value = lead.id;
      document.getElementById('edit-lead-name').value = lead.name || '';
      document.getElementById('edit-lead-email').value = lead.email || '';
      document.getElementById('edit-lead-phone').value = lead.phone || '';
      document.getElementById('edit-lead-company').value = lead.company || '';
      const jobEl = document.getElementById('edit-lead-job-title');
      if (jobEl) jobEl.value = lead.job_title || '';
      document.getElementById('edit-lead-score').value = Number(lead.score) || 0;
      const stageEl = document.getElementById('edit-lead-lifecycle');
      if (stageEl) stageEl.value = lead.lifecycle_stage || 'lead';

      bootstrap.Modal.getOrCreateInstance(modalEl).show();
      return;
    }

    if (window.mqUI) {
      window.mqUI.toast('Formulário de edição não encontrado nesta página.', { type: 'warning' });
    }
  }

  handleSaveEditedLead() {
    const leadId = document.getElementById('edit-lead-id')?.value;
    if (!leadId) return;
    const lead = window.crmStore.getLeads().find(l => l.id === leadId);
    if (!lead) return;

    const name = (document.getElementById('edit-lead-name')?.value || '').trim();
    const email = (document.getElementById('edit-lead-email')?.value || '').trim();
    const phone = (document.getElementById('edit-lead-phone')?.value || '').trim();
    const company = (document.getElementById('edit-lead-company')?.value || '').trim();
    const jobTitle = (document.getElementById('edit-lead-job-title')?.value || '').trim();
    const scoreRaw = parseInt(document.getElementById('edit-lead-score')?.value || '', 10);
    const lifecycle = document.getElementById('edit-lead-lifecycle')?.value || lead.lifecycle_stage;

    if (!name || !email) {
      if (window.mqUI) window.mqUI.toast('Nome e e-mail do contato são obrigatórios.', { type: 'warning' });
      return;
    }

    lead.name = name;
    lead.email = email;
    lead.phone = phone;
    lead.company = company;
    lead.job_title = jobTitle;
    lead.lifecycle_stage = lifecycle;
    if (!Number.isNaN(scoreRaw)) lead.score = Math.max(0, scoreRaw);

    window.crmStore.saveLead(lead);

    const editModalEl = document.getElementById('editLeadModal');
    if (editModalEl && window.bootstrap) {
      const inst = bootstrap.Modal.getInstance(editModalEl);
      if (inst) inst.hide();
    }

    this.renderLeadsTable();
    if (this.currentModalLeadId === leadId) {
      this.openLeadModal(leadId);
    }
    if (window.mqUI) window.mqUI.toast('Dados do contato atualizados!', { type: 'success' });
  }

  editLeadPrompt(leadId) {
    this.openEditLeadModal(leadId);
  }

  async deleteLead(leadId) {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Excluir contato',
          message: 'Tem certeza que deseja excluir este contato? Esta ação remove o lead da base.',
          confirmLabel: 'Excluir',
          danger: true
        })
      : false;
    if (confirmed) {
      window.crmStore.deleteLead(leadId);
      this.renderLeadsTable();
      if (window.mqUI) window.mqUI.toast('Contato excluído.', { type: 'success' });
    }
  }

  // ── CSV EXPORT ────────────────────────────────────────────────────────
  exportCSV() {
    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    if (leads.length === 0) {
      if (window.mqUI) window.mqUI.toast('Nenhum contato para exportar.', { type: 'info' });
      return;
    }

    const headers = ['nome', 'email', 'telefone', 'empresa', 'cargo', 'origem', 'estagio', 'score'];
    const rows = leads.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.job_title || '').replace(/"/g, '""')}"`,
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${(l.lifecycle_stage || '').replace(/"/g, '""')}"`,
      l.score || 0
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `contatos_crm_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CSV DOWNLOAD TEMPLATE ─────────────────────────────────────────────
  downloadCSVTemplate() {
    const csv = 'nome,email,telefone,empresa,origem\nJoão Silva,joao@empresa.com,(11) 99999-0000,Empresa XYZ,Google Ads\nMaria Souza,maria@empresa.com,(21) 98888-1111,Tech Corp,Facebook Ads';
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'modelo_importacao_contatos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CSV IMPORT ────────────────────────────────────────────────────────
  initCSVFileInput() {
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput || fileInput.dataset.bound) return;
    fileInput.dataset.bound = 'true';

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => this.parseCSVPreview(ev.target.result);
      reader.readAsText(file, 'UTF-8');
    });
  }

  parseCSVPreview(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      if (window.mqUI) window.mqUI.toast('Arquivo CSV vazio ou inválido.', { type: 'warning' });
      return;
    }

    // Detect separator
    const sep = lines[0].includes(';') ? ';' : ',';

    // Parse rows, skip header
    const rows = lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      return {
        name:    cols[0] || '',
        email:   cols[1] || '',
        phone:   cols[2] || '',
        company: cols[3] || '',
        source:  cols[4] || 'CSV Import'
      };
    }).filter(r => r.name && r.email);

    if (rows.length === 0) {
      if (window.mqUI) window.mqUI.toast('Nenhum contato válido encontrado. Verifique se nome e email estão preenchidos.', { type: 'warning' });
      return;
    }

    window._csvImportRows = rows;

    // Show preview
    document.getElementById('csv-step-upload').style.display = 'none';
    document.getElementById('csv-step-preview').style.display = 'block';
    document.getElementById('csv-preview-count').innerText = rows.length + ' contato' + (rows.length > 1 ? 's' : '') + ' encontrado' + (rows.length > 1 ? 's' : '');
    document.getElementById('csv-import-confirm-btn').classList.remove('d-none');

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const tbody = document.getElementById('csv-preview-body');
    if (tbody) {
      tbody.innerHTML = rows.slice(0, 20).map(r => `
        <tr>
          <td>${esc(r.name)}</td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.phone)}</td>
          <td>${esc(r.company)}</td>
          <td>${esc(r.source)}</td>
        </tr>
      `).join('') + (rows.length > 20 ? `<tr><td colspan="5" class="text-center text-muted">… e mais ${rows.length - 20} contatos</td></tr>` : '');
    }
  }

  resetCSVImport() {
    window._csvImportRows = [];
    document.getElementById('csv-step-upload').style.display = 'block';
    document.getElementById('csv-step-preview').style.display = 'none';
    document.getElementById('csv-import-confirm-btn').classList.add('d-none');
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) fileInput.value = '';
  }

  confirmCSVImport() {
    const rows = window._csvImportRows || [];
    if (rows.length === 0) {
      if (window.mqUI) window.mqUI.toast('Nenhum contato para importar.', { type: 'warning' });
      return;
    }

    const skipDuplicates = document.getElementById('csv-skip-duplicates')?.checked !== false;
    const existingEmails = (window.crmStore ? window.crmStore.getLeads() : []).map(l => (l.email || '').toLowerCase());

    let imported = 0;
    const toImport = rows.filter(r => !skipDuplicates || !existingEmails.includes(r.email.toLowerCase()));

    toImport.forEach(r => {
      window.crmStore.saveLead({
        name:            r.name,
        email:           r.email,
        phone:           r.phone,
        company:         r.company,
        lifecycle_stage: 'lead',
        score:           10,
        source:          r.source || 'CSV Import',
        tags:            ['Importado CSV']
      });
      imported++;
    });

    // Close modal
    const modalEl = document.getElementById('importCSVModal');
    if (modalEl) { const inst = bootstrap.Modal.getInstance(modalEl); if (inst) inst.hide(); }

    this.resetCSVImport();
    this.renderLeadsTable();

    const skippedCount = skipDuplicates && rows.length > imported ? rows.length - imported : 0;
    const summary = `${imported} contato${imported === 1 ? '' : 's'} importado${imported === 1 ? '' : 's'} com sucesso` + (skippedCount > 0 ? ` (${skippedCount} ignorado${skippedCount === 1 ? '' : 's'} por e-mail duplicado).` : '.');
    if (window.mqUI) window.mqUI.toast(summary, { type: 'success', duration: 6000 });
  }

  renderChatbotDetailsHtml(lead) {
    const cf = lead.custom_fields || {};
    const rast = cf.rastreamento || {};
    const hasChatbotData = cf.area_interesse || cf.resumo_caso || (cf.respostas_triagem && cf.respostas_triagem.length > 0) || cf.qualificacao || rast.utm_source || rast.gclid;

    if (!hasChatbotData) return '';

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const safeUrl = window.mqSecurity ? window.mqSecurity.safeUrl : (u => u);

    const areaInteresse = cf.area_interesse || '';
    const resumoCaso = cf.resumo_caso || '';
    const qualificacao = cf.qualificacao || '';
    const triagem = cf.respostas_triagem || [];

    let triagemHtml = '';
    if (Array.isArray(triagem) && triagem.length > 0) {
      triagemHtml = triagem.map(t => {
        const txt = typeof t === 'string' ? t : (t.resposta_qualificacao || Object.values(t).join(' '));
        return `<div class="p-2 mb-1 bg-white rounded border border-light text-dark fs-2"><i class="ti ti-check text-success me-1" aria-hidden="true"></i>${esc(txt)}</div>`;
      }).join('');
    }

    let utmItems = [];
    if (rast.utm_source) utmItems.push(`<div><strong>Fonte:</strong> <span class="badge bg-light-primary text-primary">${esc(rast.utm_source)}</span></div>`);
    if (rast.utm_medium) utmItems.push(`<div><strong>Mídia:</strong> ${esc(rast.utm_medium)}</div>`);
    if (rast.utm_campaign) utmItems.push(`<div><strong>Campanha:</strong> <span class="badge bg-light-info text-info">${esc(rast.utm_campaign)}</span></div>`);
    if (rast.gclid) utmItems.push(`<div><strong>GCLID:</strong> <code class="text-primary">${esc(rast.gclid)}</code></div>`);
    if (rast.landing_page) {
      const landingSafeHref = safeUrl(rast.landing_page, '#');
      utmItems.push(`<div><strong>Landing Page:</strong> <a href="${esc(landingSafeHref)}" target="_blank" rel="noopener noreferrer" class="text-truncate d-inline-block text-primary" style="max-width: 170px;">${esc(rast.landing_page)}</a></div>`);
    }

    return `
      <div class="mt-3 pt-3 border-top">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="fw-bold text-dark fs-2"><i class="ti ti-brand-whatsapp text-success me-1" aria-hidden="true"></i> Chatbot WhatsApp</span>
          ${qualificacao ? `<span class="badge ${qualificacao === 'alta' ? 'bg-danger text-white' : 'bg-warning text-dark'} text-uppercase fs-1">${esc(qualificacao)}</span>` : ''}
        </div>

        ${areaInteresse ? `
          <div class="mb-2">
            <span class="fs-2 text-muted d-block">Área de Interesse</span>
            <span class="badge bg-light-primary text-primary fs-2">${esc(areaInteresse)}</span>
          </div>
        ` : ''}

        ${resumoCaso ? `
          <div class="mb-2">
            <span class="fs-2 text-muted d-block">Resumo do Caso</span>
            <div class="p-2 bg-light rounded text-dark fs-2 border">${esc(resumoCaso)}</div>
          </div>
        ` : ''}

        ${triagemHtml ? `
          <div class="mb-2">
            <span class="fs-2 text-muted d-block">Triagem</span>
            <div class="bg-light p-2 rounded">${triagemHtml}</div>
          </div>
        ` : ''}

        ${utmItems.length > 0 ? `
          <div class="mt-3 pt-2 border-top">
            <div class="fw-bold text-dark fs-2 mb-1"><i class="ti ti-chart-arrows text-warning me-1" aria-hidden="true"></i> Tráfego / UTMs</div>
            <div class="fs-2 text-muted d-flex flex-column gap-1 bg-light p-2 rounded border">
              ${utmItems.join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

window.leadsManager = new LeadsManager();

// Init CSV file input & handle deep-linked lead selection
document.addEventListener('DOMContentLoaded', () => {
  const importModal = document.getElementById('importCSVModal');
  if (importModal) {
    importModal.addEventListener('show.bs.modal', () => {
      if (window.leadsManager) window.leadsManager.initCSVFileInput();
    });
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get('lead');
    if (leadId && window.leadsManager) {
      setTimeout(() => window.leadsManager.openLeadModal(leadId), 150);
    }
  } catch (e) {}
});
