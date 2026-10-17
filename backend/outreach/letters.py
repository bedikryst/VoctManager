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
that asks for money, or announces anything that is not a concert, needs a consent nobody on
this list has given. The donation door belongs on the concert page the letter links to.
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
    #: The lines the letter opens on, in the reader's language — the site's own translation.
    incipit_gloss: str
    #: The paragraph before the first photograph.
    lede: str
    #: The photographs' alt texts, in the order the letter shows them: the score, the voice,
    #: the nave.
    photo_alts: tuple[str, str, str]
    #: Between the score and the voice: what the letter cannot carry.
    turn: str
    #: Between the voice and the nave, to whoever came.
    thanks: str
    #: After the nave, to whoever could not come.
    otherwise: str
    button: str
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
    #: The band of that page the letter is about.
    anchor: str
    copy: dict[str, LetterCopy]

    @property
    def template_name(self) -> str:
        return f"letter_{self.slug.replace('-', '_')}"


# The letter is built on one fact: the oldest known manuscript of the Canticle (Assisi, Sacro
# Convento, cod. 338) has staves ruled over the start of the text and never filled, and the
# melody Francis made for it is lost. The letter opens on such a page, says the fact once, and
# turns it on itself without a simile: the letter opens on empty lines too, because words and
# photographs fit in it and the music does not, which stays with whoever was there. Each
# photograph answers the sentence before it: Orff's music → a score; the music the letter cannot
# hold → a voice; the people in the pews → the nave. The concert page's reflection carries the
# same fact as a reading of the work; the letter's own turn is the letter and its reader. It
# gives no date for the
# manuscript, which the literature places anywhere from the mid-thirteenth century to c. 1300.
#
# One reader, addressed as the list addresses its readers: "Ty", in forms that carry no
# grammatical gender ("udało Ci się przyjść"), since the list never asks for one. It thanks the
# reader only if they came, and gives the other case the photographs and the next concert.
POCHWALA_STWORZENIA = Letter(
    slug="pochwala-stworzenia",
    page_path={
        NoticeLocale.PL: "/koncerty/pochwala-stworzenia",
        NoticeLocale.EN: "/en/koncerty/pochwala-stworzenia",
        NoticeLocale.FR: "/fr/koncerty/pochwala-stworzenia",
    },
    anchor="obrazy",
    copy={
        NoticeLocale.PL: LetterCopy(
            subject="Zdjęcia z Pochwały Stworzenia",
            preheader="Najstarszy rękopis Pieśni słonecznej ma linie na nuty, których nikt nie wypełnił.",
            greeting="Dzień dobry, {name},",
            greeting_plain="Dzień dobry,",
            incipit_gloss=(
                f"Najwyższy, wszechmogący, dobry Panie, Twoja jest sława, chwała i{NBSP}cześć, "
                f"i{NBSP}wszelkie błogosławieństwo."
            ),
            lede=(
                f"w{NBSP}Asyżu leży najstarszy znany rękopis Pieśni słonecznej. Nad początkiem "
                f"tekstu ktoś wyrysował w{NBSP}nim linie na nuty, ale nikt ich nie wypełnił. "
                f"Melodię ułożył do tej pieśni sam Franciszek i{NBSP}ta melodia przepadła, "
                f"zostały tylko słowa i{NBSP}puste linie. W{NBSP}niedzielę 11{NBSP}października, "
                f"w{NBSP}kościele Wszystkich Świętych, śpiewaliśmy te słowa z{NBSP}muzyką, którą "
                "ponad siedemset lat później napisał do nich Carl Orff."
            ),
            photo_alts=(
                "Otwarte nuty w dłoniach śpiewaczki VoctEnsemble, w głębi ołtarz",
                "Śpiewaczka VoctEnsemble na pierwszym planie, za nią pozostali śpiewacy",
                (
                    "Nawa kościoła Wszystkich Świętych w Warszawie od wejścia: słuchacze "
                    "w ławkach i VoctEnsemble przed ołtarzem głównym"
                ),
            ),
            turn=(
                f"Ten list też zaczyna się od pustych linii, bo zmieszczą się w{NBSP}nim słowa "
                f"i{NBSP}zdjęcia, a{NBSP}muzyka już nie."
            ),
            thanks=(
                f"Jeśli udało Ci się wtedy przyjść, ona została u{NBSP}Ciebie, i{NBSP}bardzo Ci "
                f"za to dziękujemy. Śpiewa się zupełnie inaczej, kiedy w{NBSP}ławkach siedzą "
                "ludzie, którzy przyszli właśnie jej posłuchać."
            ),
            otherwise=(
                f"A{NBSP}jeśli tym razem się nie udało, na stronie koncertu znajdziesz wszystkie "
                f"zdjęcia, program i{NBSP}teksty, które śpiewaliśmy, a{NBSP}muzyka poczeka "
                "na następny koncert."
            ),
            button=f"Zdjęcia i{NBSP}teksty",
            next=f"Daty następnego koncertu jeszcze nie znamy. Kiedy tylko ją ustalimy, napiszemy do{NBSP}Ciebie.",
            closing="Serdecznie pozdrawiamy",
            signature="VoctEnsemble",
            why=(
                "Ten list przyszedł, bo ten adres jest na liście Zaproszeń VoctEnsemble. "
                "Piszemy tylko o koncertach."
            ),
            reply="Na ten list można po prostu odpowiedzieć.",
            unsubscribe="Wypisz się",
            preferences="Zmień powitanie",
            policy="Polityka prywatności",
            controller=(
                "Administratorem danych jest Fundacja VoctFoundation, "
                "ul. Św. Filipa 23/3, 31-150 Kraków."
            ),
        ),
        NoticeLocale.EN: LetterCopy(
            subject="Photographs from Pochwała Stworzenia",
            preheader="The oldest manuscript of the Canticle of the Sun has staves nobody ever filled.",
            greeting="Dear {name},",
            greeting_plain="Hello,",
            incipit_gloss=(
                "Most High, all-powerful, good Lord, Yours are the praises, the glory, "
                "the honour and every blessing."
            ),
            lede=(
                "In Assisi lies the oldest known manuscript of the Canticle of the Sun. Above "
                "the beginning of the text someone ruled staves for the music, but nobody ever "
                "filled them in. Francis made a melody for the song himself, and that melody "
                "has been lost; all that remains are the words and the empty lines. On Sunday "
                f"11{NBSP}October, in the church of All Saints, we sang those words to the music "
                "Carl Orff wrote for them more than seven hundred years later."
            ),
            photo_alts=(
                "An open score in a VoctEnsemble singer’s hands, the altar beyond",
                "A VoctEnsemble singer in the foreground, the other singers behind her",
                (
                    "The nave of All Saints’ Church in Warsaw from the entrance: the audience "
                    "in the pews and VoctEnsemble before the high altar"
                ),
            ),
            turn=(
                "This letter opens on empty lines too, because words and photographs fit in it "
                "and the music does not."
            ),
            thanks=(
                "If you were able to come that afternoon, the music stayed with you, and we "
                "thank you for that with all our hearts. Singing is quite different when there "
                "are people in the pews who came especially to hear it."
            ),
            otherwise=(
                "And if it didn’t work out this time, you will find all the photographs, the "
                "programme and the texts we sang on the concert page, and the music will wait "
                "for the next concert."
            ),
            button="Photographs and texts",
            next="We don’t know the date of the next concert yet. As soon as we do, we will write to you.",
            closing="With warm wishes,",
            signature="VoctEnsemble",
            why=(
                "This letter came because this address is on VoctEnsemble’s Invitations "
                "list. We write only about concerts."
            ),
            reply="You can simply reply to this letter.",
            unsubscribe="Unsubscribe",
            preferences="Change the greeting",
            policy="Privacy policy",
            controller=(
                "The data controller is Fundacja VoctFoundation, "
                "ul. Św. Filipa 23/3, 31-150 Kraków, Poland."
            ),
        ),
        NoticeLocale.FR: LetterCopy(
            subject="Les photographies de Pochwała Stworzenia",
            preheader=(
                "Le plus ancien manuscrit du Cantique des créatures porte des portées que "
                "personne n’a jamais remplies."
            ),
            greeting="Bonjour {name},",
            greeting_plain="Bonjour,",
            incipit_gloss=(
                "Très-Haut, tout-puissant et bon Seigneur, à Toi la louange, la gloire, "
                "l’honneur et toute bénédiction."
            ),
            lede=(
                "À Assise se trouve le plus ancien manuscrit connu du Cantique des créatures. "
                "Au-dessus du début du texte, quelqu’un a tracé des portées pour la musique, "
                "mais personne ne les a jamais remplies. François avait composé lui-même une "
                f"mélodie pour ce chant, et cette mélodie s’est perdue{NBSP}: il ne reste que les "
                f"mots et les lignes vides. Le dimanche 11{NBSP}octobre, en l’église de "
                "Tous-les-Saints, nous avons chanté ces mots sur la musique que Carl Orff leur "
                "a donnée plus de sept cents ans plus tard."
            ),
            photo_alts=(
                "Une partition ouverte entre les mains d’une chanteuse de VoctEnsemble, l’autel au fond",
                "Une chanteuse de VoctEnsemble au premier plan, les autres chanteurs derrière elle",
                (
                    "La nef de l’église de Tous-les-Saints à Varsovie depuis l’entrée"
                    f"{NBSP}: le public dans les bancs et VoctEnsemble devant le maître-autel"
                ),
            ),
            turn=(
                "Cette lettre commence elle aussi par des lignes vides, parce que les mots et "
                "les photographies y tiennent, mais pas la musique."
            ),
            thanks=(
                "Si vous avez pu venir cet après-midi-là, elle est restée avec vous, et nous vous "
                "en remercions de tout cœur. On chante tout autrement quand il y a dans les bancs "
                "des gens venus précisément pour l’écouter."
            ),
            otherwise=(
                "Et si cela n’a pas été possible cette fois, vous trouverez sur la page du concert "
                "toutes les photographies, le programme et les textes que nous avons chantés, "
                "et la musique attendra le prochain concert."
            ),
            button="Photographies et textes",
            next=(
                "Nous ne connaissons pas encore la date du prochain concert. Dès que nous la "
                "connaîtrons, nous vous écrirons."
            ),
            closing="Bien chaleureusement,",
            signature="VoctEnsemble",
            why=(
                "Cette lettre vous parvient parce que cette adresse figure sur la liste des "
                "Invitations du VoctEnsemble. Nous n’écrivons que pour les concerts."
            ),
            reply="Il suffit de répondre à cette lettre pour nous écrire.",
            unsubscribe="Se désinscrire",
            preferences="Modifier la salutation",
            policy="Politique de confidentialité",
            controller=(
                "Le responsable du traitement est la Fundacja VoctFoundation, "
                "ul. Św. Filipa 23/3, 31-150 Cracovie, Pologne."
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
    anchor: after it, it would be part of the fragment and never reach the analytics.
    """
    base = settings.PUBLIC_SITE_URL.rstrip('/')
    copy = letter.copy[locale]
    name = name.strip()
    if name and locale == NoticeLocale.PL:
        name = polish_vocative(name)
    page = letter.page_path.get(locale, letter.page_path[NoticeLocale.PL])
    return {
        'lang': locale,
        'copy': copy,
        'greeting': copy.greeting.format(name=name) if name else copy.greeting_plain,
        'page_url': (
            f"{base}{page}?ref=nuntius-{letter.slug}#{letter.anchor}"
        ),
        'site_url': base,
        'asset_url': f"{base}/listy/{letter.slug}",
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
