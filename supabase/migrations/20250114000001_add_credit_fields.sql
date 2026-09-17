-- Adicionar campos TAN e TAEG à tabela credits
ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS tan_rate DECIMAL(5,3), -- Taxa Anual Nominal
  ADD COLUMN IF NOT EXISTS taeg_rate DECIMAL(5,3), -- Taxa Anual Efetiva Global
  ADD COLUMN IF NOT EXISTS down_payment DECIMAL(12,2); -- Entrada
