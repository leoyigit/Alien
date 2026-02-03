
from slack_sdk import WebClient
from app.core.config import settings
from app.core.supabase import db

# Initialize shared client
slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)

def resolve_slack_user_name(user_id: str) -> str:
    """
    Resolves a Slack User ID to a Real Name.
    
    Strategy:
    1. Check 'contacts' table (synced from HubSpot/manual).
    2. Check 'slack_users' table (cache).
    3. Fetch from Slack API and cache it.
    
    Args:
        user_id: Slack User ID (e.g. U01234567)
        
    Returns:
        Real Name (str) or "Unknown User" or original ID if lookup fails.
    """
    if not user_id or not str(user_id).startswith("U"):
        return user_id or "Unknown"

    try:
        # 1. Check Contacts (Best source for external stakeholders)
        contact = db.table("contacts").select("name, company").eq("slack_user_id", user_id).execute()
        if contact.data:
            c = contact.data[0]
            if c.get('company'):
                return f"{c['name']} ({c['company']})"
            return c['name']

        # 2. Check Cache (slack_users table)
        existing = db.table("slack_users").select("real_name").eq("slack_id", user_id).execute()
        if existing.data:
            return existing.data[0]["real_name"]

        # 3. Fetch from Slack
        user_info = slack_client.users_info(user=user_id)
        user = user_info["user"]
        
        # Priority: Real Name > Display Name > "Unknown"
        real_name = user.get("real_name") or user.get("profile", {}).get("real_name") or user.get("name") or "Unknown"
        profile = user.get("profile", {})
        email = profile.get("email", "")
        avatar = profile.get("image_48", "")

        # Auto-Classify Role
        role = "external"
        if email and ("flyrank.com" in email or "powercommerce.com" in email):
            role = "internal"

        # 4. Save to Database
        db.table("slack_users").upsert({
            "slack_id": user_id,
            "real_name": real_name,
            "email": email,
            "avatar_url": avatar,
            "user_type": role
        }).execute()
        
        print(f"👤 Resolved Slack User: {real_name} ({role})")
        return real_name

    except Exception as e:
        print(f"⚠️ Could not resolve slack user {user_id}: {e}")
        return user_id # Fallback to ID so we don't lose info

def extract_message_content(msg: dict) -> str:
    """
    Extract text content from a Slack message object.
    Handles plain text, blocks, and attachments.
    """
    # 1. Plain Text
    text = msg.get("text", "")
    if text:
        return text

    # 2. Attachments (often used by bots/integrations)
    attachments = msg.get("attachments", [])
    if attachments:
        parts = []
        for att in attachments:
            # Try various attachment fields
            part = att.get("text") or att.get("fallback") or att.get("pretext")
            if part:
                parts.append(part)
        if parts:
            return "\n".join(parts)

    # 3. Blocks (Rich text)
    blocks = msg.get("blocks", [])
    if blocks:
        block_texts = []
        for block in blocks:
            # Simplify: just look for 'text' fields in sections/contexts
            if block.get("type") == "section":
                text_obj = block.get("text", {})
                if text_obj.get("text"):
                    block_texts.append(text_obj.get("text"))
            elif block.get("type") == "context":
                elements = block.get("elements", [])
                for el in elements:
                    if el.get("text"):
                        block_texts.append(el.get("text"))
        
        if block_texts:
            return "\n".join(block_texts)

    return ""
