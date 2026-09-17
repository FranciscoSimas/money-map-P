-- Tabela de perfis de utilizador com configuração salarial
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração salarial
CREATE TABLE public.salary_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  has_food_allowance BOOLEAN NOT NULL DEFAULT false,
  food_allowance_value DECIMAL(10,2) DEFAULT 0,
  food_allowance_type TEXT DEFAULT 'card', -- 'card' ou 'cash'
  has_duodecimos BOOLEAN NOT NULL DEFAULT false,
  duodecimos_value DECIMAL(10,2) DEFAULT 0,
  has_13th_month BOOLEAN NOT NULL DEFAULT true,
  has_14th_month BOOLEAN NOT NULL DEFAULT true,
  other_income DECIMAL(10,2) DEFAULT 0,
  other_income_description TEXT,
  payment_day INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de categorias (pré-definidas + personalizadas)
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = categoria pré-definida
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'expense' ou 'income'
  expense_type TEXT, -- 'fixed', 'variable', 'optional' (só para despesas)
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações mensais (resumo por categoria)
CREATE TABLE public.monthly_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, year, month)
);

-- Tabela de transações individuais (opcional para detalhe)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL, -- 'expense' ou 'income'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de créditos/financiamentos
CREATE TABLE public.credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credit_type TEXT NOT NULL, -- 'car', 'house', 'personal', 'other'
  total_amount DECIMAL(12,2) NOT NULL,
  remaining_amount DECIMAL(12,2) NOT NULL,
  monthly_payment DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,3),
  start_date DATE NOT NULL,
  end_date DATE,
  total_months INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de investimentos
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  investment_type TEXT NOT NULL, -- 'stocks', 'etf', 'crypto', 'savings', 'other'
  initial_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_contribution DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de metas de poupança
CREATE TABLE public.savings_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para salary_config
CREATE POLICY "Users can view own salary config" ON public.salary_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own salary config" ON public.salary_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own salary config" ON public.salary_config FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para categories (podem ver default + próprias)
CREATE POLICY "Users can view categories" ON public.categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para monthly_records
CREATE POLICY "Users can view own monthly records" ON public.monthly_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly records" ON public.monthly_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly records" ON public.monthly_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly records" ON public.monthly_records FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para transactions
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para credits
CREATE POLICY "Users can view own credits" ON public.credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON public.credits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own credits" ON public.credits FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para investments
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para savings_goals
CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_salary_config_updated_at BEFORE UPDATE ON public.salary_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_records_updated_at BEFORE UPDATE ON public.monthly_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON public.credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON public.savings_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.salary_config (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir categorias pré-definidas (globais)
INSERT INTO public.categories (name, type, expense_type, icon, color, is_default, sort_order) VALUES
-- Rendimentos
('Salário', 'income', NULL, 'Wallet', '#22c55e', true, 1),
('Duodécimos', 'income', NULL, 'Calendar', '#22c55e', true, 2),
('Subsídio Alimentação', 'income', NULL, 'Utensils', '#22c55e', true, 3),
('Bónus', 'income', NULL, 'Gift', '#22c55e', true, 4),
('Outros Rendimentos', 'income', NULL, 'Plus', '#22c55e', true, 5),
-- Despesas Fixas
('Carro (Prestação)', 'expense', 'fixed', 'Car', '#ef4444', true, 10),
('Combustível', 'expense', 'variable', 'Fuel', '#f97316', true, 11),
('Internet/Telemóvel', 'expense', 'fixed', 'Wifi', '#ef4444', true, 12),
('Subscrições/Gym', 'expense', 'fixed', 'CreditCard', '#ef4444', true, 13),
('Renda/Habitação', 'expense', 'fixed', 'Home', '#ef4444', true, 14),
-- Despesas Variáveis
('Lazer/Jogos/Outros', 'expense', 'variable', 'Gamepad2', '#f97316', true, 20),
('Alimentação', 'expense', 'variable', 'ShoppingCart', '#f97316', true, 21),
('Saúde', 'expense', 'variable', 'Heart', '#f97316', true, 22),
('Vestuário', 'expense', 'variable', 'Shirt', '#f97316', true, 23),
-- Despesas Opcionais
('Euromilhões/Casino/Apostas', 'expense', 'optional', 'Dice5', '#a855f7', true, 30),
-- Poupança/Investimento
('Poupança', 'expense', 'fixed', 'PiggyBank', '#3b82f6', true, 40),
('Ações/ETFs', 'expense', 'variable', 'TrendingUp', '#3b82f6', true, 41),
('Crypto', 'expense', 'variable', 'Bitcoin', '#3b82f6', true, 42);