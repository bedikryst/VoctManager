// Dedykowany audyt hardkodów — uruchamiany OSOBNO przez `npm run lint:i18n`,
// NIE jest częścią `npm run lint` ani CI (zbyt hałaśliwy na bramkę).
// Flaguje tylko widoczny tekst między tagami JSX (mode: jsx-text-only) — pomija
// className/aria/data i inne atrybuty. Reszta trafień to zwykle false-positive,
// które należy ocenić ręcznie (marka VoctManager, nazwy języków w <option>,
// MusicBrainz/Wikidata, skróty typu esc/MB/{rate}x). UWAGA: nie łapie stringów
// trzymanych w tablicach/stałych JS (tylko literały w JSX) — te trzeba dojrzeć okiem.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  { ignores: ["dist", "*.tsbuildinfo", "node_modules"] },
  {
    files: ["src/**/*.{tsx,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    // react-hooks zarejestrowany tylko po to, by inline `eslint-disable`
    // odwołujące się do jego reguł nie wywalały "rule not found".
    plugins: { i18next, "react-hooks": reactHooks },
    rules: {
      "i18next/no-literal-string": ["warn", { mode: "jsx-text-only" }],
    },
  },
);
