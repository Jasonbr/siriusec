// LanguageSwitcher.jsx - 语言切换组件
// 在 Web UI 中使用此组件实现中英文切换

import React from 'react';
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('preferred-language', lng);
  };

  return (
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
      >
        <option value="zh">{t('settings.language.zh')}</option>
        <option value="en">{t('settings.language.en')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitcher;
