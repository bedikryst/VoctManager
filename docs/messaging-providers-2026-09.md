# Messaging providers — email today, SMS next (2026-09)

Written 2026-09-05, before any provider was changed. Two questions arrived together and are
answered together, because answering them apart is what makes the wrong choice look right:
*move e-mail out of the USA* and *add SMS, soon*.

## How to read this file

- **§1 The reachability problem** — why SMS is not a nice-to-have here. Read this first; it
  decides the shape of everything below.
- **§2 What SMS must not become** — the design constraint, and the three reasons behind it.
- **§3 The legal split** — members vs. the concert notice list. They are not the same channel.
- **§4 Providers** — what was verified, what was disproved, what is still untested.
- **§5 What the swap actually touches** — the surface, measured in the repository.
- **§6 Runbook** — order of work, and the two tests that must run before any decision.

Companion to `docs/legal/podprocesorzy.md` (the subprocessor register, which this changes) and
`docs/web-notice-list-2026-09.md` (the list whose consent this must not break).

---

## §1 The reachability problem

The ensemble's rhythm is the cause: a concert every few months, and a singer who may not be cast
for a year. The channels the panel has today both degrade over exactly that interval.

**Web push does not survive dormancy — and usually was never there.** `PushService._send_vapid_batch`
retires a subscription the moment the browser answers 404/410 (`_VAPID_STALE_STATUSES` →
`is_active=False`, `backend/notifications/push_service.py`). That is correct behaviour and it means
the person is silently gone from the channel. The deeper fact is worse: push requires the reader to
have installed the PWA and granted permission — on iOS, to have added it to the home screen at all.
A singer invited once a year most likely never did. **Push is not decaying for them; it never
existed.**

**E-mail degrades silently too.** A year-old address may be dead, and the system only learns this
from a bounce — i.e. after the invitation has already failed. The suppression path
(`notifications/signals.py`) records the failure; it cannot deliver the message.

So the missing channel is not "another stream". It is **an address that survives a year of silence
and that the reader did not have to configure.** That is a phone number, and nothing else in reach.

**Corollary, and it is load-bearing:** phone numbers rot as well, and the SMS equivalent of a bounce
is the gateway's delivery report (DLR). SMS must therefore feed the *same* reachability ledger that
e-mail bounces already feed — an undeliverable number is a fact about a person, exactly like
`email_undeliverable`. A gateway without delivery-report callbacks is disqualified for the same
reason an ESP without tracking webhooks is.

---

## §2 What SMS must not become

**It must not be a third column in the preference ledger.** `notifications/delivery.py` models a
`PreferenceGroup` as `email: bool, push: bool = True`, and the settings matrix renders exactly those
two. Adding `sms: bool` to every group is the obvious move and it is wrong three times over:

1. **Cost.** E-mail and push are free at the margin; SMS is not. A fan-out bug in e-mail is
   embarrassment. The same bug in SMS is an invoice, and it arrives before anyone notices.
2. **Consent.** A channel that carries everything reads as marketing even when each message is
   operational. The narrower the whitelist, the easier the legal position in §3 is to defend.
3. **It answers the wrong question.** The problem is the reachability of the dormant, not the
   volume of notification. A reader who opens the app does not need an SMS about a new recording.

**The shape that fits:** SMS is an **escalation channel over a whitelist**, not a preference column.
The whitelist is the class of events whose failure costs the reader a wasted journey or a missed
commitment — `PROJECT_INVITATION`, `PROJECT_CANCELLED`, `REHEARSAL_CANCELLED`. Nothing else, and
nothing in `messages` or `materials`.

**Ship the manual version first.** Before any automatic rule, the highest-value increment is a
manager-initiated *"also send SMS"* on the announcement queue's publication step: the manager knows
which announcement matters, the cost is bounded and visible, and it requires no surgery on the
preference ledger. The automatic escalation (fire when the recipient has no active push device and
no confirmed e-mail delivery) is a second stage that can be designed once real send volumes exist.

**Two guards are not optional, whichever stage ships:** a hard ceiling on recipients per dispatch,
and a kill switch in settings. Both exist because the failure mode is financial, not cosmetic.

**Before any of this: the phone number is not yet data.** `core.UserProfile.phone_number` is
`CharField(max_length=32, blank=True)` whose `help_text` says "International format" and whose model
enforces nothing (`roster.Artist.phone_number` is a projection of the same width). A typo'd number
does not fail — it delivers rehearsal details to a stranger. E.164 normalisation, validation, and a
one-time confirmation code are the entry price for the channel, not polish.

---

## §3 The legal split

**Members (the panel):** SMS about a rehearsal, an invitation, a cancellation is the performance of
the relationship the singer is already in — not direct marketing. It needs a lawful basis and a
clear notice, not a marketing consent, and it belongs in the existing privacy notice as a channel.

**The concert notice list (`outreach`):** SMS to that audience *is* direct marketing under Polish
electronic-communications law, and the consent collected in 2026-09 covers e-mail only. It would
require its own consent, a phone field on a public form, and a second retention story.

**Decision: do not put a phone field on the public notice form.** The list stays e-mail-only. The
consent record built in `docs/web-notice-list-2026-09.md` is evidence for one channel; widening it
would mean re-collecting consent from everyone already on the list.

---

## §4 Providers

### Disproved

- **"EmailLabs + SMSAPI is one group, so fewer subprocessors."** SMSAPI is a brand of LINK Mobility
  Poland sp. z o.o. (LINK Mobility Group ASA, Oslo). EmailLabs is Vercom S.A. (Poznań). Two
  entities, two DPAs. Vercom's own SMS brand is SerwerSMS; its omnichannel product is MessageFlow.
- **"EmailLabs technically already has what is needed."** django-anymail 13.0 as installed
  (verified in both `.venv` and `backend/venv`) ships backends for amazon_ses, brevo, mailersend,
  mailgun, mailjet, mandrill, postal, postmark, resend, sendgrid, sendinblue, sparkpost,
  unisender_go. No emaillabs. No scaleway. EmailLabs means either SMTP (losing the tracking webhook
  and with it the whole suppression path) or a custom backend plus a custom webhook view — roughly
  200 lines with tests, and a permanent maintenance obligation.
- **Mailjet as "plan B".** Anymail's ESP matrix records Mailjet as **max 1 tag**;
  `notifications/email_service.py` sets `msg.tags = [email_type, template_name]` unconditionally.
  Every send would raise `AnymailUnsupportedFeature`. One-line fix, but it must be known before the
  switch, not after.
- **Scaleway TEM.** Still "Not yet" for tracking webhooks in current Anymail docs, on top of its
  terms forbidding marketing mail. Out on both counts.

### Verified

| | entity | e-mail | SMS | Anymail | monthly floor |
|---|---|---|---|---|---|
| **Brevo** | Brevo, France | yes | yes (credits) | native | none; free tier carries Brevo branding |
| **EmailLabs** | Vercom S.A., PL | yes | no | none | 0 (9k/mo, 300/day) or 99 PLN |
| **SerwerSMS** | Vercom S.A., PL | (bundled) | yes | n/a | plans from 49 PLN/mo |
| **SMSAPI** | LINK Mobility, NO | no | yes | n/a | prepaid: none, min 49 PLN top-up |
| **MessageFlow** | Vercom S.A., PL | yes | yes + push/RCS/WhatsApp | none | contact sales |

**At this volume the per-message price is noise.** A choir of a few dozen people times a handful of
events is on the order of a few hundred SMS per year — roughly 20–40 PLN. The only number that
matters is the **monthly floor**: a 49 PLN/month plan costs more per year than the messages do by an
order of magnitude. Prefer credit/prepaid models with no subscription.

### Settled by test, 2026-09-05

**Brevo stamps its branding on free-plan transactional mail.** Verified by sending the project's own
HTML through their API and reading the received source. Removing it costs roughly €18/month
(Starter plus the branding add-on). Brevo is out at the free tier, and paying for it buys nothing
the alternative does not give away — see the correction below.

**The Polish SMS sender-ID question died with it.** It was only ever a question about a *foreign*
aggregator routing into Polish networks. A Polish gateway on its home market is not in doubt, so
there is nothing to test: registering a sender name is ordinary onboarding, capped at 11 characters
and approved within about a business day.

### Correction: vendor count was weighted too heavily

An earlier draft of this file made "one entity for both channels" a headline argument for Brevo.
That was wrong, and the reasoning that replaces it also changes what the table above is for.

Accepting a DPA is a click and an archived PDF. The count of subprocessors is a proxy for three
things that actually carry risk, and it tracks none of them well:

1. **Jurisdiction.** A US processor means standing on DPF/SCC — a mechanism that has collapsed
   before. Five EU processors are a better position than two where one sits outside the EEA.
2. **Which data leaves, not how many vendors see it.** The notice list carries addresses of people
   who never joined anything; that is a different exposure from a member's mailbox.
3. **Whether the register is true.** This is the only one an inspection actually catches, and the
   only failure mode this project has actually had — the FCM row that described nothing.

Brevo (France) and EmailLabs (Poland) pass the jurisdiction test equally. So the decision was never
between one vendor and two; it was between a provider that charges to remove its own advertisement
from a foundation's consent mail and one that does not.

### Decision

**E-mail: EmailLabs.** Free STARTUP tier (9 000/month, 300/day), no branding, Polish entity, Polish
invoice, servers in Poznań and Berlin, no third-country transfer. Webhooks confirmed available on
the free tier with HTTP basic auth — which was the one condition that could have disqualified it.
The backend and the delivery-report webhook are written (`notifications/emaillabs_backend.py`,
`notifications/emaillabs_webhook.py`).

**SMS: a Polish gateway, prepaid.** At a few hundred messages a year the per-message price is noise
and the monthly floor is the whole cost, so a subscription plan is the one thing to avoid. SMSAPI's
prepaid model has no monthly fee (minimum 49 PLN top-up, ~0.11–0.17 PLN/SMS). It belongs to LINK
Mobility (Norway) — EEA, so no third-country transfer, and a second DPA that by the reasoning above
costs nothing worth optimizing away.

**Independent of all of the above: Google FCM is dead weight.** No client in this repository
registers an FCM token — `frontend/` has no firebase dependency and nothing produces
`registration_token`; `PushService._deliver` routes only `device_type != WEB` to FCM, which nothing
can create. Yet `firebase_admin` initialises at boot and `docs/legal/podprocesorzy.md` lists Google
FCM as a subprocessor with a US transfer. By that file's own closing rule — only dropping a function
reduces the number of DPAs, never swapping a tool — this is the single real reduction available, and
it is free.

---

## §5 What the swap actually touches

The abstraction is clean: every message goes through one `EmailMultiAlternatives` in
`EmailService._dispatch_core`. Provider identity lives in four places — `config/settings.py`
(the `ANYMAIL` dict and `EMAIL_BACKEND`), `requirements.txt`, `config/urls.py` (the webhook mount),
and `.env.example`. The only hard coupling is the `anymail.signals.tracking` receiver in
`notifications/signals.py`, which is why an ESP without tracking webhooks is not a candidate.

The work that is larger than the code is the published name of the provider, which appears in five
layers and must ship **with** the switch, not after it:

- `docs/legal/podprocesorzy.md`, `docs/legal/rodo-ropa.md`, `docs/legal/klauzula-informacyjna.md`
- `web/src/content/pages/polityka-prywatnosci.yaml`, `web/src/content/pages.en.yaml`,
  `web/src/content/pages.fr.yaml`, `web/src/i18n/content/politykaPrywatnosci.ts`
- `frontend/src/shared/config/locales/{pl,en,fr}/translation.json` and
  `frontend/src/features/auth/components/LegalContent.tsx`

Plus DNS for the sending domain (SPF/DKIM/DMARC) and, for SMS, sender-ID verification at the
gateway — 11 characters, no diacritics, typically approved within a business day.

---

## §6 Runbook

**Done, 2026-09-05:** the dead FCM branch and Google's subprocessor row (see §4); the branding
test; the EmailLabs account with webhooks confirmed; the backend, the webhook view and their tests.

**Remaining, in order.**

1. ~~DNS~~ **Done 2026-09-05.** What the zone ended up as, and why, since none of it is guessable:

   | host | type | purpose |
   |---|---|---|
   | `bounce.voctensemble.com` | CNAME → `*.mf-settings.com` | dedicated Return Path |
   | `default._domainkey.voctensemble.com` | CNAME → `*.mf-settings.com` | DKIM |
   | `_dmarc` | TXT `v=DMARC1; p=none; sp=none;` | **ours, kept** |
   | `voctensemble.com` | TXT `v=spf1 include:_spf.google.com ~all` | Google Workspace, added |

   **There is no EmailLabs `include:` in SPF, and that is correct.** The dedicated Return Path
   moves SPF onto `bounce.voctensemble.com`, which relaxed DMARC alignment accepts as the same
   organizational domain; DKIM aligns through the selector above. The root SPF exists only for
   the humans' Google Workspace mail, which had none.

   **EmailLabs also generates a `_dmarc` CNAME. Do not add it.** A CNAME cannot coexist with any
   other record on the same name, so it would collide with the DMARC TXT above and make the
   policy resolve unpredictably. Their own verification screen lists "Własna Autoryzacja Domen
   (DMARC)" as a supported alternative and passes on our TXT — keeping the policy ours rather
   than delegating it to the ESP.

   **The `click.` whitelabel record is deliberately absent.** It exists to rewrite tracked links
   through our own domain, and link tracking is off: the notice list promises it measures nothing.
   Its permanent red "No cname record" in their panel is the configuration, not a fault.

   The sending identity is `VoctEnsemble <noreply@voctensemble.com>` — moved off the old
   `voctmanager@notifications.voctensemble.com`, which the settings' own comments already argued
   was the wrong thing for a stranger on the notice list to read first. `PUBLIC_FROM_EMAIL` is
   left unset so it derives from it. `rodo@voctensemble.com` must stay a mailbox a person reads —
   the notice mail's footer promises it.

   Two panel quirks that cost time: the Return Path field wants a **bare phrase** (`bounce`), not
   a domain — anything with a dot is rejected; and the SMTP account name is auto-derived from the
   account owner's login, not the domain.
2. ~~Decide the sending identity's traffic type.~~ **Settled 2026-09-05: one account, typed
   Marketing, and that is where it stays.** EmailLabs support confirmed that a *transactional*
   account type and a second SMTP account both begin at PRO 100 — 299 PLN/month, an order of
   magnitude past what this volume justifies. The tier also bundles a dedicated IP, which at a few
   hundred messages a month is actively worse than a shared one: there is no traffic to build a
   reputation from.

   What the type actually changes is the shared IP pool, and nothing else. The classification
   header is a separate per-account setting, already set to transactional (`Precedence: list`),
   and at low volume inbox placement is dominated by domain authentication — SPF, DKIM and DMARC,
   all verified and aligned (see the DNS table above).

   So the risk is real, unmeasurable in advance, and probably small. **It gets measured, not
   pre-paid.** If panel mail actually lands in spam, the cheap answer is paid Brevo at roughly
   78 PLN/month, not PRO 100 — and by then there would be evidence instead of a theory.

   Consequence for the code: the `esp_extra` → `smtp_account` hook in `emaillabs_backend.py` is
   deliberately unused. It stays because the day a second identity exists, routing the notice list
   onto it is one line in `outreach/services.py`.
3. **Configure `.env`** — `EMAIL_PROVIDER=emaillabs`, the two API keys, `EMAILLABS_SMTP_ACCOUNT`,
   and `EMAILLABS_WEBHOOK_SECRET` as a long random `user:password`. The same string goes into the
   panel under Webhooks → Authentication mode → Basic auth, with the URL
   `https://<host>/api/webhooks/email/emaillabs/tracking/`. **Without the secret the route is not
   mounted at all** — an unauthenticated delivery-report endpoint would let anyone mark any address
   undeliverable or end a subscriber's consent.
4. **Watch the first real events.** The webhook payload's field names are not publicly documented,
   so the view reads each field from a set of candidates and logs anything it cannot map
   (`[EmailLabsWebhook] Unreadable event` / `Unknown status`). Those two log lines are the
   specification; once real reports have been seen, narrow `_STATUS_MAP` and the key tuples.
5. **Then** the five documentation layers of §5, in the same change as the switch — not after it.
6. **Then** SMS: E.164 validation and phone confirmation → gateway client with DLR callback feeding
   the reachability ledger → a manual "also send SMS" on the announcement queue → only later, any
   automatic escalation.

Verification for any of it: `ruff` and `mypy` on the touched apps, the touched apps' tests under
`config.test_settings_sqlite`, and `npm run build` in `frontend/` for anything that changes the
settings matrix or the legal copy.
