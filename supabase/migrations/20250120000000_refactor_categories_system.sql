-- Refatoração completa do sistema de categorias
-- 1. Criar tabela para personalização de cores por user
CREATE TABLE IF NOT EXISTS public.category_color_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- 2. Criar tabela para preferências do user (ordem, ativação)
CREATE TABLE IF NOT EXISTS public.category_user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- 3. Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_category_color_preferences_user_category ON public.category_color_preferences(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_category_user_preferences_user_category ON public.category_user_preferences(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_category_user_preferences_user_order ON public.category_user_preferences(user_id, sort_order);

-- 4. Migrar dados existentes: criar preferências para categorias pré-definidas que já estão ativas
-- Para cada user que tem categorias ativas, criar registos nas tabelas de preferências
INSERT INTO public.category_user_preferences (user_id, category_id, sort_order, is_active)
SELECT DISTINCT 
  t.user_id,
  c.id,
  COALESCE(c.sort_order, 0),
  c.is_active
FROM public.categories c
CROSS JOIN (
  SELECT DISTINCT user_id 
  FROM public.transactions 
  WHERE user_id IS NOT NULL
) t
WHERE c.user_id IS NULL -- Apenas categorias pré-definidas
  AND c.is_default = true
ON CONFLICT (user_id, category_id) DO NOTHING;

-- 5. Migrar cores personalizadas existentes (se houver categorias personalizadas com cores diferentes)
-- Nota: Isto assume que se uma categoria personalizada tem uma cor diferente da pré-definida,
-- essa cor deve ser mantida na tabela de preferências
INSERT INTO public.category_color_preferences (user_id, category_id, color)
SELECT 
  c.user_id,
  c.id,
  c.color
FROM public.categories c
WHERE c.user_id IS NOT NULL -- Categorias personalizadas
  AND c.color IS NOT NULL
ON CONFLICT (user_id, category_id) DO UPDATE SET color = EXCLUDED.color;

-- 6. Adicionar coluna para identificar se é uma categoria base (pré-definida que foi copiada)
-- Isto ajuda a rastrear qual pré-definida originou uma categoria personalizada
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS base_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 7. Comentários para documentação
COMMENT ON TABLE public.category_color_preferences IS 'Armazena preferências de cor personalizadas por user para cada categoria';
COMMENT ON TABLE public.category_user_preferences IS 'Armazena preferências de ordem e ativação por user para cada categoria';
COMMENT ON COLUMN public.categories.base_category_id IS 'ID da categoria pré-definida que originou esta categoria personalizada (se aplicável)';
