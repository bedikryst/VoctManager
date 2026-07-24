"""
Core admin.

`UserProfile` has no standalone entry on purpose: it is preferences *of* a
person and is meaningless detached from one, so it is edited as an inline on the
account. That composition lives in `roster.admin`, the layer allowed to know
about both the account and the choral profile — core must not import from it.
"""