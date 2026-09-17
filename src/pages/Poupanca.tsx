import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { PiggyBank, Target, Plus, Edit2, Trash2, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSavingsGoals, useCreateSavingsGoal, useUpdateSavingsGoal, useDeleteSavingsGoal, SavingsGoal } from '@/hooks/useSavings';
import { useCurrentBalances, useUpdateCurrentBalances } from '@/hooks/useCurrentBalances';
import { useTransactions } from '@/hooks/useTransactions';
import { isSavingsCategory } from '@/lib/categoryHelpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const COLORS = ['hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 55%)', 'hsl(220, 15%, 50%)', 'hsl(145, 60%, 42%)'];

export default function Poupanca() {
  const { data: savingsGoals, isLoading: isLoadingGoals } = useSavingsGoals();
  const { data: currentBalances } = useCurrentBalances();
  const updateCurrentBalances = useUpdateCurrentBalances();
  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();
  const queryClient = useQueryClient();
  
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isGoalSelectionDialogOpen, setIsGoalSelectionDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  
  const [goalForm, setGoalForm] = useState({
    name: '',
    target_amount: 0,
    current_amount: 0,
    target_date: '',
  });

  // Calculate total savings from:
  // 1. Current balances savings_balance (already includes all historical transactions)
  // The savings_balance is updated automatically when transactions are created
  const totalSavings = useMemo(() => {
    return currentBalances?.savings_balance || 0;
  }, [currentBalances]);

  // Get ALL savings transactions (historical + current month)
  const { user } = useAuth();
  const { data: historyData } = useDashboardHistory(12);
  
  // Get savings category IDs
  const { data: categories } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const savingsCategoryIds = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter(cat => isSavingsCategory(cat.name))
      .map(cat => cat.id);
  }, [categories]);

  // Fetch all savings transactions (monthly_records for history + transactions for current month)
  const { data: allSavingsTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['all_savings_transactions', user?.id, savingsCategoryIds],
    queryFn: async () => {
      if (!user?.id || savingsCategoryIds.length === 0) return [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const transactions: Array<{
        id: string;
        amount: number;
        date: string;
        description: string | null;
        categoryName: string;
      }> = [];

      // Get monthly_records for historical months (last 12 months, excluding current month)
      for (let i = 11; i >= 1; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        for (const categoryId of savingsCategoryIds) {
          const { data, error } = await supabase
            .from('monthly_records')
            .select('id, amount, year, month, notes, categories!inner(name)')
            .eq('user_id', user.id)
            .eq('category_id', categoryId)
            .eq('year', year)
            .eq('month', month);

          if (error) throw error;
          if (data) {
            data.forEach(record => {
              const recordDate = new Date(record.year, record.month - 1, 1);
              transactions.push({
                id: record.id,
                amount: record.amount,
                date: recordDate.toISOString().split('T')[0],
                description: record.notes,
                categoryName: (record.categories as any)?.name || 'Poupança',
              });
            });
          }
        }
      }

      // Get transactions from transactions table for current month
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0);

      const { data: currentMonthTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, amount, date, description, categories!inner(name)')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .in('category_id', savingsCategoryIds)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      if (currentMonthTransactions) {
        transactions.push(...currentMonthTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          date: t.date,
          description: t.description,
          categoryName: (t.categories as any)?.name || 'Poupança',
        })));
      }

      return transactions.sort((a, b) => {
        // Sort by date descending (newest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    },
    enabled: !!user?.id && savingsCategoryIds.length > 0,
  });
  
  const savingsTransactions = allSavingsTransactions || [];

  // Pie chart data for goals distribution
  const goalsPieData = useMemo(() => {
    if (!savingsGoals || savingsGoals.length === 0) return [];
    
    return savingsGoals.map((goal, index) => ({
      name: goal.name,
      value: goal.current_amount,
      color: COLORS[index % COLORS.length],
    }));
  }, [savingsGoals]);

  // Line chart data for savings evolution
  const savingsEvolutionData = useMemo(() => {
    if (!historyData?.months) return [];
    
    let accumulatedSavings = 0;
    return historyData.months.map((month) => {
      accumulatedSavings += month.savingsAmount || 0;
      return {
        month: new Date(month.year, month.month - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
        poupança: accumulatedSavings,
      };
    });
  }, [historyData]);

  const handleOpenDialog = (goal?: SavingsGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({
        name: goal.name,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        target_date: goal.target_date || '',
      });
    } else {
      setEditingGoal(null);
      setGoalForm({ name: '', target_amount: 0, current_amount: 0, target_date: '' });
    }
    setIsGoalDialogOpen(true);
  };

  const handleSaveGoal = async () => {
    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          ...goalForm,
          target_date: goalForm.target_date || null,
        });
      } else {
        await createGoal.mutateAsync({
          ...goalForm,
          target_date: goalForm.target_date || null,
        });
      }
      setIsGoalDialogOpen(false);
      setGoalForm({ name: '', target_amount: 0, current_amount: 0, target_date: '' });
      setEditingGoal(null);
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (confirm('Tens a certeza que queres eliminar este objetivo?')) {
      try {
        await deleteGoal.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  const handleWithdrawClick = () => {
    setWithdrawAmount('');
    setSelectedGoalId(null);
    setIsWithdrawDialogOpen(true);
  };

  const handleWithdrawConfirm = async () => {
    const amount = parseFloat(withdrawAmount.replace(',', '.')) || 0;
    
    if (amount <= 0) {
      alert('O valor deve ser maior que zero.');
      return;
    }
    
    if (amount > totalSavings) {
      alert('Não tens saldo suficiente na poupança.');
      return;
    }
    
    // If there are goals, ask which goal to withdraw from
    if (savingsGoals && savingsGoals.length > 0) {
      setIsWithdrawDialogOpen(false);
      setIsGoalSelectionDialogOpen(true);
      return;
    }
    
    // No goals, proceed with withdrawal
    await performWithdrawal(amount, null);
  };

  const handleGoalSelectionConfirm = async () => {
    if (!selectedGoalId) {
      alert('Por favor, escolhe um objetivo.');
      return;
    }
    
    const amount = parseFloat(withdrawAmount.replace(',', '.')) || 0;
    await performWithdrawal(amount, selectedGoalId);
  };

  const performWithdrawal = async (amount: number, goalId: string | null) => {
    try {
      if (!currentBalances || !user?.id) {
        alert('Erro ao obter saldos atuais.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      // Registar a retirada para refletir na poupança líquida do mês
      const { error: withdrawalError } = await supabase
        .from('savings_withdrawals')
        .insert({
          user_id: user.id,
          amount,
          date: today,
          goal_id: goalId,
        });

      if (withdrawalError) throw withdrawalError;
      
      // Update balances: reduce savings, increase bank
      const newSavingsBalance = Math.max(0, (currentBalances.savings_balance || 0) - amount);
      const newBankBalance = (currentBalances.bank_balance || 0) + amount;
      
      await updateCurrentBalances.mutateAsync({
        savings_balance: newSavingsBalance,
        bank_balance: newBankBalance,
      });
      
      // If a goal was selected, reduce its current_amount
      if (goalId && savingsGoals) {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (goal) {
          const newCurrentAmount = Math.max(0, goal.current_amount - amount);
          await updateGoal.mutateAsync({
            id: goalId,
            current_amount: newCurrentAmount,
          });
        }
      }
      
      setIsWithdrawDialogOpen(false);
      setIsGoalSelectionDialogOpen(false);
      setWithdrawAmount('');
      setSelectedGoalId(null);
      
      // Small delay to ensure database consistency before invalidating queries
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['current_balances'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      queryClient.invalidateQueries({ queryKey: ['savings_withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_history'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      console.error('Error withdrawing from savings:', error);
      alert('Erro ao retirar da poupança. Tenta novamente.');
    }
  };

  if (isLoadingGoals || isLoadingTransactions) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Poupança</h1>
            <p className="text-muted-foreground mt-1">Acompanha os teus objetivos de poupança</p>
          </div>
          <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" onClick={() => handleOpenDialog()}>
                <Target className="w-4 h-4" />
                Novo Objetivo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGoal ? 'Editar Objetivo' : 'Novo Objetivo de Poupança'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-name">Título do Objetivo</Label>
                  <Input
                    id="goal-name"
                    value={goalForm.name}
                    onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                    placeholder="Ex: Férias, Fundo de Emergência..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal-target">Montante Desejado (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="goal-target"
                        type="number"
                        step="0.01"
                        value={goalForm.target_amount || ''}
                        onChange={(e) => setGoalForm({ ...goalForm, target_amount: parseFloat(e.target.value) || 0 })}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-current">Montante Atual (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="goal-current"
                        type="number"
                        step="0.01"
                        value={goalForm.current_amount || ''}
                        onChange={(e) => setGoalForm({ ...goalForm, current_amount: parseFloat(e.target.value) || 0 })}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-date">Data Desejada (opcional)</Label>
                  <Input
                    id="goal-date"
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveGoal} className="w-full">
                  {editingGoal ? 'Guardar Alterações' : 'Criar Objetivo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Total Savings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-primary rounded-xl p-5 text-primary-foreground shadow-glow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-5 h-5" />
              <span className="text-sm font-medium opacity-80">Total em Poupança</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
              onClick={handleWithdrawClick}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Retirar para o banco
            </Button>
          </div>
          <p className="text-3xl font-display font-bold">
            €{totalSavings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        {/* Goals Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-lg">Objetivos de Poupança</h3>
          </div>

          {(!savingsGoals || savingsGoals.length === 0) ? (
            <p className="text-muted-foreground text-center py-8">Ainda não tens objetivos de poupança</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savingsGoals.map((goal, index) => {
                const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                const color = COLORS[index % COLORS.length];
                
                // Calculate monthly savings needed if target_date and target_amount are set
                let monthlyNeeded: number | null = null;
                if (goal.target_date && goal.target_amount > 0) {
                  const targetDate = new Date(goal.target_date);
                  const today = new Date();
                  const monthsRemaining = Math.max(1, (targetDate.getFullYear() - today.getFullYear()) * 12 + 
                    (targetDate.getMonth() - today.getMonth()));
                  const remainingAmount = goal.target_amount - goal.current_amount;
                  if (remainingAmount > 0) {
                    monthlyNeeded = remainingAmount / monthsRemaining;
                  }
                }
                
                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{goal.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleOpenDialog(goal)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold" style={{ color }}>
                        €{goal.current_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground">
                        de €{goal.target_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {goal.target_date && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Objetivo: {new Date(goal.target_date).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                    {monthlyNeeded !== null && monthlyNeeded > 0 && (
                      <p className="text-xs font-medium mt-2" style={{ color }}>
                        Poupar €{monthlyNeeded.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/mês
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goals Distribution Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-lg">Distribuição por Objetivos</h3>
            </div>
            {goalsPieData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Ainda não tens objetivos de poupança</p>
            ) : (
              <>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={goalsPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={400}
                      >
                        {goalsPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
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
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {goalsPieData.map((goal, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }} />
                      <span className="text-xs text-muted-foreground">{goal.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* Savings Evolution Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <PiggyBank className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-lg">Evolução da Poupança</h3>
            </div>
            {savingsEvolutionData.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Ainda não há dados de evolução</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={savingsEvolutionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" opacity={0.5} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
                      tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(150, 15%, 88%)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, 'Poupança']}
                    />
                    <Line
                      type="monotone"
                      dataKey="poupança"
                      stroke="hsl(160, 60%, 40%)"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(160, 60%, 40%)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </div>

        {/* Transactions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <PiggyBank className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-lg">Transações de Poupança</h3>
          </div>

          {savingsTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Ainda não tens transações de poupança</p>
          ) : (
            <div className="space-y-2">
              {savingsTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{transaction.description || transaction.categoryName || 'Sem descrição'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <p className="font-semibold text-success">
                    €{transaction.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Withdraw Dialog */}
        <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Retirar da Poupança para o Banco</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Valor a retirar (€)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Saldo disponível: €{totalSavings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleWithdrawConfirm} className="flex-1">
                  Continuar
                </Button>
                <Button variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Goal Selection Dialog */}
        <Dialog open={isGoalSelectionDialogOpen} onOpenChange={setIsGoalSelectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Escolher Objetivo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                De qual objetivo queres retirar €{parseFloat(withdrawAmount.replace(',', '.')) || 0}?
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {savingsGoals && savingsGoals.length > 0 ? (
                  savingsGoals.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => setSelectedGoalId(goal.id)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                        selectedGoalId === goal.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{goal.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Atual: €{goal.current_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        {selectedGoalId === goal.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Não tens objetivos de poupança</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleGoalSelectionConfirm} 
                  className="flex-1"
                  disabled={!selectedGoalId}
                >
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsGoalSelectionDialogOpen(false);
                  setIsWithdrawDialogOpen(true);
                }}>
                  Voltar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
