-- ============================================================
-- MIGRAÇÃO: Adicionar coluna crm_role à tabela profiles
-- Execute este SQL no Editor do Supabase para resolver o
-- problema de login de usuários convidados.
-- ============================================================

-- 1. Adicionar coluna crm_role (se ainda não existir)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crm_role VARCHAR(50) DEFAULT 'vendedor';

-- 2. Aumentar o tamanho da coluna role para comportar textos maiores
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE VARCHAR(100);

-- Verificação: confirme que as colunas existem
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;
