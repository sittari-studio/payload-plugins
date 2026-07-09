# Admin translations

## Scope

The next implementation milestone adds translations for the plugin-owned
Payload Admin interface. The initial supported languages are English (`en`),
Russian (`ru`), and Ukrainian (`uk`). This is interface localization, not a
change to the SEO data model or to frontend metadata output.

Payload content localization remains configured by the host application. SEO
fields continue to be localized according to that configuration, and every
resolver continues to use its explicit content locale with
`fallbackLocale: false`. An Admin language and a document content locale may
therefore differ; neither is inferred from the other.

## What must be translated

Every editor-visible string owned by this package must have an English,
Russian, and Ukrainian translation. This includes:

- generated field, group, tab, Global, and redirects-collection labels;
- select-option labels while preserving their persisted values;
- validation error messages shown to editors;
- preview headings, placeholder copy, empty states, buttons, descriptions,
  and accessibility labels in client components;
- schema visual-editor labels and explanatory copy.

Schema.org type identifiers, field names, collection slugs, stored enum
values, URLs, and generated metadata must not be translated. For example,
`auto`, `manual`, `none`, `index`, `noindex`, `summary`, and
`summary_large_image` remain stable stored values even when their labels are
translated.

## Language selection and fallback

The plugin must use Payload Admin's active interface language for all
plugin-owned UI. It must not add a second language selector or require a
per-plugin language setting. Server-produced field configuration and client
components must resolve the same translation keys.

English is the package fallback when the active Admin language is unsupported,
a translation key is missing. Implementations should first normalize a regional
code to its base language: `en-GB` resolves to `en`, `ru-RU` to `ru`, and
`uk-UA` to `uk`; only an unsupported normalized code falls back to English.
Missing translations must never render raw translation keys, `undefined`, or
mixed-language controls.

## Implementation contract

- Keep a single, typed translation catalog in the package; do not scatter
  translated literals across field factories and React components.
- Use stable translation keys and require all three locale catalogs to satisfy
  the same key set at build time.
- Route field labels, descriptions, option labels, and validation messages
  through the catalog when Payload evaluates generated configuration.
- Route client-component strings through the same catalog using Payload's
  active Admin language context.
- Preserve host-provided custom field labels and descriptions. The plugin only
  translates strings it owns.
- Keep all translation data free of application secrets and safe to include in
  Admin component configuration.

Translation support must be additive: it must not alter generated field paths,
stored documents, public helper input/output, SEO fallback rules, or the
plugin configuration API.

## Completion criteria

The milestone is complete when a Payload Admin session in each of `en`, `ru`,
and `uk` renders every plugin-owned UI string in that language, with the same
field paths and persisted values in all three languages. An unsupported
language, or one with no supported base code, must produce a complete English
interface; regional variants of supported languages must use their
base-language catalog. The translation matrix must be covered by automated
tests and a browser smoke test against a real Payload Admin application.
