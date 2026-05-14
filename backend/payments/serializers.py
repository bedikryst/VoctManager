# payments/serializers.py
# ==========================================
# Payments & Donations API Serializers
# Standard: Enterprise SaaS 2026
# ==========================================
from decimal import Decimal

from rest_framework import serializers

from .models import Donation, DonationCurrency


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
