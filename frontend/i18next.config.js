/** @type {import('i18next-cli').I18nextToolkitConfig} */
export default {
  locales: ['en', 'pl', 'fr'],
  extract: {
    input: [
      'src/**/*.{js,jsx,ts,tsx}'
    ],
    output: 'src/shared/config/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    sort: true,
  }
};
