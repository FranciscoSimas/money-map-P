import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Euro, Calendar, Utensils, Gift, CreditCard, Banknote, Calculator, TrendingUp } from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';
import { calculateNetSalary } from '@/lib/salaryCalculator';
import { useState, useEffect } from 'react';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function OnboardingStepSalary({ data, updateData }: Props) {
  return (
    <div className="space-y-6">
      {/* Base Salary */}
      <div className="space-y-2">
        <Label htmlFor="baseSalary" className="flex items-center gap-2">
          <Euro className="w-4 h-4 text-primary" />
          Salário Bruto Mensal
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="baseSalary"
            type="number"
            value={data.baseSalary || ''}
            onChange={(e) => updateData({ baseSalary: parseFloat(e.target.value) || 0 })}
            placeholder="1500"
            className="pl-8 text-lg"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          O valor bruto antes dos descontos (o que está no contrato)
        </p>
      </div>

      {/* IRS Jovem */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="irsJovem" className="flex items-center gap-2 cursor-pointer">
            <Gift className="w-4 h-4 text-primary" />
            Beneficias de IRS Jovem?
          </Label>
          <Switch
            id="irsJovem"
            checked={data.hasIRSJovem || false}
            onCheckedChange={(checked) => updateData({ hasIRSJovem: checked })}
          />
        </div>
        
        {data.hasIRSJovem && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="irsJovemYear">Ano de rendimentos</Label>
            <Select
              value={data.irsJovemYear ? String(data.irsJovemYear) : '1'}
              onValueChange={(value) => updateData({ irsJovemYear: parseInt(value) as 1 | 2 | 3 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  1º ano (100% isenção - só desconta Segurança Social)
                </SelectItem>
                <SelectItem value="2">
                  2º ao 4º ano (75% isenção)
                </SelectItem>
                <SelectItem value="3">
                  5º ao 7º ano (50% isenção)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.irsJovemYear === 1 
                ? 'No 1º ano só descontas 11% de Segurança Social. IRS está 100% isento.'
                : data.irsJovemYear === 2
                ? 'Descontas apenas 25% do IRS normal (75% de isenção).'
                : 'Descontas apenas 50% do IRS normal (50% de isenção).'}
            </p>
          </div>
        )}
      </Card>

      {/* Personal Data for IRS Calculation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado Civil</Label>
          <Select
            value={data.maritalStatus || 'single'}
            onValueChange={(value: 'single' | 'married_single' | 'married_joint') => 
              updateData({ maritalStatus: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Não casado</SelectItem>
              <SelectItem value="married_single">Casado, único titular</SelectItem>
              <SelectItem value="married_joint">Casado, dois titulares</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dependents">Dependentes</Label>
          <Input
            id="dependents"
            type="number"
            min="0"
            value={data.dependents || 0}
            onChange={(e) => updateData({ dependents: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Payment Day */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Dia de Pagamento
        </Label>
        <Select
          value={String(data.paymentDay)}
          onValueChange={(value) => updateData({ paymentDay: parseInt(value) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleciona o dia" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <SelectItem key={day} value={String(day)}>
                Dia {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Food Allowance */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="foodAllowance" className="flex items-center gap-2 cursor-pointer">
            <Utensils className="w-4 h-4 text-primary" />
            Subsídio de Alimentação
          </Label>
          <Switch
            id="foodAllowance"
            checked={data.hasFoodAllowance}
            onCheckedChange={(checked) => updateData({ hasFoodAllowance: checked })}
          />
        </div>
        
        {data.hasFoodAllowance && (
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="foodValue">Valor diário</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  id="foodValue"
                  type="number"
                  step="0.01"
                  value={data.foodAllowanceValue || ''}
                  onChange={(e) => updateData({ foodAllowanceValue: parseFloat(e.target.value) || 0 })}
                  placeholder="7.63"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="foodDays">Dias trabalhados por mês</Label>
              <Input
                id="foodDays"
                type="number"
                min="1"
                max="31"
                value={data.foodAllowanceDays || 22}
                onChange={(e) => updateData({ foodAllowanceDays: parseInt(e.target.value) || 22 })}
                placeholder="22"
              />
              <p className="text-xs text-muted-foreground">
                Número médio de dias trabalhados por mês
              </p>
            </div>
            
            <RadioGroup
              value={data.foodAllowanceType}
              onValueChange={(value: 'card' | 'cash') => updateData({ foodAllowanceType: value })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-1 cursor-pointer">
                  <CreditCard className="w-4 h-4" />
                  Cartão
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer">
                  <Banknote className="w-4 h-4" />
                  Dinheiro
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </Card>

      {/* Subsídios de Férias e Natal / Duodécimos */}
      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-2">Subsídios de Férias e Natal</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Escolhe como recebes os subsídios: em duodécimos (12 salários) ou separadamente (14 salários)
          </p>
        </div>
        
        {/* Opção: Duodécimos OU 14 salários */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex-1">
              <Label htmlFor="duodecimos" className="flex items-center gap-2 cursor-pointer font-medium">
                <Calendar className="w-4 h-4 text-primary" />
                Recebo em Duodécimos
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Os subsídios são distribuídos pelos 12 meses (recebes 12 vezes por ano)
              </p>
            </div>
            <Switch
              id="duodecimos"
              checked={data.hasDuodecimos}
              onCheckedChange={(checked) => {
                updateData({ 
                  hasDuodecimos: checked,
                  duodecimosType: checked ? 'both' : 'none',
                  // Se ativar duodécimos, garantir que os subsídios estão ativos
                  has13thMonth: checked ? true : data.has13thMonth,
                  has14thMonth: checked ? true : data.has14thMonth,
                });
              }}
            />
          </div>
          
          {!data.hasDuodecimos && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Recebes os subsídios separadamente (14 salários por ano):</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="14th" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Gift className="w-4 h-4 text-primary" />
                      Subsídio de Férias (14º mês)
                    </Label>
                    <Switch
                      id="14th"
                      checked={data.has14thMonth}
                      onCheckedChange={(checked) => updateData({ has14thMonth: checked })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="13th" className="flex items-center gap-2 cursor-pointer text-sm">
                      <Gift className="w-4 h-4 text-primary" />
                      Subsídio de Natal (13º mês)
                    </Label>
                    <Switch
                      id="13th"
                      checked={data.has13thMonth}
                      onCheckedChange={(checked) => updateData({ has13thMonth: checked })}
                    />
                  </div>
                </div>
              </div>
              
              {(data.has13thMonth || data.has14thMonth) && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium">Dias de pagamento dos subsídios:</p>
                  
                  {data.has14thMonth && (
                    <div className="space-y-2">
                      <Label htmlFor="vacationDay">Dia do mês - Subsídio de Férias</Label>
                      <Select
                        value={data.vacationPaymentDay ? String(data.vacationPaymentDay) : ''}
                        onValueChange={(value) => updateData({ vacationPaymentDay: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleciona o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={String(day)}>
                              Dia {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {data.has13thMonth && (
                    <div className="space-y-2">
                      <Label htmlFor="christmasDay">Dia do mês - Subsídio de Natal</Label>
                      <Select
                        value={data.christmasPaymentDay ? String(data.christmasPaymentDay) : ''}
                        onValueChange={(value) => updateData({ christmasPaymentDay: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleciona o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={String(day)}>
                              Dia {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Normalmente: Férias em Junho/Julho e Natal em Novembro/Dezembro
                  </p>
                </div>
              )}
            </div>
          )}
          
          {data.hasDuodecimos && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Os duodécimos são calculados automaticamente com base no teu salário líquido.
                {data.has13thMonth && data.has14thMonth
                  ? ` Recebes os dois subsídios em duodécimos.`
                  : data.has13thMonth || data.has14thMonth
                  ? ` Recebes um subsídio em duodécimos.`
                  : ` Ativa pelo menos um subsídio para calcular os duodécimos.`}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Other Income */}
      <div className="space-y-2">
        <Label htmlFor="otherIncome" className="flex items-center gap-2">
          <Euro className="w-4 h-4 text-primary" />
          Outros Rendimentos (opcional)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="otherIncome"
            type="number"
            value={data.otherIncome || ''}
            onChange={(e) => updateData({ otherIncome: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="pl-8"
          />
        </div>
        <Input
          value={data.otherIncomeDescription}
          onChange={(e) => updateData({ otherIncomeDescription: e.target.value })}
          placeholder="Descrição (ex: freelance, rendas...)"
          className="mt-2"
        />
      </div>

      {/* Salary Calculation Preview */}
      {data.baseSalary > 0 && (
        <SalaryCalculationPreview data={data} />
      )}
    </div>
  );
}

function SalaryCalculationPreview({ data }: { data: OnboardingData }) {
  const [calculation, setCalculation] = useState<any>(null);

  useEffect(() => {
    if (data.baseSalary > 0) {
      // Mapear duodécimos: se hasDuodecimos é true, assume 'both', senão 'none'
      const duodecimosType = data.duodecimosType || (data.hasDuodecimos ? 'both' : 'none');
      
      const result = calculateNetSalary({
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
        otherIncomeIRSandSS: data.otherIncomeIRSandSS || (data.otherIncome || 0), // Compatibilidade: assume IRS+SS se não especificado
        maritalStatus: data.maritalStatus,
        dependents: data.dependents,
        hasDisability: data.hasDisability,
        dependentsWithDisability: data.dependentsWithDisability,
        hasIRSJovem: data.hasIRSJovem,
        irsJovemYear: data.irsJovemYear,
      });
      setCalculation(result);
    }
  }, [data]);

  if (!calculation) return null;

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-primary" />
        <h4 className="font-semibold">Pré-visualização do Salário Líquido</h4>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Salário Bruto:</span>
          <span className="font-medium">€{calculation.grossSalary.toFixed(2)}</span>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Segurança Social (11%):</span>
            <span className="font-medium text-destructive">
              -€{calculation.socialSecurity.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              IRS Retenção na Fonte:
              {data.hasIRSJovem && data.irsJovemYear === 1 && (
                <span className="text-success ml-1">(100% isento - IRS Jovem)</span>
              )}
            </span>
            <span className="font-medium text-destructive">
              -€{calculation.irsRetention.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t">
            <span className="text-sm font-medium">Total Descontos:</span>
            <span className="font-bold text-destructive">
              -€{calculation.totalDeductions.toFixed(2)}
            </span>
          </div>
        </div>
        
        {data.hasFoodAllowance && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Subsídio Alimentação:</span>
            <span className="font-medium text-success">
              +€{calculation.foodAllowanceNet.toFixed(2)}
            </span>
          </div>
        )}
        
        {data.hasDuodecimos && calculation.duodecimosNet > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Duodécimos (já incluído no salário):</span>
            <span className="font-medium text-success">
              +€{calculation.duodecimosNet.toFixed(2)}/mês
            </span>
          </div>
        )}
        
        {!data.hasDuodecimos && (data.has13thMonth || data.has14thMonth) && (
          <>
            {data.has14thMonth && calculation.vacationSubsidyNet && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subsídio de Férias (anual):</span>
                <span className="font-medium text-success">
                  +€{calculation.vacationSubsidyNet.toFixed(2)}
                </span>
              </div>
            )}
            {data.has13thMonth && calculation.christmasSubsidyNet && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subsídio de Natal (anual):</span>
                <span className="font-medium text-success">
                  +€{calculation.christmasSubsidyNet.toFixed(2)}
                </span>
              </div>
            )}
          </>
        )}
        
        <div className="pt-2 border-t border-primary/20">
          <div className="flex justify-between items-center">
            <span className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Salário Líquido Mensal:
            </span>
            <span className="text-xl font-bold text-primary">
              €{calculation.monthlyNet.toFixed(2)}
            </span>
          </div>
          {data.hasDuodecimos && (
            <p className="text-xs text-success mt-1">
              ✓ Já inclui duodécimos (recebes 12 vezes por ano)
            </p>
          )}
          {!data.hasDuodecimos && (data.has13thMonth || data.has14thMonth) && (
            <p className="text-xs text-muted-foreground mt-1">
              Recebes 14 vezes por ano (12 meses + {data.has14thMonth && data.has13thMonth ? '2 subsídios' : '1 subsídio'})
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Retenção na fonte: {calculation.retentionRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </Card>
  );
}
