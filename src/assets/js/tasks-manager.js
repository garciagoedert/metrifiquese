/**
 * Metrifique-se CRM - Tasks Manager
 * Handles task creation modal (replacing prompt()), due-date tracking, and dashboard panel.
 */

class TasksManager {
  constructor() {
    this._pendingLeadId = null;
    this._csvRows = [];
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindTaskForm();
      this.renderDashboardTasks();
    });
    window.addEventListener('leads-synced', () => this.renderDashboardTasks());
  }

  // ── OPEN TASK MODAL (replaces prompt()) ──────────────────────────────
  openTaskModal(leadId, defaultType = 'note') {
    this._pendingLeadId = leadId;

    const hiddenId = document.getElementById('task-lead-id');
    if (hiddenId) hiddenId.value = leadId;

    // Reset form
    const form = document.getElementById('new-task-form');
    if (form) form.reset();

    // Pre-select type
    const radioEl = document.getElementById('type-' + defaultType);
    if (radioEl) radioEl.checked = true;

    // Default due date: today + 1 day
    const dueDateInput = document.getElementById('task-due-date-input');
    if (dueDateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setMinutes(0, 0, 0);
      dueDateInput.value = tomorrow.toISOString().slice(0, 16);
    }

    const modalEl = document.getElementById('addTaskModal');
    if (modalEl && window.bootstrap) {
      new bootstrap.Modal(modalEl).show();
    }
  }

  bindTaskForm() {
    const form = document.getElementById('new-task-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTask();
    });
  }

  saveTask() {
    const leadId = document.getElementById('task-lead-id')?.value || this._pendingLeadId;
    const type   = document.querySelector('input[name="task-type"]:checked')?.value || 'note';
    const title  = document.getElementById('task-title-input')?.value?.trim();
    const desc   = document.getElementById('task-desc-input')?.value?.trim();
    const dueDate = document.getElementById('task-due-date-input')?.value;

    if (!title) { alert('Informe o título da atividade.'); return; }

    const activity = {
      type,
      title,
      desc: desc || '',
      date: new Date().toLocaleDateString('pt-BR'),
      due_date: dueDate || null,
      done: false
    };

    if (leadId && window.crmStore) {
      window.crmStore.addLeadActivity(leadId, activity);
    }

    // Close modal
    const modalEl = document.getElementById('addTaskModal');
    if (modalEl) {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    }

    // Refresh leads modal if open
    if (window.leadsManager && window.leadsManager.currentModalLeadId === leadId) {
      window.leadsManager.openLeadModal(leadId);
    }

    // Refresh dashboard tasks
    this.renderDashboardTasks();
  }

  // ── MARK TASK DONE ────────────────────────────────────────────────────
  markTaskDone(leadId, activityIdx) {
    if (!window.crmStore) return;
    const leads = window.crmStore.getLeads();
    const lead  = leads.find(l => l.id === leadId);
    if (!lead || !lead.activities) return;

    if (lead.activities[activityIdx]) {
      lead.activities[activityIdx].done = true;
    }
    window.crmStore.saveLead(lead);
    this.renderDashboardTasks();
    if (window.leadsManager && window.leadsManager.currentModalLeadId === leadId) {
      window.leadsManager.openLeadModal(leadId);
    }
  }

  // ── DASHBOARD TASKS PANEL ─────────────────────────────────────────────
  getAllPendingTasks() {
    if (!window.crmStore) return [];
    const leads = window.crmStore.getLeads();
    const tasks = [];

    leads.forEach(lead => {
      (lead.activities || []).forEach((act, idx) => {
        if (act.type === 'task' && !act.done) {
          tasks.push({ ...act, leadId: lead.id, leadName: lead.name, idx });
        }
      });
    });

    // Sort: overdue first, then by due_date asc, then undated last
    tasks.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    return tasks;
  }

  renderDashboardTasks() {
    const container = document.getElementById('dashboard-tasks-list');
    if (!container) return;

    const tasks = this.getAllPendingTasks();

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted fs-2">
          <i class="ti ti-circle-check fs-7 d-block mb-2 opacity-30"></i>
          Nenhuma tarefa pendente. Crie tarefas nos perfis dos contatos.
        </div>
      `;
      return;
    }

    const now = new Date();
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="bg-light">
            <tr>
              <th style="width:40%">Tarefa</th>
              <th style="width:25%">Contato</th>
              <th style="width:20%">Vencimento</th>
              <th style="width:15%" class="text-end">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => {
              let dueBadge = '<span class="text-muted fs-2">Sem data</span>';
              if (t.due_date) {
                const dt = new Date(t.due_date);
                const isOverdue = dt < now;
                const isToday   = dt.toDateString() === now.toDateString();
                const fmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                dueBadge = isOverdue
                  ? `<span class="badge bg-danger-subtle text-danger fw-semibold">${fmt} <i class="ti ti-alert-circle ms-1"></i></span>`
                  : isToday
                  ? `<span class="badge bg-warning-subtle text-warning fw-semibold">${fmt} <i class="ti ti-clock ms-1"></i></span>`
                  : `<span class="badge bg-light text-dark border">${fmt}</span>`;
              }
              return `
                <tr>
                  <td>
                    <div class="fw-semibold text-dark">${t.title}</div>
                    <small class="text-muted">${t.desc || ''}</small>
                  </td>
                  <td>
                    <span class="fs-2 text-primary fw-semibold">${t.leadName}</span>
                  </td>
                  <td>${dueBadge}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-success" onclick="window.tasksManager.markTaskDone('${t.leadId}', ${t.idx})" title="Marcar como concluída">
                      <i class="ti ti-check"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="p-2 text-end">
        <small class="text-muted">${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} pendente${tasks.length > 1 ? 's' : ''}</small>
      </div>
    `;
  }
}

window.tasksManager = new TasksManager();
