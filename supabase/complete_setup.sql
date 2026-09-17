-- ============================================================
-- COMPLETE SETUP SQL - Your Money Map
-- ============================================================
-- Este ficheiro contém TUDO o necessário para configurar
-- a base de dados do zero.
-- 
-- INSTRUÇÕES:
-- 1. Abre o SQL Editor no Supabase Dashboard
-- 2. Cola todo este conteúdo
-- 3. Clica em "Run" ou executa (F5)
-- 4. Verifica se não há erros
-- ============================================================

-- ============================================================
-- 1. TABELAS PRINCIPAIS
-- ============================================================

-- Tabela de perfis de utilizador
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  selected_categories JSONB DEFAULT '[]'::jsonb, -- Array de IDs de categorias selecionadas
  hidden_categories JSONB DEFAULT '[]'::jsonb, -- Array de IDs de categorias pré-definidas ocultas pelo utilizador
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração salarial
CREATE TABLE IF NOT EXISTS public.salary_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  has_food_allowance BOOLEAN NOT NULL DEFAULT false,
  food_allowance_value DECIMAL(10,2) DEFAULT 0,
  food_allowance_type TEXT DEFAULT 'card', -- 'card' ou 'cash'
  food_allowance_days INTEGER DEFAULT 22, -- Dias trabalhados por mês
  has_duodecimos BOOLEAN NOT NULL DEFAULT false,
  duodecimos_value DECIMAL(10,2) DEFAULT 0,
  has_13th_month BOOLEAN NOT NULL DEFAULT true,
  has_14th_month BOOLEAN NOT NULL DEFAULT true,
  other_income DECIMAL(10,2) DEFAULT 0,
  other_income_description TEXT,
  payment_day INTEGER DEFAULT 1,
  marital_status TEXT DEFAULT 'single', -- 'single', 'married_single', 'married_joint'
  dependents INTEGER DEFAULT 0,
  has_irs_jovem BOOLEAN DEFAULT false,
  irs_jovem_year INTEGER, -- 1 = 100% isenção, 2 = 75% isenção, 3 = 50% isenção
  vacation_payment_day INTEGER, -- Dia do mês para subsídio de férias
  christmas_payment_day INTEGER, -- Dia do mês para subsídio de natal
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de categorias (pré-definidas + personalizadas)
CREATE TABLE IF NOT EXISTS public.categories (
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
CREATE TABLE IF NOT EXISTS public.monthly_records (
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
CREATE TABLE IF NOT EXISTS public.transactions (
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
CREATE TABLE IF NOT EXISTS public.credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credit_type TEXT NOT NULL, -- 'car', 'house', 'personal', 'other'
  total_amount DECIMAL(12,2) NOT NULL,
  remaining_amount DECIMAL(12,2) NOT NULL,
  monthly_payment DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,3),
  tan_rate DECIMAL(5,3), -- Taxa Anual Nominal
  taeg_rate DECIMAL(5,3), -- Taxa Anual Efetiva Global
  down_payment DECIMAL(12,2), -- Entrada
  start_date DATE NOT NULL,
  end_date DATE,
  total_months INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de investimentos
CREATE TABLE IF NOT EXISTS public.investments (
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
CREATE TABLE IF NOT EXISTS public.savings_goals (
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

-- Tabela de montantes atuais
CREATE TABLE IF NOT EXISTS public.current_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  savings_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  investments_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_balances ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POLÍTICAS RLS (Row Level Security)
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Salary Config
DROP POLICY IF EXISTS "Users can view own salary config" ON public.salary_config;
CREATE POLICY "Users can view own salary config" ON public.salary_config FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own salary config" ON public.salary_config;
CREATE POLICY "Users can insert own salary config" ON public.salary_config FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own salary config" ON public.salary_config;
CREATE POLICY "Users can update own salary config" ON public.salary_config FOR UPDATE USING (auth.uid() = user_id);

-- Categories (podem ver default + próprias)
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
CREATE POLICY "Users can view categories" ON public.categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Monthly Records
DROP POLICY IF EXISTS "Users can view own monthly records" ON public.monthly_records;
CREATE POLICY "Users can view own monthly records" ON public.monthly_records FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own monthly records" ON public.monthly_records;
CREATE POLICY "Users can insert own monthly records" ON public.monthly_records FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own monthly records" ON public.monthly_records;
CREATE POLICY "Users can update own monthly records" ON public.monthly_records FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own monthly records" ON public.monthly_records;
CREATE POLICY "Users can delete own monthly records" ON public.monthly_records FOR DELETE USING (auth.uid() = user_id);

-- Transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Credits
DROP POLICY IF EXISTS "Users can view own credits" ON public.credits;
CREATE POLICY "Users can view own credits" ON public.credits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credits" ON public.credits;
CREATE POLICY "Users can insert own credits" ON public.credits FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own credits" ON public.credits;
CREATE POLICY "Users can update own credits" ON public.credits FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own credits" ON public.credits;
CREATE POLICY "Users can delete own credits" ON public.credits FOR DELETE USING (auth.uid() = user_id);

-- Investments
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- Savings Goals
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- Current Balances
DROP POLICY IF EXISTS "Users can view own current balances" ON public.current_balances;
CREATE POLICY "Users can view own current balances" ON public.current_balances FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own current balances" ON public.current_balances;
CREATE POLICY "Users can insert own current balances" ON public.current_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own current balances" ON public.current_balances;
CREATE POLICY "Users can update own current balances" ON public.current_balances FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 4. FUNÇÕES E TRIGGERS
-- ============================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar triggers updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_salary_config_updated_at ON public.salary_config;
CREATE TRIGGER update_salary_config_updated_at 
  BEFORE UPDATE ON public.salary_config 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_records_updated_at ON public.monthly_records;
CREATE TRIGGER update_monthly_records_updated_at 
  BEFORE UPDATE ON public.monthly_records 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_credits_updated_at ON public.credits;
CREATE TRIGGER update_credits_updated_at 
  BEFORE UPDATE ON public.credits 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_investments_updated_at ON public.investments;
CREATE TRIGGER update_investments_updated_at 
  BEFORE UPDATE ON public.investments 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_savings_goals_updated_at ON public.savings_goals;
CREATE TRIGGER update_savings_goals_updated_at 
  BEFORE UPDATE ON public.savings_goals 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_current_balances_updated_at ON public.current_balances;
CREATE TRIGGER update_current_balances_updated_at 
  BEFORE UPDATE ON public.current_balances 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente quando novo utilizador se regista
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. INSERIR CATEGORIAS PRÉ-DEFINIDAS
-- ============================================================

-- Limpar categorias pré-definidas existentes (se houver)
DELETE FROM public.categories WHERE user_id IS NULL;

-- Inserir categorias pré-definidas (globais - user_id = NULL)
INSERT INTO public.categories (name, type, expense_type, icon, color, is_default, sort_order) VALUES
-- RENDIMENTOS
('Salário', 'income', NULL, 'Wallet', '#22c55e', true, 1),
('Duodécimos', 'income', NULL, 'Calendar', '#22c55e', true, 2),
('Subsídio Alimentação', 'income', NULL, 'Utensils', '#22c55e', true, 3),
('Bónus', 'income', NULL, 'Gift', '#22c55e', true, 4),
('Outros Rendimentos', 'income', NULL, 'Plus', '#22c55e', true, 5),

-- DESPESAS FIXAS
('Carro (Prestação)', 'expense', 'fixed', 'Car', '#ef4444', true, 10),
('Combustível', 'expense', 'variable', 'Fuel', '#f97316', true, 11),
('Internet/Telemóvel', 'expense', 'fixed', 'Wifi', '#ef4444', true, 12),
('Subscrições/Gym', 'expense', 'fixed', 'CreditCard', '#ef4444', true, 13),
('Renda/Habitação', 'expense', 'fixed', 'Home', '#ef4444', true, 14),

-- DESPESAS VARIÁVEIS
('Lazer/Jogos/Outros', 'expense', 'variable', 'Gamepad2', '#f97316', true, 20),
('Alimentação', 'expense', 'variable', 'ShoppingCart', '#f97316', true, 21),
('Saúde', 'expense', 'variable', 'Heart', '#f97316', true, 22),
('Vestuário', 'expense', 'variable', 'Shirt', '#f97316', true, 23),

-- DESPESAS OPCIONAIS
('Euromilhões/Casino/Apostas', 'expense', 'optional', 'Dice5', '#a855f7', true, 30),

-- POUPANÇA/INVESTIMENTO
('Poupança', 'expense', 'fixed', 'PiggyBank', '#3b82f6', true, 40),
('Ações/ETFs', 'expense', 'variable', 'TrendingUp', '#3b82f6', true, 41),
('Crypto', 'expense', 'variable', 'Bitcoin', '#3b82f6', true, 42)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM DO SETUP
-- ============================================================
-- 
-- Verificações pós-setup:
-- 1. Verifica se todas as tabelas foram criadas
-- 2. Verifica se o RLS está ativo em todas as tabelas
-- 3. Testa criar uma conta (deve criar profile e salary_config automaticamente)
-- 4. Verifica se as categorias pré-definidas aparecem
-- 
-- ============================================================
