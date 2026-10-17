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
    #: The day and the place, under the title.
    facts: str
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
            preheader="Niedziela 11 października, kościół Wszystkich Świętych w Warszawie.",
            eyebrow="Koncert Duchowy",
            facts=f"11{NBSP}października{NBSP}2026 · Kościół{NBSP}Wszystkich{NBSP}Świętych · Warszawa",
            greeting="Dzień dobry, {name},",
            greeting_plain="Dzień dobry,",
            body=(
                f"dziękujemy wszystkim, którzy byli z{NBSP}nami 11{NBSP}października "
                f"w{NBSP}kościele Wszystkich Świętych. Zdjęcia z{NBSP}tamtego popołudnia są już "
                "na stronie koncertu.",
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
            next=f"Następny koncert nie ma jeszcze daty. Napiszemy, kiedy ją{NBSP}ustalimy.",
            signature="Florent i zespół VoctEnsemble",
            inscription_gloss="Pochwalony bądź, Panie mój, ze wszystkimi Twoimi stworzeniami",
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
            preheader="Sunday 11 October, All Saints’ Church in Warsaw.",
            eyebrow="Spiritual Concert",
            facts=f"11{NBSP}October{NBSP}2026 · All{NBSP}Saints’{NBSP}Church · Warsaw",
            greeting="Dear {name},",
            greeting_plain="Hello,",
            body=(
                f"Thank you to everyone who was with us on 11{NBSP}October at All Saints’ Church. "
                "The photographs from that afternoon are now on the concert page.",
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
            next="The next concert has no date yet. We will write when it does.",
            signature="Florent and VoctEnsemble",
            inscription_gloss="Praised be You, my Lord, with all Your creatures",
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
            preheader="Dimanche 11 octobre, église de Tous-les-Saints à Varsovie.",
            eyebrow="Concert Spirituel",
            facts=f"11{NBSP}octobre{NBSP}2026 · Église{NBSP}de{NBSP}Tous-les-Saints · Varsovie",
            greeting="Bonjour {name},",
            greeting_plain="Bonjour,",
            body=(
                f"Merci à tous ceux qui étaient avec nous le 11{NBSP}octobre en l’église de "
                "Tous-les-Saints. Les photographies de cet après-midi sont maintenant sur la "
                "page du concert.",
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
            next="Le prochain concert n’a pas encore de date. Nous vous écrirons dès qu’il en aura une.",
            signature="Florent et le VoctEnsemble",
            inscription_gloss="Loué sois-Tu, mon Seigneur, avec toutes Tes créatures",
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

    The page link carries campaign parameters BEFORE the anchor — after it they would be
    part of the fragment and never reach the analytics.
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
            f"{base}{page}?utm_source=nuntius&utm_medium=email&utm_campaign={letter.slug}"
            f"#{letter.anchor}"
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
