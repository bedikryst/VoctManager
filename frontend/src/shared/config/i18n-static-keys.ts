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
