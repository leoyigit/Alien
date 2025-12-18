#!/usr/bin/env python3
"""Debug script to see what's actually in the Mailbox messages"""
import os
from dotenv import load_dotenv
from slack_sdk import WebClient
import json

load_dotenv()
slack = WebClient(token=os.getenv('SLACK_BOT_TOKEN'))
MAILBOX_CHANNEL = "C0A16GEAPD5"

# Fetch first message
response = slack.conversations_history(channel=MAILBOX_CHANNEL, limit=5)
messages = response['messages']

print("=" * 60)
print(f"Found {len(messages)} messages in Mailbox channel")
print("=" * 60)

for i, msg in enumerate(messages, 1):
    print(f"\nMessage {i}:")
    print(f"  Timestamp: {msg.get('ts')}")
    print(f"  Bot ID: {msg.get('bot_id')}")
    print(f"  Subtype: {msg.get('subtype')}")
    print(f"  Text: {msg.get('text', 'NONE')[:100]}")
    print(f"  Files: {len(msg.get('files', []))} files")
    
    if msg.get('files'):
        for j, file in enumerate(msg['files'], 1):
            print(f"\n    File {j}:")
            print(f"      Name: {file.get('name')}")
            print(f"      Type: {file.get('mimetype')}")
            print(f"      Has preview: {bool(file.get('preview'))}")
            print(f"      Has plain_text: {bool(file.get('plain_text'))}")
            print(f"      Has url_private: {bool(file.get('url_private'))}")
            print(f"      Keys: {list(file.keys())[:10]}")
    
    print("\n" + "-" * 60)
