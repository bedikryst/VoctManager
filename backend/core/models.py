# core/models.py
# ==========================================
# Core Database Models & Managers
# ==========================================
import uuid
from django.db import models
from django.utils import timezone

class ActiveManager(models.Manager):
    """
    Default manager that filters out 'soft-deleted' objects globally.
    Ensures that deleted records do not appear in standard queries.
    """
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


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
        """
        Soft-deletes the record instead of removing it from the database.
        Explicitly updates the 'updated_at' timestamp.
        """
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