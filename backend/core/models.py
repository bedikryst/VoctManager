# core/models.py
# ==========================================
# Core Database Models & Managers
# ==========================================
import uuid
from django.db import models
from django.utils import timezone

class SoftDeleteQuerySet(models.QuerySet):
    """
    Enterprise safeguard preventing accidental bulk hard-deletions.
    Intercepts standard .delete() calls on querysets and routes them to soft-delete.
    """
    def delete(self):
        return super().update(is_deleted=True, updated_at=timezone.now())

    def hard_delete(self):
        """Explicit escape hatch for GDPR compliance or data purging."""
        return super().delete()

class ActiveManager(models.Manager):
    """Global manager filtering out soft-deleted records."""
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)


class EnterpriseBaseModel(models.Model):
    """
    Abstract base model providing UUID primary keys, timestamp tracking, 
    and soft-delete functionality for all operational models.
    
    CRITICAL ARCHITECTURE NOTE:
    Because this model uses Soft Delete, child models referencing it via ForeignKey 
    SHOULD AVOID using `on_delete=models.CASCADE`. Standard database cascades bypass 
    the soft-delete logic and will permanently delete related objects. 
    Use `on_delete=models.RESTRICT` or custom cascade managers instead.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    # Managers
    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Single-instance soft delete."""
        self.is_deleted = True
        self.updated_at = timezone.now()
        self.save(update_fields=['is_deleted', 'updated_at'])

    def restore(self):
        """
        Restores a soft-deleted record.
        """
        self.is_deleted = False
        self.updated_at = timezone.now()
        self.save(update_fields=['is_deleted', 'updated_at'])