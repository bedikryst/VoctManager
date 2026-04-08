# roster/management/commands/seed_db.py
# ==========================================
# Database Seeder (Enterprise SaaS 2026)
# ==========================================
"""
Generates a robust, realistic dataset for local development and testing.
Includes Superuser generation, cross-domain Profile/Logistics syncing, 
JSON run-sheets, and advanced micro-casting (ProjectPieceCasting).
"""

import random
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

# Core
from core.constants import VoiceLine
from core.models import UserProfile, DietaryChoices, ClothingSizeChoices

# Archive
from archive.models import Composer, Piece, PieceVoiceRequirement

# Roster
from roster.models import (
    Artist, Project, Participation, VoiceType, ProgramItem, 
    Rehearsal, Attendance, Collaborator, CrewAssignment, ProjectPieceCasting
)
from roster.services import provision_artist_with_user_account
from roster.dtos import ArtistCreateDTO


class Command(BaseCommand):
    help = 'Generates an Enterprise-grade test dataset for VoctManager.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("🚀 Inicjalizacja Enterprise Seeder... Proszę czekać (hashowanie haseł zajmuje chwilę)."))

        with transaction.atomic():
            self._seed_admin()
            self._seed_archive()
            artists = self._seed_roster_and_profiles()
            crew = self._seed_collaborators()
            self._seed_projects_and_logistics(artists, crew)

        self.stdout.write(self.style.SUCCESS('\n✅ SUKCES! Baza danych (Enterprise 2026) jest gotowa do pracy.'))
        self.stdout.write(self.style.SUCCESS('👉 Zaloguj się jako: admin (Hasło: admin123)'))

    def _seed_admin(self):
        self.stdout.write("0. Generowanie konta Administratora...")
        if not User.objects.filter(username='admin').exists():
            admin = User.objects.create_superuser('admin', 'admin@voctmanager.test', 'admin123')
            admin.first_name = "Główny"
            admin.last_name = "Dyrygent"
            admin.save()
            # Upewniamy się, że admin też ma UserProfile
            UserProfile.objects.get_or_create(user=admin, defaults={'timezone': 'Europe/Warsaw'})

    def _seed_archive(self):
        self.stdout.write("1. Generowanie Archiwum (Kompozytorzy i Utwory)...")
        from archive.models import EpochChoices
        composers_data = [
            ("Wolfgang Amadeus", "Mozart", "1756", "1791"),
            ("Johann Sebastian", "Bach", "1685", "1750"),
            ("Arvo", "Pärt", "1935", ""),
            ("Wacław", "z Szamotuł", "1520", "1560"),
            ("Eric", "Whitacre", "1970", ""),
        ]
        
        composers = []
        for fn, ln, by, dy in composers_data:
            comp, _ = Composer.objects.get_or_create(first_name=fn, last_name=ln, defaults={'birth_year': by, 'death_year': dy})
            composers.append(comp)

        # Używamy prostych stringów zamiast EpochChoices (na wypadek ich braku w modelu z pliku)
        pieces_data = [
            ("Ave Verum Corpus", composers[0], EpochChoices.CLASSICAL, "Latin", "SATB"),
            ("Magnificat", composers[1], EpochChoices.BAROQUE, "Latin", "SSATB"),
            ("Bogoroditse Devo", composers[2], EpochChoices.CONTEMPORARY, "Church Slavonic", "SATB"),
            ("Już się zmierzcha", composers[3], EpochChoices.RENAISSANCE, "Polish", "SATB"),
            ("Sleep", composers[4], EpochChoices.CONTEMPORARY, "English", "SSAATTBB"),
        ]
        
        for title, comp, epoch, lang, voicing in pieces_data:
            piece, created = Piece.objects.get_or_create(title=title, defaults={
                'composer': comp, 'epoch': epoch, 'language': lang, 'voicing': voicing,
                'estimated_duration': random.randint(180, 600)
            })
            
            if created:
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.SOPRANO_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.ALTO_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.TENOR_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.BASS_1, quantity=random.randint(2, 6))

    def _seed_roster_and_profiles(self):
        self.stdout.write("2. Generowanie Chórzystów & Profili (Logistyka, Rozmiary, Diety)...")
        
        first_names_f = ["Anna", "Maria", "Katarzyna", "Małgorzata", "Agnieszka", "Barbara", "Ewa", "Krystyna"]
        first_names_m = ["Piotr", "Krzysztof", "Andrzej", "Tomasz", "Jan", "Michał", "Marcin", "Jakub"]
        last_names = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak"]
        
        artists = []
        for i in range(24):
            is_female = i < 12
            fn = random.choice(first_names_f if is_female else first_names_m)
            ln = random.choice(last_names)
            voice = random.choice([VoiceType.SOPRANO, VoiceType.ALTO]) if is_female else random.choice([VoiceType.TENOR, VoiceType.BASS])
            email = f"{fn.lower()}.{ln.lower()}{i}@voctmanager.test"

            artist = Artist.objects.filter(email=email).first()
            if not artist:
                artist_dto = ArtistCreateDTO(
                    first_name=fn, 
                    last_name=ln, 
                    email=email, 
                    voice_type=voice,
                    phone_number=f"+48 {random.randint(500, 899)} {random.randint(100, 999)} {random.randint(100, 999)}",
                    sight_reading_skill=random.randint(2, 5)
                )
                artist = provision_artist_with_user_account(artist_dto)
                
                # 2. Synchronizacja z nowym modułem logistycznym (Core)
                profile = artist.user.profile
                profile.dietary_preference = random.choices(
                    [DietaryChoices.NONE, DietaryChoices.VEGE, DietaryChoices.VEGAN, DietaryChoices.GF, DietaryChoices.LF],
                    weights=[60, 15, 5, 10, 10], k=1
                )[0]
                profile.clothing_size = random.choice([ClothingSizeChoices.S, ClothingSizeChoices.M, ClothingSizeChoices.L, ClothingSizeChoices.XL])
                profile.shoe_size = str(random.randint(37, 41) if is_female else random.randint(41, 46))
                profile.height_cm = random.randint(158, 180) if is_female else random.randint(170, 195)
                profile.timezone = 'Europe/Warsaw'
                
                if profile.dietary_preference != DietaryChoices.NONE:
                    profile.dietary_notes = random.choice(["Uczulenie na orzechy", "Proszę bez papryki", "Alergia na owoce morza", ""])

                profile.save()
                
            artists.append(artist)
            
        return artists

    def _seed_collaborators(self):
        self.stdout.write("3. Generowanie Ekipy Technicznej (Crew)...")
        crew_data = [
            ("Jan", "Dźwiękowiec", Collaborator.Specialty.SOUND, "SoundTech Pro"),
            ("Marek", "Świetlik", Collaborator.Specialty.LIGHT, "LumenFX"),
            ("Kasia", "Logistyk", Collaborator.Specialty.LOGISTICS, "EventMasters"),
        ]
        
        crew = []
        for fn, ln, spec, company in crew_data:
            collab, _ = Collaborator.objects.get_or_create(
                first_name=fn, last_name=ln, 
                defaults={'specialty': spec, 'company_name': company, 'email': f"{fn.lower()}@{company.lower().replace(' ', '')}.test"}
            )
            crew.append(collab)
        return crew

    def _seed_projects_and_logistics(self, artists, crew):
        self.stdout.write("4. Generowanie Projektów: Setlisty, Run-sheets, Próby i Mikro-Obsady...")
        
        projects_data = [
            ("Festiwal Muzyki Dawnej (Trasa)", Project.Status.COMPLETED, -15),
            ("Koncert Wiosenny (Gala)", Project.Status.ACTIVE, 15),
            ("Sesja Nagraniowa: A Cappella", Project.Status.DRAFT, 60),
        ]
        
        all_pieces = list(Piece.objects.all())

        for title, status, days_offset in projects_data:
            project_date = timezone.now() + timedelta(days=days_offset)
            call_time = project_date - timedelta(hours=3) # Zbiórka 3h przed startem
            
            project, created = Project.objects.get_or_create(title=title, defaults={
                'date_time': project_date,
                'call_time': call_time,
                'status': status,
                'location': "Filharmonia Narodowa" if status == Project.Status.ACTIVE else "Studio S1",
                'description': "Wydarzenie z pełną obsługą logistyczną i z cateringiem.",
                'dress_code_male': "Frak czarny, biała mucha",
                'dress_code_female': "Standardowa czarna suknia chóralna",
                'spotify_playlist_url': "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
                'run_sheet': [
                    {"time": call_time.strftime('%H:%M'), "task": "Zbiórka na miejscu i stroje", "location": "Garderoby"},
                    {"time": (call_time + timedelta(minutes=30)).strftime('%H:%M'), "task": "Próba akustyczna", "location": "Scena Główna"},
                    {"time": (call_time + timedelta(hours=2)).strftime('%H:%M'), "task": "Catering / Obiad", "location": "Foyer"},
                    {"time": project_date.strftime('%H:%M'), "task": "ROZPOCZĘCIE KONCERTU", "location": "Scena Główna"}
                ]
            })

            if not created:
                continue 
                
            # A) PRZYPISANIE CHÓRU
            invited_artists = random.sample(artists, k=16)
            participations = []
            for artist in invited_artists:
                p, _ = Participation.objects.get_or_create(
                    artist=artist, project=project, 
                    defaults={'status': Participation.Status.CONFIRMED, 'fee': random.choice([200, 250, 300, 400])}
                )
                participations.append(p)

            # B) PRZYPISANIE EKIPY
            for collab in crew:
                CrewAssignment.objects.get_or_create(
                    collaborator=collab, project=project,
                    defaults={'status': CrewAssignment.Status.CONFIRMED, 'fee': 1000, 'role_description': f"Obsługa {collab.get_specialty_display()}"}
                )

            # C) PROGRAM (SETLISTA) I MICRO-CASTING
            project_pieces = random.sample(all_pieces, k=random.randint(3, 5))
            for idx, piece in enumerate(project_pieces):
                ProgramItem.objects.get_or_create(
                    project=project, piece=piece, 
                    defaults={'order': idx + 1, 'is_encore': (idx == len(project_pieces)-1)}
                )
                
                # Enterprise: Przypisywanie artystów do poszczególnych linii melodycznych utworu
                for p in participations:
                    # Dopasowanie "na brudno" VoiceType (np. SOPRANO) do VoiceLine (np. SOPRAN_1)
                    v_line = None
                    if p.artist.voice_type == VoiceType.SOPRANO: v_line = VoiceLine.SOPRANO_1
                    elif p.artist.voice_type == VoiceType.ALTO: v_line = VoiceLine.ALTO_1
                    elif p.artist.voice_type == VoiceType.TENOR: v_line = VoiceLine.TENOR_1
                    elif p.artist.voice_type == VoiceType.BASS: v_line = VoiceLine.BASS_1
                    else: v_line = VoiceLine.SOPRANO_2

                    ProjectPieceCasting.objects.get_or_create(
                        participation=p, piece=piece,
                        defaults={
                            'voice_line': v_line,
                            'gives_pitch': (v_line == VoiceLine.SOPRANO_1 and random.random() > 0.8) # 20% szans na podawanie dźwięku
                        }
                    )

            # D) HARMONOGRAM PRÓB I OBECNOŚCI
            for r_idx in range(1, 4):
                rehearsal_date = project_date - timedelta(days=r_idx * 3)
                rehearsal = Rehearsal.objects.create(
                    project=project,
                    date_time=rehearsal_date,
                    location="Sala Prób A",
                    focus=f"Praca nad repertuarem (Część {4-r_idx})",
                    is_mandatory=True
                )
                
                rehearsal.invited_participations.set(participations)
                
                for p in participations:
                    status_choice = random.choices(
                        [Attendance.Status.PRESENT, Attendance.Status.LATE, Attendance.Status.EXCUSED, Attendance.Status.ABSENT],
                        weights=[80, 10, 5, 5], k=1
                    )[0]
                    
                    Attendance.objects.create(
                        rehearsal=rehearsal, participation=p, status=status_choice,
                        minutes_late=random.randint(5, 20) if status_choice == Attendance.Status.LATE else None,
                        excuse_note="Korek" if status_choice == Attendance.Status.EXCUSED else ""
                    )