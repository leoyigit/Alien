# backend/app/services/openai_service.py
"""
OpenAI integration service for managing vector stores and assistants.
Handles creation, updates, and chat interactions with project-specific AI assistants.
"""
from openai import OpenAI
from app.core.supabase import db
from typing import List, Dict, Optional
import json


def get_openai_client():
    """Get OpenAI client with API key from database settings."""
    try:
        result = db.table("app_settings").select("value").eq("key", "OPENAI_API_KEY").execute()
        if result.data and result.data[0].get('value'):
            return OpenAI(api_key=result.data[0]['value'])
    except Exception as e:
        print(f"❌ Failed to get OpenAI API key from database: {e}")
    return None


def create_vector_store(name: str, description: str) -> str:
    """
    Create a new vector store for storing project knowledge.
    
    Args:
        name: Name of the vector store (e.g., "Project X - Internal")
        description: Description of what this store contains
        
    Returns:
        Vector store ID
    """
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    
    vector_store = client.vector_stores.create(
        name=name,
        metadata={"description": description}
    )
    return vector_store.id


def upload_messages_to_vector_store(store_id: str, messages: List[Dict]) -> None:
    """
    Upload Slack messages to a vector store.
    
    Args:
        store_id: Vector store ID
        messages: List of formatted Slack messages
    """
    from io import BytesIO
    
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    
    # Format messages as text content
    content = "\n\n---\n\n".join([
        f"**{msg['user']}** ({msg['timestamp']})\n{msg['text']}"
        for msg in messages
    ])
    
    # Create a file-like object from the content
    file_obj = BytesIO(content.encode('utf-8'))
    file_obj.name = 'slack_messages.txt'
    
    # Create a file from the content
    file = client.files.create(
        file=file_obj,
        purpose='assistants'
    )
    
    # Add file to vector store
    client.vector_stores.files.create(
        vector_store_id=store_id,
        file_id=file.id
    )


def upload_text_to_vector_store(store_id: str, text_content: str, filename: str) -> None:
    """
    Upload text content to a vector store.
    
    Args:
        store_id: Vector store ID
        text_content: Text content to upload
        filename: Name for the file
    """
    from io import BytesIO
    
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    
    # Create a file-like object from the content
    file_obj = BytesIO(text_content.encode('utf-8'))
    file_obj.name = filename
    
    # Create a file from the content
    file = client.files.create(
        file=file_obj,
        purpose='assistants'
    )
    
    # Add file to vector store
    client.vector_stores.files.create(
        vector_store_id=store_id,
        file_id=file.id
    )


def create_assistant(
    name: str,
    instructions: str,
    vector_store_id: str,
    model: str = "gpt-4o-mini"
) -> str:
    """
    Create an AI assistant with access to a vector store.
    
    Args:
        name: Assistant name
        instructions: System instructions for the assistant
        vector_store_id: Vector store to attach
        model: OpenAI model to use
        
    Returns:
        Assistant ID
    """
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    
    assistant = client.beta.assistants.create(
        name=name,
        instructions=instructions,
        model=model,
        tools=[{"type": "file_search"}],
        tool_resources={
            "file_search": {
                "vector_store_ids": [vector_store_id]
            }
        }
    )
    return assistant.id


def chat_with_assistant(
    assistant_id: str,
    thread_id: Optional[str],
    message: str
) -> Dict:
    """
    Send a message to an assistant and get a response.
    
    Args:
        assistant_id: Assistant ID
        thread_id: Existing thread ID (None to create new)
        message: User message
        
    Returns:
        Dict with thread_id and response
    """
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    
    # Create or use existing thread
    if not thread_id:
        thread = client.beta.threads.create()
        thread_id = thread.id
    
    # Add message to thread
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
        run = client.beta.threads.runs.retrieve(
            thread_id=thread_id,
            run_id=run.id
        )
    
    # Get the response
    messages = client.beta.threads.messages.list(thread_id=thread_id)
    latest_message = messages.data[0]
    response_text = latest_message.content[0].text.value
    
    return {
        "thread_id": thread_id,
        "response": response_text
    }


def delete_vector_store(store_id: str) -> None:
    """Delete a vector store and all its files."""
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    client.vector_stores.delete(store_id)


def delete_assistant(assistant_id: str) -> None:
    """Delete an assistant."""
    client = get_openai_client()
    if not client:
        raise Exception("OpenAI client not configured - check API key in settings")
    client.beta.assistants.delete(assistant_id)
