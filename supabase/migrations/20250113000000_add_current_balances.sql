-- Tabela para armazenar montantes atuais do utilizador
CREATE TABLE IF NOT EXISTS public.current_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  savings_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  investments_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.current_balances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own current balances" ON public.current_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own current balances" ON public.current_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own current balances" ON public.current_balances FOR UPDATE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_current_balances_updated_at 
  BEFORE UPDATE ON public.current_balances 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
