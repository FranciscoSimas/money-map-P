import { useState, useEffect } from 'react';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, Calendar, Utensils, Gift, Plus,
  Car, Fuel, Wifi, CreditCard, Home,
  Gamepad2, ShoppingCart, Heart, Shirt,
  Dice5, PiggyBank, TrendingUp, Bitcoin, X, Trash2
} from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';
import { useToast } from '@/hooks/use-toast';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const iconMap: Record<string, any> = {
  Wallet, Calendar, Utensils, Gift, Plus,
  Car, Fuel, Wifi, CreditCard, Home,
  Gamepad2, ShoppingCart, Heart, Shirt,
  Dice5, PiggyBank, TrendingUp, Bitcoin
};

const expenseTypeLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  fixed: { label: 'Fixa', variant: 'default' },
  variable: { label: 'Variável', variant: 'secondary' },
  optional: { label: 'Opcional', variant: 'outline' },
};

export function OnboardingStepCategories({ data, updateData }: Props) {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'expense' | 'income'>('expense');
  const [newCategoryExpenseType, setNewCategoryExpenseType] = useState<'fixed' | 'variable' | 'optional'>('variable');
  
  // Initialize selectedCategories with all default categories if empty (only once)
  useEffect(() => {
    if (data.selectedCategories.length === 0 && categories && categories.length > 0) {
      const defaultCategoryIds = categories
        .filter(c => c.is_default && c.is_active)
        .map(c => c.id);
      if (defaultCategoryIds.length > 0) {
        updateData({ selectedCategories: defaultCategoryIds });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories?.length]); // Only run when categories are loaded
  
  const toggleCategory = (categoryId: string) => {
    const current = data.selectedCategories;
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    updateData({ selectedCategories: updated });
  };
  
  const handleRemoveCategory = async (categoryId: string) => {
    // Only allow removing user-created categories (not default ones)
    const category = categories?.find(c => c.id === categoryId);
    if (category?.is_default) {
      toast({
        title: 'Não é possível remover',
        description: 'Não podes remover categorias pré-definidas. Podes apenas desativá-las.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await deleteCategory.mutateAsync(categoryId);
      // Remove from selected categories
      updateData({ selectedCategories: data.selectedCategories.filter(id => id !== categoryId) });
      toast({
        title: 'Categoria removida',
        description: 'A categoria foi removida com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a categoria.',
        variant: 'destructive',
      });
    }
  };
  
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, insere um nome para a categoria.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const newCategory = await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        type: newCategoryType,
        expense_type: newCategoryType === 'expense' ? newCategoryExpenseType : null,
        icon: 'Plus',
        color: newCategoryType === 'income' ? '#22c55e' : '#ef4444',
        is_active: true,
        sort_order: 999,
      });
      
      // Add to selected categories
      updateData({ selectedCategories: [...data.selectedCategories, newCategory.id] });
      
      setNewCategoryName('');
      setIsDialogOpen(false);
      toast({
        title: 'Categoria criada',
        description: 'A nova categoria foi criada e adicionada.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];
  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Seleciona as categorias que queres usar. Podes adicionar novas ou remover as que não precisas.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>
                Cria uma categoria personalizada para as tuas finanças
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nome da Categoria</Label>
                <Input
                  id="categoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ex: Ginásio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryType">Tipo</Label>
                <Select value={newCategoryType} onValueChange={(v: 'expense' | 'income') => setNewCategoryType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Rendimento</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newCategoryType === 'expense' && (
                <div className="space-y-2">
                  <Label htmlFor="expenseType">Tipo de Despesa</Label>
                  <Select value={newCategoryExpenseType} onValueChange={(v: 'fixed' | 'variable' | 'optional') => setNewCategoryExpenseType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixa</SelectItem>
                      <SelectItem value="variable">Variável</SelectItem>
                      <SelectItem value="optional">Opcional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreateCategory} className="w-full" disabled={createCategory.isPending}>
                {createCategory.isPending ? 'A criar...' : 'Criar Categoria'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Income Categories */}
      <div>
        <h4 className="font-medium text-sm text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Rendimentos
        </h4>
        <div className="grid gap-2">
          {incomeCategories.map(category => {
            const Icon = iconMap[category.icon || 'Wallet'] || Wallet;
            const isSelected = data.selectedCategories.includes(category.id);
            const isUserCreated = !category.is_default;
            
            return (
              <div
                key={category.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isSelected 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-card hover:bg-accent/50'
                }`}
              >
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={isSelected}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <Label 
                  htmlFor={`cat-${category.id}`}
                  className="flex-1 flex items-center gap-3 cursor-pointer"
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: category.color }} />
                  </div>
                  <span className="flex-1 font-medium">{category.name}</span>
                </Label>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  Rendimento
                </Badge>
                {isUserCreated && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveCategory(category.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Expense Categories */}
      <div>
        <h4 className="font-medium text-sm text-destructive mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Despesas
        </h4>
        <div className="grid gap-2">
          {expenseCategories.map(category => {
            const Icon = iconMap[category.icon || 'CreditCard'] || CreditCard;
            const typeInfo = category.expense_type ? expenseTypeLabels[category.expense_type] : null;
            const isSelected = data.selectedCategories.includes(category.id);
            const isUserCreated = !category.is_default;
            
            return (
              <div
                key={category.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isSelected 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-card hover:bg-accent/50'
                }`}
              >
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={isSelected}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <Label 
                  htmlFor={`cat-${category.id}`}
                  className="flex-1 flex items-center gap-3 cursor-pointer"
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: category.color }} />
                  </div>
                  <span className="flex-1 font-medium">{category.name}</span>
                </Label>
                {typeInfo && (
                  <Badge variant={typeInfo.variant}>
                    {typeInfo.label}
                  </Badge>
                )}
                {isUserCreated && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveCategory(category.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        💡 As categorias selecionadas serão as que aparecem por defeito. Podes sempre adicionar mais depois.
      </p>
    </div>
  );
}
