import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from 'recharts';
import { CategoryExpense, MonthRange } from '@/hooks/useDashboardHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowDownRight, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategories } from '@/hooks/useCategories';

interface ExpensesByCategoryChartProps {
  expensesByCategory: CategoryExpense[];
  isLoading?: boolean;
  range: MonthRange;
}

const COLORS = [
  'hsl(0, 70%, 55%)',
  'hsl(38, 92%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(217, 91%, 60%)',
  'hsl(280, 70%, 50%)',
  'hsl(145, 60%, 42%)',
  'hsl(25, 95%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
];

export function ExpensesByCategoryChart({ expensesByCategory, isLoading, range }: ExpensesByCategoryChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: categories } = useCategories();

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (categories || []).forEach((cat) => {
      if (cat.id && cat.color) {
        map.set(cat.id, cat.color);
      }
    });
    return map;
  }, [categories]);

  // Fetch ALL individual transactions for the selected category within the whole range.
  // For months without transactions, fall back to monthly_records (aggregate values).
  const { data: categoryTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: [
      'category_transactions',
      user?.id,
      selectedCategoryId,
      range.startYear,
      range.startMonth,
      range.endYear,
      range.endMonth,
    ],
    queryFn: async () => {
      if (!user?.id || !selectedCategoryId) return [];

      const startDate = `${range.startYear}-${String(range.startMonth).padStart(2, '0')}-01`;
      const endLastDay = new Date(range.endYear, range.endMonth, 0).getDate();
      const endDate = `${range.endYear}-${String(range.endMonth).padStart(2, '0')}-${String(endLastDay).padStart(2, '0')}`;

      // 1. Transações individuais de todo o período
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, amount, date, description, created_at')
        .eq('user_id', user.id)
        .eq('category_id', selectedCategoryId)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      const transactions = (transactionsData || []).map(t => ({
        id: t.id,
        amount: t.amount,
        date: t.date,
        description: t.description,
        created_at: t.created_at,
      }));

      // Meses que já têm transações individuais
      const monthsWithTransactions = new Set(
        transactions.map(t => t.date.slice(0, 7)) // 'YYYY-MM'
      );

      // 2. Fallback: monthly_records para meses do período SEM transações individuais
      const { data: recordsData, error: recordsError } = await supabase
        .from('monthly_records')
        .select('id, amount, year, month, notes, created_at')
        .eq('user_id', user.id)
        .eq('category_id', selectedCategoryId)
        .order('created_at', { ascending: false });

      if (recordsError) throw recordsError;

      const startIdx = range.startYear * 12 + (range.startMonth - 1);
      const endIdx = range.endYear * 12 + (range.endMonth - 1);

      (recordsData || []).forEach(record => {
        const recordIdx = record.year * 12 + (record.month - 1);
        if (recordIdx < startIdx || recordIdx > endIdx) return;

        const monthKey = `${record.year}-${String(record.month).padStart(2, '0')}`;
        if (monthsWithTransactions.has(monthKey)) return;

        transactions.push({
          id: record.id,
          amount: record.amount,
          date: `${monthKey}-01`,
          description: record.notes,
          created_at: record.created_at,
        });
      });

      return transactions.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    },
    enabled: !!user?.id && !!selectedCategoryId,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-[350px] w-full" />
      </div>
    );
  }

  if (!expensesByCategory || expensesByCategory.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <h3 className="font-display font-semibold text-lg mb-2">Despesas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Ainda não há dados de despesas</p>
      </div>
    );
  }

  // Take top 10 categories
  const topCategories = expensesByCategory.slice(0, 10);
  const chartData = topCategories.map((cat, index) => {
    const categoryColor = categoryColorMap.get(cat.categoryId) || COLORS[index % COLORS.length];
    return {
      name: cat.categoryName,
      value: cat.amount,
      categoryId: cat.categoryId,
      index,
      color: categoryColor,
    };
  });

  const selectedCategory = selectedCategoryId 
    ? topCategories.find(c => c.categoryId === selectedCategoryId)
    : null;

  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Custom label function to show category name and percentage
  const renderLabel = (entry: any) => {
    const total = topCategories.reduce((sum, c) => sum + c.amount, 0);
    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0';
    return `${entry.name}: ${percent}%`;
  };

  // Custom active shape for hover effect - makes the slice slightly larger
  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;
    
    // Slightly increase the outer radius for hover effect (8% larger)
    const hoverOuterRadius = outerRadius * 1.08;

    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={hoverOuterRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'brightness(1.15) drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
          transition: 'all 0.3s ease-out',
          cursor: 'pointer',
        }}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="mb-6">
        <h3 className="font-display font-semibold text-lg">Despesas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Distribuição das despesas</p>
      </div>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={120}
              innerRadius={45}
              fill="#8884d8"
              dataKey="value"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, index) => {
                const clickedCategory = chartData[index];
                if (clickedCategory && clickedCategory.categoryId === selectedCategoryId) {
                  // If clicking the same category, deselect it
                  setSelectedCategoryId(null);
                } else {
                  setSelectedCategoryId(clickedCategory.categoryId);
                }
              }}
              animationBegin={0}
              animationDuration={400}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{
                    transition: 'all 0.3s ease-out',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(150, 15%, 88%)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name,
              ]}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Transactions List */}
      <AnimatePresence>
        {selectedCategoryId && selectedCategory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-4 pt-4 border-t"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-display font-semibold text-base">
                  Transações: {selectedCategory.categoryName}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {categoryTransactions?.length || 0} transações encontradas
                </p>
              </div>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Fechar lista"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {isLoadingTransactions ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : categoryTransactions && categoryTransactions.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {categoryTransactions.map((transaction) => {
                    const date = new Date(transaction.date);
                    const dateStr = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
                    
                    return (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-destructive/10">
                            <ArrowDownRight className="w-4 h-4 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {transaction.description || selectedCategory.categoryName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dateStr}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-semibold text-base text-destructive">
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhuma transação encontrada para esta categoria</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

