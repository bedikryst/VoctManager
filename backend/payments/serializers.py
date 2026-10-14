# payments/serializers.py
# ==========================================
# Payments & Donations API Serializers
# ==========================================
from decimal import Decimal

from django.utils.translation import gettext as _
from rest_framework import serializers

from messaging.selectors import user_display_name

from .models import (
    Donation,
    DonationCurrency,
    OfflineTally,
    OfflineTallyRevision,
    OfflineTallySource,
    PatronLead,
)

# Bounds on a hand-typed figure. Generous for a choir's collection, tight enough
# that a slipped key (an extra three zeros) is refused rather than printed.
_MAX_TALLY_AMOUNT = 10_000_000
_MAX_TALLY_DONORS = 100_000


class InitiateDonationSerializer(serializers.Serializer):
    """
    Inbound payload for opening a donation. Deliberately minimal: the donor only
    supplies an email, an amount and a currency. Status and gateway identifiers
    are owned by the service layer and must never be client-supplied.
    """
    email = serializers.EmailField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('1.00'),
        max_value=Decimal('100000.00'),
    )
    currency = serializers.ChoiceField(
        choices=DonationCurrency.choices,
        default=DonationCurrency.PLN,
    )
    # The language the donor was reading when they opened the form. It is not
    # persisted — nothing downstream asks a settled donation what language it
    # came from — and exists only to point the hosted payment page at the right
    # one. Constrained rather than free text: the value ends up inside a URL.
    locale = serializers.ChoiceField(choices=['pl', 'en', 'fr'], default='pl')


class DonationStatusSerializer(serializers.ModelSerializer):
    """
    PII-free projection of a Donation for the public post-payment return page.
    Deliberately excludes `email`: the return URL is handed to the browser and
    leaks into history/referrers, so the response behind it must carry no PII.
    """

    class Meta:
        model = Donation
        fields = ['id', 'amount', 'currency', 'status']
        read_only_fields = fields


class PatronInterestSerializer(serializers.Serializer):
    """
    Inbound payload for a patronage (mecenat) expression of interest. Collects only
    the contact details the visitor volunteers; `consent` must be explicitly true —
    it is the lawful basis (art. 6(1)(a) RODO) and is never persisted as a column,
    because a `PatronLead` cannot be created without it.
    """
    first_name = serializers.CharField(max_length=100, trim_whitespace=True)
    last_name = serializers.CharField(max_length=100, trim_whitespace=True)
    email = serializers.EmailField(max_length=200)
    consent = serializers.BooleanField()

    def validate_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "Zgoda na kontakt jest wymagana, aby zapisać zgłoszenie mecenatu."
            )
        return value

    def create(self, validated_data: dict) -> PatronLead:
        return PatronLead.objects.create(
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            email=validated_data['email'],
        )


class OfflineTallySerializer(serializers.ModelSerializer):
    """One offline source as the collection desk reads it, with who last set it."""
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OfflineTally
        fields = ['source', 'amount', 'donors', 'updated_at', 'updated_by_name']
        read_only_fields = fields

    def get_updated_by_name(self, tally: OfflineTally) -> str | None:
        return user_display_name(tally.updated_by) or None


class OfflineTallyRevisionSerializer(serializers.ModelSerializer):
    """One line of the trail: which source, the figure it was set to, by whom, when."""
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = OfflineTallyRevision
        fields = ['id', 'source', 'amount', 'donors', 'user_name', 'created_at']
        read_only_fields = fields

    def get_user_name(self, revision: OfflineTallyRevision) -> str | None:
        return user_display_name(revision.user) or None


class OfflineTallyWriteSerializer(serializers.Serializer):
    """A source's whole running total — never a delta to add to the stored one."""
    # `Field.source` is an attribute of every DRF field, so stubs read this
    # declaration as reassigning it; the metaclass lifts declared fields off the
    # class, so at runtime it is only the payload key.
    source = serializers.ChoiceField(choices=OfflineTallySource.choices)  # type: ignore[assignment]
    amount = serializers.IntegerField(min_value=0, max_value=_MAX_TALLY_AMOUNT)
    donors = serializers.IntegerField(min_value=0, max_value=_MAX_TALLY_DONORS)


class CollectionWriteSerializer(serializers.Serializer):
    """
    A partial write from the collection desk: only the keys present are written,
    and `tallies` carries only the sources the editor changed, so a form opened
    before a colleague's save does not put the colleague's source back.
    """
    tallies = OfflineTallyWriteSerializer(many=True, required=False)
    goal = serializers.IntegerField(
        min_value=1, max_value=_MAX_TALLY_AMOUNT, allow_null=True, required=False,
    )
    show_rail = serializers.BooleanField(required=False)

    def validate_tallies(self, value: list[dict]) -> list[dict]:
        sources = [row['source'] for row in value]
        if len(sources) != len(set(sources)):
            raise serializers.ValidationError(_("Each source may appear only once."))
        return value
