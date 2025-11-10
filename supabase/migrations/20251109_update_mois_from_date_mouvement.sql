/*
  # Update mois field to be calculated from date_mouvement
  
  1. Update existing records
    - Set mois based on date_mouvement for all existing records
  
  2. Create trigger function
    - Automatically calculate mois from date_mouvement on INSERT and UPDATE
  
  3. Create trigger
    - Apply function before INSERT and UPDATE operations
*/

-- Update all existing records to set mois based on date_mouvement
UPDATE mouvements
SET mois = TO_CHAR(date_mouvement::date, 'YYYY-MM')
WHERE date_mouvement IS NOT NULL;

-- Create function to automatically set mois from date_mouvement
CREATE OR REPLACE FUNCTION set_mois_from_date_mouvement()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate mois from date_mouvement (format: YYYY-MM)
  IF NEW.date_mouvement IS NOT NULL THEN
    NEW.mois := TO_CHAR(NEW.date_mouvement::date, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set mois before insert or update
DROP TRIGGER IF EXISTS trigger_set_mois_from_date_mouvement ON mouvements;
CREATE TRIGGER trigger_set_mois_from_date_mouvement
  BEFORE INSERT OR UPDATE ON mouvements
  FOR EACH ROW
  EXECUTE FUNCTION set_mois_from_date_mouvement();

-- Create index on mois for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_mouvements_mois ON mouvements(mois);
CREATE INDEX IF NOT EXISTS idx_mouvements_date_mouvement ON mouvements(date_mouvement);
