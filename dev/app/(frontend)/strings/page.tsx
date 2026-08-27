import type { Metadata } from 'next';

import { getTranslations } from '@sittari/payload-strings';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

type SearchParams = Promise<{ locale?: string }>;

const resolveLocale = (requested?: string): 'en' | 'es' =>
  requested === 'es' ? 'es' : 'en';

export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> => {
  const locale = resolveLocale((await searchParams).locale);
  const payload = await getPayload({ config: configPromise });
  const t = await getTranslations({ payload, locale });

  return { title: t('auth.loginTitle') ?? 'Strings' };
};

const LocaleLink = ({
  active,
  label,
  code,
}: {
  active: boolean;
  code: string;
  label: string;
}) => (
  <a
    href={`/strings?locale=${code}`}
    style={active ? { fontWeight: 700 } : undefined}
  >
    {label}
  </a>
);

const StringsPage = async ({
  searchParams,
}: {
  searchParams: SearchParams;
}) => {
  const requested = (await searchParams).locale;
  const locale = resolveLocale(requested);
  const otherLocale = locale === 'en' ? 'es' : 'en';
  const payload = await getPayload({ config: configPromise });
  const t = await getTranslations({ payload, locale });

  // Explicit per-call locale lookup against the opposite locale.
  const other = t('general.cancelButton', otherLocale);

  return (
    <main>
      <h1>getTranslations fixture</h1>
      <p>
        <LocaleLink active={locale === 'en'} code="en" label="English" />
        {' | '}
        <LocaleLink active={locale === 'es'} code="es" label="Español" />
      </p>
      <h2>Locale: {locale}</h2>
      <ul>
        <li>
          general.cancelButton: <strong>{t('general.cancelButton')}</strong>
        </li>
        <li>
          general.saveButton: <strong>{t('general.saveButton')}</strong>
        </li>
        <li>
          auth.loginTitle: <strong>{t('auth.loginTitle')}</strong>
        </li>
        <li>
          auth.loginSubmit: <strong>{t('auth.loginSubmit')}</strong>
        </li>
      </ul>
      <p>
        Explicit <code>general.cancelButton</code> in {otherLocale}:{' '}
        <strong>{other}</strong>
      </p>
      <p>
        Unknown key returns <code>null</code>:{' '}
        <strong>
          {t('general.unknownKey') === null ? 'null' : 'unexpected'}
        </strong>
      </p>
    </main>
  );
};

export default StringsPage;
