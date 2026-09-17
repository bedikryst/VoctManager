# Email template redesign — audit and implementation plan

Status: Audit complete — implementation pending
Date: 2026-09-17

## Scope

This audit covers the shared shell, 13 HTML message templates, seven HTML partials,
their delivery context, and the public-site visual canon used as the brand reference.
Plain-text alternatives are in scope for parity, but they do not need visual changes.

Primary references:

- `backend/templates/emails/base.html`
- `backend/templates/emails/*.html`
- `backend/templates/emails/partials/*.html`
- `backend/notifications/email_service.py`
- `backend/config/settings.py`
- `web/src/styles/base.css`
- `web/src/styles/tokens.css`
- `.ai/07_marketing_public_site.md`

## Verdict

The current system has a sound delivery skeleton but an obsolete visual grammar. It reads as a
2019 luxury-SaaS template: a floating white card, soft shadow, thin gold strip, centered serif
headline, heavily tracked micro-labels, a framed CTA block, and repeated tinted feature cards.
The same ceremonial hierarchy is applied to invitations, security alerts, operational facts,
authored messages, and internal reports, so different messages look more alike than they read.

The redesign should not add richer effects. Email clients are the wrong surface for that. The
target is an editorial dispatch: restrained, left-aligned, parchment-and-ink, recognizably Voct,
and structurally robust when a client ignores CSS or transforms colors.

## Findings

### P0 — remote assets violate the project's privacy boundary

- Every member email links to Google Fonts from `base.html`.
- Every rendered email receives `EMAIL_LOGO_URL`, currently a 286 KB image served by
  `raw.githubusercontent.com` and displayed at 56 px.
- The public notice template suppresses the Google font but still inherits the GitHub image.
- Both requests disclose the recipient's IP on open. This contradicts the project's
  zero-third-party-request rule and the stated reason for the public template's `webfont` block.
- If images are blocked, the configured image branch shows alt text/broken-image UI; the HTML
  wordmark fallback is never reached because the URL is always configured.

Decision: the baseline masthead must make no remote request. Use an HTML wordmark/mark. Any future
first-party font is progressive enhancement only and must not be required for hierarchy.

### P0 — key text fails contrast before dark mode is involved

The templates contain 27 distinct hex colors and 120 foreground/background color declarations.
Several frequently used pairs fail the 4.5:1 minimum for ordinary text:

| Use | Pair | Contrast |
| --- | --- | ---: |
| Gold labels on white | `#c9a764` / `#ffffff` | 2.28:1 |
| Pale labels on white | `#c9bfb4` / `#ffffff` | 1.81:1 |
| Footer copy | `#ddd8d1` / `#faf9f7` | 1.35:1 |
| Italic support copy | `#a89e95` / `#ffffff` | 2.63:1 |
| Outer note | `#b8a99a` / `#f8f6f2` | 2.12:1 |

These colors are mostly used at 9–11 px with wide tracking, which makes the failure more severe.
The public-site canon already solved this exact problem: full candle gold is a mark, while
`--candle-ink` (`#735f35`) is readable text on all paper grounds.

Decision: port the semantic palette, not the CSS variables. Use solid email-safe values based on
paper `#f4f1e9`, ink `#161514`, ink-soft `#34302b`, muted ink `#746d62`, and readable gold ink
`#735f35`. Reserve `#c6a45b` for rules, borders, and filled marks.

### P1 — the light-only declaration is treated as a guarantee

`color-scheme: light` and the two meta tags are useful hints, not a reliable opt-out. Microsoft
documents that clients can apply no transformation, partial/full inversion, or their own
overrides. Classic Outlook can also darken the message background unless the recipient disables
that behavior. Gmail supports authored style blocks and media queries, but Google does not
promise one uniform dark-mode transformation across Gmail surfaces.

The claim that desktop Gmail and every desktop Outlook variant perform the same dark-to-light
conversion is therefore too broad. The practical requirement is stronger: the mail must survive
unchanged light rendering, partial inversion, and full inversion.

Decision:

- Keep light scheme metadata as a preference, never as the only defense.
- Avoid pure white and pure black; Microsoft explicitly recommends near-white and dark gray.
- Reduce nested backgrounds so partial inversion has fewer independent surfaces to transform.
- Keep essential distinctions in wording, weight, spacing, and borders rather than color alone.
- Use high-contrast foreground/background pairs that remain separable when both are transformed.
- Do not use client-specific inversion hacks as the core strategy.

Sources:

- Microsoft: https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/email-dark-mode
- Microsoft: https://support.microsoft.com/en-us/accessibility/windows/use-color-and-contrast-for-accessibility-in-microsoft-365
- Google: https://developers.google.com/workspace/gmail/design/css
- Google: https://support.google.com/mail/answer/13397089
- W3C: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

### P1 — classic Outlook compatibility is accidental in several places

The table layout and explicit 600 px width are correct foundations, but the presentation depends
on features classic Outlook's Word engine does not reproduce faithfully:

- rounded corners plus `overflow: hidden` on the outer table;
- a box shadow used to separate the entire artifact;
- link padding used as the button's hit area, without a table-cell/VML fallback;
- hover transitions that add no dependable value in mail;
- `max-width` and modern CSS carrying details that should have HTML-attribute fallbacks.

There are 31 tables across the HTML system; only four are marked `role="presentation"`. The other
27 layout tables can be exposed as data tables by assistive technology.

Decision: use square editorial geometry, presentation tables, explicit attributes plus inline
baseline styles, and a bulletproof table-cell CTA. CSS in `<style>` should be enhancement for
mobile behavior, not a prerequisite for the desktop layout.

### P1 — one ceremonial template masks five different jobs

The current shell treats these as one visual archetype:

1. action/security: activation, reset, password change;
2. operational: transactional notices, briefing, daily digest;
3. authored communication: direct/admin messages;
4. internal tooling: feedback and patron-lead reports;
5. public consent: concert notice confirmation.

Warning/urgent messages differ mainly by suppressing the warm sign-off. The headline, gold accent,
and CTA framing remain the same. Conversely, routine digests receive the same ceremony as account
security. This flattens urgency and slows scanning.

Decision: share one shell but provide semantic compositions. Alarm color may appear only when the
message states a real problem; urgency must also be written, not encoded only by color.

### P2 — the visual hierarchy is dated and over-authored

- Almost all meaningful copy is centered, including multi-line body text.
- Headline, subtitle, greeting, rule, body, framed CTA, rule, and sign-off create excessive
  vertical ceremony before the recipient reaches the fact or action.
- 9 px uppercase labels with up to `0.5em` tracking look decorative rather than informative.
- Welcome-email feature cards repeat product marketing for somebody already invited.
- The CTA is placed inside a second bordered surface, making a button look like a promotional tile.
- Playfair Display is inconsistent with the current Cormorant/Plex identity and often falls back
  anyway because webfont support in mail clients is not dependable.

Decision: move to a left-aligned reading axis, remove redundant framing, reduce the number of type
voices, and let whitespace plus one hairline establish hierarchy.

### P2 — maintenance invites drift

There are 164 inline `style` attributes, with legacy `bgcolor` attributes alongside many of them,
plus repeated copies of body, note, detail-card, CTA-panel, and section-header recipes. Inline
baseline styles are appropriate for email, but the
semantic values are not centralized: a color adjustment currently requires edits across most of
the template family.

Decision: shared partials own stable primitives and the shell documents one email palette.
Template-specific inline styles remain only where the composition genuinely differs.

## What is already good

- Hidden preheaders exist and are populated.
- The shell has a conservative 600 px table structure and a useful mobile breakpoint.
- The primary CTA becomes full-width on narrow screens.
- HTML and plain-text alternatives are sent together.
- Localization is resolved at send time, and the public notice correctly keeps Polish as its copy
  source instead of forcing it through English gettext source strings.
- Public/member sender, footer, reply-to, and unsubscribe semantics are already separated.
- User-authored copy is escaped, and multi-line detail values are handled safely.

These should be preserved rather than rebuilt.

## Target direction: editorial dispatch

### Shell

- A quiet parchment field instead of a floating white card.
- A compact HTML masthead: Voct identity plus a factual sender label, with no remote image.
- One thin candle rule as the recurring brand mark.
- A 560–600 px readable measure with 28–48 px responsive gutters.
- No shadow, faux paper texture, rounded SaaS card, or decorative top stripe.

### Type and hierarchy

- System sans stack for reading text; a serif stack that succeeds in Georgia fallback.
- Left-aligned kicker, headline, lead, and body.
- Headline around 32–36 px desktop and 27–30 px mobile, with short measure.
- Body at 16 px and roughly 1.6 line-height.
- Labels at a readable 11–12 px, moderate tracking, and accessible ink.
- Centering reserved for the masthead or a genuinely singular confirmation, not paragraphs.

### Components

- Detail rows become a restrained ledger separated by hairlines, not a stack of mini-cards.
- Authored notes use one border rule and natural text, not a tinted quote box.
- CTA is a table-cell button with a visible text fallback link where security requires it.
- Footer is compact, readable, and factual; sign-off appears only where a human voice benefits from
  it.
- Public mail shares the craft but says VoctEnsemble, never VoctManager/member-network claims.

## Implementation stages

### Stage 1 — shell and primitives

Change:

- `backend/templates/emails/base.html`
- `backend/templates/emails/partials/_button.html`
- `backend/templates/emails/partials/_eyebrow.html`
- `backend/templates/emails/partials/_greeting.html`
- `backend/templates/emails/partials/_headline.html`
- `backend/templates/emails/partials/_subtitle.html`
- `backend/templates/emails/partials/_rule.html`
- `backend/templates/emails/partials/_signoff.html`
- `backend/notifications/email_service.py`
- `backend/config/settings.py`

Remove Google Fonts and the GitHub logo dependency. Establish the palette, Outlook-safe table
defaults, responsive shell, accessible wordmark, and bulletproof CTA.

### Stage 2 — compositions

Change all 13 `backend/templates/emails/*.html` message templates. Migrate them by archetype while
preserving variables, escaping, localization, URLs, public-mail overrides, and plain-text parity.
Do not edit `web/src/styles/base.css` or `web/src/styles/tokens.css`; they are reference sources and
the concurrent web session owns that tree.

Only change gettext catalogs if copy changes are deliberately accepted. A visual pass should not
create translation churn by accident.

### Stage 3 — verification

Extend the existing backend tests to assert:

- every HTML template renders;
- no rendered mail references Google Fonts or GitHub assets;
- public mail contains no member-only claims;
- CTA destinations and fallback links remain intact;
- all layout tables are presentation tables;
- HTML and text versions retain the same core action.

Run once at the end:

```powershell
& .venv\Scripts\python.exe -m ruff check backend\notifications backend\core backend\outreach backend\payments
& .venv\Scripts\python.exe -m mypy backend\notifications backend\core backend\outreach backend\payments
& .venv\Scripts\python.exe backend\manage.py test notifications core outreach payments --settings=config.test_settings_sqlite
```

### Stage 4 — client acceptance matrix

Send representative action, digest, authored-message, and public-consent emails. Check:

- Gmail web in light and dark themes;
- classic Outlook for Windows in light and dark modes;
- new Outlook for Windows / Outlook web in light and dark modes;
- Gmail and Apple Mail on iOS;
- images disabled;
- 320–390 px mobile width and 600 px desktop width;
- keyboard focus, zoomed text, and screen-reader table navigation.

Acceptance is semantic and visual, not pixel-identical: no unreadable pair, no disappearing CTA,
no false sender claim, no third-party request, and no layout that depends on unsupported effects.
