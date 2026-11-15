-- Product images are now managed through the Gallery using external Drive URLs.
-- Clear only the legacy embedded product and variant image values.
UPDATE products SET image = '';
UPDATE variants SET image = '';
