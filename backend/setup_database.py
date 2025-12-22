#!/usr/bin/env python3
"""
Database setup and validation script for Alien Portal.
Checks if all required tables exist and provides guidance.
"""
from app.core.supabase import db
from dotenv import load_dotenv
import sys

# Load environment variables
load_dotenv()

# Required tables for the application
REQUIRED_TABLES = [
    "portal_users",
    "app_settings",
    "projects",
    "report_history",
    "communication_logs",
    "contacts",
    "project_stakeholders",
    "activity_logs",
    "emails",  # Required for AI sync
    "unmatched_emails",
]


def check_table_exists(table_name):
    """Check if a table exists by trying to query it."""
    try:
        db.table(table_name).select("id").limit(1).execute()
        return True
    except Exception as e:
        # Check if error is about missing table
        if "does not exist" in str(e) or "could not find" in str(e).lower():
            return False
        # Other errors might mean table exists but has issues
        return True


def validate_database():
    """Validate that all required tables exist."""
    print("\n" + "="*60)
    print("🔍 ALIEN PORTAL DATABASE VALIDATION")
    print("="*60 + "\n")
    
    missing_tables = []
    existing_tables = []
    
    for table in REQUIRED_TABLES:
        exists = check_table_exists(table)
        status = "✓" if exists else "✗"
        print(f"{status} {table:30} {'EXISTS' if exists else 'MISSING'}")
        
        if exists:
            existing_tables.append(table)
        else:
            missing_tables.append(table)
    
    print("\n" + "="*60)
    print(f"Total Tables: {len(REQUIRED_TABLES)}")
    print(f"Existing: {len(existing_tables)}")
    print(f"Missing: {len(missing_tables)}")
    print("="*60 + "\n")
    
    if missing_tables:
        print("❌ DATABASE INCOMPLETE\n")
        print("Missing tables:")
        for table in missing_tables:
            print(f"  - {table}")
        
        print("\n" + "="*60)
        print("🔧 HOW TO FIX")
        print("="*60)
        
        if "emails" in missing_tables:
            print("\n🔥 PRIORITY: The 'emails' table is missing!")
            print("This is causing your AI sync to fail.\n")
            print("To fix:")
            print("1. Open Supabase Dashboard → SQL Editor")
            print("2. Run this migration file:")
            print("   backend/migrations/025_create_emails_table.sql")
            print("\nOr copy and paste the SQL from that file.\n")
        
        print("For other missing tables:")
        print("1. Check backend/migrations/ directory")
        print("2. Run migrations in numerical order")
        print("3. Use Supabase SQL Editor to execute them")
        print("\nRun: python backend/run_migrations.py")
        print("     to see all pending migrations\n")
        
        return False
    else:
        print("✅ DATABASE SETUP COMPLETE\n")
        print("All required tables exist!")
        print("Your database is ready for AI sync.\n")
        return True


def main():
    """Main validation function."""
    try:
        is_valid = validate_database()
        sys.exit(0 if is_valid else 1)
    except Exception as e:
        print(f"\n❌ Error connecting to database: {e}")
        print("\nPlease check your .env file:")
        print("  - SUPABASE_URL")
        print("  - SUPABASE_SERVICE_KEY")
        sys.exit(1)


if __name__ == "__main__":
    main()
