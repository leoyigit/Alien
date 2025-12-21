# backend/app/api/ai_chat.py
"""
AI Chat API endpoints for project-specific assistants.
Handles initialization, syncing, and chat interactions with separate internal/external assistants.
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.core.supabase import db
from app.services import openai_service, slack_sync_service
from datetime import datetime

ai_chat = Blueprint('ai_chat', __name__)


@ai_chat.route('/projects/<project_id>/ai/initialize', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def initialize_ai(project_id):
    """
    Initialize AI assistants and vector stores for a project.
    Creates both internal and external assistants.
    """
    try:
        # Get project info
        project = db.table("projects").select("client_name, internal_vector_store_id, external_vector_store_id").eq("id", project_id).execute()
        if not project.data:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = project.data[0]
        client_name = project_data['client_name']
        
        # Check if already initialized
        if project_data.get('internal_vector_store_id'):
            return jsonify({"error": "AI already initialized for this project"}), 400
        
        # Create internal vector store and assistant
        internal_store_id = openai_service.create_vector_store(
            name=f"{client_name} - Internal",
            description=f"Internal communications for {client_name} project"
        )
        
        internal_assistant_id = openai_service.create_assistant(
            name=f"{client_name} Internal Assistant",
            instructions=f"""You are an AI assistant for the {client_name} project's internal team.
You have access to internal Slack communications and project notes.
Help the team with project questions, status updates, and technical discussions.
Be professional, concise, and helpful.""",
            vector_store_id=internal_store_id
        )
        
        # Create external vector store and assistant
        external_store_id = openai_service.create_vector_store(
            name=f"{client_name} - External",
            description=f"External communications for {client_name} project"
        )
        
        external_assistant_id = openai_service.create_assistant(
            name=f"{client_name} External Assistant",
            instructions=f"""You are an AI assistant for the {client_name} project.
You have access to external communications with the client and Shopline team.
Help answer questions about the project, provide status updates, and assist with coordination.
Be professional, friendly, and client-focused.""",
            vector_store_id=external_store_id
        )
        
        # Update project with IDs
        db.table("projects").update({
            "internal_vector_store_id": internal_store_id,
            "external_vector_store_id": external_store_id,
            "internal_assistant_id": internal_assistant_id,
            "external_assistant_id": external_assistant_id,
            "sync_status": "initialized"
        }).eq("id", project_id).execute()
        
        return jsonify({
            "success": True,
            "message": "AI assistants initialized successfully",
            "internal_assistant_id": internal_assistant_id,
            "external_assistant_id": external_assistant_id
        })
    except Exception as e:
        print(f"Error initializing AI: {e}")
        return jsonify({"error": str(e)}), 500


@ai_chat.route('/projects/<project_id>/ai/sync', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def sync_knowledge_base(project_id):
    """
    Sync Slack messages to vector stores.
    Fetches messages from both internal and external channels.
    """
    try:
        # Get project
        project = db.table("projects").select("*").eq("id", project_id).execute()
        if not project.data:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = project.data[0]
        
        # Check if AI is initialized
        if not project_data.get('internal_vector_store_id'):
            return jsonify({"error": "AI not initialized. Call /initialize first"}), 400
        
        # Update status to syncing
        db.table("projects").update({"sync_status": "syncing"}).eq("id", project_id).execute()
        
        # Sync internal channel
        internal_messages = slack_sync_service.sync_internal_channel(project_id)
        if internal_messages:
            openai_service.upload_messages_to_vector_store(
                project_data['internal_vector_store_id'],
                internal_messages
            )
        
        # Sync external channel
        external_messages = slack_sync_service.sync_external_channel(project_id)
        if external_messages:
            openai_service.upload_messages_to_vector_store(
                project_data['external_vector_store_id'],
                external_messages
            )
        
        # Update sync timestamps
        db.table("projects").update({
            "last_sync_internal": datetime.now().isoformat(),
            "last_sync_external": datetime.now().isoformat(),
            "sync_status": "synced"
        }).eq("id", project_id).execute()
        
        return jsonify({
            "success": True,
            "message": f"Synced {len(internal_messages)} internal and {len(external_messages)} external messages",
            "internal_count": len(internal_messages),
            "external_count": len(external_messages)
        })
    except Exception as e:
        print(f"Error syncing: {e}")
        db.table("projects").update({"sync_status": "error"}).eq("id", project_id).execute()
        return jsonify({"error": str(e)}), 500


@ai_chat.route('/projects/<project_id>/ai/chat', methods=['POST'])
@require_auth
def chat_with_ai(project_id):
    """
    Send a message to the AI assistant.
    Routes to internal or external assistant based on user role and visibility.
    """
    data = request.json
    message = data.get('message')
    visibility = data.get('visibility', 'external')  # internal or external
    thread_id = data.get('thread_id')  # Optional: continue existing conversation
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    try:
        # Get project
        project = db.table("projects").select("*").eq("id", project_id).execute()
        if not project.data:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = project.data[0]
        
        # Determine which assistant to use based on user role and visibility
        user_role = g.user.get('role')
        
        if visibility == 'internal':
            # Only superadmin and internal can access internal assistant
            if user_role not in ['superadmin', 'internal']:
                return jsonify({"error": "Access denied to internal assistant"}), 403
            assistant_id = project_data.get('internal_assistant_id')
        else:
            # Everyone can access external assistant
            assistant_id = project_data.get('external_assistant_id')
        
        if not assistant_id:
            return jsonify({"error": "AI not initialized for this project"}), 400
        
        # Chat with assistant
        result = openai_service.chat_with_assistant(
            assistant_id=assistant_id,
            thread_id=thread_id,
            message=message
        )
        
        return jsonify({
            "success": True,
            "thread_id": result['thread_id'],
            "response": result['response'],
            "visibility": visibility
        })
    except Exception as e:
        print(f"Error chatting with AI: {e}")
        return jsonify({"error": str(e)}), 500


@ai_chat.route('/projects/<project_id>/ai/status', methods=['GET'])
@require_auth
def get_ai_status(project_id):
    """Get AI initialization and sync status for a project."""
    try:
        project = db.table("projects").select(
            "internal_assistant_id, external_assistant_id, last_sync_internal, last_sync_external, sync_status"
        ).eq("id", project_id).execute()
        
        if not project.data:
            return jsonify({"error": "Project not found"}), 404
        
        data = project.data[0]
        
        return jsonify({
            "initialized": bool(data.get('internal_assistant_id')),
            "sync_status": data.get('sync_status'),
            "last_sync_internal": data.get('last_sync_internal'),
            "last_sync_external": data.get('last_sync_external')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
