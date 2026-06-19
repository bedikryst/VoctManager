from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from core.constants import AppRole

from .dtos import DocumentCategoryCreateDTO
from .models import Document, DocumentCategory

User = get_user_model()


class DocumentCategoryTests(APITestCase):
    def setUp(self):
        self.artist_user = User.objects.create_user(
            username='artist',
            email='artist@example.com',
            password='password123',
        )
        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@example.com',
            password='password123',
            is_staff=True,
        )
        self.manager_category = DocumentCategory.objects.create(
            name='Manager Only',
            slug='manager-only',
            allowed_roles=[AppRole.MANAGER],
        )
        self.artist_category = DocumentCategory.objects.create(
            name='Artist Visible',
            slug='artist-visible',
            allowed_roles=[AppRole.ARTIST],
        )
        self.document = Document.objects.create(
            category=self.artist_category,
            title='Artist Doc',
            file='dummy.pdf',
            allowed_roles=[],
        )

    def test_artist_cannot_see_manager_category(self):
        self.client.force_authenticate(user=self.artist_user)
        response = self.client.get('/api/documents/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [cat['slug'] for cat in response.data]
        self.assertIn('artist-visible', slugs)
        self.assertNotIn('manager-only', slugs)

    def test_document_inherits_roles_from_category(self):
        self.assertEqual(self.document.effective_roles, [AppRole.ARTIST])

    def test_is_manager_sees_all_categories(self):
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get('/api/documents/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [cat['slug'] for cat in response.data]
        self.assertIn('artist-visible', slugs)
        self.assertIn('manager-only', slugs)


class MyEnsembleTests(APITestCase):
    """Concert roster at /api/documents/my-ensemble/ ("Z kim śpiewam").

    Strictly scoped to the caller's own open concerts and the pieces they sing;
    grouped by per-piece voice line; never the whole base nor default voice types.
    """

    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        from archive.models import Piece
        from roster.models import Artist, Participation, Project, ProjectPieceCasting

        self.user = User.objects.create_user(
            username='tenor', email='tenor@example.com', password='password123',
        )
        # Caller's own record carries private capability data that must NOT leak.
        self.me = Artist.objects.create(
            user=self.user, first_name='Jan', last_name='Tenor', email='tenor@example.com',
            voice_type='TEN', sight_reading_skill=4, vocal_range_bottom='C3', vocal_range_top='A4',
        )
        a_line = Artist.objects.create(
            first_name='Adam', last_name='Linia', email='adam@example.com', voice_type='TEN',
        )
        a_other_voice = Artist.objects.create(
            first_name='Sara', last_name='Wysoka', email='sara@example.com', voice_type='SOP',
        )
        outsider = Artist.objects.create(
            first_name='Obcy', last_name='Człowiek', email='out@example.com', voice_type='BAS',
        )
        done_mate = Artist.objects.create(
            first_name='Stary', last_name='Znajomy', email='done@example.com', voice_type='TEN',
        )

        now = timezone.now()
        self.concert = Project.objects.create(
            title='Koncert Wiosenny', date_time=now + timedelta(days=10), status='ACTIVE',
        )
        other_concert = Project.objects.create(
            title='Inny Koncert', date_time=now + timedelta(days=5), status='ACTIVE',
        )
        past_concert = Project.objects.create(
            title='Stary Koncert', date_time=now - timedelta(days=30), status='DONE',
        )

        self.piece1 = Piece.objects.create(title='Lacrimosa')
        self.piece2 = Piece.objects.create(title='Ave Maria')
        piece_past = Piece.objects.create(title='Requiem')

        def cast(artist, project, piece, voice_line):
            part, _ = Participation.objects.get_or_create(
                artist=artist, project=project, defaults={'status': 'CON'},
            )
            ProjectPieceCasting.objects.create(participation=part, piece=piece, voice_line=voice_line)

        # My open concert: I sing T2 in Lacrimosa, T1 in Ave Maria.
        cast(self.me, self.concert, self.piece1, 'T2')
        cast(self.me, self.concert, self.piece2, 'T1')
        # Adam shares my T2 line in Lacrimosa; Sara sings S1 in the same piece.
        cast(a_line, self.concert, self.piece1, 'T2')
        cast(a_other_voice, self.concert, self.piece1, 'S1')
        # Outsider sings a concert I am NOT part of → must never surface.
        cast(outsider, other_concert, self.piece1, 'B1')
        # A finished concert I sang in → excluded (only open concerts).
        cast(self.me, past_concert, piece_past, 'T1')
        cast(done_mate, past_concert, piece_past, 'T2')

    def _get(self):
        self.client.force_authenticate(user=self.user)
        return self.client.get('/api/documents/my-ensemble/')

    def test_requires_authentication(self):
        response = self.client.get('/api/documents/my-ensemble/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_only_my_open_concerts(self):
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [c['title'] for c in response.data['concerts']]
        self.assertEqual(titles, ['Koncert Wiosenny'])  # not 'Inny Koncert', not 'Stary Koncert'

    def test_pieces_grouped_by_per_piece_voice_line(self):
        response = self._get()
        concert = response.data['concerts'][0]
        pieces = {p['title']: p for p in concert['pieces']}
        self.assertEqual(set(pieces), {'Lacrimosa', 'Ave Maria'})

        lacrimosa = {s['voice_line']: s for s in pieces['Lacrimosa']['sections']}
        self.assertEqual(set(lacrimosa), {'T2', 'S1'})
        # My own T2 line: me + Adam, and the section is flagged as mine.
        t2 = lacrimosa['T2']
        self.assertTrue(t2['is_mine'])
        names = {f"{m['first_name']} {m['last_name']}" for m in t2['members']}
        self.assertEqual(names, {'Jan Tenor', 'Adam Linia'})
        self.assertTrue(any(m['is_me'] for m in t2['members']))
        self.assertFalse(lacrimosa['S1']['is_mine'])

    def test_outsider_from_other_concert_not_visible(self):
        import json
        blob = json.dumps(self._get().data)
        self.assertNotIn('Obcy', blob)
        self.assertNotIn('Stary', blob)  # done-concert co-singer absent

    def test_never_leaks_private_or_default_voice_data(self):
        import json
        blob = json.dumps(self._get().data).lower()
        for needle in ('sight_reading', 'vocal_range'):
            self.assertNotIn(needle, blob)
        # Co-singers carry only the per-piece voice line, never a default voice_type.
        member = self._get().data['concerts'][0]['pieces'][0]['sections'][0]['members'][0]
        self.assertNotIn('voice_type', member)

    def test_manager_without_artist_profile_gets_no_concerts(self):
        manager = User.objects.create_user(
            username='maestro', email='maestro@example.com', password='password123', is_staff=True,
        )
        self.client.force_authenticate(user=manager)
        response = self.client.get('/api/documents/my-ensemble/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['me']['is_linked'])
        self.assertEqual(response.data['concerts'], [])


class DocumentDtoTests(SimpleTestCase):
    def test_allowed_roles_are_immutable_inside_dto(self):
        dto = DocumentCategoryCreateDTO(
            name="Knowledge Base",
            slug="knowledge-base",
            icon_key="BookOpen",
            allowed_roles=[AppRole.ARTIST],
        )

        self.assertEqual(dto.allowed_roles, (AppRole.ARTIST,))
        self.assertFalse(hasattr(dto.allowed_roles, "append"))
