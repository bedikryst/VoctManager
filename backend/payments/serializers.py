# payments/serializers.py
# ==========================================
# Payments & Donations API Serializers
# Standard: Enterprise SaaS 2026
# ==========================================
from decimal import Decimal

from rest_framework import serializers

from .models import Donation, DonationCurrency, PatronLead


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
