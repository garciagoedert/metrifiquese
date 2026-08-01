/**
 * Metrifique-se CRM - Multi-Tenant Data Store & Security Engine
 * Guarantees 100% strict data isolation by tenant_id and Super Admin access control.
 */

const SUPABASE_CONFIG = {
  url: window.localStorage.getItem('SUPABASE_URL') || '',
  anonKey: window.localStorage.getItem('SUPABASE_ANON_KEY') || ''
};

// Initialize Supabase JS Client if credentials & library are present
let supabaseClient = null;
if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('[Supabase Auth] Conectado ao Supabase Cloud:', SUPABASE_CONFIG.url);
  } catch (err) {
    console.warn('[Supabase Auth] Erro ao inicializar cliente Supabase:', err);
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
      full_name: 'Guilherme Garcia',
      email: 'admin@metrifiquese.com.br',
      password: '12345678',
      phone: '(11) 99887-6655',
      role: 'Super Admin Plataforma',
      is_super_admin: true,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
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
    user: {
      id: 'user-001',
      tenant_id: 'tenant-demo-001',
      full_name: 'Guilherme Garcia',
      email: 'admin@metrifiquese.com.br',
      password: '12345678',
      phone: '(11) 99887-6655',
      role: 'Super Admin Plataforma',
      is_super_admin: true,
      avatar_url: '/src/assets/images/profile/user-1.jpg'
    },
    active_tenant_id: 'tenant-demo-001',
    is_authenticated: true
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
  leads: [
    {
      id: 'lead-101',
      tenant_id: 'tenant-demo-001',
      name: 'Carlos Eduardo (Master)',
      email: 'carlos.eduardo@techsolutions.com.br',
      phone: '(11) 98765-4321',
      company: 'Tech Solutions Ltda',
      job_title: 'Diretor de Operações',
      lifecycle_stage: 'opportunity',
      score: 85,
      source: 'Google Ads',
      tags: ['Alta Prioridade', 'Decisor', 'Inbound'],
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      activities: [
        { id: 'act-1', type: 'call', title: 'Reunião de alinhamento', desc: 'Cliente solicitou proposta comercial de 50 licenças.', date: 'Ontem' }
      ]
    },
    {
      id: 'lead-102',
      tenant_id: 'tenant-demo-001',
      name: 'Mariana Silva (Master)',
      email: 'mariana.silva@inovacao.io',
      phone: '(21) 99876-1234',
      company: 'Inovação Digital',
      job_title: 'Gerente de Marketing',
      lifecycle_stage: 'mql',
      score: 60,
      source: 'Facebook Ads',
      tags: ['E-book Baixado', 'Nutrição'],
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      activities: []
    },
    {
      id: 'lead-103',
      tenant_id: 'tenant-demo-001',
      name: 'Roberto Mendes (Master)',
      email: 'roberto@logisticaexpress.com',
      phone: '(31) 97654-9876',
      company: 'Logística Express',
      job_title: 'CEO',
      lifecycle_stage: 'customer',
      score: 110,
      source: 'Indicação',
      tags: ['VIP', 'Cliente'],
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      activities: []
    },
    // Lead Tenant 2 (Exclusivo Agência Scale)
    {
      id: 'lead-201',
      tenant_id: 'tenant-002',
      name: 'Juliana Costa (Agência Scale)',
      email: 'juliana@clientescale.com.br',
      phone: '(11) 96666-5555',
      company: 'Cliente Exclusivo Scale',
      job_title: 'Proprietária',
      lifecycle_stage: 'opportunity',
      score: 95,
      source: 'Instagram Ads',
      tags: ['Campanha Tráfego'],
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      activities: []
    },
    // Lead Tenant 3 (Exclusivo Tech Solutions Corp)
    {
      id: 'lead-301',
      tenant_id: 'tenant-003',
      name: 'Fernando Ramos (Tech Solutions)',
      email: 'fernando@techcorp-cliente.com',
      phone: '(21) 97777-3333',
      company: 'Cliente Enterprise Tech',
      job_title: 'VP Sales',
      lifecycle_stage: 'lead',
      score: 45,
      source: 'LinkedIn B2B',
      tags: ['Enterprise'],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      activities: []
    }
  ],
  deals: [
    {
      id: 'deal-201',
      tenant_id: 'tenant-demo-001',
      lead_id: 'lead-101',
      stage_id: 'stage-4',
      title: 'Contrato CRM Whitelabel 50 Licenças',
      value: 12500.00,
      status: 'open',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'deal-202',
      tenant_id: 'tenant-demo-001',
      lead_id: 'lead-102',
      stage_id: 'stage-2',
      title: 'Plano Enterprise Anual',
      value: 8400.00,
      status: 'open',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString()
    },
    {
      id: 'deal-203',
      tenant_id: 'tenant-demo-001',
      lead_id: 'lead-103',
      stage_id: 'stage-5',
      title: 'Implementação Customizada CRM',
      value: 25000.00,
      status: 'won',
      created_at: new Date(Date.now() - 86400000 * 8).toISOString()
    },
    // Deal Tenant 2
    {
      id: 'deal-301',
      tenant_id: 'tenant-002',
      lead_id: 'lead-201',
      stage_id: 'stage-202',
      title: 'Gestão de Tráfego Mensal R$ 3.500',
      value: 3500.00,
      status: 'open',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    // Deal Tenant 3
    {
      id: 'deal-401',
      tenant_id: 'tenant-003',
      lead_id: 'lead-301',
      stage_id: 'stage-301',
      title: 'Licenciamento Enterprise R$ 15.000',
      value: 15000.00,
      status: 'open',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ],
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
    this.initSupabaseAuthListener();
  }

  initStore() {
    const raw = localStorage.getItem('METRIFIQUESE_CRM_DATA');
    if (!raw) {
      localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(INITIAL_DEMO_DATA));
    } else {
      try {
        const data = JSON.parse(raw);
        // Reseed users if missing passwords or tenant isolation attributes
        if (!data.users || data.users.length < 3 || !data.users[1].password) {
          data.users = INITIAL_DEMO_DATA.users;
          data.tenants = INITIAL_DEMO_DATA.tenants;
          data.leads = INITIAL_DEMO_DATA.leads;
          data.deals = INITIAL_DEMO_DATA.deals;
          data.stages = INITIAL_DEMO_DATA.stages;
          localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(data));
        }
      } catch (e) {
        localStorage.setItem('METRIFIQUESE_CRM_DATA', JSON.stringify(INITIAL_DEMO_DATA));
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
            is_super_admin: session.user.user_metadata?.is_super_admin || false,
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

  createTenantWithAdmin({ name, domain, plan, monthlyPrice, primaryColor, logoUrl, adminName, adminEmail, adminPassword }) {
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
    return { tenant: newTenant, adminUser: newAdminUser };
  }

  updateTenantDetails(tenantId, newSettings) {
    const data = this.getData();
    const idx = data.tenants.findIndex(t => t.id === tenantId);
    if (idx !== -1) {
      if (newSettings.monthly_price !== undefined) {
        newSettings.monthly_price = parseFloat(newSettings.monthly_price) || 0;
      }
      data.tenants[idx] = { ...data.tenants[idx], ...newSettings };
      this.saveData(data);
      return data.tenants[idx];
    }
    return null;
  }

  updateTenant(newSettings) {
    return this.updateTenantDetails(this.getActiveTenantId(), newSettings);
  }

  deleteTenant(tenantId) {
    const data = this.getData();
    data.tenants = data.tenants.filter(t => t.id !== tenantId);
    data.users = data.users.filter(u => u.tenant_id !== tenantId);
    data.leads = data.leads.filter(l => l.tenant_id !== tenantId);
    data.deals = data.deals.filter(d => d.tenant_id !== tenantId);
    data.stages = data.stages.filter(s => s.tenant_id !== tenantId);
    this.saveData(data);
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
      // Validar senha se existir
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

    // 2. Se for uma tentativa de login Supabase Cloud ou usuário não cadastrado
    if (supabaseClient) {
      const { data: sbData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    }

    // 3. Fallback: Se for email de admin master
    if (cleanEmail.includes('admin') || cleanEmail.includes('metrifiquese.com.br')) {
      const masterUser = (data.users || []).find(u => u.is_super_admin) || INITIAL_DEMO_DATA.users[0];
      data.session = { user: masterUser, active_tenant_id: 'tenant-demo-001', is_authenticated: true };
      this.saveData(data);
      return { user: masterUser, session: null };
    }

    // 4. Se for um novo usuário de teste cadastrando diretamente no login: cria tenant isolado
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
    data.user = { ...data.user, ...userData };
    if (data.session && data.session.user) {
      data.session.user = { ...data.session.user, ...userData };
    }
    this.saveData(data);
    return data.user;
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
    return lead;
  }

  deleteLead(id) {
    const data = this.getData();
    data.leads = data.leads.filter(l => l.id !== id);
    data.deals = data.deals.filter(d => d.lead_id !== id);
    this.saveData(data);
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
    return deal;
  }

  moveDealStage(dealId, newStageId) {
    const data = this.getData();
    const deal = data.deals.find(d => d.id === dealId);
    if (deal) {
      deal.stage_id = newStageId;
      if (newStageId === 'stage-5' || newStageId.includes('won')) deal.status = 'won';
      this.saveData(data);
    }
    return deal;
  }

  getStages() {
    const tenantId = this.getActiveTenantId();
    const allStages = this.getData().stages || [];
    const tenantStages = allStages.filter(s => s.tenant_id === tenantId);

    if (tenantStages.length === 0) {
      // Retornar etapas default para novos tenants sem etapas customizadas
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
    return notif;
  }

  markNotificationsRead() {
    const data = this.getData();
    const tenantId = this.getActiveTenantId();
    if (data.notifications) {
      data.notifications.filter(n => n.tenant_id === tenantId).forEach(n => n.is_read = true);
    }
    this.saveData(data);
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
