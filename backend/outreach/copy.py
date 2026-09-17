# outreach/copy.py
# ==========================================
# What the confirmation mail says, in the three languages the public site speaks
# Standard: Enterprise SaaS 2026
# ==========================================
"""
The one mail this app sends, as text rather than as a gettext catalogue.

WHY NOT gettext, WHICH THE REST OF THE BACKEND USES. gettext makes the msgid — the
English — the source, and every other language a translation of it. That is right for
the panel, whose UI is authored in English. It is backwards here: this mail is public
copy in VoctEnsemble's own voice, and on the public site POLISH IS CANONICAL (the copy
desk, `web/src/content/pages/*.yaml`, every overlay). Routing it through a catalogue
would have made the Polish a back-translation of an English string nobody wrote, and
put the ensemble's own words somewhere its editor cannot see them.

So the three locales stand side by side, Polish first, and the template receives
already-resolved strings. `templates/emails/notice_confirm.*` therefore carries no
`{% translate %}` of its own.

IT IS STILL NOT ON THE COPY DESK. The desk covers `web/`, and reaching into it from
Django is a larger piece of machinery than one mail earns. If a second public mail
appears — the concert notice itself — that calculation changes; see
docs/specs/web-notice-list-2026-09.md.

THE LIST IS CALLED *ZAPROSZENIA* WHERE A READER CAN READ IT, and `notice` everywhere in
this codebase. That split is deliberate rather than an unfinished rename: `/nuntius`,
`NOTICE_PATH` and every unsubscribe link already printed into an inbox have to keep
working for as long as those mails exist, so the route and the identifiers are frozen
while the public name is free to be the word Polish actually uses. *Zawiadomienie* lives
almost only in official collocations — of a crime, of proceedings — and read as a summons
on a concert page.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class NoticeMailCopy:
    """Every string the confirmation mail prints, for one locale."""

    subject: str
    #: Inbox snippet beside the subject. Never repeats the subject verbatim.
    preheader: str
    eyebrow: str
    headline: str
    #: Why this mail arrived, and what confirming does. The address IS already stored while it
    #: waits — the PENDING row — so nothing here may promise that we are holding nothing yet.
    body: str
    button: str
    #: The promise the address is being given, restated where it is acted on. It names the SUBJECT
    #: — concerts, never the site's own "evenings" — and does not count letters: a count is an
    #: operational limit no sending policy keeps, while the subject is exactly what the consent
    #: record holds. The same sentence stands on the sign-up band
    #: (`web/src/content/pages/koncerty.yaml`, `notice.lede`) and on the receipt page; the three
    #: wordings move together.
    promise: str
    #: What to do if the reader did not ask for this. Doing nothing must be enough, and the seven
    #: days are `models.CONFIRM_TOKEN_TTL` — the number § 7 of the privacy policy publishes.
    ignore: str
    #: Administrator + where the full information clause lives.
    footer: str
    #: Label of the link to the privacy policy, appended to `footer`.
    policyLabel: str


#: The privacy policy, per locale — the public site's own route for it.
POLICY_PATH: dict[str, str] = {
    "pl": "/polityka-prywatnosci",
    "en": "/en/polityka-prywatnosci",
    "fr": "/fr/polityka-prywatnosci",
}


NOTICE_CONFIRM: dict[str, NoticeMailCopy] = {
    "pl": NoticeMailCopy(
        subject="Potwierdź zapis na zaproszenia",
        preheader="Jedno kliknięcie i adres trafia na listę. Bez niego znika po siedmiu dniach.",
        eyebrow="VoctEnsemble · Zaproszenia",
        headline="Potwierdź zapis",
        body=(
            "Ktoś podał ten adres, prosząc, byśmy napisali, gdy następny Koncert Duchowy "
            "dostanie datę. Jeśli to Ty — potwierdź jednym kliknięciem. Do tego czasu adres "
            "czeka wyłącznie na to potwierdzenie: nie trafia na żadną listę i nie wysyłamy "
            "nic więcej."
        ),
        button="Potwierdzam zapis",
        promise="Piszemy tylko o koncertach. Termin, miejsce, program i każda zmiana.",
        ignore=(
            "Jeśli to nie Ty — po prostu zignoruj tę wiadomość. Link wygasa po siedmiu dniach, "
            "a adres usuwamy."
        ),
        footer=(
            "Administratorem danych jest Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Kraków. Gdyby Fundacja zakończyła działalność, listę może przejąć osoba "
            "prowadząca zespół VoctEnsemble — uprzedzimy o tym wcześniej. Zgodę możesz "
            "wycofać w każdej chwili — pisząc na rodo@voctensemble.com albo linkiem "
            "w każdej naszej wiadomości."
        ),
        policyLabel="Polityka prywatności",
    ),
    "en": NoticeMailCopy(
        subject="Confirm your place on the invitation list",
        preheader="One click and the address joins the list. Without it, it is gone in seven days.",
        eyebrow="VoctEnsemble · Invitations",
        headline="Confirm your place",
        body=(
            "Someone gave this address, asking us to write when the next Spiritual Concert "
            "is given a date. If that was you, confirm it with one click. Until then the "
            "address waits for nothing but that confirmation: it reaches no list, and we "
            "send nothing further."
        ),
        button="Confirm",
        promise="We write only about concerts. The date, the place, the programme and every change.",
        ignore=(
            "If it was not you, simply ignore this message. The link expires after seven "
            "days, and we delete the address."
        ),
        footer=(
            "The data controller is Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Kraków, Poland. Should the foundation cease to operate, the list may pass "
            "to the person who runs the VoctEnsemble — we will tell you before that happens. "
            "You may withdraw your consent at any time — by writing to rodo@voctensemble.com "
            "or through the link in every message we send."
        ),
        policyLabel="Privacy policy",
    ),
    "fr": NoticeMailCopy(
        subject="Confirmez votre inscription aux invitations",
        preheader="Un clic et l'adresse rejoint la liste. Sans lui, elle disparaît au bout de sept jours.",
        eyebrow="VoctEnsemble · Invitations",
        headline="Confirmez votre inscription",
        body=(
            "Quelqu'un a donné cette adresse en nous demandant d'écrire lorsque le prochain "
            "Concert Spirituel recevra une date. Si c'était vous, confirmez-le d'un clic. "
            "D'ici là, l'adresse n'attend que cette confirmation : elle n'atteint aucune "
            "liste et nous n'envoyons rien d'autre."
        ),
        button="Je confirme",
        promise=(
            "Nous n'écrivons que pour les concerts. La date, le lieu, le programme "
            "et chaque changement."
        ),
        ignore=(
            "Si ce n'était pas vous, ignorez simplement ce message. Le lien expire au bout de "
            "sept jours et nous supprimons l'adresse."
        ),
        footer=(
            "Le responsable du traitement est la Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Cracovie, Pologne. Si la fondation venait à cesser son activité, la liste "
            "pourrait être reprise par la personne qui dirige le VoctEnsemble — nous vous en "
            "préviendrons à l'avance. Vous pouvez retirer votre consentement à tout moment — "
            "en écrivant à rodo@voctensemble.com ou par le lien présent dans chacun de nos messages."
        ),
        policyLabel="Politique de confidentialité",
    ),
}
