-- Tabela de simulações
CREATE TABLE IF NOT EXISTS public.simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  months INTEGER NOT NULL,
  default_values JSONB NOT NULL DEFAULT '{}', -- Valores padrão por categoria: { category_id: amount }
  monthly_overrides JSONB NOT NULL DEFAULT '{}', -- Overrides por mês: { month_index: { category_id: amount } }
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own simulations" ON public.simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own simulations" ON public.simulations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own simulations" ON public.simulations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own simulations" ON public.simulations FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_simulations_updated_at 
  BEFORE UPDATE ON public.simulations 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
