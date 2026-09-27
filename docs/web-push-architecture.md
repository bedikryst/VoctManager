# Web Push Notifications — Architektura i przepływ danych

> Dokument opisuje implementację powiadomień push w przeglądarce dla VoctManager.
> Standard: W3C Web Push API + VAPID (Voluntary Application Server Identification).

---

## 1. Co to jest Web Push i dlaczego tak działa?

Przeglądarka **nie może** stale słuchać połączenia z Twoim serwerem — to by zużywało baterię i zasoby. Zamiast tego korzysta z globalnej infrastruktury push dostarczanej przez producenta przeglądarki:

- **Chrome / Edge** → Google FCM (Firebase Cloud Messaging)
- **Firefox** → Mozilla Push Service
- **Safari** → Apple Push Notification Service

Twój backend nie wysyła powiadomień bezpośrednio do przeglądarki użytkownika. Wysyła je do **usługi push przeglądarki**, która dostarcza je dalej. VAPID to standard uwierzytelniania, który pozwala tej usłudze zweryfikować, że wiadomość rzeczywiście pochodzi z Twojego serwera, a nie od kogoś obcego.

---

## 2. Uczestnicy systemu

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRZEGLĄDARKA UŻYTKOWNIKA                        │
│                                                                         │
│  ┌─────────────────────┐        ┌──────────────────────────────────┐   │
│  │   Aplikacja React   │        │        Service Worker (sw.js)    │   │
│  │  (główna zakładka)  │        │   (działa w tle, nawet gdy       │   │
│  │                     │        │    zakładka jest zamknięta)      │   │
│  │  usePushNotifi-     │        │                                  │   │
│  │  cations hook       │        │  - odbiera zdarzenie "push"      │   │
│  │                     │        │  - wyświetla powiadomienie       │   │
│  └─────────────────────┘        │  - obsługuje kliknięcie         │   │
│                                 └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         ↕  rejestracja subskrypcji             ↑  dostarczenie push
         ↕  (jednorazowo)                       │  (w dowolnym momencie)
┌────────────────────┐              ┌───────────────────────────────────┐
│   Backend Django   │  ────────→   │   Usługa push przeglądarki        │
│                    │  VAPID push  │   (Google/Mozilla/Apple)          │
│  push_service.py   │              │                                   │
│  pywebpush         │              └───────────────────────────────────┘
└────────────────────┘
```

---

## 3. Klucze VAPID — co to jest i po co?

VAPID to para kluczy kryptograficznych (publiczny + prywatny), wygenerowana raz dla Twojej aplikacji:

```
VAPID_PUBLIC_KEY   → udostępniany przeglądarce (bezpieczny)
VAPID_PRIVATE_KEY  → tylko na serwerze (tajny!)
```

**Analogia:** To jak pieczęć firmowa. Przeglądarka użytkownika zapamiętuje Twój klucz publiczny przy subskrypcji. Gdy backend wysyła powiadomienie i podpisuje je kluczem prywatnym, usługa push weryfikuje podpis kluczem publicznym. Tylko Ty możesz wysłać powiadomienie do Twoich użytkowników.

---

## 4. Przepływ — Aktywacja push przez użytkownika

Kroki w kolejności, gdy użytkownik klika "Aktywuj" w NotificationsTab:

```
Krok 1 — Przeglądarka pyta użytkownika
   NotificationsTab → PushPermissionBadge [Aktywuj]
   → usePushNotifications.subscribe()
   → Notification.requestPermission()
   → Przeglądarka pokazuje systemowy dialog "Zezwolić na powiadomienia?"
   → Użytkownik klika "Zezwól"
   → permission = "granted"

Krok 2 — Rejestracja Service Workera
   → navigator.serviceWorker.register("/sw.js")
   → Przeglądarka pobiera i instaluje sw.js (jeden raz)
   → sw.js działa teraz w tle jako osobny wątek przeglądarki

Krok 3 — Subskrypcja Push
   → registration.pushManager.subscribe({
       userVisibleOnly: true,
       applicationServerKey: <VAPID_PUBLIC_KEY jako Uint8Array>
     })
   → Przeglądarka kontaktuje się z usługą push (np. Google)
   → Usługa push zwraca unikalną subskrypcję:
     {
       endpoint: "https://fcm.googleapis.com/fcm/send/ABC123...",
       keys: {
         p256dh: "BNcRd...",   ← klucz szyfrowania payload
         auth:   "tBHI..."     ← sekret uwierzytelniający
       }
     }
   → Ten endpoint to ADRES tej konkretnej przeglądarki użytkownika

Krok 4 — Rejestracja w backendzie
   → POST /api/notifications/devices/
     { endpoint, p256dh_key, auth_key }
   → Backend zapisuje do tabeli notifications_push_device:
     - registration_token = endpoint URL
     - p256dh_key = klucz szyfrowania
     - auth_key = sekret
     - device_type = "WEB"
     - user = zalogowany użytkownik

Krok 5 — UI odblokowany
   → isSubscribed = true
   → Kolumna Push w tabeli staje się interaktywna
```

---

## 5. Przepływ — Wysyłanie powiadomienia z backendu

Gdy w systemie wydarzy się coś (np. nowa próba, zaproszenie do projektu):

```
1. Serwis domenowy (np. ProjectService) wywołuje:
   NotificationService.create_notification(dto)

2. NotificationService sprawdza NotificationPreference użytkownika:
   pref.push_enabled == True? → idzie dalej

3. PushDispatcherService.dispatch_to_user(recipient_id, ...)
   → pobiera wszystkie aktywne PushDevice użytkownika
   → wszystkie aktywne subskrypcje idą jedną drogą:

   → _send_vapid_batch()
     → pywebpush.webpush(
         subscription_info = { endpoint, keys: { p256dh, auth } },
         data = JSON payload,
         vapid_private_key = VAPID_PRIVATE_KEY,
         vapid_claims = { sub: "mailto:noreply@voct.pl" }
       )
     → Wysyłanie HTTP POST do endpoint URL, który wskazała przeglądarka
     → Google/Mozilla/Apple dostarcza do przeglądarki użytkownika

4. Przeglądarka budzi Service Workera (sw.js):
   → zdarzenie "push" odpala się
   → sw.js parsuje payload: { title, body, url }
   → self.registration.showNotification(title, { body, icon, ... })
   → System operacyjny wyświetla powiadomienie (nawet gdy przeglądarka zamknięta)

5. Użytkownik klika powiadomienie:
   → zdarzenie "notificationclick" w sw.js
   → otwiera URL z payload (np. /panel/projects/uuid)
```

---

## 6. Payload powiadomienia (format JSON)

Backend wysyła JSON, który sw.js parsuje:

```json
{
  "title": "Nowa próba zaplanowana",
  "body": "Próba 'Requiem' - 15 maja, 18:00, Sala główna",
  "url": "/panel/projects/abc-123",
  "tag": "rehearsal-scheduled",
  "renotify": false
}
```

| Pole       | Opis                                                               |
| ---------- | ------------------------------------------------------------------ |
| `title`    | Nagłówek systemowego powiadomienia                                 |
| `body`     | Treść                                                              |
| `url`      | Dokąd przejść po kliknięciu                                        |
| `tag`      | Grupowanie — nowe z tym samym tagiem zastępuje stare (nie spamuje) |
| `renotify` | `true` = pokaż dźwięk/wibrację nawet przy zastąpieniu              |

---

## 7. Stany UI kolumny Push w NotificationsTab

```
Notification.permission
       │
       ├── "default"  → [🔒 Aktywuj] przycisk w nagłówku kolumny
       │                  Switche: wyszarzone, kursor "not-allowed"
       │                  Tooltip przy hoveru: "Aktywuj push aby zarządzać"
       │
       ├── "denied"   → [🔕 Zablokowane] badge w nagłówku
       │                  Switche: wyszarzone
       │                  Tooltip: "Odblokuj w ustawieniach przeglądarki"
       │                  (nie można programowo poprosić ponownie!)
       │
       └── "granted"  → Normalne interaktywne switche
          + isSubscribed  Przycisk "Wyłącz" w nagłówku kolumny
```

> **Ważne:** Gdy użytkownik raz zablokuje (`denied`), przeglądarka **nie pozwoli** na ponowne pokazanie dialogu. Użytkownik musi ręcznie wejść w Ustawienia → Prywatność → Powiadomienia i odblokować stronę.

---

## 8. Automatyczna dezaktywacja wygasłych subskrypcji

Subskrypcja push może wygasnąć gdy:

- Użytkownik wyczyścił dane przeglądarki
- Przeglądarka odwołała subskrypcję
- Upłynął czas ważności

Backend obsługuje to automatycznie w `_send_vapid_batch()`:

```
HTTP 404 lub 410 od usługi push
→ PushDevice.is_active = False
→ Kolejne próby wysyłki do tego urządzenia są pomijane
→ Przy następnym logowaniu użytkownika, hook re-subskrybuje (jeśli permission = "granted")
```

A device is also deactivated when it has no VAPID keys, and after five refusals in a row — see **Device health** in §12.

---

## 9. Pliki systemu — mapa

```
backend/
  notifications/
    models.py                ← PushDevice (registration_token=endpoint, p256dh_key, auth_key)
    push_service.py          ← PushDispatcherService: VAPID + FCM dispatch
    dtos.py                  ← WebPushSubscribeDTO
    serializers.py           ← WebPushSubscribeSerializer
    views.py                 ← PushDeviceViewSet (auto-detect web vs mobile)
    migrations/
      0006_pushdevice_web_push_fields.py

frontend/
  public/
    sw.js                    ← Service Worker (push event → showNotification)
  src/features/notifications/
    hooks/
      usePushNotifications.ts  ← permission + subscribe + backend sync
  src/features/settings/
    components/
      NotificationsTab.tsx   ← UI z permission gate

.env (backend)
  VAPID_PRIVATE_KEY = <klucz prywatny>
  VAPID_PUBLIC_KEY  = <klucz publiczny>

.env (frontend)
  VITE_VAPID_PUBLIC_KEY = <ten sam klucz publiczny>
```

---

## 10. Dlaczego NIE używamy Firebase?

VAPID jest jedynym transportem, jaki system ma — po obu stronach. Panel jest PWA,
więc każde urządzenie zdolne utrzymać subskrypcję jest przeglądarką, a Google
występuje tu wyłącznie jako usługa push przeglądarki (odrębny administrator
widzący endpoint i metadane), nie jako nasz podprocesor. Gdyby kiedyś powstał
klient natywny, przyszedłby z własnym SDK i własnym wpisem w rejestrze
podprocesorów — i dopiero wtedy ten wpis miałby prawo istnieć.

Inne podejście (FCM Web SDK) wymaga:

- Pełnej konfiguracji Firebase w JS (`apiKey`, `projectId`, `messagingSenderId`, `appId`)
- Zależności `firebase` (100+ KB)
- Firebase-specific service workera

Nasze podejście (czyste VAPID):

- Tylko jeden klucz publiczny w `.env`
- Zero dodatkowych zależności na frontendzie
- Standard W3C — działa w Chrome, Firefox, Edge, Safari (macOS 13+)
- Ten sam backend (`pywebpush`) działa dla wszystkich przeglądarek
- Łatwa migracja do natywnej aplikacji — ta sama para kluczy VAPID

---

## 11. Migracja do aplikacji natywnej (przyszłość)

Gdy aplikacja trafi na iOS/Android (np. Capacitor):

- `device_type = "IOS"` lub `"ANDROID"` → backend używa FCM (już zaimplementowane)
- `device_type = "WEB"` → backend używa VAPID (już zaimplementowane)
- `usePushNotifications` hook można rozszerzyć o detekcję środowiska Capacitor

Backend już obsługuje oba kanały — nie wymaga zmian.

---

## 12. Reach: e-mail fallback, device count, adoption offers

**Push is account-wide, permission is per browser.** A push goes to every active
`PushDevice` the member owns. The OS permission behind each subscription can only
be granted by a tap in that browser, on that device — no server call, and no grant
on another device, can switch it on. The per-type preferences (`push_enabled`) are
account-level and default ON; the device step is the only thing left to the member.

**E-mail fallback.** `NotificationRouter` attaches an `EmailFallback` to the push
task for push-first types: push ON, e-mail OFF, and e-mail OFF by default
(`_needs_email_reserve`). `send_push_notification_task` sends that e-mail only when
the push reached **zero** devices — no device registered, or every endpoint
refused — or on the last attempt of a push whose transport kept raising. One
working phone is enough to suppress it. A type whose e-mail is ON by default and
reads OFF was switched off by the member and never falls back. Two push-first
cases carry no reserve: `MATERIAL_UPLOADED` (see **Material notices** — still one
e-mail per piece, and a season's preparation touches many pieces), and routine
(INFO) manager reports, whose e-mail is the daily digest. The master e-mail
switch and the undeliverable flag are honoured by the e-mail dispatcher as usual.

**Device health.** `is_active` is what the device count, `has_push` and the
fallback read, so it has to mean "push reaches this". Each send writes back to
its devices in bulk (`_send_vapid_batch`): an accepted push stamps
`last_delivered_at` and clears `consecutive_failures`; any other HTTP refusal
adds one, as does an error raised before any answer (a key the encryption step
cannot use), and the fifth in a row deactivates the device. No per-device error
escapes the loop, so a retry never re-sends to devices already reached. 404/410 and a device
without VAPID keys are deactivated at once. A network error (`requests`
exception) is not a refusal — no answer came back, so nothing is learned about
the subscription — and neither counts nor resets. When nothing was delivered and
a network error was among the failures, `PushTransportUnavailable` makes the
task retry; that is safe only because nothing went out. With one device reached
it never raises, so a retry cannot push the same notice twice. The test push
answers such an outage as `undeliverable`. Re-subscribing clears the count.

**Material notices.** Every uploaded track and every approved edition fires
`piece_material_updated_event`. `roster/listeners.py` folds them into one notice
per piece: the first event opens a window (`cache.add` on the gate key) and
schedules `roster.dispatch_material_notice` for its end
(`MATERIAL_NOTICE_WINDOW_SECONDS`, default 600); every event records its kind
under a separate key. The task reopens the gate, resolves the participants at
send time and names the kind only when every event agreed (`None` otherwise). Only
`cache.add` creates the gate: a `set` racing the task's delete would leave a gate
with no task behind it and silence the piece until it expired.

**Device count.** `GET /api/notifications/devices/` returns `{"active_devices": n}`
for the caller — a count, never endpoints. The settings tab uses it to say that
e-mail is standing in (n = 0); a browser without a subscription uses it to say
"you already have this elsewhere". Managers see the same fact per member as
`has_push` on the roster (`ArtistDetailedSerializer`).

While n = 0 and e-mail is not muted (the master switch), the settings tab shows
the push column in every browser — also one
that cannot push, such as an iPhone in Safari — editable and captioned "na razie
mailem". Per-type push is account-level, and with no device it is also the
reserve e-mail's switch: push OFF on a type means neither push nor the e-mail.

**Adoption offers (frontend).** `requestPushNudge(moment)` raises a one-tap offer
from the moment push would help (absence request, attendance confirmation,
accepting an invitation outside the Welcome Moment). `usePushNudgeHost` in the
panel shell renders it only when push is possible here, not on (read live from the
browser at the moment, not from the shell's controller), not blocked, no offer has
been shown yet in this page session, and the per-device pacing allows: 14 days
after any offer that ended unanswered, and none after three refusals. Only the
close button and a swipe are refusals; a timeout starts the cooldown without
counting, since the offer may never have been read. Apple devices in a browser tab get
the Home Screen route instead, unless another device already takes the push.
`PushInboxRow` at the top of the notification centre states the device's push
state permanently, without pacing. Enabling from either place fires a test push.
