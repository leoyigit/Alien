# backend/app/api/webhooks.py
import os
from flask import Blueprint, request, jsonify
from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler
from app.core.config import settings
from app.core.supabase import db

# Initialize Bolt
bolt_app = App(token=settings.SLACK_BOT_TOKEN, signing_secret=os.environ.get("SLACK_SIGNING_SECRET"))
handler = SlackRequestHandler(bolt_app)
webhooks = Blueprint('webhooks', __name__)

# --- SECURITY: LOAD ADMIN IDS ---
# specific users who are allowed to use commands
ALLOWED_USERS = os.environ.get("SLACK_ADMIN_IDS", "").split(",")

# --- HELPERS ---
def find_project_by_channel(channel_id):
    """Find which project this channel belongs to"""
    res = db.table("projects").select("id, client_name") \
        .or_(f"channel_id_internal.eq.{channel_id},channel_id_external.eq.{channel_id}") \
        .execute()
    return res.data[0] if res.data else None

# --- EVENT LISTENERS ---

@bolt_app.event("message")
def handle_message(event, say):
    """
    PASSIVE LISTENER:
    Logs all messages to the database so the Dashboard works.
    Does NOT reply to the user.
    
    ALSO handles emails from Mailbox channel (C0A16GEAPD5).
    """
    print(f"🔔 MESSAGE EVENT RECEIVED: {event.get('channel')} - subtype: {event.get('subtype')}")
    
    channel_id = event.get("channel")
    text = event.get("text", "")
    ts = event.get("ts")
    thread_ts = event.get("thread_ts") 
    user = event.get("user")
    subtype = event.get("subtype")
    bot_id = event.get("bot_id")

    # --- EMAIL DETECTION (Mailbox Channel) ---
    MAILBOX_CHANNEL = "C0A16GEAPD5"
    
    if channel_id == MAILBOX_CHANNEL and bot_id:
        print(f"📧 Potential email in Mailbox channel - bot_id: {bot_id}")
        # This is likely an email message posted by alien-mail bot
        try:
            from app.utils.email_parser import (
                parse_slack_email, 
                match_project_by_email,
                match_project_by_domain,
                match_project_by_name,
                extract_domain
            )
            
            email_data = parse_slack_email(text)
            
            if email_data and email_data['from_email']:
                print(f"📧 Email detected from: {email_data['from_name']} <{email_data['from_email']}>")
                print(f"   Subject: {email_data['subject']}")
                
                # Get all projects for matching
                all_projects_res = db.table("projects").select("*").execute()
                all_projects = all_projects_res.data if all_projects_res.data else []
                
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
                
                # 3. Try matching by client name in subject/body
                if not matched_project:
                    matched_project = match_project_by_name(
                        email_data['subject'], 
                        email_data['body'], 
                        all_projects
                    )
                    if matched_project:
                        print(f"   ✅ Matched by name search")
                
                # 4. Store email in communication_logs
                if matched_project:
                    db.table("communication_logs").insert({
                        "project_id": matched_project["id"],
                        "content": email_data['body'],
                        "sender_name": email_data['from_name'],
                        "sender_email": email_data['from_email'],
                        "subject": email_data['subject'],
                        "source": "email",
                        "slack_ts": ts,
                        "thread_ts": thread_ts,
                        "visibility": "external",
                        "message_timestamp": ts
                    }).execute()
                    print(f"   💾 Stored email for project: {matched_project['client_name']}")
                else:
                    print(f"   ⚠️  No project match found - email not stored")
                    # TODO: Post to internal channel for manual tagging
                
                return  # Email handled, don't process as regular message
                
        except Exception as e:
            print(f"❌ Email parsing error: {e}")
            import traceback
            traceback.print_exc()
            # Fall through to regular message handling
    
    # --- REGULAR MESSAGE HANDLING ---
    
    # 1. Ignore bot messages and file notifications
    if subtype in ["bot_message", "file_share", "thread_broadcast"]: 
        print(f"⏭️  Ignoring message with subtype: {subtype}")
        return

    # 2. Find Project
    project = find_project_by_channel(channel_id)
    if not project:
        print(f"❓ No project mapped to channel: {channel_id}")
        return # Ignore unmapped channels

    # 3. Save to Supabase (History Log)
    try:
        db.table("communication_logs").insert({
            "project_id": project["id"],
            "content": text,
            "sender_name": user, # In a real app, we'd fetch the user's real name here
            "source": "slack",
            "slack_ts": ts,
            "thread_ts": thread_ts,
            "visibility": "internal"
        }).execute()
        # Note: We print here for debugging, but we DO NOT reply to Slack.
        print(f"📥 Logged message from {project['client_name']}")
    except Exception as e:
        print(f"❌ Save Error: {e}")

@bolt_app.event("app_mention")
def handle_mention(event, say):
    """
    ACTIVE COMMANDS (@Alien do something):
    ❌ BLOCKED for normal users.
    ✅ ALLOWED for Admins only.
    """
    user = event.get("user")
    text = event.get("text")

    # 1. SECURITY CHECK
    if user not in ALLOWED_USERS:
        print(f"🛑 Blocked unauthorized command from user {user}")
        return # IGNORE them completely (Ghosting is safer than replying "Access Denied")

    # 2. ADMIN ONLY LOGIC
    # This is where your Q&A logic will go later!
    say(f"👋 Hello Admin! I am ready to work. You said: {text}")

@bolt_app.event("reaction_added")
def handle_reaction(event):
    """Capture Emojis (e.g. ✅)"""
    item = event.get("item", {})
    ts = item.get("ts")
    reaction = event.get("reaction")

    # 1. Check if we have this message in DB
    res = db.table("communication_logs").select("reactions, id").eq("slack_ts", ts).execute()
    
    if res.data:
        log_entry = res.data[0]
        current_reactions = log_entry.get("reactions") or []
        
        # 2. Add emoji
        current_reactions.append({"emoji": reaction, "user": event.get("user")})
        
        # 3. Update DB
        db.table("communication_logs").update({
            "reactions": current_reactions
        }).eq("id", log_entry["id"]).execute()
        print(f"✅ Reaction '{reaction}' recorded")

# --- FLASK ROUTE ---
@webhooks.route("/slack/events", methods=["POST"])
def slack_events():
    print(f"🌐 WEBHOOK CALLED: /slack/events")
    return handler.handle(request)