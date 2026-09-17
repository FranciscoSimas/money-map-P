import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Plus, ChevronDown, ChevronUp, ArrowDownRight, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { useExpenseCategories, useIncomeCategories } from '@/hooks/useCategories';
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactions';
import { useSavingsWithdrawals, sumSavingsWithdrawals } from '@/hooks/useSavingsWithdrawals';
import { isSavingsCategory, netMonthlySavingsAmount } from '@/lib/categoryHelpers';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ReceiptViewer } from '@/components/transactions/ReceiptViewer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TransactionsByCategoryProps {
  year: number;
  month: number;
}

export function TransactionsByCategory({ year, month }: TransactionsByCategoryProps) {
  const { data: transactions, isLoading } = useTransactions(year, month);
  const { data: savingsWithdrawals, isLoading: isLoadingWithdrawals } = useSavingsWithdrawals(year, month);
  const { data: expenseCategories } = useExpenseCategories();
  const { data: incomeCategories } = useIncomeCategories();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<'expense' | 'income'>('expense');
  const [receiptViewerTransaction, setReceiptViewerTransaction] = useState<Transaction | null>(null);

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  // Group transactions by category
  const transactionsByCategory = useMemo(() => {
    if (!transactions) return {};

    const grouped: Record<string, Transaction[]> = {};
    transactions.forEach((transaction) => {
      const categoryId = transaction.category_id;
      if (!grouped[categoryId]) {
        grouped[categoryId] = [];
      }
      grouped[categoryId].push(transaction);
    });

    // Sort transactions within each category by date (newest first)
    Object.keys(grouped).forEach((categoryId) => {
      grouped[categoryId].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    });

    return grouped;
  }, [transactions]);

  // Get all categories with transactions
  const categoriesWithTransactions = useMemo(() => {
    const allCategories = [...(expenseCategories || []), ...(incomeCategories || [])];
    return allCategories
      .filter((cat) => transactionsByCategory[cat.id]?.length > 0)
      .sort((a, b) => {
        const totalA = transactionsByCategory[a.id]?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const totalB = transactionsByCategory[b.id]?.reduce((sum, t) => sum + t.amount, 0) || 0;
        return totalB - totalA;
      });
  }, [transactionsByCategory, expenseCategories, incomeCategories]);

  const savingsWithdrawalTotal = useMemo(
    () => sumSavingsWithdrawals(savingsWithdrawals || []),
    [savingsWithdrawals]
  );

  const totalSavingsDeposits = useMemo(() => {
    return categoriesWithTransactions
      .filter((cat) => isSavingsCategory(cat.name))
      .reduce((sum, cat) => {
        const categoryTransactions = transactionsByCategory[cat.id] || [];
        return sum + categoryTransactions.reduce((catSum, t) => catSum + t.amount, 0);
      }, 0);
  }, [categoriesWithTransactions, transactionsByCategory]);

  const netSavingsDeposits = useMemo(
    () => netMonthlySavingsAmount(totalSavingsDeposits, savingsWithdrawalTotal),
    [totalSavingsDeposits, savingsWithdrawalTotal]
  );

  const getCategoryDisplayTotal = (categoryId: string, categoryName: string) => {
    const categoryTransactions = transactionsByCategory[categoryId] || [];
    const gross = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

    if (!isSavingsCategory(categoryName) || gross <= 0 || totalSavingsDeposits <= 0) {
      return gross;
    }

    return gross * (netSavingsDeposits / totalSavingsDeposits);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Fix timezone issue by parsing the date string directly
    const [year, month, day] = dateString.split('T')[0].split('-');
    const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return parsedDate.toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'numeric',
    });
  };

  if (isLoading || isLoadingWithdrawals) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">Transações por Categoria</h3>
        </div>

        {categoriesWithTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ainda não há transações este mês
          </p>
        ) : (
          <div className="space-y-2">
            {categoriesWithTransactions.map((category, categoryIndex) => {
              const categoryTransactions = transactionsByCategory[category.id] || [];
              const total = getCategoryDisplayTotal(category.id, category.name);
              const isExpanded = expandedCategories.has(category.id);
              const isSavings = isSavingsCategory(category.name);
              const isFirstSavingsCategory =
                isSavings &&
                categoriesWithTransactions.findIndex((cat) => isSavingsCategory(cat.name)) === categoryIndex;
              const itemCount =
                categoryTransactions.length +
                (isFirstSavingsCategory ? (savingsWithdrawals?.length || 0) : 0);
              const showWithdrawals = isFirstSavingsCategory && (savingsWithdrawals?.length || 0) > 0;

              return (
                <div
                  key={category.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: category.color ? `${category.color}20` : 'hsl(var(--secondary))',
                          color: category.color || 'hsl(var(--foreground))',
                        }}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {itemCount} transação{itemCount !== 1 ? 'ões' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-semibold text-lg">
                          {formatCurrency(total)}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground ml-2" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground ml-2" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t bg-secondary/30"
                      >
                        <div className="p-4 space-y-2">
                          {categoryTransactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-secondary/50 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {transaction.description || category.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(transaction.date)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-display font-semibold">
                                  {formatCurrency(transaction.amount)}
                                </p>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Ícone de recibo - sempre visível se houver recibo, ou mostrar para todas as despesas */}
                                  {transaction.type === 'expense' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => setReceiptViewerTransaction(transaction)}
                                      title="Ver recibo"
                                    >
                                      <Receipt className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setEditingTransaction(transaction)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingTransaction(transaction)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {showWithdrawals && savingsWithdrawals?.map((withdrawal) => (
                            <div
                              key={withdrawal.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">Retirada para o banco</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(withdrawal.date)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-display font-semibold text-success">
                                  −{formatCurrency(withdrawal.amount)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <AddTransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        type={newTransactionType}
        onTypeChange={setNewTransactionType}
        year={year}
        month={month}
      />

      {/* Edit Transaction Dialog */}
      {editingTransaction && (
        <EditTransactionDialog
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres eliminar esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingTransaction) {
                  try {
                    await deleteTransaction.mutateAsync(deletingTransaction.id);
                    toast({
                      title: 'Transação eliminada',
                      description: 'A transação foi eliminada com sucesso.',
                    });
                    setDeletingTransaction(null);
                  } catch (error) {
                    console.error('Error deleting transaction:', error);
                    toast({
                      title: 'Erro',
                      description: 'Ocorreu um erro ao eliminar a transação.',
                      variant: 'destructive',
                    });
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
}

// Add Transaction Dialog Component
function AddTransactionDialog({
  open,
  onOpenChange,
  type,
  onTypeChange,
  year,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'expense' | 'income';
  onTypeChange: (type: 'expense' | 'income') => void;
  year: number;
  month: number;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: expenseCategories } = useExpenseCategories();
  const { data: incomeCategories } = useIncomeCategories();
  const createTransaction = useCreateTransaction();

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId || !amount || parseFloat(amount) < 0) {
      toast({
        title: 'Erro',
        description: 'Preenche a categoria e o montante (pode ser 0.00).',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createTransaction.mutateAsync({
        category_id: categoryId,
        amount: parseFloat(amount),
        description: description || null,
        type,
        date,
      });

      toast({
        title: 'Transação adicionada!',
        description: 'A transação foi guardada com sucesso.',
      });

      // Reset form
      setCategoryId('');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar a transação.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v as 'expense' | 'income')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleciona categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories && (() => {
                  if (type === 'income') {
                    return (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          Receitas
                        </div>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color || '#22c55e' }}
                              />
                              <span>{cat.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    );
                  }

                  const groups: Record<string, typeof categories> = {};
                  categories.forEach((cat) => {
                    const group = cat.category_group || 'general_expenses';
                    if (!groups[group]) groups[group] = [];
                    groups[group].push(cat);
                  });
                  const groupOrder: string[] = ['fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
                  const groupLabels: Record<string, string> = {
                    fixed_expenses: 'Despesas Fixas',
                    general_expenses: 'Despesas Gerais',
                    optional_expenses: 'Despesas Opcionais',
                    savings_investments: 'Poupança/Investimentos',
                  };
                  return groupOrder.map((group) => {
                    const cats = groups[group];
                    if (!cats || cats.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {groupLabels[group]}
                        </div>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color || '#ef4444' }}
                              />
                              <span>{cat.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  });
                })()}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              placeholder="Ex: Nome do Restaurante"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="amount">Montante (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={createTransaction.isPending}
            >
              {createTransaction.isPending ? 'A guardar...' : 'Adicionar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Transaction Dialog Component
function EditTransactionDialog({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [description, setDescription] = useState(transaction.description || '');
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [date, setDate] = useState(transaction.date);
  const { data: expenseCategories } = useExpenseCategories();
  const { data: incomeCategories } = useIncomeCategories();
  const updateTransaction = useUpdateTransaction();

  const categories = transaction.type === 'expense' ? expenseCategories : incomeCategories;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId || !amount || parseFloat(amount) < 0) {
      toast({
        title: 'Erro',
        description: 'Preenche a categoria e o montante (pode ser 0.00).',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        category_id: categoryId,
        amount: parseFloat(amount),
        description: description || null,
        date,
      });

      toast({
        title: 'Transação atualizada!',
        description: 'A transação foi atualizada com sucesso.',
      });

      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a transação.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories && (() => {
                  const isIncome = transaction.type === 'income';
                  if (isIncome) {
                    return (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          Receitas
                        </div>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color || '#22c55e' }}
                              />
                              <span>{cat.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    );
                  }

                  const groups: Record<string, typeof categories> = {};
                  categories.forEach((cat) => {
                    const group = cat.category_group || 'general_expenses';
                    if (!groups[group]) groups[group] = [];
                    groups[group].push(cat);
                  });
                  const groupOrder: string[] = ['fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
                  const groupLabels: Record<string, string> = {
                    fixed_expenses: 'Despesas Fixas',
                    general_expenses: 'Despesas Gerais',
                    optional_expenses: 'Despesas Opcionais',
                    savings_investments: 'Poupança/Investimentos',
                  };
                  return groupOrder.map((group) => {
                    const cats = groups[group];
                    if (!cats || cats.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {groupLabels[group]}
                        </div>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color || '#ef4444' }}
                              />
                              <span>{cat.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  });
                })()}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              placeholder="Ex: Nome do Restaurante"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="amount">Montante (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={updateTransaction.isPending}
            >
              {updateTransaction.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

