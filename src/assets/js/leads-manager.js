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

      const tagsHtml = (lead.tags || []).map(t => `<span class="badge bg-light text-dark me-1 border">${t}</span>`).join('');

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <div class="avatar-sm rounded-circle bg-light-primary text-primary fw-bold me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                ${(lead.name || 'L').charAt(0).toUpperCase()}
              </div>
              <div>
                <h6 class="mb-0 fw-semibold text-dark">${lead.name}</h6>
                <small class="text-muted">${lead.job_title || 'Cargo não informado'}</small>
              </div>
            </div>
          </td>
          <td>
            <div class="fw-semibold text-dark">${lead.company || '-'}</div>
            <small class="text-muted">${lead.email}</small>
          </td>
          <td>${stageBadges[lead.lifecycle_stage] || lead.lifecycle_stage}</td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${scoreBadgeClass} rounded-pill px-3 py-1 fs-2 shadow-sm">${lead.score} pts</span>
              <button class="btn btn-sm btn-light-primary text-primary rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 28px; height: 28px;" title="+10 Pontos de Score" onclick="window.leadsManager.adjustScore('${lead.id}', 10)">
                <i class="ti ti-plus fs-4"></i>
              </button>
            </div>
          </td>
          <td>
            <span class="badge bg-light-primary text-primary px-3 py-1.5 rounded-pill fw-semibold border border-primary border-opacity-10">
              ${lead.source || 'Direto'}
            </span>
          </td>
          <td>${tagsHtml || '<small class="text-muted">Sem tags</small>'}</td>
          <td class="text-end text-nowrap pe-4">
            <div class="d-inline-flex align-items-center justify-content-end gap-2">
              <button class="btn btn-sm btn-primary text-nowrap fw-semibold px-3 py-1-5 d-inline-flex align-items-center gap-1 shadow-sm" onclick="window.leadsManager.openLeadModal('${lead.id}')" title="Perfil Completo do Contato">
                <i class="ti ti-id fs-4"></i>
                <span>Ver Perfil</span>
              </button>
              <button class="btn btn-sm btn-light-danger text-danger rounded-circle p-0 d-inline-flex align-items-center justify-content-center" style="width: 32px; height: 32px;" onclick="window.leadsManager.deleteLead('${lead.id}')" title="Excluir Contato">
                <i class="ti ti-trash fs-4"></i>
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
      alert('Por favor, preencha nome e email do contato.');
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

    const modalBody = document.getElementById('lead-modal-details');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="row g-3">
          <!-- COLUNA ESQUERDA: DADOS DO CONTATO -->
          <div class="col-lg-3 border-end">
            <div class="text-center pb-3 mb-3 border-bottom">
              <div class="avatar-lg rounded-circle bg-info-subtle text-info fw-bold mx-auto d-flex align-items-center justify-content-center mb-2" style="width: 72px; height: 72px; font-size: 28px; background-color: #E6FFFA; color: #00A4BD;">
                ${firstName.charAt(0).toUpperCase()}
              </div>
              <h5 class="fw-bold mb-0 text-dark">${lead.name}</h5>
              <small class="text-muted d-block mb-3">${lead.job_title || 'Cargo não informado'}</small>

              <!-- ACTION PILLS CIRCULARES -->
              <div class="d-flex align-items-center justify-content-center gap-2 mb-3">
                <div class="hs-action-pill" title="Criar Nota" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'note')"><i class="ti ti-notes"></i></div>
                <div class="hs-action-pill" title="Enviar E-mail" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'email')"><i class="ti ti-mail"></i></div>
                <div class="hs-action-pill" title="Ligar" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'call')"><i class="ti ti-phone"></i></div>
                <div class="hs-action-pill" title="Registrar Tarefa" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'task')"><i class="ti ti-circle-plus"></i></div>
                <div class="hs-action-pill" title="Agendar Reunião" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'meeting')"><i class="ti ti-calendar"></i></div>
              </div>
            </div>

            <!-- PROPRIEDADES DO CONTATO (EDITÁVEIS) -->
            <div class="px-1">
              <div class="d-flex align-items-center justify-content-between mb-3 text-dark fw-bold">
                <span><i class="ti ti-chevron-down me-1"></i> Sobre este contato</span>
                <button class="btn btn-sm btn-link p-0 text-primary fw-semibold fs-2" onclick="window.leadsManager.editLeadPrompt('${lead.id}')">Editar Dados</button>
              </div>
              
              <div class="fs-2 text-muted mb-1">Primeiro nome</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${firstName}</div>

              <div class="fs-2 text-muted mb-1">Sobrenome</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${lastName || '-'}</div>

              <div class="fs-2 text-muted mb-1">E-mail</div>
              <div class="fw-semibold mb-2 fs-3 text-primary text-truncate">${lead.email}</div>

              <div class="fs-2 text-muted mb-1">Telefone</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${lead.phone || '-'}</div>

              <div class="fs-2 text-muted mb-1">Empresa</div>
              <div class="fw-semibold mb-2 fs-3 text-dark">${lead.company || '-'}</div>

              <div class="fs-2 text-muted mb-1">Lead Score</div>
              <div class="badge bg-primary px-3 py-2 fs-3 mb-3">${lead.score} pontos</div>
            </div>
          </div>

          <!-- COLUNA CENTRAL: ABAS DE ATIVIDADES E RECENTES -->
          <div class="col-lg-6 px-lg-3 border-end">
            <!-- ABAS DA TIMELINE -->
            <div class="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
              <ul class="nav nav-tabs hs-nav-tabs border-0 flex-grow-1" id="lead-timeline-tabs">
                <li class="nav-item"><a class="nav-link ${this.activeTab === 'all' ? 'active' : ''}" href="#" onclick="window.leadsManager.switchTab('all')">Atividades</a></li>
                <li class="nav-item"><a class="nav-link ${this.activeTab === 'note' ? 'active' : ''}" href="#" onclick="window.leadsManager.switchTab('note')">Notas</a></li>
                <li class="nav-item"><a class="nav-link ${this.activeTab === 'email' ? 'active' : ''}" href="#" onclick="window.leadsManager.switchTab('email')">E-mails</a></li>
                <li class="nav-item"><a class="nav-link ${this.activeTab === 'call' ? 'active' : ''}" href="#" onclick="window.leadsManager.switchTab('call')">Chamadas</a></li>
                <li class="nav-item"><a class="nav-link ${this.activeTab === 'task' ? 'active' : ''}" href="#" onclick="window.leadsManager.switchTab('task')">Tarefas</a></li>
              </ul>
              <button class="btn btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;" title="Adicionar Atividade" onclick="window.leadsManager.promptAddActivity('${lead.id}', 'note')">
                <i class="ti ti-plus fs-4"></i>
              </button>
            </div>

            <div class="d-flex align-items-center justify-content-between mb-3 text-muted fs-2">
              <div>Filtrar por: <strong class="text-dark">Todos os usuários</strong></div>
              <div class="text-primary cursor-pointer">Expandir tudo</div>
            </div>

            <!-- TIMELINE REAL DO LEAD -->
            <div class="timeline-container">
              ${this.renderLeadActivitiesHtml(lead)}
            </div>
          </div>

          <!-- COLUNA DIREITA: OBJETOS ASSOCIADOS (DEALS, EMPRESAS, TICKETS) -->
          <div class="col-lg-3">
            <div class="accordion" id="leadRightAccordion">
              <!-- ACORDEÃO DEALS -->
              <div class="accordion-item border-0 mb-3">
                <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1"></i> Oportunidades (${deals.length})</span>
                  <a href="#" class="fs-2 text-primary fw-semibold" onclick="window.kanbanManager && window.kanbanManager.openDealModal('${lead.id}')">+ Add deal</a>
                </div>

                ${deals.length > 0 ? deals.map(d => `
                  <div class="card mb-2 border p-2 shadow-none rounded">
                    <div class="fw-bold text-primary fs-3">R$ ${parseFloat(d.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div class="fs-2 text-dark fw-semibold mb-1">${d.title}</div>
                    <div class="fs-2 text-muted mb-2">Status: <span class="badge bg-light-primary text-primary">${d.status.toUpperCase()}</span></div>
                    
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
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1"></i> Empresa</span>
                  <a href="#" class="fs-2 text-primary fw-semibold" onclick="alert('Empresa ${lead.company || 'associada com sucesso!'}')">+ Add company</a>
                </div>
                <div class="card p-2 border shadow-none rounded">
                  <div class="fw-bold text-dark fs-2">${lead.company || 'Empresa não informada'}</div>
                  <small class="text-muted">1 contato associado</small>
                </div>
              </div>

              <!-- ACORDEÃO TICKETS -->
              <div class="accordion-item border-0 mb-3">
                <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark fs-3"><i class="ti ti-chevron-down me-1"></i> Tickets (0)</span>
                  <a href="#" class="fs-2 text-primary fw-semibold" onclick="alert('Novo ticket de suporte criado!')">+ Add ticket</a>
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

    return activities.map(act => {
      const iconMap = {
        note: 'ti-message-dots text-primary',
        email: 'ti-mail text-info',
        call: 'ti-phone text-warning',
        task: 'ti-circle-check text-danger',
        meeting: 'ti-calendar text-success'
      };

      return `
        <div class="card mb-3 border shadow-none">
          <div class="card-body p-3">
            <div class="d-flex align-items-start gap-2">
              <i class="ti ${iconMap[act.type] || 'ti-notes text-primary'} fs-5 mt-1 me-1"></i>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between fs-2 text-muted mb-1">
                  <strong class="text-dark">${act.title || 'Atividade'}</strong>
                  <span>${act.date || 'Recente'}</span>
                </div>
                <p class="mb-0 fs-2 text-muted">${act.desc}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  promptAddActivity(leadId, type) {
    const title = prompt('Título da atividade / nota:');
    if (!title) return;

    const desc = prompt('Descrição detalhada:');
    if (!desc) return;

    const activity = {
      type,
      title: title.trim(),
      desc: desc.trim()
    };

    window.crmStore.addLeadActivity(leadId, activity);
    this.openLeadModal(leadId);
  }

  editLeadPrompt(leadId) {
    const lead = window.crmStore.getLeads().find(l => l.id === leadId);
    if (!lead) return;

    const name = prompt('Nome completo:', lead.name);
    if (!name) return;

    const email = prompt('E-mail:', lead.email);
    if (!email) return;

    const phone = prompt('Telefone:', lead.phone || '');
    const company = prompt('Empresa:', lead.company || '');
    const score = parseInt(prompt('Lead Score (Pontuação):', lead.score)) || lead.score;

    lead.name = name.trim();
    lead.email = email.trim();
    lead.phone = phone.trim();
    lead.company = company.trim();
    lead.score = score;

    window.crmStore.saveLead(lead);
    this.renderLeadsTable();
    this.openLeadModal(leadId);
  }

  deleteLead(leadId) {
    if (confirm('Tem certeza que deseja excluir este contato?')) {
      window.crmStore.deleteLead(leadId);
      this.renderLeadsTable();
    }
  }
}

window.leadsManager = new LeadsManager();
