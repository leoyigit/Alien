
from slack_sdk import WebClient
from app.core.config import settings
import json

slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)

def debug_message_structure():
    mailbox_channel_id = "C0A16GEAPD5"
    # TS from previous log output: 1768559815.897989
    ts = "1768559815.897989"
    
    print(f"Fetching raw message {ts}...")
    try:
        res = slack_client.conversations_history(
            channel=mailbox_channel_id,
            latest=ts,
            inclusive=True,
            limit=1
        )
        messages = res.get('messages', [])
        if messages:
            print(json.dumps(messages[0], indent=2))
        else:
            print("Message not found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_message_structure()
