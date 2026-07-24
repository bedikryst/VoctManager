"""
Makes the account e-mail a real identifier at the database level.

Authentication resolves accounts with `email__iexact`, and every application-side
guard against a duplicate is a check-then-insert with a gap in between. Two
requests landing in that gap produce two accounts on one address, after which
sign-in picks between them arbitrarily. Only the database can close that.

Expressed as raw SQL because the table belongs to `django.contrib.auth`, not to
this project — there is no model here on which to hang a `UniqueConstraint`.

Two deliberate properties:
  * `LOWER(email)` — case-insensitive, matching how authentication actually looks
    accounts up. A plain unique column would still admit `Ada@` beside `ada@`.
  * `WHERE email <> ''` — partial, because `AbstractUser.email` is blankable and
    several blank rows are not a collision to resolve; they are accounts that
    simply cannot sign in.

Run `manage.py audit_account_emails` first: this fails loudly, mid-deploy, if the
data already violates it.

Not CONCURRENTLY on purpose. That would demand a non-atomic migration and can
leave an INVALID index behind on failure; against a roster of this size the plain
build holds its lock for a moment.
"""

from django.conf import settings
from django.db import migrations

INDEX_NAME = "voct_user_email_ci_uniq"

CREATE_INDEX = f"""
    CREATE UNIQUE INDEX {INDEX_NAME}
    ON auth_user (LOWER(email))
    WHERE email <> '';
"""

DROP_INDEX = f"DROP INDEX IF EXISTS {INDEX_NAME};"


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_remove_userprofile_dietary_notes_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_INDEX, reverse_sql=DROP_INDEX),
    ]
