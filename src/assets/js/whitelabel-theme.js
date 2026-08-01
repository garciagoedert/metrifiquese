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

    // 1. Atualizar nome e foto do usuário nos cabeçalhos
    if (user) {
      document.querySelectorAll('.header-user-name').forEach(el => el.innerText = user.full_name || 'Usuário');
      document.querySelectorAll('.header-user-avatar').forEach(img => {
        if (user.avatar_url) img.src = user.avatar_url;
      });
    }

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
        window.location.href = './index.html';
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
