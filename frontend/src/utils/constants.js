export const CHECKLIST_GROUPS = {
    "Phase 1: Onboarding": ["Slack Setup", "Kickoff Scheduled", "Kickoff Completed", "Deliverables Sent", "Deliverables Completed"],
    "Phase 2: Migration & Setup": ["Store Setup", "Access Sent", "Data Migration Started", "Data Migration Completed", "Theme Migration Started", "Theme Migration Completed", "App Setup Started", "App Setup Completed"],
    "Phase 3: Analytics & Tracking": ["GA4 Access", "GA4 Setup", "GTM Access", "GTM Setup", "Other Pixels", "CDN Access"],
    "Phase 4: Launch": ["Ready to go Live", "Notifications turned on"]
};

export const ALL_CHECKLIST_ITEMS = Object.values(CHECKLIST_GROUPS).flat();

export const BLOCKER_OPTS = ['Merchant', 'Shopline', '3rd Parties', 'Internal', 'Other'];

export const parseBlocker = (str) => {
    if (!str || str === '-' || str === 'None') return { cats: [], desc: "" };
    if (str.includes('|')) {
        const [c, d] = str.split('|');
        return { cats: c.split(',').map(x => x.trim()), desc: d?.trim() || "" };
    }
    // Fallback for legacy
    if (BLOCKER_OPTS.includes(str)) return { cats: [str], desc: "" };
    return { cats: [], desc: str };
};
