# backend/app/services/global_sync_service.py
"""
Global sync service for syncing all projects at once.
Syncs contacts, Slack IDs, stakeholders, and AI knowledge bases.
"""
from app.core.supabase import db
from app.services import slack_sync_service, openai_service, activity_logger, pm_sync_service, email_sync_service
from slack_sdk import WebClient
from app.core.config import settings
from typing import Dict, List
import time

slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)


def sync_all_contacts(user_id: str, user_name: str) -> Dict:
    """
    Scan all Slack channels and create/update contacts.
    
    Returns:
        Dict with counts of created/updated contacts
    """
    start_time = time.time()
    
    try:
        # Get all projects with Slack channels
        projects = db.table("projects").select("id, client_name, channel_id_internal, channel_id_external").execute()
        
        discovered_contacts = []
        channels_scanned = 0
        
        for project in projects.data:
            # Scan internal channel
            if project.get('channel_id_internal'):
                try:
                    members = slack_client.conversations_members(channel=project['channel_id_internal'])
                    for user_id_slack in members['members']:
                        user_info = slack_client.users_info(user=user_id_slack)
                        user_data = user_info['user']
                        
                        if not user_data.get('is_bot') and user_data.get('profile', {}).get('email'):
                            discovered_contacts.append({
                                'slack_user_id': user_id_slack,
                                'name': user_data['real_name'],
                                'email': user_data['profile']['email']
                            })
                    channels_scanned += 1
                except:
                    pass
            
            # Scan external channel
            if project.get('channel_id_external'):
                try:
                    members = slack_client.conversations_members(channel=project['channel_id_external'])
                    for user_id_slack in members['members']:
                        user_info = slack_client.users_info(user=user_id_slack)
                        user_data = user_info['user']
                        
                        if not user_data.get('is_bot') and user_data.get('profile', {}).get('email'):
                            discovered_contacts.append({
                                'slack_user_id': user_id_slack,
                                'name': user_data['real_name'],
                                'email': user_data['profile']['email']
                            })
                    channels_scanned += 1
                except:
                    pass
        
        # Create/update contacts
        created = 0
        updated = 0
        
        for contact_data in discovered_contacts:
            existing = db.table("contacts").select("id").eq("email", contact_data['email']).execute()
            
            if existing.data:
                # Update existing
                db.table("contacts").update({
                    "slack_user_id": contact_data['slack_user_id'],
                    "name": contact_data['name']
                }).eq("email", contact_data['email']).execute()
                updated += 1
            else:
                # Create new
                email = contact_data['email'].lower()
                role = 'Internal' if '@powercommerce.com' in email or '@flyrank.com' in email else \
                       'Shopline Team' if '@shopline.com' in email else 'Merchant'
                
                db.table("contacts").insert({
                    "name": contact_data['name'],
                    "email": contact_data['email'],
                    "slack_user_id": contact_data['slack_user_id'],
                    "role": role,
                    "notes": "Auto-discovered from Slack channels"
                }).execute()
                created += 1
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        activity_logger.log_activity(
            user_id=user_id,
            user_name=user_name,
            action_type='sync_contacts',
            resource_type='global',
            status='success',
            details={
                'channels_scanned': channels_scanned,
                'created': created,
                'updated': updated
            },
            duration_ms=duration_ms
        )
        
        return {'created': created, 'updated': updated, 'channels_scanned': channels_scanned}
    
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        activity_logger.log_error(user_id, user_name, 'sync_contacts', e, 'global', duration_ms=duration_ms)
        raise


def sync_all_slack_ids(user_id: str, user_name: str) -> Dict:
    """
    Sync Slack user IDs for all contacts.
    
    Returns:
        Dict with count of matched contacts
    """
    start_time = time.time()
    
    try:
        # Get all contacts without Slack IDs
        contacts = db.table("contacts").select("id, email").is_("slack_user_id", "null").execute()
        
        matched = 0
        
        for contact in contacts.data:
            try:
                # Try to find user by email
                result = slack_client.users_lookupByEmail(email=contact['email'])
                if result.get('ok'):
                    slack_user_id = result['user']['id']
                    db.table("contacts").update({
                        "slack_user_id": slack_user_id
                    }).eq("id", contact['id']).execute()
                    matched += 1
            except:
                pass
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        activity_logger.log_activity(
            user_id=user_id,
            user_name=user_name,
            action_type='sync_slack_ids',
            resource_type='global',
            status='success',
            details={'matched': matched},
            duration_ms=duration_ms
        )
        
        return {'matched': matched}
    
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        activity_logger.log_error(user_id, user_name, 'sync_slack_ids', e, 'global', duration_ms=duration_ms)
        raise


def sync_all_ai_knowledge(user_id: str, user_name: str) -> Dict:
    """
    Sync AI knowledge bases for all projects.
    Auto-initializes AI if not already set up.
    
    Returns:
        Dict with counts of synced projects
    """
    start_time = time.time()
    
    # Helper function to log both console and activity log
    def log_line(line: str, log_id: str = None):
        print(line)
        if log_id:
            activity_logger.append_console_output(log_id, line)
    
    try:
        # Get ALL projects (not just those with AI initialized)
        projects = db.table("projects").select("*").execute()
        
        total_projects = len(projects.data)
        initialized = 0
        synced = 0
        skipped = 0
        failed = 0
        
        # Track details for skipped and failed projects
        skipped_details = []
        failed_details = []
        
        # Create initial activity log entry
        log_id = activity_logger.log_activity(
            user_id=user_id,
            user_name=user_name,
            action_type='sync_ai_global',
            resource_type='global',
            status='in_progress',
            details={
                'console_output': [],
                'message': f'Starting AI sync for {total_projects} projects...'
            }
        )
        
        log_line(f"\n🚀 Starting AI sync for {total_projects} projects...", log_id)
        
        for idx, project in enumerate(projects.data, 1):
            project_name = project.get('client_name', 'Unknown')
            
            log_line(f"\n🔄 Processing {idx}/{total_projects}: {project_name}", log_id)
            
            try:
                # Check if AI is initialized
                if not project.get('internal_assistant_id'):
                    # Auto-initialize AI for this project (4 vector stores)
                    log_line(f"🤖 Auto-initializing AI (4 stores) for project: {project_name}", log_id)
                    
                    # Create 4 vector stores
                    internal_store_id = openai_service.create_vector_store(
                        name=f"{project_name} - Internal",
                        description=f"Internal Slack communications for {project_name}"
                    )
                    
                    external_store_id = openai_service.create_vector_store(
                        name=f"{project_name} - External",
                        description=f"External Slack communications for {project_name}"
                    )
                    
                    pm_store_id = openai_service.create_vector_store(
                        name=f"{project_name} - Internal-Project-Management",
                        description=f"PM data: notes, blockers, updates, URLs, launch dates for {project_name}"
                    )
                    
                    email_store_id = openai_service.create_vector_store(
                        name=f"{project_name} - Emails",
                        description=f"Email communications for {project_name}"
                    )
                    
                    # Create 4 assistants with STRICT project-specific instructions
                    internal_assistant_id = openai_service.create_assistant(
                        name=f"{project_name} - Internal Assistant",
                        instructions=f"""You are an AI assistant EXCLUSIVELY for the {project_name} project.

IMPORTANT RULES:
1. You can ONLY answer questions about {project_name}. 
2. If asked about ANY other project, respond: "I only have access to {project_name} data. I cannot answer about other projects."
3. If the question is unclear or ambiguous, ASK clarifying questions before answering.
4. ONLY use information from your assigned knowledge base (internal Slack communications for {project_name}).
5. Always cite the source (date, person, channel) when providing information.
6. If you don't have information, say "I don't have that information in my knowledge base" - NEVER make up answers.

Your knowledge base contains: Internal team Slack communications for {project_name}.

Be helpful, professional, and always verify you're answering about the correct project.""",
                        vector_store_id=internal_store_id
                    )
                    
                    external_assistant_id = openai_service.create_assistant(
                        name=f"{project_name} - External Assistant",
                        instructions=f"""You are an AI assistant EXCLUSIVELY for the {project_name} project.

IMPORTANT RULES:
1. You can ONLY answer questions about {project_name}.
2. If asked about ANY other project, respond: "I only have access to {project_name} data. I cannot answer about other projects."
3. If the question is unclear or ambiguous, ASK clarifying questions before answering.
4. ONLY use information from your assigned knowledge base (external Slack communications for {project_name}).
5. Always cite the source (date, person, channel) when providing information.
6. If you don't have information, say "I don't have that information in my knowledge base" - NEVER make up answers.

Your knowledge base contains: External Slack communications with clients and Shopline team for {project_name}.

Be professional, client-focused, and always verify you're answering about the correct project.""",
                        vector_store_id=external_store_id
                    )
                    
                    pm_assistant_id = openai_service.create_assistant(
                        name=f"{project_name} - PM Assistant",
                        instructions=f"""You are an AI assistant EXCLUSIVELY for the {project_name} project.

IMPORTANT RULES:
1. You can ONLY answer questions about {project_name}.
2. If asked about ANY other project, respond: "I only have access to {project_name} data. I cannot answer about other projects."
3. If the question is unclear or ambiguous, ASK clarifying questions before answering.
4. ONLY use information from your assigned knowledge base (PM data for {project_name}).
5. Always cite specific dates, PM names, and report details when providing information.
6. If you don't have information, say "I don't have that information in my knowledge base" - NEVER make up answers.

Your knowledge base contains: PM notes, blockers, updates, URLs, launch dates, and all PM inputs for {project_name}.

Be detailed, reference specific dates and updates, and always verify you're answering about the correct project.""",
                        vector_store_id=pm_store_id
                    )
                    
                    email_assistant_id = openai_service.create_assistant(
                        name=f"{project_name} - Email Assistant",
                        instructions=f"""You are an AI assistant EXCLUSIVELY for the {project_name} project.

IMPORTANT RULES:
1. You can ONLY answer questions about {project_name}.
2. If asked about ANY other project, respond: "I only have access to {project_name} data. I cannot answer about other projects."
3. If the question is unclear or ambiguous, ASK clarifying questions before answering.
4. ONLY use information from your assigned knowledge base (emails for {project_name}).
5. Always cite the email sender, date, and subject when providing information.
6. If you don't have information, say "I don't have that information in my knowledge base" - NEVER make up answers.

Your knowledge base contains: Email communications for {project_name}.

Be professional, reference specific emails, and always verify you're answering about the correct project.""",
                        vector_store_id=email_store_id
                    )
                    
                    # Update project with all IDs
                    db.table("projects").update({
                        "internal_vector_store_id": internal_store_id,
                        "external_vector_store_id": external_store_id,
                        "pm_vector_store_id": pm_store_id,
                        "email_vector_store_id": email_store_id,
                        "internal_assistant_id": internal_assistant_id,
                        "external_assistant_id": external_assistant_id,
                        "pm_assistant_id": pm_assistant_id,
                        "email_assistant_id": email_assistant_id,
                        "sync_status": "initialized"
                    }).eq("id", project['id']).execute()
                    
                    initialized += 1
                    log_line(f"✅ Initialized 4 vector stores for {project_name}", log_id)
                
                # Check if project has any channels configured
                has_internal_channel = bool(project.get('channel_id_internal'))
                has_external_channel = bool(project.get('channel_id_external'))
                
                if not has_internal_channel and not has_external_channel:
                    # Skip projects with no channels
                    reason = "No Slack channels configured"
                    log_line(f"⚠️  Skipped {project_name}: {reason}", log_id)
                    skipped += 1
                    skipped_details.append({"project": project_name, "reason": reason})
                    continue
                
                # Track if any data was synced
                data_synced = False
                
                # Now sync messages (whether just initialized or already existed)
                # Sync internal channel
                internal_messages = slack_sync_service.sync_internal_channel(project['id'])
                if internal_messages:
                    # Refresh project data to get vector store IDs
                    updated_project = db.table("projects").select("internal_vector_store_id").eq("id", project['id']).execute()
                    openai_service.upload_messages_to_vector_store(
                        updated_project.data[0]['internal_vector_store_id'],
                        internal_messages
                    )
                    log_line(f"📤 Uploaded {len(internal_messages)} internal messages for {project_name}", log_id)
                    data_synced = True
                
                # Sync external channel
                external_messages = slack_sync_service.sync_external_channel(project['id'])
                if external_messages:
                    updated_project = db.table("projects").select("external_vector_store_id").eq("id", project['id']).execute()
                    openai_service.upload_messages_to_vector_store(
                        updated_project.data[0]['external_vector_store_id'],
                        external_messages
                    )
                    log_line(f"📤 Uploaded {len(external_messages)} external messages for {project_name}", log_id)
                    data_synced = True
                
                # Sync PM data
                pm_data = pm_sync_service.sync_pm_data(project['id'])
                if pm_data:
                    updated_project = db.table("projects").select("pm_vector_store_id").eq("id", project['id']).execute()
                    if updated_project.data and updated_project.data[0].get('pm_vector_store_id'):
                        pm_text = pm_sync_service.format_pm_data_for_upload(pm_data)
                        openai_service.upload_text_to_vector_store(
                            updated_project.data[0]['pm_vector_store_id'],
                            pm_text,
                            f"{project_name}_pm_data.txt"
                        )
                        log_line(f"📋 Uploaded PM data for {project_name}", log_id)
                        data_synced = True
                
                # Sync emails
                emails = email_sync_service.sync_emails(project['id'])
                if emails:
                    updated_project = db.table("projects").select("email_vector_store_id").eq("id", project['id']).execute()
                    if updated_project.data and updated_project.data[0].get('email_vector_store_id'):
                        email_text = email_sync_service.format_emails_for_upload(emails)
                        openai_service.upload_text_to_vector_store(
                            updated_project.data[0]['email_vector_store_id'],
                            email_text,
                            f"{project_name}_emails.txt"
                        )
                        log_line(f"📧 Uploaded {len(emails)} emails for {project_name}", log_id)
                        data_synced = True
                
                # Determine if we should count as synced or skipped
                if data_synced:
                    # Update timestamps
                    db.table("projects").update({
                        "last_sync_internal": time.strftime('%Y-%m-%dT%H:%M:%S'),
                        "last_sync_external": time.strftime('%Y-%m-%dT%H:%M:%S'),
                        "sync_status": "synced"
                    }).eq("id", project['id']).execute()
                    
                    synced += 1
                    log_line(f"✅ Synced {project_name}", log_id)
                else:
                    # No new data to sync
                    reason = "No new data to sync"
                    log_line(f"⚠️  Skipped {project_name}: {reason}", log_id)
                    skipped += 1
                    skipped_details.append({"project": project_name, "reason": reason})
                
            except Exception as e:
                error_msg = str(e)
                log_line(f"❌ Failed to sync AI for project {project_name}: {error_msg}", log_id)
                failed += 1
                failed_details.append({"project": project_name, "error": error_msg})
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        log_line(f"\n✅ Completed: {synced} synced, {skipped} skipped, {failed} failed", log_id)
        
        # Update final activity log
        if log_id:
            activity_logger.update_activity_log(
                log_id=log_id,
                status='success',
                details={
                    'initialized': initialized,
                    'synced': synced,
                    'skipped': skipped,
                    'failed': failed,
                    'skipped_details': skipped_details,
                    'failed_details': failed_details,
                    'console_output': None,  # Keep existing console_output
                    'message': f'Completed: {synced} synced, {skipped} skipped, {failed} failed'
                },
                duration_ms=duration_ms
            )
        
        return {'initialized': initialized, 'synced': synced, 'skipped': skipped, 'failed': failed, 'skipped_details': skipped_details, 'failed_details': failed_details}
    
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        if 'log_id' in locals() and log_id:
            log_line(f"\n❌ Sync failed: {str(e)}", log_id)
            activity_logger.update_activity_log(log_id=log_id, status='error', duration_ms=duration_ms)
        else:
            activity_logger.log_error(user_id, user_name, 'sync_ai_global', e, 'global', duration_ms=duration_ms)
        raise




def run_global_sync(user_id: str, user_name: str) -> Dict:
    """
    Run full global sync: contacts, Slack IDs, and AI knowledge.
    
    Returns:
        Dict with summary of all sync operations
    """
    start_time = time.time()
    
    try:
        # 1. Sync contacts
        contacts_result = sync_all_contacts(user_id, user_name)
        
        # 2. Sync Slack IDs
        slack_ids_result = sync_all_slack_ids(user_id, user_name)
        
        # 3. Sync AI knowledge
        ai_result = sync_all_ai_knowledge(user_id, user_name)
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        activity_logger.log_activity(
            user_id=user_id,
            user_name=user_name,
            action_type='sync_global',
            resource_type='global',
            status='success',
            details={
                'contacts': contacts_result,
                'slack_ids': slack_ids_result,
                'ai': ai_result,
                'total_duration_ms': duration_ms
            },
            duration_ms=duration_ms
        )
        
        return {
            'success': True,
            'contacts': contacts_result,
            'slack_ids': slack_ids_result,
            'ai': ai_result,
            'duration_ms': duration_ms
        }
    
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        activity_logger.log_error(user_id, user_name, 'sync_global', e, 'global', duration_ms=duration_ms)
        return {
            'success': False,
            'error': str(e),
            'duration_ms': duration_ms
        }
