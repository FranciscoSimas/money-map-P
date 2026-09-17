-- Enable RLS and policies for category preference tables

-- 1) category_color_preferences
ALTER TABLE public.category_color_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_color_preferences FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'category_color_preferences' 
      AND policyname = 'category_color_prefs_select_own'
  ) THEN
    CREATE POLICY category_color_prefs_select_own
      ON public.category_color_preferences
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'category_color_preferences' 
      AND policyname = 'category_color_prefs_modify_own'
  ) THEN
    CREATE POLICY category_color_prefs_modify_own
      ON public.category_color_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2) category_user_preferences
ALTER TABLE public.category_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_user_preferences FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'category_user_preferences' 
      AND policyname = 'category_user_prefs_select_own'
  ) THEN
    CREATE POLICY category_user_prefs_select_own
      ON public.category_user_preferences
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'category_user_preferences' 
      AND policyname = 'category_user_prefs_modify_own'
  ) THEN
    CREATE POLICY category_user_prefs_modify_own
      ON public.category_user_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

