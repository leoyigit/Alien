# Quick test script to verify email parsing
# Run this to test if email parser works

from app.utils.email_parser import parse_slack_email

# Sample email text from your Slack screenshot
test_email = """From: Léo Yigit <leo@flyrank.com>
To: alien-mail
Subject: Fwd: Getting Started: Your Transition Shopify to Shopline
Date: Today at 1:17 PM

---------- Forwarded message ---------
From: Léo Yigit <leo@flyrank.com>
Date: Mon, Dec 15, 2025 at 9:39 PM
Subject: Getting Started: Your Transition Shopify to Shopline
To: <sonia@mixedupclothing.com>, sales@mixedupclothing.com
<sales@mixedupclothing.com>
Cc: Veronica Gelman <veronica.gelman@shopline.com>,
<peter.salib@shopline.com>, Lily Liu <lily.liu@shopline.com>, Tarik Selimovic
<sela@flyrank.com>, <a@powercommerce.com>

Hi Sonia & Richard,

It was great meeting you, and we're really excited to get started on the migration
and ensure everything transitions smoothly to Shopline.

I've added you to our shared Slack channel so we can communicate directly there.
The Shopline team is also included, which will help streamline collaboration and
feedback throughout the process."""

# Test parsing
result = parse_slack_email(test_email)

if result:
    print("✅ Email parsed successfully!")
    print(f"   From: {result['from_name']} <{result['from_email']}>")
    print(f"   To: {', '.join(result['to_emails'])}")
    print(f"   Subject: {result['subject']}")
    print(f"   Body preview: {result['body'][:100]}...")
else:
    print("❌ Failed to parse email")
