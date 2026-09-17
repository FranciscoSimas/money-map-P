import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Plus, ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMonthlyRecords } from '@/hooks/useMonthlyRecords';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReceiptViewer } from '@/components/transactions/ReceiptViewer';

export default function Transacoes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [receiptViewerTransaction, setReceiptViewerTransaction] = useState<{
    id: string;
    amount: number;
    date: string;
    description: string | null;
  } | null>(null);
  
  const { data: records, isLoading: isLoadingRecords } = useMonthlyRecords(selectedYear, selectedMonth);
  const { data: transactions, isLoading: isLoadingTransactions } = useTransactions(selectedYear, selectedMonth);
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  
  // Combine monthly records and transactions
  const allTransactions = useMemo(() => {
    const result: Array<{
      id: string;
      description: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      categoryId: string;
      categoryColor: string | null;
      date: string;
      notes?: string | null;
    }> = [];
    
    if (!categories) return [];
    
    // Always show transactions from the transactions table (for both current and past months)
    if (transactions && transactions.length > 0) {
      transactions.forEach(transaction => {
        const category = transaction.categories || categories.find(c => c.id === transaction.category_id);
        result.push({
          id: transaction.id,
          description: transaction.description || category?.name || 'Sem categoria',
          amount: transaction.type === 'income' ? transaction.amount : -transaction.amount,
          type: transaction.type,
          category: category?.name || 'Outros',
          categoryId: transaction.category_id,
          categoryColor: category?.color || null,
          date: transaction.date,
          notes: transaction.description,
        });
      });
    }
    
    // Also add monthly records that don't have corresponding transactions (for historical data)
    if (records) {
      records.forEach(record => {
        // Only add if there's no transaction with the same category_id for this month
        const hasTransaction = transactions?.some(t => t.category_id === record.category_id) || false;
        if (!hasTransaction) {
          const category = categories.find(c => c.id === record.category_id);
          result.push({
            id: `record-${record.id}`,
            description: category?.name || record.notes || 'Sem categoria',
            amount: category?.type === 'income' ? record.amount : -record.amount,
            type: (category?.type || 'expense') as 'income' | 'expense',
            category: category?.name || 'Outros',
            categoryId: record.category_id,
            categoryColor: category?.color || null,
            date: `${record.year}-${String(record.month).padStart(2, '0')}-01`,
            notes: record.notes,
          });
        }
      });
    }
    
    // Remove duplicates by ID (shouldn't happen but just in case)
    const uniqueTransactions = result.filter((t, index, self) => 
      index === self.findIndex(tr => tr.id === t.id)
    );
    
    // Sort by date (newest first)
    return uniqueTransactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [records, transactions, categories, selectedYear, selectedMonth]);
  
  const availableCategories = useMemo(() => {
    if (!categories) return [];
    return Array.from(new Set(allTransactions.map(t => t.category))).sort();
  }, [allTransactions, categories]);
  
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((t) => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || t.categoryId === selectedCategory;
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [allTransactions, searchTerm, selectedCategory, filterType]);

  const totalIncome = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [filteredTransactions]
  );
  const totalExpenses = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [filteredTransactions]
  );
  
  // Generate year options (last 2 years + current)
  const yearOptions = Array.from({ length: 3 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return year;
  });
  
  const monthOptions = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];
  
  if (isLoadingRecords || isLoadingTransactions || isLoadingCategories) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Transações</h1>
            <p className="text-muted-foreground mt-1">Gerir todas as tuas transações</p>
          </div>
          <Button className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow w-fit">
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <p className="text-sm text-muted-foreground">Total Receitas</p>
            <p className="text-2xl font-display font-bold text-success">
              +€{totalIncome.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <p className="text-sm text-muted-foreground">Total Despesas</p>
            <p className="text-2xl font-display font-bold text-destructive">
              -€{totalExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border p-4 shadow-card"
          >
            <p className="text-sm text-muted-foreground">Balanço</p>
            <p className={cn(
              "text-2xl font-display font-bold",
              totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"
            )}>
              €{(totalIncome - totalExpenses).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </p>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border p-4 shadow-card space-y-4"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar transações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                Todos
              </Button>
              <Button
                variant={filterType === 'income' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('income')}
                className={filterType === 'income' ? 'bg-success hover:bg-success/90' : ''}
              >
                <ArrowUpRight className="w-4 h-4 mr-1" />
                Receitas
              </Button>
              <Button
                variant={filterType === 'expense' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('expense')}
              >
                <ArrowDownRight className="w-4 h-4 mr-1" />
                Despesas
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-muted text-foreground'
              )}
            >
              Todos
            </button>
            {availableCategories.map((catName) => {
              const category = categories?.find(c => c.name === catName);
              return (
                <button
                  key={category?.id || catName}
                  onClick={() => setSelectedCategory(category?.id || 'all')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                    selectedCategory === category?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-muted text-foreground'
                  )}
                >
                  {catName}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Nenhuma transação encontrada para este período
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t, index) => (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center',
                              t.type === 'income' ? 'bg-success/10' : ''
                            )}
                            style={t.type === 'expense' && t.categoryColor ? {
                              backgroundColor: `${t.categoryColor}20`,
                            } : {}}
                          >
                            {t.type === 'income' ? (
                              <ArrowUpRight 
                                className="w-4 h-4" 
                                style={{ color: t.categoryColor || 'hsl(145, 60%, 42%)' }}
                              />
                            ) : (
                              <ArrowDownRight 
                                className="w-4 h-4" 
                                style={{ color: t.categoryColor || 'hsl(var(--muted-foreground))' }}
                              />
                            )}
                          </div>
                          <span className="font-medium text-sm">{t.description}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span 
                          className="px-2.5 py-1 text-xs font-medium rounded-full"
                          style={t.categoryColor ? {
                            backgroundColor: `${t.categoryColor}20`,
                            color: t.categoryColor,
                          } : {
                            backgroundColor: 'hsl(var(--secondary))',
                          }}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(t.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className={cn(
                        'p-4 text-right font-display font-semibold',
                        t.type === 'income' ? 'text-success' : 'text-foreground'
                      )}>
                        <div className="flex items-center justify-end gap-2">
                          <span>
                            {t.type === 'income' ? '+' : '-'}€{Math.abs(t.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                          </span>
                          {t.type === 'expense' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setReceiptViewerTransaction({
                                id: t.id,
                                amount: t.amount,
                                date: t.date,
                                description: t.description,
                              })}
                              title="Ver recibo"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Receipt Viewer */}
      {receiptViewerTransaction && (
        <ReceiptViewer
          transactionId={receiptViewerTransaction.id}
          transactionAmount={receiptViewerTransaction.amount}
          transactionDate={receiptViewerTransaction.date}
          transactionDescription={receiptViewerTransaction.description}
          open={!!receiptViewerTransaction}
          onOpenChange={(open) => !open && setReceiptViewerTransaction(null)}
        />
      )}
    </Layout>
  );
}
