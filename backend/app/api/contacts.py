"""
Contacts API endpoints
"""
from flask import Blueprint, request, jsonify
from app.core.supabase import db
from app.api.auth import require_auth, require_role

contacts_api = Blueprint('contacts_api', __name__)


@contacts_api.route('/contacts', methods=['GET'])
@require_auth
def get_contacts():
    """Get all contacts with project associations."""
    try:
        # Get all contacts
        contacts_result = db.table('contacts').select('*').order('name').execute()
        contacts = contacts_result.data or []
        
        # Get all contact-project associations
        assoc_result = db.table('contact_projects')\
            .select('contact_id, project_id')\
            .execute()
        associations = assoc_result.data or []
        
        # Build a map of contact_id -> [project_ids]
        contact_projects = {}
        for assoc in associations:
            contact_id = assoc['contact_id']
            if contact_id not in contact_projects:
                contact_projects[contact_id] = []
            contact_projects[contact_id].append(assoc['project_id'])
        
        # Add project_ids to each contact
        for contact in contacts:
            contact['project_ids'] = contact_projects.get(contact['id'], [])
        
        return jsonify(contacts)
    except Exception as e:
        print(f"Error fetching contacts: {e}")
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/contacts', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def create_contact():
    """Create a new contact."""
    try:
        data = request.json
        contact_data = {
            'name': data.get('name'),
            'email': data.get('email'),
            'phone': data.get('phone'),
            'company': data.get('company'),
            'role': data.get('role'),
            'slack_user_id': data.get('slack_user_id'),
            'notes': data.get('notes'),
        }
        
        # Remove None values
        contact_data = {k: v for k, v in contact_data.items() if v is not None}
        
        result = db.table('contacts').insert(contact_data).execute()
        contact = result.data[0]
        
        # Handle project associations
        project_ids = data.get('project_ids', [])
        if project_ids:
            associations = [
                {'contact_id': contact['id'], 'project_id': pid}
                for pid in project_ids
            ]
            db.table('contact_projects').insert(associations).execute()
        
        # Auto-assign merchant users to projects
        if contact.get('email') and project_ids:
            try:
                from app.core.supabase import admin_db
                # Check if this email belongs to a merchant user
                user_result = admin_db.table("portal_users")\
                    .select("id, role, assigned_projects")\
                    .eq("email", contact['email'])\
                    .eq("role", "merchant")\
                    .execute()
                
                if user_result.data:
                    merchant_user = user_result.data[0]
                    current_projects = merchant_user.get('assigned_projects') or []
                    
                    # Add new project IDs to assigned projects
                    updated_projects = list(set(current_projects + project_ids))
                    
                    admin_db.table("portal_users").update({
                        "assigned_projects": updated_projects
                    }).eq("id", merchant_user['id']).execute()
                    
                    print(f"✅ Auto-assigned merchant {contact['email']} to {len(project_ids)} project(s)")
            except Exception as e:
                print(f"⚠️ Auto-assignment failed: {e}")
                # Don't fail the contact creation if auto-assignment fails
        
        contact['project_ids'] = project_ids
        return jsonify(contact), 201
    except Exception as e:
        print(f"Error creating contact: {e}")
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/contacts/<contact_id>', methods=['PUT'])
@require_auth
@require_role('superadmin', 'internal')
def update_contact(contact_id):
    """Update a contact."""
    try:
        data = request.json
        contact_data = {}
        
        # Only update provided fields
        for field in ['name', 'email', 'phone', 'company', 'role', 'slack_user_id', 'notes']:
            if field in data:
                contact_data[field] = data[field]
        
        if contact_data:
            result = db.table('contacts')\
                .update(contact_data)\
                .eq('id', contact_id)\
                .execute()
        
        # Handle project associations
        if 'project_ids' in data:
            # Get old project IDs before updating
            old_assoc_result = db.table('contact_projects')\
                .select('project_id')\
                .eq('contact_id', contact_id)\
                .execute()
            old_project_ids = [a['project_id'] for a in old_assoc_result.data]
            
            # Delete existing associations
            db.table('contact_projects').delete().eq('contact_id', contact_id).execute()
            
            # Add new associations
            project_ids = data['project_ids']
            if project_ids:
                associations = [
                    {'contact_id': contact_id, 'project_id': pid}
                    for pid in project_ids
                ]
                db.table('contact_projects').insert(associations).execute()
            
            # Auto-update merchant user assignments
            contact_result = db.table('contacts').select('email').eq('id', contact_id).single().execute()
            contact_email = contact_result.data.get('email')
            
            if contact_email:
                try:
                    from app.core.supabase import admin_db
                    # Check if this email belongs to a merchant user
                    user_result = admin_db.table("portal_users")\
                        .select("id, role, assigned_projects")\
                        .eq("email", contact_email)\
                        .eq("role", "merchant")\
                        .execute()
                    
                    if user_result.data:
                        merchant_user = user_result.data[0]
                        current_projects = merchant_user.get('assigned_projects') or []
                        
                        # Remove old project IDs and add new ones
                        updated_projects = [p for p in current_projects if p not in old_project_ids]
                        updated_projects = list(set(updated_projects + project_ids))
                        
                        admin_db.table("portal_users").update({
                            "assigned_projects": updated_projects
                        }).eq("id", merchant_user['id']).execute()
                        
                        print(f"✅ Updated merchant {contact_email} project assignments")
                except Exception as e:
                    print(f"⚠️ Auto-assignment update failed: {e}")
        
        # Fetch updated contact
        contact_result = db.table('contacts').select('*').eq('id', contact_id).single().execute()
        contact = contact_result.data
        
        # Get project associations
        assoc_result = db.table('contact_projects')\
            .select('project_id')\
            .eq('contact_id', contact_id)\
            .execute()
        contact['project_ids'] = [a['project_id'] for a in assoc_result.data]
        
        return jsonify(contact)
    except Exception as e:
        print(f"Error updating contact: {e}")
        return jsonify({"error": str(e)}), 500


@contacts_api.route('/contacts/<contact_id>', methods=['DELETE'])
@require_auth
@require_role('superadmin', 'internal')
def delete_contact(contact_id):
    """Delete a contact."""
    try:
        db.table('contacts').delete().eq('id', contact_id).execute()
        return jsonify({"success": True, "message": "Contact deleted"})
    except Exception as e:
        print(f"Error deleting contact: {e}")
        return jsonify({"error": str(e)}), 500
