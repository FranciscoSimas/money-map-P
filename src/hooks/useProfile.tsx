import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';


export interface SalaryConfig {
  id: string;
  user_id: string;
  base_salary: number;
  has_food_allowance: boolean;
  food_allowance_value: number | null;
  food_allowance_type: string | null;
  food_allowance_days: number | null;
  has_duodecimos: boolean;
  duodecimos_value: number | null;
  has_13th_month: boolean;
  has_14th_month: boolean;
  other_income: number | null;
  other_income_description: string | null;
  payment_day: number | null;
  marital_status: string | null;
  dependents: number | null;
  has_irs_jovem: boolean | null;
  irs_jovem_year: number | null;
  vacation_payment_day: number | null;
  christmas_payment_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  selected_categories: string[] | null;
  hidden_categories: string[] | null; // IDs de categorias pré-definidas ocultas pelo utilizador
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });
}

export function useSalaryConfig() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['salary_config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('salary_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data as SalaryConfig | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateSalaryConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<SalaryConfig>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('salary_config')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary_config'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
    },
  });
}
