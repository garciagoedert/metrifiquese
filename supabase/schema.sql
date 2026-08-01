-- ====================================================================
-- METRIFIQUE-SE - ESQUEMA DE BANCO DE DADOS SUPABASE (MULTI-TENANT CRM)
-- ====================================================================

-- 1. DROPPAR TABELAS ANTIGAS PARA GARANTIR ESTRUTURA LIMPA VARCHAR
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.lead_activities CASCADE;
DROP TABLE IF EXISTS public.lead_forms CASCADE;
DROP TABLE IF EXISTS public.automation_rules CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.pipelines CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE ORGANIZAÇÕES / TENANTS (WHITELABEL)
CREATE TABLE public.tenants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    logo_url TEXT DEFAULT '/src/assets/images/logos/metrifiquese.svg',
    primary_color VARCHAR(20) DEFAULT '#5D87FF',
    secondary_color VARCHAR(20) DEFAULT '#49BEFF',
    custom_domain VARCHAR(255),
    plan VARCHAR(100) DEFAULT 'Plano Agência Whitelabel',
    monthly_price NUMERIC(12, 2) DEFAULT 297.00,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
CREATE TABLE public.profiles (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    avatar_url TEXT,
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE LEADS (BASE DE CONTATOS & INBOUND)
CREATE TABLE public.leads (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(100),
    lifecycle_stage VARCHAR(50) DEFAULT 'lead',
    score INTEGER DEFAULT 0,
    source VARCHAR(100) DEFAULT 'Organic',
    tags TEXT[] DEFAULT '{}',
    assigned_to VARCHAR(255) REFERENCES public.profiles(id) ON DELETE SET NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELAS DE FUNIL E ETAPAS (PIPELINES & PIPELINE_STAGES)
CREATE TABLE public.pipelines (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Funil de Vendas Padrão',
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pipeline_stages (
    id VARCHAR(255) PRIMARY KEY,
    pipeline_id VARCHAR(255) NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(20) DEFAULT '#5D87FF',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE OPORTUNIDADES / DEALS (KANBAN)
CREATE TABLE public.deals (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id VARCHAR(255) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    pipeline_id VARCHAR(255) NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id VARCHAR(255) NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'open',
    lost_reason TEXT,
    assigned_to VARCHAR(255) REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. HABILITAR RLS NAS TABELAS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- 8. CRIAR POLÍTICAS DE PERMISSÃO ANÔNIMAS LIVRES
CREATE POLICY "Permitir leitura anonima de tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de tenants" ON public.tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de tenants" ON public.tenants FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusao anonima de tenants" ON public.tenants FOR DELETE USING (true);

CREATE POLICY "Permitir leitura anonima de profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusao anonima de profiles" ON public.profiles FOR DELETE USING (true);

CREATE POLICY "Permitir leitura anonima de leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de leads" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusao anonima de leads" ON public.leads FOR DELETE USING (true);

CREATE POLICY "Permitir leitura anonima de deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Permitir insercao anonima de deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao anonima de deals" ON public.deals FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusao anonima de deals" ON public.deals FOR DELETE USING (true);
