# Access control and validation

## Access-control model

The plugin is conservative by default. Generated document SEO fields inherit
the effective parent document access model unless the developer provides an
SEO-specific override. The override must be additive only in the sense that it
cannot grant access to a document the user cannot read or update through the
parent collection.

| Resource | Default | Override |
| --- | --- | --- |
| Generated document SEO fields | Parent collection access | Per-collection SEO field read/update access. |
| SEO settings Global | Deny management. | Global read/update access. |
| Redirects collection | Deny management. | create, read, update, delete, and admin access. |

Settings and redirects deny management until the integrator supplies access
functions. This prevents a package from accidentally opening SEO configuration.

Access functions must use Payload's normal types. Field-level access is
boolean-only. Document-level row restrictions belong in the parent collection
access rules, not generated SEO field access.

Public helpers use trusted server-side access by default because they are
called by application routes after the application has chosen the request
boundary. A helper that receives a user and is intended to enforce that user's
permissions must pass overrideAccess false to every Local API call.

## Validation

| Input | Required validation | Invalid result |
| --- | --- | --- |
| Plugin `siteUrl` | Absolute HTTP/HTTPS origin. | Reject plugin initialization. |
| Manual canonical URL | Absolute HTTP/HTTPS URL in manual mode. | Reject save. |
| Generated canonical path | Valid site-relative path from resolver. | Omit output. |
| SEO image | Valid Payload upload relation from allowed collection. | Reject invalid relation or omit unresolved output. |
| Raw schema JSON | Valid JSON syntax when non-empty. | Reject save. |
| Schema type | Configured type or approved per-document override value. | Reject save. |
| Redirect source | Exact internal path after required normalization; unique. | Reject save and enforce unique index. |
| Internal redirect destination | Valid internal path after required normalization. | Reject save. |
| External redirect destination | Absolute HTTP/HTTPS URL. | Reject save. |
| Redirect status | Exactly 301 or 302. | Reject save. |
| Redirect graph | No direct or transitive loop across enabled internal redirects. | Reject save. |
| Sitemap page | Positive one-based integer. | Reject caller input or return empty XML by documented API policy. |
| Sitemap lastmod | Valid date from updatedAt or resolver. | Omit lastmod. |

For URL validation, trim whitespace, reject protocol-relative URLs, reject
unsafe schemes, and validate with the platform URL parser. Do not downgrade an
invalid absolute URL to a path.

Redirect paths trim surrounding whitespace, must start with one slash, and
cannot contain an origin, query string, or fragment. The remaining pathname is
preserved exactly: trailing slashes, percent encoding, duplicate slashes, and
case are significant.

## Redirect loop algorithm

On create/update of an enabled redirect with an internal destination:

1. Normalize source and internal destination using the agreed rule.
2. Starting at the candidate destination, follow enabled redirects by exact
   source.
3. Reject when traversal reaches the candidate source.
4. Stop successfully when no enabled redirect exists, an external destination
   is reached, or the chain ends.
5. Bound traversal by the number of enabled redirects and reject if another
   cycle is encountered, even if it does not include the candidate source.

The database unique index is the final duplicate guard. Validation should also
query for conflicts to produce a useful editor error before database failure.

## Runtime safety

- Treat all persisted data as untrusted when reading legacy records.
- Never insert raw JSON into HTML. Return a serializable object and document
  safe script serialization for the host application.
- XML-escape sitemap URLs and lastmod strings.
- Do not expose private upload URLs as public metadata; omit inaccessible or
  unresolved images.
- Log resolver failures with collection, document identifier, locale, and
  helper name, without logging secrets or whole documents.
