import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Database } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Movement = Database['public']['Tables']['mouvements']['Row'];
type Expiry = Database['public']['Tables']['peremptions']['Row'];

interface PaginationParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pageCount: number;
}

// Products Query Hook
export function useProducts({ page, pageSize, searchTerm = '' }: PaginationParams) {
  return useQuery({
    queryKey: ['products', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<Product>> => {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('nom');

      // Apply search filter if provided
      if (searchTerm && searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        query = query.or(`nom.ilike.${searchPattern},code.ilike.${searchPattern},classe_therapeutique.ilike.${searchPattern}`);
      }

      // Apply pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Movements Query Hook
export function useMovements({ page, pageSize, searchTerm = '' }: PaginationParams & { selectedMonth: string }) {
  return useQuery({
    queryKey: ['movements', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<Movement & { products: { code: string; nom: string } }>> => {
      let query = supabase
        .from('mouvements')
        .select(`
          *,
          products (
            code,
            nom
          )
        `, { count: 'exact' })
        .order('date_mouvement', { ascending: false });

      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`products.nom.ilike.%${searchTerm}%,products.code.ilike.%${searchTerm}%`);
      }

      // Apply pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Expiries Query Hook
export function useExpiries({ page, pageSize, searchTerm = '' }: PaginationParams) {
  return useQuery({
    queryKey: ['expiries', page, pageSize, searchTerm],
    queryFn: async (): Promise<PaginatedResponse<Expiry & { products: { code: string; nom: string } }>> => {
      let query = supabase
        .from('peremptions')
        .select(`
          *,
          products (
            code,
            nom
          )
        `, { count: 'exact' })
        .order('date_peremption');

      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`products.nom.ilike.%${searchTerm}%,products.code.ilike.%${searchTerm}%`);
      }

      // Apply pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Product Mutation Hook
export function useProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<Product> & { id?: string }) => {
      if (product.id) {
        // Update existing product
        const { data, error } = await supabase
          .from('products')
          .update(product)
          .eq('id', product.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert(product)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch products
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Delete Product Hook
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Toggle Product Active Status
export function useToggleProductActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ actif: !actif })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Movement Mutation Hook
export function useMovementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movement: Partial<Movement> & { id?: string }) => {
      if (movement.id) {
        const { data, error } = await supabase
          .from('mouvements')
          .update(movement)
          .eq('id', movement.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('mouvements')
          .insert(movement)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Expiry Mutation Hook
export function useExpiryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expiry: Partial<Expiry> & { id?: string }) => {
      if (expiry.id) {
        const { data, error } = await supabase
          .from('peremptions')
          .update(expiry)
          .eq('id', expiry.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('peremptions')
          .insert(expiry)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expiries'] });
    },
  });
}
