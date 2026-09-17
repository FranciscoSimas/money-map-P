import { motion } from 'framer-motion';
import { CategoryExpense } from '@/hooks/useDashboardHistory';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ExpensesByCategoryTableProps {
  expensesByCategory: CategoryExpense[];
  isLoading?: boolean;
  totalExpenses: number;
}

export function ExpensesByCategoryTable({ 
  expensesByCategory, 
  isLoading,
  totalExpenses 
}: ExpensesByCategoryTableProps) {
  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-[280px] w-full" />
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="mb-6">
        <h3 className="font-display font-semibold text-lg">Despesas por Categoria</h3>
        <p className="text-sm text-muted-foreground">Detalhamento completo</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Percentagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expensesByCategory.map((category) => {
              const percentage = totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0;
              return (
                <TableRow key={category.categoryId}>
                  <TableCell className="font-medium">{category.categoryName}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(category.amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

