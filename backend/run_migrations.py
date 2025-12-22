#!/usr/bin/env python3
"""
Migration runner for Alien Portal database.
Applies SQL migrations in order and tracks which ones have been applied.
"""
import os
import sys
from pathlib import Path
from app.core.supabase import db
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def create_migrations_table():
    """Create a table to track applied migrations."""
    try:
        # Check if table exists by trying to query it
        db.table("applied_migrations").select("id").limit(1).execute()
        print("✓ Migrations tracking table already exists")
    except Exception:
        # Table doesn't exist, create it via SQL
        print("Creating migrations tracking table...")
        sql = """
        CREATE TABLE IF NOT EXISTS applied_migrations (
            id SERIAL PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
        try:
            db.rpc("exec_sql", {"sql": sql}).execute()
            print("✓ Created applied_migrations table")
        except Exception as e:
            print(f"⚠️  Could not create migrations table via RPC: {e}")
            print("Please create it manually in Supabase SQL Editor:")
            print(sql)
            return False
    return True


def get_applied_migrations():
    """Get list of already applied migrations."""
    try:
        result = db.table("applied_migrations").select("migration_name").execute()
        return {row['migration_name'] for row in result.data}
    except Exception as e:
        print(f"⚠️  Could not fetch applied migrations: {e}")
        return set()


def get_pending_migrations(applied):
    """Get list of SQL files that haven't been applied yet."""
    if not MIGRATIONS_DIR.exists():
        print(f"❌ Migrations directory not found: {MIGRATIONS_DIR}")
        return []
    
    all_migrations = sorted([
        f for f in MIGRATIONS_DIR.glob("*.sql")
        if not f.name.startswith("_")
    ])
    
    pending = [m for m in all_migrations if m.name not in applied]
    return pending


def apply_migration(migration_file):
    """Apply a single migration file."""
    print(f"\n📄 Applying: {migration_file.name}")
    
    try:
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        # Note: Supabase Python client doesn't support raw SQL execution
        # You'll need to run these manually in Supabase SQL Editor
        print(f"⚠️  Please run this migration manually in Supabase SQL Editor:")
        print(f"   File: {migration_file}")
        print(f"   Or copy the SQL and execute it in the Supabase dashboard")
        
        # Mark as applied (you'll need to do this manually too)
        # db.table("applied_migrations").insert({"migration_name": migration_file.name}).execute()
        
        return False  # Return False to indicate manual action needed
        
    except Exception as e:
        print(f"❌ Error reading migration: {e}")
        return False


def list_migrations():
    """List all migrations and their status."""
    applied = get_applied_migrations()
    all_migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
    
    print("\n" + "="*60)
    print("MIGRATION STATUS")
    print("="*60)
    
    for migration in all_migrations:
        status = "✓ Applied" if migration.name in applied else "⏳ Pending"
        print(f"{status:12} {migration.name}")
    
    print("="*60)
    print(f"Total: {len(all_migrations)} migrations")
    print(f"Applied: {len(applied)}")
    print(f"Pending: {len(all_migrations) - len(applied)}")
    print("="*60 + "\n")


def main():
    """Main migration runner."""
    print("\n🚀 Alien Portal Migration Runner\n")
    
    # Check if migrations directory exists
    if not MIGRATIONS_DIR.exists():
        print(f"❌ Migrations directory not found: {MIGRATIONS_DIR}")
        sys.exit(1)
    
    # List all migrations
    list_migrations()
    
    print("\n" + "="*60)
    print("IMPORTANT: MANUAL MIGRATION REQUIRED")
    print("="*60)
    print("\nThe Supabase Python client doesn't support raw SQL execution.")
    print("Please apply migrations manually:")
    print("\n1. Go to your Supabase Dashboard")
    print("2. Navigate to SQL Editor")
    print("3. Copy and paste the SQL from each pending migration file")
    print("4. Execute them in order (by filename number)")
    print("\nPending migrations are in:")
    print(f"  {MIGRATIONS_DIR.absolute()}")
    print("\n" + "="*60 + "\n")
    
    # Show the most important pending migration
    applied = get_applied_migrations()
    pending = get_pending_migrations(applied)
    
    if pending:
        print("\n🔥 PRIORITY: Apply this migration first to fix AI sync:")
        print(f"   {pending[-1].name}")  # Show the latest migration
        print(f"   Location: {pending[-1].absolute()}")
        print("\n")


if __name__ == "__main__":
    main()
