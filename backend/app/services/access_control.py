# backend/app/services/access_control.py
"""
Access control service for AlienGPT.
Determines which vector stores a user can access based on their role.
"""
from app.core.supabase import db
from typing import List


def get_accessible_vector_stores(user_id: str, user_role: str) -> List[str]:
    """
    Get list of vector store IDs user can access based on role.
    
    Args:
        user_id: User's ID
        user_role: User's role (superadmin, internal, shopline, merchant)
        
    Returns:
        List of vector store IDs
    """
    if user_role in ['superadmin', 'internal']:
        # Full access to ALL vector stores across ALL projects
        return get_all_vector_stores()
    
    elif user_role == 'shopline':
        # Access to external stores of projects they're part of
        return get_shopline_vector_stores(user_id)
    
    elif user_role == 'merchant':
        # Access to ONLY their project's external store
        return get_merchant_vector_stores(user_id)
    
    return []


def get_all_vector_stores() -> List[str]:
    """Get all vector store IDs across all projects."""
    projects = db.table("projects").select(
        "internal_vector_store_id, external_vector_store_id, pm_vector_store_id, email_vector_store_id"
    ).neq("client_name", "Shopline").execute()
    
    stores = []
    for p in projects.data:
        stores.extend([
            p.get('internal_vector_store_id'),
            p.get('external_vector_store_id'),
            p.get('pm_vector_store_id'),
            p.get('email_vector_store_id')
        ])
    
    # Filter out None values
    return [s for s in stores if s]


def get_shopline_vector_stores(user_id: str) -> List[str]:
    """
    Get external vector stores for projects the Shopline user is part of.
    
    Args:
        user_id: Shopline user's ID
        
    Returns:
        List of external vector store IDs
    """
    # Get projects where user is a stakeholder
    stakeholders = db.table("project_stakeholders").select("project_id").eq("user_id", user_id).execute()
    
    project_ids = [s['project_id'] for s in stakeholders.data]
    
    if not project_ids:
        return []
    
    # Get external vector stores for these projects
    projects = db.table("projects").select("external_vector_store_id").in_("id", project_ids).execute()
    
    stores = [p.get('external_vector_store_id') for p in projects.data]
    return [s for s in stores if s]


def get_merchant_vector_stores(user_id: str) -> List[str]:
    """
    Get external vector store for the merchant's project.
    
    Args:
        user_id: Merchant user's ID
        
    Returns:
        List containing single external vector store ID
    """
    # Find project where user is the merchant/owner
    # This could be via stakeholders table or a direct project ownership field
    stakeholder = db.table("project_stakeholders").select("project_id").eq("user_id", user_id).eq("role", "Merchant").execute()
    
    if not stakeholder.data:
        return []
    
    project_id = stakeholder.data[0]['project_id']
    
    # Get external vector store for this project
    project = db.table("projects").select("external_vector_store_id").eq("id", project_id).execute()
    
    if project.data and project.data[0].get('external_vector_store_id'):
        return [project.data[0]['external_vector_store_id']]
    
    return []


def get_user_accessible_projects(user_id: str, user_role: str) -> List[dict]:
    """
    Get list of projects user can access with their access level.
    
    Returns:
        List of dicts with project info and access level
    """
    if user_role in ['superadmin', 'internal']:
        projects = db.table("projects").select("id, client_name").neq("client_name", "Shopline").execute()
        return [{'id': p['id'], 'name': p['client_name'], 'access': 'full'} for p in projects.data]
    
    elif user_role == 'shopline':
        stakeholders = db.table("project_stakeholders").select("project_id").eq("user_id", user_id).execute()
        project_ids = [s['project_id'] for s in stakeholders.data]
        
        if not project_ids:
            return []
        
        projects = db.table("projects").select("id, client_name").in_("id", project_ids).execute()
        return [{'id': p['id'], 'name': p['client_name'], 'access': 'external'} for p in projects.data]
    
    elif user_role == 'merchant':
        stakeholder = db.table("project_stakeholders").select("project_id").eq("user_id", user_id).eq("role", "Merchant").execute()
        
        if not stakeholder.data:
            return []
        
        project_id = stakeholder.data[0]['project_id']
        project = db.table("projects").select("id, client_name").eq("id", project_id).execute()
        
        if project.data:
            return [{'id': project.data[0]['id'], 'name': project.data[0]['client_name'], 'access': 'external'}]
    
    return []
