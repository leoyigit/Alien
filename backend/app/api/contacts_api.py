# backend/app/api/contacts_api.py
"""
Contacts API endpoints for managing team members and contacts.
Replaces team members JSON storage with proper database table.
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.core.supabase import db, admin_db
from datetime import datetime, timedelta
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from app.core.config import settings

contacts_api = Blueprint('contacts_api', __name__)


@contacts_api.route('', methods=['GET'])
@require_auth
def get_contacts():
    """
    Get all contacts.
    Accessible by all authenticated users.
    """
    try:
        result = db.table("contacts").select("*").order("name").execute()
        return jsonify(result.data or [])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contacts_api.route('', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def create_contact():
    """
    Create a new contact.
    """
    data = request.json
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({"error": "Name is required"}), 400
    
    try:
        contact = {
            "name": data.get('name'),
            "email": data.get('email'),
            "role": data.get('role', 'Internal'),
            "phone": data.get('phone'),
            "company": data.get('company'),
            "notes": data.get('notes')
        }
        
        result = db.table("contacts").insert(contact).execute()
        return jsonify(result.data[0]), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/<contact_id>', methods=['PUT'])
@require_auth
@require_role('superadmin', 'internal')
def update_contact(contact_id):
    """
    Update an existing contact.
    """
    data = request.json
    
    try:
        contact = {
            "name": data.get('name'),
            "email": data.get('email'),
            "role": data.get('role'),
            "phone": data.get('phone'),
            "company": data.get('company'),
            "notes": data.get('notes'),
            "slack_user_id": data.get('slack_user_id')
        }
        
        # Remove None values
        contact = {k: v for k, v in contact.items() if v is not None}
        
        result = db.table("contacts").update(contact).eq("id", contact_id).execute()
        
        if not result.data:
            return jsonify({"error": "Contact not found"}), 404
            
        return jsonify(result.data[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/<contact_id>', methods=['DELETE'])
@require_auth
@require_role('superadmin', 'internal')
def delete_contact(contact_id):
    """
    Delete a contact.
    """
    try:
        result = db.table("contacts").delete().eq("id", contact_id).execute()
        
        if not result.data:
            return jsonify({"error": "Contact not found"}), 404
            
        return jsonify({"success": True, "message": "Contact deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/sync-slack', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def sync_slack_ids():
    """
    Sync Slack user IDs with contacts by matching emails.
    Uses caching to avoid rate limits.
    """
    try:
        # Check if we have cached Slack users (less than 1 hour old)
        cache_result = admin_db.table("slack_users_cache").select("*").execute()
        cache_age = None
        
        if cache_result.data:
            # Check age of cache
            first_cached = cache_result.data[0].get('cached_at')
            if first_cached:
                cached_time = datetime.fromisoformat(first_cached.replace('Z', '+00:00'))
                cache_age = datetime.now(cached_time.tzinfo) - cached_time
        
        # Use cache if less than 1 hour old, otherwise fetch fresh
        if cache_result.data and cache_age and cache_age < timedelta(hours=1):
            print(f"[SYNC] Using cached Slack users ({len(cache_result.data)} users, {int(cache_age.total_seconds()/60)} min old)")
            slack_users = cache_result.data
        else:
            print("[SYNC] Fetching fresh Slack users from API")
            # Fetch from Slack API
            slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)
            
            try:
                slack_response = slack_client.users_list()
                slack_members = slack_response['members']
                
                # Clear old cache
                admin_db.table("slack_users_cache").delete().neq("user_id", "").execute()
                
                # Cache new data
                slack_users = []
                for member in slack_members:
                    if member.get('deleted') or member.get('is_bot'):
                        continue
                    
                    cache_entry = {
                        "user_id": member['id'],
                        "email": member.get('profile', {}).get('email'),
                        "name": member.get('name'),
                        "real_name": member.get('real_name'),
                        "profile_data": member.get('profile', {})
                    }
                    
                    admin_db.table("slack_users_cache").insert(cache_entry).execute()
                    slack_users.append(cache_entry)
                
                print(f"[SYNC] Cached {len(slack_users)} Slack users")
            except SlackApiError as e:
                return jsonify({"error": f"Failed to fetch Slack users: {str(e)}"}), 500
        
        # Get all contacts
        contacts_result = db.table("contacts").select("*").execute()
        contacts = contacts_result.data or []
        
        print(f"[SYNC] Found {len(contacts)} contacts")
        
        # Match by email
        matched_count = 0
        for contact in contacts:
            contact_email = (contact.get('email') or '').lower()
            
            if not contact_email:
                continue
            
            # Find matching Slack user
            for slack_user in slack_users:
                slack_email = (slack_user.get('email') or '').lower()
                
                if slack_email and slack_email == contact_email:
                    # Update contact with Slack user ID
                    db.table("contacts").update({
                        "slack_user_id": slack_user['user_id']
                    }).eq("id", contact['id']).execute()
                    
                    matched_count += 1
                    print(f"[SYNC] Matched {contact['name']} ({contact_email}) -> {slack_user['user_id']}")
                    break
        
        return jsonify({
            "success": True,
            "message": f"Synced {matched_count} out of {len(contacts)} contacts with Slack",
            "matched": matched_count,
            "total": len(contacts),
            "cache_used": cache_result.data and cache_age and cache_age < timedelta(hours=1)
        })
    except Exception as e:
        print(f"[SYNC] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/scan-channels', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def scan_slack_channels():
    """
    Scan all project Slack channels and auto-create contacts.
    Categorizes by email domain:
    - @powercommerce.com, @flyrank.com -> Internal
    - @shopline.com -> Shopline Team (External)
    - Others -> Merchant (Stakeholders)
    """
    try:
        slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)
        
        # Get all projects with Slack channels
        projects_result = db.table("projects").select("id, client_name, channel_id_internal, channel_id_external").execute()
        projects = projects_result.data or []
        
        print(f"[SCAN] Scanning {len(projects)} projects for channel members")
        
        # Collect all unique Slack user IDs from channels
        all_user_ids = set()
        
        for project in projects:
            # Scan internal channel
            if project.get('channel_id_internal'):
                try:
                    members_response = slack_client.conversations_members(channel=project['channel_id_internal'])
                    all_user_ids.update(members_response['members'])
                    print(f"[SCAN] {project['client_name']} internal: {len(members_response['members'])} members")
                except Exception as e:
                    print(f"[SCAN] Error scanning internal channel for {project['client_name']}: {e}")
            
            # Scan external channel
            if project.get('channel_id_external'):
                try:
                    members_response = slack_client.conversations_members(channel=project['channel_id_external'])
                    all_user_ids.update(members_response['members'])
                    print(f"[SCAN] {project['client_name']} external: {len(members_response['members'])} members")
                except Exception as e:
                    print(f"[SCAN] Error scanning external channel for {project['client_name']}: {e}")
        
        print(f"[SCAN] Found {len(all_user_ids)} unique Slack users across all channels")
        
        # Get user info for all discovered users
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for user_id in all_user_ids:
            try:
                user_info = slack_client.users_info(user=user_id)
                user = user_info['user']
                
                # Skip bots and deleted users
                if user.get('is_bot') or user.get('deleted'):
                    skipped_count += 1
                    continue
                
                email = user.get('profile', {}).get('email')
                name = user.get('real_name') or user.get('name')
                
                if not email:
                    skipped_count += 1
                    continue
                
                # Categorize by email domain
                email_lower = email.lower()
                if '@powercommerce.com' in email_lower or '@flyrank.com' in email_lower:
                    role = 'Internal'
                elif '@shopline.com' in email_lower:
                    role = 'Shopline Team'
                else:
                    role = 'Merchant'
                
                # Check if contact already exists
                existing = db.table("contacts").select("id").eq("email", email).execute()
                
                if existing.data:
                    # Update existing contact
                    db.table("contacts").update({
                        "slack_user_id": user_id,
                        "role": role
                    }).eq("email", email).execute()
                    updated_count += 1
                    print(f"[SCAN] Updated: {name} ({email}) -> {role}")
                else:
                    # Create new contact
                    db.table("contacts").insert({
                        "name": name,
                        "email": email,
                        "role": role,
                        "slack_user_id": user_id,
                        "notes": "Auto-discovered from Slack channels"
                    }).execute()
                    created_count += 1
                    print(f"[SCAN] Created: {name} ({email}) -> {role}")
                
            except Exception as e:
                print(f"[SCAN] Error processing user {user_id}: {e}")
                skipped_count += 1
        
        return jsonify({
            "success": True,
            "message": f"Scanned {len(projects)} projects. Created {created_count}, updated {updated_count}, skipped {skipped_count} contacts.",
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "total_users": len(all_user_ids)
        })
    except Exception as e:
        print(f"[SCAN] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
