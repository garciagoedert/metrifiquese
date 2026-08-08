-- ============================================================
-- MIGRAÇÃO TOTAL DE SEGURANÇA E ESTRUTURA (SUPABASE MULTI-TENANT)
-- Execute este script no SQL Editor do Supabase (supabase.com)
-- para liberar todas as permissões de leitura/escrita no SaaS.
-- ============================================================

-- 1. Garantir que colunas necessárias existem na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crm_role VARCHAR(50) DEFAULT 'vendedor';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE VARCHAR(100);

-- 2. Habilitar RLS e aplicar políticas FOR ALL totalmente abertas para todas as tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas que travavam o upsert
DROP POLICY IF EXISTS "Permitir tudo em tenants" ON public.tenants;
DROP POLICY IF EXISTS "Permitir tudo em profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir tudo em leads" ON public.leads;
DROP POLICY IF EXISTS "Permitir tudo em pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Permitir tudo em pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Permitir tudo em deals" ON public.deals;
DROP POLICY IF EXISTS "Permitir tudo em notifications" ON public.notifications;

-- Aplicar política global irrestrita
CREATE POLICY "Permitir tudo em tenants" ON public.tenants FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em leads" ON public.leads FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em pipelines" ON public.pipelines FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em pipeline_stages" ON public.pipeline_stages FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em deals" ON public.deals FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em notifications" ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Conceder todas as permissões de acesso às roles anon e authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
