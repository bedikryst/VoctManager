# roster/management/commands/seed_db.py
# ==========================================
# Database Seeder (Enterprise SaaS 2026)
# ==========================================
"""
Generates a robust, realistic dataset for local development, staging, and testing.
Bypasses service layers to remain resilient against refactoring.
"""

import random
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

# Core
from core.constants import VoiceLine, DietaryChoices, ClothingSizeChoices, AppRole
from core.models import UserProfile

# Archive
from archive.models import Composer, Piece, PieceVoiceRequirement, EpochChoices

# Logistics
from logistics.models import Location

# Roster
from roster.models import (
    Artist, Project, Participation, VoiceType, ProgramItem, 
    Rehearsal, Attendance, Collaborator, CrewAssignment, ProjectPieceCasting
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Generates an Enterprise-grade test dataset for VoctManager.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("🚀 Initializing Enterprise Seeder... Please wait (password hashing may take a moment)."))

        with transaction.atomic():
            self.locations = self._seed_logistics_locations()
            self._seed_admin()
            self._seed_archive()
            artists = self._seed_roster_and_profiles()
            crew = self._seed_collaborators()
            self._seed_projects_and_schedule(artists, crew)

        self.stdout.write(self.style.SUCCESS('\n✅ SUCCESS! The Enterprise 2026 database is ready to use.'))
        self.stdout.write(self.style.SUCCESS('👉 Log in as: admin / admin123'))

    def _seed_logistics_locations(self):
        self.stdout.write("0. Seeding Logistics Locations...")
        locations_data = [
            ("National Philharmonic", "Jasna 5, 00-013 Warsaw, Poland", "Europe/Warsaw"),
            ("Studio S1", "Woronicza 17, 00-999 Warsaw, Poland", "Europe/Warsaw"),
            ("Rehearsal Room A", "Złota 1, 00-001 Warsaw, Poland", "Europe/Warsaw")
        ]
        
        locations = []
        for name, address, tz in locations_data:
            loc, _ = Location.objects.get_or_create(
                name=name, 
                defaults={'timezone': tz}
            )
            # Safe attribute assignment in case address isn't in Location by default
            if hasattr(loc, 'address'):
                loc.address = address
                loc.save()
            locations.append(loc)
            
        return locations

    def _seed_admin(self):
        self.stdout.write("1. Generating Administrator Account...")
        if not User.objects.filter(username='admin').exists():
            admin = User.objects.create_superuser('admin', 'admin@voctmanager.test', 'admin123')
            admin.first_name = "Chief"
            admin.last_name = "Conductor"
            admin.save()
            
            # Ensure the admin has an Enterprise UserProfile with Manager Role
            profile, _ = UserProfile.objects.get_or_create(
                user=admin, 
                defaults={
                    'timezone': 'Europe/Warsaw',
                    'role': AppRole.MANAGER
                }
            )
            profile.role = AppRole.MANAGER
            profile.save()

    def _seed_archive(self):
        self.stdout.write("2. Generating Archive (Composers & Repertoire)...")
        
        composers_data = [
            ("Wolfgang Amadeus", "Mozart", "1756", "1791"),
            ("Johann Sebastian", "Bach", "1685", "1750"),
            ("Arvo", "Pärt", "1935", ""),
            ("Wacław", "z Szamotuł", "1520", "1560"),
            ("Eric", "Whitacre", "1970", ""),
        ]
        
        composers = []
        for fn, ln, by, dy in composers_data:
            comp, _ = Composer.objects.get_or_create(
                first_name=fn, 
                last_name=ln, 
                defaults={'birth_year': by, 'death_year': dy}
            )
            composers.append(comp)

        pieces_data = [
            ("Ave Verum Corpus", composers[0], EpochChoices.CLASSICAL, "Latin", "SATB"),
            ("Magnificat", composers[1], EpochChoices.BAROQUE, "Latin", "SSATB"),
            ("Bogoroditse Devo", composers[2], EpochChoices.CONTEMPORARY, "Church Slavonic", "SATB"),
            ("Już się zmierzcha", composers[3], EpochChoices.RENAISSANCE, "Polish", "SATB"),
            ("Sleep", composers[4], EpochChoices.CONTEMPORARY, "English", "SSAATTBB"),
        ]
        
        for title, comp, epoch, lang, voicing in pieces_data:
            piece, created = Piece.objects.get_or_create(title=title, defaults={
                'composer': comp, 
                'epoch': epoch, 
                'language': lang, 
                'voicing': voicing,
                'estimated_duration': random.randint(180, 600)
            })
            
            if created:
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.SOPRANO_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.ALTO_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.TENOR_1, quantity=random.randint(2, 6))
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=VoiceLine.BASS_1, quantity=random.randint(2, 6))

    def _seed_roster_and_profiles(self):
        self.stdout.write("3. Generating Roster Artists & Profiles (Native ORM)...")
        
        first_names_f = ["Emma", "Olivia", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia", "Harper"]
        first_names_m = ["Noah", "Liam", "William", "Mason", "James", "Benjamin", "Jacob", "Michael"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
        
        artists = []
        for i in range(24):
            is_female = i < 12
            fn = random.choice(first_names_f if is_female else first_names_m)
            ln = random.choice(last_names)
            voice = random.choice([VoiceType.SOPRANO, VoiceType.ALTO]) if is_female else random.choice([VoiceType.TENOR, VoiceType.BASS])
            email = f"{fn.lower()}.{ln.lower()}{i}@voctmanager.test"
            phone = f"+1 555 {random.randint(100, 999)} {random.randint(1000, 9999)}"
            sight_reading = random.randint(2, 5)

            artist = Artist.objects.filter(email=email).first()
            if not artist:
                # 1. Create Native Auth User
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password="password123",
                    first_name=fn,
                    last_name=ln
                )
                
                # 2. Sync Enterprise UserProfile
                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.role = AppRole.ARTIST
                profile.phone_number = phone
                profile.dietary_preference = random.choices(
                    [DietaryChoices.NONE, DietaryChoices.VEGE, DietaryChoices.VEGAN, DietaryChoices.GF, DietaryChoices.LF],
                    weights=[60, 15, 5, 10, 10], k=1
                )[0]
                profile.clothing_size = random.choice([ClothingSizeChoices.S, ClothingSizeChoices.M, ClothingSizeChoices.L, ClothingSizeChoices.XL])
                profile.shoe_size = str(random.randint(37, 41) if is_female else random.randint(41, 46))
                profile.height_cm = random.randint(158, 180) if is_female else random.randint(170, 195)
                profile.timezone = 'Europe/Warsaw'
                
                if profile.dietary_preference != DietaryChoices.NONE:
                    profile.dietary_notes = random.choice(["Nut allergy", "No bell peppers please", "Seafood allergy", ""])

                profile.save()

                # 3. Create Roster Artist Entity
                artist = Artist.objects.create(
                    user=user,
                    first_name=fn,
                    last_name=ln,
                    email=email,
                    voice_type=voice,
                    phone_number=phone,
                    sight_reading_skill=sight_reading
                )
                
            artists.append(artist)
            
        return artists

    def _seed_collaborators(self):
        self.stdout.write("4. Generating Technical Crew & Collaborators...")
        crew_data = [
            ("John", "SoundTech", Collaborator.Specialty.SOUND, "SoundTech Pro"),
            ("Mark", "Lighter", Collaborator.Specialty.LIGHT, "LumenFX"),
            ("Kate", "Logistics", Collaborator.Specialty.LOGISTICS, "EventMasters"),
        ]
        
        crew = []
        for fn, ln, spec, company in crew_data:
            collab, _ = Collaborator.objects.get_or_create(
                first_name=fn, 
                last_name=ln, 
                defaults={
                    'specialty': spec, 
                    'company_name': company, 
                    'email': f"{fn.lower()}@{company.lower().replace(' ', '')}.test"
                }
            )
            crew.append(collab)
        return crew

    def _seed_projects_and_schedule(self, artists, crew):
        self.stdout.write("5. Generating Projects: Setlists, Run-sheets, Rehearsals & Micro-Casting...")
        
        philharmonic_loc, studio_loc, rehearsal_loc = self.locations

        projects_data = [
            ("Early Music Festival (Tour)", Project.Status.COMPLETED, -15, philharmonic_loc),
            ("Spring Concert (Gala)", Project.Status.ACTIVE, 15, philharmonic_loc),
            ("Recording Session: A Cappella", Project.Status.DRAFT, 60, studio_loc),
        ]
        
        all_pieces = list(Piece.objects.all())

        for title, status, days_offset, loc in projects_data:
            project_date = timezone.now() + timedelta(days=days_offset)
            call_time = project_date - timedelta(hours=3) # Call time 3 hours before start
            
            project, created = Project.objects.get_or_create(title=title, defaults={
                'date_time': project_date,
                'call_time': call_time,
                'status': status,
                'location': loc,
                'timezone': loc.timezone if hasattr(loc, 'timezone') else 'Europe/Warsaw',
                'description': "Full logistic coverage event including catering and backstage management.",
                'dress_code_male': "Black tailcoat, white bow tie",
                'dress_code_female': "Standard black choral gown",
                'spotify_playlist_url': "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
                'run_sheet': [
                    {"time": call_time.strftime('%H:%M'), "task": "Arrival & Costume Prep", "location": "Dressing Rooms"},
                    {"time": (call_time + timedelta(minutes=30)).strftime('%H:%M'), "task": "Acoustic Rehearsal", "location": "Main Stage"},
                    {"time": (call_time + timedelta(hours=2)).strftime('%H:%M'), "task": "Catering / Dinner", "location": "Foyer"},
                    {"time": project_date.strftime('%H:%M'), "task": "CONCERT START", "location": "Main Stage"}
                ]
            })

            if not created:
                continue 
                
            # A) ARTIST PARTICIPATION
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

            # B) CREW ASSIGNMENT
            for collab in crew:
                CrewAssignment.objects.get_or_create(
                    collaborator=collab, project=project,
                    defaults={
                        'status': CrewAssignment.Status.CONFIRMED, 
                        'fee': 1000, 
                        'role_description': f"{collab.get_specialty_display()} Support"
                    }
                )

            # C) PROGRAM (SETLIST) AND MICRO-CASTING
            project_pieces = random.sample(all_pieces, k=random.randint(3, 5))
            for idx, piece in enumerate(project_pieces):
                ProgramItem.objects.get_or_create(
                    project=project, piece=piece, 
                    defaults={'order': idx + 1, 'is_encore': (idx == len(project_pieces)-1)}
                )
                
                # Assign artists to specific vocal divis in pieces
                for p in participations:
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
                            'gives_pitch': (v_line == VoiceLine.SOPRANO_1 and random.random() > 0.8) 
                        }
                    )

            # D) REHEARSAL SCHEDULE & ATTENDANCES
            for r_idx in range(1, 4):
                rehearsal_date = project_date - timedelta(days=r_idx * 3)
                rehearsal = Rehearsal.objects.create(
                    project=project,
                    date_time=rehearsal_date,
                    location=rehearsal_loc,
                    timezone=rehearsal_loc.timezone if hasattr(rehearsal_loc, 'timezone') else 'Europe/Warsaw',
                    focus=f"Repertoire drilling (Part {4-r_idx})",
                    is_mandatory=True
                )
                
                rehearsal.invited_participations.set(participations)
                
                for p in participations:
                    status_choice = random.choices(
                        [Attendance.Status.PRESENT, Attendance.Status.LATE, Attendance.Status.EXCUSED, Attendance.Status.ABSENT],
                        weights=[80, 10, 5, 5], k=1
                    )[0]
                    
                    Attendance.objects.create(
                        rehearsal=rehearsal, 
                        participation=p, 
                        status=status_choice,
                        minutes_late=random.randint(5, 20) if status_choice == Attendance.Status.LATE else None,
                        excuse_note="Traffic jam" if status_choice == Attendance.Status.EXCUSED else ""
                    )