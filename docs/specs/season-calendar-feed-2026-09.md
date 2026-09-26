# Season calendar feed for managers

Status: built and committed 2026-09-26. Not yet reviewed in the browser; `make migrate`
(core/0028) pending on prod.

## What it is

A manager (role MANAGER or Django staff) can switch on, in Settings → Integrations, a
second iCal subscription: `/api/calendar/<season_calendar_token>/season.ics`. It carries
every published rehearsal and project that the manager's personal feed does not.

## Decisions

- **Second subscription, not a wider personal feed.** On the phone it is its own
  calendar (colour, checkbox), so hiding it is instant and local. Widening
  `calendar_token` would have leaked the whole season through any personal address
  shared earlier, and a panel switch only reaches Google at its next poll (hours).
- **Complement of the personal feed.** A manager subscribed to both never sees a
  date twice; sectionals they are not called to inside a project they sing in land
  in the season feed.
- **Published only.** DRAFT and CANCELLED stay out, like the personal feed. The
  panel's season view keeps drafts; this file is mirrored by providers and would
  hold an abandoned plan for hours.
- **Gate checked on every fetch**: enabled + `user.is_active` + `user_is_manager`.
  A demoted or deactivated manager keeps the address and gets an empty calendar.
- **Off = empty calendar, not 404.** Clients keep their last good copy through a
  failing fetch; an empty one clears the phone. The token survives off/on, so
  nothing is re-subscribed. Only the reset retires an address (then 404).
- The token is minted on first opt-in (nullable column; a callable default would
  have given every existing row the same UUID in the migration).

## Where

- Backend: `core/ical_service.py` (`generate_season_feed`, `season_feed_is_served`,
  `_personal_events`), `core/views.py` (`SeasonCalendarView`,
  `ResetSeasonCalendarTokenView`, `SeasonCalendarFeedView`), `core/services.py`,
  `UserProfile.season_calendar_*`, `UserProfileSerializer.season_calendar`
  (null = not offered). Tests: `SeasonCalendarFeedTests`, `SeasonCalendarEndpointTests`.
- Frontend: `features/settings/components/SeasonCalendarCard.tsx`, shared
  `CalendarSubscribeLinks.tsx`, keys `settings.integrations.season.*`.

## Open

- Visual review of the card (manager account, then a non-manager: no card).
- Prod: `make migrate`.
