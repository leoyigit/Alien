# backend/app/api/settings_api.py
"""
Settings API endpoints for Alien Portal.
Superadmin-only access to manage API keys and app configuration.
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.core.supabase import db, admin_db

settings_api = Blueprint('settings_api', __name__)


@settings_api.route('/', methods=['GET'])
@require_auth
@require_role('superadmin')
def get_all_settings():
    """
    Get all settings. All values are masked for security.
    Only superadmins can access this endpoint.
    """
    try:
        result = admin_db.table("app_settings").select("*").order("key").execute()
        
        # Process settings - mask ALL values for security
        settings = []
        for s in result.data:
            # Skip internal settings like TEAM_MEMBERS
            if s.get('key') == 'TEAM_MEMBERS':
                continue
                
            # Mask all API-related settings
            if s.get('value'):
                val = s['value']
                masked = '•' * 20 + val[-4:] if len(val) > 4 else '•' * len(val)
                s['masked_value'] = masked
                s['has_value'] = True
                del s['value']  # Don't send actual value to frontend
            else:
                s['has_value'] = False
                s['masked_value'] = ''
            settings.append(s)
        
        return jsonify(settings)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/<key>', methods=['GET'])
@require_auth
@require_role('superadmin')
def get_setting(key):
    """Get a specific setting (masked if secret)."""
    try:
        result = admin_db.table("app_settings").select("*").eq("key", key).execute()
        
        if not result.data:
            return jsonify({"error": "Setting not found"}), 404
        
        setting = result.data[0]
        
        if setting.get('is_secret') and setting.get('value'):
            setting['masked_value'] = '•' * 20 + setting['value'][-4:]
            setting['has_value'] = True
            del setting['value']
        
        return jsonify(setting)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/<key>/reveal', methods=['GET'])
@require_auth
@require_role('superadmin')
def reveal_setting(key):
    """Reveal the actual value of a setting. Superadmin only."""
    try:
        result = admin_db.table("app_settings").select("key, value").eq("key", key).execute()
        
        if not result.data:
            return jsonify({"error": "Setting not found"}), 404
        
        return jsonify({
            "key": key,
            "value": result.data[0].get('value', '')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/<key>', methods=['PUT'])
@require_auth
@require_role('superadmin')
def update_setting(key):
    """
    Update a setting value.
    For secrets, the value is stored directly (consider encryption in production).
    """
    data = request.json
    new_value = data.get('value')
    
    if new_value is None:
        return jsonify({"error": "Value is required"}), 400
    
    try:
        # Check if setting exists
        existing = admin_db.table("app_settings").select("id").eq("key", key).execute()
        
        if not existing.data:
            # Create new setting
            admin_db.table("app_settings").insert({
                "key": key,
                "value": new_value,
                "is_secret": data.get('is_secret', True),
                "description": data.get('description', ''),
                "updated_by": g.user['id']
            }).execute()
        else:
            # Update existing
            admin_db.table("app_settings").update({
                "value": new_value,
                "updated_by": g.user['id'],
                "updated_at": "now()"
            }).eq("key", key).execute()
        
        return jsonify({"success": True, "message": f"Setting '{key}' updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/<key>', methods=['DELETE'])
@require_auth
@require_role('superadmin')
def delete_setting(key):
    """Delete a setting."""
    try:
        admin_db.table("app_settings").delete().eq("key", key).execute()
        return jsonify({"success": True, "message": f"Setting '{key}' deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/test-connection/<service>', methods=['POST'])
@require_auth
@require_role('superadmin')
def test_connection(service):
    """
    Test connection to external services (Slack, OpenAI).
    Useful for validating API keys.
    """
    try:
        if service == 'slack':
            from slack_sdk import WebClient
            
            # Get token from request or settings
            token = None
            if request.is_json:
                token = request.json.get('token')
            if not token:
                setting = admin_db.table("app_settings").select("value").eq("key", "SLACK_BOT_TOKEN").execute()
                token = setting.data[0]['value'] if setting.data else None
            
            if not token:
                return jsonify({"success": False, "error": "No Slack token configured"})
            
            client = WebClient(token=token)
            auth_test = client.auth_test()
            
            return jsonify({
                "success": True,
                "team": auth_test.get('team'),
                "bot": auth_test.get('user')
            })
            
        elif service == 'openai':
            import openai
            
            api_key = None
            if request.is_json:
                api_key = request.json.get('api_key')
            if not api_key:
                setting = admin_db.table("app_settings").select("value").eq("key", "OPENAI_API_KEY").execute()
                api_key = setting.data[0]['value'] if setting.data else None
            
            if not api_key:
                return jsonify({"success": False, "error": "No OpenAI API key configured"})
            
            client = openai.OpenAI(api_key=api_key)
            models = client.models.list()
            
            return jsonify({
                "success": True,
                "message": "OpenAI connection successful",
                "models_available": len(list(models))
            })
        
        else:
            return jsonify({"error": f"Unknown service: {service}"}), 400
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


# =============================================================================
# TEAM MANAGEMENT (for PM/Dev dropdowns)
# =============================================================================

@settings_api.route('/team', methods=['GET'])
@require_auth
def get_team_members():
    """
    Get list of internal team members for PM/Dev dropdowns.
    Accessible by all authenticated users.
    """
    try:
        result = admin_db.table("app_settings").select("value").eq("key", "TEAM_MEMBERS").execute()
        
        if result.data and result.data[0].get('value'):
            import json
            team = json.loads(result.data[0]['value'])
            return jsonify(team)
        
        # Return default team if not configured
        return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/team', methods=['PUT'])
@require_auth
@require_role('superadmin')
def update_team_members():
    """
    Update the internal team members list.
    Expects: { "members": [{ "name": "Leo", "role": "PM" }, ...] }
    """
    import json
    data = request.json
    members = data.get('members', [])
    
    try:
        # Validate structure
        for m in members:
            if 'name' not in m:
                return jsonify({"error": "Each member must have a 'name'"}), 400
        
        # Store as JSON in app_settings
        existing = admin_db.table("app_settings").select("id").eq("key", "TEAM_MEMBERS").execute()
        
        if existing.data:
            admin_db.table("app_settings").update({
                "value": json.dumps(members),
                "updated_by": g.user['id']
            }).eq("key", "TEAM_MEMBERS").execute()
        else:
            admin_db.table("app_settings").insert({
                "key": "TEAM_MEMBERS",
                "value": json.dumps(members),
                "is_secret": False,
                "description": "Internal team members list",
                "updated_by": g.user['id']
            }).execute()
        
        return jsonify({"success": True, "message": f"Team updated ({len(members)} members)"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/team/add', methods=['POST'])
@require_auth
@require_role('superadmin')
def add_team_member():
    """Add a single team member."""
    import json
    data = request.json
    name = data.get('name')
    role = data.get('role', 'Both')  # PM, Dev, or Both
    
    if not name:
        return jsonify({"error": "Name is required"}), 400
    
    try:
        # Get current team
        result = admin_db.table("app_settings").select("value").eq("key", "TEAM_MEMBERS").execute()
        
        if result.data and result.data[0].get('value'):
            team = json.loads(result.data[0]['value'])
        else:
            team = []
        
        # Check if already exists
        if any(m['name'].lower() == name.lower() for m in team):
            return jsonify({"error": f"{name} already in team"}), 409
        
        team.append({"name": name, "role": role})
        
        # Save
        if result.data:
            admin_db.table("app_settings").update({
                "value": json.dumps(team),
                "updated_by": g.user['id']
            }).eq("key", "TEAM_MEMBERS").execute()
        else:
            admin_db.table("app_settings").insert({
                "key": "TEAM_MEMBERS",
                "value": json.dumps(team),
                "is_secret": False,
                "description": "Internal team members list",
                "updated_by": g.user['id']
            }).execute()
        
        return jsonify({"success": True, "message": f"Added {name} to team"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api.route('/team/<name>', methods=['DELETE'])
@require_auth
@require_role('superadmin')
def remove_team_member(name):
    """Remove a team member by name."""
    import json
    
    try:
        result = admin_db.table("app_settings").select("value").eq("key", "TEAM_MEMBERS").execute()
        
        if not result.data or not result.data[0].get('value'):
            return jsonify({"error": "Team list not found"}), 404
        
        team = json.loads(result.data[0]['value'])
        original_len = len(team)
        team = [m for m in team if m['name'].lower() != name.lower()]
        
        if len(team) == original_len:
            return jsonify({"error": f"{name} not found in team"}), 404
        
        admin_db.table("app_settings").update({
            "value": json.dumps(team),
            "updated_by": g.user['id']
        }).eq("key", "TEAM_MEMBERS").execute()
        
        return jsonify({"success": True, "message": f"Removed {name} from team"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
