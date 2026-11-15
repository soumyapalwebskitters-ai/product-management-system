-- Earlier versions stored the purchase unit but did not persist the sell-as choice.
-- Restore the existing box catalog as box sales; item purchases remain piece sales.
UPDATE variants
SET selling_unit = CASE WHEN purchase_unit = 'box' THEN 'box' ELSE 'item' END;
