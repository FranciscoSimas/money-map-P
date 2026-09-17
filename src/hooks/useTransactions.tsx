import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isSavingsCategory, isInvestmentCategory } from '@/lib/categoryHelpers';

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  description: string | null;
  date: string;
  type: 'expense' | 'income';
  created_at: string;
  categories?: {
    id: string;
    user_id?: string | null;
    name: string;
    type: 'expense' | 'income';
    color: string | null;
    icon: string | null;
  };
}

type BalanceDeltas = {
  bank: number;
  savings: number;
  investments: number;
  other: number;
};

function getBalanceDeltas(
  type: 'expense' | 'income',
  amount: number,
  categoryName: string
): BalanceDeltas {
  const deltas: BalanceDeltas = {
    bank: 0,
    savings: 0,
    investments: 0,
    other: 0,
  };

  if (type === 'income') {
    deltas.bank += amount;
    if (isInvestmentCategory(categoryName)) {
      deltas.investments -= amount;
    }
    return deltas;
  }

  deltas.bank -= amount;
  if (isSavingsCategory(categoryName)) {
    deltas.savings += amount;
  } else if (isInvestmentCategory(categoryName)) {
    deltas.investments += amount;
  }

  return deltas;
}

function subtractDeltas(a: BalanceDeltas, b: BalanceDeltas): BalanceDeltas {
  return {
    bank: a.bank - b.bank,
    savings: a.savings - b.savings,
    investments: a.investments - b.investments,
    other: a.other - b.other,
  };
}

function invertDeltas(deltas: BalanceDeltas): BalanceDeltas {
  return {
    bank: -deltas.bank,
    savings: -deltas.savings,
    investments: -deltas.investments,
    other: -deltas.other,
  };
}

async function applyBalanceDeltas(userId: string, deltas: BalanceDeltas) {
  if (!deltas.bank && !deltas.savings && !deltas.investments && !deltas.other) {
    return;
  }

  const { data: currentBalances, error: fetchError } = await supabase
    .from('current_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const nextValues = {
    user_id: userId,
    bank_balance: (currentBalances?.bank_balance || 0) + deltas.bank,
    savings_balance: (currentBalances?.savings_balance || 0) + deltas.savings,
    investments_balance: (currentBalances?.investments_balance || 0) + deltas.investments,
    other_balance: (currentBalances?.other_balance || 0) + deltas.other,
  };

  if (currentBalances) {
    const { error: updateError } = await supabase
      .from('current_balances')
      .update({
        bank_balance: nextValues.bank_balance,
        savings_balance: nextValues.savings_balance,
        investments_balance: nextValues.investments_balance,
        other_balance: nextValues.other_balance,
      })
      .eq('user_id', userId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('current_balances')
      .insert(nextValues);
    if (insertError) throw insertError;
  }
}

export function useTransactions(year?: number, month?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['transactions', user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (
            id,
            user_id,
            name,
            type,
            color,
            icon
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (year && month) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        // Get last day of the month: new Date(year, month, 0) where month is 1-12
        // JavaScript months are 0-11, so month (1-12) becomes month (0-11) for the date constructor
        // To get last day of month N, we use new Date(year, N, 0) where N is the next month (1-indexed)
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      const { data: colorPrefs } = await supabase
        .from('category_color_preferences')
        .select('category_id,color')
        .eq('user_id', user.id);

      const colorMap = new Map<string, string>();
      (colorPrefs || []).forEach((pref: any) => {
        if (pref.category_id && pref.color) {
          colorMap.set(pref.category_id, pref.color);
        }
      });

      const transactionsWithEffectiveColors = ((data || []) as Transaction[]).map((transaction) => {
        if (!transaction.categories) return transaction;

        const category = transaction.categories;
        const overrideColor = category.user_id === null ? colorMap.get(category.id) : undefined;

        if (!overrideColor) return transaction;

        return {
          ...transaction,
          categories: {
            ...category,
            color: overrideColor,
          },
        };
      });

      return transactionsWithEffectiveColors;
    },
    enabled: !!user?.id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (transaction: {
      category_id: string;
      amount: number;
      description?: string | null;
      date?: string;
      type: 'expense' | 'income';
      receipt_id?: string | null;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Get category info to check if it's savings/investment
      const { data: category } = await supabase
        .from('categories')
        .select('name')
        .eq('id', transaction.category_id)
        .single();
      
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transaction,
          user_id: user.id,
          date: transaction.date || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // If it's an income transaction (but NOT salary), add the amount to monthly_income for that month
      // Salary transactions are handled separately when user edits income manually
      if (transaction.type === 'income') {
        // Check if this is a salary transaction (should not be added to monthly_income)
        const isSalaryTransaction = category?.name?.toLowerCase().includes('salário') || 
                                    category?.name?.toLowerCase().includes('salario') ||
                                    transaction.description?.toLowerCase().includes('salário') ||
                                    transaction.description?.toLowerCase().includes('salario');
        
        // Only add to monthly_income if it's NOT a salary transaction
        if (!isSalaryTransaction) {
          const transactionDate = new Date(transaction.date || new Date().toISOString().split('T')[0]);
          const year = transactionDate.getFullYear();
          const month = transactionDate.getMonth() + 1;
          
          // SIMPLE: Just add this transaction amount to the current monthly_income
          // Retry logic to ensure we get the latest monthly_income value
          let retries = 3;
          let currentIncome = 0;
          
          while (retries > 0) {
            const { data: currentMonthlyIncome, error: fetchError } = await supabase
              .from('monthly_income')
              .select('income')
              .eq('user_id', user.id)
              .eq('year', year)
              .eq('month', month)
              .maybeSingle();
            
            if (fetchError) {
              console.error('Error fetching monthly_income:', fetchError);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
              }
              break;
            }
            
            currentIncome = currentMonthlyIncome?.income ?? 0;
            break;
          }
          
          // Simply add the new transaction amount to the current income
          const newIncome = currentIncome + transaction.amount;
          
          // Upsert monthly_income with the new total
          const { error: upsertError } = await supabase
            .from('monthly_income')
            .upsert({
              user_id: user.id,
              year,
              month,
              income: newIncome,
              notes: null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,year,month',
            });
          
          if (upsertError) {
            console.error('Error updating monthly_income:', upsertError);
            throw new Error(`Failed to update monthly_income: ${upsertError.message}`);
          }
        }
      }
      
      if (category) {
        const deltas = getBalanceDeltas(transaction.type, transaction.amount, category.name);
        await applyBalanceDeltas(user.id, deltas);
      }
      
      return data;
    },
    onSuccess: async () => {
      // Small delay to ensure database consistency before invalidating queries
      await new Promise(resolve => setTimeout(resolve, 100));
      
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_records'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['current_balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      // Get old transaction to calculate balance changes
      const { data: oldTransaction } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('id', id)
        .single();
      
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select('*, categories(name)')
        .single();
        
      if (error) throw error;
      
      // If it's an income transaction and amount/date changed, update monthly_income
      // For salary transactions, we need to recalculate the total monthly_income
      if (oldTransaction && data.type === 'income' && user?.id && 
          (updates.amount !== undefined || updates.date !== undefined)) {
        // Check if this is a salary transaction
        const oldCategoryName = (oldTransaction.categories as any)?.name || '';
        const newCategoryName = (data.categories as any)?.name || '';
        const isSalaryTransaction = oldCategoryName.toLowerCase().includes('salário') || 
                                     oldCategoryName.toLowerCase().includes('salario') ||
                                     newCategoryName.toLowerCase().includes('salário') ||
                                     newCategoryName.toLowerCase().includes('salario') ||
                                     oldTransaction.description?.toLowerCase().includes('salário') ||
                                     oldTransaction.description?.toLowerCase().includes('salario') ||
                                     data.description?.toLowerCase().includes('salário') ||
                                     data.description?.toLowerCase().includes('salario');
        
        const oldDate = new Date(oldTransaction.date);
        const oldYear = oldDate.getFullYear();
        const oldMonth = oldDate.getMonth() + 1;
        const oldAmount = oldTransaction.amount;
        
        const newDate = new Date(data.date);
        const newYear = newDate.getFullYear();
        const newMonth = newDate.getMonth() + 1;
        const newAmount = data.amount;
        
        if (isSalaryTransaction) {
          // For salary transactions, recalculate monthly_income based on all income transactions
          // Get all income transactions for the new month (excluding this salary transaction)
          const startDate = `${newYear}-${String(newMonth).padStart(2, '0')}-01`;
          const lastDay = new Date(newYear, newMonth, 0).getDate();
          const endDate = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          const { data: allIncomeTransactions } = await supabase
            .from('transactions')
            .select('id, amount, description, categories(name)')
            .eq('user_id', user.id)
            .eq('type', 'income')
            .gte('date', startDate)
            .lte('date', endDate);
          
          // Filter out salary transactions (excluding the one being updated)
          const nonSalaryTransactions = (allIncomeTransactions || [])
            .filter(t => t.id !== data.id)
            .filter(t => {
              const catName = (t.categories as any)?.name || '';
              const desc = t.description || '';
              return !catName.toLowerCase().includes('salário') && 
                     !catName.toLowerCase().includes('salario') &&
                     !desc.toLowerCase().includes('salário') &&
                     !desc.toLowerCase().includes('salario');
            });
          
          // Calculate total: salary amount + other income transactions
          const totalFromTransactions = nonSalaryTransactions.reduce((sum, t) => sum + t.amount, 0);
          const newTotalIncome = newAmount + totalFromTransactions;
          
          // Update monthly_income with the new total
          await supabase
            .from('monthly_income')
            .upsert({
              user_id: user.id,
              year: newYear,
              month: newMonth,
              income: newTotalIncome,
              notes: null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,year,month',
            });
          
          // If month changed, also update old month (recalculate without this transaction)
          if (oldYear !== newYear || oldMonth !== newMonth) {
            const oldStartDate = `${oldYear}-${String(oldMonth).padStart(2, '0')}-01`;
            const oldLastDay = new Date(oldYear, oldMonth, 0).getDate();
            const oldEndDate = `${oldYear}-${String(oldMonth).padStart(2, '0')}-${String(oldLastDay).padStart(2, '0')}`;
            
            const { data: oldAllIncomeTransactions } = await supabase
              .from('transactions')
              .select('id, amount, description, categories(name)')
              .eq('user_id', user.id)
              .eq('type', 'income')
              .gte('date', oldStartDate)
              .lte('date', oldEndDate);
            
            const oldNonSalaryTransactions = (oldAllIncomeTransactions || [])
              .filter(t => t.id !== oldTransaction.id)
              .filter(t => {
                const catName = (t.categories as any)?.name || '';
                const desc = t.description || '';
                return !catName.toLowerCase().includes('salário') && 
                       !catName.toLowerCase().includes('salario') &&
                       !desc.toLowerCase().includes('salário') &&
                       !desc.toLowerCase().includes('salario');
              });
            
            const oldTotalFromTransactions = oldNonSalaryTransactions.reduce((sum, t) => sum + t.amount, 0);
            
            await supabase
              .from('monthly_income')
              .upsert({
                user_id: user.id,
                year: oldYear,
                month: oldMonth,
                income: oldTotalFromTransactions,
                notes: null,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,year,month',
              });
          }
        } else {
          // For non-salary income transactions, just add/subtract the difference
          const oldDate = new Date(oldTransaction.date);
          const oldYear = oldDate.getFullYear();
          const oldMonth = oldDate.getMonth() + 1;
          const oldAmount = oldTransaction.amount;
          
          const newDate = new Date(data.date);
          const newYear = newDate.getFullYear();
          const newMonth = newDate.getMonth() + 1;
          const newAmount = data.amount;
          
          // Revert old transaction from old month's monthly_income
          if (oldAmount > 0) {
          const { data: oldMonthlyIncome } = await supabase
            .from('monthly_income')
            .select('income')
            .eq('user_id', user.id)
            .eq('year', oldYear)
            .eq('month', oldMonth)
            .maybeSingle();
          
          const oldIncome = oldMonthlyIncome?.income || 0;
          const updatedOldIncome = Math.max(0, oldIncome - oldAmount);
          
          await supabase
            .from('monthly_income')
            .upsert({
              user_id: user.id,
              year: oldYear,
              month: oldMonth,
              income: updatedOldIncome,
              notes: null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,year,month',
            });
        }
        
          // Add new transaction to new month's monthly_income
          if (newAmount > 0) {
            const { data: newMonthlyIncome } = await supabase
              .from('monthly_income')
              .select('income')
              .eq('user_id', user.id)
              .eq('year', newYear)
              .eq('month', newMonth)
              .maybeSingle();
            
            const currentIncome = newMonthlyIncome?.income || 0;
            const updatedNewIncome = currentIncome + newAmount;
            
            await supabase
              .from('monthly_income')
              .upsert({
                user_id: user.id,
                year: newYear,
                month: newMonth,
                income: updatedNewIncome,
                notes: null,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,year,month',
              });
          }
        }
      }
      
      if (
        oldTransaction &&
        user?.id &&
        (updates.amount !== undefined || updates.category_id !== undefined || updates.type !== undefined)
      ) {
        const oldCategoryName = (oldTransaction.categories as any)?.name || '';
        let newCategoryName = oldCategoryName;

        if (updates.category_id) {
          const { data: newCategory } = await supabase
            .from('categories')
            .select('name')
            .eq('id', updates.category_id)
            .single();
          newCategoryName = newCategory?.name || oldCategoryName;
        }

        const oldType = oldTransaction.type as 'expense' | 'income';
        const newType = (updates.type ?? data.type) as 'expense' | 'income';
        const oldAmount = oldTransaction.amount;
        const newAmount = updates.amount !== undefined ? updates.amount : data.amount;

        const oldDeltas = getBalanceDeltas(oldType, oldAmount, oldCategoryName);
        const newDeltas = getBalanceDeltas(newType, newAmount, newCategoryName);
        const netDeltas = subtractDeltas(newDeltas, oldDeltas);

        await applyBalanceDeltas(user.id, netDeltas);
      }
      
      return data;
    },
    onSuccess: async () => {
      // Small delay to ensure database consistency before invalidating queries
      await new Promise(resolve => setTimeout(resolve, 100));
      
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_records'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['current_balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Get transaction before deleting to revert balance changes
      const { data: transaction } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // If it's an income transaction (but NOT salary), subtract from monthly_income
      if (transaction && transaction.type === 'income' && user?.id) {
        // Check if this is a salary transaction (should not affect monthly_income)
        const categoryName = (transaction.categories as any)?.name || '';
        const isSalaryTransaction = categoryName.toLowerCase().includes('salário') || 
                                     categoryName.toLowerCase().includes('salario') ||
                                     transaction.description?.toLowerCase().includes('salário') ||
                                     transaction.description?.toLowerCase().includes('salario');
        
        // Only update monthly_income if it's NOT a salary transaction
        if (!isSalaryTransaction) {
          const transactionDate = new Date(transaction.date);
          const year = transactionDate.getFullYear();
          const month = transactionDate.getMonth() + 1;
          const amount = transaction.amount;
          
          // Retry logic to ensure we get the latest monthly_income value
          let retries = 3;
          let currentIncome = 0;
          
          while (retries > 0) {
            const { data: currentMonthlyIncome, error: fetchError } = await supabase
              .from('monthly_income')
              .select('income')
              .eq('user_id', user.id)
              .eq('year', year)
              .eq('month', month)
              .maybeSingle();
            
            if (fetchError) {
              console.error('Error fetching monthly_income:', fetchError);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
                continue;
              }
              break;
            }
            
            currentIncome = currentMonthlyIncome?.income || 0;
            break;
          }
          
          // Subtract the transaction amount from monthly_income
          const newIncome = Math.max(0, currentIncome - amount);
          
          // Update monthly_income
          const { error: upsertError } = await supabase
            .from('monthly_income')
            .upsert({
              user_id: user.id,
              year,
              month,
              income: newIncome,
              notes: null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,year,month',
            });
          
          if (upsertError) {
            console.error('Error updating monthly_income:', upsertError);
            throw new Error(`Failed to update monthly_income: ${upsertError.message}`);
          }
        }
      }
      
      if (transaction && user?.id) {
        const categoryName = (transaction.categories as any)?.name || '';
        const deltas = getBalanceDeltas(transaction.type, transaction.amount, categoryName);
        await applyBalanceDeltas(user.id, invertDeltas(deltas));
      }
    },
    onSuccess: async () => {
      // Small delay to ensure database consistency before invalidating queries
      await new Promise(resolve => setTimeout(resolve, 100));
      
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_records'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['current_balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
    },
  });
}

