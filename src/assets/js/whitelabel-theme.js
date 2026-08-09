/**
 * Metrifique-se CRM - Dynamic Whitelabel Theme & Super Admin Security Guard
 * Applies dynamic Tenant branding overrides (Logo, Primary Color, Title)
 * and enforces strict Super Admin access protection.
 */

class WhitelabelThemeEngine {
  constructor() {
    this.initTheme();
  }

  initTheme() {
    document.addEventListener('DOMContentLoaded', () => {
      this.applyTenantTheme();
      this.applyUserSecurityGuard();
    });
  }

  applyTenantTheme() {
    const tenant = window.crmStore ? window.crmStore.getTenant() : null;
    const primaryColor = (tenant && tenant.primary_color) ? tenant.primary_color : '#FF7A59';

    const root = document.documentElement;
    root.style.setProperty('--bs-primary', primaryColor);
    root.style.setProperty('--theme-primary', primaryColor);
    root.style.setProperty('--hs-orange', primaryColor);

    let customStyleEl = document.getElementById('whitelabel-custom-styles');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'whitelabel-custom-styles';
      document.head.appendChild(customStyleEl);
    }

    customStyleEl.innerHTML = `
      .btn-primary, .bg-primary, .badge.bg-primary {
        background-color: ${primaryColor} !important;
        border-color: ${primaryColor} !important;
        color: #FFFFFF !important;
      }
      .btn-outline-primary {
        color: ${primaryColor} !important;
        border-color: ${primaryColor} !important;
      }
      .btn-outline-primary:hover {
        background-color: ${primaryColor} !important;
        color: #FFFFFF !important;
      }
      .text-primary, a.text-primary {
        color: ${primaryColor} !important;
      }
      .hs-action-pill:hover {
        border-color: ${primaryColor} !important;
        color: ${primaryColor} !important;
        background-color: rgba(255, 122, 89, 0.08) !important;
      }
      .sidebar-nav ul .sidebar-item.selected > .sidebar-link {
        background-color: ${primaryColor} !important;
        color: #ffffff !important;
        border-radius: 8px;
      }
      .hs-nav-tabs .nav-link.active {
        color: ${primaryColor} !important;
        border-bottom-color: ${primaryColor} !important;
      }

      /* Enhanced Sidebar Aesthetic & Collapsed State */
      .left-sidebar {
        background-color: #FFFFFF !important;
        border-right: 1px solid #E2E8F0 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03) !important;
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
        color: #475569 !important;
        font-weight: 600;
        font-size: 0.88rem;
        border-radius: 10px !important;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .sidebar-nav ul .sidebar-link i {
        font-size: 1.25rem;
        color: #64748B;
        transition: transform 0.2s ease, color 0.2s ease;
      }
      .sidebar-nav ul .sidebar-link:hover {
        background-color: #F1F5F9 !important;
        color: #0F172A !important;
      }
      .sidebar-nav ul .sidebar-link:hover i {
        color: ${primaryColor} !important;
        transform: translateX(3px);
      }
      .sidebar-nav ul .sidebar-item.selected > .sidebar-link {
        background: linear-gradient(135deg, ${primaryColor} 0%, #FF5252 100%) !important;
        color: #FFFFFF !important;
        box-shadow: 0 4px 12px rgba(255, 122, 89, 0.25) !important;
      }
      .sidebar-nav ul .sidebar-item.selected > .sidebar-link i {
        color: #FFFFFF !important;
      }
      .nav-small-cap {
        padding: 16px 14px 6px 14px !important;
        color: #94A3B8 !important;
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

    const logoImgs = document.querySelectorAll('.logo-img img, .brand-logo img, .hs-brand-logo');
    logoImgs.forEach(img => {
      if (tenant && tenant.logo_url) {
        img.src = tenant.logo_url;
      }
      if (tenant && tenant.name) {
        img.alt = tenant.name;
      }
    });

    if (tenant && tenant.name) {
      document.title = `${tenant.name} | CRM Whitelabel de Leads`;
    }
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
    document.querySelectorAll('a[href*="admin-tenants.html"]').forEach(link => {
      const sidebarItem = link.closest('.sidebar-item');
      const li = link.closest('li');
      const show = isSuperAdmin;
      if (sidebarItem) sidebarItem.style.display = show ? '' : 'none';
      if (li) li.style.display = show ? '' : 'none';
    });

    // Hide whitelabel config from non admins
    if (!isAdmin) {
      document.querySelectorAll('a[href*="configuracoes-whitelabel.html"]').forEach(link => {
        const sidebarItem = link.closest('.sidebar-item');
        if (sidebarItem) sidebarItem.style.display = 'none';
        const li = link.closest('li');
        if (li && li.closest('.dropdown-menu')) li.style.display = 'none';
      });
    }

    // If vendedor tries to access admin-only pages, redirect
    if (!isSuperAdmin && window.location.pathname.includes('admin-tenants.html')) {
      alert('Acesso negado: Esta área é restrita ao administrador master da plataforma.');
      window.location.href = './dashboard.html';
    }

    if (!isAdmin && window.location.pathname.includes('configuracoes-whitelabel.html')) {
      alert('Acesso negado: Configurações whitelabel são restritas a administradores.');
      window.location.href = './dashboard.html';
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
    document.querySelectorAll('.header-user-name').forEach(el => el.innerText = user.full_name || 'Usuário');
    document.querySelectorAll('.header-user-avatar').forEach(img => {
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.onerror = () => {
        if (!img.dataset.hasFallback) {
          img.dataset.hasFallback = 'true';
          img.src = '../assets/images/profile/user-1.jpg';
        }
      };
      if (user.avatar_url && user.avatar_url.trim() !== '') {
        delete img.dataset.hasFallback;
        img.src = user.avatar_url;
      }
    });
  }

  applyUserSecurityGuardRef() {

    // Check if logged in user is STRICTLY Super Admin
    const isSuperAdminUser = Boolean(user && (user.is_super_admin === true || user.email === 'paulo@southsea.com.br'));
    const isSuperAdminPage = window.location.pathname.includes('admin-tenants.html');

    if (isSuperAdminUser) {
      // EXIBIR menus Super Admin para o Dono Master
      document.querySelectorAll('a[href*="admin-tenants.html"]').forEach(link => {
        const sidebarItem = link.closest('.sidebar-item');
        if (sidebarItem) sidebarItem.style.setProperty('display', 'block', 'important');
        const dropdownLi = link.closest('li');
        if (dropdownLi) dropdownLi.style.setProperty('display', 'block', 'important');
      });

      // Se estiver inspecionando uma empresa cliente, injeta o banner "Voltar ao Master Admin"
      const activeTenantId = window.crmStore.getActiveTenantId();
      if (activeTenantId !== 'tenant-demo-001' && !isSuperAdminPage) {
        this.injectInspectionBanner();
      }
    } else {
      // OCULTAR 100% os menus Super Admin para empresas clientes
      document.querySelectorAll('a[href*="admin-tenants.html"]').forEach(link => {
        const sidebarItem = link.closest('.sidebar-item');
        if (sidebarItem) sidebarItem.style.setProperty('display', 'none', 'important');
        const dropdownLi = link.closest('li');
        if (dropdownLi) dropdownLi.style.setProperty('display', 'none', 'important');
      });

      // Se um usuário comum tentar abrir admin-tenants.html diretamente via URL, bloqueia e redireciona
      if (isSuperAdminPage) {
        alert('Acesso Negado: O Painel Super Admin é restrito exclusivamente ao administrador master da plataforma.');
        window.location.href = './dashboard.html';
      }
    }
  }

  injectInspectionBanner() {
    if (document.getElementById('global-inspection-banner')) return;
    const tenant = window.crmStore.getTenant();
    const banner = document.createElement('div');
    banner.id = 'global-inspection-banner';
    banner.className = 'alert alert-warning mb-0 py-2 px-3 rounded-0 border-0 border-bottom border-warning d-flex align-items-center justify-content-between text-dark fs-2 fw-semibold shadow-sm';
    banner.style.zIndex = '9999';
    banner.innerHTML = `
      <div>
        <i class="ti ti-eye me-1"></i> Modo Inspeção Super Admin: Você está visualizando os dados da empresa <strong>${tenant ? tenant.name : 'Cliente'}</strong>
      </div>
      <button class="btn btn-sm btn-dark fw-bold px-3 py-1" onclick="window.crmStore.switchActiveTenant('tenant-demo-001'); window.location.reload();">
        <i class="ti ti-arrow-left me-1"></i> Voltar ao Master Admin
      </button>
    `;
    const bodyWrapper = document.querySelector('.body-wrapper') || document.body;
    bodyWrapper.insertBefore(banner, bodyWrapper.firstChild);
  }
}

window.whitelabelEngine = new WhitelabelThemeEngine();
