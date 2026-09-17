import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { TrendingUp, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useInvestments, useCreateInvestment, useUpdateInvestment, useDeleteInvestment, Investment } from '@/hooks/useSavings';
import { useCurrentBalances } from '@/hooks/useCurrentBalances';
import { useTransactions } from '@/hooks/useTransactions';
import { isInvestmentCategory } from '@/lib/categoryHelpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardHistory } from '@/hooks/useDashboardHistory';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['hsl(160, 60%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 55%)', 'hsl(220, 15%, 50%)', 'hsl(145, 60%, 42%)'];

export default function Investimentos() {
  const { data: investments, isLoading: isLoadingInvestments } = useInvestments();
  const { data: currentBalances } = useCurrentBalances();
  const createInvestment = useCreateInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  
  const [isInvestmentDialogOpen, setIsInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  
  const [investmentForm, setInvestmentForm] = useState({
    name: '',
    investment_type: 'stocks' as Investment['investment_type'],
    initial_value: 0,
    current_value: 0,
    monthly_contribution: null as number | null,
    notes: null as string | null,
  });

  // Get ALL investment transactions (historical + current month)
  const { user } = useAuth();
  const { data: historyData } = useDashboardHistory(12);
  
  // Get investment category IDs
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

  const investmentCategoryIds = useMemo(() => {
    if (!categories) return [];
    return categories
      .filter(cat => isInvestmentCategory(cat.name))
      .map(cat => cat.id);
  }, [categories]);

  // Fetch all investment transactions (monthly_records for history + transactions for current month)
  const { data: allInvestmentTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['all_investment_transactions', user?.id, investmentCategoryIds],
    queryFn: async () => {
      if (!user?.id || investmentCategoryIds.length === 0) return [];

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

        for (const categoryId of investmentCategoryIds) {
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
                categoryName: (record.categories as any)?.name || 'Investimento',
              });
            });
          }
        }
      }

      // Get transactions from transactions table for current month
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0); // Last day of current month
      
      // For current month, we need to include all days up to today
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const { data: currentMonthTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, amount, date, description, categories!inner(name)')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .in('category_id', investmentCategoryIds)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', todayStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      if (currentMonthTransactions) {
        transactions.push(...currentMonthTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          date: t.date,
          description: t.description,
          categoryName: (t.categories as any)?.name || 'Investimento',
        })));
      }

      return transactions.sort((a, b) => {
        // Sort by date descending (newest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    },
    enabled: !!user?.id && investmentCategoryIds.length > 0,
  });

  // Calculate total investments from transactions only (sum of all investment transactions)
  const totalInvestments = useMemo(() => {
    if (!allInvestmentTransactions) return 0;
    return allInvestmentTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [allInvestmentTransactions]);

  const investmentTransactions = allInvestmentTransactions || [];

  // Line chart data for investment evolution
  const investmentEvolutionData = useMemo(() => {
    if (!historyData?.months) return [];
    
    return historyData.months.map((month, index) => {
      // Calculate cumulative investments up to this month
      let cumulative = 0;
      for (let i = 0; i <= index; i++) {
        cumulative += historyData.months[i]?.investmentsAmount || 0;
      }
      
      const monthName = new Date(month.year, month.month - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      return {
        month: monthName,
        investimento: cumulative,
      };
    });
  }, [historyData]);

  const pieData = useMemo(() => {
    return (investments || []).map((inv) => ({
      name: inv.name,
      value: inv.current_value,
    }));
  }, [investments]);

  const handleOpenDialog = (investment?: Investment) => {
    if (investment) {
      setEditingInvestment(investment);
      setInvestmentForm({
        name: investment.name,
        investment_type: investment.investment_type,
        initial_value: investment.initial_value,
        current_value: investment.current_value,
        monthly_contribution: investment.monthly_contribution,
        notes: investment.notes,
      });
    } else {
      setEditingInvestment(null);
      setInvestmentForm({
        name: '',
        investment_type: 'stocks',
        initial_value: 0,
        current_value: 0,
        monthly_contribution: null,
        notes: null,
      });
    }
    setIsInvestmentDialogOpen(true);
  };

  const handleSaveInvestment = async () => {
    try {
      if (editingInvestment) {
        await updateInvestment.mutateAsync({
          id: editingInvestment.id,
          ...investmentForm,
        });
      } else {
        await createInvestment.mutateAsync({
          ...investmentForm,
          is_active: true,
        });
      }
      setIsInvestmentDialogOpen(false);
      setInvestmentForm({
        name: '',
        investment_type: 'stocks',
        initial_value: 0,
        current_value: 0,
        monthly_contribution: null,
        notes: null,
      });
      setEditingInvestment(null);
    } catch (error) {
      console.error('Error saving investment:', error);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (confirm('Tens a certeza que queres eliminar este investimento?')) {
      try {
        await deleteInvestment.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting investment:', error);
      }
    }
  };

  if (isLoadingInvestments || isLoadingTransactions) {
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
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Investimentos</h1>
            <p className="text-muted-foreground mt-1">Acompanha os teus investimentos</p>
          </div>
          <Dialog open={isInvestmentDialogOpen} onOpenChange={setIsInvestmentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow" onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4" />
                Novo Investimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingInvestment ? 'Editar Investimento' : 'Novo Investimento'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-name">Nome</Label>
                  <Input
                    id="inv-name"
                    value={investmentForm.name}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, name: e.target.value })}
                    placeholder="Ex: ETF Global, PPR..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-type">Tipo</Label>
                  <Select
                    value={investmentForm.investment_type}
                    onValueChange={(v) => setInvestmentForm({ ...investmentForm, investment_type: v as Investment['investment_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stocks">Ações</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="crypto">Criptomoedas</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inv-initial">Valor Inicial (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="inv-initial"
                        type="number"
                        step="0.01"
                        value={investmentForm.initial_value || ''}
                        onChange={(e) => setInvestmentForm({ ...investmentForm, initial_value: parseFloat(e.target.value) || 0 })}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-current">Valor Atual (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="inv-current"
                        type="number"
                        step="0.01"
                        value={investmentForm.current_value || ''}
                        onChange={(e) => setInvestmentForm({ ...investmentForm, current_value: parseFloat(e.target.value) || 0 })}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-monthly">Contribuição Mensal (€, opcional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                    <Input
                      id="inv-monthly"
                      type="number"
                      step="0.01"
                      value={investmentForm.monthly_contribution || ''}
                      onChange={(e) => setInvestmentForm({ ...investmentForm, monthly_contribution: parseFloat(e.target.value) || null })}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveInvestment} className="w-full">
                  {editingInvestment ? 'Guardar Alterações' : 'Criar Investimento'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Total Investments Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-primary rounded-xl p-5 text-primary-foreground shadow-glow"
        >
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">Total Investido</span>
          </div>
          <p className="text-3xl font-display font-bold">
            €{totalInvestments.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        {/* Investment Evolution Chart */}
        {investmentEvolutionData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-lg">Evolução dos Investimentos</h3>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={investmentEvolutionData}>
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
                    formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, 'Investimento']}
                  />
                  <Line
                    type="monotone"
                    dataKey="investimento"
                    stroke="hsl(200, 70%, 50%)"
                    strokeWidth={2.5}
                    dot={{ fill: 'hsl(200, 70%, 50%)', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Investments Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <h3 className="font-display font-semibold text-lg mb-4">Distribuição de Investimentos</h3>
            {(!investments || investments.length === 0) ? (
              <p className="text-muted-foreground text-center py-12">Ainda não tens investimentos</p>
            ) : (
              <>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                  {investments.map((inv, i) => (
                    <div key={inv.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground">{inv.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border p-5 shadow-card"
          >
            <h3 className="font-display font-semibold text-lg mb-4">Detalhes dos Investimentos</h3>
            {(!investments || investments.length === 0) ? (
              <p className="text-muted-foreground text-center py-12">Ainda não tens investimentos</p>
            ) : (
              <div className="space-y-3">
                {investments.map((inv, index) => {
                  const returnPercent = inv.initial_value > 0
                    ? ((inv.current_value - inv.initial_value) / inv.initial_value) * 100
                    : 0;
                  const color = COLORS[index % COLORS.length];
                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <TrendingUp className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{inv.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{inv.investment_type}</p>
                        </div>
                      </div>
                      <div className="text-right mr-2">
                        <p className="font-display font-semibold">€{inv.current_value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                        <p className={`text-xs ${returnPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenDialog(inv)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => handleDeleteInvestment(inv.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Transactions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-lg">Transações de Investimento</h3>
          </div>

          {investmentTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Ainda não tens transações de investimento</p>
          ) : (
            <div className="space-y-2">
              {investmentTransactions.map((transaction) => (
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
      </div>
    </Layout>
  );
}
