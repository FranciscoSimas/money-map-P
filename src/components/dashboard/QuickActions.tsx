import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calculator, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExpenseCategories, useIncomeCategories } from '@/hooks/useCategories';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { toast } from '@/hooks/use-toast';

export function QuickActions() {
  const navigate = useNavigate();
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { data: expenseCategories } = useExpenseCategories();
  const { data: incomeCategories } = useIncomeCategories();
  const createTransaction = useCreateTransaction();
  
  const categories = transactionType === 'income' ? incomeCategories : expenseCategories;
  
  const handleAddTransaction = async () => {
    if (!categoryId || !amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Erro',
        description: 'Preenche a categoria e o montante.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await createTransaction.mutateAsync({
        category_id: categoryId,
        amount: parseFloat(amount),
        description: description || null,
        type: transactionType,
        date: date,
      });
      
      toast({
        title: 'Transação adicionada!',
        description: 'A transação foi guardada com sucesso.',
      });
      
      // Reset form
      setCategoryId('');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsTransactionDialogOpen(false);
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar a transação.',
        variant: 'destructive',
      });
    }
  };
  
  const handleNewSimulation = () => {
    navigate('/simulacao');
  };
  
  const handleViewInvestments = () => {
    navigate('/poupanca');
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        <Button 
          onClick={() => setIsTransactionDialogOpen(true)}
          className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow"
        >
          <Plus className="w-4 h-4" />
          Nova Transação
        </Button>
        <Button
          onClick={handleNewSimulation}
          variant="outline"
          className="gap-2"
        >
          <Calculator className="w-4 h-4" />
          Nova Simulação
        </Button>
        <Button
          onClick={handleViewInvestments}
          variant="outline"
          className="gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Ver Investimentos
        </Button>
      </motion.div>
      
      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo</Label>
              <Select value={transactionType} onValueChange={(value) => {
                setTransactionType(value as 'income' | 'expense');
                setCategoryId(''); // Reset category when type changes
              }}>
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
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleciona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories && (() => {
                    // Para despesas, agrupar por tipo de categoria; para receitas, apenas uma secção
                    if (transactionType === 'income') {
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
              <Label>Montante (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Compra no supermercado"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddTransaction}
              disabled={createTransaction.isPending}
            >
              {createTransaction.isPending ? 'A guardar...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
