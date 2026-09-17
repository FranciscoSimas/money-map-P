import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Credit {
  id: string;
  user_id: string;
  name: string;
  credit_type: 'car' | 'house' | 'personal' | 'other';
  total_amount: number;
  remaining_amount: number;
  monthly_payment: number;
  interest_rate: number | null;
  tan_rate: number | null; // Taxa Anual Nominal
  taeg_rate: number | null; // Taxa Anual Efetiva Global
  down_payment: number | null; // Entrada
  start_date: string;
  end_date: string | null;
  total_months: number | null;
  is_active: boolean;
  amortization_scenarios?: Array<{ month: number; amount: number }>; // Cenários de amortização antecipada
  created_at: string;
  updated_at: string;
}

export function useCredits() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Credit[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateCredit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (credit: Omit<Credit, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('credits')
        .insert({
          ...credit,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
}

export function useUpdateCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Credit> & { id: string }) => {
      const { data, error } = await supabase
        .from('credits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
}

export function useDeleteCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('credits')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
}
