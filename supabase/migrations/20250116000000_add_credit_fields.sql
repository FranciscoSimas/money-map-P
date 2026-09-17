-- Add missing columns to credits table if they don't exist
-- This migration ensures all credit fields are available

DO $$ 
BEGIN
  -- Add tan_rate if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credits' 
    AND column_name = 'tan_rate'
  ) THEN
    ALTER TABLE public.credits ADD COLUMN tan_rate DECIMAL(5,3);
  END IF;

  -- Add taeg_rate if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credits' 
    AND column_name = 'taeg_rate'
  ) THEN
    ALTER TABLE public.credits ADD COLUMN taeg_rate DECIMAL(5,3);
  END IF;

  -- Add down_payment if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credits' 
    AND column_name = 'down_payment'
  ) THEN
    ALTER TABLE public.credits ADD COLUMN down_payment DECIMAL(12,2);
  END IF;
END $$;
