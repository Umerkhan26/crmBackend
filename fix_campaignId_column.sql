-- Step 1: Drop the foreign key constraint if it exists
-- Try these common constraint names one by one until one works:

-- Option 1: Try common MySQL auto-generated names
ALTER TABLE product_sales DROP FOREIGN KEY product_sales_ibfk_1;
-- If that fails, try:
ALTER TABLE product_sales DROP FOREIGN KEY product_sales_ibfk_2;
ALTER TABLE product_sales DROP FOREIGN KEY product_sales_ibfk_3;
ALTER TABLE product_sales DROP FOREIGN KEY product_sales_ibfk_4;

-- Step 2: Modify the campaignId column to allow NULL
ALTER TABLE product_sales MODIFY COLUMN campaignId INT(11) NULL;

-- After running these, restart your backend server and Sequelize will recreate the foreign key with the correct settings

