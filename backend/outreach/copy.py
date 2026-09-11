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
docs/web-notice-list-2026-09.md.
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
    #: Why this mail arrived, and what confirming does.
    body: str
    button: str
    #: The promise the address is being given, restated where it is acted on.
    promise: str
    #: What to do if the reader did not ask for this. Doing nothing must be enough.
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
        subject="Potwierdź zapis na zawiadomienia o koncertach",
        preheader="Jedno kliknięcie i zapiszemy ten adres. Bez niego nie zapisujemy nic.",
        eyebrow="VoctEnsemble · Zawiadomienie",
        headline="Potwierdź zapis",
        body=(
            "Ktoś podał ten adres, prosząc, byśmy napisali, gdy następny Koncert Duchowy "
            "dostanie datę. Jeśli to byłeś Ty — potwierdź jednym kliknięciem. Do tej chwili "
            "nie zapisujemy niczego i nie wysyłamy nic więcej."
        ),
        button="Potwierdzam zapis",
        promise="Jeden list na jeden wieczór. Nic poza tym.",
        ignore=(
            "Jeśli to nie Ty — po prostu zignoruj tę wiadomość. Link wygasa po siedmiu dniach, "
            "a adres nie trafia na żadną listę."
        ),
        footer=(
            "Administratorem danych jest Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Kraków. Zgodę możesz wycofać w każdej chwili — pisząc na "
            "rodo@voctensemble.com albo linkiem w każdej naszej wiadomości."
        ),
        policyLabel="Polityka prywatności",
    ),
    "en": NoticeMailCopy(
        subject="Confirm your place on the concert notice list",
        preheader="One click and the address is on the list. Without it we store nothing.",
        eyebrow="VoctEnsemble · Notice",
        headline="Confirm your place",
        body=(
            "Someone gave this address, asking us to write when the next Spiritual Concert "
            "is given a date. If that was you, confirm it with one click. Until then we "
            "store nothing and send nothing further."
        ),
        button="Confirm",
        promise="One letter for one evening. Nothing else.",
        ignore=(
            "If it was not you, simply ignore this message. The link expires after seven "
            "days and the address reaches no list at all."
        ),
        footer=(
            "The data controller is Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Kraków, Poland. You may withdraw your consent at any time — by writing "
            "to rodo@voctensemble.com or through the link in every message we send."
        ),
        policyLabel="Privacy policy",
    ),
    "fr": NoticeMailCopy(
        subject="Confirmez votre inscription aux annonces de concerts",
        preheader="Un clic et l'adresse est inscrite. Sans lui, nous ne gardons rien.",
        eyebrow="VoctEnsemble · Annonce",
        headline="Confirmez votre inscription",
        body=(
            "Quelqu'un a donné cette adresse en nous demandant d'écrire lorsque le prochain "
            "Concert Spirituel recevra une date. Si c'était vous, confirmez-le d'un clic. "
            "D'ici là, nous ne gardons rien et n'envoyons rien d'autre."
        ),
        button="Je confirme",
        promise="Une lettre pour une soirée. Rien de plus.",
        ignore=(
            "Si ce n'était pas vous, ignorez simplement ce message. Le lien expire au bout de "
            "sept jours et l'adresse n'atteint aucune liste."
        ),
        footer=(
            "Le responsable du traitement est la Fundacja VoctFoundation, ul. Św. Filipa 23/3, "
            "31-150 Cracovie, Pologne. Vous pouvez retirer votre consentement à tout moment — "
            "en écrivant à rodo@voctensemble.com ou par le lien présent dans chacun de nos messages."
        ),
        policyLabel="Politique de confidentialité",
    ),
}
