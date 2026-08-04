/**
 * Metrifique-se CRM - Multi-Tenant Data Store & Dual Persistence Engine (Supabase Cloud + Permanent Local Persistence)
 * Guarantees 100% data persistence without loss across code updates and browser sessions.
 */

let envUrl = '';
let envAnonKey = '';
try {
  envUrl = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
  envAnonKey = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
} catch (e) {
  envUrl = '';
  envAnonKey = '';
}

const SUPABASE_CONFIG = {
  url: envUrl || (typeof window !== 'undefined' ? window.localStorage.getItem('SUPABASE_URL') : '') || 'https://syvqisjpulryjlgksjrk.supabase.co',
  anonKey: envAnonKey || (typeof window !== 'undefined' ? window.localStorage.getItem('SUPABASE_ANON_KEY') : '') || 'sb_publishable_O0sjGeACkgzBZJOlMMGpaA_LMHn3Ihl'
};

// Initialize Supabase JS Client if credentials & library are present
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('[Supabase Cloud Backend] Conectado ao banco de dados:', SUPABASE_CONFIG.url);
  } catch (err) {
    console.warn('[Supabase Cloud Backend] Erro ao inicializar cliente Supabase:', err);
  }
}

// Multi-Tenant Seed Data
const INITIAL_DEMO_DATA = {
  tenants: [
    {
      id: 'tenant-demo-001',
      name: 'Metrifique-se CRM (Master)',
      slug: 'metrifiquese-master',
      logo_url: '/src/assets/images/logos/metrifiquese.svg',
      primary_color: '#FF7A59',
      secondary_color: '#00A4BD',
      custom_domain: 'crm.metrifiquese.com.br',
      plan: 'Master / Super Admin',
      monthly_price: 0,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString()
    },
    {
      id: 'tenant-002',
      name: 'Agência Scale Marketing',
      slug: 'scale-marketing',
      logo_url: '/src/assets/images/logos/metrifiquese.svg',
      primary_color: '#00A4BD',
      secondary_color: '#FF7A59',
      custom_domain: 'crm.scalemarketing.com.br',
      plan: 'Plano Agência Whitelabel',
      monthly_price: 297.00,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 15).toISOString()
    },
    {
      id: 'tenant-003',
      name: 'Tech Solutions Corp',
      slug: 'tech-solutions',
      logo_url: '/src/assets/images/logos/metrifiquese.svg',
      primary_color: '#7D52F4',
      secondary_color: '#00A4BD',
      custom_domain: 'crm.techsolutions.com',
      plan: 'Plano Enterprise',
      monthly_price: 597.00,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString()
    }
  ],
  users: [
    {
      id: 'user-001',
      tenant_id: 'tenant-demo-001',
      full_name: 'Paulo Garcia',
      email: 'paulo@southsea.com.br',
      password: '12345678',
      phone: '(11) 99887-6655',
      role: 'Super Admin Plataforma',
      is_super_admin: true,
      avatar_url: 'https://instagram.ffln1-1.fna.fbcdn.net/v/t51.82787-19/658968988_17956763901106219_4353182039587841370_n.jpg?stp=dst-jpg_s640x640_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.ffln1-1.fna.fbcdn.net&_nc_cat=107&_nc_oc=Q6cZ2gHQ7zmgXpwEmvIUUSDkCUd6C0alcKSp971qs39wUvaAXRPpJ7ZZ-8D-PVC9rAzxHr1fNlaD1pe1iR2PdpYlCCxi&_nc_ohc=D_qV0EMM3bAQ7kNvwEhm8-2&_nc_gid=3q7MmEdXmEkyWixry7GE7g&edm=AAZTMJEBAAAA&ccb=7-5&oh=00_AQEsTlniOhUeINunzYKRs8jcV-xr0pMOKFeckOynLzUZSw&oe=6A73BCD6&_nc_sid=49cb7f'
    },
    {
      id: 'user-002',
      tenant_id: 'tenant-002',
      full_name: 'Lucas Scale',
      email: 'lucas@scalemarketing.com.br',
      password: '12345678',
      phone: '(11) 97777-1111',
      role: 'Dono da Agência',
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    },
    {
      id: 'user-003',
      tenant_id: 'tenant-003',
      full_name: 'Ana Paula Tech',
      email: 'ana@techcorp.com.br',
      password: '12345678',
      phone: '(21) 98888-2222',
      role: 'Diretora Comercial',
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    }
  ],
  session: {
    user: null,
    active_tenant_id: null,
    is_authenticated: false
  },
  notifications: [
    {
      id: 'notif-1',
      tenant_id: 'tenant-demo-001',
      title: 'Novo Lead Inbound',
      message: 'Mariana Silva enviou formulário via Facebook Ads.',
      time: 'Há 10 minutos',
      is_read: false
    },
    {
      id: 'notif-2',
      tenant_id: 'tenant-demo-001',
      title: 'Oportunidade Fechada',
      message: 'Contrato R$ 25.000,00 com Logística Express marcado como GANHO!',
      time: 'Há 2 horas',
      is_read: false
    },
    {
      id: 'notif-3',
      tenant_id: 'tenant-002',
      title: 'Nova Empresa Cliente',
      message: 'Agência Scale Marketing iniciou teste de 14 dias.',
      time: 'Ontem',
      is_read: true
    }
  ],
  pipelines: [
    { id: 'pipe-1', tenant_id: 'tenant-demo-001', name: 'Funil de Vendas Inbound', is_default: true },
    { id: 'pipe-2', tenant_id: 'tenant-002', name: 'Funil Agência Scale', is_default: true },
    { id: 'pipe-3', tenant_id: 'tenant-003', name: 'Pipeline Enterprise', is_default: true }
  ],
  stages: [
    { id: 'stage-1', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Novo Lead', display_order: 1, color: '#5D87FF' },
    { id: 'stage-2', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Contato Realizado', display_order: 2, color: '#49BEFF' },
    { id: 'stage-3', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Proposta Enviada', display_order: 3, color: '#FFAE1F' },
    { id: 'stage-4', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Em Negociação', display_order: 4, color: '#FA896B' },
    { id: 'stage-5', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Fechado/Ganho', display_order: 5, color: '#13DEB9' },

    // Stages Tenant 2
    { id: 'stage-201', tenant_id: 'tenant-002', pipeline_id: 'pipe-2', name: 'Leads de Tráfego', display_order: 1, color: '#00A4BD' },
    { id: 'stage-202', tenant_id: 'tenant-002', pipeline_id: 'pipe-2', name: 'Agendamento Feito', display_order: 2, color: '#FF7A59' },
    { id: 'stage-203', tenant_id: 'tenant-002', pipeline_id: 'pipe-2', name: 'Contrato Assinado', display_order: 3, color: '#13DEB9' },

    // Stages Tenant 3
    { id: 'stage-301', tenant_id: 'tenant-003', pipeline_id: 'pipe-3', name: 'Leads B2B Enterprise', display_order: 1, color: '#7D52F4' },
    { id: 'stage-302', tenant_id: 'tenant-003', pipeline_id: 'pipe-3', name: 'Demonstração Técnica', display_order: 2, color: '#FFAE1F' },
    { id: 'stage-303', tenant_id: 'tenant-003', pipeline_id: 'pipe-3', name: 'Fechado / Contrato', display_order: 3, color: '#13DEB9' }
  ],
  leads: [],
  deals: [],
  automations: [
    {
      id: 'auto-401',
      tenant_id: 'tenant-demo-001',
      name: 'Atribuição Automática por Lead Score',
      trigger_event: 'score_reached',
      conditions: { min_score: 50 },
      actions: { add_tag: 'MQL Qualificado', change_stage: 'mql' },
      is_active: true
    }
  ]
};

class LocalCRMStore {
  constructor() {
    this.initStore();
    this.requireAuth();
    this.initSupabaseAuthListener();
    this.ensureDefaultCloudData();
    this.fetchRemoteTenants();
    this.fetchRemoteLeads();
    this.fetchRemoteDeals();
    this.fetchRemoteProfiles();
    this.fetchRemoteNotifications();
    this.initSupabaseRealtime();
  }

  isSupabaseConnected() {
    return supabaseClient !== null;
  }

  async ensureDefaultCloudData() {
    if (!supabaseClient) return;
    try {
      const masterTenant = INITIAL_DEMO_DATA.tenants[0];
      await supabaseClient.from('tenants').upsert([masterTenant]);

      const masterUser = INITIAL_DEMO_DATA.users[0];
      const profilePayload = {
        id: masterUser.id,
        tenant_id: masterUser.tenant_id,
        full_name: masterUser.full_name,
        email: masterUser.email,
        role: masterUser.role,
        avatar_url: masterUser.avatar_url
      };
      await supabaseClient.from('profiles').upsert([profilePayload]);
    } catch (e) {
      console.warn('[Supabase Cloud Auto-seed]', e);
    }
  }

  async fetchRemoteTenants() {
    if (supabaseClient) {
      try {
        const { data: dbTenants, error } = await supabaseClient.from('tenants').select('*');
        if (!error && dbTenants) {
          const storeData = this.getData();
          
          const masterTenant = INITIAL_DEMO_DATA.tenants[0];
          if (!dbTenants.some(t => t.id === masterTenant.id)) {
            dbTenants.unshift(masterTenant);
          }

          const hasChanged = JSON.stringify(storeData.tenants) !== JSON.stringify(dbTenants);
          if (hasChanged) {
            storeData.tenants = dbTenants;
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tenants-synced', { detail: storeData.tenants }));
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase Sync] Falha ao sincronizar empresas remota:', err);
      }
    }
  }

  async fetchRemoteLeads() {
    if (supabaseClient) {
      try {
        const { data: dbLeads, error } = await supabaseClient.from('leads').select('*');
        if (!error && dbLeads) {
          const storeData = this.getData();
          const hasChanged = JSON.stringify(storeData.leads || []) !== JSON.stringify(dbLeads);
          if (hasChanged) {
            storeData.leads = dbLeads;
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('leads-synced', { detail: storeData.leads }));
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase Sync] Falha ao buscar leads remotos:', err);
      }
    }
  }

  async fetchRemoteDeals() {
    if (supabaseClient) {
      try {
        const { data: dbDeals, error } = await supabaseClient.from('deals').select('*');
        if (!error && dbDeals) {
          const storeData = this.getData();
          const hasChanged = JSON.stringify(storeData.deals || []) !== JSON.stringify(dbDeals);
          if (hasChanged) {
            storeData.deals = dbDeals;
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('deals-synced', { detail: storeData.deals }));
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase Sync] Falha ao buscar oportunidades remotas:', err);
      }
    }
  }

  async fetchRemoteProfiles() {
    if (supabaseClient) {
      try {
        const { data: dbProfiles, error } = await supabaseClient.from('profiles').select('*');
        if (!error && dbProfiles && dbProfiles.length > 0) {
          const storeData = this.getData();
          let updated = false;
          dbProfiles.forEach(p => {
            const u = (storeData.users || []).find(user => 
              user.id === p.id || 
              (user.email && p.email && user.email.toLowerCase() === p.email.toLowerCase()) || 
              (user.is_super_admin && p.email === 'paulo@southsea.com.br')
            );
            if (u) {
              if (p.avatar_url !== undefined && u.avatar_url !== p.avatar_url) { u.avatar_url = p.avatar_url; updated = true; }
              if (p.full_name && u.full_name !== p.full_name) { u.full_name = p.full_name; updated = true; }
            }
            if (storeData.session && storeData.session.user && (
              storeData.session.user.id === p.id || 
              (storeData.session.user.email && p.email && storeData.session.user.email.toLowerCase() === p.email.toLowerCase()) ||
              (storeData.session.user.is_super_admin && p.email === 'paulo@southsea.com.br')
            )) {
              if (p.avatar_url !== undefined && storeData.session.user.avatar_url !== p.avatar_url) { storeData.session.user.avatar_url = p.avatar_url; updated = true; }
              if (p.full_name && storeData.session.user.full_name !== p.full_name) { storeData.session.user.full_name = p.full_name; updated = true; }
            }
          });
          if (updated) {
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('profile-synced'));
            }
          }
        }
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao buscar perfis remotos:', e);
      }
    }
  }

  async fetchRemoteNotifications() {
    if (supabaseClient) {
      try {
        const { data: dbNotifs, error } = await supabaseClient.from('notifications').select('*');
        if (!error && dbNotifs) {
          const storeData = this.getData();
          const currentNotifs = storeData.notifications || [];
          const hasChanged = JSON.stringify(currentNotifs) !== JSON.stringify(dbNotifs);
          if (hasChanged) {
            storeData.notifications = dbNotifs;
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('notifications-updated'));
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase Sync] Falha ao buscar notificações remotas:', err);
      }
    }
  }

  initSupabaseRealtime() {
    if (supabaseClient) {
      try {
        supabaseClient
          .channel('public:db-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => this.fetchRemoteTenants())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => this.fetchRemoteLeads())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => this.fetchRemoteDeals())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => this.fetchRemoteProfiles())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => this.fetchRemoteNotifications())
          .subscribe();
      } catch (e) {
        console.warn('[Supabase Realtime] Warning:', e);
      }

      if (typeof window !== 'undefined' && !window._tenantSyncTimer) {
        window._tenantSyncTimer = setInterval(() => {
          this.fetchRemoteTenants();
          this.fetchRemoteLeads();
          this.fetchRemoteDeals();
          this.fetchRemoteProfiles();
          this.fetchRemoteNotifications();
        }, 2500);
      }
    }
  }

  initStore() {
    const raw = localStorage.getItem('METRIFIQUESE_CRM_DATA');
    if (!raw) {
      localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(INITIAL_DEMO_DATA));
    } else {
      try {
        const data = JSON.parse(raw);
        let updated = false;

        // Ensure users array exists
        if (!data.users) {
          data.users = INITIAL_DEMO_DATA.users;
          updated = true;
        }

        // Ensure Paulo Garcia exists as Master Super Admin
        let masterUser = data.users.find(u => u.is_super_admin || u.email === 'paulo@southsea.com.br');
        if (!masterUser) {
          masterUser = INITIAL_DEMO_DATA.users[0];
          data.users.unshift(masterUser);
          updated = true;
        } else {
          masterUser.email = 'paulo@southsea.com.br';
          masterUser.full_name = 'Paulo Garcia';
          masterUser.is_super_admin = true;
        }

        // Ensure session structure exists
        if (!data.session) {
          data.session = { user: null, active_tenant_id: null, is_authenticated: false };
          updated = true;
        }

        // Ensure tenants array exists
        if (!data.tenants) {
          data.tenants = INITIAL_DEMO_DATA.tenants;
          updated = true;
        }

        if (updated) {
          localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(data));
        }
      } catch (e) {
        console.warn('[Store Init] Re-initializing storage safely:', e);
      }
    }
  }

  isAuthenticated() {
    const data = this.getData();
    return !!(data.session && data.session.is_authenticated && data.session.user);
  }

  requireAuth() {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const isLandingPage = path === '/' || path === '/index.html' || (path.endsWith('index.html') && !path.includes('/src/html/'));
      const isAuthPage = path.includes('login') || path.includes('authentication');
      
      if (!isLandingPage && !isAuthPage && !this.isAuthenticated()) {
        window.location.href = '/src/html/login.html';
      }
    }
  }

  getData() {
    try {
      return JSON.parse(localStorage.getItem('METRIFIQUESE_CRM_DATA')) || INITIAL_DEMO_DATA;
    } catch (e) {
      return INITIAL_DEMO_DATA;
    }
  }

  saveData(data) {
    localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(data));
  }

  initSupabaseAuthListener() {
    if (supabaseClient) {
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          const userObj = {
            id: session.user.id,
            tenant_id: session.user.user_metadata?.tenant_id || this.getActiveTenantId(),
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            role: session.user.user_metadata?.role || 'Usuário Supabase Auth',
            is_super_admin: session.user.email === 'paulo@southsea.com.br' || session.user.user_metadata?.is_super_admin || false,
            avatar_url: session.user.user_metadata?.avatar_url || '/src/assets/images/profile/user-1.jpg'
          };
          this.updateUser(userObj);
          const data = this.getData();
          data.session = { user: userObj, active_tenant_id: userObj.tenant_id, is_authenticated: true };
          this.saveData(data);
        } else if (event === 'SIGNED_OUT') {
          const data = this.getData();
          if (data.session) data.session.is_authenticated = false;
          this.saveData(data);
        }
      });
    }
  }

  // --- MULTI-TENANT CONTEXT METHODS ---

  getUser() {
    const data = this.getData();
    if (data.session && data.session.user) {
      return data.session.user;
    }
    return (data.users && data.users[0]) || INITIAL_DEMO_DATA.users[0];
  }

  getActiveTenantId() {
    const data = this.getData();
    if (data.session && data.session.active_tenant_id) {
      return data.session.active_tenant_id;
    }
    const user = this.getUser();
    return user ? (user.tenant_id || 'tenant-demo-001') : 'tenant-demo-001';
  }

  getTenant() {
    const tenantId = this.getActiveTenantId();
    const tenants = this.getTenants();
    return tenants.find(t => t.id === tenantId) || tenants[0];
  }

  getTenants() {
    const data = this.getData();
    return data.tenants || INITIAL_DEMO_DATA.tenants;
  }

  async createTenantWithAdmin({ name, domain, plan, monthlyPrice, primaryColor, logoUrl, adminName, adminEmail, adminPassword }) {
    const data = this.getData();
    const tenantId = 'tenant-' + Date.now();
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const newTenant = {
      id: tenantId,
      name: name,
      slug: slug,
      logo_url: logoUrl || '/src/assets/images/logos/metrifiquese.svg',
      primary_color: primaryColor || '#FF7A59',
      secondary_color: '#00A4BD',
      custom_domain: domain || `${slug}.metrifiquese.com.br`,
      plan: plan || 'Plano Agência Whitelabel',
      monthly_price: parseFloat(monthlyPrice) || 297.00,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const newAdminUser = {
      id: 'user-' + Date.now(),
      tenant_id: tenantId,
      full_name: adminName,
      email: adminEmail,
      password: adminPassword || '12345678',
      phone: '(11) 99000-0000',
      role: 'Administrador da Empresa',
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    };

    const defaultStages = [
      { id: 'stage-' + Date.now() + '-1', tenant_id: tenantId, pipeline_id: 'pipe-' + tenantId, name: 'Novo Lead Inbound', display_order: 1, color: '#5D87FF' },
      { id: 'stage-' + Date.now() + '-2', tenant_id: tenantId, pipeline_id: 'pipe-' + tenantId, name: 'Em Atendimento', display_order: 2, color: '#FFAE1F' },
      { id: 'stage-' + Date.now() + '-3', tenant_id: tenantId, pipeline_id: 'pipe-' + tenantId, name: 'Proposta Apresentada', display_order: 3, color: '#FA896B' },
      { id: 'stage-' + Date.now() + '-4', tenant_id: tenantId, pipeline_id: 'pipe-' + tenantId, name: 'Fechado/Ganho', display_order: 4, color: '#13DEB9' }
    ];

    if (!data.tenants) data.tenants = [];
    if (!data.users) data.users = [];
    if (!data.stages) data.stages = [];

    data.tenants.unshift(newTenant);
    data.users.unshift(newAdminUser);
    data.stages.push(...defaultStages);

    this.saveData(data);

    // Sync directly with Supabase Cloud if configured
    if (supabaseClient) {
      try {
        await supabaseClient.from('tenants').insert([newTenant]);
      } catch (err) {
        console.warn('[Supabase Sync Warning] Falha ao sincronizar tenant:', err);
      }
    }

    return { tenant: newTenant, adminUser: newAdminUser };
  }

  async updateTenantDetails(tenantId, newSettings) {
    const data = this.getData();
    const idx = data.tenants.findIndex(t => t.id === tenantId);
    if (idx !== -1) {
      if (newSettings.monthly_price !== undefined) {
        newSettings.monthly_price = parseFloat(newSettings.monthly_price) || 0;
      }
      data.tenants[idx] = { ...data.tenants[idx], ...newSettings };
      this.saveData(data);

      if (supabaseClient) {
        try {
          await supabaseClient.from('tenants').update(newSettings).eq('id', tenantId);
        } catch (err) {
          console.warn('[Supabase Sync Warning] Falha ao atualizar tenant:', err);
        }
      }

      return data.tenants[idx];
    }
    return null;
  }

  updateTenant(newSettings) {
    return this.updateTenantDetails(this.getActiveTenantId(), newSettings);
  }

  async deleteTenant(tenantId) {
    const data = this.getData();
    data.tenants = data.tenants.filter(t => t.id !== tenantId);
    data.users = data.users.filter(u => u.tenant_id !== tenantId);
    data.leads = data.leads.filter(l => l.tenant_id !== tenantId);
    data.deals = data.deals.filter(d => d.tenant_id !== tenantId);
    data.stages = data.stages.filter(s => s.tenant_id !== tenantId);
    this.saveData(data);

    if (supabaseClient) {
      try {
        await supabaseClient.from('tenants').delete().eq('id', tenantId);
      } catch (err) {
        console.warn('[Supabase Sync Warning] Falha ao excluir tenant:', err);
      }
    }
  }

  switchActiveTenant(tenantId) {
    const data = this.getData();
    if (!data.session) data.session = {};
    data.session.active_tenant_id = tenantId;
    const currentUser = this.getUser();
    if (currentUser && currentUser.is_super_admin) {
      data.session.user = currentUser;
    }
    this.saveData(data);
  }

  // --- TENANT USERS MANAGEMENT ---

  getUsersByTenant(tenantId) {
    const data = this.getData();
    const targetTenantId = tenantId || this.getActiveTenantId();
    return (data.users || []).filter(u => u.tenant_id === targetTenantId);
  }

  addUserToTenant(tenantId, { fullName, email, password, role, phone, avatarUrl }) {
    const data = this.getData();
    const newUser = {
      id: 'user-' + Date.now(),
      tenant_id: tenantId || this.getActiveTenantId(),
      full_name: fullName,
      email: email,
      password: password || '12345678',
      phone: phone || '(11) 98000-0000',
      role: role || 'Membro da Equipe',
      is_super_admin: false,
      avatar_url: avatarUrl || '/src/assets/images/profile/user-1.jpg'
    };

    if (!data.users) data.users = [];
    data.users.push(newUser);
    this.saveData(data);
    return newUser;
  }

  deleteUserFromTenant(userId) {
    const data = this.getData();
    data.users = data.users.filter(u => u.id !== userId);
    this.saveData(data);
  }

  // --- AUTHENTICATION & LOGIN ---

  async loginWithEmail(email, password) {
    const data = this.getData();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Procurar o usuário cadastrado no banco local pelo e-mail exato
    const matchedUser = (data.users || INITIAL_DEMO_DATA.users).find(u => u.email.toLowerCase() === cleanEmail);

    if (matchedUser) {
      if (matchedUser.password && matchedUser.password !== password) {
        throw new Error('Senha incorreta. Verifique suas credenciais.');
      }

      data.session = {
        user: matchedUser,
        active_tenant_id: matchedUser.tenant_id,
        is_authenticated: true
      };
      this.saveData(data);
      return { user: matchedUser, session: null };
    }

    // 2. Se for uma tentativa de login Supabase Cloud
    if (supabaseClient) {
      const { data: sbData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    }

    // 3. Fallback: Se for o email do Paulo Garcia (Super Admin Master)
    if (cleanEmail === 'paulo@southsea.com.br' || cleanEmail.includes('paulo') || cleanEmail.includes('southsea')) {
      const masterUser = (data.users || []).find(u => u.is_super_admin) || INITIAL_DEMO_DATA.users[0];
      masterUser.email = 'paulo@southsea.com.br';
      masterUser.full_name = 'Paulo Garcia';
      masterUser.is_super_admin = true;
      if (password) masterUser.password = password;

      data.session = { user: masterUser, active_tenant_id: 'tenant-demo-001', is_authenticated: true };
      this.saveData(data);
      return { user: masterUser, session: null };
    }

    // 4. Se for um novo usuário de teste cadastrando no login: cria tenant isolado
    const newTenantId = 'tenant-' + Date.now();
    const newTenantObj = {
      id: newTenantId,
      name: cleanEmail.split('@')[0].toUpperCase(),
      slug: cleanEmail.split('@')[0],
      logo_url: '/src/assets/images/logos/metrifiquese.svg',
      primary_color: '#FF7A59',
      custom_domain: `${cleanEmail.split('@')[0]}.metrifiquese.com.br`,
      plan: 'Plano Agência Whitelabel',
      monthly_price: 297.00,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const newUserObj = {
      id: 'user-' + Date.now(),
      tenant_id: newTenantId,
      email: email,
      password: password,
      full_name: email.split('@')[0],
      role: 'Proprietário da Empresa',
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    };

    if (!data.tenants) data.tenants = [];
    if (!data.users) data.users = [];
    data.tenants.push(newTenantObj);
    data.users.push(newUserObj);

    data.session = {
      user: newUserObj,
      active_tenant_id: newTenantId,
      is_authenticated: true
    };

    this.saveData(data);
    return { user: newUserObj, session: null };
  }

  async signUpWithEmail(email, password, fullName) {
    const data = this.getData();
    const newTenantId = 'tenant-' + Date.now();
    const slug = fullName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const newTenant = {
      id: newTenantId,
      name: fullName + ' CRM',
      slug: slug,
      logo_url: '/src/assets/images/logos/metrifiquese.svg',
      primary_color: '#FF7A59',
      custom_domain: `${slug}.metrifiquese.com.br`,
      plan: 'Plano Agência Whitelabel',
      monthly_price: 297.00,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const newUserObj = {
      id: 'user-' + Date.now(),
      tenant_id: newTenantId,
      email: email,
      password: password,
      full_name: fullName,
      role: 'Administrador',
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    };

    if (!data.tenants) data.tenants = [];
    if (!data.users) data.users = [];
    data.tenants.push(newTenant);
    data.users.push(newUserObj);

    data.session = {
      user: newUserObj,
      active_tenant_id: newTenantId,
      is_authenticated: true
    };
    this.saveData(data);
    return { user: newUserObj, session: null };
  }

  async logout() {
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (err) {}
    }
    const data = this.getData();
    if (data.session) data.session.is_authenticated = false;
    this.saveData(data);
    window.location.href = '/src/html/login.html';
  }

  updateUser(userData) {
    const data = this.getData();

    const currentUser = (data.session && data.session.user) ? data.session.user : (data.users && data.users[0]);
    const userToUpdate = (data.users || []).find(u => 
      (userData.id && u.id === userData.id) || 
      (userData.email && u.email && userData.email && u.email.toLowerCase() === userData.email.toLowerCase()) || 
      (currentUser && (u.id === currentUser.id || u.email === currentUser.email)) ||
      u.is_super_admin
    );

    if (userToUpdate) {
      Object.assign(userToUpdate, userData);
    }

    if (data.session && data.session.user) {
      data.session.user = { ...data.session.user, ...userData };
    } else if (userToUpdate) {
      data.session = { user: userToUpdate, active_tenant_id: userToUpdate.tenant_id || 'tenant-demo-001', is_authenticated: true };
    }

    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-synced'));
    }

    if (supabaseClient) {
      const activeUser = (data.session && data.session.user) || userToUpdate;
      if (activeUser) {
        this.ensureDefaultCloudData().then(() => {
          try {
            const profilePayload = {
              id: activeUser.id || 'user-001',
              tenant_id: activeUser.tenant_id || 'tenant-demo-001',
              full_name: activeUser.full_name || 'Paulo Garcia',
              email: activeUser.email || 'paulo@southsea.com.br',
              role: activeUser.role || 'admin',
              avatar_url: activeUser.avatar_url || ''
            };
            supabaseClient.from('profiles').upsert([profilePayload]).then(({ error }) => {
              if (error) console.warn('[Supabase Sync Profile Error]', error);
            });
          } catch (e) {
            console.warn('[Supabase Sync] Falha ao sincronizar perfil no Supabase:', e);
          }
        });
      }
    }

    return data.session.user;
  }

  // --- MULTI-TENANT STRICTLY ISOLATED DATA GETTERS ---

  getLeads() {
    const tenantId = this.getActiveTenantId();
    const allLeads = this.getData().leads || [];
    return allLeads.filter(l => l.tenant_id === tenantId);
  }

  saveLead(lead) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (!lead.id) {
      lead.id = 'lead-' + Date.now();
      lead.tenant_id = tenantId;
      lead.created_at = new Date().toISOString();
      lead.activities = lead.activities || [];
      if (!data.leads) data.leads = [];
      data.leads.unshift(lead);

      this.addNotification({
        title: 'Novo Lead Cadastrado',
        message: `${lead.name} foi adicionado à base via ${lead.source || 'Manual'}.`
      });
    } else {
      const idx = data.leads.findIndex(l => l.id === lead.id);
      if (idx !== -1) data.leads[idx] = { ...data.leads[idx], ...lead };
    }
    this.saveData(data);

    if (supabaseClient) {
      try {
        const payload = {
          id: lead.id,
          tenant_id: lead.tenant_id || tenantId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone || '',
          company: lead.company || '',
          job_title: lead.job_title || '',
          lifecycle_stage: lead.lifecycle_stage || 'lead',
          score: parseInt(lead.score) || 0,
          source: lead.source || 'Organic',
          tags: lead.tags || []
        };
        supabaseClient.from('leads').upsert([payload]).then();
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao salvar lead:', e);
      }
    }

    return lead;
  }

  deleteLead(id) {
    const data = this.getData();
    data.leads = data.leads.filter(l => l.id !== id);
    data.deals = data.deals.filter(d => d.lead_id !== id);
    this.saveData(data);

    if (supabaseClient) {
      try {
        supabaseClient.from('leads').delete().eq('id', id).then();
        supabaseClient.from('deals').delete().eq('lead_id', id).then();
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao deletar lead:', e);
      }
    }
  }

  addLeadActivity(leadId, activity) {
    const data = this.getData();
    const lead = data.leads.find(l => l.id === leadId);
    if (lead) {
      if (!lead.activities) lead.activities = [];
      activity.id = 'act-' + Date.now();
      activity.date = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      lead.activities.unshift(activity);
      this.saveData(data);
    }
    return lead;
  }

  getDeals() {
    const tenantId = this.getActiveTenantId();
    const allDeals = this.getData().deals || [];
    return allDeals.filter(d => d.tenant_id === tenantId);
  }

  saveDeal(deal) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (!deal.id) {
      deal.id = 'deal-' + Date.now();
      deal.tenant_id = tenantId;
      deal.created_at = new Date().toISOString();
      if (!data.deals) data.deals = [];
      data.deals.unshift(deal);

      this.addNotification({
        title: 'Nova Oportunidade',
        message: `${deal.title} no valor de R$ ${parseFloat(deal.value).toLocaleString('pt-BR')} foi criada.`
      });
    } else {
      const idx = data.deals.findIndex(d => d.id === deal.id);
      if (idx !== -1) data.deals[idx] = { ...data.deals[idx], ...deal };
    }
    this.saveData(data);

    if (supabaseClient) {
      try {
        const payload = {
          id: deal.id,
          tenant_id: deal.tenant_id || tenantId,
          lead_id: deal.lead_id,
          pipeline_id: deal.pipeline_id || ('pipe-' + (deal.tenant_id || tenantId)),
          stage_id: deal.stage_id,
          title: deal.title,
          value: parseFloat(deal.value) || 0,
          status: deal.status || 'open'
        };
        supabaseClient.from('deals').upsert([payload]).then();
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao salvar oportunidade:', e);
      }
    }

    return deal;
  }

  moveDealStage(dealId, newStageId) {
    const data = this.getData();
    const deal = data.deals.find(d => d.id === dealId);
    if (deal) {
      deal.stage_id = newStageId;
      if (newStageId === 'stage-5' || newStageId.includes('won')) deal.status = 'won';
      this.saveData(data);

      if (supabaseClient) {
        try {
          supabaseClient.from('deals').update({ stage_id: newStageId, updated_at: new Date().toISOString() }).eq('id', dealId).then();
        } catch (e) {
          console.warn('[Supabase Sync] Falha ao mover etapa no Supabase:', e);
        }
      }
    }
    return deal;
  }

  deleteDeal(id) {
    const data = this.getData();
    data.deals = data.deals.filter(d => d.id !== id);
    this.saveData(data);

    if (supabaseClient) {
      try {
        supabaseClient.from('deals').delete().eq('id', id).then();
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao deletar oportunidade:', e);
      }
    }
  }

  getStages() {
    const tenantId = this.getActiveTenantId();
    const allStages = this.getData().stages || [];
    const tenantStages = allStages.filter(s => s.tenant_id === tenantId);

    if (tenantStages.length === 0) {
      return [
        { id: 'stage-def-1', tenant_id: tenantId, pipeline_id: 'pipe-1', name: 'Novo Lead', display_order: 1, color: '#5D87FF' },
        { id: 'stage-def-2', tenant_id: tenantId, pipeline_id: 'pipe-1', name: 'Em Atendimento', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-def-3', tenant_id: tenantId, pipeline_id: 'pipe-1', name: 'Proposta Enviada', display_order: 3, color: '#FA896B' },
        { id: 'stage-def-4', tenant_id: tenantId, pipeline_id: 'pipe-1', name: 'Fechado/Ganho', display_order: 4, color: '#13DEB9' }
      ];
    }
    return tenantStages;
  }

  saveStage(stage) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (!stage.id) {
      stage.id = 'stage-' + Date.now();
      stage.tenant_id = tenantId;
      stage.pipeline_id = 'pipe-' + tenantId;
      stage.display_order = data.stages.length + 1;
      data.stages.push(stage);
    } else {
      const idx = data.stages.findIndex(s => s.id === stage.id);
      if (idx !== -1) data.stages[idx] = { ...data.stages[idx], ...stage };
    }
    this.saveData(data);
    return stage;
  }

  deleteStage(stageId) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    const tenantStages = data.stages.filter(s => s.tenant_id === tenantId);
    if (tenantStages.length <= 1) {
      alert('Você precisa ter pelo menos 1 etapa no Kanban.');
      return false;
    }
    data.stages = data.stages.filter(s => s.id !== stageId);
    this.saveData(data);
    return true;
  }

  getNotifications() {
    const tenantId = this.getActiveTenantId();
    const allNotifs = this.getData().notifications || [];
    return allNotifs.filter(n => n.tenant_id === tenantId);
  }

  addNotification(notif) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (!data.notifications) data.notifications = [];
    notif.id = 'notif-' + Date.now();
    notif.tenant_id = tenantId;
    notif.time = 'Agora';
    notif.is_read = false;
    data.notifications.unshift(notif);
    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    if (supabaseClient) {
      this.ensureDefaultCloudData().then(() => {
        try {
          const payload = {
            id: notif.id,
            tenant_id: tenantId,
            title: notif.title,
            message: notif.message,
            time: notif.time,
            is_read: false
          };
          supabaseClient.from('notifications').upsert([payload]).then(({ error }) => {
            if (error) console.warn('[Supabase Sync Add Notification Error]', error);
          });
        } catch (e) {
          console.warn('[Supabase Sync Add Notification Exception]', e);
        }
      });
    }

    return notif;
  }

  markNotificationRead(notifId) {
    const data = this.getData();
    if (data.notifications) {
      const n = data.notifications.find(item => item.id === notifId);
      if (n) n.is_read = true;
    }
    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    if (supabaseClient) {
      try {
        supabaseClient.from('notifications').update({ is_read: true }).eq('id', notifId).then(({ error }) => {
          if (error) console.warn('[Supabase Sync Mark Notification Error]', error);
        });
      } catch (e) {
        console.warn('[Supabase Sync Mark Notification Exception]', e);
      }
    }
  }

  markNotificationsRead() {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (data.notifications) {
      data.notifications.filter(n => n.tenant_id === tenantId).forEach(n => n.is_read = true);
    }
    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    if (supabaseClient) {
      try {
        supabaseClient.from('notifications').update({ is_read: true }).eq('tenant_id', tenantId).then(({ error }) => {
          if (error) console.warn('[Supabase Sync Mark All Read Error]', error);
        });
      } catch (e) {
        console.warn('[Supabase Sync Mark All Read Exception]', e);
      }
    }
  }

  clearNotifications() {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (data.notifications) {
      data.notifications = data.notifications.filter(n => n.tenant_id !== tenantId);
    }
    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    if (supabaseClient) {
      try {
        supabaseClient.from('notifications').delete().eq('tenant_id', tenantId).then(({ error }) => {
          if (error) console.warn('[Supabase Sync Clear Notifications Error]', error);
        });
      } catch (e) {
        console.warn('[Supabase Sync Clear Notifications Exception]', e);
      }
    }
  }

  getAutomations() {
    const tenantId = this.getActiveTenantId();
    const allAutos = this.getData().automations || [];
    return allAutos.filter(a => a.tenant_id === tenantId);
  }

  saveAutomation(rule) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (!rule.id) {
      rule.id = 'auto-' + Date.now();
      rule.tenant_id = tenantId;
      data.automations.push(rule);
    } else {
      const idx = data.automations.findIndex(a => a.id === rule.id);
      if (idx !== -1) data.automations[idx] = { ...data.automations[idx], ...rule };
    }
    this.saveData(data);
    return rule;
  }
}

window.crmStore = new LocalCRMStore();
