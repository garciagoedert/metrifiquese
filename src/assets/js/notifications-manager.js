/**
 * Metrifique-se CRM - Notifications Engine
 * Manages header notification bell, unread count badge, and dynamic interactive dropdown menu.
 */

class NotificationsManager {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupDropdown();
        this.renderNotifications();
      });
    } else {
      this.setupDropdown();
      this.renderNotifications();
    }

    window.addEventListener('notifications-updated', () => {
      this.renderNotifications();
    });
  }

  setupDropdown() {
    const bellIcons = document.querySelectorAll('.hs-header a[title="Notificações"], .hs-header .ti-bell');
    bellIcons.forEach(bell => {
      let anchor = bell.tagName === 'A' ? bell : bell.closest('a');
      if (!anchor) return;

      if (anchor.dataset.notifSetup === 'true') return;
      anchor.dataset.notifSetup = 'true';

      const parent = anchor.parentElement;
      if (parent && !parent.classList.contains('dropdown')) {
        parent.classList.add('dropdown');
      }

      anchor.setAttribute('data-bs-toggle', 'dropdown');
      anchor.setAttribute('aria-expanded', 'false');
      anchor.removeAttribute('onclick');
      anchor.style.cursor = 'pointer';

      let dropdownMenu = parent.querySelector('.notif-dropdown-menu');
      if (!dropdownMenu) {
        dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu dropdown-menu-end notif-dropdown-menu shadow-lg border-0 p-0 rounded-3 mt-2';
        dropdownMenu.style.width = '340px';
        dropdownMenu.style.maxHeight = '460px';
        dropdownMenu.style.overflowY = 'auto';

        dropdownMenu.innerHTML = `
          <div class="p-3 border-bottom d-flex align-items-center justify-content-between bg-light rounded-top">
            <div class="d-flex align-items-center gap-2">
              <h6 class="mb-0 fw-bold text-dark"><i class="ti ti-bell text-primary"></i> Notificações</h6>
              <span class="badge bg-primary text-white rounded-pill notif-count-text fs-1">0</span>
            </div>
            <button class="btn btn-link btn-sm p-0 text-decoration-none text-primary fw-semibold fs-2" onclick="window.notificationsManager.markAllRead(); event.stopPropagation();">
              <i class="ti ti-checks me-1"></i>Marcar lidas
            </button>
          </div>
          <div class="notif-list-container py-1" style="max-height: 320px; overflow-y: auto;">
          </div>
          <div class="p-2 border-top text-center bg-light rounded-bottom">
            <button class="btn btn-link btn-sm p-0 text-decoration-none text-danger fw-semibold fs-2" onclick="window.notificationsManager.clearAll(); event.stopPropagation();">
              <i class="ti ti-trash me-1"></i>Limpar histórico
            </button>
          </div>
        `;
        parent.appendChild(dropdownMenu);
      }
    });
  }

  renderNotifications() {
    this.setupDropdown();

    const notifs = window.crmStore ? window.crmStore.getNotifications() : [];
    const unreadCount = notifs.filter(n => !n.is_read).length;

    // 1. Update header badges
    const bellIcons = document.querySelectorAll('.hs-header a[title="Notificações"], .hs-header .ti-bell');
    bellIcons.forEach(bell => {
      let anchor = bell.tagName === 'A' ? bell : bell.closest('a');
      if (!anchor) return;

      let badge = anchor.querySelector('.notif-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light';
        anchor.style.position = 'relative';
        anchor.appendChild(badge);
      }

      if (unreadCount > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
      } else {
        badge.style.display = 'none';
      }
    });

    // 2. Update dropdown contents
    document.querySelectorAll('.notif-dropdown-menu').forEach(menu => {
      const countEl = menu.querySelector('.notif-count-text');
      if (countEl) {
        countEl.innerText = `${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`;
      }

      const container = menu.querySelector('.notif-list-container');
      if (!container) return;

      if (notifs.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="ti ti-bell-off fs-7 text-secondary mb-2 d-block opacity-50"></i>
            <span class="fs-2">Nenhuma notificação no momento.</span>
          </div>
        `;
        return;
      }

      let html = '';
      notifs.forEach(n => {
        const bgStyle = n.is_read ? 'background-color: #ffffff;' : 'background-color: rgba(93, 135, 255, 0.06);';
        const unreadIndicator = !n.is_read ? '<span class="badge bg-danger rounded-circle p-1 me-2" style="width: 8px; height: 8px; display: inline-block;"></span>' : '';

        html += `
          <div class="dropdown-item px-3 py-2 border-bottom text-wrap d-flex align-items-start justify-content-between" style="${bgStyle} cursor: pointer;" onclick="window.notificationsManager.markRead('${n.id}');">
            <div class="d-flex gap-2 align-items-start me-2">
              <div class="bg-light-primary text-primary p-2 rounded-circle mt-1 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; flex-shrink: 0;">
                <i class="ti ti-bell-ringing fs-4"></i>
              </div>
              <div>
                <div class="d-flex align-items-center">
                  ${unreadIndicator}
                  <strong class="text-dark fs-2 mb-0">${n.title || 'Notificação'}</strong>
                </div>
                <p class="mb-1 text-secondary fs-2 lh-sm">${n.message || ''}</p>
                <small class="text-muted fs-1"><i class="ti ti-clock me-1"></i>${n.time || 'Agora'}</small>
              </div>
            </div>
            ${!n.is_read ? `<button class="btn btn-sm text-primary p-0" title="Marcar como lida" onclick="event.stopPropagation(); window.notificationsManager.markRead('${n.id}');"><i class="ti ti-check fs-4"></i></button>` : ''}
          </div>
        `;
      });

      container.innerHTML = html;
    });
  }

  markRead(id) {
    if (window.crmStore) {
      window.crmStore.markNotificationRead(id);
      this.renderNotifications();
    }
  }

  markAllRead() {
    if (window.crmStore) {
      window.crmStore.markNotificationsRead();
      this.renderNotifications();
    }
  }

  clearAll() {
    if (window.crmStore) {
      window.crmStore.clearNotifications();
      this.renderNotifications();
    }
  }
}

window.notificationsManager = new NotificationsManager();
