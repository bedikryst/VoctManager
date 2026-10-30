# outreach/letters.py
# ==========================================
# Outreach — the list's letters: what each one says, and how it reaches the list
# ==========================================
# The copy below is typeset public prose: its typographic apostrophes are chosen, not stray.
# ruff: noqa: RUF001
"""
A letter is what the list exists for: the ensemble writing to the people who asked to hear
about its concerts and its news. Letters are rare and each is designed for its own concert, so there is
no shared letter template. A letter is three things that travel together:

- its templates, `templates/emails/letter_<slug>.html` and `.txt`;
- its images, committed under the public site's `web/public/listy/<slug>/`, so the deploy
  that ships the letter also serves them from `PUBLIC_SITE_URL` — deploy before sending;
- its copy, below, Polish first and not through gettext, for the reasons `copy.py` gives.

Sending is `manage.py send_notice_letter <slug>`. Each subscriber gets a letter once:
`NoticeLetterDelivery` records the hand-over, and a second run skips whoever has it.

WHAT A LETTER MAY CARRY is what the list was promised (consent 4.0, `consent.py`): concerts
before and after, news of the ensemble, and now and then a request for support. A request
for support is written as part of the letter, in its voice, the way the donors are thanked
in the Pochwała letter; never a fundraising block or a wall of buttons bolted under the prose.
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
    #: Inbox snippet beside the subject. Never repeats the subject, nor the letter's opening,
    #: which the reader meets a second later.
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
    #: The photographs' alt texts, in the order the spread reads: the rehearsal, the concert,
    #: the church seen from the altar.
    photo_alts: tuple[str, str, str]
    #: To whoever came. The spread follows it: the pews it speaks of, empty and then full.
    thanks: str
    #: Under the spread, in the glosses' small italic: what else the concert page holds. It
    #: opens the page's gallery, as the photographs above it do.
    photos_gloss: str
    #: To the donors, as a fact of this concert: what their support made possible. Ends on the
    #: lead-in to the one invitation to join them, which `donors_link` completes.
    donors: str
    #: The linked phrase closing `donors`. It opens the concert page with the vault open, and it
    #: names that act, joining the donors, so the reader knows where it leads before clicking.
    donors_link: str
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
    #: Why the letter arrived: the list the address is on.
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
# loudness: it opens the concert page, whose hero plays the passages the conductor chose (not
# every work is among them, so no copy may say "each work"). NOTHING IN THE
# COPY EXPLAINS THE RHYME between the empty staff and the written one. A sentence that walked
# the reader through it was tried and cut: explaining the device is what made it read as
# machine prose.
#
# SEND IT ONLY ONCE THE EXCERPTS ARE LIVE ON THE HOST: the page builds its player only when the
# file is there (concerts.yaml `excerpts`), and a letter that promises a recording the page does
# not play cannot be corrected after it leaves.
#
# The prose before the first photograph is kept to what a phone shows in about one screen: the
# fact, the concert, the thanks. A letter that holds its reader for two hundred words before the
# first image reads as a wall, however well each sentence is made. The photographs then come
# as one spread, right after the thanks they answer (the template says how), not one photograph
# per paragraph, and the donors follow them. The letter does not branch into "if you came" and
# "if you could not": the photographs and the recording are for both readers, and what else the
# page holds is a gloss under the spread, named exactly: more photographs, the programme with a
# note on each work, and the Canticle with its translation, which is the only text it gives in
# full. The concert was at
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
    asset_rev=9,
    copy={
        NoticeLocale.PL: LetterCopy(
            subject="Pochwała Stworzenia: zdjęcia i nagranie",
            preheader=(
                f"Dziękujemy wszystkim, którzy 11{NBSP}października byli z{NBSP}nami "
                f"w{NBSP}kościele Wszystkich Świętych."
            ),
            greeting="Dzień dobry, {name},",
            greeting_plain="Dzień dobry,",
            incipit_gloss="Najwyższy, wszechmogący, dobry Panie…",
            lede=(
                f"Najstarszy znany rękopis Pieśni słonecznej leży w{NBSP}Asyżu. "
                f"Nad pierwszymi wersami wyrysowano w{NBSP}nim linie pod melodię, ale nikt nie "
                "zapisał na nich nut. Melodia, którą ułożył sam Franciszek, nie zachowała się."
            ),
            sung=(
                f"Kolejni kompozytorzy wpisywali w{NBSP}te linie własną muzykę. W{NBSP}niedzielę "
                f"11{NBSP}października w{NBSP}kościele Wszystkich Świętych w{NBSP}Warszawie "
                f"śpiewaliśmy Pieśń słoneczną z{NBSP}muzyką Carla{NBSP}Orffa."
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
                "którzy chcieli posłuchać właśnie tej muzyki."
            ),
            photos_gloss=(
                f"Na stronie koncertu jest więcej zdjęć, program z{NBSP}opisami utworów "
                f"i{NBSP}tekst Pieśni z{NBSP}przekładem."
            ),
            donors=(
                "Koncert był otwarty dla wszystkich dzięki darczyńcom, którzy wspierają nasze "
                "Koncerty Duchowe. Im także bardzo dziękujemy. Będzie nam miło, jeśli zechcesz"
            ),
            donors_link=f"dołączyć do{NBSP}ich grona",
            listen_label="Posłuchaj",
            listen_gloss=(
                f"Nagranie z{NBSP}koncertu, fragmenty wybrane przez dyrygenta: "
                "dziesięć minut."
            ),
            next=f"Daty następnego koncertu jeszcze nie znamy. Napiszemy do{NBSP}Ciebie, kiedy ją ustalimy.",
            closing="Serdecznie pozdrawiamy",
            signature="VoctEnsemble",
            why="Dostajesz ten list, bo Twój adres jest na liście Zaproszeń VoctEnsemble.",
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
                "Thank you to everyone who was with us at All Saints’ Church on "
                f"11{NBSP}October."
            ),
            greeting="Dear {name},",
            greeting_plain="Hello,",
            incipit_gloss="Most High, all-powerful, good Lord…",
            lede=(
                "The oldest known manuscript of the Canticle of the Sun is kept in Assisi. "
                "Above its first verses, lines were ruled for a melody, but no notes were ever "
                "written on them. The melody Francis himself composed has not survived."
            ),
            sung=(
                "The composers who came after him wrote their own music into those lines. On "
                f"Sunday 11{NBSP}October, in All Saints’ Church in Warsaw, we sang the Canticle "
                f"to Carl{NBSP}Orff’s music."
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
                "wanted to hear this very music."
            ),
            photos_gloss=(
                "The concert page has more photographs, the programme with a note on each work, "
                "and the text of the Canticle with a translation."
            ),
            donors=(
                "The concert was open to everyone thanks to the donors who support our Spiritual "
                "Concerts, and we thank them warmly too. We would be glad to"
            ),
            donors_link="count you among them",
            listen_label="Listen",
            listen_gloss="The concert recording, passages chosen by the conductor: ten minutes.",
            next="We don’t know the date of the next concert yet. We will write to you as soon as we do.",
            closing="With warm wishes,",
            signature="VoctEnsemble",
            why=(
                "You are receiving this letter because your address is on VoctEnsemble’s "
                "Invitations list."
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
                f"Merci à tous ceux qui étaient avec nous le 11{NBSP}octobre en l’église de "
                "Tous-les-Saints."
            ),
            greeting="Bonjour {name},",
            greeting_plain="Bonjour,",
            incipit_gloss="Très-Haut, tout-puissant et bon Seigneur…",
            lede=(
                "Le plus ancien manuscrit connu du Cantique des créatures est conservé à Assise. "
                "Au-dessus des premiers vers, on y a tracé des lignes pour une mélodie, mais "
                "aucune note n’y a jamais été écrite. La mélodie que François avait lui-même "
                "composée ne nous est pas parvenue."
            ),
            sung=(
                "Les compositeurs venus après lui ont écrit leur propre musique dans ces lignes. "
                f"Le dimanche 11{NBSP}octobre, en l’église de Tous-les-Saints de Varsovie, nous "
                f"avons chanté le Cantique sur la musique de Carl{NBSP}Orff."
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
                "qui voulaient écouter précisément cette musique."
            ),
            photos_gloss=(
                "Sur la page du concert, vous trouverez d’autres photographies, le programme avec "
                "une présentation de chaque œuvre et le texte du Cantique avec sa traduction."
            ),
            donors=(
                "Le concert était ouvert à tous grâce aux donateurs qui soutiennent nos Concerts "
                "Spirituels, et nous les remercions eux aussi de tout cœur. Nous serions heureux "
                "de"
            ),
            donors_link="vous compter parmi eux",
            listen_label="Écouter",
            listen_gloss=f"L’enregistrement du concert, des extraits choisis par le chef de chœur{NBSP}: dix minutes.",
            next=(
                "Nous ne connaissons pas encore la date du prochain concert. Nous vous écrirons "
                "dès que nous la connaîtrons."
            ),
            closing="Bien chaleureusement,",
            signature="VoctEnsemble",
            why=(
                "Cette lettre vous parvient parce que votre adresse figure sur la liste des "
                "Invitations de VoctEnsemble."
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
