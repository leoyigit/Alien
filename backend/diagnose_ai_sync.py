#!/usr/bin/env python3
"""
Diagnostic script to check OpenAI API configuration and identify AI sync issues.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db
from app.services import openai_service
from openai import OpenAI

def check_openai_api_key():
    """Check if OpenAI API key is configured."""
    print("\n🔍 Checking OpenAI API Key Configuration...")
    print("=" * 60)
    
    try:
        result = db.table("app_settings").select("value").eq("key", "OPENAI_API_KEY").execute()
        
        if not result.data:
            print("❌ OPENAI_API_KEY not found in app_settings table")
            print("\n💡 Solution:")
            print("   1. Go to Settings page in the app")
            print("   2. Find 'OPENAI_API_KEY' setting")
            print("   3. Enter your OpenAI API key (starts with 'sk-')")
            return False
        
        api_key = result.data[0].get('value')
        
        if not api_key or api_key.strip() == '':
            print("❌ OPENAI_API_KEY is empty")
            print("\n💡 Solution:")
            print("   1. Go to Settings page in the app")
            print("   2. Find 'OPENAI_API_KEY' setting")
            print("   3. Enter your OpenAI API key (starts with 'sk-')")
            return False
        
        # Mask the key for security
        masked_key = api_key[:7] + "..." + api_key[-4:] if len(api_key) > 11 else "***"
        print(f"✅ OPENAI_API_KEY found: {masked_key}")
        
        # Test the API key
        print("\n🧪 Testing API Key...")
        try:
            client = OpenAI(api_key=api_key)
            # Try to list models to verify the key works
            models = client.models.list()
            print("✅ API Key is valid and working!")
            return True
        except Exception as e:
            print(f"❌ API Key test failed: {e}")
            print("\n💡 Solution:")
            print("   1. Verify your API key is correct")
            print("   2. Check if your OpenAI account has credits")
            print("   3. Visit https://platform.openai.com/api-keys")
            return False
            
    except Exception as e:
        print(f"❌ Error checking API key: {e}")
        return False


def check_projects():
    """Check projects and their AI initialization status."""
    print("\n📊 Checking Projects...")
    print("=" * 60)
    
    try:
        projects = db.table("projects").select("*").execute()
        
        if not projects.data:
            print("⚠️  No projects found")
            return
        
        total = len(projects.data)
        initialized = 0
        not_initialized = 0
        missing_channels = 0
        
        print(f"\nTotal Projects: {total}\n")
        
        for project in projects.data:
            has_internal_assistant = bool(project.get('internal_assistant_id'))
            has_internal_channel = bool(project.get('channel_id_internal'))
            has_external_channel = bool(project.get('channel_id_external'))
            
            if has_internal_assistant:
                initialized += 1
                status = "✅ Initialized"
            else:
                not_initialized += 1
                status = "❌ Not Initialized"
            
            if not has_internal_channel and not has_external_channel:
                missing_channels += 1
                channel_status = "⚠️  No channels"
            elif not has_internal_channel:
                channel_status = "⚠️  Missing internal"
            elif not has_external_channel:
                channel_status = "⚠️  Missing external"
            else:
                channel_status = "✅ Both channels"
            
            print(f"{project['client_name'][:30]:30} | {status:20} | {channel_status}")
        
        print("\n" + "=" * 60)
        print(f"Summary:")
        print(f"  ✅ Initialized:     {initialized}")
        print(f"  ❌ Not Initialized: {not_initialized}")
        print(f"  ⚠️  Missing Channels: {missing_channels}")
        
    except Exception as e:
        print(f"❌ Error checking projects: {e}")


def check_recent_sync_errors():
    """Check recent activity logs for sync errors."""
    print("\n📝 Checking Recent Sync Errors...")
    print("=" * 60)
    
    try:
        # Get recent AI sync errors
        errors = db.table("activity_logs")\
            .select("*")\
            .eq("action_type", "sync_ai_global")\
            .eq("status", "error")\
            .order("created_at", desc=True)\
            .limit(5)\
            .execute()
        
        if not errors.data:
            print("✅ No recent AI sync errors found")
            return
        
        print(f"\nFound {len(errors.data)} recent error(s):\n")
        
        for error in errors.data:
            print(f"Time: {error.get('created_at')}")
            print(f"User: {error.get('user_name')}")
            print(f"Error: {error.get('error_message', 'No message')}")
            print(f"Details: {error.get('details', {})}")
            print("-" * 60)
            
    except Exception as e:
        print(f"❌ Error checking logs: {e}")


def main():
    """Run all diagnostic checks."""
    print("\n" + "=" * 60)
    print("🔧 AI SYNC DIAGNOSTIC TOOL")
    print("=" * 60)
    
    # Check 1: OpenAI API Key
    api_key_ok = check_openai_api_key()
    
    # Check 2: Projects
    check_projects()
    
    # Check 3: Recent Errors
    check_recent_sync_errors()
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    
    if not api_key_ok:
        print("\n🚨 CRITICAL ISSUE: OpenAI API Key is not configured or invalid")
        print("   This is why all 28 AI syncs are failing!")
        print("\n   Fix this first before running Global Sync again.")
    else:
        print("\n✅ OpenAI API Key is configured correctly")
        print("   The sync failures might be due to:")
        print("   - Rate limiting (too many projects at once)")
        print("   - Projects missing Slack channels")
        print("   - Network issues")
        print("\n   Check the project list above for details.")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
