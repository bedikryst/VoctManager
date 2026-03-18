import random
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from roster.models import Artist, Project, Participation, VoiceType
from archive.models import Composer, Piece, EpochChoices

class Command(BaseCommand):
    help = 'Generuje realistyczne dane testowe dla aplikacji zarządzania chórem.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Rozpoczynam generowanie danych...")

        # 1. GENEROWANIE KOMPOZYTORÓW
        composers_data = [
            ("Wolfgang Amadeus", "Mozart", "1756", "1791"),
            ("Johann Sebastian", "Bach", "1685", "1750"),
            ("Arvo", "Pärt", "1935", None),
            ("Wacław", "z Szamotuł", "1520", "1560"),
            ("Eric", "Whitacre", "1970", None),
        ]
        composers = []
        for fn, ln, by, dy in composers_data:
            comp, _ = Composer.objects.get_or_create(first_name=fn, last_name=ln, defaults={'birth_year': by, 'death_year': dy})
            composers.append(comp)

        # 2. GENEROWANIE UTWORÓW
        pieces_data = [
            ("Ave Verum Corpus", composers[0], EpochChoices.CLASSICAL, "Łacina", "SATB"),
            ("Magnificat", composers[1], EpochChoices.BAROQUE, "Łacina", "SSATB"),
            ("Bogoroditse Devo", composers[2], EpochChoices.CONTEMPORARY, "Cerkiewnosłowiański", "SATB"),
            ("Już się zmierzcha", composers[3], EpochChoices.RENAISSANCE, "Polski", "SATB"),
            ("Sleep", composers[4], EpochChoices.CONTEMPORARY, "Angielski", "SSAATTBB"),
        ]
        for title, comp, epoch, lang, voicing in pieces_data:
            Piece.objects.get_or_create(title=title, defaults={
                'composer': comp, 'epoch': epoch, 'language': lang, 'voicing': voicing
            })

        # 3. GENEROWANIE ARTYSTÓW (CHÓRZYSTÓW)
        first_names_f = ["Anna", "Maria", "Katarzyna", "Małgorzata", "Agnieszka", "Barbara", "Ewa", "Krystyna"]
        first_names_m = ["Piotr", "Krzysztof", "Andrzej", "Tomasz", "Jan", "Michał", "Marcin", "Jakub"]
        last_names = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak"]

        voices_f = [VoiceType.SOPRANO, VoiceType.MEZZO, VoiceType.ALTO]
        voices_m = [VoiceType.TENOR, VoiceType.BARITONE, VoiceType.BASS]

        artists = []
        # Generujemy 24 osoby do chóru
        for i in range(24):
            is_female = i < 12
            fn = random.choice(first_names_f if is_female else first_names_m)
            ln = random.choice(last_names)
            voice = random.choice(voices_f if is_female else voices_m)
            email = f"{fn.lower()}.{ln.lower()}{i}@example.com"

            artist, created = Artist.objects.get_or_create(email=email, defaults={
                'first_name': fn,
                'last_name': ln,
                'voice_type': voice,
                'sight_reading_skill': random.randint(3, 5)
            })
            artists.append(artist)

        # 4. GENEROWANIE PROJEKTÓW I PRZYPISANIE CHÓRZYSTÓW
        project_titles = ["Koncert Wiosenny", "Sesja Nagraniowa: Muzyka Sakralna", "Festiwal Muzyki Dawnej"]
        for idx, p_title in enumerate(project_titles):
            project, _ = Project.objects.get_or_create(title=p_title, defaults={
                'date_time': timezone.now() + timedelta(days=30 * (idx + 1)),
                'status': Project.Status.ACTIVE,
                'location': "Filharmonia Narodowa" if idx == 0 else "Studio S1",
                'description': "Wydarzenie testowe wygenerowane automatycznie."
            })

            # Przypisujemy losowych chórzystów do projektów (tworzymy kontrakty)
            invited_artists = random.sample(artists, k=16) # Wybieramy 16 z 24
            for artist in invited_artists:
                Participation.objects.get_or_create(
                    artist=artist, 
                    project=project, 
                    defaults={'status': random.choice([Participation.Status.CONFIRMED, Participation.Status.INVITED])}
                )

        self.stdout.write(self.style.SUCCESS('Sukces! Baza danych została wypełniona testowym repertuarem, projektami i artystami.'))