# roster/management/commands/seed_db.py
# ==========================================
# Database Seeder (Enterprise 2026)
# ==========================================
"""
Generates a robust, realistic dataset for local development and testing.
Utilizes the Service Layer to ensure all business rules (like User provisioning)
are strictly followed during data generation.
"""

import random
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.core.management.base import BaseCommand

# Core & Constants
from core.constants import VoiceLine
from django.contrib.auth.models import User

# Archive Models
from archive.models import Composer, Piece, EpochChoices, PieceVoiceRequirement

# Roster Models & Services
from roster.models import (
    Artist, Project, Participation, VoiceType, ProgramItem, 
    Rehearsal, Attendance, Collaborator, CrewAssignment
)
from roster.services import provision_artist_with_user_account


class Command(BaseCommand):
    help = 'Generuje bogate, realistyczne dane testowe (Enterprise Standard) dla VoctManager.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Rozpoczynam zasilanie bazy danych... To może chwilę potrwać ze względu na hashowanie haseł użytkowników."))

        with transaction.atomic():
            self._seed_archive()
            artists = self._seed_roster()
            crew = self._seed_collaborators()
            self._seed_projects_and_logistics(artists, crew)

        self.stdout.write(self.style.SUCCESS('\n✅ SUKCES! Baza danych została wypełniona potężnym zestawem testowym.'))
        self.stdout.write(self.style.SUCCESS('Wygenerowano: Kompozytorów, Utwory, 24 Chórzystów (z kontami), Ekipę Techniczną, Projekty, Próby i Obecności!'))

    def _seed_archive(self):
        self.stdout.write("1. Generowanie Archiwum (Kompozytorzy i Utwory)...")
        
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

        pieces_data = [
            ("Ave Verum Corpus", composers[0], EpochChoices.CLASSICAL, "Łacina", "SATB"),
            ("Magnificat", composers[1], EpochChoices.BAROQUE, "Łacina", "SSATB"),
            ("Bogoroditse Devo", composers[2], EpochChoices.CONTEMPORARY, "Cerkiewnosłowiański", "SATB"),
            ("Już się zmierzcha", composers[3], EpochChoices.RENAISSANCE, "Polski", "SATB"),
            ("Sleep", composers[4], EpochChoices.CONTEMPORARY, "Angielski", "SSAATTBB"),
        ]
        
        for title, comp, epoch, lang, voicing in pieces_data:
            piece, created = Piece.objects.get_or_create(title=title, defaults={
                'composer': comp, 'epoch': epoch, 'language': lang, 'voicing': voicing,
                'estimated_duration': random.randint(180, 600)
            })
            
            # Dodanie wymogów głosowych tylko dla nowych utworów
            if created:
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.SOPRAN_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.ALT_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.TENOR_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.BAS_1, quantity=random.randint(2, 6))


    def _seed_roster(self):
        self.stdout.write("2. Generowanie Chórzystów (Korzystanie z Service Layer)...")
        
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
                # ENTERPRISE: Używamy naszego serwisu, by zapewnić atomowość konta User i Artist!
                artist = provision_artist_with_user_account(
                    first_name=fn,
                    last_name=ln,
                    email=email,
                    voice_type=voice,
                    sight_reading_skill=random.randint(3, 5)
                )
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
        self.stdout.write("4. Generowanie Logistyki: Projekty, Setlisty, Próby i Macierz Obecności...")
        
        projects_data = [
            ("Festiwal Muzyki Dawnej", Project.Status.COMPLETED, -15),   # Zakończony (15 dni temu)
            ("Koncert Wiosenny", Project.Status.ACTIVE, 15),        # W przygotowaniu (za 15 dni)
            ("Sesja Nagraniowa: A Cappella", Project.Status.DRAFT, 60), # Planowany (za 60 dni)
        ]
        
        all_pieces = list(Piece.objects.all())

        for title, status, days_offset in projects_data:
            project_date = timezone.now() + timedelta(days=days_offset)
            project, created = Project.objects.get_or_create(title=title, defaults={
                'date_time': project_date,
                'status': status,
                'location': "Filharmonia Narodowa" if status == Project.Status.ACTIVE else "Studio S1",
                'description': "Wydarzenie wygenerowane automatycznie przez system testowy.",
                'dress_code_male': "Czarne garnitury",
                'dress_code_female': "Długie czarne suknie"
            })

            if not created:
                continue # Pomijamy ponowne generowanie dla istniejących projektów
                
            # A) PRZYPISANIE CHÓRU (16 z 24 osób)
            invited_artists = random.sample(artists, k=16)
            participations = []
            for artist in invited_artists:
                p, _ = Participation.objects.get_or_create(
                    artist=artist, project=project, 
                    defaults={
                        'status': Participation.Status.CONFIRMED,
                        'fee': random.choice([200, 250, 300, 400])
                    }
                )
                participations.append(p)

            # B) PRZYPISANIE EKIPY
            for collab in crew:
                CrewAssignment.objects.get_or_create(
                    collaborator=collab, project=project,
                    defaults={'status': CrewAssignment.Status.CONFIRMED, 'fee': 1000}
                )

            # C) PROGRAM (SETLISTA)
            project_pieces = random.sample(all_pieces, k=random.randint(3, 5))
            for idx, piece in enumerate(project_pieces):
                ProgramItem.objects.get_or_create(
                    project=project, piece=piece, 
                    defaults={'order': idx + 1, 'is_encore': (idx == len(project_pieces)-1)}
                )

            # D) HARMONOGRAM PRÓB I OBECNOŚCI
            # Tworzymy 3 próby przed wydarzeniem
            for r_idx in range(1, 4):
                rehearsal_date = project_date - timedelta(days=r_idx * 3)
                rehearsal = Rehearsal.objects.create(
                    project=project,
                    date_time=rehearsal_date,
                    location="Sala Prób A",
                    focus=f"Praca nad repertuarem (Część {4-r_idx})",
                    is_mandatory=True
                )
                
                # Dodajemy zaproszenia
                rehearsal.invited_participations.set(participations)
                
                # Wypełniamy macierz obecności (80% obecnych, reszta spóźnienia lub nieobecności)
                for p in participations:
                    status_choice = random.choices(
                        population=[Attendance.Status.PRESENT, Attendance.Status.LATE, Attendance.Status.EXCUSED, Attendance.Status.ABSENT],
                        weights=[80, 10, 5, 5],
                        k=1
                    )[0]
                    
                    Attendance.objects.create(
                        rehearsal=rehearsal,
                        participation=p,
                        status=status_choice,
                        minutes_late=random.randint(5, 20) if status_choice == Attendance.Status.LATE else None,
                        excuse_note="Korek na mieście" if status_choice == Attendance.Status.EXCUSED else None
                    )