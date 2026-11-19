/**
 * Metrifique-se CRM - Automation Rules & Lead Scoring Manager
 * RD Station style workflow triggers (Auto tagging, Stage changes, Scoring thresholds).
 */

class AutomationsManager {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.renderAutomationsList();
      this.bindFormEvents();
    });
  }

  bindFormEvents() {
    const form = document.getElementById('new-automation-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateAutomation();
      });
    }
  }

  renderAutomationsList() {
    const container = document.getElementById('automations-rules-list');
    if (!container) return;

    const rules = window.crmStore.getAutomations();

    if (rules.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted border border-dashed rounded">
          <i class="ti ti-robot fs-8 d-block mb-2"></i>
          Nenhuma regra de automação criada ainda.
        </div>
      `;
      return;
    }

    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (v => String(v ?? ''));
    const escAttr = window.mqSecurity ? window.mqSecurity.escapeAttr : esc;
    container.innerHTML = rules.map(rule => {
      const safeId = escAttr(rule.id);
      const safeName = esc(rule.name);
      const safeTrigger = esc(rule.trigger_event);
      const safeTag = esc((rule.actions && rule.actions.add_tag) || 'Qualificado');
      const safeStage = esc((rule.actions && rule.actions.change_stage) || 'MQL');
      return `
      <div class="card mb-3 border shadow-none">
        <div class="card-body p-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center me-3">
              <div class="p-3 bg-light-primary text-primary rounded-circle me-3" aria-hidden="true">
                <i class="ti ti-bolt fs-6"></i>
              </div>
              <div>
                <h6 class="fw-bold mb-1">${safeName}</h6>
                <div class="fs-2 text-muted">
                  <span class="badge bg-light-info text-info me-2">Gatilho: ${safeTrigger}</span>
                  <span>Ação: Add Tag '<strong>${safeTag}</strong>' + Mudar para '<strong>${safeStage}</strong>'</span>
                </div>
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" ${rule.is_active ? 'checked' : ''} aria-label="Ativar ou pausar regra ${escAttr(rule.name)}" onchange="window.automationsManager.toggleRule('${safeId}')">
              </div>
              <button type="button" class="btn btn-sm btn-light-danger text-danger" aria-label="Excluir regra ${escAttr(rule.name)}" onclick="window.automationsManager.deleteRule('${safeId}')">
                <i class="ti ti-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  toggleRule(ruleId) {
    const rules = window.crmStore.getAutomations();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.is_active = !rule.is_active;
      window.crmStore.saveAutomation(rule);
      this.renderAutomationsList();
      if (window.mqUI) {
        window.mqUI.toast(`Regra ${rule.is_active ? 'ativada' : 'pausada'}.`, { type: 'info' });
      }
    }
  }

  async deleteRule(ruleId) {
    const confirmed = window.mqUI
      ? await window.mqUI.confirm({
          title: 'Excluir regra de automação',
          message: 'Tem certeza que deseja excluir esta regra? Ela deixará de ser executada automaticamente.',
          confirmLabel: 'Excluir regra',
          danger: true
        })
      : false;
    if (!confirmed) return;

    if (window.crmStore && window.crmStore.deleteAutomation(ruleId)) {
      this.renderAutomationsList();
      if (window.mqUI) window.mqUI.toast('Regra de automação removida.', { type: 'success' });
    }
  }

  handleCreateAutomation() {
    const name = document.getElementById('rule-name-input').value;
    const trigger = document.getElementById('rule-trigger-select').value;
    const tag = document.getElementById('rule-tag-input').value;
    const stage = document.getElementById('rule-stage-select').value;

    if (!name || !trigger) {
      if (window.mqUI) window.mqUI.toast('Preencha o nome da regra e o gatilho.', { type: 'warning' });
      return;
    }

    const newRule = {
      name,
      trigger_event: trigger,
      conditions: { min_score: 50 },
      actions: { add_tag: tag || 'Automação', change_stage: stage || 'mql' },
      is_active: true
    };

    window.crmStore.saveAutomation(newRule);

    const modalEl = document.getElementById('addAutomationModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('new-automation-form').reset();
    this.renderAutomationsList();
    if (window.mqUI) window.mqUI.toast('Regra de automação criada com sucesso!', { type: 'success' });
  }
}

window.automationsManager = new AutomationsManager();
