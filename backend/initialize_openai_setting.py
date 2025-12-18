#!/usr/bin/env python3
"""
One-time script to initialize OpenAI API key setting in app_settings table
"""

import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import db

load_dotenv()

def initialize_openai_setting():
    """Initialize OPENAI_API_KEY in app_settings if it doesn't exist"""
    
    print("=" * 60)
    print("🔧 Initializing OpenAI API Key Setting")
    print("=" * 60)
    print()
    
    # Check if setting already exists
    print("1️⃣  Checking if OPENAI_API_KEY exists...")
    result = db.table("app_settings").select("*").eq("key", "OPENAI_API_KEY").execute()
    
    if result.data and len(result.data) > 0:
        print("   ✅ OPENAI_API_KEY already exists")
        print(f"   Current value: {'*' * 20}{result.data[0]['value'][-4:] if result.data[0].get('value') else 'Not set'}")
        print()
        print("   To update the key, use the Settings page in the app.")
        return
    
    print("   ⚠️  OPENAI_API_KEY not found, creating...")
    print()
    
    # Create the setting with empty value
    print("2️⃣  Creating OPENAI_API_KEY setting...")
    try:
        db.table("app_settings").insert({
            "key": "OPENAI_API_KEY",
            "value": "",
            "description": "OpenAI API key for AI reports and chat features"
        }).execute()
        
        print("   ✅ Created OPENAI_API_KEY setting")
        print()
        print("=" * 60)
        print("✅ Initialization Complete!")
        print()
        print("📝 Next Steps:")
        print("   1. Go to Settings page in the app")
        print("   2. Click 'API Keys' tab")
        print("   3. Find 'OpenAI Integration' section")
        print("   4. Click edit on OPENAI_API_KEY")
        print("   5. Enter your OpenAI API key")
        print("   6. Click Save")
        print("=" * 60)
        
    except Exception as e:
        print(f"   ❌ Failed to create setting: {e}")

if __name__ == "__main__":
    initialize_openai_setting()
