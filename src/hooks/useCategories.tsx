import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: 'expense' | 'income';
  expense_type: 'fixed' | 'variable' | 'optional' | null;
  icon: string | null;
  color: string | null;
  category_group: 'income' | 'general_expenses' | 'fixed_expenses' | 'optional_expenses' | 'savings_investments' | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number | null;
  base_category_id?: string | null;
  created_at: string;
}

export function useCategories() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      // Get user profile to check for hidden categories
      const { data: profile } = await supabase
        .from('profiles')
        .select('hidden_categories')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      const hiddenCategoryIds = (profile?.hidden_categories as string[]) || [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
        
      if (error) throw error;

      // Load color preferences for this user
      const { data: colorPrefs } = await supabase
        .from('category_color_preferences')
        .select('category_id,color')
        .eq('user_id', user?.id);
      const colorMap = new Map<string, string>();
      (colorPrefs || []).forEach((pref: any) => {
        if (pref.category_id && pref.color) {
          colorMap.set(pref.category_id, pref.color);
        }
      });

      // Load user-specific category preferences (order/active)
      const { data: userPrefs } = await supabase
        .from('category_user_preferences')
        .select('category_id,sort_order,is_active')
        .eq('user_id', user?.id);
      const prefMap = new Map<string, { sort_order: number | null; is_active: boolean }>();
      (userPrefs || []).forEach((pref: any) => {
        if (pref.category_id) {
          prefMap.set(pref.category_id, {
            sort_order: pref.sort_order,
            is_active: pref.is_active,
          });
        }
      });

      // Filter out hidden default categories (wizard inicial) e prefs com is_active = false
      const filtered = (data as Category[]).filter(cat => {
        // If it's a default category (user_id is null) and it's in hidden list, exclude it
        if (cat.user_id === null && hiddenCategoryIds.includes(cat.id)) {
          return false;
        }
        // If user preference exists and is_active = false, esconder
        const pref = prefMap.get(cat.id);
        if (pref && pref.is_active === false) {
          return false;
        }
        return true;
      });

      // Apply user-specific color preferences e sort_order
      const withColorsAndOrder = filtered.map(cat => {
        // Só aplicar override de cor para categorias pré-definidas (user_id null)
        const overrideColor = cat.user_id === null ? colorMap.get(cat.id) : undefined;
        const pref = prefMap.get(cat.id);
        const effectiveSortOrder = pref?.sort_order ?? cat.sort_order;

        if (overrideColor) {
          return { ...cat, color: overrideColor, sort_order: effectiveSortOrder };
        }
        return { ...cat, sort_order: effectiveSortOrder };
      });

      // Ordenar pela sort_order efetiva e depois por nome
      withColorsAndOrder.sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA === orderB) {
          return a.name.localeCompare(b.name);
        }
        return orderA - orderB;
      });

      return withColorsAndOrder;
    },
    enabled: !!user?.id,
  });
}

// Versão que traz TODAS as categorias (ativas/inativas e também as escondidas),
// usada em funcionalidades que precisam manter histórico (como simulações antigas)
export function useAllCategories() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['all-categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .order('sort_order', { ascending: true });
        
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user?.id,
  });
}

export function useIncomeCategories() {
  const { data: categories, ...rest } = useCategories();
  
  return {
    ...rest,
    data: categories?.filter(c => c.type === 'income'),
  };
}

export function useExpenseCategories() {
  const { data: categories, ...rest } = useCategories();
  
  return {
    ...rest,
    data: categories?.filter(c => c.type === 'expense'),
  };
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'user_id' | 'created_at' | 'is_default'>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          user_id: user.id,
          is_default: false,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
