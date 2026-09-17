-- Regista retiradas da poupança para o banco (não são transações normais)
CREATE TABLE IF NOT EXISTS public.savings_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own savings withdrawals"
  ON public.savings_withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings withdrawals"
  ON public.savings_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings withdrawals"
  ON public.savings_withdrawals FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS savings_withdrawals_user_date_idx
  ON public.savings_withdrawals (user_id, date);
