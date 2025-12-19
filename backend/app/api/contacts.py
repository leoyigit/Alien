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
