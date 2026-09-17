-- Adicionar campo para guardar categorias pré-definidas ocultas pelo utilizador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_categories JSONB DEFAULT '[]'::jsonb;
