import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Download, Trash2, Plus, Edit2, Sparkles, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { HistoryWizard } from '@/components/history/HistoryWizard';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from '@/hooks/useCategories';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

function HistoryWizardButton() {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto gap-2"
        variant="outline"
      >
        <Calendar className="w-4 h-4" />
        Atualizar Histórico
        <ArrowRight className="w-4 h-4" />
      </Button>
      <HistoryWizard open={open} onOpenChange={setOpen} />
    </>
  );
}

// Sortable Category Group Component
interface SortableCategoryGroupProps {
  group: string;
  categories: Category[];
  onCategoryEdit: (category: Category) => void;
  onCategoryDelete: (category: Category) => void;
  sensors: ReturnType<typeof useSensors>;
}

function SortableCategoryGroup({ group, categories, onCategoryEdit, onCategoryDelete, sensors }: SortableCategoryGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedCategories = arrayMove(categories, oldIndex, newIndex);

    try {
      if (!user?.id) return;

      // Atualizar a ordem de TODAS as categorias deste grupo para este utilizador
      const updates: Promise<any>[] = [];
      reorderedCategories.forEach((cat, index) => {
        updates.push(
          supabase
            .from('category_user_preferences')
            .upsert(
              {
                user_id: user.id,
                category_id: cat.id,
                sort_order: index,
                is_active: true,
              },
              { onConflict: 'user_id,category_id' }
            )
        );
      });

      if (updates.length > 0) {
        await Promise.all(updates);
        await queryClient.invalidateQueries({ queryKey: ['categories'] });

        toast({
          title: 'Ordem atualizada!',
          description: 'A ordem das categorias foi atualizada.',
        });
      }
    } catch (error) {
      console.error('Error updating category order:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a ordem.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-2 ${isDragging ? 'ring-2 ring-primary rounded-lg p-2' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded transition-colors"
          aria-label="Arrastar grupo"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div 
          className="w-5 h-5 rounded-full border-2 border-border"
          style={{ backgroundColor: GROUP_COLORS[group] || UNIVERSAL_COLORS[0] }}
        />
        <p className="text-sm font-semibold">
          {CATEGORY_GROUP_NAMES[group] || group}
        </p>
        <span className="text-xs text-muted-foreground">
          ({categories.length} categoria{categories.length !== 1 ? 's' : ''})
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCategoryDragEnd}
      >
        <SortableContext
          items={categories.map(cat => cat.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pl-7">
            {categories.map((cat) => (
              <SortableCategoryItem
                key={cat.id}
                category={cat}
                onEdit={() => onCategoryEdit(cat)}
                onDelete={() => onCategoryDelete(cat)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// Sortable Category Item Component
interface SortableCategoryItemProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCategoryItem({ category, onEdit, onDelete }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded-lg bg-secondary/50 group transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : 'hover:bg-secondary'
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded transition-colors"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color || UNIVERSAL_COLORS[0] }}
          />
          <div>
            <p className="font-medium text-sm">{category.name}</p>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${category.type === 'income' ? 'text-success' : 'text-muted-foreground'}`}>
                {category.type === 'income' ? 'Receita' : 'Despesa'}
              </span>
              {category.expense_type && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {category.expense_type === 'fixed' ? 'Fixa' : category.expense_type === 'variable' ? 'Variável' : 'Opcional'}
                </span>
              )}
              {category.is_default && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Pré-definida
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8 text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Paleta universal de cores para categorias (>= 25 cores)
const UNIVERSAL_COLORS = [
  // Vermelhos / Laranjas
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#fb923c',
  '#fda4af',
  // Verdes
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#4ade80',
  '#16a34a',
  // Azuis / Cianos
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#2563eb',
  '#38bdf8',
  // Roxos / Violetas / Pinks
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#e879f9',
  // Neutros / Outros
  '#0f172a',
  '#1e293b',
  '#475569',
  '#94a3b8',
];

// Category group names
const CATEGORY_GROUP_NAMES: Record<string, string> = {
  income: 'Receitas',
  general_expenses: 'Despesas Gerais',
  fixed_expenses: 'Despesas Fixas',
  optional_expenses: 'Despesas Opcionais',
  savings_investments: 'Poupança/Investimentos',
};

// Default colors for each group (for display purposes)
const GROUP_COLORS: Record<string, string> = {
  income: '#22c55e', // Green
  general_expenses: '#f97316', // Orange
  fixed_expenses: '#ef4444', // Red
  optional_expenses: '#a855f7', // Purple
  savings_investments: '#3b82f6', // Blue
};

// Helper function to determine category group based on type and expense_type
function determineCategoryGroup(
  type: 'expense' | 'income',
  expense_type: 'fixed' | 'variable' | 'optional' | null,
  name?: string | null
): 'income' | 'general_expenses' | 'fixed_expenses' | 'optional_expenses' | 'savings_investments' {
  if (type === 'income') {
    return 'income';
  }

  if (type === 'expense') {
    if (expense_type === 'fixed') {
      // Poupança pode ser fixed, mas queremos tratar especificamente pelo nome
      if (name && (name === 'Poupança' || name === 'Ações/ETFs' || name === 'Crypto')) {
        return 'savings_investments';
      }
      return 'fixed_expenses';
    }
    if (expense_type === 'optional') {
      return 'optional_expenses';
    }
    // Check if it's a savings/investment category by name
    if (name && (name === 'Poupança' || name === 'Ações/ETFs' || name === 'Crypto')) {
      return 'savings_investments';
    }
    // Default to general expenses for variable/other expenses
    return 'general_expenses';
  }

  return 'general_expenses';
}

function CategoriesSection() {
  const { user } = useAuth();
  const { data: categories, isLoading } = useCategories();
  const { data: profile } = useProfile();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    type: 'expense',
    expense_type: null,
    color: UNIVERSAL_COLORS[0],
    icon: null,
    category_group: null,
  });

  // Modo de criação: pré-definida existente vs nova categoria
  const [createMode, setCreateMode] = useState<'predefined' | 'new'>('predefined');
  const [selectedPredefinedId, setSelectedPredefinedId] = useState<string | null>(null);

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCreateMode('new');
      setFormData({
        name: category.name,
        type: category.type,
        expense_type: category.expense_type,
        color: category.color || UNIVERSAL_COLORS[0],
        icon: category.icon,
        category_group: category.category_group || determineCategoryGroup(category.type, category.expense_type, category.name),
      });
      setSelectedPredefinedId(null);
    } else {
      setEditingCategory(null);
      setCreateMode('predefined');
      setFormData({
        name: '',
        type: 'expense',
        expense_type: null,
        color: UNIVERSAL_COLORS[0],
        icon: null,
        category_group: null,
      });
      setSelectedPredefinedId(null);
    }
    setIsDialogOpen(true);
  };

  // Organize categories by group and sort groups by the first category's sort_order
  const categoriesByGroup = useMemo(() => {
    if (!categories) return {};
    
    const grouped: Record<string, Category[]> = {};
    categories.forEach(cat => {
      // Determine group - use existing category_group or determine from type/expense_type
      const group = cat.category_group || determineCategoryGroup(cat.type, cat.expense_type, cat.name);
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(cat);
    });
    
    // Sort categories within each group by sort_order
    // Categories with null sort_order go to the end
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA === orderB) {
          // If same order, sort by name for consistency
          return a.name.localeCompare(b.name);
        }
        return orderA - orderB;
      });
    });
    
    return grouped;
  }, [categories]);

  // Get sorted groups (sorted by first category's sort_order in each group)
  // Order: income, fixed_expenses, general_expenses, optional_expenses, savings_investments
  const groupOrder = ['income', 'fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
  const sortedGroups = useMemo(() => {
    const groups = Object.entries(categoriesByGroup);
    return groups.sort(([groupA, catsA], [groupB, catsB]) => {
      const indexA = groupOrder.indexOf(groupA);
      const indexB = groupOrder.indexOf(groupB);
      // If both groups are in the order list, use the predefined order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only one is in the list, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // If neither is in the list, sort by first category's sort_order
      const orderA = catsA[0]?.sort_order ?? 999;
      const orderB = catsB[0]?.sort_order ?? 999;
      return orderA - orderB;
    });
  }, [categoriesByGroup]);

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for categories within a group
  const handleCategoryDragEnd = async (event: DragEndEvent, groupCategories: Category[]) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = groupCategories.findIndex((cat) => cat.id === active.id);
    const newIndex = groupCategories.findIndex((cat) => cat.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the array
    const reorderedCategories = arrayMove(groupCategories, oldIndex, newIndex);

    try {
      if (!user?.id) return;

      // Atualizar sort_order por utilizador na tabela category_user_preferences
      await Promise.all(
        reorderedCategories.map((cat, index) =>
          supabase
            .from('category_user_preferences')
            .upsert(
              {
                user_id: user.id,
                category_id: cat.id,
                sort_order: index,
                is_active: true,
              },
              { onConflict: 'user_id,category_id' }
            )
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['categories'] });

      toast({
        title: 'Ordem atualizada!',
        description: 'A ordem das categorias foi atualizada para a tua conta.',
      });
    } catch (error) {
      console.error('Error updating category order:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a ordem.',
        variant: 'destructive',
      });
    }
  };

  // Handle drag end for groups
  const handleGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedGroups.findIndex(([group]) => group === active.id);
    const newIndex = sortedGroups.findIndex(([group]) => group === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the groups
    const reorderedGroups = arrayMove(sortedGroups, oldIndex, newIndex);

    try {
      if (!user?.id) return;

      // Achatar todas as categorias na nova ordem de grupos,
      // atribuindo um sort_order sequencial por utilizador
      const allCategoriesInOrder: Category[] = [];
      for (const [_, cats] of reorderedGroups) {
        const sortedInGroup = [...cats].sort((a, b) => {
          const orderA = a.sort_order ?? 999999;
          const orderB = b.sort_order ?? 999999;
          if (orderA === orderB) {
            return a.name.localeCompare(b.name);
          }
          return orderA - orderB;
        });
        allCategoriesInOrder.push(...sortedInGroup);
      }

      const updates: Promise<any>[] = [];
      allCategoriesInOrder.forEach((cat, index) => {
        updates.push(
          supabase
            .from('category_user_preferences')
            .upsert(
              {
                user_id: user.id,
                category_id: cat.id,
                sort_order: index,
                is_active: true,
              },
              { onConflict: 'user_id,category_id' }
            )
        );
      });

      if (updates.length > 0) {
        await Promise.all(updates);
        await queryClient.invalidateQueries({ queryKey: ['categories'] });

        toast({
          title: 'Ordem atualizada!',
          description: 'A ordem dos grupos foi atualizada para a tua conta.',
        });
      }
    } catch (error) {
      console.error('Error updating group order:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a ordem dos grupos.',
        variant: 'destructive',
      });
    }
  };

  const addToHiddenCategories = async (categoryId: string) => {
    if (!user?.id || !profile) return;
    
    const currentHidden = (profile.hidden_categories as string[]) || [];
    if (!currentHidden.includes(categoryId)) {
      const updatedHidden = [...currentHidden, categoryId];
      await updateProfile.mutateAsync({
        hidden_categories: updatedHidden,
      });
    }
  };

  const removeFromHiddenCategories = async (categoryId: string) => {
    if (!user?.id || !profile) return;
    const currentHidden = (profile.hidden_categories as string[]) || [];
    if (currentHidden.includes(categoryId)) {
      const updatedHidden = currentHidden.filter((id) => id !== categoryId);
      await updateProfile.mutateAsync({
        hidden_categories: updatedHidden,
      });
    }
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        if (!formData.name) {
          toast({
            title: 'Erro',
            description: 'O nome da categoria é obrigatório.',
            variant: 'destructive',
          });
          return;
        }

        // If editing a default category (user_id is null), create a new personal category
        // and hide the default one
        if (editingCategory.is_default && editingCategory.user_id === null) {
          // Verificar se apenas a cor foi alterada -> usar preferências de cor em vez de criar nova categoria
          const originalGroup = editingCategory.category_group || determineCategoryGroup(
            editingCategory.type as 'expense' | 'income',
            editingCategory.expense_type as 'fixed' | 'variable' | 'optional' | null,
            editingCategory.name
          );
          const newGroup = formData.category_group || determineCategoryGroup(
            formData.type as 'expense' | 'income',
            formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            formData.name
          );
          const onlyColorChanged =
            formData.name === editingCategory.name &&
            formData.type === editingCategory.type &&
            formData.expense_type === editingCategory.expense_type &&
            newGroup === originalGroup &&
            (formData.icon ?? null) === (editingCategory.icon ?? null) &&
            formData.color !== editingCategory.color;

          if (onlyColorChanged && user?.id) {
            // Guardar preferência de cor personalizada para esta categoria pré-definida
            const { error } = await supabase
              .from('category_color_preferences')
              .upsert({
                user_id: user.id,
                category_id: editingCategory.id,
                color: formData.color || editingCategory.color || UNIVERSAL_COLORS[0],
              }, { onConflict: 'user_id,category_id' });

            if (error) {
              console.error('Error updating color preference:', error);
              toast({
                title: 'Erro',
                description: 'Ocorreu um erro ao atualizar a cor da categoria.',
                variant: 'destructive',
              });
              return;
            }

            // Recarregar categorias para refletir a nova cor
            await queryClient.invalidateQueries({ queryKey: ['categories'] });
            await queryClient.invalidateQueries({ queryKey: ['transactions'] });

            toast({
              title: 'Cor atualizada!',
              description: 'A cor da categoria foi personalizada para a tua conta.',
            });
            setIsDialogOpen(false);
            return;
          }

          // Create new personal category with edited values
          const categoryGroup = formData.category_group || determineCategoryGroup(
            formData.type as 'expense' | 'income',
            formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            formData.name
          );
          await createCategory.mutateAsync({
            name: formData.name!,
            type: formData.type as 'expense' | 'income',
            expense_type: formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            color: formData.color || null,
            icon: formData.icon || null,
            category_group: categoryGroup,
            is_active: true,
            sort_order: 0,
            base_category_id: editingCategory.id,
          });
          
          // Hide the default category
          await addToHiddenCategories(editingCategory.id);
          
          toast({
            title: 'Categoria criada!',
            description: 'Uma nova categoria personalizada foi criada e a pré-definida foi ocultada.',
          });
        } else {
          // Regular update for personal categories
          const categoryGroup = formData.category_group || determineCategoryGroup(
            formData.type as 'expense' | 'income',
            formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            formData.name
          );
          await updateCategory.mutateAsync({
            id: editingCategory.id,
            ...formData,
            category_group: categoryGroup,
          });
          toast({
            title: 'Categoria atualizada!',
            description: 'A categoria foi atualizada com sucesso.',
          });
        }
      } else {
        // Creating a new category
        if (createMode === 'predefined') {
          if (!selectedPredefinedId) {
            toast({
              title: 'Erro',
              description: 'Seleciona uma categoria pré-definida.',
              variant: 'destructive',
            });
            return;
          }

          // Reativar categoria pré-definida para este user removendo-a da lista de ocultas
          await removeFromHiddenCategories(selectedPredefinedId);
          toast({
            title: 'Categoria adicionada!',
            description: 'A categoria pré-definida foi adicionada à tua lista.',
          });
        } else {
          if (!formData.name) {
            toast({
              title: 'Erro',
              description: 'O nome da categoria é obrigatório.',
              variant: 'destructive',
            });
            return;
          }

          const categoryGroup = formData.category_group || determineCategoryGroup(
            formData.type as 'expense' | 'income',
            formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            formData.name
          );
          await createCategory.mutateAsync({
            name: formData.name!,
            type: formData.type as 'expense' | 'income',
            expense_type: formData.expense_type as 'fixed' | 'variable' | 'optional' | null,
            color: formData.color || null,
            icon: formData.icon || null,
            category_group: categoryGroup,
            is_active: true,
            sort_order: 0,
          });
          toast({
            title: 'Categoria criada!',
            description: 'A nova categoria foi criada com sucesso.',
          });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao guardar a categoria. Tenta novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (category: Category) => {
    // If it's a default category, just hide it instead of deleting
    if (category.is_default && category.user_id === null) {
      if (window.confirm(`Tens a certeza que queres ocultar a categoria pré-definida "${category.name}"?`)) {
        try {
          await addToHiddenCategories(category.id);
          toast({
            title: 'Categoria ocultada!',
            description: 'A categoria pré-definida foi ocultada da tua lista.',
          });
        } catch (error) {
          console.error('Error hiding category:', error);
          toast({
            title: 'Erro',
            description: 'Ocorreu um erro ao ocultar a categoria. Tenta novamente.',
            variant: 'destructive',
          });
        }
      }
      return;
    }

    // For personal categories, delete normally
    if (window.confirm(`Tens a certeza que queres eliminar a categoria "${category.name}"?`)) {
      try {
        await deleteCategory.mutateAsync(category.id);
        toast({
          title: 'Categoria eliminada!',
          description: 'A categoria foi eliminada com sucesso.',
        });
      } catch (error) {
        console.error('Error deleting category:', error);
        toast({
          title: 'Erro',
          description: 'Ocorreu um erro ao eliminar a categoria. Tenta novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border p-5 shadow-card"
      >
        <Skeleton className="h-10 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border p-5 shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Categorias</h3>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={sortedGroups.map(([group]) => group)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {categories && categories.length > 0 ? (
                sortedGroups.length > 0 ? (
                  sortedGroups.map(([group, groupCategories]) => (
                    <SortableCategoryGroup
                      key={group}
                      group={group}
                      categories={groupCategories}
                      onCategoryEdit={(cat) => handleOpenDialog(cat)}
                      onCategoryDelete={(cat) => handleDelete(cat)}
                      sensors={sensors}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma categoria encontrada. Cria uma nova categoria para começar.</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma categoria encontrada. Cria uma nova categoria para começar.</p>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </motion.div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingCategory && (
              <div className="space-y-2">
                <Label>Tipo de categoria</Label>
                <Select
                  value={createMode}
                  onValueChange={(value) => setCreateMode(value as 'predefined' | 'new')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="predefined">Pré-definidas</SelectItem>
                    <SelectItem value="new">Criar nova</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editingCategory && createMode === 'predefined' && (
              <div className="space-y-2">
                <Label>Categoria pré-definida</Label>
                <Select
                  value={selectedPredefinedId || ''}
                  onValueChange={(value) => setSelectedPredefinedId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleciona uma categoria pré-definida" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories || [])
                      .filter((cat) => cat.is_default && cat.user_id === null)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  As categorias pré-definidas são comuns a todas as contas. Aqui apenas escolhes quais queres usar.
                </p>
              </div>
            )}

            {(editingCategory || createMode === 'new') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="category-name">Nome da Categoria</Label>
                  <Input
                    id="category-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Alimentação"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      const newType = value as 'expense' | 'income';
                      const newExpenseType = newType === 'expense' ? formData.expense_type : null;
                      const newGroup = determineCategoryGroup(newType, newExpenseType, formData.name);
                      setFormData({ 
                        ...formData, 
                        type: newType, 
                        expense_type: newExpenseType,
                        category_group: newGroup,
                      });
                    }}
                  >
                    <SelectTrigger id="category-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'expense' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="expense-type">Tipo de Despesa</Label>
                      <Select
                        value={formData.expense_type || ''}
                        onValueChange={(value) => {
                          const newExpenseType = value === 'none' ? null : value as 'fixed' | 'variable' | 'optional';
                          const newGroup = determineCategoryGroup(formData.type as 'expense' | 'income', newExpenseType, formData.name);
                          setFormData({ 
                            ...formData, 
                            expense_type: newExpenseType,
                            category_group: newGroup,
                          });
                        }}
                      >
                        <SelectTrigger id="expense-type">
                          <SelectValue placeholder="Seleciona o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="fixed">Fixa</SelectItem>
                          <SelectItem value="variable">Variável</SelectItem>
                          <SelectItem value="optional">Opcional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category-group">Grupo</Label>
                      <Select
                        value={formData.category_group || determineCategoryGroup(formData.type as 'expense' | 'income', formData.expense_type, formData.name)}
                        onValueChange={(value) => setFormData({ ...formData, category_group: value as any })}
                      >
                        <SelectTrigger id="category-group">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Receitas</SelectItem>
                          <SelectItem value="general_expenses">Despesas Gerais</SelectItem>
                          <SelectItem value="fixed_expenses">Despesas Fixas</SelectItem>
                          <SelectItem value="optional_expenses">Despesas Opcionais</SelectItem>
                          <SelectItem value="savings_investments">Poupança/Investimentos</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O grupo é determinado automaticamente, mas podes alterá-lo manualmente
                      </p>
                    </div>
                  </>
                )}
                {formData.type === 'income' && (
                  <div className="space-y-2">
                    <Label htmlFor="category-group">Grupo</Label>
                    <Select
                      value={formData.category_group || 'income'}
                      onValueChange={(value) => setFormData({ ...formData, category_group: value as any })}
                    >
                      <SelectTrigger id="category-group">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Receitas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="category-color">Cor</Label>
              <div className="grid grid-cols-5 gap-2">
                {UNIVERSAL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-full h-10 rounded-lg border-2 transition-all ${
                      formData.color === color
                        ? 'border-primary ring-2 ring-primary ring-offset-2'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Seleciona uma das cores predefinidas
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createCategory.isPending || updateCategory.isPending}>
              {editingCategory ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Definicoes() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [notifications, setNotifications] = useState({
    lowBalance: true,
    monthlyReport: true,
    goalProgress: false,
    billReminders: true,
  });
  
  const handleRedoOnboarding = () => {
    navigate('/onboarding');
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Definições</h1>
          <p className="text-muted-foreground mt-1">Personaliza a tua experiência</p>
        </div>

        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Perfil</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold">{profile?.name || 'Utilizador'}</p>
              <p className="text-sm text-muted-foreground">{profile?.email || ''}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Editar Perfil
            </Button>
          </div>
        </motion.div>

        {/* Onboarding/Configuration Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Configuração Inicial</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Atualiza as tuas informações de salário, categorias, montantes atuais e dados históricos.
            </p>
            <Button 
              onClick={handleRedoOnboarding}
              className="w-full sm:w-auto gap-2"
              variant="outline"
            >
              <Sparkles className="w-4 h-4" />
              Refazer Configuração Inicial
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Podes atualizar qualquer informação do teu perfil, salário, categorias e montantes a qualquer momento.
            </p>
          </div>
        </motion.div>

        {/* History Update Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Histórico de Dados</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Atualiza os dados históricos dos últimos meses. Preenche o salário recebido e as despesas por categoria para cada mês.
            </p>
            <HistoryWizardButton />
            <p className="text-xs text-muted-foreground">
              Podes atualizar os dados históricos a qualquer momento para ter uma visão mais completa das tuas finanças.
            </p>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Notificações</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Alerta de Saldo Baixo</p>
                <p className="text-xs text-muted-foreground">Receber aviso quando o saldo estiver baixo</p>
              </div>
              <Switch 
                checked={notifications.lowBalance} 
                onCheckedChange={(v) => setNotifications({ ...notifications, lowBalance: v })} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Relatório Mensal</p>
                <p className="text-xs text-muted-foreground">Resumo mensal das tuas finanças</p>
              </div>
              <Switch 
                checked={notifications.monthlyReport} 
                onCheckedChange={(v) => setNotifications({ ...notifications, monthlyReport: v })} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Progresso dos Objetivos</p>
                <p className="text-xs text-muted-foreground">Notificações sobre metas de poupança</p>
              </div>
              <Switch 
                checked={notifications.goalProgress} 
                onCheckedChange={(v) => setNotifications({ ...notifications, goalProgress: v })} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Lembretes de Contas</p>
                <p className="text-xs text-muted-foreground">Lembrar de contas a pagar</p>
              </div>
              <Switch 
                checked={notifications.billReminders} 
                onCheckedChange={(v) => setNotifications({ ...notifications, billReminders: v })} 
              />
            </div>
          </div>
        </motion.div>

        {/* Categories Section */}
        <CategoriesSection />

        {/* Data Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border p-5 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Dados</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
