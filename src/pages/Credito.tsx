import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { CreditCard, TrendingDown, Calculator, Calendar, Euro, Percent, Plus, Home, Car, User, Wallet, X, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { useCredits, useCreateCredit, useUpdateCredit, useDeleteCredit, Credit } from '@/hooks/useCredits';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  calculateCredit,
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  calculateEarlyAmortization,
  calculateRemainingAmount,
  type EarlyAmortizationScenario,
} from '@/lib/creditCalculator';

const creditTypeLabels: Record<Credit['credit_type'], { label: string; icon: any }> = {
  car: { label: 'Carro', icon: Car },
  house: { label: 'Habitação', icon: Home },
  personal: { label: 'Pessoal', icon: User },
  other: { label: 'Outro', icon: Wallet },
};

export default function Credito() {
  const { data: credits, isLoading } = useCredits();
  const createCredit = useCreateCredit();
  const updateCredit = useUpdateCredit();
  const deleteCredit = useDeleteCredit();
  const { toast } = useToast();
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    credit_type: 'car' as Credit['credit_type'],
    total_amount: '',
    remaining_amount: '',
    monthly_payment: '',
    interest_rate: '',
    tan_rate: '',
    taeg_rate: '',
    down_payment: '',
    start_date: new Date().toISOString().split('T')[0],
    total_months: '',
  });

  // Advanced simulation state - always visible, editable inline
  const [earlyAmortizationScenarios, setEarlyAmortizationScenarios] = useState<EarlyAmortizationScenario[]>([]);

  // Calculate automatic values when form changes
  const calculatedValues = useMemo(() => {
    const totalAmount = parseFloat(formData.total_amount) || 0;
    const downPayment = parseFloat(formData.down_payment) || 0;
    const tanRate = parseFloat(formData.tan_rate) || 0;
    const totalMonths = parseInt(formData.total_months) || 0;
    
    // Calculate remaining amount if not set
    let remainingAmount = parseFloat(formData.remaining_amount) || 0;
    if (totalAmount > 0 && remainingAmount === 0) {
      remainingAmount = calculateRemainingAmount(totalAmount, downPayment);
    }
    
    // STEP 1: Calculate what the payment SHOULD be based on TAN
    let calculatedMonthlyPayment = 0;
    if (tanRate > 0 && remainingAmount > 0 && totalMonths > 0) {
      calculatedMonthlyPayment = calculateMonthlyPayment(remainingAmount, tanRate, totalMonths);
    }
    
    // STEP 2: Check if user has manually entered a payment (different from calculated)
    const manualPayment = parseFloat(formData.monthly_payment) || 0;
    const hasManualInput = formData.monthly_payment && formData.monthly_payment.trim() !== '' && manualPayment > 0;
    
    // CRITICAL: If user entered a value, check if it differs from calculated
    // If calculated exists and values differ, OR if calculated is 0 but user entered something, it's MANUAL
    const isManualPayment = hasManualInput && (
      calculatedMonthlyPayment === 0 || 
      Math.abs(manualPayment - calculatedMonthlyPayment) > 0.01
    );
    
    // STEP 3: Calculate totals based on payment type
    let totalInterest = 0;
    let schedule: any[] = [];
    let finalMonthlyPayment = isManualPayment ? manualPayment : calculatedMonthlyPayment;
    let actualMonths = totalMonths;
    let totalPaid = 0;
    
    if (tanRate > 0 && remainingAmount > 0 && totalMonths > 0 && finalMonthlyPayment > 0) {
      if (isManualPayment) {
        // MANUAL PAYMENT: User entered bank's actual payment
        // Assume they will pay THIS amount for ALL months (84 months)
        // DO NOT calculate early payoff - this is the REAL bank payment
        actualMonths = totalMonths; // ALWAYS use full term
        totalPaid = finalMonthlyPayment * totalMonths; // Simple: payment × months
        totalInterest = totalPaid - remainingAmount; // Total - capital = interest
        
        // Generate schedule for display (all months, even if balance goes negative)
        schedule = [];
        let balance = remainingAmount;
        const monthlyRate = tanRate / 100 / 12;
        
        for (let month = 1; month <= totalMonths; month++) {
          const interest = balance > 0 ? balance * monthlyRate : 0;
          const principalPayment = finalMonthlyPayment - interest;
          balance = Math.max(0, balance - principalPayment);
          
      schedule.push({
            month,
            payment: finalMonthlyPayment,
            principal: Math.round(principalPayment * 100) / 100,
            interest: Math.round(interest * 100) / 100,
            remainingBalance: Math.round(balance * 100) / 100,
          });
        }
      } else {
        // CALCULATED PAYMENT: Use normal amortization calculation
        schedule = generateAmortizationSchedule(
          remainingAmount,
          tanRate,
          totalMonths,
          finalMonthlyPayment
        );
        
        actualMonths = schedule.length;
        totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
        totalPaid = schedule.reduce((sum, item) => sum + item.payment, 0);
      }
    }
    
    return {
      remainingAmount,
      calculatedMonthlyPayment: finalMonthlyPayment,
      totalInterest,
      totalAmount: totalPaid || (remainingAmount + totalInterest),
      totalPaid: totalPaid || (remainingAmount + totalInterest),
      actualMonths: isManualPayment ? totalMonths : actualMonths, // FORCE totalMonths if manual
      isManualPayment,
      schedule,
    };
  }, [formData]);

  // Update form when calculated values change (only if field is empty)
  useEffect(() => {
    // Auto-fill remaining amount if calculated and field is empty
    if (calculatedValues.remainingAmount > 0) {
      const currentRemaining = parseFloat(formData.remaining_amount) || 0;
      if (currentRemaining === 0 || Math.abs(currentRemaining - calculatedValues.remainingAmount) > 0.01) {
        setFormData(prev => ({ ...prev, remaining_amount: calculatedValues.remainingAmount.toFixed(2) }));
      }
    }
    
    // Auto-fill monthly payment when calculated (ONLY if field is empty or zero)
    // DO NOT overwrite if user has manually entered a value
    if (calculatedValues.calculatedMonthlyPayment > 0) {
      const currentPayment = parseFloat(formData.monthly_payment) || 0;
      // Only auto-fill if field is empty/zero - NEVER overwrite manual input
      if (currentPayment === 0) {
        setFormData(prev => ({ ...prev, monthly_payment: calculatedValues.calculatedMonthlyPayment.toFixed(2) }));
      }
    }
  }, [calculatedValues.remainingAmount, calculatedValues.calculatedMonthlyPayment]);

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.total_amount || !formData.monthly_payment) {
      toast({
        title: 'Erro',
        description: 'Preenche pelo menos o nome, valor total e prestação mensal.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const creditData = {
        name: formData.name,
        credit_type: formData.credit_type,
        total_amount: parseFloat(formData.total_amount),
        remaining_amount: parseFloat(formData.remaining_amount) || calculatedValues.remainingAmount,
        monthly_payment: parseFloat(formData.monthly_payment) || calculatedValues.calculatedMonthlyPayment,
        interest_rate: parseFloat(formData.interest_rate) || null,
        tan_rate: parseFloat(formData.tan_rate) || null,
        taeg_rate: parseFloat(formData.taeg_rate) || null,
        down_payment: parseFloat(formData.down_payment) || null,
        start_date: formData.start_date,
        total_months: parseInt(formData.total_months) || null,
        is_active: true,
      };

      if (isEditMode && selectedCredit) {
        await updateCredit.mutateAsync({
          id: selectedCredit.id,
          ...creditData,
        });
        toast({
          title: 'Crédito atualizado!',
          description: 'O crédito foi atualizado com sucesso.',
        });
      } else {
        await createCredit.mutateAsync(creditData as any);
        toast({
          title: 'Crédito criado!',
          description: 'O crédito foi criado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving credit:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar o crédito.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      credit_type: 'car',
      total_amount: '',
      remaining_amount: '',
      monthly_payment: '',
      interest_rate: '',
      tan_rate: '',
      taeg_rate: '',
      down_payment: '',
      start_date: new Date().toISOString().split('T')[0],
      total_months: '',
    });
    setSelectedCredit(null);
    setIsEditMode(false);
    setEarlyAmortizationScenarios([]);
  };

  const handleEdit = (credit: Credit) => {
    setSelectedCredit(credit);
    setFormData({
      name: credit.name,
      credit_type: credit.credit_type,
      total_amount: credit.total_amount.toString(),
      remaining_amount: credit.remaining_amount.toString(),
      monthly_payment: credit.monthly_payment.toString(),
      interest_rate: (credit.interest_rate || '').toString(),
      tan_rate: (credit.tan_rate || '').toString(),
      taeg_rate: (credit.taeg_rate || '').toString(),
      down_payment: (credit.down_payment || '').toString(),
      start_date: credit.start_date,
      total_months: (credit.total_months || '').toString(),
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tens a certeza que queres eliminar este crédito?')) {
      try {
        await deleteCredit.mutateAsync(id);
        toast({
          title: 'Crédito eliminado!',
          description: 'O crédito foi eliminado com sucesso.',
        });
        if (selectedCredit?.id === id) {
          setSelectedCredit(null);
        }
      } catch (error) {
        console.error('Error deleting credit:', error);
        toast({
          title: 'Erro',
          description: 'Ocorreu um erro ao eliminar o crédito.',
          variant: 'destructive',
        });
      }
    }
  };

  // Load amortization scenarios from credit or localStorage
  useEffect(() => {
    if (selectedCredit) {
      // Try to load from credit's amortization_scenarios field (if exists in DB)
      const creditScenarios = (selectedCredit as any).amortization_scenarios;
      if (creditScenarios && Array.isArray(creditScenarios) && creditScenarios.length > 0) {
        setEarlyAmortizationScenarios(creditScenarios);
        return;
      }
      
      // Fallback to localStorage
      const storageKey = `credit_amortization_${selectedCredit.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEarlyAmortizationScenarios(parsed);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored scenarios:', e);
        }
      }
      
      // Default: at least one empty scenario
      setEarlyAmortizationScenarios([{ month: 12, amount: 0, type: 'reduce_term' }]);
    } else {
      setEarlyAmortizationScenarios([]);
    }
  }, [selectedCredit]);

  // Save scenarios to localStorage and database whenever they change
  useEffect(() => {
    if (selectedCredit && earlyAmortizationScenarios.length > 0) {
      // Save to localStorage immediately
      const storageKey = `credit_amortization_${selectedCredit.id}`;
      localStorage.setItem(storageKey, JSON.stringify(earlyAmortizationScenarios));
      
      // Save to database (async, don't block)
      if (updateCredit && selectedCredit.id) {
        updateCredit.mutate({
          id: selectedCredit.id,
          amortization_scenarios: earlyAmortizationScenarios,
        } as any, {
          onError: (error) => {
            console.error('Error saving scenarios to database:', error);
            // Don't show error to user - localStorage backup is fine
          },
        });
      }
    }
  }, [earlyAmortizationScenarios, selectedCredit, updateCredit]);

  const handleAddAmortizationMonth = () => {
    const totalMonths = selectedCredit?.total_months || 0;
    const lastMonth = earlyAmortizationScenarios.length > 0 
      ? Math.max(...earlyAmortizationScenarios.map(s => s.month))
      : 0;
    const nextMonth = Math.min(lastMonth + 12, totalMonths || 84);
    
    // Adiciona um novo cenário mantendo a ordem em que o utilizador criou
    setEarlyAmortizationScenarios([
      ...earlyAmortizationScenarios,
      { month: nextMonth, amount: 0, type: 'reduce_term' }
    ]);
  };

  const handleUpdateScenario = (index: number, field: 'month' | 'amount' | 'type', value: number | string) => {
    const updated = [...earlyAmortizationScenarios];
    updated[index] = { ...updated[index], [field]: value };
    // Atualiza sem reordenar – cada linha continua independente
    setEarlyAmortizationScenarios(updated);
  };

  const handleRemoveScenario = (index: number) => {
    if (earlyAmortizationScenarios.length === 1) {
      // Keep at least one scenario, just reset it
      setEarlyAmortizationScenarios([{ month: 12, amount: 0, type: 'reduce_term' }]);
    } else {
      setEarlyAmortizationScenarios(earlyAmortizationScenarios.filter((_, i) => i !== index));
    }
  };

  // Calculate advanced simulation for selected credit
  // Filter out scenarios with amount = 0 (empty/inactive)
  const activeScenarios = useMemo(() => {
    return earlyAmortizationScenarios.filter(s => s.amount > 0);
  }, [earlyAmortizationScenarios]);

  const advancedSimulation = useMemo(() => {
    if (!selectedCredit || activeScenarios.length === 0) return null;
    
    const tanRate = selectedCredit.tan_rate || selectedCredit.interest_rate || 0;
    if (!tanRate) return null;
    
    return calculateEarlyAmortization(
      selectedCredit.remaining_amount,
      tanRate,
      selectedCredit.monthly_payment,
      selectedCredit.total_months || 0,
      activeScenarios
    );
  }, [selectedCredit, activeScenarios]);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  const activeCredits = credits || [];
  const totalMonthlyPayments = activeCredits.reduce((sum, c) => sum + c.monthly_payment, 0);
  const totalRemaining = activeCredits.reduce((sum, c) => sum + c.remaining_amount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Créditos</h1>
            <p className="text-muted-foreground mt-1">Acompanha e gere os teus créditos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow w-fit"
                onClick={() => {
                  resetForm();
                  setIsEditMode(false);
                }}
              >
                <Plus className="w-4 h-4" />
                Novo Crédito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Editar Crédito' : 'Novo Crédito'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Preenche o <strong>Valor Total</strong>, <strong>TAN</strong> e <strong>Número de Meses</strong> para calcular automaticamente a prestação mensal.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Crédito *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Crédito Automóvel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="credit_type">Tipo *</Label>
                    <Select
                      value={formData.credit_type}
                      onValueChange={(v) => setFormData({ ...formData, credit_type: v as Credit['credit_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Carro</SelectItem>
                        <SelectItem value="house">Habitação</SelectItem>
                        <SelectItem value="personal">Pessoal</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_amount">Valor Total (€) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="total_amount"
                        type="number"
                        step="0.01"
                        value={formData.total_amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, total_amount: val });
                          // Auto-calculate remaining if down payment exists
                          if (formData.down_payment) {
                            const total = parseFloat(val) || 0;
                            const down = parseFloat(formData.down_payment) || 0;
                            setFormData(prev => ({ ...prev, remaining_amount: (total - down).toFixed(2) }));
                          }
                        }}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="down_payment">Entrada (€) - Opcional</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="down_payment"
                        type="number"
                        step="0.01"
                        value={formData.down_payment}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, down_payment: val });
                          // Auto-calculate remaining
                          const total = parseFloat(formData.total_amount) || 0;
                          const down = parseFloat(val) || 0;
                          setFormData(prev => ({ ...prev, remaining_amount: (total - down).toFixed(2) }));
                        }}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="remaining_amount">Valor Restante (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="remaining_amount"
                        type="number"
                        step="0.01"
                        value={formData.remaining_amount || calculatedValues.remainingAmount.toFixed(2)}
                        onChange={(e) => setFormData({ ...formData, remaining_amount: e.target.value })}
                        className="pl-8"
                        disabled={!!formData.total_amount && !!formData.down_payment}
                      />
                    </div>
                    {formData.total_amount && formData.down_payment && (
                      <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_payment">Prestação Mensal (€) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="monthly_payment"
                        type="number"
                        step="0.01"
                        value={formData.monthly_payment || (calculatedValues.calculatedMonthlyPayment > 0 ? calculatedValues.calculatedMonthlyPayment.toFixed(2) : '')}
                        onChange={(e) => setFormData({ ...formData, monthly_payment: e.target.value })}
                        className="pl-8"
                      />
                    </div>
                    {calculatedValues.calculatedMonthlyPayment > 0 && (!formData.monthly_payment || parseFloat(formData.monthly_payment) === 0) && (
                      <p className="text-xs text-success">Calculado automaticamente</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tan_rate">TAN (%) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      <Input
                        id="tan_rate"
                        type="number"
                        step="0.01"
                        value={formData.tan_rate}
                        onChange={(e) => setFormData({ ...formData, tan_rate: e.target.value })}
                        className="pl-8"
                        placeholder="Ex: 5.5"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Taxa Anual Nominal</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taeg_rate">TAEG (%) - Opcional</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      <Input
                        id="taeg_rate"
                        type="number"
                        step="0.01"
                        value={formData.taeg_rate}
                        onChange={(e) => setFormData({ ...formData, taeg_rate: e.target.value })}
                        className="pl-8"
                        placeholder="Ex: 6.2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Taxa Anual Efetiva Global</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_months">Número de Meses *</Label>
                    <Input
                      id="total_months"
                      type="number"
                      value={formData.total_months}
                      onChange={(e) => setFormData({ ...formData, total_months: e.target.value })}
                      placeholder="Ex: 60"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                {/* Calculated Summary */}
                {calculatedValues.calculatedMonthlyPayment > 0 && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                    <h4 className="font-semibold text-sm mb-2">Resumo do Crédito</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Prestação Mensal:</span>
                        <span className="font-bold ml-2">€{calculatedValues.calculatedMonthlyPayment.toFixed(2)}</span>
                      </div>
                      {calculatedValues.totalInterest > 0 && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Meses para Quitar:</span>
                            <span className="font-bold ml-2">{calculatedValues.actualMonths || parseInt(formData.total_months) || 0} meses</span>
                            {!calculatedValues.isManualPayment && calculatedValues.actualMonths && calculatedValues.actualMonths < parseInt(formData.total_months) && (
                              <span className="text-xs text-success ml-1">({parseInt(formData.total_months) - calculatedValues.actualMonths} meses antes)</span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total de Juros:</span>
                            <span className="font-bold ml-2">€{calculatedValues.totalInterest.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor Total a Pagar:</span>
                            <span className="font-bold ml-2">€{calculatedValues.totalPaid ? calculatedValues.totalPaid.toLocaleString('pt-PT', { minimumFractionDigits: 2 }) : calculatedValues.totalAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                          </div>
        <div>
                            <span className="text-muted-foreground">Capital:</span>
                            <span className="font-bold ml-2">€{calculatedValues.remainingAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {/* ONLY show savings message for calculated payments that finish early */}
                          {!calculatedValues.isManualPayment && calculatedValues.actualMonths && calculatedValues.actualMonths < parseInt(formData.total_months) && calculatedValues.totalPaid && (
                            <div className="col-span-2 mt-2 p-2 rounded bg-success/10 border border-success/20">
                              <p className="text-xs text-success">
                                <strong>Poupança:</strong> Ao pagar €{calculatedValues.calculatedMonthlyPayment.toFixed(2)}/mês, 
                                quitas o crédito em {calculatedValues.actualMonths} meses (em vez de {parseInt(formData.total_months)} meses), 
                                poupando €{(parseInt(formData.total_months) * calculatedValues.calculatedMonthlyPayment - calculatedValues.totalPaid).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} no total.
                              </p>
                            </div>
                          )}
                          {/* For manual payments, show that this is the REAL bank payment */}
                          {calculatedValues.isManualPayment && (
                            <div className="col-span-2 mt-2 p-2 rounded bg-warning/10 border border-warning/20">
                              <p className="text-xs text-muted-foreground">
                                <strong>Prestação Real do Banco:</strong> Este é o valor real que vais pagar (€{calculatedValues.calculatedMonthlyPayment.toFixed(2)}/mês durante {parseInt(formData.total_months) || 0} meses). 
                                O banco pode incluir comissões, seguros ou outros encargos que aumentam a prestação em relação ao cálculo baseado apenas no TAN.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateOrUpdate} className="flex-1">
                    {isEditMode ? 'Atualizar' : 'Criar Crédito'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs font-medium">Total Créditos</span>
            </div>
            <p className="text-xl font-display font-bold">
              €{totalRemaining.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Euro className="w-4 h-4" />
              <span className="text-xs font-medium">Prestação Mensal</span>
            </div>
            <p className="text-xl font-display font-bold">
              €{totalMonthlyPayments.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">Créditos Ativos</span>
            </div>
            <p className="text-xl font-display font-bold">{activeCredits.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Média Taxa</span>
            </div>
            <p className="text-xl font-display font-bold">
              {activeCredits.length > 0
                ? `${(activeCredits.reduce((sum, c) => sum + (c.tan_rate || c.interest_rate || 0), 0) / activeCredits.length).toFixed(2)}%`
                : '0%'}
            </p>
          </motion.div>
        </div>

        {/* Credits List */}
        {activeCredits.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border p-12 shadow-card text-center"
          >
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">Ainda não tens créditos registados</h3>
            <p className="text-muted-foreground mb-4">Adiciona o teu primeiro crédito para começar a acompanhar</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {activeCredits.map((credit, index) => {
              const TypeIcon = creditTypeLabels[credit.credit_type].icon;
              const paidAmount = credit.total_amount - credit.remaining_amount;
              const progress = (paidAmount / credit.total_amount) * 100;
              const startDate = new Date(credit.start_date);
              const now = new Date();
              const monthsElapsed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + 
                (now.getMonth() - startDate.getMonth()));
              const remainingMonths = Math.max(0, (credit.total_months || 0) - monthsElapsed);
              const isSelected = selectedCredit?.id === credit.id;
              
              const tanRate = credit.tan_rate || credit.interest_rate || 0;
              const schedule = tanRate > 0 ? generateAmortizationSchedule(
                credit.remaining_amount,
                tanRate,
                remainingMonths || credit.total_months || 0,
                credit.monthly_payment
              ) : [];
              
              const totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
              const totalPaid = schedule.reduce((sum, item) => sum + item.interest, 0) + credit.remaining_amount;

              return (
                <motion.div
                  key={credit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-xl border p-5 shadow-card"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
                        <TypeIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">{credit.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {creditTypeLabels[credit.credit_type].label} • {remainingMonths} meses restantes
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(credit)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(credit.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
            </div>

                  <div className="space-y-4">
                    <div>
              <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Progresso</span>
                        <span className="text-sm font-semibold text-primary">{progress.toFixed(1)}%</span>
              </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1, ease: 'easeOut' }}
                  className="h-full bg-gradient-primary rounded-full"
                />
              </div>
            </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                        <p className="font-display font-bold text-lg">
                          €{credit.total_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor Restante</p>
                        <p className="font-display font-bold text-lg">
                          €{credit.remaining_amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
          </div>
            <div>
                        <p className="text-xs text-muted-foreground mb-1">Prestação Mensal</p>
                        <p className="font-display font-semibold">
                          €{credit.monthly_payment.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </p>
            </div>
            <div>
                        <p className="text-xs text-muted-foreground mb-1">Taxa</p>
                        <p className="font-display font-semibold">
                          {credit.taeg_rate ? `${credit.taeg_rate}% TAEG` : credit.tan_rate ? `${credit.tan_rate}% TAN` : credit.interest_rate ? `${credit.interest_rate}%` : 'N/A'}
                        </p>
            </div>
          </div>

                    {isSelected && (
                      <div className="pt-4 border-t border-border">
                        <h4 className="font-semibold mb-4">Simulação de Amortização Antecipada</h4>

                        {/* Layout: dados à esquerda, gráfico à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left side: Advanced simulation */}
                          <div>
                            <AdvancedAmortizationSimulation
                              credit={credit}
                              scenarios={earlyAmortizationScenarios}
                              onAddMonth={handleAddAmortizationMonth}
                              onUpdateScenario={handleUpdateScenario}
                              onRemoveScenario={handleRemoveScenario}
                              simulationResult={advancedSimulation}
                              totalMonths={credit.total_months || 0}
                            />
                          </div>

                          {/* Right side: Amortization Chart */}
                          <div>
                            {tanRate > 0 && advancedSimulation && credit.remaining_amount > 0 && credit.total_months && credit.total_months > 0 && (
                              <CreditAmortizationChart
                                credit={credit}
                                tanRate={tanRate}
                                advancedResult={advancedSimulation}
                                scenarios={earlyAmortizationScenarios}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedCredit(isSelected ? null : credit);
                      }}
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      {isSelected ? 'Ocultar' : 'Simular'} Amortização
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Advanced Amortization Simulation Component
function AdvancedAmortizationSimulation({
  credit,
  scenarios,
  onAddMonth,
  onUpdateScenario,
  onRemoveScenario,
  simulationResult,
  totalMonths,
}: {
  credit: Credit;
  scenarios: EarlyAmortizationScenario[];
  onAddMonth: () => void;
  onUpdateScenario: (index: number, field: 'month' | 'amount' | 'type', value: number | string) => void;
  onRemoveScenario: (index: number) => void;
  simulationResult: any;
  totalMonths: number;
}) {
  const totalEarlyPayments = scenarios.filter(s => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
  const isPaidOff = simulationResult && simulationResult.newTotalMonths < totalMonths && simulationResult.newSchedule[simulationResult.newSchedule.length - 1]?.remainingBalance <= 0.01;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-info/10 border border-info/20 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>Como funciona:</strong> Em Portugal, ao fazer uma amortização antecipada, reduz-se o capital em falta. 
          Podes escolher entre <strong>reduzir o prazo</strong> (prestação mantém-se igual) ou <strong>reduzir a prestação</strong> (prazo mantém-se igual).
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>💡 Por que amortizar mais cedo é melhor?</strong> Os juros são calculados sobre o capital em falta. 
          Quanto mais cedo amortizas, o capital fica menor por mais tempo, pagando menos juros no total e poupando mais meses!
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Exemplo:</strong> Amortizar €1,000 no mês 12 poupa mais juros do que no mês 60, porque durante 48 meses 
          o capital será menor, gerando menos juros acumulados.
        </p>
              </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Amortizações Antecipadas</Label>
          <span className="text-xs text-muted-foreground">
            Total: €{totalEarlyPayments.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </span>
            </div>

        <div className="space-y-2">
          {scenarios.map((scenario, index) => (
              <div key={index} className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">{index + 1}</span>
                  </div>
                  <span className="text-xs font-medium">Amortização {index + 1}</span>
                </div>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground mb-1">Mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={totalMonths}
                      value={scenario.month || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        onUpdateScenario(index, 'month', value);
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-5">
                    <Label className="text-xs text-muted-foreground mb-1">Montante (€)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={scenario.amount || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          onUpdateScenario(index, 'amount', value);
                        }}
                        className="pl-8 h-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveScenario(index)}
                      className="h-9 w-9 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="col-span-12">
                  <Label className="text-xs text-muted-foreground mb-1">Tipo de Amortização</Label>
                  <Select
                    value={scenario.type || 'reduce_term'}
                    onValueChange={(value) => {
                      onUpdateScenario(index, 'type', value);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reduce_term">Reduzir Prazo</SelectItem>
                      <SelectItem value="reduce_payment">Reduzir Prestação</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scenario.type === 'reduce_payment' 
                      ? 'A prestação mensal diminui, o prazo mantém-se igual'
                      : 'A prestação mantém-se igual, o prazo diminui'}
                  </p>
                </div>
              </div>
            ))}
        </div>

        <Button
          variant="outline"
          onClick={onAddMonth}
          className="w-full gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Adicionar Mês
        </Button>
      </div>

      {simulationResult && (
        <div className="p-4 rounded-lg bg-success/10 border border-success/20 space-y-3">
          <h5 className="font-semibold text-sm mb-2">Resultado da Simulação</h5>
          
          {isPaidOff && (
            <div className="p-2 rounded bg-success/20 border border-success/30">
              <p className="text-xs font-semibold text-success">
                ✓ Crédito totalmente quitado em {simulationResult.newTotalMonths} meses!
              </p>
            </div>
          )}
          
          {(() => {
            const firstType = scenarios.find(s => s.amount > 0)?.type || 'reduce_term';
            const isReducePayment = firstType === 'reduce_payment';
            const originalPayment = credit.monthly_payment;
            const newPayment = simulationResult.newMonthlyPayment;
            const paymentReduction = originalPayment - newPayment;
            
            return (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {isReducePayment ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">Duração:</span>
                      <span className="font-bold ml-2">{credit.total_months || 0} meses</span>
                      <span className="text-xs text-muted-foreground ml-1">(mantém-se igual)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prestação Original:</span>
                      <span className="font-bold ml-2">€{originalPayment.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nova Prestação:</span>
                      <span className="font-bold text-success ml-2">€{newPayment.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Redução Mensal:</span>
                      <span className="font-bold text-success ml-2">€{paymentReduction.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-muted-foreground">Duração Original:</span>
                      <span className="font-bold ml-2">{credit.total_months || 0} meses</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nova Duração:</span>
                      <span className="font-bold text-success ml-2">{simulationResult.newTotalMonths} meses</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meses Poupados:</span>
                      <span className="font-bold text-success ml-2">{simulationResult.monthsSaved} meses</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prestação Mensal:</span>
                      <span className="font-bold ml-2">€{simulationResult.newMonthlyPayment.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                      <span className="text-xs text-muted-foreground ml-1">(mantém-se igual)</span>
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <span className="text-muted-foreground">Juros Poupados:</span>
                  <span className="font-bold text-success ml-2 text-lg">€{simulationResult.interestSaved.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })()}
          <div className="col-span-2 pt-2 border-t border-success/20">
            <span className="text-muted-foreground">Total Amortizado Antecipadamente:</span>
            <span className="font-bold ml-2">€{totalEarlyPayments.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Credit Amortization Chart Component
function CreditAmortizationChart({
  credit,
  tanRate,
  advancedResult,
  scenarios,
}: {
  credit: Credit;
  tanRate: number;
  advancedResult: any;
  scenarios: EarlyAmortizationScenario[];
}) {
  // Check if we're using reduce_payment type
  const activeScenarios = scenarios.filter(s => s.amount > 0);
  const isReducePayment = activeScenarios.length > 0 && 
    activeScenarios.every(s => (s.type || 'reduce_term') === 'reduce_payment');
  
  const normalSchedule = useMemo(() => {
    if (!credit.remaining_amount || !credit.total_months || !credit.monthly_payment) {
      return [];
    }
    return generateAmortizationSchedule(
      credit.remaining_amount,
      tanRate,
      credit.total_months,
      credit.monthly_payment
    );
  }, [credit.remaining_amount, tanRate, credit.total_months, credit.monthly_payment]);

  const comparisonSchedule = useMemo(() => {
    if (advancedResult && advancedResult.newSchedule) {
      return advancedResult.newSchedule;
    }
    return normalSchedule;
  }, [advancedResult, normalSchedule]);

  // Calculate interest saved for display
  const interestSaved = useMemo(() => {
    const normalTotalInterest = normalSchedule.reduce((sum, item) => sum + item.interest, 0);
    const comparisonTotalInterest = comparisonSchedule.reduce((sum, item) => sum + item.interest, 0);
    return normalTotalInterest - comparisonTotalInterest;
  }, [normalSchedule, comparisonSchedule]);

  const paymentChartData = useMemo(() => {
    if (!isReducePayment) return null;
    
    // For reduce_payment: show monthly payment evolution
    // We need to simulate month by month to track balance and payment changes
    const totalMonths = credit.total_months || 0;
    if (totalMonths === 0 || totalMonths > 600) {
      // Safety check: prevent excessive calculations
      return [];
    }
    
    const monthlyRate = tanRate / 100 / 12;
    let currentBalance = credit.remaining_amount;
    let currentPayment = credit.monthly_payment;
    const sortedScenarios = [...activeScenarios].sort((a, b) => a.month - b.month);
    let scenarioIndex = 0;
    
    return Array.from({ length: totalMonths }, (_, i) => {
      const month = i + 1;
      const scenario = sortedScenarios[scenarioIndex];
      
      // Check if there's an amortization this month (BEFORE regular payment)
      if (scenario && scenario.month === month) {
        // Apply amortization first
        currentBalance = Math.max(0, currentBalance - scenario.amount);
        scenarioIndex++;
        
        // Recalculate payment for remaining months
        const monthsRemaining = totalMonths - month;
        if (currentBalance > 0.01 && monthsRemaining > 0) {
          currentPayment = calculateMonthlyPayment(
            currentBalance,
            tanRate,
            monthsRemaining
          );
        } else {
          currentPayment = 0;
        }
      }
      
      // Apply regular monthly payment to reduce balance (for next month calculation)
      if (currentBalance > 0.01 && month < totalMonths) {
        const interest = currentBalance * monthlyRate;
        const principalPayment = Math.min(currentPayment - interest, currentBalance);
        currentBalance = Math.max(0, currentBalance - principalPayment);
      }
      
      return {
        month,
        semAmortizacao: credit.monthly_payment,
        comAmortizacao: Math.round(currentPayment * 100) / 100,
      };
    });
  }, [isReducePayment, credit.total_months, credit.remaining_amount, credit.monthly_payment, tanRate, activeScenarios]);

  if (isReducePayment && paymentChartData && paymentChartData.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-sm">Evolução da Prestação Mensal</h5>
          {interestSaved > 0 && (
            <span className="text-xs text-success font-medium">
              Poupança: €{interestSaved.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={paymentChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNormalPayment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExtraPayment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 60%, 42%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(145, 60%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
                tickFormatter={(v) => `${v}m`}
                label={{ value: 'Mês', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: 'hsl(160, 15%, 45%)' } }}
              />
              <YAxis 
                tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
                tickFormatter={(v) => `€${v.toFixed(0)}`}
                label={{ value: 'Prestação Mensal', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(160, 15%, 45%)' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(150, 15%, 88%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number, name: string) => {
                  const label = name === 'semAmortizacao' ? 'Sem Amortização' : 'Com Amortização';
                  return [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, label];
                }}
                labelFormatter={(label) => `Mês ${label}`}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="line"
              />
              <Area
                type="monotone"
                dataKey="semAmortizacao"
                stroke="hsl(220, 15%, 50%)"
                fill="url(#colorNormalPayment)"
                strokeWidth={2.5}
                name="Sem Amortização"
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="comAmortizacao"
                stroke="hsl(145, 60%, 42%)"
                fill="url(#colorExtraPayment)"
                strokeWidth={2.5}
                name="Com Amortização"
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Comparação da prestação mensal: normal vs com amortizações antecipadas
        </p>
      </div>
    );
  }

  // For reduce_term: show remaining balance evolution (original chart)
  const chartData = useMemo(() => {
    if (normalSchedule.length === 0 || comparisonSchedule.length === 0) {
      return [];
    }
    
    const maxMonths = Math.max(normalSchedule.length, comparisonSchedule.length);
    if (maxMonths > 600) {
      // Safety check: prevent excessive calculations
      return [];
    }
    
    let paidOffMonth = -1;
    
    return Array.from({ length: maxMonths }, (_, i) => {
      const normalItem = normalSchedule[i];
      const comparisonItem = comparisonSchedule[i];
      
      // Normal schedule value (or 0 if beyond schedule)
      const semAmortizacao = normalItem?.remainingBalance ?? 0;
      
      // Comparison schedule value
      let comAmortizacao = comparisonItem?.remainingBalance ?? 0;
      
      // If credit was paid off in comparison, keep it at 0 for all subsequent months
      if (paidOffMonth >= 0 && i >= paidOffMonth) {
        comAmortizacao = 0;
      } else if (comparisonItem && comAmortizacao <= 0.01 && paidOffMonth === -1) {
        paidOffMonth = comparisonItem.month;
        comAmortizacao = 0;
      } else if (!comparisonItem && paidOffMonth >= 0) {
        // Beyond comparison schedule but already paid off
        comAmortizacao = 0;
      }
      
      return {
        month: (i + 1),
        semAmortizacao: Math.round(semAmortizacao * 100) / 100,
        comAmortizacao: Math.round(comAmortizacao * 100) / 100,
      };
    });
  }, [normalSchedule, comparisonSchedule]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-muted-foreground">A calcular dados do gráfico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-sm">Evolução do Saldo em Dívida</h5>
        {interestSaved > 0 && (
          <span className="text-xs text-success font-medium">
            Poupança: €{interestSaved.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(220, 15%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExtra" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145, 60%, 42%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(145, 60%, 42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" opacity={0.5} />
            <XAxis 
              dataKey="month" 
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
              tickFormatter={(v) => `${v}m`}
              label={{ value: 'Mês', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: 'hsl(160, 15%, 45%)' } }}
            />
            <YAxis 
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 11 }}
              tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
              label={{ value: 'Saldo em Dívida', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(160, 15%, 45%)' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(150, 15%, 88%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) => {
                const label = name === 'semAmortizacao' ? 'Sem Amortização' : 'Com Amortização';
                return [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, label];
              }}
              labelFormatter={(label) => `Mês ${label}`}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey="semAmortizacao"
              stroke="hsl(220, 15%, 50%)"
              fill="url(#colorNormal)"
              strokeWidth={2.5}
              name="Sem Amortização"
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="comAmortizacao"
              stroke="hsl(145, 60%, 42%)"
              fill="url(#colorExtra)"
              strokeWidth={2.5}
              name="Com Amortização"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Comparação entre pagamento normal e com amortizações antecipadas
      </p>
    </div>
  );
}
