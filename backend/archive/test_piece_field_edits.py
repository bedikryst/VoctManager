"""Regression tests for the review card's conditional field undo."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from archive.models import LatinPronunciation, Movement, Piece, Translation
from archive.services.provenance import record_ai
from core.constants import AppRole
from core.models import UserProfile


class PieceFieldEditTests(APITestCase):
    def setUp(self) -> None:
        user = get_user_model().objects.create_user(username='reviewer')
        UserProfile.objects.create(user=user, role=AppRole.MANAGER)
        self.client.force_authenticate(user)
        self.piece = Piece.objects.create(
            title='Gloria', language='la', lyrics_original='Gloria in excelsis',
            lyrics_ipa='original guide', lyrics_ipa_system=LatinPronunciation.GERMANIC,
        )
        self.url = f'/api/pieces/{self.piece.pk}/edit_field/'

    def test_undo_clear_restores_the_original_ipa_source_and_system(self) -> None:
        source = record_ai(
            target=self.piece, field_name='lyrics_ipa', model_id='claude-sonnet-5',
            prompt_version='initial', confidence=0.82,
        )
        target = {'field': 'lyrics_ipa'}
        key = f'{self.piece.pk}:lyrics_ipa'
        saved = self.client.patch(self.url, {**target, 'value': ''}, format='json')
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()['piece']['lyrics_ipa_system'], '')
        self.assertEqual(saved.json()['piece']['provenance'][key]['source'], 'MAN')

        receipt = saved.json()['receipt']
        restored = self.client.post(self.url, {**target, 'receipt': receipt}, format='json')
        self.assertEqual(restored.status_code, 200)
        piece = restored.json()['piece']
        self.assertEqual(piece['lyrics_ipa'], 'original guide')
        self.assertEqual(piece['lyrics_ipa_system'], LatinPronunciation.GERMANIC)
        self.assertEqual(piece['provenance'][key]['source'], source.source)
        self.assertEqual(piece['provenance'][key]['confidence'], source.confidence)
        self.assertEqual(piece['provenance'][key]['retrieved_at'], source.retrieved_at.isoformat())
        self.assertEqual(self.client.post(self.url, {**target, 'receipt': receipt}, format='json').status_code, 409)

    def test_undo_is_scoped_to_the_edited_piece_field_and_its_revision(self) -> None:
        target = {'field': 'lyrics_original'}
        saved = self.client.patch(self.url, {**target, 'value': 'Corrected'}, format='json')
        self.assertEqual(saved.status_code, 200)
        receipt = saved.json()['receipt']
        self.client.patch(self.url, {'field': 'title', 'value': 'Gloria in D'}, format='json')
        restored = self.client.post(self.url, {**target, 'receipt': receipt}, format='json')
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['piece']['title'], 'Gloria in D')
        self.assertNotIn(f'{self.piece.pk}:lyrics_original', restored.json()['piece']['provenance'])

        again = self.client.patch(self.url, {**target, 'value': 'Corrected'}, format='json')
        self.client.patch(self.url, {**target, 'value': 'Another editor'}, format='json')
        self.client.patch(self.url, {**target, 'value': 'Corrected'}, format='json')
        rejected = self.client.post(self.url, {**target, 'receipt': again.json()['receipt']}, format='json')
        self.assertEqual(rejected.status_code, 409)
        self.assertEqual(rejected.json()['error_code'], 'edit_superseded')
        self.piece.refresh_from_db()
        self.assertEqual(self.piece.lyrics_original, 'Corrected')

    def test_child_edit_response_reconciles_value_and_source_together(self) -> None:
        movement = Movement.objects.create(piece=self.piece, title='Allegro', order_index=0)
        translation = Translation.objects.create(piece=self.piece, target_language='pl', text='Chwała')
        cases = [
            (movement, 'movement', 'title', 'Allegro', 'Allegretto', 'tempo_marking', 'Presto', 'movements'),
            (translation, 'translation', 'text', 'Chwała', 'Chwała na wysokości', 'translator', 'Editor', 'translations'),
        ]
        for child, kind, field, original, value, other, other_value, collection in cases:
            with self.subTest(kind=kind):
                source = record_ai(target=child, field_name=field, model_id='claude-sonnet-5', prompt_version='initial')
                key = f'{child.pk}:{field}'
                target = {'kind': kind, 'object_id': str(child.pk), 'field': field}
                auxiliary = self.client.patch(self.url, {**target, 'field': other, 'value': other_value}, format='json')
                self.assertEqual(auxiliary.json()['piece']['provenance'][key]['source'], source.source)
                saved = self.client.patch(self.url, {**target, 'value': value}, format='json')
                self.assertEqual(saved.json()['piece'][collection][0][field], value)
                self.assertEqual(saved.json()['piece']['provenance'][key]['source'], 'MAN')
                restored = self.client.post(self.url, {**target, 'receipt': saved.json()['receipt']}, format='json')
                self.assertEqual(restored.json()['piece'][collection][0][field], original)
                self.assertEqual(restored.json()['piece'][collection][0][other], other_value)
                self.assertEqual(restored.json()['piece']['provenance'][key]['source'], source.source)

    def test_cannot_edit_a_child_of_another_piece(self) -> None:
        other = Piece.objects.create(title='Other work')
        movement = Movement.objects.create(piece=other, title='Other movement', order_index=0)
        response = self.client.patch(self.url, {
            'kind': 'movement', 'object_id': str(movement.pk), 'field': 'title', 'value': 'Changed',
        }, format='json')
        self.assertEqual(response.status_code, 404)
