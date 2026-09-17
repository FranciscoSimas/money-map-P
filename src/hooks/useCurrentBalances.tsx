import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CurrentBalances {
  id: string;
  user_id: string;
  bank_balance: number;
  savings_balance: number;
  investments_balance: number;
  other_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCurrentBalances() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['current_balances', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('current_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data as CurrentBalances | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateCurrentBalances() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (balances: Partial<CurrentBalances>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Check if record exists
      const { data: existing } = await supabase
        .from('current_balances')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('current_balances')
          .update(balances)
          .eq('user_id', user.id)
          .select()
          .single();
          
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('current_balances')
          .insert({
            ...balances,
            user_id: user.id,
          })
          .select()
          .single();
          
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current_balances'] });
    },
  });
}
