# URGENT FIX - Apply This Migration

## Problem Found

The order creation is failing with:
```
column "created_at" of relation "coupon_usage" does not exist
```

The `coupon_usage` table uses `used_at` (with DEFAULT NOW()), not `created_at`.

## Solution

The migration has been FIXED. The `coupon_usage` table will use its default timestamp.

## Apply the Migration NOW

### Option 1: Using Supabase Dashboard (RECOMMENDED)

1. Go to Supabase Dashboard → SQL Editor
2. Copy the ENTIRE contents of:
   `/backend/migrations/20260122_fix_coupon_usage_tracking.sql`
3. Paste and click "Run"

### Option 2: Using psql (if you have it installed)

```bash
psql YOUR_DATABASE_CONNECTION_STRING < backend/migrations/20260122_fix_coupon_usage_tracking.sql
```

### Option 3: Using DBeaver/pgAdmin

1. Connect to your database
2. Open the SQL file
3. Execute it

## After Migration

1. The coupon usage counter will work
2. Try placing an order again
3. It should succeed!

## Test

After applying:
1. Go to checkout
2. Apply coupon `VARH0`
3. Complete payment
4. Order should be created successfully
5. Check `coupons` table → `usage_count` should increment
6. Check `coupon_usage` table → new record should exist
