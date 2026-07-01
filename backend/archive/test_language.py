"""
@file archive/test_language.py
@description Unit tests for `normalize_language` — the single write-side
             canonicaliser that ended the "Polish / polski / pol / Polish+Latin"
             free-text mess in `Piece.language`. Pure function, no DB, so a fast
             SimpleTestCase.
@architecture Enterprise SaaS 2026
@module archive/test_language
"""
from django.test import SimpleTestCase

from archive.services.language import normalize_language


class NormalizeLanguageTests(SimpleTestCase):
    def test_english_name_maps_to_iso(self) -> None:
        self.assertEqual(normalize_language("Polish"), "pl")
        self.assertEqual(normalize_language("Latin"), "la")
        self.assertEqual(normalize_language("German"), "de")

    def test_polish_name_maps_to_iso(self) -> None:
        self.assertEqual(normalize_language("polski"), "pl")
        self.assertEqual(normalize_language("łacina"), "la")
        self.assertEqual(normalize_language("lacina"), "la")

    def test_iso_639_2_and_3_collapse_to_639_1(self) -> None:
        self.assertEqual(normalize_language("pol"), "pl")
        self.assertEqual(normalize_language("lat"), "la")
        self.assertEqual(normalize_language("deu"), "de")

    def test_already_canonical_passes_through(self) -> None:
        self.assertEqual(normalize_language("pl"), "pl")
        self.assertEqual(normalize_language("la"), "la")

    def test_case_and_whitespace_insensitive(self) -> None:
        self.assertEqual(normalize_language("  POLISH  "), "pl")
        self.assertEqual(normalize_language("LaTiN"), "la")

    def test_bilingual_is_preserved_as_joined_codes(self) -> None:
        self.assertEqual(normalize_language("Polish + Latin"), "pl+la")
        self.assertEqual(normalize_language("polski i łacina"), "pl+la")
        self.assertEqual(normalize_language("la / pl"), "la+pl")  # order preserved
        self.assertEqual(normalize_language("English & Latin"), "en+la")

    def test_duplicates_are_deduped(self) -> None:
        self.assertEqual(normalize_language("Polish + polski + pol"), "pl")

    def test_unknown_and_empty_return_blank(self) -> None:
        self.assertEqual(normalize_language(None), "")
        self.assertEqual(normalize_language(""), "")
        self.assertEqual(normalize_language("   "), "")
        self.assertEqual(normalize_language("Klingon"), "")

    def test_partial_multivalue_drops_only_the_unknown_token(self) -> None:
        self.assertEqual(normalize_language("Polish + Klingon"), "pl")
