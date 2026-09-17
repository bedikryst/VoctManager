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

# Bump together with the clause text in `web/src/i18n/content/nuntius.ts` (`form.consentHtml`,
# three locales) and with the privacy policy's own version, which describes this purpose in
# § 3/4/7.
#
# 3.0 is the clause becoming a LAYERED NOTICE, which is a change of what is on screen and
# therefore a change of what was consented to. Art. 13 requires the information to be PROVIDED
# when the data is collected, and the EDPB's transparency guidelines (WP260) are explicit that a
# short first layer carrying the controller, the purpose and the way out — with the full account
# one link away — is how that is met. So the form states those three, links the policy, and lets
# the policy carry what left the screen: the data mailbox and the confirmation link's own
# validity. Nothing about the processing changed; where the reader meets it did.
#
# WHAT DID NOT LEAVE THE SCREEN IS THE SUCCESSOR, and the reason is a decision rather than a
# drafting preference. A consent given to one controller does not silently cover another, so the
# board settled (wariant B, 2026-09) that the list passing to whoever carries the ensemble on has
# to be read BEFORE the address is given, not only found in the policy afterwards — the note above
# § *Lista zaproszeń* in `web/src/content/pages/polityka-prywatnosci.yaml` states that in as many
# words. A first pass at this version cut the sentence to fit a column; the column was the thing
# that was wrong, and it was widened instead. If that sentence is ever dropped again it is the
# board's call to make and this comment is the thing to change with it.
#
# 3.0 also drops the tick box that used to carry this clause. THAT ALONE WOULD NOT BE A BUMP:
# consent is a statement or a clear affirmative action (art. 4(11), recital 32), the box was
# never stored as a column here, and on this list the evidence has always been `confirmed_at` —
# the second, independent action of clicking the link in the mail. The bump is the wording.
#
# 2.0 carried three changes that had to be one version, because a consent is evidence of a
# single text a reader saw: the list is named *Zaproszenia* rather than *Zawiadomienia*, the
# clause states what happens to the list if the foundation is wound up, and it covers an
# optional first name. Consents stamped 1.0 stay 1.0 — they were given under a clause that
# named neither the successor nor the name, and no later wording reaches back to them.
NOTICE_CLAUSE_VERSION = "3.0"
