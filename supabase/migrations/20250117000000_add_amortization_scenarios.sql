-- Add amortization_scenarios column to credits table
-- This will store the user's amortization simulation scenarios as JSONB
ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS amortization_scenarios JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.credits.amortization_scenarios IS 'Array of amortization scenarios: [{month: number, amount: number}]';
