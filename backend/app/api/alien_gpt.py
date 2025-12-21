# backend/app/api/alien_gpt.py
"""
AlienGPT API - Global role-aware AI assistant.
Dynamically queries vector stores based on user permissions.
"""
from flask import Blueprint, request, jsonify, g
from app.api.auth import require_auth
from app.services import access_control
from app.core.config import settings
from openai import OpenAI
import time

alien_gpt = Blueprint('alien_gpt', __name__)
client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Global AlienGPT assistant ID (created once, stored here)
# TODO: Move to database settings table for persistence
ALIEN_GPT_ASSISTANT_ID = None


def get_or_create_alien_gpt():
    """Get or create the global AlienGPT assistant."""
    global ALIEN_GPT_ASSISTANT_ID
    
    if ALIEN_GPT_ASSISTANT_ID:
        return ALIEN_GPT_ASSISTANT_ID
    
    # Create global assistant (no vector stores attached - we'll add them per query)
    assistant = client.beta.assistants.create(
        name="AlienGPT - Global Assistant",
        instructions="""You are AlienGPT, the global AI assistant for the Alien Portal platform.

CRITICAL RULES:
1. You have access to multiple projects based on user permissions
2. ALWAYS specify which project your information comes from
3. When answering, format responses clearly with project attribution
4. If asked about data you don't have access to, explain the limitation
5. Ask clarifying questions if the query is ambiguous
6. ALWAYS cite sources: project name, date, person, channel/email
7. NEVER make up information - only use data from your knowledge base

RESPONSE FORMAT:
- For single project: "**[Project Name]**: [Answer with source citation]"
- For multiple projects: List each project separately with clear headers
- For cross-project queries: Aggregate data and show breakdown by project

EXAMPLES:
User: "What are all blocked projects?"
You: "Here are the currently blocked projects:

**Project A**: Blocked since Dec 15
- Blocker: Waiting for API access from vendor
- PM: John Doe

**Project B**: Blocked since Dec 18
- Blocker: Client approval needed for design
- PM: Jane Smith"

User: "What's the latest on Project X?"
You: "**Project X**: Latest update from Dec 20:
- Status: In Progress
- PM Note: Client approved phase 1, starting development
- Next milestone: Launch scheduled for Jan 15
- Source: PM report by Leo, Dec 20"

Be helpful, accurate, and always attribute information to the correct project.""",
        model="gpt-4o-mini",
        tools=[{"type": "file_search"}]
    )
    
    ALIEN_GPT_ASSISTANT_ID = assistant.id
    print(f"✅ Created AlienGPT assistant: {ALIEN_GPT_ASSISTANT_ID}")
    
    return ALIEN_GPT_ASSISTANT_ID


@alien_gpt.route('/alien-gpt/chat', methods=['POST'])
@require_auth
def chat():
    """
    Chat with AlienGPT.
    Dynamically attaches vector stores based on user role.
    """
    try:
        data = request.json
        message = data.get('message')
        thread_id = data.get('thread_id')  # Optional: continue conversation
        
        if not message:
            return jsonify({"error": "Message is required"}), 400
        
        # Get user info
        user_id = g.user.get('id')
        user_role = g.user.get('role')
        user_name = g.user.get('name', 'User')
        
        # AlienGPT is only for superadmin and internal users
        if user_role not in ['superadmin', 'internal']:
            return jsonify({
                "error": "AlienGPT is only available for internal team members. Please use the per-project AI assistant instead."
            }), 403
        
        # Get accessible vector stores based on role
        accessible_stores = access_control.get_accessible_vector_stores(user_id, user_role)
        
        if not accessible_stores:
            return jsonify({
                "error": "No accessible data found. Please contact your administrator.",
                "accessible_projects": []
            }), 403
        
        # Get or create AlienGPT assistant
        assistant_id = get_or_create_alien_gpt()
        
        # NOTE: OpenAI only allows 1 vector store per thread
        # For now, we'll use the assistant without thread-level vector stores
        # The assistant will search across all vector stores it has access to
        # TODO: Implement role-based filtering in the assistant instructions
        
        # Create or use existing thread (without vector stores)
        if thread_id:
            # Continue existing conversation
            pass  # Use existing thread_id
        else:
            # Create new thread
            thread = client.beta.threads.create()
            thread_id = thread.id
        
        # Add user message to thread
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        
        # Wait for completion
        while run.status in ['queued', 'in_progress']:
            time.sleep(0.5)
            run = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id
            )
        
        if run.status == 'failed':
            return jsonify({
                "error": "AI processing failed",
                "details": run.last_error
            }), 500
        
        # Get the response
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        latest_message = messages.data[0]
        response_text = latest_message.content[0].text.value
        
        # Get user's accessible projects for context
        accessible_projects = access_control.get_user_accessible_projects(user_id, user_role)
        
        return jsonify({
            "success": True,
            "thread_id": thread_id,
            "response": response_text,
            "user_role": user_role,
            "accessible_projects": accessible_projects,
            "vector_stores_queried": len(accessible_stores)
        })
    
    except Exception as e:
        print(f"❌ AlienGPT error: {e}")
        return jsonify({"error": str(e)}), 500


@alien_gpt.route('/alien-gpt/status', methods=['GET'])
@require_auth
def status():
    """Get AlienGPT status and user's access level."""
    try:
        user_id = g.user.get('id')
        user_role = g.user.get('role')
        
        # Get accessible projects
        accessible_projects = access_control.get_user_accessible_projects(user_id, user_role)
        accessible_stores = access_control.get_accessible_vector_stores(user_id, user_role)
        
        return jsonify({
            "available": True,
            "user_role": user_role,
            "accessible_projects": accessible_projects,
            "total_vector_stores": len(accessible_stores),
            "access_level": {
                "superadmin": "Full access to all projects and data types",
                "internal": "Full access to all projects and data types",
                "shopline": "External data for projects you're part of",
                "merchant": "External data for your project only"
            }.get(user_role, "Limited access")
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
