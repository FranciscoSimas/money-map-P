import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MonthlyIncome {
  id: string;
  user_id: string;
  year: number;
  month: number;
  income: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useMonthlyIncome(year?: number, month?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['monthly_income', user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) return null;
      
      let query = supabase
        .from('monthly_income')
        .select('*')
        .eq('user_id', user.id);
      
      if (year) {
        query = query.eq('year', year);
      }
      if (month) {
        query = query.eq('month', month);
      }
      
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as MonthlyIncome | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpsertMonthlyIncome() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ year, month, income, notes }: { year: number; month: number; income: number; notes?: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('monthly_income')
        .upsert({
          user_id: user.id,
          year,
          month,
          income,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,year,month',
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['monthly_income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

