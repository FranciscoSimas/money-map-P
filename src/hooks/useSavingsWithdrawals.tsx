import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SavingsWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  goal_id: string | null;
  created_at: string;
}

export function useSavingsWithdrawals(year?: number, month?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['savings_withdrawals', user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('savings_withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (year !== undefined && month !== undefined) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SavingsWithdrawal[];
    },
    enabled: !!user?.id,
  });
}

export function sumSavingsWithdrawals(withdrawals: SavingsWithdrawal[]): number {
  return withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
}
