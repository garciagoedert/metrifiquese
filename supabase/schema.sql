-- ====================================================================
-- METRIFIQUE-SE - ESQUEMA DE BANCO DE DADOS SUPABASE (MULTI-TENANT CRM)
-- ====================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE ORGANIZAÇÕES / TENANTS (WHITELABEL)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT DEFAULT '/src/assets/images/logos/metrifiquese.svg',
    primary_color VARCHAR(20) DEFAULT '#5D87FF',
    secondary_color VARCHAR(20) DEFAULT '#49BEFF',
    custom_domain VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'sales_rep' CHECK (role IN ('owner', 'admin', 'sales_rep', 'marketer')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LEADS (BASE DE CONTATOS & INBOUND)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(100),
    lifecycle_stage VARCHAR(50) DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'mql', 'sql', 'opportunity', 'customer', 'lost')),
    score INTEGER DEFAULT 0,
    source VARCHAR(100) DEFAULT 'Organic',
    tags TEXT[] DEFAULT '{}',
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELAS DE FUNIL E ETAPAS (PIPELINES & PIPELINE_STAGES)
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Funil de Vendas Padrão',
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(20) DEFAULT '#5D87FF',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE OPORTUNIDADES / DEALS (KANBAN)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    lost_reason TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE ATIVIDADES E HISTÓRICO DO LEAD
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'stage_change', 'score_change', 'form_submission')),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE CAPTURA & FORMULÁRIOS / WEBHOOKS
CREATE TABLE IF NOT EXISTS public.lead_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    webhook_token VARCHAR(100) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    success_redirect TEXT,
    fields_config JSONB DEFAULT '["name", "email", "phone", "company"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE REGRAS DE AUTOMAÇÃO
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL CHECK (trigger_event IN ('lead_created', 'score_reached', 'stage_changed')),
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA E ISOLAMENTO MULTI-TENANT
-- ====================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter tenant_id do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Políticas de RLS baseadas em tenant_id
CREATE POLICY tenant_isolation_leads ON public.leads
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_deals ON public.deals
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_activities ON public.lead_activities
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_pipelines ON public.pipelines
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_stages ON public.pipeline_stages
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_forms ON public.lead_forms
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY tenant_isolation_automations ON public.automation_rules
    FOR ALL USING (tenant_id = get_current_user_tenant_id());

-- Dados Iniciais para Demonstração (Seed Data)
INSERT INTO public.tenants (id, name, slug, logo_url, primary_color, secondary_color)
VALUES ('11111111-1111-1111-1111-111111111111', 'Metrifique-se Demo', 'metrifiquese-demo', '/src/assets/images/logos/metrifiquese.svg', '#5D87FF', '#49BEFF')
ON CONFLICT (id) DO NOTHING;
