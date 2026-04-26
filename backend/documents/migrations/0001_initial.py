from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.contrib.postgres.indexes
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentCategory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('name', models.CharField(max_length=120, verbose_name='Category Name')),
                ('slug', models.SlugField(max_length=120, unique=True, verbose_name='URL Slug')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('icon_key', models.CharField(
                    choices=[
                        ('BookOpen', 'Book Open'),
                        ('Shirt', 'Shirt / Wardrobe'),
                        ('FileText', 'File / Document'),
                        ('Shield', 'Shield / Policy'),
                        ('HeartPulse', 'Health / Medical'),
                        ('Music', 'Music'),
                        ('Users', 'Group / Team'),
                        ('Briefcase', 'Briefcase / Work'),
                        ('MapPin', 'Location / Map'),
                        ('Landmark', 'Institution / Foundation'),
                        ('GraduationCap', 'Education / Training'),
                        ('ScrollText', 'Scroll / Statute'),
                        ('Scale', 'Scale / Legal'),
                        ('Mic2', 'Microphone / Performance'),
                    ],
                    default='BookOpen',
                    max_length=20,
                    verbose_name='Icon',
                )),
                ('order', models.PositiveSmallIntegerField(default=0, verbose_name='Display Order')),
                ('allowed_roles', models.JSONField(
                    default=list,
                    help_text="JSON array of role codes that can view this category. E.g. ['ARTIST', 'MANAGER']",
                    verbose_name='Allowed Roles',
                )),
            ],
            options={
                'verbose_name': 'Document Category',
                'verbose_name_plural': 'Document Categories',
                'ordering': ['order', 'name'],
                'indexes': [
                    django.contrib.postgres.indexes.GinIndex(fields=['allowed_roles'], name='documents_d_allowed_84dbb0_gin'),
                    models.Index(fields=['is_deleted', 'order'], name='documents_d_is_dele_932943_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('title', models.CharField(max_length=255, verbose_name='Document Title')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('file', models.FileField(upload_to='documents/%Y/%m/', verbose_name='File')),
                ('file_size_bytes', models.PositiveBigIntegerField(default=0, verbose_name='File Size (bytes)')),
                ('mime_type', models.CharField(default='application/pdf', max_length=100, verbose_name='MIME Type')),
                ('allowed_roles', models.JSONField(
                    default=list,
                    help_text='Overrides category roles when non-empty. Leave empty to inherit from category.',
                    verbose_name='Allowed Roles Override',
                )),
                ('order', models.PositiveSmallIntegerField(default=0, verbose_name='Display Order')),
                ('category', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='documents',
                    to='documents.documentcategory',
                    verbose_name='Category',
                )),
                ('uploaded_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='uploaded_documents',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Uploaded By',
                )),
            ],
            options={
                'verbose_name': 'Document',
                'verbose_name_plural': 'Documents',
                'ordering': ['order', 'title'],
            },
        ),
    ]

