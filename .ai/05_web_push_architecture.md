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
FIREBASE_VAPID_PUBLIC_KEY   → udostępniany przeglądarce (bezpieczny)
FIREBASE_VAPID_PRIVATE_KEY  → tylko na serwerze (tajny!)
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
   → rozdziela na WEB i mobile:

   WEB devices → _send_vapid_batch()
     → pywebpush.webpush(
         subscription_info = { endpoint, keys: { p256dh, auth } },
         data = JSON payload,
         vapid_private_key = FIREBASE_VAPID_PRIVATE_KEY,
         vapid_claims = { sub: "mailto:noreply@voct.pl" }
       )
     → Wysyłanie HTTP POST do endpoint URL (np. Google FCM)
     → Google/Mozilla/Apple dostarcza do przeglądarki użytkownika

   mobile devices → _send_fcm_batch() (Firebase Admin SDK)

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

| Pole | Opis |
|------|------|
| `title` | Nagłówek systemowego powiadomienia |
| `body` | Treść |
| `url` | Dokąd przejść po kliknięciu |
| `tag` | Grupowanie — nowe z tym samym tagiem zastępuje stare (nie spamuje) |
| `renotify` | `true` = pokaż dźwięk/wibrację nawet przy zastąpieniu |

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
  FIREBASE_VAPID_PRIVATE_KEY = <klucz prywatny>
  FIREBASE_VAPID_PUBLIC_KEY  = <klucz publiczny>

.env (frontend)
  VITE_FIREBASE_VAPID_PUBLIC_KEY = <ten sam klucz publiczny>
```

---

## 10. Dlaczego NIE używamy Firebase JS SDK na frontendzie?

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
