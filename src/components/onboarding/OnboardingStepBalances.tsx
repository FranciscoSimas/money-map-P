import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Wallet, PiggyBank, TrendingUp, Coins, Info } from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function OnboardingStepBalances({ data, updateData }: Props) {
  const totalBalance = (data.bankBalance || 0) + 
                       (data.savingsBalance || 0) + 
                       (data.investmentsBalance || 0) + 
                       (data.otherBalance || 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-muted-foreground text-sm">
          Indica os teus montantes atuais para começarmos com dados reais
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Podes deixar em 0 se preferires preencher depois
        </p>
      </div>

      {/* Bank Balance */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <Label htmlFor="bankBalance" className="text-base font-medium">
              Saldo no Banco
            </Label>
            <p className="text-xs text-muted-foreground">
              Conta à ordem, depósitos, etc.
            </p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="bankBalance"
            type="number"
            step="0.01"
            value={data.bankBalance || ''}
            onChange={(e) => updateData({ bankBalance: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="pl-8 text-lg"
          />
        </div>
      </Card>

      {/* Savings Balance */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-success/10">
            <PiggyBank className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <Label htmlFor="savingsBalance" className="text-base font-medium">
              Poupanças
            </Label>
            <p className="text-xs text-muted-foreground">
              Contas poupança, certificados de aforro, etc.
            </p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="savingsBalance"
            type="number"
            step="0.01"
            value={data.savingsBalance || ''}
            onChange={(e) => updateData({ savingsBalance: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="pl-8 text-lg"
          />
        </div>
      </Card>

      {/* Investments Balance */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <Label htmlFor="investmentsBalance" className="text-base font-medium">
              Investimentos
            </Label>
            <p className="text-xs text-muted-foreground">
              Ações, ETFs, PPR, etc.
            </p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="investmentsBalance"
            type="number"
            step="0.01"
            value={data.investmentsBalance || ''}
            onChange={(e) => updateData({ investmentsBalance: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="pl-8 text-lg"
          />
        </div>
      </Card>

      {/* Other Balance */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-muted">
            <Coins className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label htmlFor="otherBalance" className="text-base font-medium">
              Outros
            </Label>
            <p className="text-xs text-muted-foreground">
              Outros ativos ou valores que queiras incluir
            </p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="otherBalance"
            type="number"
            step="0.01"
            value={data.otherBalance || ''}
            onChange={(e) => updateData({ otherBalance: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="pl-8 text-lg"
          />
        </div>
      </Card>

      {/* Total Summary */}
      {totalBalance > 0 && (
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <span className="font-medium">Património Total:</span>
            </div>
            <span className="text-2xl font-bold text-primary">
              €{totalBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
