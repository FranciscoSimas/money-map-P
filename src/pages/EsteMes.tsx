import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ChevronDown, ChevronUp } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ExpensesChart } from '@/components/dashboard/ExpensesChart';
// Removed QuickAddTransaction import - will be replaced with top buttons
import { TransactionsByCategory } from '@/components/este-mes/TransactionsByCategory';
import { useTransactions } from '@/hooks/useTransactions';
import { useSalaryConfig } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentBalances } from '@/hooks/useCurrentBalances';
// Credits removed - they are separate simulations
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import { useMonthlyIncome, useUpsertMonthlyIncome } from '@/hooks/useMonthlyIncome';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { calculateNetSalary } from '@/lib/salaryCalculator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

// Pre-selected universal colors (same as in Definicoes.tsx)
const UNIVERSAL_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
];
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  Legend,
} from 'recharts';
import { useExpenseCategories, useIncomeCategories } from '@/hooks/useCategories';
import { Plus, TrendingUp as PlusIncome } from 'lucide-react';
import { isSavingsCategory, isInvestmentCategory, netMonthlySavingsAmount } from '@/lib/categoryHelpers';
import { useSavingsWithdrawals, sumSavingsWithdrawals } from '@/hooks/useSavingsWithdrawals';

const formatChartAxisValue = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `€${(value / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}k`;
  }
  return `€${Math.round(value).toLocaleString('pt-PT')}`;
};

export default function EsteMes() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const { data: transactions, isLoading: isLoadingTransactions } = useTransactions(currentYear, currentMonth);
  const { data: savingsWithdrawals } = useSavingsWithdrawals(currentYear, currentMonth);
  const { data: salaryConfig } = useSalaryConfig();
  const { data: currentBalances } = useCurrentBalances();
  // Credits removed - they are separate simulations
  const { data: historyData } = useDashboardHistory(12); // Get 12 months for proper balance calculation
  const { data: monthlyIncomeOverride } = useMonthlyIncome(currentYear, currentMonth);
  const upsertMonthlyIncome = useUpsertMonthlyIncome();
  const queryClient = useQueryClient();
  const { data: expenseCategories } = useExpenseCategories();
  const { data: incomeCategories } = useIncomeCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  
  // Find or get first income category for salary transaction
  const salaryCategoryId = useMemo(() => {
    if (!incomeCategories || incomeCategories.length === 0) return null;
    // Try to find "Salário" category first
    const salaryCategory = incomeCategories.find(cat => 
      cat.name.toLowerCase().includes('salário') || 
      cat.name.toLowerCase().includes('salario')
    );
    return salaryCategory?.id || incomeCategories[0]?.id || null;
  }, [incomeCategories]);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [editingIncomeValue, setEditingIncomeValue] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  
  // Update otherIncome when salaryConfig changes
  useEffect(() => {
    if (salaryConfig?.other_income !== undefined) {
      setOtherIncome(salaryConfig.other_income.toString());
    }
  }, [salaryConfig?.other_income]);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newIncomeDescription, setNewIncomeDescription] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [newIncomeDate, setNewIncomeDate] = useState(new Date().toISOString().split('T')[0]);
  const [pieActiveIndex, setPieActiveIndex] = useState<number | null>(null);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [hiddenChartCategories, setHiddenChartCategories] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('este_mes_hidden_chart_categories');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  
  // Calculate base income (from salary config)
  const baseMonthlyIncome = useMemo(() => {
    if (!salaryConfig) return 0;
    
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
    
    return calculation.monthlyNet;
  }, [salaryConfig]);
  
  // Use override if exists, otherwise use calculated base income
  const monthlyIncome = monthlyIncomeOverride?.income ?? baseMonthlyIncome;
  
  // Find salary transaction (if exists)
  const salaryTransaction = useMemo(() => {
    if (!transactions) return null;
    return transactions.find(t => 
      t.type === 'income' && 
      (t.categories?.name?.toLowerCase().includes('salário') || 
       t.categories?.name?.toLowerCase().includes('salario') ||
       t.description?.toLowerCase().includes('salário') ||
       t.description?.toLowerCase().includes('salario'))
    ) || null;
  }, [transactions]);
  
  // Note: Salary transaction will be created/updated only when user edits the income manually
  
  // Calculate expenses from transactions only (credits are separate simulations)
  // Exclude savings and investments from total expenses (they don't affect total balance)
  const monthlyExpenses = useMemo(() => {
    let expenses = 0;
    
    if (transactions) {
      transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          const categoryName = transaction.categories?.name || '';
          // Only count expenses that affect total balance (exclude savings/investments)
          if (!isSavingsCategory(categoryName) && !isInvestmentCategory(categoryName)) {
            expenses += transaction.amount;
          }
        }
      });
    }
    
    // Credits are NOT included - they are separate simulations
    return expenses;
  }, [transactions]);
  
  // Income from transactions (excluding salary, which is handled separately)
  // This is only for display purposes in the list - monthlyIncome already includes all income
  const incomeFromTransactions = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter(t => t.type === 'income' && t.id !== salaryTransaction?.id)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, salaryTransaction]);
  
  // Use only monthlyIncome (which already includes all income transactions)
  const totalIncome = monthlyIncome;
  
  // Calculate bank balance (saldo atual no banco)
  // Prefer the real current bank balance from current_balances (includes manual transfers),
  // otherwise fall back to the calculated balance from history
  const bankBalance = useMemo(() => {
    if (currentBalances?.bank_balance !== undefined && currentBalances.bank_balance !== null) {
      return currentBalances.bank_balance;
    }
    
    if (!historyData?.months || historyData.months.length === 0) {
      // No history, calculate from current month only
      return totalIncome - monthlyExpenses;
    }
    
    // Fallback: last month's bank balance from history
    return historyData.months[historyData.months.length - 1]?.bankBalance || 0;
  }, [currentBalances, historyData, totalIncome, monthlyExpenses]);
  
  // Calculate savings/investments for current month (poupança líquida + investimentos)
  const monthlySavingsInvestments = useMemo(() => {
    if (!transactions) return 0;

    let savingsDeposits = 0;
    let investments = 0;
    transactions.forEach(transaction => {
      if (transaction.type === 'expense') {
        const categoryName = transaction.categories?.name || '';
        if (isSavingsCategory(categoryName)) {
          savingsDeposits += transaction.amount;
        } else if (isInvestmentCategory(categoryName)) {
          investments += transaction.amount;
        }
      }
    });

    const withdrawals = sumSavingsWithdrawals(savingsWithdrawals || []);
    const netSavings = netMonthlySavingsAmount(savingsDeposits, withdrawals);
    return netSavings + investments;
  }, [transactions, savingsWithdrawals]);

  const monthlySavings = totalIncome - monthlyExpenses - monthlySavingsInvestments;
  
  // Expenses by category for chart (use category color when available)
  const expensesByCategory = useMemo(() => {
    if (!transactions) return [];

    const expenses = transactions
      .filter(t => t.type === 'expense' && t.amount > 0)
      .reduce((acc, transaction) => {
        const catId = transaction.category_id;
        const catName = transaction.categories?.name || 'Outros';
        const catColor = transaction.categories?.color || 'hsl(220, 15%, 50%)';

        const key = catId || catName;
        if (!acc[key]) {
          acc[key] = { id: catId, name: catName, value: 0, color: catColor };
        }
        acc[key].value += transaction.amount;
        return acc;
      }, {} as Record<string, { id: string | null; name: string; value: number; color: string }>);

    // Ajustar poupança para valor líquido do mês (depósitos - retiradas, mínimo 0)
    const totalSavingsDeposits = Object.values(expenses)
      .filter((cat) => isSavingsCategory(cat.name))
      .reduce((sum, cat) => sum + cat.value, 0);
    const withdrawals = sumSavingsWithdrawals(savingsWithdrawals || []);
    const netSavings = netMonthlySavingsAmount(totalSavingsDeposits, withdrawals);

    if (totalSavingsDeposits > 0) {
      (Object.values(expenses) as Array<{ id: string | null; name: string; value: number; color: string }>).forEach((cat) => {
        if (isSavingsCategory(cat.name)) {
          cat.value = cat.value * (netSavings / totalSavingsDeposits);
        }
      });
    } else if (withdrawals > 0) {
      // Sem depósitos no mês mas com retiradas: poupança líquida do mês é 0
      (Object.values(expenses) as Array<{ id: string | null; name: string; value: number; color: string }>).forEach((cat) => {
        if (isSavingsCategory(cat.name)) {
          cat.value = 0;
        }
      });
    }

    const expensesArray: Array<{ id: string | null; name: string; value: number; color: string }> = Object.values(expenses);
    return expensesArray.sort((a, b) => b.value - a.value);
  }, [transactions, savingsWithdrawals]);
  
  // Daily expenses by category - show all days with expenses grouped by category for stacked bars
  const { dailyExpenses, categoryColors, categoryList } = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const expensesByDayAndCategory: Record<number, Record<string, { amount: number; color: string }>> = {};
    const allCategories = new Set<string>();
    const categoryColorMap: Record<string, string> = {};
    
    // Group expenses by day and category
    if (transactions) {
      transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          // Parse date correctly to avoid timezone issues
          // transaction.date is in format YYYY-MM-DD (string), extract day directly
          const dateStr = transaction.date;
          // Handle both string format (YYYY-MM-DD) and Date object
          let dayNum: number;
          if (typeof dateStr === 'string') {
            const parts = dateStr.split('-');
            dayNum = parseInt(parts[2], 10); // Extract day from YYYY-MM-DD
          } else {
            // Fallback: if it's already a Date object, use getDate()
            dayNum = new Date(dateStr).getDate();
          }
          
          const categoryName = transaction.categories?.name || 'Outros';
          const categoryColor = transaction.categories?.color || 'hsl(220, 15%, 50%)';
          
          allCategories.add(categoryName);
          categoryColorMap[categoryName] = categoryColor;
          
          if (!expensesByDayAndCategory[dayNum]) {
            expensesByDayAndCategory[dayNum] = {};
          }
          
          if (!expensesByDayAndCategory[dayNum][categoryName]) {
            expensesByDayAndCategory[dayNum][categoryName] = { amount: 0, color: categoryColor };
          }
          
          expensesByDayAndCategory[dayNum][categoryName].amount += transaction.amount;
        }
      });
    }
    
    // Criar dados diários e ajustar poupança para valor líquido do mês
    const totalSavingsDepositsDaily = Object.values(expensesByDayAndCategory).reduce((sum, dayCats) => {
      return sum + Object.entries(dayCats).reduce((daySum, [catName, data]) => {
        return daySum + (isSavingsCategory(catName) ? data.amount : 0);
      }, 0);
    }, 0);
    const withdrawalsDaily = sumSavingsWithdrawals(savingsWithdrawals || []);
    const netSavingsDaily = netMonthlySavingsAmount(totalSavingsDepositsDaily, withdrawalsDaily);
    const savingsScale =
      totalSavingsDepositsDaily > 0 ? netSavingsDaily / totalSavingsDepositsDaily : 0;

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayExpenses = expensesByDayAndCategory[day] || {};
      const dayData: Record<string, any> = { day };

      allCategories.forEach(catName => {
        let amount = dayExpenses[catName]?.amount || 0;
        if (isSavingsCategory(catName)) {
          amount = amount * savingsScale;
        }
        dayData[catName] = amount;
      });

      return dayData;
    });
    
    return {
      dailyExpenses: dailyData,
      categoryColors: categoryColorMap,
      categoryList: Array.from(allCategories),
    };
  }, [transactions, savingsWithdrawals, currentYear, currentMonth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('este_mes_hidden_chart_categories', JSON.stringify(hiddenChartCategories));
  }, [hiddenChartCategories]);

  const filteredCategoryList = useMemo(
    () => categoryList.filter((catName) => !hiddenChartCategories.includes(catName)),
    [categoryList, hiddenChartCategories]
  );

  const filteredExpensesByCategory = useMemo(
    () =>
      expensesByCategory
        .filter((category) => !hiddenChartCategories.includes(category.name))
        .filter((category) => category.value > 0),
    [expensesByCategory, hiddenChartCategories]
  );

  const horizontalBarChartData = useMemo(
    () =>
      filteredExpensesByCategory.map((category) => ({
        categoria: category.name,
        valor: category.value,
        color: category.color,
      })),
    [filteredExpensesByCategory]
  );

  const filteredDailyExpenses = useMemo(() => {
    return dailyExpenses.map((dayData) => {
      const result: Record<string, any> = { day: dayData.day };
      filteredCategoryList.forEach((categoryName) => {
        result[categoryName] = dayData[categoryName] || 0;
      });
      return result;
    });
  }, [dailyExpenses, filteredCategoryList]);

  const chartCategoryList = useMemo(
    () =>
      filteredCategoryList.filter((categoryName) =>
        filteredDailyExpenses.some((day) => (day[categoryName] || 0) > 0)
      ),
    [filteredCategoryList, filteredDailyExpenses]
  );

  const toggleCategoryVisibility = (categoryName: string, visible: boolean) => {
    setHiddenChartCategories((prev) => {
      if (visible) {
        return prev.filter((name) => name !== categoryName);
      }
      if (prev.includes(categoryName)) return prev;
      return [...prev, categoryName];
    });
  };

  const showAllCategories = () => setHiddenChartCategories([]);
  const hideAllCategories = () => setHiddenChartCategories(categoryList);
  
  const COLORS = ['hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 55%)', 'hsl(220, 15%, 50%)', 'hsl(145, 60%, 42%)'];
  
  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const handleUpdateIncome = async () => {
    try {
      const incomeValue = parseFloat(otherIncome) || 0;
      const targetMonthlyIncome = baseMonthlyIncome + incomeValue;
      
      await upsertMonthlyIncome.mutateAsync({
        year: currentYear,
        month: currentMonth,
        income: targetMonthlyIncome,
        notes: null,
      });
      
      toast({
        title: 'Receitas atualizadas!',
        description: 'As receitas foram atualizadas com sucesso.',
      });
      setIsIncomeDialogOpen(false);
    } catch (error) {
      console.error('Error updating income:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar as receitas.',
        variant: 'warning',
      });
    }
  };

  const handleIncomeDoubleClick = () => {
    setIsEditingIncome(true);
    setEditingIncomeValue(totalIncome.toString());
  };

  const handleIncomeKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newValue = parseFloat(editingIncomeValue.replace(',', '.')) || 0;
      
      if (newValue <= 0) {
        toast({
          title: 'Erro',
          description: 'A receita deve ser maior que zero.',
          variant: 'warning',
        });
        return;
      }
      
      try {
        // Refresh transactions to get the latest incomeFromTransactions value
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Recalculate incomeFromTransactions with fresh data
        const currentIncomeFromTransactions = transactions
          ? transactions
              .filter(t => t.type === 'income' && t.id !== salaryTransaction?.id)
              .reduce((sum, t) => sum + t.amount, 0)
          : 0;
        
        // Save the TOTAL income to monthly_income (this includes salary + all other income)
        // The monthly_income should always contain the total
        await upsertMonthlyIncome.mutateAsync({
          year: currentYear,
          month: currentMonth,
          income: newValue, // Total income (salary + other income)
          notes: null,
        });
        
        // Calculate salary amount: total - other income transactions
        const salaryAmount = newValue - currentIncomeFromTransactions;
        
        // Update or create salary transaction (only the salary part)
        if (salaryTransaction && salaryCategoryId) {
          await updateTransaction.mutateAsync({
            id: salaryTransaction.id,
            amount: salaryAmount,
            description: 'Salário',
          });
        } else if (salaryCategoryId && salaryAmount > 0) {
          const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
          await createTransaction.mutateAsync({
            category_id: salaryCategoryId,
            amount: salaryAmount,
            description: 'Salário',
            type: 'income',
            date: firstDayOfMonth,
          });
        }
        
        toast({
          title: 'Receitas atualizadas!',
          description: `A receita mensal foi atualizada para €${newValue.toFixed(2)}.`,
        });
        
        setIsEditingIncome(false);
      } catch (error) {
        console.error('Error updating income:', error);
        toast({
          title: 'Erro',
          description: 'Ocorreu um erro ao atualizar a receita mensal.',
          variant: 'warning',
        });
      }
    } else if (e.key === 'Escape') {
      setIsEditingIncome(false);
      setEditingIncomeValue('');
    }
  };

  const handleAddExpense = async () => {
    if (!newExpenseCategory || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0) {
      toast({
        title: 'Erro',
        description: 'Preenche a categoria e o montante.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createTransaction.mutateAsync({
        category_id: newExpenseCategory,
        amount: parseFloat(newExpenseAmount),
        description: newExpenseDescription || null,
        type: 'expense',
        date: newExpenseDate,
      });

      toast({
        title: 'Despesa adicionada!',
        description: 'A despesa foi guardada com sucesso.',
      });

      setNewExpenseCategory('');
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setIsAddExpenseOpen(false);
    } catch (error) {
      console.error('Error creating expense:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar a despesa.',
        variant: 'destructive',
      });
    }
  };

  const handleAddIncome = async () => {
    if (!newIncomeCategory || !newIncomeAmount || parseFloat(newIncomeAmount) <= 0) {
      toast({
        title: 'Erro',
        description: 'Preenche a categoria e o montante.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createTransaction.mutateAsync({
        category_id: newIncomeCategory,
        amount: parseFloat(newIncomeAmount),
        description: newIncomeDescription || null,
        type: 'income',
        date: newIncomeDate,
      });

      toast({
        title: 'Receita adicionada!',
        description: 'A receita foi guardada com sucesso.',
      });

      setNewIncomeCategory('');
      setNewIncomeDescription('');
      setNewIncomeAmount('');
      setNewIncomeDate(new Date().toISOString().split('T')[0]);
      setIsAddIncomeOpen(false);
    } catch (error) {
      console.error('Error creating income:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar a receita.',
        variant: 'destructive',
      });
    }
  };

  // Pie chart label and hover functions
  const renderPieLabel = (entry: any) => {
    const total = filteredExpensesByCategory.reduce((sum, cat) => sum + cat.value, 0);
    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
    return `${entry.name}: ${percent}%`;
  };

  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;
    
    const hoverOuterRadius = outerRadius * 1.08;

    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={hoverOuterRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'brightness(1.15) drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
          transition: 'all 0.3s ease-out',
        }}
      />
    );
  };

  if (isLoadingTransactions) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }
  
  const monthName = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold capitalize">
              {monthName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualização completa do mês atual
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddExpenseOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Despesa
            </Button>
            <Button
              onClick={() => setIsAddIncomeOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <PlusIncome className="w-4 h-4" />
              Adicionar Receita
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            {isEditingIncome ? (
              <div className="bg-card rounded-xl border p-5 shadow-card">
                <p className="text-sm text-muted-foreground mb-2">Receitas</p>
                <Input
                  type="number"
                  step="0.01"
                  value={editingIncomeValue}
                  onChange={(e) => setEditingIncomeValue(e.target.value)}
                  onKeyDown={handleIncomeKeyDown}
                  onBlur={() => setIsEditingIncome(false)}
                  className="text-2xl font-display font-bold"
                  autoFocus
                />
              </div>
            ) : (
              <div
                onDoubleClick={handleIncomeDoubleClick}
                className="cursor-pointer"
              >
                <MetricCard
                  title="Receitas"
                  value={formatCurrency(totalIncome)}
                  icon={<TrendingUp className="w-5 h-5" />}
                  variant="success"
                  delay={0}
                />
              </div>
            )}
          </div>
          <MetricCard
            title="Despesas"
            value={formatCurrency(monthlyExpenses)}
            icon={<TrendingDown className="w-5 h-5" />}
            variant="default"
            delay={0.1}
          />
          <MetricCard
            title="Poupado/Investido"
            value={formatCurrency(monthlySavingsInvestments)}
            icon={<PiggyBank className="w-5 h-5" />}
            variant="success"
            delay={0.15}
          />
          <MetricCard
            title="Balanço Mensal"
            value={formatCurrency(monthlySavings)}
            icon={<PiggyBank className="w-5 h-5" />}
            variant={monthlySavings >= 0 ? 'success' : 'warning'}
            delay={0.2}
          />
          <MetricCard
            title="Saldo Real no Banco"
            value={formatCurrency(bankBalance)}
            icon={<Wallet className="w-5 h-5" />}
            variant="primary"
            delay={0.3}
          />
        </div>

        {/* Category visibility filter for charts */}
        {categoryList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <Collapsible open={isCategoryFilterOpen} onOpenChange={setIsCategoryFilterOpen}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="font-display font-semibold text-lg">Categorias nos Gráficos</h3>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-2">
                    {isCategoryFilterOpen ? 'Fechar filtros' : 'Abrir filtros'}
                    {isCategoryFilterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={showAllCategories}>
                    Mostrar todas
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={hideAllCategories}>
                    Ocultar todas
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {categoryList.map((categoryName) => {
                    const isVisible = !hiddenChartCategories.includes(categoryName);
                    const color = categoryColors[categoryName] || '#94a3b8';
                    return (
                      <label
                        key={categoryName}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-secondary/40"
                      >
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={(checked) => toggleCategoryVisibility(categoryName, checked === true)}
                        />
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm">{categoryName}</span>
                      </label>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <h3 className="font-display font-semibold text-lg mb-4">Despesas por Categoria</h3>
            {filteredExpensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Ainda não há despesas registadas este mês
              </p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredExpensesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={renderPieLabel}
                      labelLine={false}
                      activeIndex={pieActiveIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setPieActiveIndex(index)}
                      onMouseLeave={() => setPieActiveIndex(null)}
                      animationBegin={0}
                      animationDuration={400}
                    >
                      {filteredExpensesByCategory.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{
                            transition: 'all 0.3s ease-out',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(150, 15%, 88%)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          <ExpensesChart data={horizontalBarChartData} isLoading={isLoadingTransactions} />
        </div>

        {/* Daily Expenses Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Evolução Diária das Despesas</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredDailyExpenses} barCategoryGap="10%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
                  tickFormatter={(v) => `Dia ${v}`}
                />
                <YAxis
                  tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
                  width={48}
                  tickFormatter={formatChartAxisValue}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    
                    // Filter out entries with value 0 or null/undefined
                    const validPayload = payload.filter((entry: any) => entry.value != null && entry.value > 0);
                    
                    if (validPayload.length === 0) return null;
                    
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2 text-gray-800">{`Dia ${payload[0].payload.day}`}</p>
                        {validPayload.map((entry: any, index: number) => (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {`${entry.name}: €${entry.value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                  formatter={(value) => value}
                />
                {chartCategoryList.map((catName, index) => {
                  const isFirst = index === 0;
                  const isLast = index === chartCategoryList.length - 1;
                  return (
                    <Bar
                      key={catName}
                      dataKey={catName}
                      stackId="a"
                      fill={categoryColors[catName] || COLORS[index % COLORS.length]}
                      radius={isFirst ? [4, 0, 0, 0] : isLast ? [0, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Transactions by Category */}
        <TransactionsByCategory year={currentYear} month={currentMonth} />
      </div>

      {/* Edit Income Dialog */}
      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Receitas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Salário Base (calculado)</Label>
              <Input
                value={formatCurrency(monthlyIncome)}
                disabled
                className="bg-secondary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Calculado automaticamente com base na configuração salarial
              </p>
            </div>
            <div>
              <Label htmlFor="otherIncome">Outras Receitas (€)</Label>
              <Input
                id="otherIncome"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Receitas adicionais este mês (bónus, vendas, etc.)
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleUpdateIncome}
                className="flex-1"
                disabled={upsertMonthlyIncome.isPending}
              >
                {upsertMonthlyIncome.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsIncomeDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="expense-category">Categoria</Label>
              <Select value={newExpenseCategory} onValueChange={setNewExpenseCategory}>
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="Seleciona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories && (() => {
                    const groups: Record<string, typeof expenseCategories> = {};
                    expenseCategories.forEach((cat) => {
                      const group = cat.category_group || 'general_expenses';
                      if (!groups[group]) groups[group] = [];
                      groups[group].push(cat);
                    });
                    const groupOrder: string[] = ['fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
                    const groupLabels: Record<string, string> = {
                      fixed_expenses: 'Despesas Fixas',
                      general_expenses: 'Despesas Gerais',
                      optional_expenses: 'Despesas Opcionais',
                      savings_investments: 'Poupança/Investimentos',
                    };
                    return groupOrder.map((group) => {
                      const cats = groups[group];
                      if (!cats || cats.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                            {groupLabels[group]}
                          </div>
                          {cats.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: cat.color || '#ef4444' }}
                                />
                                <span>{cat.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-description">Descrição (opcional)</Label>
              <Input
                id="expense-description"
                placeholder="Ex: Nome do Restaurante"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expense-amount">Montante (€)</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="expense-date">Data</Label>
              <Input
                id="expense-date"
                type="date"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddExpense}
                className="flex-1"
                disabled={createTransaction.isPending}
              >
                {createTransaction.isPending ? 'A guardar...' : 'Adicionar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddExpenseOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Income Dialog */}
      <Dialog open={isAddIncomeOpen} onOpenChange={setIsAddIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Receita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="income-category">Categoria</Label>
              <Select value={newIncomeCategory} onValueChange={setNewIncomeCategory}>
                <SelectTrigger id="income-category">
                  <SelectValue placeholder="Seleciona categoria" />
                </SelectTrigger>
                <SelectContent>
                {incomeCategories && (
                  <>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      Receitas
                    </div>
                    {incomeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color || '#22c55e' }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="income-description">Descrição (opcional)</Label>
              <Input
                id="income-description"
                placeholder="Ex: Bónus, Venda, etc."
                value={newIncomeDescription}
                onChange={(e) => setNewIncomeDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="income-amount">Montante (€)</Label>
              <Input
                id="income-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newIncomeAmount}
                onChange={(e) => setNewIncomeAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="income-date">Data</Label>
              <Input
                id="income-date"
                type="date"
                value={newIncomeDate}
                onChange={(e) => setNewIncomeDate(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddIncome}
                className="flex-1"
                disabled={createTransaction.isPending}
              >
                {createTransaction.isPending ? 'A guardar...' : 'Adicionar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddIncomeOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
