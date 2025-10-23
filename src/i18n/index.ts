import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ui_pl from '../locales/pl/ui.json';
import ui_en from '../locales/en/ui.json';

const resources = {
  pl: {
    ui: ui_pl,
  },
  en: {
    ui: ui_en,
  }
};

const defaultLang = (localStorage.getItem('vm_lang') || navigator.language.split('-')[0] || 'pl') as 'pl' | 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLang,
    fallbackLng: 'pl',
    interpolation: { escapeValue: false },
    defaultNS: 'ui',
    ns: ['ui']
  });

export default i18n;
