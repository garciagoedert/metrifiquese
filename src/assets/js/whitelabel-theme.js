/**
 * Metrifique-se CRM - Dynamic Whitelabel Theme & Super Admin Security Guard
 * Applies dynamic Tenant branding overrides (Logo, Primary Color, Contrast, Title)
 * and enforces strict Super Admin access protection.
 */

class WhitelabelThemeEngine {
  constructor() {
    this.initTheme();
  }

  initTheme() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.applyTenantTheme();
        this.applyUserSecurityGuard();
      });
    } else {
      this.applyTenantTheme();
      this.applyUserSecurityGuard();
    }
  }

  sanitizeHexColor(color, fallback = '#143E2B') {
    if (typeof color !== 'string') return fallback;
    const trimmed = color.trim();
    return /^#[0-9A-Fa-f]{3,8}$/.test(trimmed) ? trimmed : fallback;
  }

  hexToRgbTriplet(hex) {
    const clean = this.sanitizeHexColor(hex, '#143E2B').slice(1);
    let r, g, b;
    if (clean.length === 3 || clean.length === 4) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else {
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
    }
    return `${r}, ${g}, ${b}`;
  }

  computeContrastColor(hex) {
    const clean = this.sanitizeHexColor(hex, '#143E2B').slice(1);
    let r, g, b;
    if (clean.length === 3 || clean.length === 4) {
      r = parseInt(clean[0] + clean[0], 16) / 255;
      g = parseInt(clean[1] + clean[1], 16) / 255;
      b = parseInt(clean[2] + clean[2], 16) / 255;
    } else {
      r = parseInt(clean.slice(0, 2), 16) / 255;
      g = parseInt(clean.slice(2, 4), 16) / 255;
      b = parseInt(clean.slice(4, 6), 16) / 255;
    }
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance > 0.17913 ? '#09090B' : '#FFFFFF';
  }

  applyThemeTokens(primaryColor, logoUrl, tenantName) {
    const safeColor = this.sanitizeHexColor(primaryColor, '#143E2B');
    const fgColor = this.computeContrastColor(safeColor);
    const rgbTriplet = this.hexToRgbTriplet(safeColor);

    const root = document.documentElement;
    root.style.setProperty('--bs-primary', safeColor);
    root.style.setProperty('--bs-primary-rgb', rgbTriplet);
    root.style.setProperty('--theme-primary', safeColor);
    root.style.setProperty('--hs-orange', safeColor);
    root.style.setProperty('--theme-primary-fg', fgColor);

    let customStyleEl = document.getElementById('whitelabel-custom-styles');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'whitelabel-custom-styles';
      document.head.appendChild(customStyleEl);
    }

    customStyleEl.textContent = `
      .btn-primary,
      .bg-primary:not(.bg-opacity-10, .bg-opacity-25),
      .badge.bg-primary {
        background-color: var(--theme-primary) !important;
        border-color: var(--theme-primary) !important;
        color: var(--theme-primary-fg) !important;
      }
      .btn-outline-primary {
        color: var(--theme-primary-text, var(--theme-primary)) !important;
        border-color: var(--theme-primary-text, var(--theme-primary)) !important;
      }
      .btn-outline-primary:hover:not(:disabled) {
        background-color: var(--theme-primary) !important;
        border-color: var(--theme-primary) !important;
        color: var(--theme-primary-fg) !important;
      }
      .text-primary, a.text-primary {
        color: var(--theme-primary-text, var(--theme-primary)) !important;
      }
      .hs-action-pill:hover {
        border-color: var(--theme-primary-text, var(--theme-primary)) !important;
        color: var(--theme-primary-text, var(--theme-primary)) !important;
        background-color: var(--theme-primary-soft, color-mix(in oklab, var(--theme-primary) 10%, transparent)) !important;
      }
      .hs-nav-tabs .nav-link.active {
        color: var(--theme-primary-text, var(--theme-primary)) !important;
        border-bottom-color: var(--theme-primary) !important;
      }

      /* Enhanced Sidebar Aesthetic & Collapsed State */
      .left-sidebar {
        background-color: var(--mq-surface, #FFFFFF) !important;
        border-right: 1px solid var(--mq-border, #E4E4E7) !important;
        box-shadow: none !important;
        transition: width 0.25s ease, left 0.25s ease !important;
      }
      .sidebar-nav ul .sidebar-item {
        margin-bottom: 4px;
      }
      .sidebar-nav ul .sidebar-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        color: var(--mq-muted, #52525B) !important;
        font-weight: 600;
        font-size: 0.88rem;
        border-radius: 10px !important;
        transition: background-color 0.2s ease, color 0.2s ease;
        text-decoration: none;
      }
      .sidebar-nav ul .sidebar-link i {
        font-size: 1.25rem;
        color: var(--mq-muted, #52525B);
        transition: transform 0.2s ease, color 0.2s ease;
      }
      .sidebar-nav ul .sidebar-link:hover {
        background-color: var(--mq-surface-subtle, #F4F4F5) !important;
        color: var(--mq-heading, #09090B) !important;
      }
      .sidebar-nav ul .sidebar-link:hover i {
        color: var(--theme-primary-text, var(--theme-primary)) !important;
      }
      @media (prefers-reduced-motion: no-preference) {
        .sidebar-nav ul .sidebar-link:hover i {
          transform: translateX(3px);
        }
      }
      .sidebar-nav ul .sidebar-item.selected > .sidebar-link {
        background: var(--theme-primary) !important;
        color: var(--theme-primary-fg) !important;
        font-weight: 700;
        box-shadow: var(--mq-elev-2, 0 4px 12px -2px rgba(9, 9, 11, 0.14)) !important;
      }
      .sidebar-nav ul .sidebar-item.selected > .sidebar-link i {
        color: var(--theme-primary-fg) !important;
      }
      .nav-small-cap {
        padding: 16px 14px 6px 14px !important;
        color: var(--mq-muted, #71717A) !important;
        font-size: 0.68rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      @media (min-width: 1200px) {
        #main-wrapper[data-sidebartype="mini-sidebar"] .left-sidebar {
          width: 80px !important;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .body-wrapper {
          margin-left: 80px !important;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .app-header {
          width: calc(100% - 80px) !important;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .sidebar-nav ul .sidebar-link {
          justify-content: center;
          padding: 12px 0;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .sidebar-nav ul .sidebar-link i {
          font-size: 1.4rem;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .hide-menu {
          display: none !important;
        }
        #main-wrapper[data-sidebartype="mini-sidebar"] .nav-small-cap {
          text-align: center;
          padding: 12px 0 !important;
        }
      }
    `;

    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    let resolvedLogo = window.mqSecurity ? window.mqSecurity.safeUrl(logoUrl, '') : logoUrl;
    if (resolvedLogo && (resolvedLogo.endsWith('logoblack.png') || resolvedLogo.endsWith('logowhite.png'))) {
      resolvedLogo = resolvedLogo.replace(/logo(?:black|white)\.png$/, isDarkTheme ? 'logowhite.png' : 'logoblack.png');
    }
    const logoImgs = document.querySelectorAll('.logo-img img, .brand-logo img, .hs-brand-logo');
    logoImgs.forEach((img) => {
      if (resolvedLogo) {
        img.src = resolvedLogo;
      }
      if (tenantName) {
        img.alt = tenantName;
      }
    });

    if (tenantName) {
      document.title = `${tenantName} | CRM Whitelabel de Leads`;
    }
  }

  applyTenantTheme() {
    const tenant = window.crmStore ? window.crmStore.getTenant() : null;
    const primaryColor = (tenant && tenant.primary_color) ? tenant.primary_color : '#143E2B';
    this.applyThemeTokens(primaryColor, tenant?.logo_url, tenant?.name);
  }

  previewTheme(primaryColor, logoUrl) {
    const tenant = window.crmStore ? window.crmStore.getTenant() : null;
    this.applyThemeTokens(primaryColor, logoUrl || tenant?.logo_url, tenant?.name);
  }

  applyUserSecurityGuard() {
    if (!window.crmStore) return;
    const user = window.crmStore.getUser();

    this.updateUserHeaderUI(user);
    this.applyRoleBasedUI();

    if (typeof window !== 'undefined' && !window._profileSyncedListenerAttached) {
      window._profileSyncedListenerAttached = true;
      window.addEventListener('profile-synced', () => {
        if (window.crmStore) {
          this.updateUserHeaderUI(window.crmStore.getUser());
          this.applyRoleBasedUI();
        }
      });
    }
  }

  applyRoleBasedUI() {
    if (!window.crmStore) return;
    const isAdmin = window.crmStore.isAdmin();
    const isSuperAdmin = window.crmStore.isSuperAdmin();

    // Hide admin-tenants from non super admins
    document.querySelectorAll('a[href*="admin-tenants.html"]').forEach((link) => {
      const sidebarItem = link.closest('.sidebar-item');
      const li = link.closest('li');
      const show = isSuperAdmin;
      if (sidebarItem) sidebarItem.style.display = show ? '' : 'none';
      if (li) li.style.display = show ? '' : 'none';
    });

    // Hide whitelabel config from non admins
    if (!isAdmin) {
      document.querySelectorAll('a[href*="configuracoes-whitelabel.html"]').forEach((link) => {
        const sidebarItem = link.closest('.sidebar-item');
        if (sidebarItem) sidebarItem.style.display = 'none';
        const li = link.closest('li');
        if (li && li.closest('.dropdown-menu')) li.style.display = 'none';
      });
    }

    // Redirect unauthorized users cleanly with toast notice query flag
    if (!isSuperAdmin && window.location.pathname.includes('admin-tenants.html')) {
      window.location.href = './dashboard.html?notice=access_denied';
      return;
    }

    if (!isAdmin && window.location.pathname.includes('configuracoes-whitelabel.html')) {
      window.location.href = './dashboard.html?notice=access_denied';
      return;
    }

    // Show inspection banner for super admin viewing tenant
    if (isSuperAdmin) {
      const activeTenantId = window.crmStore.getActiveTenantId();
      if (activeTenantId !== 'tenant-demo-001' && !window.location.pathname.includes('admin-tenants.html')) {
        this.injectInspectionBanner();
      }
    }
  }

  updateUserHeaderUI(user) {
    if (!user) return;
    document.querySelectorAll('.header-user-name').forEach((el) => {
      el.textContent = user.full_name || 'Usuário';
    });
    document.querySelectorAll('.header-user-avatar').forEach((img) => {
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.onerror = () => {
        if (!img.dataset.hasFallback) {
          img.dataset.hasFallback = 'true';
          img.src = '../assets/images/profile/user-1.jpg';
        }
      };
      if (user.avatar_url && user.avatar_url.trim() !== '') {
        delete img.dataset.hasFallback;
        const safeAvatar = window.mqSecurity ? window.mqSecurity.safeUrl(user.avatar_url, '../assets/images/profile/user-1.jpg') : user.avatar_url;
        img.src = safeAvatar;
      }
    });
  }

  injectInspectionBanner() {
    if (document.getElementById('global-inspection-banner')) return;
    const tenant = window.crmStore.getTenant();
    const esc = window.mqSecurity ? window.mqSecurity.escapeHtml : (s) => String(s || '');
    const banner = document.createElement('div');
    banner.id = 'global-inspection-banner';
    banner.className = 'alert alert-warning mb-0 py-2 px-3 rounded-0 border-0 border-bottom border-warning d-flex align-items-center justify-content-between text-dark fs-2 fw-semibold shadow-sm';
    banner.style.zIndex = '1040';
    banner.innerHTML = `
      <div>
        <i class="ti ti-eye me-1" aria-hidden="true"></i> Modo Inspeção Super Admin: Você está visualizando os dados da empresa <strong>${esc(tenant ? tenant.name : 'Cliente')}</strong>
      </div>
      <button type="button" class="btn btn-sm btn-dark fw-bold px-3 py-1" onclick="window.crmStore.switchActiveTenant('tenant-demo-001'); window.location.reload();">
        <i class="ti ti-arrow-left me-1" aria-hidden="true"></i> Voltar ao Master Admin
      </button>
    `;
    const bodyWrapper = document.querySelector('#main-content, .body-wrapper') || document.body;
    bodyWrapper.insertBefore(banner, bodyWrapper.firstChild);
  }
}

window.whitelabelEngine = new WhitelabelThemeEngine();
