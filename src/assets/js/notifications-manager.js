/**
 * Metrifique-se CRM - Notifications Engine
 * Manages header notification bell, unread count badge, and dropdown list.
 */

class NotificationsManager {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.renderNotifications();
    });
  }

  renderNotifications() {
    const notifs = window.crmStore ? window.crmStore.getNotifications() : [];
    const unreadCount = notifs.filter(n => !n.is_read).length;

    // Atualizar badge no header
    const bellIcons = document.querySelectorAll('.hs-header a[title="Notificações"], .hs-header .ti-bell');
    bellIcons.forEach(bell => {
      let badge = bell.querySelector('.notif-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light';
        bell.style.position = 'relative';
        bell.appendChild(badge);
      }
      
      if (unreadCount > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = unreadCount;
      } else {
        badge.style.display = 'none';
      }
    });
  }

  markAllRead() {
    if (window.crmStore) {
      window.crmStore.markNotificationsRead();
      this.renderNotifications();
    }
  }
}

window.notificationsManager = new NotificationsManager();
