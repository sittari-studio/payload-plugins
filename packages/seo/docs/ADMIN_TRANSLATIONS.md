# Admin translations

The plugin's generated Payload Admin UI supports English (`en`), Russian
(`ru`), and Ukrainian (`uk`). It reads Payload's active Admin interface
language; there is no separate SEO-plugin language setting.

The plugin provides its own labels, descriptions, option labels, validation
messages, preview text, and button text in those languages. If Payload's active
Admin language is not supported, plugin-owned UI falls back to English.

Translations affect only presentation. The stored field paths and select values
remain stable, including:

- canonical modes: `auto`, `manual`, `none`
- robots values: `index`, `noindex`, `follow`, `nofollow`
- X/Twitter cards: `summary`, `summary_large_image`
- schema types: `WebPage`, `Article`, `Product`, `Organization`,
  `LocalBusiness`, `FAQPage`

Keep these stored values in integrations, migrations, APIs, and tests instead
of relying on the translated labels. Host application field labels and
descriptions remain owned by the host application.
