# outreach/consent.py
# ==========================================
# The information clause a subscriber agrees to, and its version
# Standard: Enterprise SaaS 2026
# ==========================================
"""
The consent record's one moving part: WHICH clause a subscriber saw.

A consent is only evidence if it says what was consented to. The clause itself is
prose and lives where the reader met it — `web/src/content/pages/koncerty.yaml`,
on the copy desk, in three locales — so the only thing the database can usefully
hold is a pointer to the wording that was on screen. That pointer is this version.

THE VERSION IS SERVER-OWNED, not submitted by the form. A client-supplied version
would be forgeable and, worse, would make the site and the backend able to
disagree across a deploy: a page cached with a version this process has never
heard of would start rejecting sign-ups. The site therefore renders the clause and
the server stamps the version it knows — and the two are bumped in ONE commit.

WHEN TO BUMP. Any change to what the clause promises: the purpose, the frequency
("one mail per evening"), who the administrator is, how to withdraw. Fixing a typo
or a translation that says the same thing is not a bump — a version that changes
without the meaning changing makes the history unreadable.
"""

# Bump together with the clause text in `koncerty.yaml` (`notice.consentHtml`) and
# with the privacy policy's own version, which describes this purpose in § 3/4/7.
NOTICE_CLAUSE_VERSION = "1.0"
