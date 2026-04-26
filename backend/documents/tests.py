from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import DocumentCategory, Document
from core.constants import AppRole

User = get_user_model()


class DocumentCategoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.artist_user = User.objects.create_user(
            email='artist@example.com',
            password='password123',
        )
        self.manager_user = User.objects.create_user(
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
        response = self.client.get('/api/v1/documents/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [cat['slug'] for cat in response.data]
        self.assertIn('artist-visible', slugs)
        self.assertNotIn('manager-only', slugs)

    def test_document_inherits_roles_from_category(self):
        self.assertEqual(self.document.effective_roles, [AppRole.ARTIST])

    def test_is_manager_sees_all_categories(self):
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get('/api/v1/documents/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [cat['slug'] for cat in response.data]
        self.assertIn('artist-visible', slugs)
        self.assertIn('manager-only', slugs)
