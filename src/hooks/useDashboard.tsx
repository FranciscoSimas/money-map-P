import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSalaryConfig } from './useProfile';
import { useCurrentBalances } from './useCurrentBalances';

export interface DashboardData {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  hasData: boolean;
}

export function useDashboardData() {
  const { user } = useAuth();
  const { data: salaryConfig } = useSalaryConfig();
  const { data: currentBalances } = useCurrentBalances();
  
  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Get current month expenses
      const { data: monthlyRecords, error: recordsError } = await supabase
        .from('monthly_records')
        .select(`
          amount,
          category_id,
          categories!inner(
            type
          )
        `)
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .eq('month', currentMonth);
      
      if (recordsError) throw recordsError;
      
      // Calculate expenses and income from monthly records
      let monthlyExpenses = 0;
      let monthlyIncome = 0;
      
      monthlyRecords?.forEach((record: any) => {
        const categoryType = record.categories?.type;
        if (categoryType === 'expense') {
          monthlyExpenses += record.amount || 0;
        } else if (categoryType === 'income') {
          monthlyIncome += record.amount || 0;
        }
      });
      
      // If no monthly records, calculate from salary config
      if (monthlyRecords?.length === 0 && salaryConfig) {
        // Calculate estimated monthly income from salary config
        monthlyIncome = salaryConfig.base_salary || 0;
        
        if (salaryConfig.has_food_allowance && salaryConfig.food_allowance_value) {
          const foodDays = 22; // Default
          monthlyIncome += salaryConfig.food_allowance_value * foodDays;
        }
        
        if (salaryConfig.has_duodecimos && salaryConfig.duodecimos_value) {
          monthlyIncome += salaryConfig.duodecimos_value;
        }
        
        if (salaryConfig.other_income) {
          monthlyIncome += salaryConfig.other_income;
        }
      }
      
      // Calculate current balance
      const currentBalance = 
        (currentBalances?.bank_balance || 0) +
        (currentBalances?.savings_balance || 0) +
        (currentBalances?.investments_balance || 0) +
        (currentBalances?.other_balance || 0);
      
      const monthlySavings = monthlyIncome - monthlyExpenses;
      
      return {
        currentBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        hasData: monthlyRecords && monthlyRecords.length > 0,
      } as DashboardData;
    },
    enabled: !!user?.id,
  });
}
