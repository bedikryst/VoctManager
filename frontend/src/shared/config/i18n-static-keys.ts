import { t } from "i18next";

/**
 * @file i18n-static-keys.ts
 * @description Dummy file to prevent i18next-cli from dropping dynamic keys.
 * These keys are evaluated dynamically in the app, so the parser cannot see them.
 * We list them here as static t() calls so they are preserved in translation.json.
 */

export const STATIC_ROLES = [
  t("dashboard.layout.roles.SOP", "Sopran"),
  t("dashboard.layout.roles.ALT", "Alt"),
  t("dashboard.layout.roles.TEN", "Tenor"),
  t("dashboard.layout.roles.BAS", "Bas"),
  t("dashboard.layout.roles.CT", "Kontratenor"),
  t("dashboard.layout.roles.MEZ", "Mezzosopran"),
  t("dashboard.layout.roles.BAR", "Baryton"),
  t("dashboard.layout.roles.DIR", "Dyrygent"),
  t("dashboard.layout.roles.guest", "Gość"),
];

export const STATIC_SPECIALTIES = [
  t("crew.specialties.INSTRUMENT", "Instrumenty"),
  t("crew.specialties.LIGHT", "Światło"),
  t("crew.specialties.LOGISTICS", "Logistyka"),
  t("crew.specialties.OTHER", "Inne"),
  t("crew.specialties.SOUND", "Dźwięk"),
  t("crew.specialties.VISUALS", "Wizualizacje"),
  t("dashboard.layout.specialties.INSTRUMENT", "Instrumenty"),
  t("dashboard.layout.specialties.LIGHT", "Światło"),
  t("dashboard.layout.specialties.LOGISTICS", "Logistyka"),
  t("dashboard.layout.specialties.OTHER", "Inne"),
  t("dashboard.layout.specialties.SOUND", "Dźwięk"),
  t("dashboard.layout.specialties.VISUALS", "Wizualizacje"),
];

export const STATIC_SPECIALTY_DESCRIPTIONS = [
  t("dashboard.layout.specialty_descriptions.INSTRUMENT", "Instrumentaliści zewnętrzni i obsługa instrumentów."),
  t("dashboard.layout.specialty_descriptions.LIGHT", "Reżyseria świateł, oprawa wizualna sceny."),
  t("dashboard.layout.specialty_descriptions.LOGISTICS", "Transport, scena, zabezpieczenie produkcji."),
  t("dashboard.layout.specialty_descriptions.OTHER", "Współpracownicy spoza standardowych kategorii."),
  t("dashboard.layout.specialty_descriptions.SOUND", "Realizacja dźwięku, miks i nagłośnienie sceniczne."),
  t("dashboard.layout.specialty_descriptions.VISUALS", "Multimedia, projekcje, materiał ekranowy."),
];

export const STATIC_VOICE_TYPES = [
  t("voice_types.SOP", "Sopran"),
  t("voice_types.ALT", "Alt"),
  t("voice_types.TEN", "Tenor"),
  t("voice_types.BAS", "Bas"),
  t("voice_types.CT", "Kontratenor"),
  t("voice_types.MEZ", "Mezzosopran"),
  t("voice_types.BAR", "Baryton"),
];

export const STATIC_NOTIFICATION_TYPES = [
  t("settings.notifications.types.PROJECT_INVITATION", "Zaproszenie do projektu"),
  t("settings.notifications.types.PROJECT_UPDATED", "Aktualizacja szczegółów projektu"),
  t("settings.notifications.types.PROJECT_CANCELLED", "Projekt odwołany"),
  t("settings.notifications.types.PROJECT_REMINDER", "Przypomnienie o projekcie"),
  t("settings.notifications.types.REHEARSAL_SCHEDULED", "Nowa próba"),
  t("settings.notifications.types.REHEARSAL_UPDATED", "Zmiana czasu/miejsca próby"),
  t("settings.notifications.types.REHEARSAL_CANCELLED", "Próba odwołana"),
  t("settings.notifications.types.REHEARSAL_REMINDER", "Przypomnienie o próbie"),
  t("settings.notifications.types.PIECE_CASTING_ASSIGNED", "Przypisanie do utworu"),
  t("settings.notifications.types.PIECE_CASTING_UPDATED", "Zmiana obsady utworu"),
  t("settings.notifications.types.MATERIAL_UPLOADED", "Nowe materiały do ćwiczeń"),
  t("settings.notifications.types.CONTRACT_ISSUED", "Umowa gotowa do wglądu"),
  t("settings.notifications.types.ABSENCE_REQUESTED", "Prośba o nieobecność"),
  t("settings.notifications.types.ABSENCE_APPROVED", "Nieobecność zatwierdzona"),
  t("settings.notifications.types.ABSENCE_REJECTED", "Nieobecność odrzucona"),
  t("settings.notifications.types.SYSTEM_ALERT", "Komunikat systemowy"),
  t("settings.notifications.types.PARTICIPATION_RESPONSE", "Odpowiedź artysty"),
  t("settings.notifications.types.ATTENDANCE_SUBMITTED", "Informacja o frekwencji"),
  t("settings.notifications.types.CUSTOM_ADMIN_MESSAGE", "Bezpośrednia wiadomość"),
  t("settings.notifications.types.NOTIFICATION_READ_RECEIPT", "Wiadomość odczytana"),
];

// Re-add potentially dropped keys from pdf_viewer, contact_filters, etc.
export const STATIC_MISC = [
  t("pdf_viewer.jump_to_page", "Przejdź do strony"),
  t("pdf_viewer.open_full_view_short", "Pełny widok"),
  t("pdf_viewer.page_short", "Strona"),
  t("pdf_viewer.zoom_out", "Pomniejsz"),
  t("pdf_viewer.zoom_short", "Zoom"),
  t("contact_filters.no_phone", "Brak telefonu"),
  t("contact_filters.specialty_other", "Inne"),
  t("projects.editor.active_tab", "Aktywna zakładka"),
  t("projects.editor.fab.unsaved", "Niezapisane Zmiany"),
  t("projects.editor.fab.save", "Zapisz Zmiany"),
];
