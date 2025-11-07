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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const useProducts = ({ page, pageSize, searchTerm, sortBy = 'nom', sortOrder = 'asc' }: PaginationParams) => {
  const queryKey = ['products', { page, pageSize, searchTerm, sortBy, sortOrder }];

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`nom.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      };
    },
  });
};

export const useMovements = ({ page, pageSize, searchTerm, sortBy = 'date_mouvement', sortOrder = 'desc' }: PaginationParams) => {
  const queryKey = ['movements', { page, pageSize, searchTerm, sortBy, sortOrder }];

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('mouvements')
        .select(\`
          *,
          products (
            id,
            code,
            nom
          )
        \`, { count: 'exact' });

      if (searchTerm) {
        query = query.or(`products.nom.ilike.%${searchTerm}%,products.code.ilike.%${searchTerm}%`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      };
    },
  });
};

export const useExpiries = ({ page, pageSize, searchTerm, sortBy = 'date_peremption', sortOrder = 'asc' }: PaginationParams) => {
  const queryKey = ['expiries', { page, pageSize, searchTerm, sortBy, sortOrder }];

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('peremptions')
        .select(\`
          *,
          products (
            id,
            code,
            nom
          )
        \`, { count: 'exact' });

      if (searchTerm) {
        query = query.or(`products.nom.ilike.%${searchTerm}%,products.code.ilike.%${searchTerm}%`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        pageCount: count ? Math.ceil(count / pageSize) : 0,
      };
    },
  });
};

// Mutation hooks for data modifications
export const useProductMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<Product> & { id?: string }) => {
      if (product.id) {
        // Update
        const { data, error } = await supabase
          .from('products')
          .update(product)
          .eq('id', product.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
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
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useMovementMutation = () => {
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
      // Also invalidate products as stock levels may have changed
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useExpiryMutation = () => {
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
};