import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardHistory, MonthRange } from '@/hooks/useDashboardHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

interface BalanceChartProps {
  range: MonthRange;
}

export function BalanceChart({ range }: BalanceChartProps) {
  const { data: historyData, isLoading } = useDashboardHistory(range);

  const chartData = useMemo(() => {
    if (!historyData?.months || historyData.months.length === 0) return [];

    // O saldo já vem ancorado no saldo real atual (calculado de trás para a frente no hook)
    return historyData.months.map((m) => ({
      month: new Date(m.year, m.month - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
      saldo: m.bankBalance,
    }));
  }, [historyData]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  if (!historyData || chartData.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <h3 className="font-display font-semibold text-lg mb-2">Evolução do Saldo</h3>
        <p className="text-sm text-muted-foreground">Ainda não há dados históricos disponíveis</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="mb-6">
        <h3 className="font-display font-semibold text-lg">Evolução do Saldo</h3>
        <p className="text-sm text-muted-foreground">Saldo no banco ao longo dos meses</p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 60%, 40%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160, 60%, 40%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(150, 15%, 88%)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
              formatter={(value: number) => [`€${value.toLocaleString('pt-PT')}`, 'Saldo']}
              labelStyle={{ color: 'hsl(160, 30%, 15%)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="hsl(160, 60%, 40%)"
              strokeWidth={2}
              fill="url(#colorSaldo)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
