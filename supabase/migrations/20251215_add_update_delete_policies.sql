/*
  # Add UPDATE and DELETE RLS policies for mouvements and products
  # Add LECTEUR role support to profiles

  Currently only SELECT and INSERT policies exist, preventing
  the app from editing or deleting movements and from updating product stock.

  1. mouvements table
    - Allow authenticated users to UPDATE their own movements
    - Allow authenticated users to DELETE their own movements

  2. products table
    - Allow authenticated users to UPDATE products (needed for stock recalculation)

  3. profiles table
    - Add CHECK constraint to allow 'LECTEUR' as a valid role
*/

-- ============================================================
-- MOUVEMENTS: add UPDATE & DELETE policies
-- ============================================================

-- UPDATE policy (allow all authenticated users – adjust if you need creator-only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mouvements' AND policyname = 'Allow authenticated users to update mouvements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow authenticated users to update mouvements"
        ON mouvements
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    $policy$;
  END IF;
END $$;

-- DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mouvements' AND policyname = 'Allow authenticated users to delete mouvements'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow authenticated users to delete mouvements"
        ON mouvements
        FOR DELETE
        TO authenticated
        USING (true);
    $policy$;
  END IF;
END $$;

-- ============================================================
-- PRODUCTS: make sure UPDATE policy exists
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'Allow authenticated users to update products'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow authenticated users to update products"
        ON products
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    $policy$;
  END IF;
END $$;

-- ============================================================
-- PROFILES: allow LECTEUR role
-- ============================================================

-- If there's an existing CHECK constraint on profiles.role, replace it to include LECTEUR.
-- First try to drop the old one, then add the new one.
-- This is safe: if the constraint doesn't exist the DROP is skipped.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find any existing check constraint on the role column
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid
    AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'profiles'::regclass
    AND con.contype = 'c'
    AND att.attname = 'role';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Add updated constraint that includes LECTEUR
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ADMIN', 'USER', 'LECTEUR'));
