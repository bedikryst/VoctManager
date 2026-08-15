"""
@file tests.py
@description Covers the address normalization that runs on every write, and the
    command that applies it to rows imported before it existed.
@architecture Enterprise SaaS 2026
@module logistics/tests
"""

from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from .address import address_parts, normalize_address
from .dtos import LocationCreateDTO, LocationUpdateDTO
from .models import Location, LocationCategory
from .services import LogisticsService

# The observed Places answer for the audited venue: the postal code once alone
# and once in front of the town, plus the country in English.
PLACES_SHAPE = "02-532, Rakowiecka 61, 02-532 Warszawa, Poland"


class AddressNormalizationTests(SimpleTestCase):
    def test_repeated_postal_code_is_dropped_and_the_country_stays(self) -> None:
        """The bare fragment goes, not the one carrying the town. The country is
        a printing decision and belongs to the call sheet, not to the record."""
        self.assertEqual(
            normalize_address(PLACES_SHAPE),
            "Rakowiecka 61, 02-532 Warszawa, Poland",
        )

    def test_exact_repeats_and_stray_whitespace_go(self) -> None:
        self.assertEqual(
            normalize_address("  Rynek   1 ,, Kraków ,Kraków , Poland "),
            "Rynek 1, Kraków, Poland",
        )

    def test_a_part_merely_contained_in_another_survives(self) -> None:
        """Only a part a later one *opens* with is a repetition. "Warszawa"
        inside a street name is not, and an address parser is exactly what this
        is not allowed to become."""
        self.assertEqual(
            normalize_address("Warszawa, Aleje Jerozolimskie 1 Warszawa"),
            "Warszawa, Aleje Jerozolimskie 1 Warszawa",
        )

    def test_normalization_is_idempotent(self) -> None:
        """It runs on every write, so a second pass must never erode further."""
        once = normalize_address(PLACES_SHAPE)
        self.assertEqual(normalize_address(once), once)

    def test_empty_stays_empty(self) -> None:
        self.assertEqual(address_parts(None), [])
        self.assertEqual(normalize_address(""), "")


class LocationWritePathTests(TestCase):
    def test_create_stores_the_normalized_address(self) -> None:
        location = LogisticsService.create_location(
            LocationCreateDTO(
                name="Kościół św. Andrzeja Boboli",
                category=LocationCategory.CHURCH,
                formatted_address=PLACES_SHAPE,
            )
        )
        self.assertEqual(
            location.formatted_address, "Rakowiecka 61, 02-532 Warszawa, Poland"
        )

    def test_update_normalizes_too(self) -> None:
        location = Location.objects.create(
            name="Sala prób",
            category=LocationCategory.REHEARSAL_ROOM,
            formatted_address="ul. Prosta 1",
        )
        updated = LogisticsService.update_location(
            location.id, LocationUpdateDTO(formatted_address=PLACES_SHAPE)
        )
        self.assertEqual(
            updated.formatted_address, "Rakowiecka 61, 02-532 Warszawa, Poland"
        )


class NormalizeAddressCommandTests(TestCase):
    def setUp(self) -> None:
        # Written straight to the ORM, as a row imported before the normalizer
        # existed would have been.
        self.location = Location.objects.create(
            name="Kościół św. Andrzeja Boboli",
            category=LocationCategory.CHURCH,
            formatted_address=PLACES_SHAPE,
        )

    def _run(self, *args: str) -> str:
        out = StringIO()
        call_command("normalize_location_addresses", *args, stdout=out)
        return out.getvalue()

    def test_dry_run_reports_without_writing(self) -> None:
        output = self._run()
        self.assertIn("Rakowiecka 61, 02-532 Warszawa, Poland", output)
        self.location.refresh_from_db()
        self.assertEqual(self.location.formatted_address, PLACES_SHAPE)

    def test_apply_writes_the_normalized_address(self) -> None:
        self._run("--apply")
        self.location.refresh_from_db()
        self.assertEqual(
            self.location.formatted_address, "Rakowiecka 61, 02-532 Warszawa, Poland"
        )

    def test_a_clean_estate_reports_nothing_to_do(self) -> None:
        self._run("--apply")
        self.assertIn("already normalized", self._run())
