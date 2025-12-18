#!/usr/bin/env python3
"""
Database Cleaning Script for Alien Project
Run this to clear Supabase tables for a fresh sync.

Usage:
    python clean_database.py         # Interactive mode
    python clean_database.py --all   # Clear all data (communication_logs only by default)
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sys.exit(1)

db = create_client(url, key)

def get_table_count(table_name: str) -> int:
    """Get the row count for a table."""
    try:
        result = db.table(table_name).select("*", count="exact").limit(0).execute()
        return result.count or 0
    except Exception as e:
        print(f"⚠️ Could not count {table_name}: {e}")
        return 0

def clear_table(table_name: str) -> bool:
    """Clear all rows from a table."""
    try:
        # Supabase doesn't have TRUNCATE via API, so we delete all rows
        # Use 'id is not null' to match all rows (works with UUID)
        db.table(table_name).delete().not_.is_("id", "null").execute()
        print(f"✅ Cleared table: {table_name}")
        return True
    except Exception as e:
        print(f"❌ Error clearing {table_name}: {e}")
        return False

def main():
    print("\n🧹 ALIEN DATABASE CLEANER")
    print("=" * 40)
    
    # Show current state
    tables = {
        "communication_logs": "Slack messages & threads",
        "slack_users": "Cached Slack user info",
        "projects": "Project/client mappings",
        "ignored_channels": "Ignored Slack channels"
    }
    
    print("\n📊 Current Database State:")
    for table, desc in tables.items():
        count = get_table_count(table)
        print(f"   • {table}: {count} rows ({desc})")
    
    print("\n" + "=" * 40)
    print("🚨 CLEANING OPTIONS:")
    print("   1. Clear communication_logs only (RECOMMENDED for fresh sync)")
    print("   2. Clear communication_logs + slack_users")
    print("   3. Clear ALL tables (⚠️ includes projects & ignored_channels)")
    print("   4. Exit without changes")
    
    # Check for command line args
    if "--all" in sys.argv:
        choice = "1"
        print("\n⚡ Auto-selected option 1 (--all flag)")
    else:
        choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        print("\n🔄 Clearing communication_logs...")
        clear_table("communication_logs")
        
    elif choice == "2":
        print("\n🔄 Clearing communication_logs and slack_users...")
        clear_table("communication_logs")
        clear_table("slack_users")
        
    elif choice == "3":
        confirm = input("\n⚠️ This will clear ALL data including projects! Type 'YES' to confirm: ")
        if confirm == "YES":
            print("\n🔄 Clearing all tables...")
            clear_table("communication_logs")
            clear_table("slack_users")
            clear_table("projects")
            clear_table("ignored_channels")
        else:
            print("❌ Cancelled.")
            return
            
    elif choice == "4":
        print("👋 Exiting without changes.")
        return
    else:
        print("❌ Invalid choice.")
        return
    
    # Show final state
    print("\n📊 Final Database State:")
    for table, desc in tables.items():
        count = get_table_count(table)
        print(f"   • {table}: {count} rows")
    
    print("\n✅ Done! You can now run a fresh sync.")

if __name__ == "__main__":
    main()
