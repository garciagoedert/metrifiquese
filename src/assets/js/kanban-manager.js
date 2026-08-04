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
            <i class="ti ti-user-x d-block fs-5 opacity-50 mb-1"></i>
            Nenhum contato encontrado
          </div>
        `;
        resultsContainer.style.display = 'block';
        return;
      }

      resultsContainer.innerHTML = filtered.map(l => {
        const safeName = (l.name || '').replace(/'/g, "\\'");
        const safeCompany = (l.company || '').replace(/'/g, "\\'");
        return `
          <button type="button" class="list-group-item list-group-item-action px-3 py-2 border-bottom d-flex align-items-center justify-content-between text-start bg-white" onclick="window.kanbanManager.selectLeadForDeal('${l.id}', '${safeName}', '${safeCompany}');">
            <div class="d-flex align-items-center gap-2">
              <div class="bg-light-primary text-primary p-2 rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; flex-shrink: 0;">
                <i class="ti ti-user fs-4"></i>
              </div>
              <div>
                <strong class="text-dark fs-2 d-block mb-0">${l.name}</strong>
                <small class="text-muted fs-1">${l.company ? l.company + ' • ' : ''}${l.email || 'Sem e-mail'}</small>
              </div>
            </div>
            <span class="badge bg-light text-primary border fs-1">Selecionar</span>
          </button>
        `;
      }).join('');

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

  renderKanbanBoard() {
    const boardContainer = document.getElementById('kanban-board-container');
    if (!boardContainer) return;

    const stages = window.crmStore.getStages();
    const deals = window.crmStore.getDeals();
    const leads = window.crmStore.getLeads();

    boardContainer.innerHTML = stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

      const cardsHtml = stageDeals.map(deal => {
        const lead = leads.find(l => l.id === deal.lead_id) || { name: 'Contato não associado', company: '' };
        
        const stageProgressMap = { 'stage-1': 20, 'stage-2': 40, 'stage-3': 60, 'stage-4': 80, 'stage-5': 100 };
        const progressPct = stageProgressMap[stage.id] || 50;

        return `
          <div class="card mb-3 kanban-card shadow-sm border cursor-grab bg-white rounded" 
               draggable="true" 
               ondragstart="window.kanbanManager.handleDragStart(event, '${deal.id}')"
               id="deal-card-${deal.id}">
            <div class="card-body p-3">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <span class="badge bg-light-primary text-primary fw-semibold">${lead.company || 'Empresa'}</span>
                <span class="fw-bold text-success fs-3">R$ ${parseFloat(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              <h6 class="card-title fw-bold mb-1 fs-3 text-dark">${deal.title}</h6>
              <p class="text-muted fs-2 mb-2"><i class="ti ti-user me-1"></i> ${lead.name}</p>

              <div class="hs-deal-progress mb-2">
                <div class="hs-deal-progress-bar" style="width: ${progressPct}%;"></div>
              </div>
              
              <div class="d-flex align-items-center justify-content-between pt-2 border-top">
                <small class="text-muted fs-1"><i class="ti ti-calendar me-1"></i> ${new Date(deal.created_at).toLocaleDateString('pt-BR')}</small>
                <div class="dropdown">
                  <button class="btn btn-sm btn-light p-1 rounded-circle" data-bs-toggle="dropdown">
                    <i class="ti ti-dots-vertical fs-3"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item text-success" href="#" onclick="window.kanbanManager.markDealStatus('${deal.id}', 'stage-5')"><i class="ti ti-trophy me-2"></i>Marcar Ganho</a></li>
                    <li><a class="dropdown-item text-danger" href="#" onclick="window.kanbanManager.markDealStatus('${deal.id}', 'stage-lost')"><i class="ti ti-x me-2"></i>Marcar Perdido</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="col-md-4 col-lg-3 mb-4">
          <div class="kanban-column p-3 rounded bg-light border"
               ondragover="window.kanbanManager.handleDragOver(event)"
               ondrop="window.kanbanManager.handleDrop(event, '${stage.id}')">
            
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="badge rounded-circle p-2" style="background-color: ${stage.color || '#FF7A59'};"></span>
                <h6 class="fw-bold mb-0 text-dark">${stage.name}</h6>
                <span class="badge bg-white text-dark border px-2 py-1">${stageDeals.length}</span>
              </div>

              <!-- DROPDOWN DE EDICAO DE ETAPA -->
              <div class="dropdown">
                <button class="btn btn-sm btn-light p-1" data-bs-toggle="dropdown">
                  <i class="ti ti-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end fs-2">
                  <li><a class="dropdown-item" href="#" onclick="window.kanbanManager.editStagePrompt('${stage.id}', '${stage.name}')"><i class="ti ti-edit me-1"></i> Renomear Coluna</a></li>
                  <li><a class="dropdown-item text-danger" href="#" onclick="window.kanbanManager.deleteStage('${stage.id}')"><i class="ti ti-trash me-1"></i> Excluir Coluna</a></li>
                </ul>
              </div>
            </div>

            <div class="mb-3 fs-2 text-muted fw-semibold">
              Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div class="kanban-cards-wrapper" style="min-height: 450px;">
              ${cardsHtml || '<div class="text-center py-4 text-muted fs-2 border border-dashed rounded">Arraste negociações para cá</div>'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const selectStage = document.getElementById('deal-stage-select');
    if (selectStage) {
      selectStage.innerHTML = stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    this.setupLeadSearch();
  }

  handleDragStart(e, dealId) {
    e.dataTransfer.setData('text/plain', dealId);
    e.currentTarget.classList.add('opacity-50');
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDrop(e, targetStageId) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId) {
      window.crmStore.moveDealStage(dealId, targetStageId);
      this.renderKanbanBoard();
    }
  }

  markDealStatus(dealId, targetStageId) {
    window.crmStore.moveDealStage(dealId, targetStageId);
    this.renderKanbanBoard();
  }

  handleCreateDeal() {
    const title = document.getElementById('deal-title-input').value;
    const leadId = document.getElementById('deal-lead-select').value;
    const value = parseFloat(document.getElementById('deal-value-input').value) || 0;
    const stageId = document.getElementById('deal-stage-select').value || 'stage-1';

    if (!title || !leadId) {
      alert('Preencha o título da oportunidade e selecione um contato na busca.');
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
  }

  handleCreateStage() {
    const name = document.getElementById('stage-name-input').value;
    const color = document.getElementById('stage-color-input').value;

    if (!name) {
      alert('Preencha o nome da nova etapa/coluna.');
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
  }

  editStagePrompt(stageId, currentName) {
    const newName = prompt('Novo nome para esta etapa do Kanban:', currentName);
    if (newName && newName.trim() !== '') {
      window.crmStore.saveStage({ id: stageId, name: newName.trim() });
      this.renderKanbanBoard();
    }
  }

  deleteStage(stageId) {
    if (confirm('Tem certeza que deseja excluir esta coluna do Kanban?')) {
      if (window.crmStore.deleteStage(stageId)) {
        this.renderKanbanBoard();
      }
    }
  }
}

window.kanbanManager = new KanbanManager();
