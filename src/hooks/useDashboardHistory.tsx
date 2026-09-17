import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSalaryConfig } from './useProfile';
import { useCurrentBalances } from './useCurrentBalances';
import { isSavingsCategory, isInvestmentCategory, netMonthlySavingsAmount } from '@/lib/categoryHelpers';
// Credits removed - they are separate simulations and don't affect balance/expenses

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface MonthRange {
  startYear: number;
  startMonth: number; // 1-12
  endYear: number;
  endMonth: number; // 1-12
}

export interface DashboardHistoryData {
  period: string; // '6M', '12M', etc
  totalIncome: number;
  totalExpenses: number; // Todas as despesas (incluindo poupança e investimento)
  totalExpensesWithoutSavings: number; // Despesas sem poupança e investimento
  totalSavingsAmount: number; // Total de poupança
  totalInvestmentsAmount: number; // Total de investimentos
  totalSavings: number; // Receitas - Despesas (poupança líquida)
  averageIncome: number;
  averageExpenses: number;
  averageExpensesWithoutSavings: number;
  averageSavingsAmount: number;
  averageInvestmentsAmount: number;
  averageSavings: number;
  months: Array<{
    year: number;
    month: number;
    income: number;
    expenses: number;
    expensesWithoutSavings: number;
    savingsAmount: number;
    investmentsAmount: number;
    savings: number;
    bankBalance: number; // Saldo no banco no fim do mês (ancorado no saldo real atual)
    totalBalance: number; // Saldo total (banco + poupança + investimentos + outros) no fim do mês
  }>;
  expensesByCategory: CategoryExpense[]; // Despesas agrupadas por categoria (apenas meses do intervalo)
}

type InternalMonthEntry = DashboardHistoryData['months'][number] & {
  withdrawalsTotal: number;
  grossExpenses: number;
  grossSavingsAmount?: number;
};

// Converte year/month para um índice linear para facilitar comparações
const toMonthIndex = (year: number, month: number) => year * 12 + (month - 1);

export function useDashboardHistory(monthsOrRange: number | MonthRange = 12) {
  const { user } = useAuth();
  const { data: salaryConfig } = useSalaryConfig();
  const { data: currentBalances, isLoading: isLoadingBalances } = useCurrentBalances();

  const now = new Date();
  const nowIndex = toMonthIndex(now.getFullYear(), now.getMonth() + 1);

  // Normalizar o argumento: número de meses (retro-compatível) ou intervalo livre
  let startIndex: number;
  let endIndex: number;

  if (typeof monthsOrRange === 'number') {
    endIndex = nowIndex;
    startIndex = nowIndex - (monthsOrRange - 1);
  } else {
    startIndex = toMonthIndex(monthsOrRange.startYear, monthsOrRange.startMonth);
    endIndex = toMonthIndex(monthsOrRange.endYear, monthsOrRange.endMonth);
  }

  // Não permitir meses futuros nem intervalos invertidos
  endIndex = Math.min(endIndex, nowIndex);
  startIndex = Math.min(startIndex, endIndex);

  return useQuery({
    queryKey: [
      'dashboard_history',
      user?.id,
      startIndex,
      endIndex,
      currentBalances?.bank_balance,
      currentBalances?.savings_balance,
      currentBalances?.investments_balance,
      currentBalances?.other_balance,
    ],
    queryFn: async () => {
      if (!user?.id) return null;

      // Para ancorar o saldo no valor real ATUAL, calculamos sempre até ao mês corrente,
      // mesmo que o intervalo pedido termine no passado. Depois devolvemos só o intervalo.
      const computeEndIndex = nowIndex;

      const monthsData: InternalMonthEntry[] = [];
      const expensesByCategoryMap = new Map<string, CategoryExpense>();

      for (let idx = startIndex; idx <= computeEndIndex; idx++) {
        const year = Math.floor(idx / 12);
        const month = (idx % 12) + 1;
        const inRange = idx >= startIndex && idx <= endIndex;

        const { data, error } = await supabase
          .from('monthly_records')
          .select(`
            amount,
            category_id,
            categories!inner (
              id,
              name,
              type
            )
          `)
          .eq('user_id', user.id)
          .eq('year', year)
          .eq('month', month);

        if (error) throw error;

        let income = 0;
        let expenses = 0;
        let expensesWithoutSavings = 0;
        let savingsAmount = 0;
        let investmentsAmount = 0;

        data?.forEach((record: any) => {
          const category = record.categories;
          const amount = record.amount || 0;

          if (category?.type === 'income') {
            income += amount;
          } else if (category?.type === 'expense') {
            expenses += amount;

            if (isSavingsCategory(category.name)) {
              savingsAmount += amount;
            } else if (isInvestmentCategory(category.name)) {
              investmentsAmount += amount;
            } else {
              expensesWithoutSavings += amount;
            }
          }
        });

        // Agregação por categoria a partir de monthly_records (apenas meses do intervalo pedido)
        if (inRange) {
          data?.forEach((record: any) => {
            const category = record.categories;
            const amount = record.amount || 0;
            if (category?.type === 'expense') {
              const existing = expensesByCategoryMap.get(category.id);
              if (existing) {
                existing.amount += amount;
              } else {
                expensesByCategoryMap.set(category.id, {
                  categoryId: category.id,
                  categoryName: category.name,
                  amount,
                });
              }
            }
          });
        }

        // Override de receitas com monthly_income, se existir
        const { data: monthlyIncomeData, error: monthlyIncomeError } = await supabase
          .from('monthly_income')
          .select('income')
          .eq('user_id', user.id)
          .eq('year', year)
          .eq('month', month)
          .maybeSingle();

        if (!monthlyIncomeError && monthlyIncomeData) {
          income = monthlyIncomeData.income || 0;
        }

        // Transações do mês (fonte de verdade para despesas quando existem)
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select(`
            amount,
            type,
            categories!inner (
              id,
              name,
              type
            )
          `)
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (!transactionsError && transactionsData && transactionsData.length > 0) {
          // Recalcular despesas a partir das transações
          expenses = 0;
          expensesWithoutSavings = 0;
          savingsAmount = 0;
          investmentsAmount = 0;

          // Limpar contribuição deste mês na agregação por categoria (monthly_records)
          // e substituir pelos valores das transações
          if (inRange) {
            data?.forEach((record: any) => {
              const category = record.categories;
              const amount = record.amount || 0;
              if (category?.type === 'expense') {
                const existing = expensesByCategoryMap.get(category.id);
                if (existing) {
                  existing.amount -= amount;
                  if (existing.amount <= 0) {
                    expensesByCategoryMap.delete(category.id);
                  }
                }
              }
            });
          }

          transactionsData.forEach((transaction: any) => {
            const category = transaction.categories;
            const amount = transaction.amount || 0;

            if (transaction.type === 'expense' || category?.type === 'expense') {
              expenses += amount;

              if (isSavingsCategory(category.name)) {
                savingsAmount += amount;
              } else if (isInvestmentCategory(category.name)) {
                investmentsAmount += amount;
              } else {
                expensesWithoutSavings += amount;
              }

              if (inRange) {
                const existing = expensesByCategoryMap.get(category.id);
                if (existing) {
                  existing.amount += amount;
                } else {
                  expensesByCategoryMap.set(category.id, {
                    categoryId: category.id,
                    categoryName: category.name,
                    amount,
                  });
                }
              }
            }
            // Receitas já vêm de monthly_income (evita dupla contagem)
          });

          // Fallback de receitas via configuração salarial
          if (!monthlyIncomeData && salaryConfig) {
            const { calculateNetSalary } = await import('@/lib/salaryCalculator');
            const calculation = calculateNetSalary({
              baseSalary: salaryConfig.base_salary,
              hasFoodAllowance: salaryConfig.has_food_allowance,
              foodAllowanceValue: salaryConfig.food_allowance_value || 0,
              foodAllowanceType: (salaryConfig.food_allowance_type as 'card' | 'cash') || 'card',
              foodAllowanceDays: salaryConfig.food_allowance_days || 22,
              duodecimosType: salaryConfig.has_duodecimos ? 'both' : 'none',
              has13thMonth: salaryConfig.has_13th_month,
              has14thMonth: salaryConfig.has_14th_month,
              otherIncomeExempt: 0,
              otherIncomeIRSOnly: 0,
              otherIncomeIRSandSS: salaryConfig.other_income || 0,
              maritalStatus: (salaryConfig.marital_status as any) || 'single',
              dependents: salaryConfig.dependents || 0,
              hasIRSJovem: salaryConfig.has_irs_jovem || false,
              irsJovemYear: salaryConfig.irs_jovem_year as 1 | 2 | 3 | undefined,
            });
            income = calculation.monthlyNet;
          }
        } else if (!monthlyIncomeData && data?.length === 0 && salaryConfig) {
          // Sem registos e sem transações: estimar receitas via configuração salarial
          const { calculateNetSalary } = await import('@/lib/salaryCalculator');
          const calculation = calculateNetSalary({
            baseSalary: salaryConfig.base_salary,
            hasFoodAllowance: salaryConfig.has_food_allowance,
            foodAllowanceValue: salaryConfig.food_allowance_value || 0,
            foodAllowanceType: (salaryConfig.food_allowance_type as 'card' | 'cash') || 'card',
            foodAllowanceDays: salaryConfig.food_allowance_days || 22,
            duodecimosType: salaryConfig.has_duodecimos ? 'both' : 'none',
            has13thMonth: salaryConfig.has_13th_month,
            has14thMonth: salaryConfig.has_14th_month,
            otherIncomeExempt: 0,
            otherIncomeIRSOnly: 0,
            otherIncomeIRSandSS: salaryConfig.other_income || 0,
            maritalStatus: (salaryConfig.marital_status as any) || 'single',
            dependents: salaryConfig.dependents || 0,
            hasIRSJovem: salaryConfig.has_irs_jovem || false,
            irsJovemYear: salaryConfig.irs_jovem_year as 1 | 2 | 3 | undefined,
          });
          income = calculation.monthlyNet;
        }

        const savings = income - expenses;

        monthsData.push({
          year,
          month,
          income,
          expenses,
          expensesWithoutSavings,
          savingsAmount,
          investmentsAmount,
          savings,
          bankBalance: 0, // Calculado abaixo (de trás para a frente)
          totalBalance: 0, // Calculado abaixo (de trás para a frente)
          withdrawalsTotal: 0, // Retiradas da poupança para o banco neste mês
          grossExpenses: expenses, // Despesas brutas (antes de ajustar poupança líquida)
        });
      }

      // Buscar retiradas da poupança no intervalo calculado
      const computeStartYear = Math.floor(startIndex / 12);
      const computeStartMonth = (startIndex % 12) + 1;
      const computeEndYear = Math.floor(computeEndIndex / 12);
      const computeEndMonth = (computeEndIndex % 12) + 1;
      const withdrawalsStartDate = `${computeStartYear}-${String(computeStartMonth).padStart(2, '0')}-01`;
      const withdrawalsEndLastDay = new Date(computeEndYear, computeEndMonth, 0).getDate();
      const withdrawalsEndDate = `${computeEndYear}-${String(computeEndMonth).padStart(2, '0')}-${String(withdrawalsEndLastDay).padStart(2, '0')}`;

      const { data: savingsWithdrawalsData, error: savingsWithdrawalsError } = await supabase
        .from('savings_withdrawals')
        .select('amount, date')
        .eq('user_id', user.id)
        .gte('date', withdrawalsStartDate)
        .lte('date', withdrawalsEndDate);

      if (savingsWithdrawalsError) throw savingsWithdrawalsError;

      const withdrawalsByMonthKey = new Map<string, number>();
      (savingsWithdrawalsData || []).forEach((withdrawal) => {
        const monthKey = withdrawal.date.slice(0, 7);
        withdrawalsByMonthKey.set(
          monthKey,
          (withdrawalsByMonthKey.get(monthKey) || 0) + (withdrawal.amount || 0)
        );
      });

      // Ajustar poupança líquida e despesas de cada mês
      monthsData.forEach((month) => {
        const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`;
        const withdrawals = withdrawalsByMonthKey.get(monthKey) || 0;
        const grossSavings = month.savingsAmount;
        const netSavings = netMonthlySavingsAmount(grossSavings, withdrawals);
        const savingsReduction = grossSavings - netSavings;

        month.withdrawalsTotal = withdrawals;
        month.grossSavingsAmount = grossSavings;
        month.savingsAmount = netSavings;
        month.expenses -= savingsReduction;
        month.savings = month.income - month.expenses;
      });

      // ============================================================
      // Saldos calculados DE TRÁS PARA A FRENTE, ancorados nos saldos
      // reais atuais (current_balances). Assim o histórico é sempre
      // coerente com o presente e não muda quando o mês vira.
      // ============================================================
      const currentBank = currentBalances?.bank_balance || 0;
      const currentTotal =
        currentBank +
        (currentBalances?.savings_balance || 0) +
        (currentBalances?.investments_balance || 0) +
        (currentBalances?.other_balance || 0);

      const lastIdx = monthsData.length - 1;
      if (lastIdx >= 0) {
        // O último mês calculado é o mês corrente: fim do mês = saldo real de agora
        monthsData[lastIdx].bankBalance = currentBank;
        monthsData[lastIdx].totalBalance = currentTotal;

        for (let i = lastIdx - 1; i >= 0; i--) {
          const nextMonth = monthsData[i + 1];
          // Retiradas da poupança voltam ao banco mas não estão nas despesas
          const nextBankChange =
            nextMonth.income - (nextMonth.grossExpenses ?? nextMonth.expenses) + (nextMonth.withdrawalsTotal || 0);
          monthsData[i].bankBalance = monthsData[i + 1].bankBalance - nextBankChange;

          // Variação do saldo TOTAL = receitas - despesas sem poupança/investimento
          // (transferências internas não alteram o total)
          const nextTotalChange = nextMonth.income - nextMonth.expensesWithoutSavings;
          monthsData[i].totalBalance = monthsData[i + 1].totalBalance - nextTotalChange;
        }
      }

      // Devolver apenas os meses do intervalo pedido (sem campos internos)
      const rangeMonths = monthsData
        .filter((m) => {
          const idx = toMonthIndex(m.year, m.month);
          return idx >= startIndex && idx <= endIndex;
        })
        .map(({ withdrawalsTotal, grossExpenses, grossSavingsAmount, ...month }) => month);

      // Ajustar totais de poupança na agregação por categoria
      const totalGrossSavingsInRange = monthsData
        .filter((m) => {
          const idx = toMonthIndex(m.year, m.month);
          return idx >= startIndex && idx <= endIndex;
        })
        .reduce((sum, m) => sum + (m.grossSavingsAmount || m.savingsAmount), 0);
      const totalNetSavingsInRange = rangeMonths.reduce((sum, m) => sum + m.savingsAmount, 0);

      if (totalGrossSavingsInRange > 0 && totalNetSavingsInRange !== totalGrossSavingsInRange) {
        expensesByCategoryMap.forEach((cat) => {
          if (isSavingsCategory(cat.categoryName)) {
            cat.amount = cat.amount * (totalNetSavingsInRange / totalGrossSavingsInRange);
          }
        });
      }

      const totalIncome = rangeMonths.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = rangeMonths.reduce((sum, m) => sum + m.expenses, 0);
      const totalExpensesWithoutSavings = rangeMonths.reduce((sum, m) => sum + m.expensesWithoutSavings, 0);
      const totalSavingsAmount = rangeMonths.reduce((sum, m) => sum + m.savingsAmount, 0);
      const totalInvestmentsAmount = rangeMonths.reduce((sum, m) => sum + m.investmentsAmount, 0);
      const totalSavings = totalIncome - totalExpenses;

      const expensesByCategory = Array.from(expensesByCategoryMap.values())
        .sort((a, b) => b.amount - a.amount);

      const count = rangeMonths.length;

      return {
        period: `${count}M`,
        totalIncome,
        totalExpenses,
        totalExpensesWithoutSavings,
        totalSavingsAmount,
        totalInvestmentsAmount,
        totalSavings,
        averageIncome: count > 0 ? totalIncome / count : 0,
        averageExpenses: count > 0 ? totalExpenses / count : 0,
        averageExpensesWithoutSavings: count > 0 ? totalExpensesWithoutSavings / count : 0,
        averageSavingsAmount: count > 0 ? totalSavingsAmount / count : 0,
        averageInvestmentsAmount: count > 0 ? totalInvestmentsAmount / count : 0,
        averageSavings: count > 0 ? totalSavings / count : 0,
        months: rangeMonths,
        expensesByCategory,
      } as DashboardHistoryData;
    },
    enabled: !!user?.id && !isLoadingBalances,
  });
}
