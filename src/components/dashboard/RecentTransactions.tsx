import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMonthlyRecords } from '@/hooks/useMonthlyRecords';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Calendar, Utensils, Gift, Plus, Car, Fuel, Wifi, CreditCard, Home, Gamepad2, ShoppingCart, Heart, Shirt, Dice5, PiggyBank, TrendingUp, Bitcoin } from 'lucide-react';

const iconMap: Record<string, any> = {
  Wallet, Calendar, Utensils, Gift, Plus,
  Car, Fuel, Wifi, CreditCard, Home,
  Gamepad2, ShoppingCart, Heart, Shirt,
  Dice5, PiggyBank, TrendingUp, Bitcoin
};

export function RecentTransactions() {
  const navigate = useNavigate();
  const now = new Date();
  const { data: records, isLoading } = useMonthlyRecords(now.getFullYear(), now.getMonth() + 1);
  
  const transactions = useMemo(() => {
    if (!records) return [];
    
    return records
      .map(record => {
        const Icon = record.categories?.icon ? iconMap[record.categories.icon] || ArrowUpRight : ArrowUpRight;
        return {
          id: record.id,
          description: record.categories?.name || 'Sem categoria',
          amount: record.categories?.type === 'income' ? record.amount : -record.amount,
          type: record.categories?.type || 'expense',
          category: record.categories?.name || 'Outros',
          date: new Date(record.year, record.month - 1, 1).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
          icon: Icon,
        };
      })
      .sort((a, b) => {
        // Sort by date (most recent first) - approximate by month
        const dateA = new Date(now.getFullYear(), now.getMonth(), 1);
        const dateB = new Date(now.getFullYear(), now.getMonth(), 1);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5); // Top 5
  }, [records, now]);
  
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <h3 className="font-display font-semibold text-lg mb-4">Transações Recentes</h3>
        <p className="text-sm text-muted-foreground">Ainda não há transações este mês</p>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg">Transações Recentes</h3>
        <button 
          onClick={() => navigate('/transacoes')}
          className="text-sm text-primary font-medium hover:underline"
        >
          Ver todas
        </button>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <div
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                transaction.type === 'income'
                  ? 'bg-success/10 text-success'
                  : 'bg-secondary text-muted-foreground group-hover:bg-muted'
              )}
            >
              <transaction.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{transaction.description}</p>
              <p className="text-xs text-muted-foreground">{transaction.category} • {transaction.date}</p>
            </div>
            <p
              className={cn(
                'font-display font-semibold text-sm',
                transaction.type === 'income' ? 'text-success' : 'text-foreground'
              )}
            >
              {transaction.type === 'income' ? '+' : ''}
              €{Math.abs(transaction.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
