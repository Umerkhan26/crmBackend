-- Query to find foreign key constraint name for campaignId in product_sales table
-- Run this in phpMyAdmin SQL tab

SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM 
    information_schema.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = 'crm'
    AND TABLE_NAME = 'product_sales'
    AND COLUMN_NAME = 'campaignId'
    AND REFERENCED_TABLE_NAME IS NOT NULL;

