import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, SkipForward, Info } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import type { OnboardingData } from '@/pages/Onboarding';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function OnboardingStepHistory({ data, updateData }: Props) {
  const { data: categories, isLoading } = useCategories();
  const [selectedMonths, setSelectedMonths] = useState<number>(data.historicalMonths || 0);
  const [historicalData, setHistoricalData] = useState<Record<string, Record<string, number>>>(
    data.historicalData || {}
  );

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];

  // Generate month options (last 12 months, EXCLUDING current month)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    // Start from 1 month ago (exclude current month)
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value: monthKey, label: monthName, month: date.getMonth() + 1, year: date.getFullYear() });
    }
    return options;
  };

  const monthOptions = getMonthOptions();

  const handleMonthsChange = (value: string) => {
    const numMonths = parseInt(value);
    setSelectedMonths(numMonths);
    updateData({ historicalMonths: numMonths });
    
    // Initialize empty data for selected months
    if (numMonths > 0) {
      const newData: Record<string, Record<string, number>> = {};
      for (let i = 0; i < numMonths; i++) {
        const monthKey = monthOptions[i].value;
        newData[monthKey] = {};
      }
      setHistoricalData(newData);
      updateData({ historicalData: newData });
    }
  };

  const handleAmountChange = (monthKey: string, categoryId: string, value: number) => {
    const newData = {
      ...historicalData,
      [monthKey]: {
        ...(historicalData[monthKey] || {}),
        [categoryId]: value || 0,
      },
    };
    setHistoricalData(newData);
    updateData({ historicalData: newData });
  };

  const skipStep = () => {
    updateData({ historicalMonths: 0, historicalData: {} });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-muted-foreground text-sm">
          Preenche os gastos dos meses anteriores para termos dados históricos
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Isto ajuda a ter uma visão mais completa das tuas finanças
        </p>
      </div>

      {/* Skip Option */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={skipStep}
          className="gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Saltar este passo
        </Button>
      </div>

      {/* Month Selector */}
      <Card className="p-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Quantos meses anteriores queres preencher?
          </Label>
          <Select
            value={String(selectedMonths)}
            onValueChange={handleMonthsChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleciona o número de meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Nenhum (saltar)</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                <SelectItem key={num} value={String(num)}>
                  {num} {num === 1 ? 'mês' : 'meses'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Historical Data Tables */}
      {selectedMonths > 0 && (
        <div className="space-y-4">
          {monthOptions.slice(0, selectedMonths).map((month) => {
            const monthKey = month.value;
            const monthData = historicalData[monthKey] || {};

            return (
              <Card key={monthKey} className="p-4">
                <div className="mb-4">
                  <h4 className="font-semibold text-lg capitalize">{month.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    Preenche os valores gastos em cada categoria
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {expenseCategories.map((category) => (
                    <div key={category.id} className="space-y-1">
                      <Label htmlFor={`${monthKey}-${category.id}`} className="text-sm">
                        {category.name}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                        <Input
                          id={`${monthKey}-${category.id}`}
                          type="number"
                          step="0.01"
                          value={monthData[category.id] || ''}
                          onChange={(e) =>
                            handleAmountChange(monthKey, category.id, parseFloat(e.target.value) || 0)
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
                    <span className="font-medium">Total do mês:</span>
                    <span className="text-lg font-bold text-primary">
                      €{Object.values(monthData).reduce((sum, val) => sum + (val || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedMonths === 0 && (
        <Card className="p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Podes saltar este passo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Se preferires, podes preencher os dados históricos mais tarde ou começar do zero.
                Isto não afeta o funcionamento da aplicação.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
