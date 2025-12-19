#!/usr/bin/env python3
"""
Systematic dark mode addition for all components.
This script adds dark: classes to common patterns.
"""

import os
import re

# Common dark mode replacements
DARK_MODE_PATTERNS = [
    # Backgrounds
    (r'\bbg-white\b', 'bg-white dark:bg-gray-800'),
    (r'\bbg-gray-50\b', 'bg-gray-50 dark:bg-gray-900'),
    (r'\bbg-gray-100\b', 'bg-gray-100 dark:bg-gray-700'),
    (r'\bbg-gray-200\b', 'bg-gray-200 dark:bg-gray-600'),
    
    # Text colors
    (r'\btext-gray-900\b', 'text-gray-900 dark:text-white'),
    (r'\btext-gray-800\b', 'text-gray-800 dark:text-gray-100'),
    (r'\btext-gray-700\b', 'text-gray-700 dark:text-gray-200'),
    (r'\btext-gray-600\b', 'text-gray-600 dark:text-gray-300'),
    (r'\btext-gray-500\b', 'text-gray-500 dark:text-gray-400'),
    (r'\btext-gray-400\b', 'text-gray-400 dark:text-gray-500'),
    
    # Borders
    (r'\bborder-gray-200\b', 'border-gray-200 dark:border-gray-700'),
    (r'\bborder-gray-300\b', 'border-gray-300 dark:border-gray-600'),
    (r'\bborder-gray-100\b', 'border-gray-100 dark:border-gray-700'),
    
    # Dividers
    (r'\bdivide-gray-100\b', 'divide-gray-100 dark:divide-gray-700'),
    (r'\bdivide-gray-200\b', 'divide-gray-200 dark:divide-gray-700'),
    
    # Hovers
    (r'\bhover:bg-gray-50\b', 'hover:bg-gray-50 dark:hover:bg-gray-700'),
    (r'\bhover:bg-gray-100\b', 'hover:bg-gray-100 dark:hover:bg-gray-700'),
    (r'\bhover:text-gray-900\b', 'hover:text-gray-900 dark:hover:text-white'),
]

def add_mode(file_path):
    """Add dark mode classes to a file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        original_content = content
        changes_made = 0
        
        for pattern, replacement in DARK_MODE_PATTERNS:
            # Only replace if dark: not already present nearby
            matches = list(re.finditer(pattern, content))
            for match in reversed(matches):  # Reverse to maintain positions
                start = match.start()
                end = match.end()
                
                # Check if 'dark:' is within 100 chars after this match
                context = content[end:end+100]
                if 'dark:' not in context:
                    content = content[:start] + replacement + content[end:]
                    changes_made += 1
        
        if changes_made > 0:
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"✓ {file_path}: {changes_made} changes")
            return True
        else:
            print(f"  {file_path}: Already has dark mode or no matches")
            return False
    
    except Exception as e:
        print(f"✗ {file_path}: Error - {e}")
        return False

if __name__ == "__main__":
    # Pages to update
    pages = [
        'frontend/src/pages/Projects.jsx',
        'frontend/src/pages/PMStation.jsx',
        'frontend/src/pages/Scanner.jsx',
        'frontend/src/pages/Partnerships.jsx',
        'frontend/src/pages/Reports.jsx',
        'frontend/src/pages/ProjectDetails.jsx',
        'frontend/src/pages/Archives.jsx',
        'frontend/src/pages/AlienGPT.jsx',
        'frontend/src/pages/Settings.jsx',
    ]
    
    print("Adding dark mode to pages...\n")
    updated = 0
    for page in pages:
        if os.path.exists(page):
            if add_dark_mode(page):
                updated += 1
        else:
            print(f"⚠ {page}: File not found")
    
    print(f"\n✅ Updated {updated} files!")
