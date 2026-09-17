import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, Wallet, Tag, ArrowRight, ArrowLeft, Check, 
  Sparkles, Euro, Calendar, CreditCard, Utensils
} from 'lucide-react';
import { OnboardingStepProfile } from '@/components/onboarding/OnboardingStepProfile';
import { OnboardingStepSalary } from '@/components/onboarding/OnboardingStepSalary';
import { OnboardingStepCategories } from '@/components/onboarding/OnboardingStepCategories';
import { OnboardingStepBalances } from '@/components/onboarding/OnboardingStepBalances';
import { OnboardingStepHistory } from '@/components/onboarding/OnboardingStepHistory';
import { OnboardingStepComplete } from '@/components/onboarding/OnboardingStepComplete';
import { useUpdateProfile, useUpdateSalaryConfig, useProfile, useSalaryConfig } from '@/hooks/useProfile';
import { useUpdateCurrentBalances, useCurrentBalances } from '@/hooks/useCurrentBalances';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const STEPS = [
  { id: 'profile', title: 'Perfil', icon: User, description: 'Informações básicas' },
  { id: 'salary', title: 'Rendimentos', icon: Wallet, description: 'Configuração salarial' },
  { id: 'categories', title: 'Categorias', icon: Tag, description: 'Personalização' },
  { id: 'balances', title: 'Montantes', icon: Wallet, description: 'Situação atual' },
  { id: 'history', title: 'Histórico', icon: Calendar, description: 'Dados anteriores (opcional)' },
  { id: 'complete', title: 'Concluído', icon: Check, description: 'Pronto a usar!' },
];

export interface OnboardingData {
  name: string;
  baseSalary: number;
  hasFoodAllowance: boolean;
  foodAllowanceValue: number;
  foodAllowanceType: 'card' | 'cash';
  foodAllowanceDays?: number;
  hasDuodecimos: boolean; // Mantido para compatibilidade
  duodecimosType?: 'none' | '50_one' | '50_both_or_one_full' | 'both'; // Novo formato do Santander
  duodecimosValue: number; // Mantido para compatibilidade
  has13thMonth: boolean;
  has14thMonth: boolean;
  // Dias de pagamento dos subsídios (quando não tem duodécimos)
  vacationPaymentDay?: number; // Dia do mês para subsídio de férias
  christmasPaymentDay?: number; // Dia do mês para subsídio de natal
  otherIncome: number; // Mantido para compatibilidade
  otherIncomeExempt?: number; // Rendimentos isentos
  otherIncomeIRSOnly?: number; // Rendimentos sujeitos apenas a IRS
  otherIncomeIRSandSS?: number; // Rendimentos sujeitos a IRS e SS
  otherIncomeDescription: string;
  hasDisability?: boolean; // Incapacidade própria
  dependentsWithDisability?: number; // Dependentes com incapacidade
  paymentDay: number;
  selectedCategories: string[];
  // Dados pessoais para IRS
  maritalStatus?: 'single' | 'married_single' | 'married_joint';
  dependents?: number;
  hasIRSJovem?: boolean;
  irsJovemYear?: 1 | 2 | 3; // 1 = 100% isenção, 2 = 75% isenção, 3 = 50% isenção
  // Montantes atuais
  bankBalance?: number;
  savingsBalance?: number;
  investmentsBalance?: number;
  otherBalance?: number;
  // Dados históricos
  historicalMonths?: number;
  historicalData?: Record<string, Record<string, number>>; // { month: { categoryId: amount } }
}

const initialData: OnboardingData = {
  name: '',
  baseSalary: 0,
  hasFoodAllowance: false,
  foodAllowanceValue: 0,
  foodAllowanceType: 'card',
  hasDuodecimos: false,
  duodecimosValue: 0,
  has13thMonth: true,
  has14thMonth: true,
  otherIncome: 0,
  otherIncomeDescription: '',
  paymentDay: 1,
  selectedCategories: [],
};

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const { data: profile } = useProfile();
  const { data: salaryConfig } = useSalaryConfig();
  const { data: currentBalances } = useCurrentBalances();
  const updateProfile = useUpdateProfile();
  const updateSalaryConfig = useUpdateSalaryConfig();
  const updateCurrentBalances = useUpdateCurrentBalances();
  
  // Load existing data when component mounts (for updating)
  useEffect(() => {
    const loadExistingData = async () => {
      if (!profile || !salaryConfig) {
        setIsLoading(false);
        return;
      }
      
      // Load profile data
      const loadedData: Partial<OnboardingData> = {
        name: profile.name || '',
        selectedCategories: (profile.selected_categories as string[]) || [],
      };
      
      // Load salary config
      if (salaryConfig) {
        loadedData.baseSalary = salaryConfig.base_salary || 0;
        loadedData.hasFoodAllowance = salaryConfig.has_food_allowance || false;
        loadedData.foodAllowanceValue = salaryConfig.food_allowance_value || 0;
        loadedData.foodAllowanceType = (salaryConfig.food_allowance_type as 'card' | 'cash') || 'card';
        loadedData.foodAllowanceDays = salaryConfig.food_allowance_days || 22;
        loadedData.hasDuodecimos = salaryConfig.has_duodecimos || false;
        loadedData.duodecimosValue = salaryConfig.duodecimos_value || 0;
        loadedData.has13thMonth = salaryConfig.has_13th_month ?? true;
        loadedData.has14thMonth = salaryConfig.has_14th_month ?? true;
        loadedData.otherIncome = salaryConfig.other_income || 0;
        loadedData.otherIncomeDescription = salaryConfig.other_income_description || '';
        loadedData.paymentDay = salaryConfig.payment_day || 1;
        loadedData.maritalStatus = (salaryConfig.marital_status as 'single' | 'married_single' | 'married_joint') || 'single';
        loadedData.dependents = salaryConfig.dependents || 0;
        loadedData.hasIRSJovem = salaryConfig.has_irs_jovem || false;
        loadedData.irsJovemYear = (salaryConfig.irs_jovem_year as 1 | 2 | 3) || undefined;
        loadedData.vacationPaymentDay = salaryConfig.vacation_payment_day || undefined;
        loadedData.christmasPaymentDay = salaryConfig.christmas_payment_day || undefined;
      }
      
      // Load current balances
      if (currentBalances) {
        loadedData.bankBalance = currentBalances.bank_balance || 0;
        loadedData.savingsBalance = currentBalances.savings_balance || 0;
        loadedData.investmentsBalance = currentBalances.investments_balance || 0;
        loadedData.otherBalance = currentBalances.other_balance || 0;
      }
      
      setData(prev => ({ ...prev, ...loadedData }));
      setIsLoading(false);
    };
    
    loadExistingData();
  }, [profile, salaryConfig, currentBalances]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  
  // Show loading while fetching existing data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">A carregar dados...</p>
        </div>
      </div>
    );
  }

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    
    try {
      // Update profile
      await updateProfile.mutateAsync({
        name: data.name,
        onboarding_completed: true,
        selected_categories: data.selectedCategories,
      });
      
      // Update salary config
      await updateSalaryConfig.mutateAsync({
        base_salary: data.baseSalary,
        has_food_allowance: data.hasFoodAllowance,
        food_allowance_value: data.foodAllowanceValue,
        food_allowance_type: data.foodAllowanceType,
        food_allowance_days: data.foodAllowanceDays || 22,
        has_duodecimos: data.hasDuodecimos,
        duodecimos_value: data.duodecimosValue,
        has_13th_month: data.has13thMonth,
        has_14th_month: data.has14thMonth,
        other_income: data.otherIncome,
        other_income_description: data.otherIncomeDescription,
        payment_day: data.paymentDay,
        marital_status: data.maritalStatus || 'single',
        dependents: data.dependents || 0,
        has_irs_jovem: data.hasIRSJovem || false,
        irs_jovem_year: data.irsJovemYear || null,
        vacation_payment_day: data.vacationPaymentDay || null,
        christmas_payment_day: data.christmasPaymentDay || null,
      });
      
      // Save selected categories
      await updateProfile.mutateAsync({
        selected_categories: data.selectedCategories,
      });
      
      // Save current balances
      if (data.bankBalance !== undefined || data.savingsBalance !== undefined || 
          data.investmentsBalance !== undefined || data.otherBalance !== undefined) {
        await updateCurrentBalances.mutateAsync({
          bank_balance: data.bankBalance || 0,
          savings_balance: data.savingsBalance || 0,
          investments_balance: data.investmentsBalance || 0,
          other_balance: data.otherBalance || 0,
        });
      }
      
      // Save historical data (monthly records)
      if (data.historicalData && Object.keys(data.historicalData).length > 0) {
        const { user } = await supabase.auth.getUser();
        if (user) {
          const monthlyRecords = [];
          
          for (const [monthKey, categoryData] of Object.entries(data.historicalData)) {
            const [year, month] = monthKey.split('-').map(Number);
            
            for (const [categoryId, amount] of Object.entries(categoryData)) {
              if (amount > 0) {
                monthlyRecords.push({
                  user_id: user.id,
                  category_id: categoryId,
                  year,
                  month,
                  amount,
                });
              }
            }
          }
          
          if (monthlyRecords.length > 0) {
            await supabase
              .from('monthly_records')
              .upsert(monthlyRecords, { onConflict: 'user_id,category_id,year,month' });
          }
        }
      }
      
      toast({
        title: 'Configuração concluída!',
        description: 'Bem-vindo ao FinPlanner!',
      });
      
      navigate('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar. Tenta novamente.',
        variant: 'destructive',
      });
    }
    
    setIsSubmitting(false);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingStepProfile data={data} updateData={updateData} />;
      case 1:
        return <OnboardingStepSalary data={data} updateData={updateData} />;
      case 2:
        return <OnboardingStepCategories data={data} updateData={updateData} />;
      case 3:
        return <OnboardingStepBalances data={data} updateData={updateData} />;
      case 4:
        return <OnboardingStepHistory data={data} updateData={updateData} />;
      case 5:
        return <OnboardingStepComplete data={data} />;
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return data.name.trim().length >= 2;
      case 1:
        return data.baseSalary > 0;
      case 2:
        return true; // Categories are optional, defaults are already selected
      case 3:
        return true; // Balances are optional, can be 0
      case 4:
        return true; // History is optional
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Progress Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isCompleted || isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <StepIcon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    )}
                  </motion.div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card className="border-border/50 backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = STEPS[currentStep].icon;
                return <StepIcon className="w-5 h-5 text-primary" />;
              })()}
              {STEPS[currentStep].title}
            </CardTitle>
            <CardDescription>{STEPS[currentStep].description}</CardDescription>
          </CardHeader>
          
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
            className={currentStep === 0 ? 'invisible' : ''}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? 'A guardar...' : 'Começar a usar!'}
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
