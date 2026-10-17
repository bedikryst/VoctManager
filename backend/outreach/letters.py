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
    #: The rubric over the image.
    eyebrow: str
    #: The salutation for a subscriber who gave a first name. `{name}` is filled here and the
    #: result escaped by the template like any other value — the name is the reader's input.
    greeting: str
    #: The salutation for a subscriber who gave none.
    greeting_plain: str
    body: tuple[str, ...]
    #: Alt text of the image carrying the title.
    hero_alt: str
    #: The roles under the two portraits, whose names the template prints, and the
    #: portraits' alt texts, in the same order.
    roles: tuple[str, str]
    portrait_alts: tuple[str, str]
    button: str
    #: Where things stand on the next concert. The list was promised its date; until there is
    #: one, the letter says so rather than staying silent about it.
    next: str
    #: The leave-taking line above the signature.
    closing: str
    #: Who writes. The ensemble, unless a person wrote the letter themselves: a name under
    #: words its owner did not write is not a signature.
    signature: str
    #: The concert's inscription in this language — the site's own gloss, not a new one.
    inscription_gloss: str
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
            preheader="Zdjęcia, na których po raz pierwszy zobaczyliśmy własny koncert.",
            eyebrow="Koncert Duchowy",
            greeting="Dzień dobry, {name},",
            greeting_plain="Dzień dobry,",
            # One reader, addressed as the list addresses its readers: "Ty", in forms that carry
            # no grammatical gender ("udało Ci się przyjść"), since the list never asks for one.
            # It thanks the reader only if they came, and gives the photographs to both cases.
            # The letter leaves the programme to the concert page and starts from the photographs:
            # a singer sees little of their own concert, so the pictures are as new to the
            # ensemble as to the reader. The chessboard is the hero photograph read literally:
            # the black and white floor, the half circle in black, the violinist in front.
            body=(
                f"kiedy się śpiewa, z{NBSP}koncertu widzi się niewiele: ręce Florenta, nuty "
                f"i{NBSP}kawałek sklepienia. Zdjęcia z{NBSP}Pochwały Stworzenia oglądaliśmy więc "
                "trochę tak, jakbyśmy sami siedzieli w ławce. Najdłużej patrzyliśmy na to "
                f"zrobione z{NBSP}góry. Na czarno-białej posadzce kościoła Wszystkich Świętych "
                f"stoimy w{NBSP}półkolu jak figury rozstawione na szachownicy, a{NBSP}Radu ze "
                "skrzypcami na pierwszym planie wygląda, jakby to on miał teraz ruch.",
                f"Jeśli udało Ci się wtedy przyjść, bardzo Ci dziękujemy. Śpiewa się zupełnie "
                "inaczej, kiedy się wie, że ktoś przyszedł właśnie po tę muzykę. "
                f"A{NBSP}jeśli tym razem się nie udało, może te zdjęcia pokażą Ci choć trochę, jak "
                f"tam było. Są już na stronie koncertu, razem z{NBSP}programem i{NBSP}tekstami, "
                "które śpiewaliśmy.",
            ),
            hero_alt=(
                "Pochwała Stworzenia. VoctEnsemble w półkolu przed ołtarzem kościoła "
                "Wszystkich Świętych, widziany z góry"
            ),
            roles=("dyrygent", "skrzypce"),
            portrait_alts=(
                "Florent de Bazelaire dyryguje zespołem",
                "Radu Ropotan gra na skrzypcach",
            ),
            button="Zobacz zdjęcia",
            next=f"Daty następnego koncertu jeszcze nie znamy. Kiedy tylko ją ustalimy, napiszemy do{NBSP}Ciebie.",
            closing="Serdecznie pozdrawiamy",
            signature="Śpiewacy VoctEnsemble",
            inscription_gloss=f"Pochwalony bądź, Panie mój, ze{NBSP}wszystkimi{NBSP}Twoimi{NBSP}stworzeniami",
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
            preheader="Photographs in which we saw our own concert for the first time.",
            eyebrow="Spiritual Concert",
            greeting="Dear {name},",
            greeting_plain="Hello,",
            body=(
                "When you are singing, you see very little of the concert: Florent’s hands, the "
                "music and a piece of the vault. So we looked at the photographs from Pochwała "
                "Stworzenia almost as if we had been sitting in the pews ourselves. The one we kept "
                "coming back to was taken from above. On the black and white floor of All Saints’ "
                "we stand in a half circle like pieces set out on a chessboard, and Radu with his "
                "violin in front looks as if it is his move.",
                "If you were able to come that afternoon, thank you so much. Singing feels quite "
                "different when you know someone came for this very music. And if it didn’t work "
                "out this time, perhaps the photographs will show you a little of what it was like. "
                "They are now on the concert page, together with the programme and the texts we sang.",
            ),
            hero_alt=(
                "Pochwała Stworzenia. VoctEnsemble in a half circle before the altar of "
                "All Saints’ Church, seen from above"
            ),
            roles=("conductor", "violin"),
            portrait_alts=(
                "Florent de Bazelaire conducting the ensemble",
                "Radu Ropotan playing the violin",
            ),
            button="See the photographs",
            next="We don’t know the date of the next concert yet. As soon as we do, we will write to you.",
            closing="With warm wishes,",
            signature="The singers of VoctEnsemble",
            inscription_gloss=f"Praised be You, my Lord, with{NBSP}all{NBSP}Your{NBSP}creatures",
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
            preheader="Des photographies où nous avons vu notre propre concert pour la première fois.",
            eyebrow="Concert Spirituel",
            greeting="Bonjour {name},",
            greeting_plain="Bonjour,",
            body=(
                f"Quand on chante, on ne voit pas grand-chose du concert{NBSP}: les mains de Florent, "
                "la partition et un morceau de voûte. Nous avons donc regardé les photographies de "
                "Pochwała Stworzenia presque comme si nous avions été assis dans les bancs. Celle à "
                "laquelle nous revenions sans cesse a été prise d’en haut. Sur le sol noir et blanc "
                "de Tous-les-Saints, nous voilà rangés en demi-cercle comme des pièces sur un "
                "échiquier, et devant nous Radu, avec son violon, a tout l’air d’être le prochain "
                "à jouer.",
                "Si vous avez pu venir cet après-midi-là, merci de tout cœur. On chante tout "
                "autrement quand on sait que quelqu’un est venu pour cette musique. Et si cela n’a "
                "pas été possible cette fois, ces photographies vous montreront peut-être un peu ce "
                "que c’était. Elles sont maintenant sur la page du concert, avec le programme et les "
                "textes que nous avons chantés.",
            ),
            hero_alt=(
                "Pochwała Stworzenia. Le VoctEnsemble en demi-cercle devant l’autel de "
                "l’église de Tous-les-Saints, vu d’en haut"
            ),
            roles=("direction", "violon"),
            portrait_alts=(
                "Florent de Bazelaire dirige l’ensemble",
                "Radu Ropotan joue du violon",
            ),
            button="Voir les photographies",
            next=(
                "Nous ne connaissons pas encore la date du prochain concert. Dès que nous la "
                "connaîtrons, nous vous écrirons."
            ),
            closing="Bien chaleureusement,",
            signature="Les chanteurs du VoctEnsemble",
            inscription_gloss=f"Loué sois-Tu, mon Seigneur, avec{NBSP}toutes{NBSP}Tes{NBSP}créatures",
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
