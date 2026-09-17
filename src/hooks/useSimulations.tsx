import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Simulation {
  id: string;
  user_id: string;
  name: string;
  months: number;
  start_year: number | null;
  start_month: number | null; // 1-12
  default_values: Record<string, number>; // { category_id: amount }
  monthly_overrides: Record<string, Record<string, number>>; // { month_index: { category_id: amount } }
  created_at: string;
  updated_at: string;
}

export function useSimulations() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['simulations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('simulations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data as Simulation[]) || [];
    },
    enabled: !!user?.id,
  });
}

export function useSimulation(id: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['simulation', id, user?.id],
    queryFn: async () => {
      if (!user?.id || !id) return null;
      
      const { data, error } = await supabase
        .from('simulations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      return data as Simulation | null;
    },
    enabled: !!user?.id && !!id,
  });
}

export function useCreateSimulation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (simulation: {
      name: string;
      months: number;
      start_year?: number;
      start_month?: number;
      default_values?: Record<string, number>;
      monthly_overrides?: Record<string, Record<string, number>>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('simulations')
        .insert({
          ...simulation,
          user_id: user.id,
          start_year: simulation.start_year ?? null,
          start_month: simulation.start_month ?? null,
          default_values: simulation.default_values || {},
          monthly_overrides: simulation.monthly_overrides || {},
        })
        .select()
        .single();
        
      if (error) throw error;
      return data as Simulation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    },
  });
}

export function useUpdateSimulation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Simulation> & { id: string }) => {
      const { data, error } = await supabase
        .from('simulations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data as Simulation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['simulation'] });
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('simulations')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    },
  });
}
