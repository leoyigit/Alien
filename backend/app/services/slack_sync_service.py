# backend/app/services/slack_sync_service.py
"""
Slack message sync service for AI vector stores.
Fetches messages from Slack channels and formats them for OpenAI.
"""
from slack_sdk import WebClient
from app.core.config import settings
from app.core.supabase import db
from typing import List, Dict
from datetime import datetime, timedelta

slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)


def fetch_channel_messages(channel_id: str, last_sync: str = None) -> List[Dict]:
    """
    Fetch messages from a Slack channel.
    
    Args:
        channel_id: Slack channel ID
        last_sync: ISO timestamp of last sync. If None, fetches ALL messages from beginning.
        
    Returns:
        List of formatted messages
    """
    # If last_sync provided, only fetch messages after that timestamp
    # Otherwise, fetch ALL messages from the beginning
    if last_sync:
        oldest = datetime.fromisoformat(last_sync.replace('Z', '+00:00')).timestamp()
    else:
        oldest = 0  # Fetch from the very beginning
    
    messages = []
    cursor = None
    
    while True:
        response = slack_client.conversations_history(
            channel=channel_id,
            oldest=oldest,
            cursor=cursor,
            limit=200
        )
        
        for msg in response['messages']:
            # Skip bot messages and system messages
            if msg.get('subtype') or msg.get('bot_id'):
                continue
            
            # Get user info
            user_id = msg.get('user')
            user_name = get_user_name(user_id) if user_id else 'Unknown'
            
            messages.append({
                'user': user_name,
                'text': msg.get('text', ''),
                'timestamp': datetime.fromtimestamp(float(msg['ts'])).isoformat(),
                'ts': msg['ts']
            })
        
        # Check if there are more messages
        if not response.get('has_more'):
            break
        cursor = response['response_metadata']['next_cursor']
    
    return messages


def get_user_name(user_id: str) -> str:
    """Get user's display name from contacts database or Slack."""
    # First try to get from contacts database
    try:
        contact = db.table("contacts").select("name, email, company").eq("slack_user_id", user_id).execute()
        if contact.data:
            c = contact.data[0]
            # Return name with company if available
            if c.get('company'):
                return f"{c['name']} ({c['company']})"
            return c['name']
    except:
        pass
    
    # Fallback to Slack API
    try:
        user_info = slack_client.users_info(user=user_id)
        return user_info['user']['real_name'] or user_info['user']['name']
    except:
        return f"User-{user_id}"


def sync_internal_channel(project_id: str) -> List[Dict]:
    """
    Fetch messages from project's internal Slack channel.
    Uses last_sync_internal timestamp for incremental sync.
    
    Args:
        project_id: Project ID
        
    Returns:
        List of formatted messages
    """
    project = db.table("projects").select("channel_id_internal, last_sync_internal").eq("id", project_id).execute()
    if not project.data:
        raise ValueError(f"Project {project_id} not found")
    
    channel_id = project.data[0].get('channel_id_internal')
    if not channel_id:
        return []
    
    # Pass last_sync to fetch only new messages (or all if None)
    last_sync = project.data[0].get('last_sync_internal')
    return fetch_channel_messages(channel_id, last_sync)


def sync_external_channel(project_id: str) -> List[Dict]:
    """
    Fetch messages from project's external Slack channel.
    Uses last_sync_external timestamp for incremental sync.
    
    Args:
        project_id: Project ID
        
    Returns:
        List of formatted messages
    """
    project = db.table("projects").select("channel_id_external, last_sync_external").eq("id", project_id).execute()
    if not project.data:
        raise ValueError(f"Project {project_id} not found")
    
    channel_id = project.data[0].get('channel_id_external')
    if not channel_id:
        return []
    
    # Pass last_sync to fetch only new messages (or all if None)
    last_sync = project.data[0].get('last_sync_external')
    return fetch_channel_messages(channel_id, last_sync)
