import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from './resources/en/auth.json';
import enCommon from './resources/en/common.json';
import enErrors from './resources/en/errors.json';
import idAuth from './resources/id/auth.json';
import idCommon from './resources/id/common.json';
import idErrors from './resources/id/errors.json';

export function createI18nInstance(): I18nInstance {
  const instance = i18n.createInstance();

  void instance.use(initReactI18next).init({
    resources: {
      en: { common: enCommon, auth: enAuth, errors: enErrors },
      id: { common: idCommon, auth: idAuth, errors: idErrors },
    },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'errors'],
    interpolation: {
      escapeValue: false,
    },
  });

  return instance;
}
