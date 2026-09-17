-- Add category_group column to categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS category_group TEXT;

-- Update existing default categories with their groups
-- Receitas (income)
UPDATE public.categories 
SET category_group = 'income'
WHERE user_id IS NULL 
  AND type = 'income';

-- Despesas Fixas (fixed_expenses)
UPDATE public.categories 
SET category_group = 'fixed_expenses'
WHERE user_id IS NULL 
  AND type = 'expense' 
  AND expense_type = 'fixed'
  AND name IN ('Carro (Prestação)', 'Internet/Telemóvel', 'Subscrições/Gym', 'Renda/Habitação');

-- Despesas Gerais (general_expenses) - variable expenses that are not savings/investments
UPDATE public.categories 
SET category_group = 'general_expenses'
WHERE user_id IS NULL 
  AND type = 'expense' 
  AND expense_type = 'variable'
  AND name IN ('Combustível', 'Lazer/Jogos/Outros', 'Alimentação', 'Saúde', 'Vestuário');

-- Despesas Opcionais (optional_expenses)
UPDATE public.categories 
SET category_group = 'optional_expenses'
WHERE user_id IS NULL 
  AND type = 'expense' 
  AND expense_type = 'optional';

-- Poupança/Investimentos (savings_investments)
UPDATE public.categories 
SET category_group = 'savings_investments'
WHERE user_id IS NULL 
  AND type = 'expense' 
  AND name IN ('Poupança', 'Ações/ETFs', 'Crypto');

-- For user-created categories, set default group based on type and expense_type
UPDATE public.categories 
SET category_group = CASE
  WHEN type = 'income' THEN 'income'
  WHEN type = 'expense' AND expense_type = 'fixed' THEN 'fixed_expenses'
  WHEN type = 'expense' AND expense_type = 'optional' THEN 'optional_expenses'
  WHEN type = 'expense' AND name IN ('Poupança', 'Ações/ETFs', 'Crypto') THEN 'savings_investments'
  WHEN type = 'expense' THEN 'general_expenses'
  ELSE 'general_expenses'
END
WHERE user_id IS NOT NULL 
  AND category_group IS NULL;
