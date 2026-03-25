# Brand Feature Database Sync Guide

This guide explains how to sync all brand-related database changes to your server.

## What This Sync Does

The sync script (`sync-brand-tables.ts`) will:

1. ✅ **Add `brandId` column to `users` table** (nullable, for backward compatibility)
   - **Note:** This is the ONLY existing table that gets modified. No other tables (leads, campaigns, orders, etc.) have brand-related changes.
2. ✅ **Create `brands` table** (if it doesn't exist)
3. ✅ **Create `brand_users` junction table** (many-to-many relationship between brands and users)
4. ✅ **Create `brand_managers` junction table** (many-to-many relationship between brands and managers)
5. ✅ **Sync all brand-related permissions** to the database
6. ✅ **Verify all changes** were applied successfully

## Brand-Related Tables

### 1. `brands` Table
- `id` (INT, Primary Key, Auto Increment)
- `name` (VARCHAR(255), Unique, Not Null)
- `description` (TEXT, Nullable)
- `status` (ENUM: 'active' | 'inactive', Default: 'active')
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

### 2. `brand_users` Junction Table
- `id` (INT, Primary Key, Auto Increment)
- `brandId` (INT, Foreign Key → brands.id, CASCADE on delete)
- `userId` (INT, Foreign Key → users.id, CASCADE on delete)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)
- Unique constraint on (`brandId`, `userId`)

### 3. `brand_managers` Junction Table
- `id` (INT, Primary Key, Auto Increment)
- `brandId` (INT, Foreign Key → brands.id, CASCADE on delete)
- `managerId` (INT, Foreign Key → users.id, CASCADE on delete)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)
- Unique constraint on (`brandId`, `managerId`)

### 4. `users` Table Modification
- Added `brandId` (INT, Nullable, Foreign Key → brands.id, SET NULL on delete)
- **Important:** This is the ONLY existing table that gets modified. All other existing tables (leads, campaigns, orders, notes, etc.) remain unchanged.

## Brand-Related Permissions

The following permissions will be synced:

- `brand:create` - Create new brands
- `brand:get` - View brands
- `brand:update` - Update brands
- `brand:delete` - Delete brands
- `brand:assignUsers` - Assign users to brands
- `brand:removeUsers` - Remove users from brands
- `brand:assignManagers` - Assign managers to brands
- `brand:removeManagers` - Remove managers from brands

## How to Run the Sync Script

### Prerequisites

1. Ensure your `.env` file has correct database credentials:
   ```
   DB_HOST=your_host
   DB_NAME=your_database
   DB_USER=your_username
   DB_PASS=your_password
   DB_DIALECT=mysql
   ```

2. Make sure you have Node.js and npm installed
3. Install dependencies: `npm install`

### Running the Script

**On your server, run:**

```bash
npx ts-node src/scripts/sync-brand-tables.ts
```

Or if you're in the project root:

```bash
cd /path/to/crmBackend
npx ts-node src/scripts/sync-brand-tables.ts
```

### Expected Output

You should see output like:

```
🚀 Starting brand-related database sync...

✅ Database connection established.

📋 Step 1: Checking users table for brandId column...
   ✓ brandId column already exists in users table.

📋 Step 2: Syncing all database tables...
   ✓ All tables synchronized (brands, brand_users, brand_managers).

📋 Step 3: Verifying brand-related tables exist...
   ✓ All brand-related tables exist:
      - brand_managers
      - brand_users
      - brands

📋 Step 4: Verifying brandId column in users table...
   ✓ brandId column verified: INT, nullable: YES

📋 Step 5: Syncing permissions (including brand permissions)...
   ✓ All 8 brand permissions verified:
      - brand:create
      - brand:get
      - brand:update
      - brand:delete
      - brand:assignUsers
      - brand:removeUsers
      - brand:assignManagers
      - brand:removeManagers

📋 Step 6: Verifying foreign key constraints...
   ✓ Found 6 foreign key constraint(s):
      - brand_users.brandId → brands.id
      - brand_users.userId → users.id
      - brand_managers.brandId → brands.id
      - brand_managers.managerId → users.id
      - users.brandId → brands.id

============================================================
✅ Brand-related database sync completed successfully!
============================================================

📊 Summary:
   ✓ Database connection established
   ✓ brandId column in users table
   ✓ brands table
   ✓ brand_users junction table
   ✓ brand_managers junction table
   ✓ Brand permissions synced

🎉 All brand-related changes have been applied to your database!

💡 Next steps:
   1. Verify your application can connect to the database
   2. Test brand creation and user assignment
   3. Verify permissions are assigned to appropriate roles
```

## Troubleshooting

### Error: "Cannot connect to database"
- Check your `.env` file has correct database credentials
- Ensure your database server is running
- Verify network connectivity to the database

### Error: "Table already exists"
- This is normal if you've run the script before
- The script will skip creating existing tables

### Error: "Permission denied"
- Ensure your database user has CREATE, ALTER, and INSERT permissions
- Check that you're using the correct database user credentials

### Error: "Constraint error"
- The script handles constraint errors gracefully
- If you see constraint warnings, they're usually non-critical
- The script will retry without `alter` mode if needed

## After Running the Sync

1. **Test the API endpoints:**
   - Create a brand: `POST /api/brands`
   - Get all brands: `GET /api/brands`
   - Assign users to brand: `POST /api/brands/:id/users`

2. **Assign permissions to roles:**
   - Use your admin panel or API to assign brand permissions to appropriate roles
   - Typically, admins should have all brand permissions
   - Managers might need `brand:get` and `brand:assignUsers`

3. **Verify data integrity:**
   - Check that existing users can still log in
   - Verify that new brand assignments work correctly

## Rollback (if needed)

If you need to rollback these changes:

```sql
-- Remove brand assignments
DROP TABLE IF EXISTS brand_managers;
DROP TABLE IF EXISTS brand_users;

-- Remove brands table
DROP TABLE IF EXISTS brands;

-- Remove brandId from users (optional - only if you want to completely remove)
ALTER TABLE users DROP COLUMN IF EXISTS brandId;
```

**⚠️ Warning:** Only run rollback if you're sure you want to remove all brand data!

## Support

If you encounter any issues:
1. Check the error message in the console output
2. Verify your database schema matches the expected structure
3. Ensure all model files are properly imported
4. Check that Sequelize associations are correctly defined
