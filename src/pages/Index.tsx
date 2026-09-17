import { Layout } from '@/components/layout/Layout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ExpandedExpensesCard } from '@/components/dashboard/ExpandedExpensesCard';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { ExpensesByCategoryTable } from '@/components/dashboard/ExpensesByCategoryTable';
import { CarLoanProgress } from '@/components/dashboard/CarLoanProgress';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Wallet, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardHistory, MonthRange } from '@/hooks/useDashboardHistory';
import { useCurrentBalances } from '@/hooks/useCurrentBalances';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// 'YYYY-MM' <-> { year, month }
const toMonthValue = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`;

const parseMonthValue = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
};

const getDefaultRange = (): MonthRange => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return {
    startYear: start.getFullYear(),
    startMonth: start.getMonth() + 1,
    endYear: now.getFullYear(),
    endMonth: now.getMonth() + 1,
  };
};

const Index = () => {
  const { data: profile } = useProfile();
  const { data: currentBalances } = useCurrentBalances();
  const [range, setRange] = useState<MonthRange>(getDefaultRange);
  const { data: historyData, isLoading } = useDashboardHistory(range);
  const displayName = profile?.name || 'Utilizador';

  const now = new Date();
  const currentMonthValue = toMonthValue(now.getFullYear(), now.getMonth() + 1);

  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleStartChange = (value: string) => {
    const parsed = parseMonthValue(value);
    if (!parsed) return;
    setRange(prev => {
      const startIdx = parsed.year * 12 + parsed.month;
      const endIdx = prev.endYear * 12 + prev.endMonth;
      // Se o início ultrapassar o fim, ajustar o fim para o mesmo mês
      if (startIdx > endIdx) {
        return { startYear: parsed.year, startMonth: parsed.month, endYear: parsed.year, endMonth: parsed.month };
      }
      return { ...prev, startYear: parsed.year, startMonth: parsed.month };
    });
  };

  const handleEndChange = (value: string) => {
    const parsed = parseMonthValue(value);
    if (!parsed) return;
    setRange(prev => {
      const startIdx = prev.startYear * 12 + prev.startMonth;
      const endIdx = parsed.year * 12 + parsed.month;
      // Se o fim recuar antes do início, ajustar o início para o mesmo mês
      if (endIdx < startIdx) {
        return { startYear: parsed.year, startMonth: parsed.month, endYear: parsed.year, endMonth: parsed.month };
      }
      return { ...prev, endYear: parsed.year, endMonth: parsed.month };
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Saldo real no banco: valor mantido em current_balances (atualizado pelas transações)
  const bankBalance = currentBalances?.bank_balance ?? 0;

  // Saldo total = banco + poupança + investimentos + outros
  const totalBalance =
    bankBalance +
    (currentBalances?.savings_balance ?? 0) +
    (currentBalances?.investments_balance ?? 0) +
    (currentBalances?.other_balance ?? 0);
  const totalIncome = historyData?.totalIncome || 0;
  const totalExpenses = historyData?.totalExpenses || 0;
  const totalExpensesWithoutSavings = historyData?.totalExpensesWithoutSavings || 0;
  const totalSavingsAmount = historyData?.totalSavingsAmount || 0;
  const totalInvestmentsAmount = historyData?.totalInvestmentsAmount || 0;

  // Dados para o gráfico de evolução mensal.
  // O saldo total por mês já vem calculado no hook, ancorado nos saldos reais atuais.
  const chartData = (historyData?.months || []).map((m) => ({
    month: new Date(m.year, m.month - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
    receitas: m.income,
    despesas: m.expenses,
    balancoMensal: m.savings,
    saldoTotal: m.totalBalance,
  }));

  const rangeLabel = `${toMonthValue(range.startYear, range.startMonth)} a ${toMonthValue(range.endYear, range.endMonth)}`;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">
              Olá, <span className="text-gradient">{displayName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Resumo de {rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De</span>
              <Input
                type="month"
                className="w-40"
                value={toMonthValue(range.startYear, range.startMonth)}
                max={currentMonthValue}
                onChange={(e) => handleStartChange(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="month"
                className="w-40"
                value={toMonthValue(range.endYear, range.endMonth)}
                max={currentMonthValue}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
            <QuickActions />
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Saldo Total"
            value={formatCurrency(totalBalance)}
            icon={<Wallet className="w-5 h-5" />}
            variant="primary"
            delay={0}
          />
          <MetricCard
            title="Saldo Real no Banco"
            value={formatCurrency(bankBalance)}
            icon={<Banknote className="w-5 h-5" />}
            variant="default"
            delay={0.1}
          />
          <MetricCard
            title="Receitas Gerais"
            value={formatCurrency(totalIncome)}
            icon={<TrendingUp className="w-5 h-5" />}
            variant="success"
            delay={0.2}
          />
          <ExpandedExpensesCard
            title="Despesas Gerais"
            totalValue={formatCurrency(totalExpenses)}
            icon={<TrendingDown className="w-5 h-5" />}
            variant="default"
            delay={0.3}
            expensesTotal={formatCurrency(totalExpensesWithoutSavings)}
            savingsTotal={formatCurrency(totalSavingsAmount)}
            investmentsTotal={formatCurrency(totalInvestmentsAmount)}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceChart range={range} />

          <div className="bg-card rounded-xl border p-5 shadow-card">
            <h3 className="font-display font-semibold text-lg mb-4">Evolução Mensal</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" />
                  <XAxis
                    dataKey="month"
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
                  <Line type="monotone" dataKey="receitas" stroke="hsl(145, 60%, 42%)" strokeWidth={2} name="Receitas" />
                  <Line type="monotone" dataKey="despesas" stroke="hsl(0, 70%, 55%)" strokeWidth={2} name="Despesas" />
                  <Line type="monotone" dataKey="balancoMensal" stroke="hsl(220, 70%, 50%)" strokeWidth={2} name="Balanço Mensal" />
                  <Line type="monotone" dataKey="saldoTotal" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Saldo Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Expenses by Category Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpensesByCategoryChart 
            expensesByCategory={historyData?.expensesByCategory || []}
            isLoading={isLoading}
            range={range}
          />
          <ExpensesByCategoryTable
            expensesByCategory={historyData?.expensesByCategory || []}
            isLoading={isLoading}
            totalExpenses={totalExpenses}
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-5 shadow-card">
            <p className="text-sm text-muted-foreground mb-2">Receita Média</p>
            <p className="text-2xl font-display font-bold text-success">
              {formatCurrency(historyData?.averageIncome || 0)}
            </p>
          </div>
          <div className="bg-card rounded-xl border p-5 shadow-card">
            <p className="text-sm text-muted-foreground mb-2">Despesa Média</p>
            <p className="text-2xl font-display font-bold text-destructive">
              {formatCurrency(historyData?.averageExpensesWithoutSavings || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">(sem Investimentos e Poupança)</p>
          </div>
          <div className="bg-card rounded-xl border p-5 shadow-card">
            <p className="text-sm text-muted-foreground mb-2">Poupança Média</p>
            <p className="text-2xl font-display font-bold text-primary">
              {formatCurrency(historyData?.averageSavingsAmount || 0)}
            </p>
          </div>
          <div className="bg-card rounded-xl border p-5 shadow-card">
            <p className="text-sm text-muted-foreground mb-2">Investimento Médio</p>
            <p className="text-2xl font-display font-bold text-primary">
              {formatCurrency(historyData?.averageInvestmentsAmount || 0)}
            </p>
          </div>
        </div>

        {/* Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CarLoanProgress />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
