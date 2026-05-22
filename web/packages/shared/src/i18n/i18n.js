// i18n.js - i18next 配置文件
// 这是前端国际化的基础配置文件

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译文件
import enCommon from './en/common.json';
import zhCommon from './zh/common.json';

const resources = {
  en: {
    translation: enCommon
  },
  zh: {
    translation: zhCommon
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['queryString', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage', 'cookie'],
    }
  });

export default i18n;
