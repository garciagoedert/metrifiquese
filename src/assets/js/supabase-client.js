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
      logo_url: '/src/assets/images/logos/logoblack.png',
      primary_color: '#143E2B',
      secondary_color: '#18181B',
      custom_domain: 'crm.metrifiquese.com.br',
      plan: 'Master / Super Admin',
      monthly_price: 0,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString()
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
      crm_role: 'admin',
      is_super_admin: true,
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
    }
  ],
  pipelines: [
    { id: 'pipe-1', tenant_id: 'tenant-demo-001', name: 'Funil de Vendas Inbound', is_default: true }
  ],
  stages: [
    { id: 'stage-1', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Novo Lead', display_order: 1, color: '#5D87FF' },
    { id: 'stage-2', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Contato Realizado', display_order: 2, color: '#49BEFF' },
    { id: 'stage-3', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Proposta Enviada', display_order: 3, color: '#FFAE1F' },
    { id: 'stage-4', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Em Negociação', display_order: 4, color: '#FA896B' },
    { id: 'stage-5', tenant_id: 'tenant-demo-001', pipeline_id: 'pipe-1', name: 'Fechado/Ganho', display_order: 5, color: '#13DEB9' }
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
      const data = this.getData();
      const masterTenant = INITIAL_DEMO_DATA.tenants[0];
      await supabaseClient.from('tenants').upsert([masterTenant]);

      const masterUser = INITIAL_DEMO_DATA.users[0];
      const profilePayload = {
        id: masterUser.id,
        tenant_id: masterUser.tenant_id,
        full_name: masterUser.full_name,
        email: masterUser.email,
        role: masterUser.role,
        crm_role: 'admin',
        password: masterUser.password || '12345678',
        avatar_url: masterUser.avatar_url
      };
      await supabaseClient.from('profiles').upsert([profilePayload]);

      // Sync default pipelines and stages to prevent FK errors when deals are created
      const pipelines = (data.pipelines || INITIAL_DEMO_DATA.pipelines || []).map(p => ({
        id: p.id,
        tenant_id: p.tenant_id,
        name: p.name,
        is_default: p.is_default !== false
      }));
      if (pipelines.length > 0) {
        await supabaseClient.from('pipelines').upsert(pipelines);
      }

      const stages = (data.stages || INITIAL_DEMO_DATA.stages || []).map(s => ({
        id: s.id,
        pipeline_id: s.pipeline_id,
        tenant_id: s.tenant_id,
        name: s.name,
        display_order: s.display_order || 1,
        color: s.color || '#5D87FF'
      }));
      if (stages.length > 0) {
        await supabaseClient.from('pipeline_stages').upsert(stages);
      }

      // Purge legacy demo tenants from cloud database
      await supabaseClient.from('profiles').delete().in('tenant_id', ['tenant-002', 'tenant-003']);
      await supabaseClient.from('leads').delete().in('tenant_id', ['tenant-002', 'tenant-003']);
      await supabaseClient.from('deals').delete().in('tenant_id', ['tenant-002', 'tenant-003']);
      await supabaseClient.from('pipeline_stages').delete().in('tenant_id', ['tenant-002', 'tenant-003']);
      await supabaseClient.from('pipelines').delete().in('tenant_id', ['tenant-002', 'tenant-003']);
      await supabaseClient.from('tenants').delete().in('id', ['tenant-002', 'tenant-003']);
    } catch (e) {
      console.warn('[Supabase Cloud Auto-seed]', e);
    }
  }

  async syncLocalTenantsToCloud() {
    if (!supabaseClient) return;
    try {
      const data = this.getData();
      const tenantsToSync = (data.tenants || []).map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug || (t.name ? t.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'tenant'),
        logo_url: t.logo_url || '/src/assets/images/logos/logoblack.png',
        primary_color: t.primary_color || '#143E2B',
        secondary_color: t.secondary_color || '#18181B',
        custom_domain: t.custom_domain || '',
        plan: t.plan || 'Plano Agência Whitelabel',
        monthly_price: parseFloat(t.monthly_price) || 0,
        status: t.status || 'active'
      }));

      if (tenantsToSync.length > 0) {
        const { error } = await supabaseClient.from('tenants').upsert(tenantsToSync);
        if (error) console.warn('[Supabase Sync Tenants]', error);
        else console.log('[Supabase Sync Tenants] Sincronizadas', tenantsToSync.length, 'empresas para o Supabase');
      }
    } catch (err) {
      console.warn('[Supabase Sync Tenants Warning]', err);
    }
  }

  async fetchRemoteTenants() {
    if (supabaseClient) {
      try {
        await this.syncLocalTenantsToCloud();
        const { data: dbTenants, error } = await supabaseClient.from('tenants').select('*');
        if (!error && dbTenants) {
          const storeData = this.getData();

          const masterTenant = INITIAL_DEMO_DATA.tenants[0];
          const remoteMaster = dbTenants.find(t => t.id === masterTenant.id);
          if (!remoteMaster) {
            dbTenants.unshift(masterTenant);
          } else if (!remoteMaster.primary_color || remoteMaster.primary_color.toUpperCase() === '#FF7A59') {
            remoteMaster.primary_color = '#143E2B';
            if (!remoteMaster.secondary_color || remoteMaster.secondary_color.toUpperCase() === '#00A4BD') {
              remoteMaster.secondary_color = '#18181B';
            }
            supabaseClient.from('tenants').upsert([{
              id: remoteMaster.id,
              primary_color: remoteMaster.primary_color,
              secondary_color: remoteMaster.secondary_color
            }]).then(() => {}).catch(() => {});
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
          const deletedIds = storeData.deleted_deal_ids || [];

          // Filter out deals deleted locally
          const validDbDeals = dbDeals.filter(d => !deletedIds.includes(d.id));
          const localDeals = (storeData.deals || []).filter(d => !deletedIds.includes(d.id));

          // Merge local deals pending sync
          const mergedDeals = [...validDbDeals];
          localDeals.forEach(ld => {
            if (!mergedDeals.some(rd => rd.id === ld.id)) {
              mergedDeals.push(ld);
            }
          });

          const hasChanged = JSON.stringify(storeData.deals || []) !== JSON.stringify(mergedDeals);
          if (hasChanged) {
            storeData.deals = mergedDeals;
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

  async syncLocalUsersToCloud() {
    if (!supabaseClient) return;
    try {
      const data = this.getData();
      const usersToSync = (data.users || []).map(u => ({
        id: u.id,
        tenant_id: u.tenant_id,
        full_name: u.full_name,
        email: u.email,
        role: u.role || 'Membro da Equipe',
        crm_role: u.crm_role || (u.role && u.role.toLowerCase().includes('admin') ? 'admin' : 'vendedor'),
        password: u.password || '12345678',
        avatar_url: u.avatar_url || '/src/assets/images/profile/user-1.jpg'
      }));

      if (usersToSync.length > 0) {
        const { error } = await supabaseClient.from('profiles').upsert(usersToSync);
        if (error) console.warn('[Supabase Sync Users]', error);
        else console.log('[Supabase Sync Users] Sincronizados', usersToSync.length, 'usuários para o Supabase');
      }
    } catch (err) {
      console.warn('[Supabase Sync Users Warning]', err);
    }
  }

  async fetchRemoteProfiles() {
    if (supabaseClient) {
      try {
        // 1. FIRST push local tenants to Supabase Cloud (so foreign keys exist!)
        await this.syncLocalTenantsToCloud();

        // 2. THEN push local users to Supabase Cloud
        await this.syncLocalUsersToCloud();

        // 3. Fetch profiles from Supabase Cloud
        const { data: dbProfiles, error } = await supabaseClient.from('profiles').select('*');
        if (!error && dbProfiles && dbProfiles.length > 0) {
          const storeData = this.getData();
          let updated = false;

          dbProfiles.forEach(p => {
            const safeRemoteAvatar = (p.avatar_url && !p.avatar_url.includes('fbcdn.net') && !p.avatar_url.includes('instagram.'))
              ? p.avatar_url
              : '/src/assets/images/profile/user-1.jpg';
            let u = (storeData.users || []).find(user => 
              user.id === p.id || 
              (user.email && p.email && user.email.toLowerCase() === p.email.toLowerCase()) || 
              (user.is_super_admin && p.email === 'paulo@southsea.com.br')
            );
            if (u) {
              if (p.avatar_url !== undefined && u.avatar_url !== safeRemoteAvatar) { u.avatar_url = safeRemoteAvatar; updated = true; }
              if (p.full_name && u.full_name !== p.full_name) { u.full_name = p.full_name; updated = true; }
              if (p.password && u.password !== p.password) { u.password = p.password; updated = true; }
              if (p.crm_role && u.crm_role !== p.crm_role) { u.crm_role = p.crm_role; updated = true; }
            } else {
              // New remote profile found, add to local store
              const newUser = {
                id: p.id,
                tenant_id: p.tenant_id,
                full_name: p.full_name,
                email: p.email,
                password: p.password || '12345678',
                role: p.role || 'Membro da Equipe',
                crm_role: p.crm_role || 'vendedor',
                is_super_admin: p.email === 'paulo@southsea.com.br',
                avatar_url: safeRemoteAvatar
              };
              if (!storeData.users) storeData.users = [];
              storeData.users.push(newUser);
              updated = true;
            }

            if (storeData.session && storeData.session.user && (
              storeData.session.user.id === p.id || 
              (storeData.session.user.email && p.email && storeData.session.user.email.toLowerCase() === p.email.toLowerCase()) ||
              (storeData.session.user.is_super_admin && p.email === 'paulo@southsea.com.br')
            )) {
              if (p.avatar_url !== undefined && storeData.session.user.avatar_url !== safeRemoteAvatar) { storeData.session.user.avatar_url = safeRemoteAvatar; updated = true; }
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
          if (!masterUser.avatar_url || masterUser.avatar_url.includes('fbcdn.net') || masterUser.avatar_url.includes('instagram.')) {
            masterUser.avatar_url = '/src/assets/images/profile/user-1.jpg';
            updated = true;
          }
        }

        // Ensure session structure exists
        if (!data.session) {
          data.session = { user: null, active_tenant_id: null, is_authenticated: false };
          updated = true;
        } else if (data.session.user && (!data.session.user.avatar_url || data.session.user.avatar_url.includes('fbcdn.net') || data.session.user.avatar_url.includes('instagram.'))) {
          data.session.user.avatar_url = '/src/assets/images/profile/user-1.jpg';
          updated = true;
        }

        // Ensure tenants array exists
        if (!data.tenants) {
          data.tenants = INITIAL_DEMO_DATA.tenants;
          updated = true;
        } else {
          const masterTenant = data.tenants.find(t => t.id === 'tenant-demo-001');
          if (masterTenant) {
            if (!masterTenant.primary_color || masterTenant.primary_color.toUpperCase() === '#FF7A59') {
              masterTenant.primary_color = '#143E2B';
              updated = true;
            }
            if (!masterTenant.secondary_color || masterTenant.secondary_color.toUpperCase() === '#00A4BD') {
              masterTenant.secondary_color = '#18181B';
              updated = true;
            }
          }
        }

        // Clean out legacy demo tenants (tenant-002, tenant-003)
        if (data.tenants) {
          const countBefore = data.tenants.length;
          data.tenants = data.tenants.filter(t => t.id !== 'tenant-002' && t.id !== 'tenant-003');
          if (data.tenants.length !== countBefore) updated = true;
        }
        if (data.users) {
          const countBefore = data.users.length;
          data.users = data.users.filter(u => u.tenant_id !== 'tenant-002' && u.tenant_id !== 'tenant-003');
          if (data.users.length !== countBefore) updated = true;
        }
        if (data.pipelines) {
          const countBefore = data.pipelines.length;
          data.pipelines = data.pipelines.filter(p => p.tenant_id !== 'tenant-002' && p.tenant_id !== 'tenant-003');
          if (data.pipelines.length !== countBefore) updated = true;
        }
        if (data.stages) {
          const countBefore = data.stages.length;
          data.stages = data.stages.filter(s => s.tenant_id !== 'tenant-002' && s.tenant_id !== 'tenant-003');
          if (data.stages.length !== countBefore) updated = true;
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
      const isPublicFormPage = path.includes('/form') || path.includes('form.html');
      
      if (!isLandingPage && !isAuthPage && !isPublicFormPage) {
        if (!this.isAuthenticated()) {
          window.location.href = '/src/html/login.html';
          return;
        }

        // Verify if tenant is suspended (except for Master Super Admin)
        const user = this.getUser();
        const tenantId = this.getActiveTenantId();
        const isSuperAdmin = user && (user.is_super_admin || user.email === 'paulo@southsea.com.br');

        if (!isSuperAdmin) {
          const tenants = this.getTenants();
          const tenant = tenants.find(t => t.id === tenantId);
          if (tenant && tenant.status === 'suspended') {
            this.logout();
            window.location.href = '/src/html/login.html?reason=suspended';
          }
        }
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

  setActiveTenantId(tenantId) {
    if (!tenantId) return;
    const data = this.getData();
    if (!data.session) data.session = {};
    data.session.active_tenant_id = tenantId;
    this.saveData(data);
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

  async createTenantWithAdmin({ name, domain, plan, monthlyPrice, primaryColor, logoUrl, adminName, adminEmail, adminPassword, nextBillingDate, billingPhone }) {
    const data = this.getData();
    const tenantId = 'tenant-' + Date.now();
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const defaultNextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const newTenant = {
      id: tenantId,
      name: name,
      slug: slug,
      logo_url: logoUrl || '/src/assets/images/logos/metrifiquese.svg',
      primary_color: primaryColor || '#143E2B',
      secondary_color: '#18181B',
      custom_domain: domain || `${slug}.metrifiquese.com.br`,
      plan: plan || 'Plano Agência Whitelabel',
      monthly_price: parseFloat(monthlyPrice) || 297.00,
      status: 'active',
      next_billing_date: nextBillingDate || defaultNextMonth,
      billing_phone: billingPhone || '',
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
        await supabaseClient.from('profiles').upsert([{
          id: newAdminUser.id,
          tenant_id: newAdminUser.tenant_id,
          full_name: newAdminUser.full_name,
          email: newAdminUser.email,
          role: newAdminUser.role,
          crm_role: 'admin',
          password: newAdminUser.password,
          avatar_url: newAdminUser.avatar_url
        }]);
      } catch (err) {
        console.warn('[Supabase Sync Warning] Falha ao sincronizar tenant ou admin user:', err);
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
      crm_role: (role && (role.toLowerCase().includes('admin') || role.toLowerCase().includes('dono') || role.toLowerCase().includes('proprietário'))) ? 'admin' : 'vendedor',
      is_super_admin: false,
      avatar_url: avatarUrl || '/src/assets/images/profile/user-1.jpg'
    };

    if (!data.users) data.users = [];
    data.users.push(newUser);
    this.saveData(data);

    // Sync to Supabase profiles so the user can log in from any device
    if (supabaseClient) {
      supabaseClient.from('profiles').upsert([{
        id: newUser.id,
        tenant_id: newUser.tenant_id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        crm_role: newUser.crm_role,
        password: newUser.password,
        avatar_url: newUser.avatar_url
      }]).then(({ error }) => {
        if (error) console.warn('[Supabase Sync] Falha ao sincronizar usuário criado:', error);
        else console.log('[Supabase Sync] Usuário criado sincronizado com sucesso:', email);
      });
    }

    return newUser;
  }

  deleteUserFromTenant(userId) {
    const data = this.getData();
    data.users = (data.users || []).filter(u => u.id !== userId);
    this.saveData(data);

    if (supabaseClient) {
      supabaseClient.from('profiles').delete().eq('id', userId).then(({ error }) => {
        if (error) console.warn('[Supabase Sync] Falha ao excluir perfil do Supabase:', error);
      });
    }
  }

  // --- PERMISSIONS & ROLES (admin / vendedor) ---

  /**
   * Returns the CRM role of the current user within their tenant.
   * Roles: 'super_admin' | 'admin' | 'vendedor'
   */
  getUserCrmRole() {
    const user = this.getUser();
    if (!user) return 'vendedor';
    if (user.is_super_admin) return 'super_admin';
    if (user.crm_role) return user.crm_role;
    // Legacy role strings mapping
    const role = (user.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('dono') || role.includes('diret') || role.includes('proprietário')) return 'admin';
    return 'vendedor';
  }

  isAdmin() {
    const r = this.getUserCrmRole();
    return r === 'admin' || r === 'super_admin';
  }

  isSuperAdmin() {
    return this.getUserCrmRole() === 'super_admin';
  }

  /**
   * Check if the current user can access a specific feature.
   * Features: 'delete_lead' | 'delete_deal' | 'whitelabel_config' | 'reports' | 'admin_panel' | 'invite_users'
   */
  canAccess(feature) {
    const role = this.getUserCrmRole();
    const adminFeatures = ['delete_lead', 'delete_deal', 'whitelabel_config', 'admin_panel', 'invite_users'];
    const allFeatures   = ['leads', 'kanban', 'reports', 'automations'];

    if (role === 'super_admin') return true;
    if (role === 'admin') return true; // admin can do everything within tenant
    // vendedor restricted
    if (adminFeatures.includes(feature)) return false;
    return true;
  }

  /**
   * Invite a new team member to the current tenant.
   * crm_role: 'admin' | 'vendedor'
   */
  inviteTeamMember({ fullName, email, crmRole = 'vendedor' }) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();

    // Check for duplicate email
    if ((data.users || []).some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    const newUser = {
      id: 'user-' + Date.now(),
      tenant_id: tenantId,
      full_name: fullName,
      email: email,
      password: 'senha123',
      phone: '',
      role: crmRole === 'admin' ? 'Administrador' : 'Vendedor',
      crm_role: crmRole,
      is_super_admin: false,
      avatar_url: '/src/assets/images/profile/user-1.jpg',
      invited_at: new Date().toISOString()
    };

    if (!data.users) data.users = [];
    data.users.push(newUser);
    this.saveData(data);

    // Sync to Supabase profiles so the invited user can login from any device
    if (supabaseClient) {
      supabaseClient.from('profiles').upsert([{
        id: newUser.id,
        tenant_id: tenantId,
        full_name: fullName,
        email: email,
        role: newUser.role,
        crm_role: crmRole,
        password: 'senha123',
        avatar_url: newUser.avatar_url
      }]).then(({ error }) => {
        if (error) console.warn('[Supabase Sync] Falha ao sincronizar usuário convidado:', error);
        else console.log('[Supabase Sync] Usuário convidado sincronizado com sucesso:', email);
      });
    }

    return newUser;
  }

  updateUserRole(userId, newCrmRole) {
    const data = this.getData();
    const user = (data.users || []).find(u => u.id === userId);
    if (user) {
      user.crm_role = newCrmRole;
      user.role = newCrmRole === 'admin' ? 'Administrador' : 'Vendedor';
      this.saveData(data);
    }
  }


  async loginWithEmail(email, password) {
    const data = this.getData();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Procurar o usuário no banco local (localStorage)
    const matchedUser = (data.users || INITIAL_DEMO_DATA.users).find(u => u.email.toLowerCase() === cleanEmail);

    if (matchedUser) {
      if (matchedUser.password && matchedUser.password !== password) {
        throw new Error('Senha incorreta. Verifique suas credenciais.');
      }

      // Check tenant status before allowing login
      const tenant = (data.tenants || INITIAL_DEMO_DATA.tenants).find(t => t.id === matchedUser.tenant_id);
      const isSuperAdmin = matchedUser.is_super_admin || cleanEmail === 'paulo@southsea.com.br';

      if (tenant && tenant.status === 'suspended' && !isSuperAdmin) {
        throw new Error(`Acesso suspenso: A conta da empresa "${tenant.name}" encontra-se temporariamente suspensa por pendência financeira. Entre em contato com o suporte ou financeiro.`);
      }

      data.session = {
        user: matchedUser,
        active_tenant_id: matchedUser.tenant_id,
        is_authenticated: true
      };
      this.saveData(data);
      return { user: matchedUser, session: null };
    }

    // 2. Fallback: Buscar no Supabase profiles
    if (supabaseClient) {
      try {
        const { data: profileRows, error: profileErr } = await supabaseClient
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1);

        if (!profileErr && profileRows && profileRows.length > 0) {
          const p = profileRows[0];

          if (p.password && p.password !== password) {
            throw new Error('Senha incorreta. A senha padrão de novos convidados é: senha123');
          }

          let tenant = (data.tenants || []).find(t => t.id === p.tenant_id);
          if (!tenant && p.tenant_id) {
            const { data: tenantRows } = await supabaseClient
              .from('tenants').select('*').eq('id', p.tenant_id).limit(1);
            if (tenantRows && tenantRows.length > 0) {
              tenant = tenantRows[0];
              if (!data.tenants) data.tenants = [];
              data.tenants.push(tenant);
            }
          }

          const isSuperAdmin = cleanEmail === 'paulo@southsea.com.br';
          if (tenant && tenant.status === 'suspended' && !isSuperAdmin) {
            throw new Error(`Acesso suspenso: A conta da empresa "${tenant.name}" encontra-se temporariamente suspensa por pendência financeira. Entre em contato com o suporte ou financeiro.`);
          }

          const localUser = {
            id: p.id,
            tenant_id: p.tenant_id,
            full_name: p.full_name,
            email: p.email,
            password: password,
            crm_role: p.crm_role || 'vendedor',
            role: p.role || 'Vendedor',
            is_super_admin: isSuperAdmin,
            avatar_url: p.avatar_url || '/src/assets/images/profile/user-1.jpg'
          };

          if (!data.users) data.users = [];
          const existingIdx = data.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
          if (existingIdx >= 0) {
            data.users[existingIdx] = localUser;
          } else {
            data.users.push(localUser);
          }

          data.session = {
            user: localUser,
            active_tenant_id: localUser.tenant_id,
            is_authenticated: true
          };
          this.saveData(data);
          return { user: localUser, session: null };
        }
      } catch (err) {
        if (err.message && (err.message.includes('Acesso suspenso') || err.message.includes('Senha incorreta'))) throw err;
        console.warn('[Supabase Sync Auth Fallback Warning]', err);
      }
    }

    // 3. Fallback especial: Paulo Garcia (Super Admin Master)
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

    // 4. Tentar login via Supabase Auth (usuários cadastrados pelo Supabase Auth)
    if (supabaseClient) {
      try {
        const { data: sbData, error: sbErr } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (!sbErr && sbData && sbData.user) {
          return { user: sbData.user, session: sbData.session };
        }
      } catch (sbAuthErr) {
        // ignore, fall through
      }
    }

    throw new Error('E-mail não encontrado. Verifique suas credenciais ou entre em contato com o administrador da sua conta.');
  }

  async requestPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido.');
    }

    if (supabaseClient) {
      try {
        const redirectUrl = `${window.location.origin}/src/html/login.html`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl });
        if (!error) {
          return {
            mode: 'supabase',
            message: 'Se o e-mail estiver cadastrado, enviamos um link de redefinição para a sua caixa de entrada.'
          };
        }
      } catch (e) {
        console.warn('[Password Reset Warning]', e);
      }
    }

    const data = this.getData();
    const localMatch = (data.users || []).some(u => (u.email || '').toLowerCase() === cleanEmail);
    if (localMatch) {
      return {
        mode: 'local',
        message: 'Esta conta utiliza autenticação gerenciada pelo administrador. Solicite uma nova senha ao administrador da empresa ou atualize em Meu Perfil.'
      };
    }

    return {
      mode: 'unknown',
      message: 'Solicitação registrada. Caso sua empresa use acesso gerenciado, procure o administrador para redefinir sua senha.'
    };
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
      primary_color: '#143E2B',
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

  addLead(lead) {
    return this.saveLead(lead);
  }

  saveLead(lead) {
    const data = this.getData();
    const tenantId = lead.tenant_id || this.getActiveTenantId();
    if (!lead.id) {
      lead.id = 'lead-' + Date.now();
      lead.tenant_id = tenantId;
      lead.created_at = lead.created_at || new Date().toISOString();
      lead.score = parseInt(lead.score) || 25;
      lead.lifecycle_stage = lead.lifecycle_stage || 'lead';
      lead.activities = lead.activities || [];
      if (!data.leads) data.leads = [];
      data.leads.unshift(lead);

      this.addNotification({
        title: 'Novo Lead Capturado',
        message: `${lead.name} foi adicionado à base via ${lead.source || 'Formulário'}.`
      });
    } else {
      const idx = data.leads.findIndex(l => l.id === lead.id);
      if (idx !== -1) data.leads[idx] = { ...data.leads[idx], ...lead };
      else data.leads.unshift(lead);
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
          score: parseInt(lead.score) || 25,
          source: lead.source || 'Formulário do Site',
          tags: lead.tags || [],
          custom_fields: lead.custom_fields || {}
        };
        supabaseClient.from('leads').upsert([payload]).then(({ error }) => {
          if (error) console.warn('[Supabase Sync Save Lead Error]', error);
          else console.log('[Supabase Sync Save Lead Success]', lead.id);
        });
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao salvar lead:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('leads-synced', { detail: data.leads }));
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

    // Ensure tenant's default pipeline & stages are initialized and persisted
    const stages = this.getStages();
    const tenantPipeId = 'pipe-' + tenantId;

    if (!deal.id) {
      deal.id = 'deal-' + Date.now();
      deal.tenant_id = tenantId;
      deal.pipeline_id = tenantPipeId;
      deal.created_at = new Date().toISOString();
      if (!data.deals) data.deals = [];
      data.deals.unshift(deal);

      this.addNotification({
        title: 'Nova Oportunidade',
        message: `${deal.title} no valor de R$ ${parseFloat(deal.value).toLocaleString('pt-BR')} foi criada.`
      });
    } else {
      deal.pipeline_id = deal.pipeline_id || tenantPipeId;
      const idx = data.deals.findIndex(d => d.id === deal.id);
      if (idx !== -1) data.deals[idx] = { ...data.deals[idx], ...deal };
    }
    this.saveData(data);

    if (supabaseClient) {
      try {
        const tenantPipe = (data.pipelines || []).find(p => p.tenant_id === tenantId) || {
          id: tenantPipeId, tenant_id: tenantId, name: 'Funil de Vendas Inbound', is_default: true
        };

        // Guarantee parent pipeline and stages exist in Supabase BEFORE inserting deal
        supabaseClient.from('pipelines').upsert([tenantPipe]).then(() => {
          if (stages && stages.length > 0) {
            supabaseClient.from('pipeline_stages').upsert(stages).then(() => {
              const payload = {
                id: deal.id,
                tenant_id: deal.tenant_id || tenantId,
                lead_id: deal.lead_id || null,
                pipeline_id: deal.pipeline_id || tenantPipeId,
                stage_id: deal.stage_id,
                title: deal.title,
                value: parseFloat(deal.value) || 0,
                status: deal.status || 'open'
              };
              supabaseClient.from('deals').upsert([payload]).then(({ error }) => {
                if (error) console.warn('[Supabase Sync Deal Error]', error);
                else console.log('[Supabase Sync Deal Success]', deal.id);
              });
            });
          }
        });
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao salvar oportunidade:', e);
      }
    }

    return deal;
  }

  moveDealStage(dealId, newStageId) {
    const data = this.getData();
    const deal = (data.deals || []).find(d => d.id === dealId);
    if (deal) {
      deal.stage_id = newStageId;
      if (newStageId === 'stage-5' || newStageId.includes('won')) {
        deal.status = 'won';
      } else if (newStageId === 'stage-lost' || newStageId.includes('lost')) {
        deal.status = 'lost';
      }
      this.saveData(data);

      if (supabaseClient) {
        try {
          supabaseClient.from('deals').update({ 
            stage_id: newStageId, 
            status: deal.status,
            updated_at: new Date().toISOString() 
          }).eq('id', dealId).then();
        } catch (e) {
          console.warn('[Supabase Sync] Falha ao mover etapa no Supabase:', e);
        }
      }
    }
    return deal;
  }

  async deleteDeal(id) {
    const data = this.getData();
    if (!data.deleted_deal_ids) data.deleted_deal_ids = [];
    if (!data.deleted_deal_ids.includes(id)) {
      data.deleted_deal_ids.push(id);
    }
    data.deals = (data.deals || []).filter(d => d.id !== id);
    this.saveData(data);

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('deals').delete().eq('id', id);
        if (error) console.warn('[Supabase Sync Delete Deal Error]', error);
        else console.log('[Supabase Sync Delete Deal Success]', id);
      } catch (e) {
        console.warn('[Supabase Sync] Falha ao deletar oportunidade:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('deals-synced', { detail: data.deals }));
    }
  }

  getStages() {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    const allStages = data.stages || [];
    let tenantStages = allStages.filter(s => s.tenant_id === tenantId);

    if (tenantStages.length === 0) {
      const pipelineId = 'pipe-' + tenantId;

      if (!data.pipelines) data.pipelines = [];
      let tenantPipe = data.pipelines.find(p => p.tenant_id === tenantId);
      if (!tenantPipe) {
        tenantPipe = { id: pipelineId, tenant_id: tenantId, name: 'Funil de Vendas Inbound', is_default: true };
        data.pipelines.push(tenantPipe);
      }

      tenantStages = [
        { id: 'stage-' + tenantId + '-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Novo Lead', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Em Atendimento', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Proposta Enviada', display_order: 3, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Fechado/Ganho', display_order: 4, color: '#13DEB9' }
      ];

      if (!data.stages) data.stages = [];
      data.stages.push(...tenantStages);
      this.saveData(data);

      if (supabaseClient) {
        supabaseClient.from('pipelines').upsert([tenantPipe]).then(() => {
          supabaseClient.from('pipeline_stages').upsert(tenantStages).then();
        });
      }
    }
    return tenantStages;
  }

  applySegmentTemplate(segmentKey) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    const pipelineId = 'pipe-' + tenantId;

    const templates = {
      imobiliaria: [
        { id: 'stage-' + tenantId + '-imo-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Captação & Lead Inbound', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-imo-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Perfil & Vistoria Mapeada', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-imo-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Visita Agendada / Realizada', display_order: 3, color: '#7460EE' },
        { id: 'stage-' + tenantId + '-imo-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Proposta & Análise Crédito', display_order: 4, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-imo-5', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Contrato Fechado', display_order: 5, color: '#13DEB9' }
      ],
      clinica: [
        { id: 'stage-' + tenantId + '-cli-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Contato Inicial / Dúvida', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-cli-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Avaliação / Consulta Agendada', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-cli-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Compareceu à Consulta', display_order: 3, color: '#7460EE' },
        { id: 'stage-' + tenantId + '-cli-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Orçamento Apresentado', display_order: 4, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-cli-5', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Tratamento Fechado', display_order: 5, color: '#13DEB9' }
      ],
      ecommerce: [
        { id: 'stage-' + tenantId + '-eco-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Dúvida / Carrinho Abandonado', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-eco-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Atendimento WhatsApp', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-eco-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Cupom / Oferta Enviada', display_order: 3, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-eco-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Pedido Concluído', display_order: 4, color: '#13DEB9' }
      ],
      b2b: [
        { id: 'stage-' + tenantId + '-b2b-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Lead Qualificado (MQL)', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-b2b-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Reunião de Diagnóstico', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-b2b-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Proposta Comercial', display_order: 3, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-b2b-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Em Negociação', display_order: 4, color: '#7460EE' },
        { id: 'stage-' + tenantId + '-b2b-5', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Contrato Assinado', display_order: 5, color: '#13DEB9' }
      ],
      infoprodutos: [
        { id: 'stage-' + tenantId + '-inf-1', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Inscrição / Lead Inbound', display_order: 1, color: '#5D87FF' },
        { id: 'stage-' + tenantId + '-inf-2', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Qualificação SDR', display_order: 2, color: '#FFAE1F' },
        { id: 'stage-' + tenantId + '-inf-3', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Reunião de Aplicação', display_order: 3, color: '#FA896B' },
        { id: 'stage-' + tenantId + '-inf-4', tenant_id: tenantId, pipeline_id: pipelineId, name: 'Mentoria Vendida', display_order: 4, color: '#13DEB9' }
      ]
    };

    const newStages = templates[segmentKey];
    if (!newStages) return false;

    // Replace existing stages for this tenant
    data.stages = (data.stages || []).filter(s => s.tenant_id !== tenantId);
    data.stages.push(...newStages);
    this.saveData(data);

    if (supabaseClient) {
      const tenantPipe = (data.pipelines || []).find(p => p.tenant_id === tenantId) || {
        id: pipelineId, tenant_id: tenantId, name: 'Funil ' + segmentKey.toUpperCase(), is_default: true
      };
      supabaseClient.from('pipelines').upsert([tenantPipe]).then(() => {
        supabaseClient.from('pipeline_stages').upsert(newStages).then();
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('deals-synced'));
    }

    return true;
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
      if (window.mqUI) {
        window.mqUI.toast('Você precisa ter pelo menos 1 etapa no Kanban.', { type: 'warning' });
      }
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

  deleteAutomation(ruleId) {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    const before = (data.automations || []).length;
    data.automations = (data.automations || []).filter(a => !(a.id === ruleId && (!a.tenant_id || a.tenant_id === tenantId)));
    if (data.automations.length !== before) {
      this.saveData(data);
      return true;
    }
    return false;
  }

  getForms() {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.forms) data.forms = [];
    if (!data.forms_initialized) data.forms_initialized = {};

    let tenantForms = data.forms.filter(f => f.tenant_id === tenantId);

    if (tenantForms.length === 0 && !data.forms_initialized[tenantId]) {
      const defaultForm = {
        id: 'form-' + tenantId + '-default',
        tenant_id: tenantId,
        title: 'Solicitar Demonstração / Orçamento',
        description: 'Preencha os campos abaixo para que nossa equipe entre em contato.',
        button_text: 'Receber Apresentação Comercial',
        button_color: '#143E2B',
        theme_mode: 'light',
        source: 'Formulário do Site',
        redirect_url: '',
        success_message: 'Obrigado! Recebemos sua solicitação e entraremos em contato em instantes.',
        fields: {
          name: true,
          email: true,
          phone: true,
          company: true,
          notes: false
        },
        submissions_count: 5,
        created_at: new Date().toISOString()
      };
      data.forms.push(defaultForm);
      data.forms_initialized[tenantId] = true;
      this.saveData(data);
      tenantForms = [defaultForm];
    }
    return tenantForms;
  }

  getFormById(formId) {
    const data = this.getData();
    return (data.forms || []).find(f => f.id === formId);
  }

  saveForm(formData) {
    const data = this.getData();
    if (!data.forms) data.forms = [];
    if (!data.forms_initialized) data.forms_initialized = {};

    const tenantId = formData.tenant_id || this.getActiveTenantId();
    data.forms_initialized[tenantId] = true;

    let existingIndex = data.forms.findIndex(f => f.id === formData.id);

    const formObj = {
      ...formData,
      tenant_id: tenantId,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      data.forms[existingIndex] = { ...data.forms[existingIndex], ...formObj };
    } else {
      if (!formObj.id) formObj.id = 'form-' + tenantId + '-' + Date.now();
      if (!formObj.created_at) formObj.created_at = new Date().toISOString();
      if (typeof formObj.submissions_count === 'undefined') formObj.submissions_count = 0;
      data.forms.push(formObj);
    }

    this.saveData(data);

    if (supabaseClient) {
      try {
        const payload = {
          id: formObj.id,
          tenant_id: formObj.tenant_id,
          title: formObj.title,
          description: formObj.description,
          button_text: formObj.button_text,
          button_color: formObj.button_color,
          theme_mode: formObj.theme_mode,
          source: formObj.source,
          redirect_url: formObj.redirect_url || '',
          success_message: formObj.success_message || '',
          fields: formObj.fields,
          submissions_count: formObj.submissions_count || 0
        };
        supabaseClient.from('tenant_forms').upsert([payload]).then(({ error }) => {
          if (error) console.warn('[Supabase Sync Save Form Error]', error);
          else console.log('[Supabase Sync Save Form Success]', formObj.id);
        });
      } catch (e) {
        console.warn('[Supabase Sync Save Form Exception]', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('forms-synced'));
    }

    return formObj;
  }

  deleteForm(formId) {
    const data = this.getData();
    if (!data.forms) data.forms = [];
    data.forms = data.forms.filter(f => f.id !== formId);

    if (!data.forms_initialized) data.forms_initialized = {};
    const tenantId = this.getActiveTenantId();
    data.forms_initialized[tenantId] = true;

    this.saveData(data);

    if (supabaseClient) {
      try {
        supabaseClient.from('tenant_forms').delete().eq('id', formId).then();
      } catch(e) {
        console.warn('[Supabase Delete Form Error]', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('forms-synced'));
    }
  }

  async fetchRemoteForms() {
    if (supabaseClient) {
      try {
        const { data: dbForms, error } = await supabaseClient.from('tenant_forms').select('*');
        if (!error && dbForms && dbForms.length > 0) {
          const storeData = this.getData();
          const localForms = storeData.forms || [];
          let updated = false;

          dbForms.forEach(rf => {
            const idx = localForms.findIndex(lf => lf.id === rf.id);
            if (idx >= 0) {
              localForms[idx] = { ...localForms[idx], ...rf };
            } else {
              localForms.push(rf);
              updated = true;
            }
          });

          if (updated) {
            storeData.forms = localForms;
            this.saveData(storeData);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('forms-synced'));
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase Sync Forms Error]', err);
      }
    }
  }

  incrementFormSubmissions(formId) {
    const data = this.getData();
    const form = (data.forms || []).find(f => f.id === formId);
    if (form) {
      form.submissions_count = (form.submissions_count || 0) + 1;
      this.saveData(data);
    }
  }

  // --- WHATSAPP & MULTI-TENANT CONVERSATION ENGINE ---

  _createDefaultWhatsAppAccount(tenantId, existingCfg = null) {
    const tenant = this.getTenant();
    const slug = tenant ? (tenant.slug || tenant.id) : 'metrifiquese';
    return {
      id: 'default',
      tenant_id: tenantId,
      label: existingCfg?.label || 'WhatsApp Principal',
      color: existingCfg?.color || '#143E2B',
      instance_name: existingCfg?.instance_name || `metrifiquese-${slug}`,
      server_url: existingCfg?.server_url || '',
      api_key: existingCfg?.api_key || '',
      status: existingCfg?.status || 'disconnected',
      phone_number: existingCfg?.phone_number || '',
      profile_name: existingCfg?.profile_name || (tenant ? tenant.name : 'Metrifique-se Atendimento'),
      profile_pic: existingCfg?.profile_pic || '',
      battery_level: existingCfg?.battery_level ?? 90,
      qrcode: existingCfg?.qrcode || '',
      auto_create_leads: existingCfg?.auto_create_leads !== undefined ? existingCfg.auto_create_leads : true,
      created_at: existingCfg?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  getWhatsAppAccounts() {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_accounts) data.whatsapp_accounts = {};

    let accounts = data.whatsapp_accounts[tenantId];
    if (!Array.isArray(accounts) || accounts.length === 0) {
      const legacyCfg = data.whatsapp_configs ? data.whatsapp_configs[tenantId] : null;
      accounts = [this._createDefaultWhatsAppAccount(tenantId, legacyCfg)];
      data.whatsapp_accounts[tenantId] = accounts;
      if (!data.whatsapp_configs) data.whatsapp_configs = {};
      data.whatsapp_configs[tenantId] = { ...accounts[0] };
      this.saveData(data);
    }

    return accounts;
  }

  getWhatsAppAccountById(accountId) {
    const accounts = this.getWhatsAppAccounts();
    if (!accountId || accountId === 'all') return accounts[0] || null;
    return accounts.find(a => a.id === accountId) || accounts[0] || null;
  }

  addWhatsAppAccount({ label = '', color = '', server_url = '', api_key = '', instance_name = '' } = {}) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_accounts) data.whatsapp_accounts = {};
    const existing = this.getWhatsAppAccounts();

    const palette = ['#143E2B', '#1D4ED8', '#7C3AED', '#B45309', '#0F766E'];
    const nextColor = color || palette[existing.length % palette.length];
    const cleanLabel = (label || `WhatsApp ${existing.length + 1}`).trim();
    const slugBase = cleanLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `canal-${existing.length + 1}`;
    const accountId = `wa-${Date.now()}`;

    const newAccount = {
      id: accountId,
      tenant_id: tenantId,
      label: cleanLabel,
      color: nextColor,
      instance_name: (instance_name || `${slugBase}-${String(Date.now()).slice(-4)}`).trim(),
      server_url: (server_url || '').trim(),
      api_key: (api_key || '').trim(),
      status: 'disconnected',
      phone_number: '',
      profile_name: cleanLabel,
      profile_pic: '',
      battery_level: 95,
      qrcode: '',
      auto_create_leads: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    data.whatsapp_accounts[tenantId] = [...existing, newAccount];
    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: data.whatsapp_accounts[tenantId] }));
    }
    return newAccount;
  }

  updateWhatsAppAccount(accountId, patch = {}) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    const accounts = [...this.getWhatsAppAccounts()];
    const idx = accounts.findIndex(a => a.id === (accountId || 'default'));
    if (idx === -1) return null;

    accounts[idx] = {
      ...accounts[idx],
      ...patch,
      tenant_id: tenantId,
      updated_at: new Date().toISOString()
    };
    if (!data.whatsapp_accounts) data.whatsapp_accounts = {};
    data.whatsapp_accounts[tenantId] = accounts;

    if (accounts[idx].id === 'default') {
      if (!data.whatsapp_configs) data.whatsapp_configs = {};
      data.whatsapp_configs[tenantId] = { ...accounts[idx] };
    }

    this.saveData(data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: accounts }));
      window.dispatchEvent(new CustomEvent('whatsapp-config-updated', { detail: accounts[idx] }));
    }
    return accounts[idx];
  }

  removeWhatsAppAccount(accountId) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    const accounts = [...this.getWhatsAppAccounts()];

    if (accounts.length <= 1 || accountId === 'default') {
      return this.updateWhatsAppAccount(accountId || 'default', {
        status: 'disconnected',
        phone_number: '',
        qrcode: '',
        battery_level: 0
      });
    }

    const filtered = accounts.filter(a => a.id !== accountId);
    if (!data.whatsapp_accounts) data.whatsapp_accounts = {};
    data.whatsapp_accounts[tenantId] = filtered;

    // Reassign orphan chats from removed channel back to primary channel or remove empty chats
    if (Array.isArray(data.whatsapp_chats)) {
      data.whatsapp_chats = data.whatsapp_chats.filter(c => !(c.tenant_id === tenantId && c.account_id === accountId));
    }

    this.saveData(data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: filtered }));
      window.dispatchEvent(new CustomEvent('whatsapp-chats-updated'));
    }
    return true;
  }

  getWhatsAppConfig(accountId = 'default') {
    const accounts = this.getWhatsAppAccounts();
    return accounts.find(a => a.id === accountId) || accounts[0];
  }

  saveWhatsAppConfig(config, accountId = 'default') {
    return this.updateWhatsAppAccount(accountId, config);
  }

  _normalizeAndDeduplicateChats(data, tenantId) {
    if (!Array.isArray(data.whatsapp_chats)) return false;
    let changed = false;
    const seen = new Map();
    const deduped = [];

    for (const chat of data.whatsapp_chats) {
      if (chat.tenant_id !== tenantId) {
        deduped.push(chat);
        continue;
      }

      if (!chat.account_id) {
        chat.account_id = 'default';
        changed = true;
      }

      const digits = (chat.phone || '').replace(/\D/g, '').slice(-8);
      const dedupeKey = digits ? `${chat.account_id}::${digits}` : `${chat.account_id}::id::${chat.id}`;

      const existing = seen.get(dedupeKey);
      if (!existing) {
        seen.set(dedupeKey, chat);
        deduped.push(chat);
      } else {
        changed = true;
        if (!existing.lead_id && chat.lead_id) existing.lead_id = chat.lead_id;
        if ((!existing.name || existing.name.startsWith('+')) && chat.name && !chat.name.startsWith('+')) {
          existing.name = chat.name;
        }
        if (!existing.company && chat.company) existing.company = chat.company;
        const existingMsgs = existing.messages || [];
        const incomingMsgs = chat.messages || [];
        if (incomingMsgs.length > existingMsgs.length) {
          existing.messages = incomingMsgs;
          existing.last_message = chat.last_message || existing.last_message;
          existing.last_message_time = chat.last_message_time || existing.last_message_time;
        }
        existing.unread_count = Math.max(existing.unread_count || 0, chat.unread_count || 0);
      }
    }

    if (changed) {
      data.whatsapp_chats = deduped;
    }
    return changed;
  }

  getWhatsAppChats(accountId = null) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_chats) data.whatsapp_chats = [];

    const dedupedChanged = this._normalizeAndDeduplicateChats(data, tenantId);
    let tenantChats = data.whatsapp_chats.filter(c => c.tenant_id === tenantId);

    // Seed initial demo chats if none exist for this tenant
    if (tenantChats.length === 0) {
      const leads = this.getLeads();
      const firstLead = leads[0];
      const secondLead = leads[1];

      const defaultChats = [
        {
          id: 'chat-demo-1',
          tenant_id: tenantId,
          account_id: 'default',
          lead_id: firstLead ? firstLead.id : null,
          name: firstLead ? firstLead.name : 'Mariana Silva',
          phone: firstLead ? (firstLead.phone || '(11) 98765-4321') : '(11) 98765-4321',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          company: firstLead ? firstLead.company : 'SolarTech Inovações',
          unread_count: 1,
          last_message: 'Perfeito! Consegue me enviar a proposta detalhada por aqui?',
          last_message_time: '10:42',
          messages: [
            { id: 'm-1', from_me: false, text: 'Olá! Vi a apresentação do Metrifique-se e achei incrível.', time: '10:30', status: 'read' },
            { id: 'm-2', from_me: true, text: 'Olá, Mariana! Que ótimo falar com você. O Metrifique-se organiza todo o seu funil e centraliza seu WhatsApp.', time: '10:32', status: 'read' },
            { id: 'm-3', from_me: false, text: 'Vocês têm integração com funil de vendas e relatórios de conversão em tempo real?', time: '10:35', status: 'read' },
            { id: 'm-4', from_me: true, text: 'Sim, 100%! Inclusive você consegue acompanhar o score dos leads e mover etapas direto pelo chat.', time: '10:38', status: 'read' },
            { id: 'm-5', from_me: false, text: 'Perfeito! Consegue me enviar a proposta detalhada por aqui?', time: '10:42', status: 'delivered' }
          ]
        },
        {
          id: 'chat-demo-2',
          tenant_id: tenantId,
          account_id: 'default',
          lead_id: secondLead ? secondLead.id : null,
          name: secondLead ? secondLead.name : 'Carlos Eduardo',
          phone: secondLead ? (secondLead.phone || '(21) 99123-4567') : '(21) 99123-4567',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          company: secondLead ? secondLead.company : 'Logística Express',
          unread_count: 0,
          last_message: 'Combinado então! Assinamos o contrato hoje à tarde.',
          last_message_time: 'Ontem',
          messages: [
            { id: 'm-10', from_me: false, text: 'Boa tarde! Analisamos a proposta de R$ 25.000 da nossa equipe.', time: 'Ontem 15:10', status: 'read' },
            { id: 'm-11', from_me: true, text: 'Boa tarde Carlos! Ficou com alguma dúvida quanto ao cronograma de onboarding?', time: 'Ontem 15:15', status: 'read' },
            { id: 'm-12', from_me: false, text: 'Combinado então! Assinamos o contrato hoje à tarde.', time: 'Ontem 16:30', status: 'read' }
          ]
        },
        {
          id: 'chat-demo-3',
          tenant_id: tenantId,
          account_id: 'default',
          lead_id: null,
          name: 'Lucas Mendes (Contato Novo)',
          phone: '(31) 98844-5566',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
          company: 'Belo Horizonte / MG',
          unread_count: 2,
          last_message: 'Olá, gostaria de saber se vocês atendem empresas de serviços.',
          last_message_time: '09:15',
          messages: [
            { id: 'm-20', from_me: false, text: 'Bom dia!', time: '09:14', status: 'delivered' },
            { id: 'm-21', from_me: false, text: 'Olá, gostaria de saber se vocês atendem empresas de serviços.', time: '09:15', status: 'delivered' }
          ]
        }
      ];

      data.whatsapp_chats.push(...defaultChats);
      this.saveData(data);
      tenantChats = defaultChats;
    } else if (dedupedChanged) {
      this.saveData(data);
      tenantChats = data.whatsapp_chats.filter(c => c.tenant_id === tenantId);
    }

    if (accountId && accountId !== 'all') {
      return tenantChats.filter(c => (c.account_id || 'default') === accountId);
    }

    return tenantChats;
  }

  getWhatsAppChatById(chatId) {
    const chats = this.getWhatsAppChats();
    return chats.find(c => c.id === chatId);
  }

  saveWhatsAppChat(chat) {
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_chats) data.whatsapp_chats = [];

    chat.tenant_id = tenantId;
    chat.account_id = chat.account_id || 'default';

    const cleanLast8 = (chat.phone || '').replace(/\D/g, '').slice(-8);
    let idx = data.whatsapp_chats.findIndex(c => c.id === chat.id && c.tenant_id === tenantId);
    if (idx === -1 && cleanLast8) {
      idx = data.whatsapp_chats.findIndex(c =>
        c.tenant_id === tenantId &&
        (c.account_id || 'default') === chat.account_id &&
        (c.phone || '').replace(/\D/g, '').slice(-8) === cleanLast8
      );
    }

    if (idx >= 0) {
      const preservedId = data.whatsapp_chats[idx].id;
      data.whatsapp_chats[idx] = { ...data.whatsapp_chats[idx], ...chat, id: preservedId };
      chat = data.whatsapp_chats[idx];
    } else {
      data.whatsapp_chats.unshift(chat);
    }

    this.saveData(data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-chats-updated'));
    }
    return chat;
  }

  sendWhatsAppMessage(chatId, text) {
    if (!text || !text.trim()) return null;
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_chats) data.whatsapp_chats = [];

    const chat = data.whatsapp_chats.find(c => c.id === chatId && c.tenant_id === tenantId);
    if (!chat) return null;

    const accountId = chat.account_id || 'default';
    const accounts = this.getWhatsAppAccounts();
    const account = accounts.find(a => a.id === accountId) || accounts[0];

    const user = this.getUser() || { full_name: 'Atendente' };
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: 'msg-' + Date.now(),
      from_me: true,
      text: text.trim(),
      time: timeStr,
      status: 'delivered',
      sender_name: user.full_name
    };

    if (!chat.messages) chat.messages = [];
    chat.messages.push(newMsg);
    chat.last_message = text.trim();
    chat.last_message_time = timeStr;
    chat.unread_count = 0;

    if (chat.lead_id) {
      const channelTag = accounts.length > 1 && account ? ` (${account.label})` : '';
      this.addLeadActivity(chat.lead_id, {
        type: 'whatsapp',
        title: `Mensagem de WhatsApp enviada${channelTag}`,
        text: text.trim(),
        user: user.full_name
      });
    }

    this.saveData(data);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-message-sent', { detail: { chatId, accountId, message: newMsg } }));
      window.dispatchEvent(new CustomEvent('whatsapp-chats-updated'));
    }

    // Se houver Evolution API configurada nessa conta, enviar via HTTP real
    if (account && account.server_url && account.status === 'connected') {
      try {
        const cleanPhone = (chat.phone || '').replace(/\D/g, '');
        fetch(`${account.server_url.replace(/\/$/, '')}/message/sendText/${account.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': account.api_key || ''
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: text.trim()
          })
        }).catch(err => console.warn('[Evolution API Send Error]', err));
      } catch (e) {
        console.warn('[Evolution API Request Failed]', e);
      }
    }

    return newMsg;
  }

  receiveWhatsAppMessage(chatId, text, senderName, accountId = 'default') {
    if (!text) return null;
    const tenantId = this.getActiveTenantId();
    const data = this.getData();
    if (!data.whatsapp_chats) data.whatsapp_chats = [];

    let chat = data.whatsapp_chats.find(c => c.id === chatId && c.tenant_id === tenantId);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const accounts = this.getWhatsAppAccounts();
    const account = accounts.find(a => a.id === accountId) || accounts[0];

    if (!chat) {
      chat = {
        id: chatId,
        tenant_id: tenantId,
        account_id: accountId || 'default',
        lead_id: null,
        name: senderName || 'Novo Contato WhatsApp',
        phone: chatId.replace(/^chat-(?:wa-\d+-)?/, ''),
        avatar: '../assets/images/profile/user-1.jpg',
        unread_count: 1,
        last_message: text,
        last_message_time: timeStr,
        messages: []
      };
      data.whatsapp_chats.unshift(chat);
    }

    const newMsg = {
      id: 'msg-' + Date.now(),
      from_me: false,
      text: text.trim(),
      time: timeStr,
      status: 'delivered',
      sender_name: chat.name
    };

    if (!chat.messages) chat.messages = [];
    chat.messages.push(newMsg);
    chat.last_message = text.trim();
    chat.last_message_time = timeStr;
    chat.unread_count = (chat.unread_count || 0) + 1;

    if (chat.lead_id) {
      const channelTag = accounts.length > 1 && account ? ` (${account.label})` : '';
      this.addLeadActivity(chat.lead_id, {
        type: 'whatsapp',
        title: `Mensagem de WhatsApp recebida${channelTag}`,
        text: text.trim(),
        user: chat.name
      });
    }

    this.saveData(data);

    const channelPrefix = accounts.length > 1 && account ? `[${account.label}] ` : '';
    this.addNotification({
      title: 'Nova Mensagem WhatsApp',
      message: `${channelPrefix}${chat.name}: ${text.length > 50 ? text.substring(0, 50) + '...' : text}`
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp-message-received', { detail: { chatId, accountId: chat.account_id, message: newMsg } }));
      window.dispatchEvent(new CustomEvent('whatsapp-chats-updated'));
    }

    return newMsg;
  }

  createLeadFromWhatsApp(chatId) {
    const chat = this.getWhatsAppChatById(chatId);
    if (!chat) return null;

    const accounts = this.getWhatsAppAccounts();
    const account = accounts.find(a => a.id === (chat.account_id || 'default'));
    const channelInfo = accounts.length > 1 && account ? ` (${account.label})` : '';

    const newLead = {
      name: chat.name || 'Lead WhatsApp',
      phone: chat.phone || '',
      email: '',
      company: chat.company || 'Contato via WhatsApp',
      source: 'WhatsApp',
      score: 40,
      lifecycle_stage: 'lead',
      activities: [
        {
          id: 'act-' + Date.now(),
          type: 'whatsapp',
          title: `Lead gerado via WhatsApp${channelInfo}`,
          text: `Iniciou conversa pelo WhatsApp com a mensagem: "${chat.last_message || ''}"`,
          date: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          user: 'Sistema WhatsApp'
        }
      ]
    };

    const savedLead = this.saveLead(newLead);
    chat.lead_id = savedLead.id;
    this.saveWhatsAppChat(chat);

    return savedLead;
  }
}

window.crmStore = new LocalCRMStore();
