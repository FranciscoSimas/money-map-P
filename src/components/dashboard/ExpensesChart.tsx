import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export interface ExpensesChartItem {
  categoria: string;
  valor: number;
  color: string;
}

interface ExpensesChartProps {
  data: ExpensesChartItem[];
  isLoading?: boolean;
}

export function ExpensesChart({ data, isLoading }: ExpensesChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <h3 className="font-display font-semibold text-lg mb-2">Despesas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Ainda não há despesas registadas este mês</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="mb-6">
        <h3 className="font-display font-semibold text-lg">Despesas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Este mês</p>
      </div>
      <div className="h-[280px] [&_.recharts-wrapper]:pointer-events-none [&_.recharts-bar]:pointer-events-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 15%, 88%)" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
              tickFormatter={(value) => `€${Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 0 })}`}
            />
            <YAxis
              type="category"
              dataKey="categoria"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(160, 15%, 45%)', fontSize: 12 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(150, 15%, 88%)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
              formatter={(value: number) => [`€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, 'Gasto']}
              labelStyle={{ color: 'hsl(160, 30%, 15%)', fontWeight: 600 }}
            />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease', pointerEvents: 'auto' }}
                  onMouseEnter={(e: any) => {
                    if (e?.target) {
                      e.target.style.opacity = '0.7';
                      e.target.style.filter = 'brightness(1.15)';
                    }
                  }}
                  onMouseLeave={(e: any) => {
                    if (e?.target) {
                      e.target.style.opacity = '1';
                      e.target.style.filter = 'brightness(1)';
                    }
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
