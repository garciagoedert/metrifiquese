-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA E ESTRUTURA PARA A TABELA PROFILES (SUPABASE)
-- Execute este script no SQL Editor do Supabase (supabase.com)
-- para liberar as permissões de login e convites de usuários.
-- ============================================================

-- 1. Garantir que as colunas necessárias existem na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crm_role VARCHAR(50) DEFAULT 'vendedor';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE VARCHAR(100);

-- 2. Habilitar RLS e aplicar política 100% aberta para SELECT, INSERT, UPDATE, DELETE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo em profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir leitura anonima de profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir insercao anonima de profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir atualizacao anonima de profiles" ON public.profiles;
DROP POLICY IF EXISTS "Permitir exclusao anonima de profiles" ON public.profiles;

CREATE POLICY "Permitir tudo em profiles" ON public.profiles
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Conceder todas as permissões de tabela para as roles anon e authenticated
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.tenants TO anon, authenticated, service_role;
