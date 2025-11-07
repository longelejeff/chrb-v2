/*
  # Add Stock Tracking and Pricing Fields
  
  1. Products Table Updates
    - Add `stock_actuel` (numeric) - Current stock quantity
    - Add `prix_unitaire` (numeric) - Unit price in USD
    - Add `valeur_stock` (numeric) - Total stock value (auto-calculated)
    - Add default values of 0 for all new fields
  
  2. Mouvements Table Updates
    - Add `prix_unitaire` (numeric) - Unit price for this transaction
    - Add `valeur_totale` (numeric) - Total value of movement (quantity × price)
    - Add `solde_apres` (numeric) - Remaining stock after this movement
    - Add default values of 0 for pricing fields
  
  3. Notes
    - All existing products will have stock and pricing initialized to 0
    - All existing movements will have pricing fields set to 0
    - New movements will require these fields to be populated
    - Stock balance tracking will be automatic going forward
*/

-- Add stock tracking and pricing fields to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stock_actuel'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_actuel numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'prix_unitaire'
  ) THEN
    ALTER TABLE products ADD COLUMN prix_unitaire numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'valeur_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN valeur_stock numeric DEFAULT 0;
  END IF;
END $$;

-- Add pricing and balance fields to mouvements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mouvements' AND column_name = 'prix_unitaire'
  ) THEN
    ALTER TABLE mouvements ADD COLUMN prix_unitaire numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mouvements' AND column_name = 'valeur_totale'
  ) THEN
    ALTER TABLE mouvements ADD COLUMN valeur_totale numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mouvements' AND column_name = 'solde_apres'
  ) THEN
    ALTER TABLE mouvements ADD COLUMN solde_apres numeric DEFAULT 0;
  END IF;
END $$;

-- Create index for better performance on stock queries
CREATE INDEX IF NOT EXISTS idx_products_stock_actuel ON products(stock_actuel);
CREATE INDEX IF NOT EXISTS idx_products_valeur_stock ON products(valeur_stock);
CREATE INDEX IF NOT EXISTS idx_mouvements_solde_apres ON mouvements(solde_apres);