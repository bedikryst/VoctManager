/** @type {import('i18next-cli').I18nextToolkitConfig} */
export default {
  // PL jest źródłem prawdy (fallbackLng: "pl", inline defaulty t() są po polsku).
  // i18next-cli traktuje pierwszy locale jako język główny, więc PL musi być pierwszy.
  locales: ['pl', 'en', 'fr'],
  extract: {
    input: [
      'src/**/*.{js,jsx,ts,tsx}'
    ],
    output: 'src/shared/config/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    sort: true,
    // NIE kasuj kluczy nieznalezionych w kodzie: część "sierot" to żywe klucze
    // dynamiczne (np. archive.form.epochs.* trzymane jako labelKey w stałych i
    // rozwiązywane przez t(zmienna), których parser nie widzi). Cięcie martwych
    // sierot robimy osobno, chirurgicznie, po zaudytowaniu rodzin dynamicznych.
    removeUnusedKeys: false,
  }
};
