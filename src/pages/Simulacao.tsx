import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, PiggyBank, Plus, Edit2, Trash2, Save, X, BarChart3, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useSalaryConfig } from '@/hooks/useProfile';
import { useCurrentBalances } from '@/hooks/useCurrentBalances';
import { useCategories, useAllCategories } from '@/hooks/useCategories';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSimulations, useCreateSimulation, useUpdateSimulation, useDeleteSimulation, Simulation } from '@/hooks/useSimulations';
import { isSavingsCategory, isInvestmentCategory } from '@/lib/categoryHelpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Simulation Details Component
interface SimulationDetailsProps {
  simulation: Simulation;
  categories: Array<{
    id: string;
    name: string;
    type: 'expense' | 'income';
    color: string | null;
    user_id?: string | null;
  }>;
  updateSimulation: ReturnType<typeof useUpdateSimulation>;
  onClose: () => void;
}

function SimulationDetails({ simulation, categories, updateSimulation, onClose }: SimulationDetailsProps) {
  const { data: currentBalances } = useCurrentBalances();
  const { user } = useAuth();
  const [isEditMonthDialogOpen, setIsEditMonthDialogOpen] = useState(false);
  const [editingMonthIndex, setEditingMonthIndex] = useState<number | null>(null);
  const [monthEditValues, setMonthEditValues] = useState<Record<string, number>>({});
  const [useSavingsAmount, setUseSavingsAmount] = useState<number>(0);
  const [useInvestmentsAmount, setUseInvestmentsAmount] = useState<number>(0);
  
  // Load color preferences for categories
  const { data: colorPrefs } = useQuery({
    queryKey: ['category-color-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('category_color_preferences')
        .select('category_id,color')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    (colorPrefs || []).forEach((pref: any) => {
      if (pref.category_id && pref.color) {
        map.set(pref.category_id, pref.color);
      }
    });
    return map;
  }, [colorPrefs]);
  
  const simulationCategories = useMemo(() => {
    return categories
      .filter(c => 
        Object.keys(simulation.default_values).includes(c.id) ||
        Object.values(simulation.monthly_overrides).some(overrides => 
          Object.keys(overrides).includes(c.id)
        )
      )
      .map(cat => {
        // Apply color preference if it's a predefined category (user_id null)
        const overrideColor = cat.user_id === null ? colorMap.get(cat.id) : undefined;
        return {
          ...cat,
          color: overrideColor || cat.color || (cat.type === 'income' ? '#22c55e' : '#ef4444'),
        };
      });
  }, [categories, simulation, colorMap]);
  
  const simulationStart = useMemo(() => {
    const startYear = simulation.start_year;
    const startMonth = simulation.start_month;

    if (
      typeof startYear === 'number' &&
      typeof startMonth === 'number' &&
      startMonth >= 1 &&
      startMonth <= 12
    ) {
      return new Date(startYear, startMonth - 1, 1);
    }

    // Backward compatibility for older simulations without fixed start month:
    // anchor the simulation to the month after it was created.
    const createdAt = new Date(simulation.created_at);
    return new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
  }, [simulation.start_year, simulation.start_month, simulation.created_at]);

  // Calculate monthly data anchored to a fixed start month
  const monthlyData = useMemo(() => {
    return Array.from({ length: simulation.months }, (_, i) => {
      const date = new Date(simulationStart.getFullYear(), simulationStart.getMonth() + i, 1);
      const monthIndex = String(i);
      const overrides = simulation.monthly_overrides[monthIndex] || {};
      
      let income = 0;
      let expenses = 0;
      let savingsAmount = 0;
      let investmentsAmount = 0;
      let expensesWithoutSavings = 0;
      
      simulationCategories.forEach(category => {
        const value = overrides[category.id] ?? simulation.default_values[category.id] ?? 0;
        
        if (category.type === 'income') {
          income += value;
        } else {
          expenses += value;
          const categoryName = category.name;
          if (isSavingsCategory(categoryName)) {
            savingsAmount += value;
          } else if (isInvestmentCategory(categoryName)) {
            investmentsAmount += value;
          } else {
            expensesWithoutSavings += value;
          }
        }
      });
      
      const savings = income - expenses;
      
      return {
        index: i,
        month: date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
        monthShort: date.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        income,
        expenses,
        expensesWithoutSavings,
        savingsAmount,
        investmentsAmount,
        savings,
      };
    });
  }, [simulation, simulationCategories, simulationStart]);
  
  // Calculate accumulated balance - starting from current balances
  const monthlyDataWithBalance = useMemo(() => {
    // Always start from the real balances stored in current_balances.
    let accumulatedBankBalance = currentBalances?.bank_balance || 0;
    let accumulatedSavingsBalance = currentBalances?.savings_balance || 0;
    let accumulatedInvestmentsBalance = currentBalances?.investments_balance || 0;
    const otherBalance = currentBalances?.other_balance || 0;
    
    return monthlyData.map(month => {
      // Step 1: Add income to bank
      accumulatedBankBalance += month.income;
      
      // Step 2: Handle savings and investments contributions (these are transfers from bank)
      // Savings: subtract from bank, add to savings
      if (month.savingsAmount > 0) {
        accumulatedBankBalance -= month.savingsAmount;
        accumulatedSavingsBalance += month.savingsAmount;
      }
      
      // Investments: subtract from bank, add to investments
      if (month.investmentsAmount > 0) {
        accumulatedBankBalance -= month.investmentsAmount;
        accumulatedInvestmentsBalance += month.investmentsAmount;
      }
      
      // Step 3: Handle regular expenses
      // Get manual overrides for using savings/investments (stored in monthly_overrides with special keys)
      const monthIndexStr = String(month.index);
      const monthOverrides = simulation.monthly_overrides[monthIndexStr] || {};
      const useSavingsAmount = monthOverrides['_use_savings'] || 0; // Amount to use from savings
      const useInvestmentsAmount = monthOverrides['_use_investments'] || 0; // Amount to use from investments
      
      let remainingRegularExpenses = month.expensesWithoutSavings;
      
      // 3a. FIRST, use specified amount from savings (if checkbox is checked and amount > 0)
      if (remainingRegularExpenses > 0 && useSavingsAmount > 0 && accumulatedSavingsBalance > 0) {
        const savingsUsed = Math.min(accumulatedSavingsBalance, useSavingsAmount, remainingRegularExpenses);
        accumulatedSavingsBalance -= savingsUsed;
        remainingRegularExpenses -= savingsUsed;
      }
      
      // 3b. THEN, use specified amount from investments (if checkbox is checked and amount > 0)
      if (remainingRegularExpenses > 0 && useInvestmentsAmount > 0 && accumulatedInvestmentsBalance > 0) {
        const investmentsUsed = Math.min(accumulatedInvestmentsBalance, useInvestmentsAmount, remainingRegularExpenses);
        accumulatedInvestmentsBalance -= investmentsUsed;
        remainingRegularExpenses -= investmentsUsed;
      }
      
      // 3c. FINALLY, use bank to cover any remaining expenses
      if (remainingRegularExpenses > 0) {
        accumulatedBankBalance -= remainingRegularExpenses;
      }
      
      // Calculate changes for display
      // Monthly bank change = income - regular expenses - savings transfer - investments transfer
      // This is the NET change (balanço mensal)
      const monthlyBankChange = month.income - month.expensesWithoutSavings - month.savingsAmount - month.investmentsAmount;
      // Poupança mensal total = poupança + investimentos desse mês
      const monthlySavingsChange = month.savingsAmount + month.investmentsAmount;
      const monthlyInvestmentsChange = month.investmentsAmount;
      
      // Total balance = bank + savings + investments + other
      const totalBalance =
        accumulatedBankBalance + accumulatedSavingsBalance + accumulatedInvestmentsBalance + otherBalance;
      
      return { 
        ...month, 
        accumulatedBankBalance,
        accumulatedSavingsBalance,
        accumulatedInvestmentsBalance,
        otherBalance,
        accumulatedBalance: totalBalance,
        monthlyBankChange,
        monthlySavingsChange,
        monthlyInvestmentsChange,
      };
    });
  }, [monthlyData, currentBalances]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalRealExpenses = monthlyData.reduce((sum, m) => sum + m.expensesWithoutSavings, 0);
    const totalSavingsAmount = monthlyData.reduce((sum, m) => sum + m.savingsAmount, 0);
    const totalInvestmentsAmount = monthlyData.reduce((sum, m) => sum + m.investmentsAmount, 0);
    // Balanço = receitas - despesas reais (poupança e investimentos são mostrados à parte)
    const totalBalance = totalIncome - totalRealExpenses;
    const averageIncome = totalIncome / simulation.months;
    const averageExpenses = totalRealExpenses / simulation.months;
    const averageBalance = totalBalance / simulation.months;
    
    return {
      totalIncome,
      totalExpenses: totalRealExpenses,
      totalExpensesWithoutSavings: totalRealExpenses,
      totalSavingsAmount,
      totalInvestmentsAmount,
      totalBalance,
      averageIncome,
      averageExpenses,
      averageBalance,
    };
  }, [monthlyData, simulation.months]);
  
  // Expenses by category
  const expensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    monthlyData.forEach(month => {
      simulationCategories.forEach(category => {
        if (category.type === 'expense' && !isSavingsCategory(category.name) && !isInvestmentCategory(category.name)) {
          const monthIndex = String(month.index);
          const overrides = simulation.monthly_overrides[monthIndex] || {};
          const value = overrides[category.id] ?? simulation.default_values[category.id] ?? 0;
          
          if (!categoryTotals[category.id]) {
            categoryTotals[category.id] = 0;
          }
          categoryTotals[category.id] += value;
        }
      });
    });
    
    return Object.entries(categoryTotals)
      .map(([categoryId, amount]) => {
        const category = simulationCategories.find(c => c.id === categoryId);
        return {
          categoryId,
          categoryName: category?.name || 'Desconhecida',
          amount,
          color: category?.color || '#ef4444',
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyData, simulationCategories, simulation]);
  
const handleEditMonth = (monthIndex: number) => {
    // Prevent opening if another month is already being edited
    if (isEditMonthDialogOpen && editingMonthIndex !== monthIndex) {
      return;
    }
    
    setEditingMonthIndex(monthIndex);
    const monthIndexStr = String(monthIndex);
    const overrides = simulation.monthly_overrides[monthIndexStr] || {};
    const initialValues: Record<string, number> = {};
    
    simulationCategories.forEach(category => {
      initialValues[category.id] = overrides[category.id] ?? simulation.default_values[category.id] ?? 0;
    });
    
    // Inicializar uso de poupança/investimentos a partir dos overrides gravados
    setUseSavingsAmount(overrides['_use_savings'] || 0);
    setUseInvestmentsAmount(overrides['_use_investments'] || 0);
    
    setMonthEditValues(initialValues);
    setIsEditMonthDialogOpen(true);
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border p-5 shadow-card"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-semibold text-xl">{simulation.name}</h2>
            <p className="text-sm text-muted-foreground">{simulation.months} meses simulados</p>
          </div>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <Tabs defaultValue="months" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="months">Meses</TabsTrigger>
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="months" className="mt-6">
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {monthlyDataWithBalance.map((month) => (
                  <div key={month.index} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{month.month}</h3>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Banco: €{month.accumulatedBankBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                          <p>Poupança: €{month.accumulatedSavingsBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                          <p>Investimentos: €{month.accumulatedInvestmentsBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                          <p>Outros: €{month.otherBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                          <p className="font-semibold">Total: €{month.accumulatedBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditMonth(month.index)}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Receitas</p>
                        <p className="font-semibold text-success">€{month.income.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Despesas</p>
                        <p className="font-semibold text-destructive">€{month.expenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Poupança</p>
                        <p className="font-semibold text-primary">€{month.savingsAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balanço</p>
                        <p className={`font-semibold ${month.savings >= 0 ? 'text-success' : 'text-destructive'}`}>
                          €{month.savings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="summary" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-card rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Receitas Totais</p>
                <p className="text-2xl font-bold text-success">
                  €{totals.totalIncome.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Média: €{totals.averageIncome.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/mês
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Despesas Totais</p>
                <p className="text-2xl font-bold text-destructive">
                  €{totals.totalExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Média: €{totals.averageExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/mês
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Poupança Total</p>
                <p className="text-2xl font-bold text-primary">
                  €{totals.totalSavingsAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Investimentos: €{totals.totalInvestmentsAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Balanço Total</p>
                <p className={`text-2xl font-bold ${totals.totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  €{totals.totalBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Média: €{totals.averageBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}/mês
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-card rounded-lg border p-4">
              <div>
                <h4 className="font-semibold mb-4">Despesas por Categoria</h4>
                <div className="space-y-2">
                  {expensesByCategory.map((item) => (
                    <div key={item.categoryId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.categoryName}</span>
                      </div>
                      <span className="font-semibold">
                        €{item.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ categoryName, percent }) => `${categoryName}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={`summary-pie-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="charts" className="mt-6">
            <div className="bg-card rounded-lg border p-5">
              <h4 className="font-semibold mb-4">Evolução Mensal</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyDataWithBalance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" />
                      <XAxis 
                        dataKey="monthShort" 
                        tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }} 
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
                        tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(0, 0%, 100%)',
                          border: '1px solid hsl(150, 15%, 88%)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, '']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="income" 
                        stroke="hsl(145, 60%, 42%)" 
                        strokeWidth={2} 
                        name="Receitas"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="expensesWithoutSavings" 
                        stroke="hsl(0, 70%, 55%)" 
                        strokeWidth={2} 
                        name="Despesas"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="accumulatedSavingsBalance" 
                        stroke="hsl(210, 70%, 55%)" 
                        strokeWidth={2} 
                        name="Poupança Acumulada"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="accumulatedBalance" 
                        stroke="hsl(50, 90%, 50%)" 
                        strokeWidth={3} 
                        name="Saldo Acumulado"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
          </TabsContent>
        </Tabs>
      </motion.div>
      
      {/* Edit Month Dialog */}
      <Dialog open={isEditMonthDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Only allow closing if not saving
          setIsEditMonthDialogOpen(false);
          setEditingMonthIndex(null);
          setMonthEditValues({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar {editingMonthIndex !== null ? monthlyData[editingMonthIndex]?.month : 'Mês'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Ajusta os valores para este mês específico. Os valores padrão são mostrados como referência.
            </p>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {simulationCategories.map((category) => {
                  const monthIndex = editingMonthIndex !== null ? String(editingMonthIndex) : '';
                  const overrides = simulation.monthly_overrides[monthIndex] || {};
                  const defaultValue = simulation.default_values[category.id] || 0;
                  const currentValue = monthEditValues[category.id] ?? overrides[category.id] ?? defaultValue;
                  
                  return (
                    <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color || (category.type === 'income' ? '#22c55e' : '#ef4444') }}
                      />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{category.name}</Label>
                        <p className="text-xs text-muted-foreground">
                          {category.type === 'income' ? 'Receita' : 'Despesa'} • Padrão: €{defaultValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-40">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={currentValue}
                            onChange={(e) => {
                              setMonthEditValues({
                                ...monthEditValues,
                                [category.id]: Number(e.target.value),
                              });
                            }}
                            className="pl-8"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {/* Opções para utilizar poupança/investimentos para pagar despesas */}
            {editingMonthIndex !== null && (() => {
              // Calcular totais deste mês com os valores (incluindo overrides de categorias)
              let totalExpenses = 0;
              let totalSavingsTransfer = 0;
              let totalInvestmentsTransfer = 0;
              let totalIncome = 0;

              simulationCategories.forEach((category) => {
                const value =
                  monthEditValues[category.id] ??
                  simulation.monthly_overrides[String(editingMonthIndex)]?.[category.id] ??
                  (simulation.default_values[category.id] || 0);

                if (category.type === 'income') {
                  totalIncome += value;
                } else {
                  const categoryName = category.name;
                  if (isSavingsCategory(categoryName)) {
                    totalSavingsTransfer += value;
                  } else if (isInvestmentCategory(categoryName)) {
                    totalInvestmentsTransfer += value;
                  } else {
                    totalExpenses += value;
                  }
                }
              });

              // Saldo no início do mês (antes de receitas/despesas deste mês)
              const bankBalanceAtStart =
                editingMonthIndex > 0
                  ? monthlyDataWithBalance[editingMonthIndex - 1]?.accumulatedBankBalance || 0
                  : (currentBalances?.bank_balance || 0);

              // Saldo disponível no banco para pagar despesas (após receitas e transferências para poupança/investimentos)
              const availableBankBalance =
                bankBalanceAtStart + totalIncome - totalSavingsTransfer - totalInvestmentsTransfer;

              // Saldos disponíveis em poupança e investimentos no início do mês
              const availableSavings =
                (editingMonthIndex > 0
                  ? monthlyDataWithBalance[editingMonthIndex - 1]?.accumulatedSavingsBalance
                  : currentBalances?.savings_balance) || 0;
              const availableInvestments =
                (editingMonthIndex > 0
                  ? monthlyDataWithBalance[editingMonthIndex - 1]?.accumulatedInvestmentsBalance
                  : currentBalances?.investments_balance) || 0;

              const rawShortfall = totalExpenses - availableBankBalance;
              const shortfall = Math.max(0, rawShortfall);
              const hasDeficit = shortfall > 0;

              return (
                <div className="mt-4 p-4 bg-muted/40 border border-border rounded-lg space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Despesas (sem poupança):{' '}
                    <span className="font-semibold">
                      €{totalExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </span>{' '}
                    • Saldo no banco antes das despesas:{' '}
                    <span className="font-semibold">
                      €{availableBankBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                  {hasDeficit ? (
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      As despesas excedem o saldo disponível no banco em{' '}
                      <span className="font-semibold">
                        €{shortfall.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                      . Podes usar poupança e/ou investimentos para cobrir este valor.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      O saldo no banco é suficiente para pagar as despesas, mas podes optar por usar
                      poupança ou investimentos.
                    </p>
                  )}

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20">
                      <div className="flex items-center gap-3 mb-2">
                        <Checkbox
                          id="use-savings"
                          checked={useSavingsAmount > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const target = shortfall > 0 ? shortfall : totalExpenses;
                              setUseSavingsAmount(Math.min(availableSavings, target));
                            } else {
                              setUseSavingsAmount(0);
                            }
                          }}
                        />
                        <Label htmlFor="use-savings" className="flex-1 cursor-pointer">
                          Utilizar € da Poupança
                        </Label>
                      </div>
                      {useSavingsAmount > 0 && (
                        <div className="w-40">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              €
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={availableSavings}
                              value={useSavingsAmount}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(availableSavings, Number(e.target.value)),
                                );
                                setUseSavingsAmount(val);
                              }}
                              className="pl-8"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Disponível: €
                            {availableSavings.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-3 mb-2">
                        <Checkbox
                          id="use-investments"
                          checked={useInvestmentsAmount > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const remainingAfterSavings =
                                totalExpenses - Math.min(totalExpenses, useSavingsAmount);
                              const target = remainingAfterSavings > 0 ? remainingAfterSavings : 0;
                              setUseInvestmentsAmount(
                                Math.min(availableInvestments, target),
                              );
                            } else {
                              setUseInvestmentsAmount(0);
                            }
                          }}
                        />
                        <Label htmlFor="use-investments" className="flex-1 cursor-pointer">
                          Utilizar € dos Investimentos
                        </Label>
                      </div>
                      {useInvestmentsAmount > 0 && (
                        <div className="w-40">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              €
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={availableInvestments}
                              value={useInvestmentsAmount}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(availableInvestments, Number(e.target.value)),
                                );
                                setUseInvestmentsAmount(val);
                              }}
                              className="pl-8"
                              placeholder="0"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Disponível: €
                            {availableInvestments.toLocaleString('pt-PT', {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditMonthDialogOpen(false);
              setEditingMonthIndex(null);
              setMonthEditValues({});
              setUseSavingsAmount(0);
              setUseInvestmentsAmount(0);
            }}>
              Cancelar
            </Button>
            <Button onClick={async () => {
              if (editingMonthIndex === null) return;
              
              const monthIndex = String(editingMonthIndex);
              const newOverrides: Record<string, number> = {};
              
              simulationCategories.forEach(category => {
                const editedValue = monthEditValues[category.id];
                const defaultValue = simulation.default_values[category.id] || 0;
                
                if (editedValue !== undefined && editedValue !== defaultValue) {
                  newOverrides[category.id] = editedValue;
                }
              });
              
              // Add savings/investments usage if specified
              if (useSavingsAmount > 0) {
                newOverrides['_use_savings'] = useSavingsAmount;
              }
              if (useInvestmentsAmount > 0) {
                newOverrides['_use_investments'] = useInvestmentsAmount;
              }
              
              // Clean up: remove month override if all values are back to default
              const finalOverrides = { ...simulation.monthly_overrides };
              if (Object.keys(newOverrides).length > 0) {
                finalOverrides[monthIndex] = newOverrides;
              } else {
                delete finalOverrides[monthIndex];
              }
              
              try {
                await updateSimulation.mutateAsync({
                  id: simulation.id,
                  monthly_overrides: finalOverrides,
                });
                
                toast({
                  title: 'Sucesso',
                  description: 'Mês atualizado com sucesso',
                });
                
                setIsEditMonthDialogOpen(false);
                setEditingMonthIndex(null);
                setMonthEditValues({});
                setUseSavingsAmount(0);
                setUseInvestmentsAmount(0);
              } catch (error) {
                toast({
                  title: 'Erro',
                  description: 'Erro ao atualizar mês',
                  variant: 'destructive',
                });
              }
            }}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Simulacao() {
  const { data: simulations, isLoading: isLoadingSimulations } = useSimulations();
  // Categorias visíveis (ativas e não ocultas) - usadas para criar novas simulações
  const { data: categories } = useCategories();
  // Todas as categorias (inclui inativas/ocultas) - usadas para mostrar simulações antigas com categorias já alteradas
  const { data: allCategories } = useAllCategories();
  const createSimulation = useCreateSimulation();
  const updateSimulation = useUpdateSimulation();
  const deleteSimulation = useDeleteSimulation();
  
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [isNewSimulationDialogOpen, setIsNewSimulationDialogOpen] = useState(false);
  
  // Get the selected simulation from the list (will auto-update when simulations change)
  const selectedSimulation = useMemo(() => {
    if (!selectedSimulationId || !simulations) return null;
    return simulations.find(s => s.id === selectedSimulationId) || null;
  }, [selectedSimulationId, simulations]);
  
  // Form states
  const [newSimulationForm, setNewSimulationForm] = useState({
    name: '',
    months: 12,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [defaultValues, setDefaultValues] = useState<Record<string, number>>({});
  const [monthlyOverrides, setMonthlyOverrides] = useState<Record<string, Record<string, number>>>({});
  const [useSavingsFlags, setUseSavingsFlags] = useState<Record<string, boolean>>({});
  const [useInvestmentsFlags, setUseInvestmentsFlags] = useState<Record<string, boolean>>({});
  const [useSavingsAmounts, setUseSavingsAmounts] = useState<Record<string, number>>({});
  const [useInvestmentsAmounts, setUseInvestmentsAmounts] = useState<Record<string, number>>({});
  const [simulationStep, setSimulationStep] = useState<'categories' | 'values' | 'months'>('categories');
  
  // Organize categories by type and group (like in Definicoes)
  const organizedCategories = useMemo(() => {
    if (!categories) return { income: [], expense: [] };
    
    const income: typeof categories = [];
    const expenseGroups: Record<string, typeof categories> = {
      fixed_expenses: [],
      general_expenses: [],
      optional_expenses: [],
      savings_investments: [],
    };
    
    categories.forEach(cat => {
      if (cat.type === 'income') {
        income.push(cat);
      } else {
        const group = cat.category_group || 'general_expenses';
        if (group in expenseGroups) {
          expenseGroups[group].push(cat);
        } else {
          expenseGroups['general_expenses'].push(cat);
        }
      }
    });
    
    // Sort by sort_order
    const sortByOrder = (a: typeof categories[0], b: typeof categories[0]) => {
      const orderA = a.sort_order ?? 999999;
      const orderB = b.sort_order ?? 999999;
      if (orderA === orderB) {
        return a.name.localeCompare(b.name);
      }
      return orderA - orderB;
    };
    
    income.sort(sortByOrder);
    Object.keys(expenseGroups).forEach(group => {
      expenseGroups[group].sort(sortByOrder);
    });
    
    return { income, expenseGroups };
  }, [categories]);
  
  // Handlers
  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
      // Remove from defaultValues if exists
      const newDefaults = { ...defaultValues };
      delete newDefaults[categoryId];
      setDefaultValues(newDefaults);
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };
  
  const handleNextStep = () => {
    if (selectedCategories.length === 0) {
      toast({
        title: 'Erro',
        description: 'Seleciona pelo menos uma categoria',
        variant: 'destructive',
      });
      return;
    }
    if (simulationStep === 'categories') {
      setSimulationStep('values');
    } else if (simulationStep === 'values') {
      setSimulationStep('months');
    }
  };
  
  const handleBackStep = () => {
    if (simulationStep === 'values') {
      setSimulationStep('categories');
    } else if (simulationStep === 'months') {
      setSimulationStep('values');
    }
  };
  
  const handleCreateSimulation = async () => {
    if (!newSimulationForm.name.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da simulação é obrigatório',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedCategories.length === 0) {
      toast({
        title: 'Erro',
        description: 'Seleciona pelo menos uma categoria',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await createSimulation.mutateAsync({
        name: newSimulationForm.name,
        months: newSimulationForm.months,
        start_year: startDate.getFullYear(),
        start_month: startDate.getMonth() + 1,
        default_values: defaultValues,
        monthly_overrides: monthlyOverrides,
      });
      
      toast({
        title: 'Sucesso',
        description: 'Simulação criada com sucesso',
      });
      
      setIsNewSimulationDialogOpen(false);
      setNewSimulationForm({ name: '', months: 12 });
      setSelectedCategories([]);
      setDefaultValues({});
      setMonthlyOverrides({});
      setSimulationStep('categories');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar simulação',
        variant: 'destructive',
      });
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSimulationStep('categories');
      setSelectedCategories([]);
      setDefaultValues({});
      setMonthlyOverrides({});
    }
    setIsNewSimulationDialogOpen(open);
  };
  
  const handleMonthValueChange = (monthIndex: number, categoryId: string, value: number) => {
    const monthIndexStr = String(monthIndex);
    const currentOverrides = monthlyOverrides[monthIndexStr] || {};
    
    setMonthlyOverrides({
      ...monthlyOverrides,
      [monthIndexStr]: {
        ...currentOverrides,
        [categoryId]: value,
      },
    });
  };
  
  const handleDeleteSimulation = async (id: string) => {
    if (!confirm('Tens a certeza que queres eliminar esta simulação?')) return;
    
    try {
      await deleteSimulation.mutateAsync(id);
      toast({
        title: 'Sucesso',
        description: 'Simulação eliminada com sucesso',
      });
      if (selectedSimulationId === id) {
        setSelectedSimulationId(null);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao eliminar simulação',
        variant: 'destructive',
      });
    }
  };
  
  if (isLoadingSimulations) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Simulação</h1>
            <p className="text-muted-foreground mt-1">Planeia o teu orçamento e vê projeções futuras</p>
          </div>
          <Dialog open={isNewSimulationDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow">
                <Plus className="w-4 h-4" />
                Nova Simulação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Simulação</DialogTitle>
              </DialogHeader>
              
              {simulationStep === 'categories' ? (
                <>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Simulação</Label>
                        <Input
                          value={newSimulationForm.name}
                          onChange={(e) => setNewSimulationForm({ ...newSimulationForm, name: e.target.value })}
                          placeholder="Ex: Simulação 2025"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Número de Meses</Label>
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={newSimulationForm.months || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value || '0', 10);
                            setNewSimulationForm({
                              ...newSimulationForm,
                              months: isNaN(value) || value <= 0 ? 0 : value,
                            });
                          }}
                          placeholder="Ex: 12"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Seleciona as Categorias</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Seleciona as categorias que queres incluir na simulação. Depois podes definir os valores padrão.
                        </p>
                      </div>
                      
                      <Tabs defaultValue="income" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="income" className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Receitas ({organizedCategories.income.length})
                          </TabsTrigger>
                          <TabsTrigger value="expense" className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            Despesas ({Object.values(organizedCategories.expenseGroups).flat().length})
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="income" className="mt-4">
                          <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                Receitas
                              </div>
                              {organizedCategories.income.map((category) => {
                                const isSelected = selectedCategories.includes(category.id);
                                return (
                                  <div
                                    key={category.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                      isSelected 
                                        ? 'bg-primary/10 border-primary/30' 
                                        : 'bg-card hover:bg-accent/50'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleCategoryToggle(category.id)}
                                    />
                                    <div 
                                      className="w-4 h-4 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: category.color || '#3b82f6' }}
                                    />
                                    <div className="flex-1">
                                      <Label className="text-sm font-medium cursor-pointer" onClick={() => handleCategoryToggle(category.id)}>
                                        {category.name}
                                      </Label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                        
                        <TabsContent value="expense" className="mt-4">
                          <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                              {(() => {
                                const groupOrder: string[] = ['fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
                                const groupLabels: Record<string, string> = {
                                  fixed_expenses: 'Despesas Fixas',
                                  general_expenses: 'Despesas Gerais',
                                  optional_expenses: 'Despesas Opcionais',
                                  savings_investments: 'Poupança/Investimentos',
                                };
                                
                                return groupOrder.map((group) => {
                                  const cats = organizedCategories.expenseGroups[group];
                                  if (!cats || cats.length === 0) return null;
                                  
                                  return (
                                    <div key={group}>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                        {groupLabels[group]}
                                      </div>
                                      {cats.map((category) => {
                                        const isSelected = selectedCategories.includes(category.id);
                                        return (
                                          <div
                                            key={category.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                              isSelected 
                                                ? 'bg-primary/10 border-primary/30' 
                                                : 'bg-card hover:bg-accent/50'
                                            }`}
                                          >
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={() => handleCategoryToggle(category.id)}
                                            />
                                            <div 
                                              className="w-4 h-4 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: category.color || '#ef4444' }}
                                            />
                                            <div className="flex-1">
                                              <Label className="text-sm font-medium cursor-pointer" onClick={() => handleCategoryToggle(category.id)}>
                                                {category.name}
                                              </Label>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleNextStep} disabled={selectedCategories.length === 0}>
                      Seguinte ({selectedCategories.length} selecionadas)
                    </Button>
                  </DialogFooter>
                </>
              ) : simulationStep === 'values' ? (
                <>
                  <div className="space-y-4 mt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Valores Padrão por Categoria</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Define valores que se aplicam a todos os meses. Podes editar cada mês individualmente depois.
                      </p>
                    </div>
                    
                    <ScrollArea className="h-[450px] pr-4">
                      <div className="space-y-3">
                        {selectedCategories.map((categoryId) => {
                          const category = categories?.find(c => c.id === categoryId);
                          if (!category) return null;
                          
                          return (
                            <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: category.color || (category.type === 'income' ? '#22c55e' : '#ef4444') }}
                              />
                              <div className="flex-1">
                                <Label className="text-sm font-medium">{category.name}</Label>
                                <p className="text-xs text-muted-foreground">{category.type === 'income' ? 'Receita' : 'Despesa'}</p>
                              </div>
                              <div className="w-40">
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={defaultValues[category.id] || 0}
                                    onChange={(e) => {
                                      const newDefaults = { ...defaultValues };
                                      const value = Number(e.target.value);
                                      if (value > 0) {
                                        newDefaults[category.id] = value;
                                      } else {
                                        newDefaults[category.id] = 0;
                                      }
                                      setDefaultValues(newDefaults);
                                    }}
                                    className="pl-8"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleBackStep}>
                      Voltar
                    </Button>
                    <Button onClick={handleNextStep}>
                      Seguinte
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4 mt-4">
                    <div>
                      <h4 className="font-semibold mb-2">Editar Valores por Mês</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ajusta os valores para cada mês individualmente. Os valores padrão são mostrados como referência.
                      </p>
                    </div>
                    
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {Array.from({ length: newSimulationForm.months }, (_, i) => {
                          const now = new Date();
                          const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                          const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                          const monthName = monthDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                          const monthIndex = String(i);
                          const monthOverrides = monthlyOverrides[monthIndex] || {};
                          
                          // Get saved values from monthly_overrides
                          const savedUseSavings = monthOverrides['_use_savings'] || 0;
                          const savedUseInvestments = monthOverrides['_use_investments'] || 0;
                          const isSavingsChecked = savedUseSavings > 0;
                          const isInvestmentsChecked = savedUseInvestments > 0;
                          
                          // Use saved values or state values
                          const currentSavingsAmount = useSavingsAmounts[monthIndex] ?? savedUseSavings;
                          const currentInvestmentsAmount = useInvestmentsAmounts[monthIndex] ?? savedUseInvestments;
                          const currentSavingsFlag = useSavingsFlags[monthIndex] ?? isSavingsChecked;
                          const currentInvestmentsFlag = useInvestmentsFlags[monthIndex] ?? isInvestmentsChecked;
                          
                          return (
                            <Collapsible key={i} className="border rounded-lg bg-card" defaultOpen={false}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">{monthName}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {Object.keys(monthOverrides).length > 0 
                                    ? `${Object.keys(monthOverrides).length} valor(es) personalizado(s)`
                                    : 'Valores padrão'}
                                </span>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="p-4 pt-0">
                                <div className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
                                  {selectedCategories.map((categoryId) => {
                                    const category = categories?.find(c => c.id === categoryId);
                                    if (!category) return null;
                                    
                                    const defaultValue = defaultValues[categoryId] || 0;
                                    const overrideValue = monthOverrides[categoryId];
                                    const currentValue = overrideValue !== undefined ? overrideValue : defaultValue;
                                    
                                    return (
                                      <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                        <div 
                                          className="w-4 h-4 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: category.color || (category.type === 'income' ? '#22c55e' : '#ef4444') }}
                                        />
                                        <div className="flex-1">
                                          <Label className="text-sm font-medium">{category.name}</Label>
                                          <p className="text-xs text-muted-foreground">
                                            {category.type === 'income' ? 'Receita' : 'Despesa'} • Padrão: €{defaultValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                                          </p>
                                        </div>
                                        <div className="w-40">
                                          <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={currentValue}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const value = Number(e.target.value);
                                                handleMonthValueChange(i, categoryId, value);
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => e.stopPropagation()}
                                              className="pl-8"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Checkboxes for using savings/investments */}
                                  <div className="mt-4 pt-4 border-t space-y-3">
                                    <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20">
                                      <div className="flex items-center gap-3 mb-2">
                                        <Checkbox
                                          id={`use-savings-${i}`}
                                          checked={currentSavingsFlag}
                                          onCheckedChange={(checked) => {
                                            setUseSavingsFlags({
                                              ...useSavingsFlags,
                                              [monthIndex]: checked as boolean,
                                            });
                                            // Update monthly overrides
                                            const currentOverrides = monthlyOverrides[monthIndex] || {};
                                            const currentAmount = checked ? (useSavingsAmounts[monthIndex] ?? savedUseSavings) : 0;
                                            const newOverrides = {
                                              ...currentOverrides,
                                              '_use_savings': currentAmount,
                                            };
                                            if (!checked && newOverrides['_use_savings'] === 0) {
                                              delete newOverrides['_use_savings'];
                                            }
                                            setMonthlyOverrides({
                                              ...monthlyOverrides,
                                              [monthIndex]: newOverrides,
                                            });
                                            // Update amounts state
                                            if (checked && !useSavingsAmounts[monthIndex]) {
                                              setUseSavingsAmounts({
                                                ...useSavingsAmounts,
                                                [monthIndex]: savedUseSavings || 0,
                                              });
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Label htmlFor={`use-savings-${i}`} className="flex-1 cursor-pointer">
                                          Utilizar € da Poupança
                                        </Label>
                                      </div>
                                      {currentSavingsFlag && (
                                        <div className="mt-2">
                                          <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={currentSavingsAmount}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const value = Math.max(0, Number(e.target.value));
                                                setUseSavingsAmounts({
                                                  ...useSavingsAmounts,
                                                  [monthIndex]: value,
                                                });
                                                // Update monthly overrides
                                                const currentOverrides = monthlyOverrides[monthIndex] || {};
                                                const newOverrides = {
                                                  ...currentOverrides,
                                                  '_use_savings': value,
                                                };
                                                setMonthlyOverrides({
                                                  ...monthlyOverrides,
                                                  [monthIndex]: newOverrides,
                                                });
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => e.stopPropagation()}
                                              className="pl-8"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                                      <div className="flex items-center gap-3 mb-2">
                                        <Checkbox
                                          id={`use-investments-${i}`}
                                          checked={currentInvestmentsFlag}
                                          onCheckedChange={(checked) => {
                                            setUseInvestmentsFlags({
                                              ...useInvestmentsFlags,
                                              [monthIndex]: checked as boolean,
                                            });
                                            // Update monthly overrides
                                            const currentOverrides = monthlyOverrides[monthIndex] || {};
                                            const currentAmount = checked ? (useInvestmentsAmounts[monthIndex] ?? savedUseInvestments) : 0;
                                            const newOverrides = {
                                              ...currentOverrides,
                                              '_use_investments': currentAmount,
                                            };
                                            if (!checked && newOverrides['_use_investments'] === 0) {
                                              delete newOverrides['_use_investments'];
                                            }
                                            setMonthlyOverrides({
                                              ...monthlyOverrides,
                                              [monthIndex]: newOverrides,
                                            });
                                            // Update amounts state
                                            if (checked && !useInvestmentsAmounts[monthIndex]) {
                                              setUseInvestmentsAmounts({
                                                ...useInvestmentsAmounts,
                                                [monthIndex]: savedUseInvestments || 0,
                                              });
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Label htmlFor={`use-investments-${i}`} className="flex-1 cursor-pointer">
                                          Utilizar € dos Investimentos
                                        </Label>
                                      </div>
                                      {useInvestmentsFlags[monthIndex] && (
                                        <div className="mt-2">
                                          <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={currentInvestmentsAmount}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const value = Math.max(0, Number(e.target.value));
                                                setUseInvestmentsAmounts({
                                                  ...useInvestmentsAmounts,
                                                  [monthIndex]: value,
                                                });
                                                // Update monthly overrides
                                                const currentOverrides = monthlyOverrides[monthIndex] || {};
                                                const newOverrides = {
                                                  ...currentOverrides,
                                                  '_use_investments': value,
                                                };
                                                setMonthlyOverrides({
                                                  ...monthlyOverrides,
                                                  [monthIndex]: newOverrides,
                                                });
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => e.stopPropagation()}
                                              className="pl-8"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleBackStep}>
                      Voltar
                    </Button>
                    <Button onClick={handleCreateSimulation} disabled={createSimulation.isPending}>
                      {createSimulation.isPending ? 'A criar...' : 'Criar Simulação'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* List of Simulations */}
        {simulations && simulations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {simulations.map((simulation) => (
              <motion.div
                key={simulation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border p-5 shadow-card cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedSimulationId(simulation.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold text-lg">{simulation.name}</h3>
                    <p className="text-sm text-muted-foreground">{simulation.months} meses</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSimulation(simulation.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Criada em {new Date(simulation.created_at).toLocaleDateString('pt-PT')}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-lg mb-2">Ainda não tens simulações</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cria a tua primeira simulação para começar a planear o futuro
            </p>
            <Button onClick={() => setIsNewSimulationDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeira Simulação
            </Button>
          </div>
        )}

        {/* Simulation Details */}
        {selectedSimulation && (
          <SimulationDetails 
            simulation={selectedSimulation}
            // Para os detalhes, garantimos que usamos TODAS as categorias usadas na simulação,
            // mesmo que alguma tenha sido desativada ou ocultada depois.
            categories={(allCategories || []).filter(cat => {
              const allIds = new Set([
                ...Object.keys(selectedSimulation.default_values || {}),
                ...Object.values(selectedSimulation.monthly_overrides || {}).flatMap(overrides => Object.keys(overrides || {})),
              ]);
              return allIds.has(cat.id);
            })}
            updateSimulation={updateSimulation}
            onClose={() => setSelectedSimulationId(null)}
          />
        )}
      </div>
    </Layout>
  );
}
