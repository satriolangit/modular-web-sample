import { useLocaleStore, type Locale } from '../store/localeStore';

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  return { locale, setLocale };
}
