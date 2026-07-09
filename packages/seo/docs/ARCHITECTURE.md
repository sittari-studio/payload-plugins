# Technical architecture

## Boundaries

The plugin is a Payload configuration transformer plus a pure resolution
library. It may add fields, a Global, a Collection, hooks, and admin
components, but it must not depend on a particular frontend framework for its
core behavior.

The host application owns:

- Payload initialization and database adapter;
- collection definitions and localization configuration;
- authentication and access functions;
- document URL policy;
- public route registration and HTTP response headers;
- deployment-specific sitemap and robots URLs.

## Components

| Component | Responsibility |
| --- | --- |
| Plugin transformer | Validates plugin configuration, augments enabled collections, appends the Global and redirects collection, and preserves all existing config. |
| Field factories | Produce the generated SEO group, conditional subfields, validation, and marker metadata. |
| Global factory | Produces the site SEO and robots configuration Global. |
| Redirect factory | Produces the exact-path redirects collection with indexes, validation, and access. |
| Resolver core | Loads documents/settings without locale fallback and turns persisted values into a normalized SEO result. |
| Helper adapters | Return metadata objects, schema JSON-LD, redirects, robots text, sitemap XML, and sitemap index XML. |
| Admin components | Render previews and schema reset behavior using the same resolver rules where possible. |
| Validators | Normalize and validate URLs, JSON, paths, redirect graphs, and configuration. |

## Recommended source layout

This is the intended layout for the existing ESM-only package. Each module
should use explicit TypeScript types and .js import specifiers, matching the
repository convention.

~~~text
src/
  admin/
    previews/
    schema/
  collections/
    redirects.ts
  fields/
    seo.ts
  globals/
    seo-settings.ts
  helpers/
    metadata.ts
    next.ts
    redirects.ts
    robots.ts
    schema.ts
    sitemap.ts
  resolvers/
    document.ts
    metadata.ts
  utils/
    locale.ts
    urls.ts
    validation.ts
  plugin.ts
  types.ts
  index.ts
  exports/types.ts
~~~

The layout is a guide, not a requirement to create empty modules in advance.

## Configuration transformation

The plugin must:

1. Return the incoming config unchanged when enabled is false.
2. Validate the plugin configuration before altering the config.
3. Find each selected collection by slug and fail with a descriptive startup
   error if it is absent.
4. Append exactly one generated SEO group to each selected collection.
5. Append exactly one generated SEO settings Global and redirects collection.
6. Preserve existing collection fields, hooks, admin configuration, globals,
   collections, and access controls by spreading and composing them.
7. Mark generated entities through admin custom metadata so reapplying the
   plugin neither duplicates nor mistakes user fields for plugin fields.
8. Fail fast on slug and field-name collisions; never silently overwrite a
   user-defined field, global, or collection.

Use the shared appendCollections and appendGlobals helpers when their current
semantics suffice. If hooks are added, append to the existing hook arrays rather
than replacing them.

## Resolution flow

~~~text
Payload document + active locale
  -> load only that locale, with fallbackLocale false
  -> resolve document SEO and configured document-field mappings
  -> load global settings in the same locale when localized
  -> resolve URL and canonical
  -> resolve social values and robots
  -> generate or replace schema
  -> return normalized framework-neutral result
  -> optional Next.js / XML / JSON-LD adapter
~~~

The resolver core must not make a frontend decision such as setting response
headers or registering a route. Adapters must be thin projections of the same
normalized result; they must not reimplement fallback logic.

## Payload-specific implementation rules

- Pass locale explicitly and set fallbackLocale to false for every helper query.
- Public helpers read published documents only unless the caller explicitly opts
  into a documented draft preview mode.
- When a Local API call operates on behalf of a user, pass that user and set
  overrideAccess to false. Trusted system helpers may use default server access.
- Preserve transaction scope by passing req to nested Local API operations
  performed in hooks.
- Keep field-level computations at field level. Do not mutate the whole
  document from a collection afterRead hook.
- Give generated redirects source fields a database-backed uniqueness guarantee
  as well as application validation.

## Failure policy

Configuration errors fail application startup. Editor-entered invalid values
fail field validation. Runtime resolution errors are non-fatal to the host
route: log enough context for diagnosis, omit the affected result, and retain
unrelated valid output.

