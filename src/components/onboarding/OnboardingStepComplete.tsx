import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Check, Euro, Calendar, Sparkles } from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';
import { calculateNetSalary } from '@/lib/salaryCalculator';

interface Props {
  data: OnboardingData;
}

export function OnboardingStepComplete({ data }: Props) {
  // Use the same calculation function as the preview
  const duodecimosType = data.duodecimosType || (data.hasDuodecimos ? 'both' : 'none');
  
  const calculation = data.baseSalary > 0 ? calculateNetSalary({
    baseSalary: data.baseSalary,
    hasFoodAllowance: data.hasFoodAllowance,
    foodAllowanceValue: data.foodAllowanceValue,
    foodAllowanceType: data.foodAllowanceType,
    foodAllowanceDays: data.foodAllowanceDays || 22,
    duodecimosType: duodecimosType,
    has13thMonth: data.has13thMonth,
    has14thMonth: data.has14thMonth,
    otherIncomeExempt: data.otherIncomeExempt || 0,
    otherIncomeIRSOnly: data.otherIncomeIRSOnly || 0,
    otherIncomeIRSandSS: data.otherIncomeIRSandSS || (data.otherIncome || 0),
    maritalStatus: data.maritalStatus,
    dependents: data.dependents,
    hasDisability: data.hasDisability,
    dependentsWithDisability: data.dependentsWithDisability,
    hasIRSJovem: data.hasIRSJovem,
    irsJovemYear: data.irsJovemYear,
  }) : null;
  
  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const getDuodecimosDisplay = () => {
    if (!data.hasDuodecimos) return 'Não';
    if (data.duodecimosValue && data.duodecimosValue > 0) {
      return `${formatCurrency(data.duodecimosValue)}/mês`;
    }
    // Calculate automatically
    const totalSubsidios = (data.has13thMonth ? data.baseSalary : 0) + (data.has14thMonth ? data.baseSalary : 0);
    const duodecimos = totalSubsidios / 12;
    return `${formatCurrency(duodecimos)}/mês (calculado)`;
  };

  const items = [
    { label: 'Nome', value: data.name, icon: '👤' },
    { label: 'Salário Bruto', value: formatCurrency(data.baseSalary), icon: '💰' },
    { label: 'Salário Líquido Mensal', value: calculation ? formatCurrency(calculation.monthlyNet) : 'N/A', icon: '💵' },
    { label: 'Subsídio Alimentação', value: data.hasFoodAllowance 
      ? `${formatCurrency(data.foodAllowanceValue)}/dia (${data.foodAllowanceType === 'card' ? 'Cartão' : 'Dinheiro'})` 
      : 'Não', icon: '🍽️' },
    { label: 'Duodécimos', value: getDuodecimosDisplay(), icon: '📅' },
    { label: 'Subsídios', value: data.has13thMonth && data.has14thMonth 
      ? 'Férias + Natal' 
      : data.has13thMonth 
      ? 'Natal' 
      : data.has14thMonth 
      ? 'Férias' 
      : 'Não', icon: '🎁' },
    { label: 'Dia de Pagamento', value: `Dia ${data.paymentDay}`, icon: '📆' },
    { label: 'IRS Jovem', value: data.hasIRSJovem 
      ? data.irsJovemYear === 1 
        ? '1º ano (100% isento)' 
        : data.irsJovemYear === 2 
        ? '2º-4º ano (75% isenção)' 
        : '5º-7º ano (50% isenção)'
      : 'Não', icon: '🎓' },
  ];

  return (
    <div className="space-y-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 mx-auto flex items-center justify-center"
      >
        <Check className="w-10 h-10 text-white" />
      </motion.div>
      
      <div>
        <h3 className="text-xl font-bold">Tudo pronto, {data.name}! 🎉</h3>
        <p className="text-muted-foreground mt-2">
          Aqui está o resumo da tua configuração
        </p>
      </div>

      <Card className="p-4 text-left">
        <div className="grid gap-3">
          {items.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <span className="text-muted-foreground flex items-center gap-2">
                <span>{item.icon}</span>
                {item.label}
              </span>
              <span className="font-medium">{item.value}</span>
            </motion.div>
          ))}
        </div>
      </Card>

      {calculation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-4"
        >
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-medium">Salário Líquido Mensal</span>
            </div>
            <p className="text-3xl font-bold text-gradient">
              {formatCurrency(calculation.monthlyNet)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.hasDuodecimos 
                ? 'Já inclui duodécimos (recebes 12 vezes por ano)'
                : data.has13thMonth || data.has14thMonth
                ? 'Recebes 14 vezes por ano (12 meses + subsídios)'
                : 'Recebes 12 vezes por ano'}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Descontos Mensais</p>
              <p className="text-lg font-bold text-destructive">
                {formatCurrency(calculation.totalDeductions)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                SS: {formatCurrency(calculation.socialSecurity)} | IRS: {formatCurrency(calculation.irsRetention)}
              </p>
            </div>
            <div className="bg-card rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Rendimento Anual Líquido</p>
              <p className="text-lg font-bold text-success">
                {formatCurrency(calculation.annualNet)}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
