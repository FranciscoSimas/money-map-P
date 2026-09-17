import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Save, Check, ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useSalaryConfig } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateNetSalary } from '@/lib/salaryCalculator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface HistoryWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'config' | 'fill';

export function HistoryWizard({ open, onOpenChange }: HistoryWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const { data: salaryConfig, isLoading: isLoadingSalary } = useSalaryConfig();
  
  const [step, setStep] = useState<WizardStep>('config');
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [historicalData, setHistoricalData] = useState<Record<string, {
    salary: number;
    expenses: Record<string, number>;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Get month options (excluding current month)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value: monthKey, label: monthName, month: date.getMonth() + 1, year: date.getFullYear() });
    }
    return options;
  };

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const selectedMonthOptions = useMemo(() => monthOptions.slice(0, selectedMonths), [monthOptions, selectedMonths]);
  const currentMonth = selectedMonthOptions[currentMonthIndex];

  // Calculate default salary (rounded to 2 decimal places)
  const defaultSalary = salaryConfig ? (() => {
    const calculation = calculateNetSalary({
      baseSalary: salaryConfig.base_salary,
      hasFoodAllowance: salaryConfig.has_food_allowance,
      foodAllowanceValue: salaryConfig.food_allowance_value || 0,
      foodAllowanceType: (salaryConfig.food_allowance_type as 'card' | 'cash') || 'card',
      foodAllowanceDays: salaryConfig.food_allowance_days || 22,
      duodecimosType: salaryConfig.has_duodecimos ? 'both' : 'none',
      duodecimosValue: salaryConfig.duodecimos_value || undefined,
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
    return Math.round(calculation.monthlyNet * 100) / 100; // Round to 2 decimal places
  })() : 0;

  // Load existing data when step changes to 'fill'
  useEffect(() => {
    if (step !== 'fill' || !user || !categories || selectedMonths === 0 || selectedCategoryIds.length === 0) return;

    const loadExistingData = async () => {
      const data: Record<string, { salary: number; expenses: Record<string, number> }> = {};
      const selectedMonthOptions = monthOptions.slice(0, selectedMonths);
      
      for (const month of selectedMonthOptions) {
        const { data: records } = await supabase
          .from('monthly_records')
          .select('*')
          .eq('user_id', user.id)
          .eq('year', month.year)
          .eq('month', month.month);
        
        const expenses: Record<string, number> = {};
        let salary = 0;
        
        records?.forEach(record => {
          const category = categories.find(c => c.id === record.category_id);
          if (category?.type === 'income' && selectedCategoryIds.includes(category.id)) {
            salary += record.amount;
          } else if (category?.type === 'expense' && selectedCategoryIds.includes(category.id)) {
            expenses[record.category_id] = record.amount;
          }
        });
        
        data[month.value] = {
          salary: salary || defaultSalary,
          expenses,
        };
      }
      
      setHistoricalData(data);
    };

    loadExistingData();
  }, [step, user, categories, selectedMonths, selectedCategoryIds, defaultSalary, monthOptions]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSalaryChange = (monthKey: string, value: number) => {
    setHistoricalData({
      ...historicalData,
      [monthKey]: {
        ...(historicalData[monthKey] || { expenses: {} }),
        salary: value || 0,
      },
    });
  };

  const handleExpenseChange = (monthKey: string, categoryId: string, value: number) => {
    setHistoricalData({
      ...historicalData,
      [monthKey]: {
        ...(historicalData[monthKey] || { salary: defaultSalary, expenses: {} }),
        expenses: {
          ...(historicalData[monthKey]?.expenses || {}),
          [categoryId]: value || 0,
        },
      },
    });
  };

  const handleNext = () => {
    if (selectedCategoryIds.length === 0) {
      toast({
        title: 'Seleciona categorias',
        description: 'Precisas de selecionar pelo menos uma categoria para continuar.',
        variant: 'destructive',
      });
      return;
    }
    setStep('fill');
    setCurrentMonthIndex(0);
  };

  const handleSave = async () => {
    if (!user || !categories) return;
    
    setIsSaving(true);
    try {
      const monthlyRecords = [];
      
      for (const [monthKey, data] of Object.entries(historicalData)) {
        const [year, month] = monthKey.split('-').map(Number);
        
        // Save salary (income) - find income categories that are selected
        const incomeCategories = categories.filter(c => 
          c.type === 'income' && selectedCategoryIds.includes(c.id)
        );
        
        if (incomeCategories.length > 0 && data.salary > 0) {
          // Use the first income category or find "Salário"
          const salaryCategory = incomeCategories.find(c => 
            c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('salario')
          ) || incomeCategories[0];
          
          monthlyRecords.push({
            user_id: user.id,
            category_id: salaryCategory.id,
            year,
            month,
            amount: Math.round(data.salary * 100) / 100, // Round to 2 decimal places
          });
        }
        
        // Save expenses
        for (const [categoryId, amount] of Object.entries(data.expenses)) {
          if (selectedCategoryIds.includes(categoryId) && amount > 0) {
            monthlyRecords.push({
              user_id: user.id,
              category_id: categoryId,
              year,
              month,
              amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
            });
          }
        }
      }
      
      if (monthlyRecords.length > 0) {
        // Delete existing records for these months and categories first
        for (const month of selectedMonthOptions) {
          await supabase
            .from('monthly_records')
            .delete()
            .eq('user_id', user.id)
            .eq('year', month.year)
            .eq('month', month.month)
            .in('category_id', selectedCategoryIds);
        }
        
        // Insert new records
        await supabase
          .from('monthly_records')
          .insert(monthlyRecords);
      }
      
      queryClient.invalidateQueries({ queryKey: ['monthly_records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      toast({
        title: 'Histórico atualizado!',
        description: 'Os dados históricos foram guardados com sucesso.',
      });
      
      onOpenChange(false);
      // Reset state
      setStep('config');
      setCurrentMonthIndex(0);
      setHistoricalData({});
    } catch (error) {
      console.error('Error saving history:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar. Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setTimeout(() => {
      setStep('config');
      setCurrentMonthIndex(0);
      setHistoricalData({});
      setSelectedCategoryIds([]);
    }, 200);
  };

  const currentMonthData = currentMonth ? historicalData[currentMonth.value] : null;
  const totalExpenses = currentMonthData
    ? Object.values(currentMonthData.expenses).reduce((sum, val) => sum + (val || 0), 0)
    : 0;

  const selectedCategories = categories?.filter(c => selectedCategoryIds.includes(c.id)) || [];
  const expenseCategories = selectedCategories.filter(c => c.type === 'expense');
  const incomeCategories = selectedCategories.filter(c => c.type === 'income');

  if (isLoadingCategories || isLoadingSalary) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <Skeleton className="h-64 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'config' ? 'Configurar Histórico' : 'Preencher Histórico'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'config' ? (
          <div className="space-y-6 mt-4">
            {/* Month Selector */}
            <Card className="p-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Quantos meses anteriores queres atualizar?
                </Label>
                <Select
                  value={String(selectedMonths)}
                  onValueChange={(v) => {
                    setSelectedMonths(parseInt(v));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                      <SelectItem key={num} value={String(num)}>
                        {num} {num === 1 ? 'mês' : 'meses'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Os meses serão preenchidos começando no mais antigo (há {selectedMonths} {selectedMonths === 1 ? 'mês' : 'meses'}).
                </p>
              </div>
            </Card>

            {/* Category Selection */}
            <Card className="p-4">
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Seleciona as categorias que queres usar no histórico:
                </Label>
                <p className="text-sm text-muted-foreground">
                  Seleciona pelo menos uma categoria de receita e uma de despesa.
                </p>
                
                {/* Income Categories */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-success">Receitas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories?.filter(c => c.type === 'income').map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border transition-colors text-left',
                          selectedCategoryIds.includes(category.id)
                            ? 'bg-success/10 border-success text-success'
                            : 'bg-secondary/50 border-border hover:bg-secondary'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center',
                          selectedCategoryIds.includes(category.id)
                            ? 'border-success bg-success'
                            : 'border-muted-foreground'
                        )}>
                          {selectedCategoryIds.includes(category.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expense Categories */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-destructive">Despesas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories?.filter(c => c.type === 'expense').map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border transition-colors text-left',
                          selectedCategoryIds.includes(category.id)
                            ? 'bg-destructive/10 border-destructive text-destructive'
                            : 'bg-secondary/50 border-border hover:bg-secondary'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center',
                          selectedCategoryIds.includes(category.id)
                            ? 'border-destructive bg-destructive'
                            : 'border-muted-foreground'
                        )}>
                          {selectedCategoryIds.includes(category.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonthIndex(Math.max(0, currentMonthIndex - 1))}
                disabled={currentMonthIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <div className="text-center">
                <h3 className="font-semibold text-lg capitalize">{currentMonth?.label}</h3>
                <p className="text-sm text-muted-foreground">
                  Mês {currentMonthIndex + 1} de {selectedMonths}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonthIndex(Math.min(selectedMonths - 1, currentMonthIndex + 1))}
                disabled={currentMonthIndex === selectedMonths - 1}
              >
                Seguinte
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Salary Input */}
            {incomeCategories.length > 0 && (
              <Card className="p-4">
                <div className="space-y-2">
                  <Label>Salário Recebido neste mês</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={currentMonthData?.salary || defaultSalary}
                      onChange={(e) => handleSalaryChange(currentMonth.value, parseFloat(e.target.value) || 0)}
                      className="pl-8"
                      placeholder={String(defaultSalary.toFixed(2))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valor padrão: €{defaultSalary.toFixed(2)} (calculado automaticamente)
                  </p>
                </div>
              </Card>
            )}

            {/* Expenses by Category */}
            {expenseCategories.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold mb-4">Despesas por Categoria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {expenseCategories.map((category) => (
                    <div key={category.id} className="space-y-1">
                      <Label htmlFor={`${currentMonth.value}-${category.id}`} className="text-sm">
                        {category.name}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                        <Input
                          id={`${currentMonth.value}-${category.id}`}
                          type="number"
                          step="0.01"
                          value={currentMonthData?.expenses[category.id] || ''}
                          onChange={(e) =>
                            handleExpenseChange(currentMonth.value, category.id, parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="pl-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Month Total */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total de despesas:</span>
                    <span className="text-lg font-bold text-destructive">
                      €{totalExpenses.toFixed(2)}
                    </span>
                  </div>
                  {incomeCategories.length > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-medium">Saldo do mês:</span>
                      <span className={cn(
                        'text-lg font-bold',
                        (currentMonthData?.salary || 0) - totalExpenses >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        €{((currentMonthData?.salary || 0) - totalExpenses).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Save Button */}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('config')}>
                Voltar
              </Button>
              <Button onClick={handleSave} className="flex-1 gap-2" disabled={isSaving}>
                <Save className="w-4 h-4" />
                {isSaving ? 'A guardar...' : 'Guardar Histórico'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
