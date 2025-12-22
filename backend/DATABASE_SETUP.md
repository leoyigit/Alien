# Database Setup Guide

## Quick Fix for AI Sync Error

If you're seeing the error: `Could not find the table 'public.emails'`, follow these steps:

### Step 1: Validate Your Database

Run the validation script to see what's missing:

```bash
cd backend
python setup_database.py
```

This will show you which tables exist and which are missing.

### Step 2: Apply the Emails Table Migration

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Run the Migration**
   - Open the file: `backend/migrations/025_create_emails_table.sql`
   - Copy the entire SQL content
   - Paste it into the Supabase SQL Editor
   - Click **Run**

3. **Verify**
   - Run `python setup_database.py` again
   - You should see `✓ emails` in the output

### Step 3: Test AI Sync

Now try your AI sync again. It should work without the table error.

```bash
python test_project_sync.py
```

## For Future Projects

### Checking Database Status

Always run this before syncing:

```bash
python backend/setup_database.py
```

### Viewing All Migrations

To see which migrations are pending:

```bash
python backend/run_migrations.py
```

### Applying Migrations

**Important**: The Supabase Python client doesn't support raw SQL execution, so migrations must be applied manually:

1. Go to Supabase Dashboard → SQL Editor
2. Open migration files from `backend/migrations/`
3. Copy and paste the SQL
4. Execute in numerical order (001, 002, 003, etc.)

## Migration Files

All migrations are in: `backend/migrations/`

Key migrations for AI sync:
- `023_add_pm_email_vector_stores.sql` - Adds vector store columns
- `025_create_emails_table.sql` - **Creates the emails table** (required!)

## Troubleshooting

### "Could not find the table 'public.emails'"

**Solution**: Apply migration `025_create_emails_table.sql`

### "Warning: Could not fetch emails for project..."

This is now a soft error. The sync will continue without emails if the table doesn't exist. Check the console output for hints.

### Other Missing Tables

Run `python setup_database.py` to see all missing tables, then apply the corresponding migrations from the `migrations/` directory.

## Database Schema

### Required Tables for AI Sync

- `projects` - Core project data
- `report_history` - PM notes and updates
- `emails` - Email communications (NEW!)
- `communication_logs` - Slack and email logs
- `activity_logs` - Sync activity tracking

### Email Table Structure

```sql
CREATE TABLE emails (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    from_email TEXT NOT NULL,
    to_email TEXT,
    subject TEXT,
    body TEXT,
    sent_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Next Steps

After fixing the database:

1. ✅ Run `python setup_database.py` to validate
2. ✅ Test AI sync with `python test_project_sync.py`
3. ✅ Check activity logs in the admin panel
4. ✅ Verify vector stores are created in OpenAI dashboard

---

**Need help?** Check the implementation plan for more details or run the validation script for specific guidance.
