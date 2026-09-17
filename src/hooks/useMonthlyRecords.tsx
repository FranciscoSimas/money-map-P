import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MonthlyRecord {
  id: string;
  user_id: string;
  category_id: string;
  year: number;
  month: number;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    type: 'expense' | 'income';
    color: string | null;
    icon: string | null;
  };
}

export function useMonthlyRecords(year?: number, month?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['monthly_records', user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('monthly_records')
        .select(`
          *,
          categories (
            id,
            name,
            type,
            color,
            icon
          )
        `)
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (year) {
        query = query.eq('year', year);
      }
      if (month) {
        query = query.eq('month', month);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MonthlyRecord[];
    },
    enabled: !!user?.id,
  });
}

export function useMonthlyRecordsHistory(months: number = 12) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['monthly_records_history', user?.id, months],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const records: Array<{ year: number; month: number; income: number; expenses: number; balance: number }> = [];
      
      // Get records for last N months
      for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        const { data, error } = await supabase
          .from('monthly_records')
          .select(`
            amount,
            categories!inner (
              type
            )
          `)
          .eq('user_id', user.id)
          .eq('year', year)
          .eq('month', month);
        
        if (error) throw error;
        
        let income = 0;
        let expenses = 0;
        
        data?.forEach((record: any) => {
          if (record.categories?.type === 'income') {
            income += record.amount || 0;
          } else if (record.categories?.type === 'expense') {
            expenses += record.amount || 0;
          }
        });
        
        records.push({
          year,
          month,
          income,
          expenses,
          balance: income - expenses,
        });
      }
      
      return records.reverse(); // Oldest first
    },
    enabled: !!user?.id,
  });
}
