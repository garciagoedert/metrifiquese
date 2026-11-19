/**
 * Metrifique-se CRM - Modern Web UI Toolkit & Security Helpers
 * Provides: mqSecurity (XSS escaping & sanitization), mqUI (Popover Toasts,
 * Native <dialog> confirm/prompt, Copy Buttons, Global Search Cmd+K,
 * Post-interaction Form Validation & Accessible Theme Toggle).
 */

(function () {
  'use strict';

  // Conditional Popover polyfill (loaded ONLY when native support is missing)
  if (typeof HTMLElement !== 'undefined' && !Object.hasOwn(HTMLElement.prototype, 'popover')) {
    const polyfillScript = document.createElement('script');
    polyfillScript.type = 'module';
    polyfillScript.src = 'https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js';
    document.head.appendChild(polyfillScript);
  }

  // ── 1. SECURITY & SANITIZATION ─────────────────────────────────────────
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  const mqSecurity = {
    escapeHtml(val) {
      if (val === null || val === undefined) return '';
      return String(val).replace(/[&<>"']/g, (ch) => escapeMap[ch]);
    },

    escapeAttr(val) {
      return this.escapeHtml(val);
    },

    safeUrl(url, fallback = '') {
      if (!url || typeof url !== 'string') return fallback;
      const trimmed = url.trim();
      if (!trimmed) return fallback;

      // Allow safe relative paths
      if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('#')) {
        if (trimmed.startsWith('//')) return fallback;
        return trimmed;
      }

      // Allow safe raster data:image URIs
      if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
        return trimmed;
      }

      try {
        const parsed = new URL(trimmed, window.location.origin);
        if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
          return parsed.href;
        }
      } catch (e) {
        return fallback;
      }

      return fallback;
    },

    safeSetHTML(el, html, config) {
      if (!el) return;
      const raw = String(html ?? '');

      if ('setHTML' in Element.prototype) {
        try {
          el.setHTML(raw, config ? { sanitizer: config } : undefined);
          return;
        } catch (e) {
          // Fall through to DOMParser sanitization if custom config fails
        }
      }

      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const blockedTags = 'script, iframe, object, embed, link, meta, base, style';
      doc.body.querySelectorAll(blockedTags).forEach((node) => node.remove());

      doc.body.querySelectorAll('*').forEach((node) => {
        for (const attr of [...node.attributes]) {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim().toLowerCase();
          if (name.startsWith('on') || name === 'srcdoc') {
            node.removeAttribute(attr.name);
          } else if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
            if (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html')) {
              node.removeAttribute(attr.name);
            }
          }
        }
      });

      el.replaceChildren(...doc.body.childNodes);
    }
  };

  window.mqSecurity = mqSecurity;

  // ── 2. CLOSED-BY FALLBACK FOR <dialog> ─────────────────────────────────
  const attachClosedByAnyFallback = (dialog) => {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    if (dialog.dataset.closedByBound === 'true') return;
    dialog.dataset.closedByBound = 'true';

    const outside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e) && dialog.open) {
        dialog.close('');
      }
      pressedOutside = false;
    });
  };

  // ── 3. UI TOOLKIT ──────────────────────────────────────────────────────
  const toastQueue = [];
  let lastCopyMessage = '';
  const copyTimers = new WeakMap();

  const mqUI = {
    _ensureLiveInfrastructure() {
      if (!document.body) return null;

      let region = document.getElementById('mq-toast-region');
      if (!region) {
        region = document.createElement('div');
        region.id = 'mq-toast-region';
        region.className = 'mq-toast-region';
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', 'Notificações do sistema');
        document.body.appendChild(region);
      }

      let announcer = document.getElementById('mq-live-announcer');
      if (!announcer) {
        const hint = document.createElement('p');
        hint.className = 'visually-hidden';
        hint.textContent = 'Avisos do sistema';
        announcer = document.createElement('div');
        announcer.id = 'mq-live-announcer';
        announcer.className = 'visually-hidden';
        announcer.setAttribute('aria-live', 'polite');
        document.body.append(hint, announcer);
      }

      return { region, announcer };
    },

    ariaNotify(text, hasActions = false) {
      this._announce(text, hasActions);
    },

    _announce(text, hasActions = false) {
      const clean = String(text || '').trim();
      if (!clean) return;
      const msg = hasActions ? `${clean}. Ações disponíveis.` : clean;

      if (typeof document.ariaNotify === 'function') {
        try {
          document.ariaNotify(msg);
          return;
        } catch (e) {
          // Fall back to polite live region
        }
      }

      const infra = this._ensureLiveInfrastructure();
      if (!infra) return;
      infra.announcer.textContent = '';
      requestAnimationFrame(() => {
        infra.announcer.textContent = msg;
      });
    },

    /**
     * Non-blocking popover="manual" toast notification.
     */
    toast(message, options = {}) {
      const {
        type = 'info',
        title = '',
        duration = 4500,
        persistent = false
      } = options;

      // Defer toast if a native modal <dialog> is currently open (background is inert)
      const openNativeModal = document.querySelector('dialog[open]');
      if (openNativeModal) {
        toastQueue.push({ message, options });
        if (!openNativeModal.dataset.mqToastFlushBound) {
          openNativeModal.dataset.mqToastFlushBound = 'true';
          openNativeModal.addEventListener('close', () => {
            while (toastQueue.length > 0) {
              const next = toastQueue.shift();
              this.toast(next.message, next.options);
            }
          }, { once: true });
        }
        return null;
      }

      const infra = this._ensureLiveInfrastructure();
      if (!infra) return null;

      const iconMap = {
        success: 'ti-circle-check',
        error: 'ti-alert-circle',
        warning: 'ti-alert-triangle',
        info: 'ti-info-circle'
      };

      const toastEl = document.createElement('div');
      toastEl.className = `mq-toast mq-toast--${type}`;
      toastEl.setAttribute('popover', 'manual');

      const iconEl = document.createElement('i');
      iconEl.className = `ti ${iconMap[type] || iconMap.info} mq-toast-icon`;
      iconEl.setAttribute('aria-hidden', 'true');

      const bodyEl = document.createElement('div');
      bodyEl.className = 'mq-toast-body';

      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'mq-toast-title';
        titleEl.textContent = title;
        bodyEl.appendChild(titleEl);
      }

      const textEl = document.createElement('div');
      textEl.className = 'mq-toast-message';
      textEl.textContent = message;
      bodyEl.appendChild(textEl);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'mq-toast-close';
      closeBtn.setAttribute('aria-label', 'Fechar aviso');
      const closeIcon = document.createElement('i');
      closeIcon.className = 'ti ti-x';
      closeIcon.setAttribute('aria-hidden', 'true');
      closeBtn.appendChild(closeIcon);

      toastEl.append(iconEl, bodyEl, closeBtn);
      infra.region.appendChild(toastEl);

      // Show popover safely (supporting native and polyfilled states)
      const previousFocus = document.activeElement;
      if (typeof toastEl.showPopover === 'function') {
        try {
          toastEl.showPopover();
        } catch (e) {
          toastEl.classList.add(':popover-open');
        }
      } else {
        toastEl.classList.add(':popover-open');
      }

      let timerId = null;
      const dismiss = (manual = false) => {
        clearTimeout(timerId);
        const wasFocused = toastEl.contains(document.activeElement);
        const siblingToast = toastEl.nextElementSibling || toastEl.previousElementSibling;

        if (typeof toastEl.hidePopover === 'function') {
          try {
            toastEl.hidePopover();
          } catch (e) {
            toastEl.classList.remove(':popover-open');
          }
        } else {
          toastEl.classList.remove(':popover-open');
        }

        const finishRemove = () => {
          toastEl.remove();
          if (manual && wasFocused) {
            if (siblingToast && siblingToast.querySelector('.mq-toast-close')) {
              siblingToast.querySelector('.mq-toast-close').focus();
            } else if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
              previousFocus.focus();
            }
          }
        };

        // Respect reduced motion when removing
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          finishRemove();
        } else {
          setTimeout(finishRemove, 220);
        }
      };

      closeBtn.addEventListener('click', () => dismiss(true));

      const scheduleDismiss = () => {
        if (persistent || duration <= 0) return;
        clearTimeout(timerId);
        timerId = setTimeout(() => {
          if (toastEl.contains(document.activeElement)) return;
          dismiss(false);
        }, duration);
      };

      toastEl.addEventListener('focusin', () => clearTimeout(timerId));
      toastEl.addEventListener('mouseenter', () => clearTimeout(timerId));
      toastEl.addEventListener('focusout', () => {
        requestAnimationFrame(() => {
          if (!toastEl.contains(document.activeElement)) scheduleDismiss();
        });
      });
      toastEl.addEventListener('mouseleave', scheduleDismiss);

      scheduleDismiss();

      const spoken = title ? `${title}: ${message}` : message;
      this._announce(spoken, false);

      return toastEl;
    },

    /**
     * Native <dialog> confirmation replacing window.confirm().
     */
    confirm({
      title = 'Confirmar ação',
      message = '',
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      danger = true
    } = {}) {
      return new Promise((resolve) => {
        let dialog = document.getElementById('mq-confirm-dialog');
        if (!dialog) {
          dialog = document.createElement('dialog');
          dialog.id = 'mq-confirm-dialog';
          dialog.className = 'mq-dialog';
          dialog.setAttribute('aria-labelledby', 'mq-confirm-title');
          dialog.setAttribute('closedby', 'any');
          attachClosedByAnyFallback(dialog);
          document.body.appendChild(dialog);
        }

        const escTitle = mqSecurity.escapeHtml(title);
        const escMsg = mqSecurity.escapeHtml(message);
        const escConfirm = mqSecurity.escapeHtml(confirmLabel);
        const escCancel = mqSecurity.escapeHtml(cancelLabel);

        dialog.innerHTML = `
          <form method="dialog" class="mq-dialog-form">
            <div class="mq-dialog-header">
              <div class="mq-dialog-icon ${danger ? 'mq-dialog-icon--danger' : 'mq-dialog-icon--primary'}" aria-hidden="true">
                <i class="ti ${danger ? 'ti-alert-triangle' : 'ti-help-circle'}"></i>
              </div>
              <h2 id="mq-confirm-title" class="mq-dialog-title">${escTitle}</h2>
            </div>
            <p class="mq-dialog-message">${escMsg}</p>
            <div class="mq-dialog-actions">
              <button type="submit" value="cancel" class="btn btn-light" ${danger ? 'autofocus' : ''}>${escCancel}</button>
              <button type="submit" value="confirm" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" ${!danger ? 'autofocus' : ''}>${escConfirm}</button>
            </div>
          </form>
        `;

        const onClose = () => {
          const confirmed = dialog.returnValue === 'confirm';
          dialog.returnValue = '';
          resolve(confirmed);
        };

        dialog.addEventListener('close', onClose, { once: true });
        dialog.showModal();
      });
    },

    /**
     * Native <dialog> input prompt replacing window.prompt().
     */
    prompt({
      title = 'Informar valor',
      label = 'Valor',
      defaultValue = '',
      placeholder = '',
      inputType = 'text',
      multiline = false,
      confirmLabel = 'Salvar',
      cancelLabel = 'Cancelar',
      required = true
    } = {}) {
      return new Promise((resolve) => {
        let dialog = document.getElementById('mq-prompt-dialog');
        if (!dialog) {
          dialog = document.createElement('dialog');
          dialog.id = 'mq-prompt-dialog';
          dialog.className = 'mq-dialog';
          dialog.setAttribute('aria-labelledby', 'mq-prompt-title');
          dialog.setAttribute('closedby', 'any');
          attachClosedByAnyFallback(dialog);
          document.body.appendChild(dialog);
        }

        const escTitle = mqSecurity.escapeHtml(title);
        const escLabel = mqSecurity.escapeHtml(label);
        const escDefault = mqSecurity.escapeAttr(defaultValue);
        const escPlaceholder = mqSecurity.escapeAttr(placeholder);
        const escConfirm = mqSecurity.escapeHtml(confirmLabel);
        const escCancel = mqSecurity.escapeHtml(cancelLabel);
        const safeType = ['text', 'email', 'tel', 'url', 'number'].includes(inputType) ? inputType : 'text';

        const fieldHtml = multiline
          ? `<textarea id="mq-prompt-field" name="value" class="form-control" rows="3" placeholder="${escPlaceholder}" ${required ? 'required' : ''} autofocus>${mqSecurity.escapeHtml(defaultValue)}</textarea>`
          : `<input type="${safeType}" id="mq-prompt-field" name="value" class="form-control" value="${escDefault}" placeholder="${escPlaceholder}" ${required ? 'required' : ''} autofocus>`;

        dialog.innerHTML = `
          <form method="dialog" class="mq-dialog-form">
            <div class="mq-dialog-header">
              <div class="mq-dialog-icon mq-dialog-icon--primary" aria-hidden="true">
                <i class="ti ti-edit"></i>
              </div>
              <h2 id="mq-prompt-title" class="mq-dialog-title">${escTitle}</h2>
            </div>
            <div class="mb-3 mt-2">
              <label for="mq-prompt-field" class="form-label fw-semibold">${escLabel}</label>
              ${fieldHtml}
            </div>
            <div class="mq-dialog-actions">
              <button type="submit" value="cancel" class="btn btn-light" formnovalidate>${escCancel}</button>
              <button type="submit" value="confirm" class="btn btn-primary">${escConfirm}</button>
            </div>
          </form>
        `;

        const onClose = () => {
          const val = dialog.returnValue === 'confirm'
            ? (dialog.querySelector('#mq-prompt-field')?.value ?? '')
            : null;
          dialog.returnValue = '';
          resolve(val);
        };

        dialog.addEventListener('close', onClose, { once: true });
        dialog.showModal();
      });
    },

    // ── 4. COPY BUTTONS (Invoker Commands + Async Clipboard + Fallback) ──
    _legacyCopy(text) {
      const field = Object.assign(document.createElement('textarea'), { value: text });
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
      document.body.append(field);
      field.select();
      try {
        return document.execCommand('copy');
      } finally {
        field.remove();
      }
    },

    _reportCopy(button, ok, customSuccessMsg) {
      const container = button.closest('.mq-copy-wrap') || button.parentElement;
      const tip = container ? container.querySelector('.mq-copy-tip[role="status"]') : null;
      const icon = button.querySelector('i.ti');

      clearTimeout(copyTimers.get(button));
      button.removeAttribute('data-copied');
      button.removeAttribute('data-failed');

      let msg = ok ? (customSuccessMsg || 'Copiado!') : 'Falha ao copiar';
      if (msg === lastCopyMessage) msg += '\u00A0';
      lastCopyMessage = msg;

      if (icon && ok) {
        if (!icon.dataset.origIcon) icon.dataset.origIcon = icon.className;
        icon.className = 'ti ti-check';
      }

      void button.offsetWidth;
      button.setAttribute(ok ? 'data-copied' : 'data-failed', '');

      if (tip) {
        tip.textContent = '';
        requestAnimationFrame(() => {
          tip.textContent = msg;
        });
      }

      copyTimers.set(button, setTimeout(() => {
        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        if (icon && icon.dataset.origIcon) {
          icon.className = icon.dataset.origIcon;
        }
        if (tip) tip.textContent = '';
      }, 2000));
    },

    async copyFromElement(button, target, customMsg) {
      if (!target) return;
      const text = target.matches('input, textarea') ? target.value : target.innerText.trim();
      if (!text) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (!this._legacyCopy(text)) {
          throw new Error('Copy failed');
        }
        this._reportCopy(button, true, customMsg);
      } catch (e) {
        try {
          if (!this._legacyCopy(text)) throw new Error('Copy failed');
          this._reportCopy(button, true, customMsg);
        } catch (err2) {
          this._reportCopy(button, false);
        }
      }
    },

    initCopyButtons() {
      if (window._mqCopyInitDone) return;
      window._mqCopyInitDone = true;

      if ('CommandEvent' in window) {
        document.addEventListener('command', (event) => {
          if (typeof event.command === 'string' && event.command.startsWith('--copy')) {
            this.copyFromElement(event.source, event.target, event.source?.dataset?.copyMessage);
          }
        }, true);
      } else {
        document.addEventListener('click', (event) => {
          const button = event.target.closest('button[command^="--copy"]');
          if (!button) return;
          const targetId = button.getAttribute('commandfor');
          const target = targetId ? document.getElementById(targetId) : null;
          if (target) {
            this.copyFromElement(button, target, button.dataset?.copyMessage);
          }
        });
      }
    },

    // ── 5. GLOBAL SEARCH COMMAND PALETTE (Cmd/Ctrl + K) ──────────────────
    initGlobalSearch() {
      const searchInputs = document.querySelectorAll('.hs-header input[placeholder*="Buscar global"]');
      const searchTriggers = document.querySelectorAll('[data-global-search-trigger]');

      searchInputs.forEach((input) => {
        if (input.dataset.searchBound === 'true') return;
        input.dataset.searchBound = 'true';

        const group = input.closest('.input-group');
        if (group && !group.closest('search')) {
          const searchLandmark = document.createElement('search');
          searchLandmark.setAttribute('aria-label', 'Busca global do CRM');
          group.parentNode.insertBefore(searchLandmark, group);
          searchLandmark.appendChild(group);
        }
        input.setAttribute('aria-label', 'Buscar no CRM (Atalho Command ou Control K)');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('enterkeyhint', 'search');
        input.placeholder = 'Buscar no CRM (⌘K)...';
        input.readOnly = true;
        input.style.cursor = 'pointer';

        input.addEventListener('click', () => this.openGlobalSearch());
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.openGlobalSearch();
          }
        });
      });

      searchTriggers.forEach((trigger) => {
        if (trigger.dataset.searchTriggerBound === 'true') return;
        trigger.dataset.searchTriggerBound = 'true';
        trigger.addEventListener('click', () => this.openGlobalSearch());
      });

      const hasSearchShell = searchInputs.length > 0 || searchTriggers.length > 0 || document.querySelector('.hs-header');
      if (hasSearchShell && !window._mqGlobalSearchKeyBound) {
        window._mqGlobalSearchKeyBound = true;
        document.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this.openGlobalSearch();
          }
        });
      }
    },

    openGlobalSearch() {
      let dialog = document.getElementById('mq-global-search-dialog');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'mq-global-search-dialog';
        dialog.className = 'mq-dialog mq-dialog--search';
        dialog.setAttribute('aria-labelledby', 'mq-search-title');
        dialog.setAttribute('closedby', 'any');
        attachClosedByAnyFallback(dialog);

        dialog.innerHTML = `
          <div class="mq-search-shell">
            <h2 id="mq-search-title" class="visually-hidden">Busca Global do CRM</h2>
            <search aria-label="Filtrar leads, negócios e páginas">
              <div class="mq-search-bar">
                <i class="ti ti-search text-muted fs-5" aria-hidden="true"></i>
                <label for="mq-global-search-field" class="visually-hidden">Digite para buscar leads, oportunidades, conversas ou páginas</label>
                <input type="search" id="mq-global-search-field" class="mq-search-input" placeholder="Buscar leads, oportunidades, WhatsApp ou telas..." autocomplete="off" spellcheck="false" enterkeyhint="search" autofocus>
                <button type="button" class="btn btn-sm btn-light" onclick="document.getElementById('mq-global-search-dialog').close('')" aria-label="Fechar busca">Esc</button>
              </div>
            </search>
            <div id="mq-global-search-results" class="mq-search-results" role="listbox" aria-label="Resultados da busca"></div>
          </div>
        `;
        document.body.appendChild(dialog);

        const field = dialog.querySelector('#mq-global-search-field');
        const resultsEl = dialog.querySelector('#mq-global-search-results');

        field.addEventListener('input', () => this._renderSearchResults(field.value, resultsEl));
        field.addEventListener('keydown', (e) => {
          const items = [...resultsEl.querySelectorAll('a.mq-search-item')];
          if (items.length === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[0].focus();
          } else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            items[0].click();
          }
        });

        resultsEl.addEventListener('keydown', (e) => {
          const items = [...resultsEl.querySelectorAll('a.mq-search-item')];
          const idx = items.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < items.length - 1) items[idx + 1].focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) items[idx - 1].focus();
            else field.focus();
          }
        });

        dialog.addEventListener('close', () => {
          dialog.returnValue = '';
        });
      }

      const field = dialog.querySelector('#mq-global-search-field');
      const resultsEl = dialog.querySelector('#mq-global-search-results');
      if (field) field.value = '';
      this._renderSearchResults('', resultsEl);
      dialog.showModal();
      if (field) field.focus();
    },

    _renderSearchResults(rawQuery, container) {
      if (!container) return;
      const q = (rawQuery || '').trim().toLowerCase();
      const esc = mqSecurity.escapeHtml;

      const pages = [
        { title: 'Dashboard Comercial', sub: 'Painel de performance e tarefas', url: './dashboard.html', icon: 'ti-layout-dashboard', group: 'Navegação' },
        { title: 'Base de Leads', sub: 'Contatos, filtros, CSV e perfil 360°', url: './leads.html', icon: 'ti-users', group: 'Navegação' },
        { title: 'Funil de Vendas (Kanban)', sub: 'Oportunidades e etapas comerciais', url: './kanban.html', icon: 'ti-columns', group: 'Navegação' },
        { title: 'WhatsApp & Chat', sub: 'Central de atendimento e QR Code', url: './whatsapp.html', icon: 'ti-brand-whatsapp', group: 'Navegação' },
        { title: 'Automações & Scoring', sub: 'Regras e gatilhos automáticos', url: './automacoes.html', icon: 'ti-robot', group: 'Navegação' },
        { title: 'Formulários & Webhooks', sub: 'Capturas e links embed', url: './capturas.html', icon: 'ti-forms', group: 'Navegação' },
        { title: 'Relatórios & Funil', sub: 'Diagnóstico e previsão de receita', url: './relatorios.html', icon: 'ti-chart-bar', group: 'Navegação' },
        { title: 'Personalização da Empresa', sub: 'Whitelabel, logo e cores', url: './configuracoes-whitelabel.html', icon: 'ti-palette', group: 'Navegação' },
        { title: 'Meu Perfil & Equipe', sub: 'Credenciais e usuários', url: './perfil.html', icon: 'ti-user', group: 'Navegação' }
      ];

      const items = [];

      if (window.crmStore) {
        const leads = window.crmStore.getLeads() || [];
        leads.forEach((l) => {
          const hay = `${l.name || ''} ${l.email || ''} ${l.company || ''} ${l.phone || ''}`.toLowerCase();
          if (!q || hay.includes(q)) {
            items.push({
              title: l.name || 'Sem nome',
              sub: `${l.company || 'Sem empresa'} • ${l.phone || l.email || ''}`,
              url: `./leads.html?lead=${encodeURIComponent(l.id)}`,
              icon: 'ti-user',
              group: 'Leads'
            });
          }
        });

        const deals = window.crmStore.getDeals() || [];
        deals.forEach((d) => {
          const hay = `${d.title || ''}`.toLowerCase();
          if (q && hay.includes(q)) {
            items.push({
              title: d.title || 'Oportunidade',
              sub: `Valor: R$ ${(parseFloat(d.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              url: './kanban.html',
              icon: 'ti-cash',
              group: 'Oportunidades'
            });
          }
        });

        const chats = window.crmStore.getWhatsAppChats() || [];
        chats.forEach((c) => {
          const hay = `${c.name || ''} ${c.phone || ''} ${c.last_message || ''}`.toLowerCase();
          if (q && hay.includes(q)) {
            items.push({
              title: c.name || c.phone || 'Conversa',
              sub: c.last_message || c.phone || '',
              url: `./whatsapp.html?phone=${encodeURIComponent(c.phone || '')}&name=${encodeURIComponent(c.name || '')}`,
              icon: 'ti-brand-whatsapp',
              group: 'WhatsApp'
            });
          }
        });
      }

      pages.forEach((p) => {
        if (!q || `${p.title} ${p.sub}`.toLowerCase().includes(q)) {
          items.push(p);
        }
      });

      const capped = items.slice(0, 12);
      if (capped.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="ti ti-search-off fs-7 d-block mb-1" aria-hidden="true"></i>
            <span class="fs-2">Nenhum resultado encontrado para "${esc(rawQuery)}".</span>
          </div>
        `;
        return;
      }

      container.innerHTML = capped.map((item) => `
        <a href="${mqSecurity.safeUrl(item.url, './dashboard.html')}" class="mq-search-item" role="option">
          <div class="mq-search-item-icon" aria-hidden="true"><i class="ti ${esc(item.icon)}"></i></div>
          <div class="flex-grow-1 overflow-hidden">
            <div class="fw-semibold text-truncate">${esc(item.title)}</div>
            <div class="text-muted fs-1 text-truncate">${esc(item.sub)}</div>
          </div>
          <span class="badge bg-light text-secondary border fs-1">${esc(item.group)}</span>
        </a>
      `).join('');
    },

    // ── 6. POST-INTERACTION FORM VALIDATION & ARIA SYNC ──────────────────
    initFormValidation() {
      if (window._mqFormValidationInit) return;
      window._mqFormValidationInit = true;

      const supportsUserInvalid = typeof CSS !== 'undefined' && CSS.supports('selector(:user-invalid)');
      const dirtyState = new WeakMap();
      const flagged = new WeakSet();

      const linkError = (el, shown) => {
        const errorId = el.dataset.error;
        if (!errorId) return;
        const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorId);
        if (shown) ids.push(errorId);
        if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
        else el.removeAttribute('aria-describedby');
      };

      const syncControl = (el, announce = false) => {
        if (!el || !el.matches || !el.matches('input, select, textarea')) return;
        if (el.disabled || el.type === 'hidden') return;

        let isInvalid = false;
        if (supportsUserInvalid) {
          isInvalid = el.matches(':user-invalid');
        } else {
          const state = dirtyState.get(el);
          isInvalid = Boolean(state && state.hasInteracted && state.hasBlurred && !el.validity.valid);
          el.classList.toggle('user-invalid-fallback', isInvalid);
          el.classList.toggle('user-valid-fallback', Boolean(state && state.hasInteracted && state.hasBlurred && el.validity.valid));
        }

        if (isInvalid) {
          el.setAttribute('aria-invalid', 'true');
          linkError(el, true);
          flagged.add(el);
          if (announce && el.dataset.error) {
            const errEl = document.getElementById(el.dataset.error);
            if (errEl) this._announce(errEl.textContent);
          }
        } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
          el.setAttribute('aria-invalid', 'false');
          linkError(el, false);
          flagged.delete(el);
        }
      };

      document.querySelectorAll('input, select, textarea').forEach((el) => syncControl(el));

      document.addEventListener('blur', (e) => {
        const target = e.target;
        if (!target.matches?.('input, select, textarea')) return;
        if (!supportsUserInvalid) {
          const st = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
          st.hasBlurred = true;
          dirtyState.set(target, st);
        }
        syncControl(target, true);
      }, true);

      document.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.matches?.('input, select, textarea')) return;
        if (!supportsUserInvalid) {
          const st = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
          st.hasInteracted = true;
          dirtyState.set(target, st);
        }
        if (target.hasAttribute('aria-invalid')) syncControl(target, false);
      });

      document.addEventListener('change', (e) => {
        const target = e.target;
        if (!target.matches?.('input, select, textarea')) return;
        if (!supportsUserInvalid) {
          const st = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
          st.hasInteracted = true;
          st.hasBlurred = true;
          dirtyState.set(target, st);
        }
        syncControl(target, true);
      }, true);

      document.addEventListener('invalid', (e) => {
        const target = e.target;
        if (!supportsUserInvalid && target.matches?.('input, select, textarea')) {
          dirtyState.set(target, { hasInteracted: true, hasBlurred: true });
        }
        syncControl(target, false);
      }, true);

      document.addEventListener('reset', (e) => {
        const form = e.target;
        setTimeout(() => {
          [...(form?.elements || [])].forEach((el) => {
            dirtyState.delete(el);
            el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
            syncControl(el, false);
          });
        });
      }, true);
    },

    // ── 7. DARK MODE THEME TOGGLE ────────────────────────────────────────
    _syncColorSchemeMeta(scheme) {
      if (typeof document === 'undefined' || !document.head) return;
      let meta = document.querySelector('meta[name="color-scheme"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'color-scheme';
        document.head.appendChild(meta);
      }
      meta.content = scheme === 'dark' ? 'dark' : (scheme === 'light' ? 'light' : 'light dark');
    },

    applySavedTheme() {
      const root = document.documentElement;
      if (root.dataset.fixedTheme) {
        this._syncColorSchemeMeta(root.dataset.fixedTheme);
        return;
      }

      let saved = 'light';
      try {
        saved = localStorage.getItem('mq_theme') || 'light';
      } catch (_) {}

      const resolved = saved === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (saved === 'dark' ? 'dark' : 'light');

      root.setAttribute('data-theme', resolved);
      this._syncColorSchemeMeta(saved === 'auto' ? 'light dark' : resolved);
      this._updateThemeButton(resolved);
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('mq_theme', next);
      } catch (_) {}
      document.documentElement.setAttribute('data-theme', next);
      this._syncColorSchemeMeta(next);
      this._updateThemeButton(next);
    },

    _updateThemeButton(theme) {
      const buttons = document.querySelectorAll('[data-theme-toggle], #mq-theme-toggle');
      const isDark = theme === 'dark';
      buttons.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(isDark));
        btn.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
        btn.title = isDark ? 'Modo Claro' : 'Modo Escuro';
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = isDark ? 'ti ti-sun fs-5' : 'ti ti-moon fs-5';
        }
      });
    },

    initThemeToggle() {
      this.applySavedTheme();
      if (document.documentElement.dataset.fixedTheme) return;

      const existingButtons = document.querySelectorAll('[data-theme-toggle], #mq-theme-toggle');
      if (existingButtons.length > 0) {
        existingButtons.forEach((btn) => {
          if (btn.dataset.themeBound === 'true') return;
          btn.dataset.themeBound = 'true';
          btn.addEventListener('click', () => this.toggleTheme());
        });
        this._updateThemeButton(document.documentElement.getAttribute('data-theme') || 'light');
        return;
      }

      const headerRight = document.querySelector('.app-header.hs-header > div:last-child');
      if (!headerRight) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mq-theme-toggle';
      btn.setAttribute('data-theme-toggle', '');
      btn.dataset.themeBound = 'true';
      btn.className = 'btn btn-light text-secondary border-0 rounded-circle p-2 d-inline-flex align-items-center justify-content-center';
      btn.innerHTML = '<i class="ti ti-moon fs-5" aria-hidden="true"></i>';
      btn.addEventListener('click', () => this.toggleTheme());

      const firstSettingsOrBell = headerRight.querySelector('a[href*="configuracoes-whitelabel"], button[aria-label="Notificações"], .dropdown');
      if (firstSettingsOrBell) {
        headerRight.insertBefore(btn, firstSettingsOrBell);
      } else {
        headerRight.prepend(btn);
      }

      this._updateThemeButton(document.documentElement.getAttribute('data-theme') || 'light');
    },

    initAll() {
      this.initThemeToggle();
      this.initCopyButtons();
      this.initGlobalSearch();
      this.initFormValidation();

      // Surface access-denied notice if redirected by security guard
      const params = new URLSearchParams(window.location.search);
      if (params.get('notice') === 'access_denied') {
        this.toast('Acesso restrito: você foi redirecionado para o painel principal.', { type: 'warning', title: 'Permissão necessária' });
        params.delete('notice');
        const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  };

  window.mqUI = mqUI;

  // Apply theme immediately to reduce FOUC
  mqUI.applySavedTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mqUI.initAll());
  } else {
    mqUI.initAll();
  }
})();
