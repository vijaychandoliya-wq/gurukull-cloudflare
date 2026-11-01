import React from 'react';
import {GlobalOutlined} from '@ant-design/icons';
import {Select,Tooltip} from 'antd';
import {useLanguage} from '../i18n/LanguageProvider';
import {AVAILABLE_LOCALES} from '../i18n/registry';

export const LanguageSwitcher:React.FC<{compact?:boolean}>=({compact=false})=>{
  const {locale,setLocale,t}=useLanguage();
  return <Tooltip title={t('language')}>
    <Select
      aria-label={t('language')}
      className="gk-language-switcher"
      size={compact?'small':'middle'}
      value={locale}
      onChange={setLocale}
      suffixIcon={<GlobalOutlined/>}
      options={AVAILABLE_LOCALES.map(language=>({value:language.tag,label:<span lang={language.tag}>{language.nativeName}</span>}))}
    />
  </Tooltip>;
};
