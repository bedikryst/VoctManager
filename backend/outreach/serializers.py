# outreach/serializers.py
# ==========================================
# Outreach — public API payloads
# Standard: Enterprise SaaS 2026
# ==========================================
from rest_framework import serializers

from .models import NoticeLocale

#: Surfaces a sign-up may claim to come from. An allowlist rather than free text: the
#: endpoint is public, the value is written straight into the record, and a record of
#: where a consent was given is worth nothing if a stranger can write it.
#:
#: SEVERAL SURFACES, ONE CLAUSE. What this column records is WHERE a consent was given,
#: so more entries make the record finer rather than weaker; what would weaken it is one
#: entry standing for several wordings. That cannot happen while every placement renders
#: the same island over the same clause (`web/src/components/NoticeSignup.astro`) and the
#: version stays server-owned here. Adding a value means adding it to `NoticeSurface` in
#: `web/src/islands/landing/api/notices.ts` too — one list in two places.
NOTICE_SURFACES: list[str] = ['web:koncerty', 'web:newsletter', 'web:404', 'web:kontakt']


class NoticeSubscribeSerializer(serializers.Serializer):
    """
    Inbound sign-up for the concert notice list.

    `consent` must be explicitly true and is NOT stored as a column — an unconfirmed row
    is not a consent at all, and a confirmed one carries `confirmed_at`, which is the
    evidence. The clause VERSION is server-owned (`outreach/consent.py`); a client that
    could name the wording it agreed to could name any wording.
    """
    email = serializers.EmailField(max_length=254)
    locale = serializers.ChoiceField(choices=NoticeLocale.choices, default=NoticeLocale.PL)
    # NOT called `source`: `serializers.Field` already owns that attribute name, so a
    # declared field of that name shadows DRF's own binding machinery.
    surface = serializers.ChoiceField(choices=NOTICE_SURFACES, default=NOTICE_SURFACES[0])
    consent = serializers.BooleanField()

    def validate_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "Zgoda jest wymagana, aby zapisać adres na listę zawiadomień."
            )
        return value


class NoticeTokenSerializer(serializers.Serializer):
    """
    The token carried by a confirmation or unsubscribe link.

    It arrives in a POST body rather than in the URL the reader clicked, and that is the
    point: a link scanner (Outlook Safe Links, an antivirus proxy) fetches the page and
    would spend a GET-triggered confirmation before the reader ever saw it, forging the
    one fact this list exists to prove. The link opens a page; the page asks.
    """
    token = serializers.CharField(max_length=64, trim_whitespace=True)
