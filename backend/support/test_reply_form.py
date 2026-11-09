"""
===============================================================================
Support Agent — Tests: Reply Form Checks
===============================================================================
Domain: Support
Description:
    The sentences are taken from stored eval replies, the forms each pattern must
    catch beside the near misses it must leave alone: nouns sharing the past
    ending, and "sam" agreeing with a thing rather than with the member.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

from django.test import SimpleTestCase

from support.reply_form import gendered_forms, in_language_of, language_of


class LanguageTests(SimpleTestCase):
    def test_it_tells_polish_from_english(self) -> None:
        self.assertEqual(language_of('Plan niedzieli jest w sekcji „Plan dnia”, po prawej stronie.'), 'pl')
        self.assertEqual(language_of("Sunday's plan is in the „Plan dnia” section on the right of the screen."), 'en')
        self.assertIsNone(language_of('/panel/materials'))

    def test_a_reply_must_follow_the_report(self) -> None:
        report = 'Jak się zmienia Niedzielę - jutrzejszy dzień ?'
        self.assertTrue(in_language_of('Punkty niedzieli zmieniasz w zakładce „Szczegóły”.', report))
        self.assertFalse(in_language_of("You change Sunday's points on the Details tab.", report))
        self.assertFalse(in_language_of('„Plan dnia”', report))

    def test_a_report_with_no_lead_puts_no_demand(self) -> None:
        self.assertTrue(in_language_of('Any reply at all.', '???'))


class GenderedFormTests(SimpleTestCase):
    def test_it_catches_each_form_the_rule_names(self) -> None:
        cases = {
            'Jeśli miałeś na myśli co innego, napisz.': ['miałeś'],
            'Napisz, jeśli chciałabyś inaczej.': ['chciałabyś'],
            'Widzisz projekty, w których jesteś wpisany jako dyrygent.': ['jesteś wpisany'],
            'Wtedy będziesz musiał zapisać plan.': ['będziesz musiał'],
            'Ma Pan rację.': ['Pan'],
            'Przekazałem to dalej jako błąd.': ['Przekazałem'],
            'Nie sprawdziłam, czy kolejka wysyła się sama.': ['sprawdziłam'],
            'Sam możesz sprawdzić nagrania w tym samym miejscu.': ['Sam możesz sprawdzić nagrania w tym samym miejscu'],
            'Musisz więc poprawić oba pola sam: Archiwum Nut → utwór.': ['Musisz więc poprawić oba pola sam'],
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(gendered_forms(text), expected)

    def test_it_leaves_neutral_forms_and_near_misses_alone(self) -> None:
        for text in (
            'Kliknij „Zapisz”; możesz też wrócić. Jeśli chodziło Ci o coś innego, napisz. Przekazuję to dalej.',
            'Uczestnicy kanału to obsada projektu z potwierdzonym udziałem.',
            'Najpierw zapisz projekt z tytułem oraz datą, potem porozmawiaj z zespołem.',
            'IPA nie dostosuje się sama.',
            'Zmiana jest widoczna od razu, ale wiadomość nie wychodzi sama.',
            'Sam koncert przesuwasz polem „Data i godzina”.',
            'Jeśli generalną ustawisz na sobotę, plan sam podzieli się na dwa dni.',
            'Prywatne zapiski muzyka widzi tylko on sam.',
            'Jesteś na liście obsady i będziesz mieć dostęp do nut.',
        ):
            with self.subTest(text=text):
                self.assertEqual(gendered_forms(text), [])
