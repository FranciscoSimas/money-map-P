-- Adicionar campos faltantes à tabela salary_config
ALTER TABLE public.salary_config
  ADD COLUMN IF NOT EXISTS marital_status TEXT DEFAULT 'single', -- 'single', 'married_single', 'married_joint'
  ADD COLUMN IF NOT EXISTS dependents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_irs_jovem BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS irs_jovem_year INTEGER, -- 1 = 100% isenção, 2 = 75% isenção, 3 = 50% isenção
  ADD COLUMN IF NOT EXISTS vacation_payment_day INTEGER, -- Dia do mês para subsídio de férias
  ADD COLUMN IF NOT EXISTS christmas_payment_day INTEGER, -- Dia do mês para subsídio de natal
  ADD COLUMN IF NOT EXISTS food_allowance_days INTEGER DEFAULT 22; -- Dias trabalhados por mês

-- Adicionar campo para guardar categorias selecionadas (JSON array)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_categories JSONB DEFAULT '[]'::jsonb;
