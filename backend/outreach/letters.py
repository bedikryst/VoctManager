# outreach/letters.py
# ==========================================
# Outreach — the list's letters: what each one says, and how it reaches the list
# ==========================================
# The copy below is typeset public prose: its typographic apostrophes are chosen, not stray.
# ruff: noqa: RUF001
"""
A letter is what the list exists for: the ensemble writing to the people who asked to hear
about its concerts. Letters are rare and each is designed for its own concert, so there is
no shared letter template. A letter is three things that travel together:

- its templates, `templates/emails/letter_<slug>.html` and `.txt`;
- its images, committed under the public site's `web/public/listy/<slug>/`, so the deploy
  that ships the letter also serves them from `PUBLIC_SITE_URL` — deploy before sending;
- its copy, below, Polish first and not through gettext, for the reasons `copy.py` gives.

Sending is `manage.py send_notice_letter <slug>`. Each subscriber gets a letter once:
`NoticeLetterDelivery` records the hand-over, and a second run skips whoever has it.

EVERY LETTER STAYS INSIDE THE LIST'S PROMISE — "we write only about concerts". A letter
written to raise money, or announcing anything that is not a concert, needs a consent nobody
on this list has given. Who made a concert possible is part of that concert: its letter may
thank the donors as a fact of the evening and close that thanks on one linked phrase to the
donation door. Never a button, a fundraising block or a letter of its own — the footer of
every letter repeats the promise, and a button under it would break it in the same email.
"""
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db.models import QuerySet

from notifications.email_service import EmailDispatcherService, EmailType

from .copy import POLICY_PATH
from .models import (
    ConcertNoticeSubscription,
    NoticeLetterDelivery,
    NoticeLocale,
    NoticeStatus,
)
from .services import preferences_url, unsubscribe_headers, unsubscribe_url
from .vocative import polish_vocative

#: Binds a one-letter Polish word to the next one, and a day to its month, so neither is left
#: at the end of a line. Built from its code point: the character itself is invisible in the
#: source, and the next editor would delete it without seeing it go.
NBSP = chr(0xA0)


@dataclass(frozen=True)
class LetterCopy:
    """Every string one letter prints, in one language."""

    subject: str
    #: Inbox snippet beside the subject. Never repeats the subject.
    preheader: str
    #: The salutation for a subscriber who gave a first name. `{name}` is filled here, in the
    #: vocative for a Polish letter, and the result escaped by the template like any other
    #: value — the name is the reader's input.
    greeting: str
    #: The salutation for a subscriber who gave none.
    greeting_plain: str
    #: The line the letter opens on, in the reader's language — the site's own translation.
    incipit_gloss: str
    #: The fact the letter is built on: the manuscript's empty lines and the lost melody.
    lede: str
    #: What was sung into those lines on the day.
    sung: str
    #: The photographs' alt texts, in the order the spread reads: the score, the conductor,
    #: the audience.
    photo_alts: tuple[str, str, str]
    #: To whoever came.
    thanks: str
    #: To the donors, as a fact of this concert: what their support made possible. Ends on the
    #: lead-in to the one invitation to join them, which `donors_link` completes.
    donors: str
    #: The linked phrase closing `donors`. It opens the concert page with the vault open.
    donors_link: str
    #: To whoever could not come: what the page holds.
    otherwise: str
    #: The words under the last staff, which open the recording.
    listen_label: str
    #: Under those words, as the incipit has its gloss: what the recording is. Says what it
    #: holds and nothing about the staves; the rhyme with the empty one is left to the reader.
    listen_gloss: str
    #: Where things stand on the next concert. The list was promised its date; until there is
    #: one, the letter says so rather than staying silent about it.
    next: str
    #: The leave-taking line above the signature.
    closing: str
    #: Who writes. The ensemble, unless a person wrote the letter themselves: a name under
    #: words its owner did not write is not a signature.
    signature: str
    #: Why the letter arrived: the list, and the promise it was given.
    why: str
    #: That a reply reaches a person. The address stays out of the prose, so changing
    #: `PUBLIC_LETTER_REPLY_TO_EMAIL` cannot make this sentence false.
    reply: str
    unsubscribe: str
    preferences: str
    policy: str
    controller: str


@dataclass(frozen=True)
class Letter:
    slug: str
    #: The concert page the letter sends its reader to, per language, from the site root.
    page_path: dict[str, str]
    #: The band of that page the photographs open. The recording's link opens the page itself,
    #: whose hero carries the player.
    anchor: str
    copy: dict[str, LetterCopy]
    #: Raised whenever an image of the letter is redrawn under the same file name. Gmail's image
    #: proxy caches by URL, so a redrawn file at an address it has fetched before (a `--to` test
    #: is enough) reaches readers as the old drawing.
    asset_rev: int = 1

    @property
    def template_name(self) -> str:
        return f"letter_{self.slug.replace('-', '_')}"


# The letter is built on one fact: the oldest known manuscript of the Canticle (Assisi, Sacro
# Convento, cod. 338) has staves ruled over the start of the text and never filled, and the
# melody Francis made for it is lost. Every setting since writes its own music into those lines,
# and on 11 October the ensemble sang Orff's. The letter opens on such a page, one staff left
# empty over the first line, and ends on the same staff written with the recording's own
# loudness: it opens the concert page, whose hero plays one passage of each work. NOTHING IN THE
# COPY EXPLAINS THE RHYME between the empty staff and the written one. A sentence that walked
# the reader through it was tried and cut: explaining the device is what made it read as
# machine prose.
#
# SEND IT ONLY ONCE THE EXCERPTS ARE LIVE ON THE HOST: the page builds its player only when the
# file is there (concerts.yaml `excerpts`), and a letter that promises a recording the page does
# not play cannot be corrected after it leaves.
#
# The prose runs unbroken, as a letter does, and the photographs follow it as one spread (the
# template says how), not one photograph per paragraph. What the page holds is named exactly: the photographs, the programme with a note on each work, and
# the Canticle with its translation, which is the only text it gives in full. The concert was at
# 13:30, so it is an afternoon everywhere in the copy. No date for the manuscript, which the
# literature places anywhere from the mid-thirteenth century to c. 1300.
#
# One reader, addressed as the list addresses its readers: "Ty", in forms that carry no
# grammatical gender ("udało Ci się przyjść"), since the list never asks for one. It thanks the
# reader only if they came, and gives the other case the page and the recording. Warm means
# plain and exact here, not colloquial: no "po prostu", no "ktoś", no "przepadła".
POCHWALA_STWORZENIA = Letter(
    slug="pochwala-stworzenia",
    page_path={
        NoticeLocale.PL: "/koncerty/pochwala-stworzenia",
        NoticeLocale.EN: "/en/koncerty/pochwala-stworzenia",
        NoticeLocale.FR: "/fr/koncerty/pochwala-stworzenia",
    },
    anchor="obrazy",
    asset_rev=8,
    copy={
        NoticeLocale.PL: LetterCopy(
            subject="Pochwała Stworzenia: zdjęcia i nagranie",
            preheader=(
                "W najstarszym rękopisie Pieśni słonecznej linie przygotowane pod melodię "
                "zostały puste."
            ),
            greeting="Dzień dobry, {name},",
            greeting_plain="Dzień dobry,",
            incipit_gloss="Najwyższy, wszechmogący, dobry Panie…",
            lede=(
                f"W{NBSP}Asyżu przechowywany jest najstarszy znany rękopis Pieśni słonecznej. "
                f"Nad pierwszymi wersami wyrysowano w{NBSP}nim linie pod melodię, ale nikt nie "
                "zapisał na nich nut. Franciszek sam ułożył do tej pieśni melodię, która się nie "
                f"zachowała. Zostały tylko słowa i{NBSP}puste linie."
            ),
            sung=(
                f"Każdy kompozytor, który później sięgał po ten tekst, wpisywał w{NBSP}te linie "
                f"własną muzykę. W{NBSP}niedzielę 11{NBSP}października w{NBSP}kościele "
                f"Wszystkich Świętych w{NBSP}Warszawie śpiewaliśmy Pieśń słoneczną z{NBSP}muzyką, "
                f"którą ponad siedemset lat po Franciszku napisał Carl{NBSP}Orff."
            ),
            photo_alts=(
                (
                    "Próba VoctEnsemble przed ołtarzem głównym kościoła Wszystkich Świętych, "
                    "ławki jeszcze puste"
                ),
                (
                    "Ten sam widok podczas koncertu: VoctEnsemble przed ołtarzem, słuchacze "
                    "w ławkach"
                ),
                (
                    "Kościół Wszystkich Świętych w Warszawie widziany od ołtarza: słuchacze "
                    "w ławkach aż po wejście"
                ),
            ),
            thanks=(
                "Jeśli udało Ci się wtedy przyjść, dziękujemy Ci za to niedzielne popołudnie. "
                f"Śpiewało nam się inaczej niż na próbach, bo w{NBSP}ławkach siedzieli ludzie, "
                "którzy przyszli posłuchać właśnie tej muzyki."
            ),
            donors=(
                "Koncert był otwarty dla wszystkich dzięki darczyńcom, którzy wspierają nasze "
                f"Koncerty Duchowe. Im także bardzo dziękujemy. Jeśli chcesz dołączyć do{NBSP}ich "
                "grona,"
            ),
            donors_link="serdecznie zapraszamy",
            otherwise=(
                "Jeśli tym razem nie udało Ci się przyjść, na stronie koncertu są zdjęcia, "
                f"program z{NBSP}opisami utworów i{NBSP}tekst Pieśni z{NBSP}przekładem."
            ),
            listen_label="Posłuchaj",
            listen_gloss=(
                f"Nagranie z{NBSP}koncertu, po jednym fragmencie z{NBSP}każdego utworu: "
                "sześć minut."
            ),
            next=f"Daty następnego koncertu jeszcze nie znamy. Napiszemy do{NBSP}Ciebie, kiedy ją ustalimy.",
            closing="Serdecznie pozdrawiamy",
            signature="VoctEnsemble",
            why=(
                "Dostajesz ten list, bo Twój adres jest na liście Zaproszeń VoctEnsemble. "
                "Piszemy tylko o koncertach."
            ),
            reply="Jeśli na niego odpiszesz, przeczytamy Twoją odpowiedź.",
            unsubscribe="Wypisz się",
            preferences="Zmień powitanie",
            policy="Polityka prywatności",
            controller=(
                "Administratorem danych jest Fundacja VoctFoundation, "
                f"ul.{NBSP}Św.{NBSP}Filipa{NBSP}23/3, 31-150{NBSP}Kraków."
            ),
        ),
        NoticeLocale.EN: LetterCopy(
            subject="Pochwała Stworzenia: photographs and a recording",
            preheader=(
                "In the oldest manuscript of the Canticle of the Sun, the lines ruled for its "
                "melody were left empty."
            ),
            greeting="Dear {name},",
            greeting_plain="Hello,",
            incipit_gloss="Most High, all-powerful, good Lord…",
            lede=(
                "The oldest known manuscript of the Canticle of the Sun is kept in Assisi. "
                "Above its first verses, lines were ruled for a melody, but no notes were ever "
                "written on them. Francis composed a melody for the song himself, and it has not "
                "survived. Only the words and the empty lines remain."
            ),
            sung=(
                "Every composer who has set the text since has written their own music into "
                f"those lines. On Sunday 11{NBSP}October, in All Saints’ Church in Warsaw, we "
                f"sang the Canticle to the music Carl{NBSP}Orff wrote for it more than seven hundred "
                "years after Francis."
            ),
            photo_alts=(
                (
                    "VoctEnsemble rehearsing before the high altar of All Saints’ Church, the "
                    "pews still empty"
                ),
                (
                    "The same view during the concert: VoctEnsemble before the altar, the audience "
                    "in the pews"
                ),
                (
                    "All Saints’ Church in Warsaw seen from the altar: the audience in the pews "
                    "as far as the entrance"
                ),
            ),
            thanks=(
                "If you were able to come, thank you for that Sunday afternoon. We sang "
                "differently than we do in rehearsal, because there were people in the pews who "
                "had come to hear this very music."
            ),
            donors=(
                "The concert was open to everyone thanks to the donors who support our Spiritual "
                "Concerts, and we thank them warmly too. If you would like to join them,"
            ),
            donors_link="you are most welcome",
            otherwise=(
                "If you could not come this time, the concert page has the photographs, the "
                "programme with a note on each work, and the text of the Canticle with a "
                "translation."
            ),
            listen_label="Listen",
            listen_gloss="The concert recording, one passage from each work: six minutes.",
            next="We don’t know the date of the next concert yet. We will write to you as soon as we do.",
            closing="With warm wishes,",
            signature="VoctEnsemble",
            why=(
                "You are receiving this letter because your address is on VoctEnsemble’s "
                "Invitations list. We write only about concerts."
            ),
            reply="If you reply, we will read what you write.",
            unsubscribe="Unsubscribe",
            preferences="Change the greeting",
            policy="Privacy policy",
            controller=(
                "The data controller is Fundacja VoctFoundation, "
                f"ul.{NBSP}Św.{NBSP}Filipa{NBSP}23/3, 31-150{NBSP}Kraków, Poland."
            ),
        ),
        NoticeLocale.FR: LetterCopy(
            subject=f"Pochwała Stworzenia{NBSP}: photographies et enregistrement",
            preheader=(
                "Dans le plus ancien manuscrit du Cantique des créatures, les lignes tracées "
                "pour la mélodie sont restées vides."
            ),
            greeting="Bonjour {name},",
            greeting_plain="Bonjour,",
            incipit_gloss="Très-Haut, tout-puissant et bon Seigneur…",
            lede=(
                "Le plus ancien manuscrit connu du Cantique des créatures est conservé à Assise. "
                "Au-dessus des premiers vers, on y a tracé des lignes pour une mélodie, mais "
                "aucune note n’y a jamais été écrite. François avait lui-même composé une "
                "mélodie pour ce chant, mais elle ne nous est pas parvenue. Il ne reste que les "
                "mots et les lignes vides."
            ),
            sung=(
                "Chaque compositeur qui s’est emparé de ce texte depuis a écrit sa propre "
                f"musique dans ces lignes. Le dimanche 11{NBSP}octobre, en l’église de "
                "Tous-les-Saints de Varsovie, nous avons chanté le Cantique sur la musique que "
                f"Carl{NBSP}Orff a écrite plus de sept cents ans après François."
            ),
            photo_alts=(
                (
                    "La répétition de VoctEnsemble devant le maître-autel de l’église de "
                    "Tous-les-Saints, les bancs encore vides"
                ),
                (
                    f"La même vue pendant le concert{NBSP}: VoctEnsemble devant l’autel, le public "
                    "dans les bancs"
                ),
                (
                    "L’église de Tous-les-Saints de Varsovie vue depuis l’autel"
                    f"{NBSP}: le public dans les bancs jusqu’à l’entrée"
                ),
            ),
            thanks=(
                "Si vous avez pu venir, merci pour ce dimanche après-midi. Nous avons chanté "
                "autrement qu’en répétition, parce que dans les bancs se trouvaient des gens "
                "venus écouter précisément cette musique."
            ),
            donors=(
                "Le concert était ouvert à tous grâce aux donateurs qui soutiennent nos Concerts "
                "Spirituels, et nous les remercions eux aussi de tout cœur. Si vous souhaitez "
                "les rejoindre,"
            ),
            donors_link="nous vous y invitons chaleureusement",
            otherwise=(
                "Si vous n’avez pas pu venir cette fois, vous trouverez sur la page du concert "
                "les photographies, le programme avec une présentation de chaque œuvre et le "
                "texte du Cantique avec sa traduction."
            ),
            listen_label="Écouter",
            listen_gloss=f"L’enregistrement du concert, un extrait de chaque œuvre{NBSP}: six minutes.",
            next=(
                "Nous ne connaissons pas encore la date du prochain concert. Nous vous écrirons "
                "dès que nous la connaîtrons."
            ),
            closing="Bien chaleureusement,",
            signature="VoctEnsemble",
            why=(
                "Cette lettre vous parvient parce que votre adresse figure sur la liste des "
                "Invitations de VoctEnsemble. Nous n’écrivons qu’au sujet des concerts."
            ),
            reply="Si vous y répondez, nous lirons votre réponse.",
            unsubscribe="Se désinscrire",
            preferences="Modifier la salutation",
            policy="Politique de confidentialité",
            controller=(
                "Le responsable du traitement est la Fundacja VoctFoundation, "
                f"ul.{NBSP}Św.{NBSP}Filipa{NBSP}23/3, 31-150{NBSP}Cracovie, Pologne."
            ),
        ),
    },
)

LETTERS: dict[str, Letter] = {letter.slug: letter for letter in (POCHWALA_STWORZENIA,)}


def letter_context(
    letter: Letter,
    locale: str,
    *,
    name: str,
    unsubscribe_link: str,
    preferences_link: str,
) -> dict[str, Any]:
    """
    What a letter's templates read. Shared by the send and by `--preview`, so a previewed
    letter is the letter, not a mock-up of it.

    The page link names its source in `ref`, the parameter Plausible reads as a visit's
    source, one value per letter so letters stay apart in the report. It sits BEFORE the
    anchor: after it, it would be part of the fragment and never reach the analytics. The
    donors' link adds `donate`, which opens the page's vault as it loads (VaultIsland).
    """
    base = settings.PUBLIC_SITE_URL.rstrip('/')
    copy = letter.copy[locale]
    name = name.strip()
    if name and locale == NoticeLocale.PL:
        name = polish_vocative(name)
    page = f"{base}{letter.page_path.get(locale, letter.page_path[NoticeLocale.PL])}"
    return {
        'lang': locale,
        'copy': copy,
        'greeting': copy.greeting.format(name=name) if name else copy.greeting_plain,
        'page_url': f"{page}?ref=nuntius-{letter.slug}#{letter.anchor}",
        'listen_url': f"{page}?ref=nuntius-{letter.slug}",
        'donate_url': f"{page}?donate&ref=nuntius-{letter.slug}",
        'site_url': base,
        'asset_url': f"{base}/listy/{letter.slug}",
        'asset_query': f"?v={letter.asset_rev}",
        'unsubscribe_url': unsubscribe_link,
        'preferences_url': preferences_link,
        'policy_url': f"{base}{POLICY_PATH.get(locale, POLICY_PATH['pl'])}",
    }


class LetterService:
    """Who a letter goes to, and the hand-over of one letter to one subscriber."""

    @staticmethod
    def audience() -> QuerySet[ConcertNoticeSubscription]:
        """Everyone a letter may go to: a confirmed consent on a row that is not deleted."""
        return ConcertNoticeSubscription.objects.filter(status=NoticeStatus.CONFIRMED)

    @classmethod
    def undelivered(cls, letter: Letter) -> QuerySet[ConcertNoticeSubscription]:
        """The audience minus whoever already has this letter, oldest consent first."""
        return (
            cls.audience()
            .exclude(letter_deliveries__letter=letter.slug)
            .order_by('confirmed_at')
        )

    @staticmethod
    def uncovered_locales(letter: Letter, subscriptions: QuerySet[ConcertNoticeSubscription]) -> set[str]:
        """Languages somebody in `subscriptions` reads that the letter has no copy in."""
        wanted = set(subscriptions.values_list('locale', flat=True).distinct())
        return wanted - set(letter.copy)

    @staticmethod
    def send(letter: Letter, subscription: ConcertNoticeSubscription) -> None:
        """
        Hand one letter to the provider, then record it. In that order: a recorded letter
        that never left would be skipped by every later run, while a sent letter whose
        record failed is at worst sent once more.

        Raises on transport failure, before anything is recorded.
        """
        EmailDispatcherService.dispatch(
            recipient_email=subscription.email,
            subject=letter.copy[subscription.locale].subject,
            template_name=letter.template_name,
            context=letter_context(
                letter,
                subscription.locale,
                name=subscription.name,
                unsubscribe_link=unsubscribe_url(subscription),
                preferences_link=preferences_url(subscription),
            ),
            fallback_language=subscription.locale,
            from_email=settings.PUBLIC_FROM_EMAIL,
            reply_to=[settings.PUBLIC_LETTER_REPLY_TO_EMAIL],
            headers=unsubscribe_headers(subscription),
            # An ESP tag here and nothing more — see `NoticeListService.send_confirmation`.
            email_type=EmailType.OPERATIONAL,
        )
        NoticeLetterDelivery.objects.get_or_create(subscription=subscription, letter=letter.slug)
