import os
from dotenv import load_dotenv
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from supabase import create_client

# Load your .env file
load_dotenv()

def test_system():
    print("--- 👽 ALIEN SYSTEM DIAGNOSTICS ---")
    
    # 1. CHECK SLACK
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        print("❌ Slack Token missing in .env")
        return

    print(f"\n1. Testing Slack (Token: {token[:10]}...)")
    client = WebClient(token=token)
    
    try:
        # Try to list 1 channel to see if permissions work
        res = client.conversations_list(limit=1, types="public_channel")
        print("✅ Slack Connection: SUCCESS")
        print(f"   Found channel: #{res['channels'][0]['name']}")
    except SlackApiError as e:
        print(f"❌ Slack Error: {e.response['error']}")
        if e.response['error'] == 'missing_scope':
            print("   👉 CAUSE: You are missing 'channels:read' scope.")
            print("   👉 FIX: Add scope on api.slack.com AND click 'Reinstall to Workspace'.")
    except Exception as e:
        print(f"❌ Slack System Error: {e}")

    # 2. CHECK SUPABASE
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    print(f"\n2. Testing Supabase...")
    if not url or not key:
        print("❌ Supabase Credentials missing in .env")
        return

    try:
        sb = create_client(url, key)
        # Try to read the table that might be missing
        sb.table("ignored_channels").select("*").limit(1).execute()
        print("✅ Supabase 'ignored_channels' table: FOUND")
        
        sb.table("projects").select("*").limit(1).execute()
        print("✅ Supabase 'projects' table: FOUND")
        
    except Exception as e:
        print(f"❌ Supabase Error: {str(e)}")
        if "relation" in str(e) and "does not exist" in str(e):
            print("   👉 CAUSE: You forgot to create the table in Supabase SQL Editor.")

if __name__ == "__main__":
    test_system()