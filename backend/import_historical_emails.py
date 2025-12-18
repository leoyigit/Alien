#!/usr/bin/env python3
"""
One-time script to import historical emails from Slack Mailbox channel.
Run this once to import all existing emails that were posted before the webhook was set up.

Usage: python import_historical_emails.py
"""

import os
import sys
from dotenv import load_dotenv
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# Add parent directory to path to import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import db
from app.utils.email_parser import (
    parse_slack_email,
    match_project_by_email,
    match_project_by_domain,
    match_project_by_name,
    extract_domain
)

# Load environment variables
load_dotenv()

# Initialize Slack client
slack = WebClient(token=os.getenv('SLACK_BOT_TOKEN'))
MAILBOX_CHANNEL = "C0A16GEAPD5"

def fetch_all_channel_messages(channel_id, limit=1000):
    """Fetch all messages from a Slack channel."""
    messages = []
    cursor = None
    
    print(f"📥 Fetching messages from channel {channel_id}...")
    
    try:
        while True:
            response = slack.conversations_history(
                channel=channel_id,
                limit=200,
                cursor=cursor
            )
            
            messages.extend(response['messages'])
            print(f"   Fetched {len(messages)} messages so far...")
            
            if not response.get('has_more'):
                break
                
            cursor = response.get('response_metadata', {}).get('next_cursor')
            
            if len(messages) >= limit:
                print(f"   Reached limit of {limit} messages")
                break
                
        print(f"✅ Total messages fetched: {len(messages)}")
        return messages
        
    except SlackApiError as e:
        print(f"❌ Error fetching messages: {e}")
        return []

def get_all_projects():
    """Fetch all projects from database."""
    try:
        result = db.table("projects").select("*").execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"❌ Error fetching projects: {e}")
        return []

def import_email_message(message, all_projects):
    """Import a single email message."""
    ts = message.get('ts')
    bot_id = message.get('bot_id')
    subtype = message.get('subtype')
    
    # Skip non-bot messages
    if not bot_id:
        return False
    
    # Get text from message or file
    text = message.get('text', '')
    files = message.get('files', [])
    
    # If message has file attachments (emails come this way)
    if files:
        print(f"   📎 Found {len(files)} file(s)")
        for file in files:
            file_name = file.get('name', '')
            print(f"      File: {file_name}")
            
            # Try plain_text first, then preview
            file_content = file.get('plain_text', '') or file.get('preview', '')
            
            # If still no content, try downloading
            if not file_content and file.get('url_private'):
                try:
                    import requests
                    headers = {'Authorization': f'Bearer {os.getenv("SLACK_BOT_TOKEN")}'}
                    response = requests.get(file['url_private'], headers=headers)
                    if response.status_code == 200:
                        file_content = response.text
                        print(f"      ✅ Downloaded {len(file_content)} chars")
                    else:
                        print(f"      ⚠️  Download failed: {response.status_code}")
                except Exception as e:
                    print(f"      ⚠️  Download error: {e}")
            
            if file_content:
                text = file_content
                print(f"      ✅ Using file content ({len(text)} chars)")
                break
    
    if not text:
        print(f"   ⏭️  Skipping message (no text): {ts}")
        return False
    
    try:
        # Parse email
        email_data = parse_slack_email(text)
        
        if not email_data or not email_data['from_email']:
            print(f"   ⏭️  Skipping (not an email): {ts}")
            return False
        
        print(f"\n📧 Email from: {email_data['from_name']} <{email_data['from_email']}>")
        print(f"   Subject: {email_data['subject']}")
        
        # Try to match project
        matched_project = None
        
        # 1. Try matching by stakeholder email
        for email in email_data['to_emails'] + email_data['cc_emails'] + [email_data['from_email']]:
            matched_project = match_project_by_email(email, all_projects)
            if matched_project:
                print(f"   ✅ Matched by email: {email}")
                break
        
        # 2. Try matching by domain
        if not matched_project:
            matched_project = match_project_by_domain(email_data['from_email'], all_projects)
            if matched_project:
                print(f"   ✅ Matched by domain: {extract_domain(email_data['from_email'])}")
        
        # 3. Try matching by client name
        if not matched_project:
            matched_project = match_project_by_name(
                email_data['subject'],
                email_data['body'],
                all_projects
            )
            if matched_project:
                print(f"   ✅ Matched by name search")
        
        # Store email
        if matched_project:
            # Check if already exists
            existing = db.table("communication_logs").select("id").eq("slack_ts", ts).execute()
            
            if existing.data:
                print(f"   ⏭️  Already exists in database")
                return False
            
            db.table("communication_logs").insert({
                "project_id": matched_project["id"],
                "content": email_data['body'],
                "sender_name": email_data['from_name'],
                "sender_email": email_data['from_email'],
                "subject": email_data['subject'],
                "source": "email",
                "slack_ts": ts,
                "thread_ts": message.get('thread_ts'),
                "visibility": "external"
            }).execute()
            
            print(f"   💾 Stored for project: {matched_project['client_name']}")
            return True
        else:
            print(f"   ⚠️  No project match found")
            return False
            
    except Exception as e:
        print(f"   ❌ Error processing email: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main import function."""
    print("=" * 60)
    print("📧 Historical Email Import Script")
    print("=" * 60)
    print()
    
    # Fetch all projects
    print("1️⃣  Fetching all projects...")
    all_projects = get_all_projects()
    print(f"   Found {len(all_projects)} projects")
    print()
    
    # Fetch all messages from Mailbox channel
    print("2️⃣  Fetching messages from Mailbox channel...")
    messages = fetch_all_channel_messages(MAILBOX_CHANNEL)
    print()
    
    # Filter for bot messages (potential emails)
    bot_messages = [m for m in messages if m.get('bot_id')]
    print(f"3️⃣  Found {len(bot_messages)} bot messages (potential emails)")
    print()
    
    # Process each message
    print("4️⃣  Processing emails...")
    imported_count = 0
    
    for i, message in enumerate(bot_messages, 1):
        print(f"\n[{i}/{len(bot_messages)}]", end=" ")
        if import_email_message(message, all_projects):
            imported_count += 1
    
    # Summary
    print()
    print("=" * 60)
    print(f"✅ Import Complete!")
    print(f"   Total emails imported: {imported_count}")
    print(f"   Total messages scanned: {len(messages)}")
    print(f"   Bot messages found: {len(bot_messages)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
