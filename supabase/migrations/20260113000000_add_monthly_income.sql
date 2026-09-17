-- Tabela para guardar a receita mensal ajustada
-- Permite ajustar a receita mensal sem recalcular tudo
CREATE TABLE IF NOT EXISTS public.monthly_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  income DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- RLS Policies
ALTER TABLE public.monthly_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly income"
  ON public.monthly_income
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly income"
  ON public.monthly_income
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly income"
  ON public.monthly_income
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly income"
  ON public.monthly_income
  FOR DELETE
  USING (auth.uid() = user_id);

