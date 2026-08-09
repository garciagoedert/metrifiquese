/**
 * Metrifique-se CRM - Visual Form Builder & Embed Code Generator
 * Multi-tenant Form Builder for website/landing page lead capture.
 */

class FormsManager {
  constructor() {
    this.activeFormId = null;
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.renderFormsList();
      this.initFormEventListeners();
    });
    window.addEventListener('forms-synced', () => this.renderFormsList());
  }

  getForms() {
    return window.crmStore ? window.crmStore.getForms() : [];
  }

  getProductionBaseUrl() {
    return window.location.origin;
  }

  buildFormQueryParams(f) {
    const queryParams = new URLSearchParams({
      tenant: f.tenant_id,
      form: f.id
    });
    if (f.title) queryParams.set('title', f.title);
    if (f.description) queryParams.set('desc', f.description);
    if (f.button_text) queryParams.set('btn', f.button_text);
    if (f.button_color) queryParams.set('color', f.button_color);
    if (f.theme_mode) queryParams.set('theme', f.theme_mode);
    if (f.source) queryParams.set('src', f.source);
    if (f.success_message) queryParams.set('success', f.success_message);
    if (f.redirect_url) queryParams.set('redirect', f.redirect_url);
    if (f.fields) {
      if (f.fields.name !== undefined) queryParams.set('fn', f.fields.name ? '1' : '0');
      if (f.fields.email !== undefined) queryParams.set('fe', f.fields.email ? '1' : '0');
      if (f.fields.phone !== undefined) queryParams.set('fp', f.fields.phone ? '1' : '0');
      if (f.fields.company !== undefined) queryParams.set('fc', f.fields.company ? '1' : '0');
      if (f.fields.notes !== undefined) queryParams.set('fm', f.fields.notes ? '1' : '0');
    }
    return queryParams.toString();
  }

  renderFormsList() {
    const container = document.getElementById('forms-list-container');
    if (!container) return;

    const forms = this.getForms();
    const baseUrl = this.getProductionBaseUrl() + '/src/html/form';

    if (forms.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="ti ti-forms fs-9 text-muted opacity-30 d-block mb-3"></i>
          <h5 class="fw-bold text-dark mb-1">Nenhum Formulário Criado</h5>
          <p class="text-muted fs-3 mb-3">Crie seu primeiro formulário personalizado para capturar leads em seu site ou landing page.</p>
          <button class="btn btn-primary fw-bold" onclick="window.formsManager.openFormModal()">
            <i class="ti ti-plus me-1"></i> Criar Primeiro Formulário
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = forms.map(f => {
      const publicLink = `${baseUrl}?${this.buildFormQueryParams(f)}`;
      return `
        <div class="col-md-6 col-lg-4 mb-4">
          <div class="card border shadow-sm h-100 p-4 rounded-4 hover-shadow transition-all">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="d-flex align-items-center gap-2">
                <div class="p-2-5 rounded-3" style="background-color: ${f.button_color || '#FF7A59'}20; color: ${f.button_color || '#FF7A59'};">
                  <i class="ti ti-forms fs-6"></i>
                </div>
                <div>
                  <h6 class="fw-bold text-dark mb-0 fs-3">${f.title || 'Formulário Sem Título'}</h6>
                  <small class="text-muted fs-1">${f.source || 'Site / Landing Page'}</small>
                </div>
              </div>
              <span class="badge bg-light-primary text-primary rounded-pill px-2.5 py-1 fs-1 fw-bold">
                <i class="ti ti-users me-1"></i> ${f.submissions_count || 0} Leads
              </span>
            </div>

            <p class="text-muted fs-2 mb-3 line-clamp-2" style="min-height: 38px;">${f.description || 'Formulário de captura para website.'}</p>

            <div class="d-flex align-items-center gap-1 mb-3 pt-2 border-top border-bottom py-2">
              <span class="badge bg-light text-dark border fs-1 me-1">Campos:</span>
              ${f.fields.name ? '<span class="badge bg-light-secondary text-dark fs-1">Nome</span>' : ''}
              ${f.fields.email ? '<span class="badge bg-light-secondary text-dark fs-1">E-mail</span>' : ''}
              ${f.fields.phone ? '<span class="badge bg-light-secondary text-dark fs-1">WhatsApp</span>' : ''}
              ${f.fields.company ? '<span class="badge bg-light-secondary text-dark fs-1">Empresa</span>' : ''}
            </div>

            <div class="d-flex gap-2 flex-wrap mt-auto">
              <button class="btn btn-sm btn-primary flex-fill fw-bold" onclick="window.formsManager.openEmbedCodeModal('${f.id}')">
                <i class="ti ti-code me-1"></i> Código Embed
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="window.formsManager.openFormModal('${f.id}')" title="Editar Formulário">
                <i class="ti ti-edit"></i>
              </button>
              <a href="${publicLink}" target="_blank" class="btn btn-sm btn-outline-info" title="Abrir Página Pública">
                <i class="ti ti-external-link"></i>
              </a>
              <button class="btn btn-sm btn-outline-danger" onclick="window.formsManager.deleteFormPrompt('${f.id}')" title="Excluir">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  openFormModal(formId = null) {
    this.activeFormId = formId;
    const modalEl = document.getElementById('formBuilderModal');
    if (!modalEl) return;

    const forms = this.getForms();
    const form = formId ? forms.find(f => f.id === formId) : null;

    document.getElementById('form-id-input').value = form ? form.id : '';
    document.getElementById('form-title-input').value = form ? form.title : 'Solicitar Orçamento / Demonstração';
    document.getElementById('form-desc-input').value = form ? form.description : 'Preencha os dados abaixo para receber um contato exclusivo da nossa equipe.';
    document.getElementById('form-button-text-input').value = form ? form.button_text : 'Quero Receber Orçamento';
    document.getElementById('form-button-color-input').value = form ? form.button_color : '#FF7A59';
    document.getElementById('form-source-input').value = form ? form.source : 'Formulário do Site';
    document.getElementById('form-success-msg-input').value = form ? form.success_message : 'Obrigado! Recebemos seus dados com sucesso e entraremos em contato em breve.';
    document.getElementById('form-redirect-url-input').value = form ? (form.redirect_url || '') : '';
    document.getElementById('form-theme-select').value = form ? (form.theme_mode || 'light') : 'light';

    // Field Checkboxes
    const fields = form ? form.fields : { name: true, email: true, phone: true, company: true, notes: false };
    document.getElementById('field-name-chk').checked = fields.name !== false;
    document.getElementById('field-email-chk').checked = fields.email !== false;
    document.getElementById('field-phone-chk').checked = fields.phone !== false;
    document.getElementById('field-company-chk').checked = fields.company !== false;
    document.getElementById('field-notes-chk').checked = !!fields.notes;

    this.updateLivePreview();

    if (window.bootstrap) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  initFormEventListeners() {
    const inputs = ['form-title-input', 'form-desc-input', 'form-button-text-input', 'form-button-color-input', 'form-theme-select'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateLivePreview());
    });

    const chks = ['field-name-chk', 'field-email-chk', 'field-phone-chk', 'field-company-chk', 'field-notes-chk'];
    chks.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.updateLivePreview());
    });
  }

  updateLivePreview() {
    const title = document.getElementById('form-title-input').value || 'Título do Formulário';
    const desc = document.getElementById('form-desc-input').value || 'Descrição do formulário...';
    const btnText = document.getElementById('form-button-text-input').value || 'Enviar';
    const btnColor = document.getElementById('form-button-color-input').value || '#FF7A59';
    const theme = document.getElementById('form-theme-select').value || 'light';

    const hasName = document.getElementById('field-name-chk').checked;
    const hasEmail = document.getElementById('field-email-chk').checked;
    const hasPhone = document.getElementById('field-phone-chk').checked;
    const hasCompany = document.getElementById('field-company-chk').checked;
    const hasNotes = document.getElementById('field-notes-chk').checked;

    const previewContainer = document.getElementById('live-form-preview');
    if (!previewContainer) return;

    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-dark text-light border-secondary' : 'bg-white text-dark border';

    previewContainer.innerHTML = `
      <div class="card ${bgClass} p-4 rounded-4 shadow-sm" style="max-width: 440px; margin: 0 auto;">
        <h5 class="fw-bold mb-1 ${isDark ? 'text-white' : 'text-dark'}">${title}</h5>
        <p class="${isDark ? 'text-zinc-400' : 'text-muted'} fs-2 mb-4">${desc}</p>

        <form onsubmit="event.preventDefault(); alert('Modo Preview: O envio foi simulado com sucesso!');">
          ${hasName ? `
            <div class="mb-3">
              <label class="form-label fs-2 fw-semibold">Nome Completo *</label>
              <input type="text" class="form-control ${isDark ? 'bg-zinc-800 text-light border-zinc-700' : ''}" placeholder="Seu nome..." required disabled>
            </div>
          ` : ''}

          ${hasEmail ? `
            <div class="mb-3">
              <label class="form-label fs-2 fw-semibold">Seu Melhore E-mail *</label>
              <input type="email" class="form-control ${isDark ? 'bg-zinc-800 text-light border-zinc-700' : ''}" placeholder="seu@email.com" required disabled>
            </div>
          ` : ''}

          ${hasPhone ? `
            <div class="mb-3">
              <label class="form-label fs-2 fw-semibold">WhatsApp / Telefone *</label>
              <input type="text" class="form-control ${isDark ? 'bg-zinc-800 text-light border-zinc-700' : ''}" placeholder="(00) 90000-0000" disabled>
            </div>
          ` : ''}

          ${hasCompany ? `
            <div class="mb-3">
              <label class="form-label fs-2 fw-semibold">Nome da Empresa</label>
              <input type="text" class="form-control ${isDark ? 'bg-zinc-800 text-light border-zinc-700' : ''}" placeholder="Sua empresa..." disabled>
            </div>
          ` : ''}

          ${hasNotes ? `
            <div class="mb-3">
              <label class="form-label fs-2 fw-semibold">Mensagem / Observação</label>
              <textarea class="form-control ${isDark ? 'bg-zinc-800 text-light border-zinc-700' : ''}" rows="3" placeholder="Como podemos te ajudar?" disabled></textarea>
            </div>
          ` : ''}

          <button type="submit" class="btn fw-bold w-100 py-2.5 mt-2" style="background-color: ${btnColor}; color: #FFF; border-color: ${btnColor};">
            ${btnText}
          </button>
        </form>
      </div>
    `;
  }

  saveFormFromModal() {
    const id = document.getElementById('form-id-input').value;
    const title = document.getElementById('form-title-input').value;
    const description = document.getElementById('form-desc-input').value;
    const button_text = document.getElementById('form-button-text-input').value;
    const button_color = document.getElementById('form-button-color-input').value;
    const source = document.getElementById('form-source-input').value;
    const success_message = document.getElementById('form-success-msg-input').value;
    const redirect_url = document.getElementById('form-redirect-url-input').value;
    const theme_mode = document.getElementById('form-theme-select').value;

    const fields = {
      name: document.getElementById('field-name-chk').checked,
      email: document.getElementById('field-email-chk').checked,
      phone: document.getElementById('field-phone-chk').checked,
      company: document.getElementById('field-company-chk').checked,
      notes: document.getElementById('field-notes-chk').checked
    };

    if (!title.trim()) {
      alert('Por favor, informe um título para o formulário.');
      return;
    }

    const formData = {
      id: id || undefined,
      title,
      description,
      button_text,
      button_color,
      source,
      success_message,
      redirect_url,
      theme_mode,
      fields
    };

    const saved = window.crmStore.saveForm(formData);

    const modalEl = document.getElementById('formBuilderModal');
    if (modalEl && window.bootstrap) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    this.renderFormsList();
    this.openEmbedCodeModal(saved.id);
  }

  openEmbedCodeModal(formId) {
    const form = window.crmStore.getFormById(formId);
    if (!form) return;

    const publicLink = `${this.getProductionBaseUrl()}/src/html/form?${this.buildFormQueryParams(form)}`;

    const embedHtmlCode = `<!-- Metrifique-se CRM Form Embed Code -->
<iframe src="${publicLink}" 
        width="100%" 
        height="560" 
        frameborder="0" 
        style="border: none; border-radius: 12px; max-width: 480px; width: 100%;" 
        allow="clipboard-write">
</iframe>`;

    const htmlScriptCode = `<!-- Metrifique-se CRM Native Form Script -->
<div id="metrifiquese-form-container"></div>
<script src="${this.getProductionBaseUrl()}/src/assets/js/form-embed-widget.js" 
        data-tenant="${form.tenant_id}" 
        data-form="${form.id}">
</script>`;

    document.getElementById('embed-form-title').innerText = form.title;
    document.getElementById('embed-public-link').value = publicLink;
    document.getElementById('embed-html-iframe').value = embedHtmlCode;
    document.getElementById('embed-html-script').value = htmlScriptCode;

    const modalEl = document.getElementById('embedCodeModal');
    if (modalEl && window.bootstrap) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  deleteFormPrompt(formId) {
    if (confirm('Tem certeza que deseja excluir este formulário de captura? Os formulários embutidos em sites externos deixarão de responder.')) {
      window.crmStore.deleteForm(formId);
      this.renderFormsList();
    }
  }

  copyToClipboard(inputId, msg = 'Copiado para a área de transferência!') {
    const input = document.getElementById(inputId);
    if (input) {
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        alert(msg);
      }).catch(() => {
        document.execCommand('copy');
        alert(msg);
      });
    }
  }
}

window.formsManager = new FormsManager();
