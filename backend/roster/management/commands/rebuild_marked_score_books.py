"""
@file roster/management/commands/rebuild_marked_score_books.py
@description Queues a rebuild of every generated score book whose
             `include_markings` is on. A book built before the builder stopped
             baking marks (`BUILD_FORMAT` 2) carries the 'shared' layer in its
             bytes, and every copy that leaves the app composes that layer again
             on top of it: doubled marks on paper. Nothing else rebuilds those
             books in bulk, so this runs once after deploying that builder.

             Skipped: a hand-uploaded book (never baked, and with no page map
             to compose onto), a package with no file yet, and a build still in
             flight, which `request_generation` would leave running anyway. A
             book rebuilt here reads as a new build no singer has yet, exactly
             as after the conductor's own "Złóż".

@module roster/management/commands/rebuild_marked_score_books
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q

from roster.models import ScorePackage
from roster.score_package_service import ScorePackageService, build_is_abandoned


class Command(BaseCommand):
    help = "Queue a rebuild of every generated score book with the conductor's markings on."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="List the books that would be rebuilt without queuing anything.",
        )

    def handle(self, *args, **options) -> None:
        dry_run: bool = options['dry_run']
        packages = (
            ScorePackage.objects
            .filter(include_markings=True, is_manual_upload=False, project__is_deleted=False)
            .exclude(Q(project__score_pdf='') | Q(project__score_pdf__isnull=True))
            .select_related('project')
            .order_by('project__title')
        )
        in_flight = {ScorePackage.Status.QUEUED, ScorePackage.Status.BUILDING}
        verb = "Would queue" if dry_run else "Queued"
        queued = 0
        building = 0
        for package in packages:
            title = package.project.title
            if package.status in in_flight and not build_is_abandoned(package):
                building += 1
                self.stdout.write(f"  Already building: {title!r}")
                continue
            if not dry_run:
                ScorePackageService.request_generation(package.project)
            queued += 1
            self.stdout.write(f"  {verb}: {title!r}")

        self.stdout.write(self.style.SUCCESS(
            f"{verb} {queued} book(s); {building} already building."
        ))
        if dry_run and queued:
            self.stdout.write("Dry run — re-run without --dry-run to queue them.")
