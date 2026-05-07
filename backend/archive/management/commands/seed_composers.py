import json
import os
from django.core.management.base import BaseCommand
from archive.models import Composer


class Command(BaseCommand):
    help = 'Seed composers from seed_composers.json'

    def handle(self, *args, **options):
        # Path to the JSON file
        json_file_path = os.path.join(os.path.dirname(__file__), '..', '..', 'seed_composers.json')
        
        # Load data from JSON
        with open(json_file_path, 'r', encoding='utf-8') as f:
            composers_data = json.load(f)
        
        # Seed composers
        for composer_data in composers_data:
            composer, created = Composer.objects.get_or_create(
                first_name=composer_data['first_name'],
                last_name=composer_data['last_name'],
                defaults={
                    'birth_year': composer_data['birth_year'],
                    'death_year': composer_data['death_year']
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created composer: {composer.first_name} {composer.last_name}'))
            else:
                self.stdout.write(f'Composer already exists: {composer.first_name} {composer.last_name}')