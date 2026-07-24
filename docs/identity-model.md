# Identity model — User / UserProfile / Artist

Who owns which field, which invariants hold, and how to deploy the change that
made the account e-mail a real identifier.

## Ownership

One field, one owner. Anything else drifts silently.

| Concern | Owner | Notes |
|---|---|---|
| Sign-in identity (e-mail, password, `is_active`) | `auth.User` | `User.is_active` is the **only** login gate |
| Name (`first_name` / `last_name`) | `auth.User` | the roster row holds a projection, never an edit |
| Preferences, avatar, business role, **vocative** | `core.UserProfile` | one row per account, created at provisioning |
| Choral role (voice, sight-reading, range) | `roster.Artist` | survives the account: `user` is `SET_NULL` |

`Artist` also carries `first_name` / `last_name` / `email` / `phone_number`. That
duplication is deliberate — GDPR erasure detaches the account and the row has to
keep concert history and ZAiKS contracts readable — but those columns are a
**projection, not a second source of truth**. Two paths write them, both copying
downward from the account: `ArtistHRService` (a manager's roster edit) and the
`user_pii_updated` signal (the member's own settings). A detached row is the one
case where it owns its values, because there is no longer an account to own them.

Column widths on that projection track `AbstractUser` (150), not what a form
feels like allowing. The signal writes through without serializer validation, so
a narrower column here rejects a name the account already accepted — and only on
PostgreSQL, which is how the same bug in `phone_number` survived so long.

The Polish vocative lives on `UserProfile` rather than on the choral profile: a
form of address belongs to the person, and managers and crew are greeted too
without ever having an `Artist` row. `core.greetings` resolves it in one place —
Polish takes the vocative, every other language the nominative, a missing
vocative falls back to the first name.

## Invariants

1. **"Who is a manager" has one definition.** `core.permissions.user_is_manager`
   (predicate) and `MANAGER_QUERY_FILTER` (queryset filter). Never write a local
   role check: there were eight, and two disagreed about `is_staff`, so the same
   person was a manager on one screen and not on the next. `is_staff` counts as
   manager; `IsArtist` / `IsCrew` deliberately do **not** mirror that.

2. **Archived state moves only through `ArtistHRService.archive_artist` /
   `restore_artist`.** `Artist.is_active`, `Artist.is_deleted` and the account's
   login gate move together, in one transaction. Any other path can present a
   singer as archived while they keep signing in. Both flags are read-only in the
   API and in the admin for this reason.

3. **The artist e-mail is a credential, not a form field.** Edits route through
   `ArtistHRService.update_artist` → `_rewrite_email`:
   - **activated account** → refused (`artist_email_locked`); past activation the
     address belongs to its owner, who changes it in their own settings;
   - **pending invite** → both sides updated, bounce suppression cleared, and the
     invitation re-issued (the signed token hashes the address, so the previous
     link is already dead);
   - **detached account** (post-erasure) → archival label only.

   Uniqueness is checked against **both** tables: a manager or crew account has
   no `Artist` row, so the serializer's own check alone would let it through.

4. **`voct_user_email_ci_uniq`** — partial unique index on
   `auth_user (LOWER(email)) WHERE email <> ''` (migration `core/0021`). Raw SQL
   because the table belongs to `django.contrib.auth`. Case-insensitive to match
   how authentication looks accounts up (`email__iexact`); partial because
   `AbstractUser.email` is blankable and blank rows are not a collision. All
   three write paths translate the resulting `IntegrityError` into the ordinary
   duplicate-email domain error, so a lost race is not a 500.

## Deploying the uniqueness constraint

Order matters — the migration fails mid-deploy if the data already violates it.

```bash
# 1. Pre-flight. Read-only; exits non-zero if duplicates exist.
docker compose exec web python manage.py audit_account_emails

# 2. If it reports drifted roster rows, realign them to their account:
docker compose exec web python manage.py audit_account_emails --fix-drift

# 3. If it reports duplicates, resolve them BY HAND before going further.
#    Merging two accounts decides which one keeps the concert history, the
#    messages and the notifications. The command will not do it for you.

# 4. Only once step 1 passes cleanly:
docker compose exec web python manage.py migrate core
```

The index is built without `CONCURRENTLY` on purpose: that would require a
non-atomic migration and can leave an `INVALID` index behind on failure. Against
a roster of this size the plain build holds its lock momentarily.

### Testing gotcha

After this migration the ORM can no longer create a duplicate — which is also
true in tests. A test that *needs* the duplicate state (the pre-flight command's
own coverage) must `DROP INDEX IF EXISTS voct_user_email_ci_uniq` and restore
nothing: SQLite and PostgreSQL both have transactional DDL, so the `TestCase`
rollback puts it back. Rebuilding it in a `finally` fails — the duplicate rows
are still there at that point.

## Deploying the ownership move

`core/0022` + `roster/0035` carry every stored vocative onto the account profile
and then drop the roster column. Nothing to check first — the copy is skipped for
rows whose account was already detached, which is correct: a vocative exists to
address someone, and there is no longer anyone to address. Both directions are
reversible.

One behavioural change to expect: a manager renaming a singer in the roster now
renames the **account**. That is the point, but it means the singer's own
settings screen, their greetings and every e-mail follow the manager's edit
immediately, where before they kept the original name indefinitely.

## Not done

- **Custom `User` model / UUID primary key.** Measured: 14 FKs to
  `AUTH_USER_MODEL` across 8 apps; every model already uses the swappable
  setting. The remaining gain is real but modest: `USERNAME_FIELD = 'email'`
  would delete the `username = uuid4()` filler, the custom auth backend and the
  serializer's `del self.fields['username']`, and align the PK type with the rest
  of the domain.

  Django does not support swapping `AUTH_USER_MODEL` mid-project, so the entire
  cost is migrating existing data — which a planned database reset removes. If
  the test data is going to be wiped before real members are onboarded, do this
  **at that reset** (delete the migration files, regenerate against an empty
  database) and not otherwise; `payments` has no FK to anything, so the donation
  records that must survive travel independently of the auth tables. If the reset
  slips past onboarding, drop the idea rather than attempt it on live data.
