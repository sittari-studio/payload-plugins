# Maintenance notes

## Compatibility and versioning

The package supports Payload CMS v3. Keep the Payload peer-dependency range
aligned with the APIs actually tested. Treat generated field paths, global and
collection slugs, helper result shapes, exported types, and XML/metadata
semantics as public API once released.

Use semantic versioning:

- Patch: bug fixes that preserve persisted data and helper semantics.
- Minor: backwards-compatible optional fields, helpers, or configuration.
- Major: renamed persisted fields, changed fallback behavior, route/helper
  behavior changes, or removed exports.

Any change to generated field names or settings/redirect slugs requires a
documented manual data migration or a separately designed migration tool. The
plugin must not rename stored fields implicitly.

## Repository conventions

- Keep the package ESM-only and use .js suffixes for local TypeScript imports.
- Keep source under packages/seo/src and tests under packages/seo/test.
- Build output remains dist with declarations generated from tsconfig.build.json.
- Update the root README package table if package capability changes materially.
- Use a changeset for published behavior changes.
- Run the workspace pnpm build, typecheck, and test commands before release.

If package documentation should ship on npm, add docs to the package files list
or provide links from README.md. This documentation request does not change
package publishing contents.

## Operational concerns

- Sitemap generation can inspect large collections. Configure sitemap.fields
  with only the URL and last-modified inputs, paginate at 25,000, and avoid
  loading relationships unless configuration requires them.
- Redirect source has a unique database index, which covers exact source lookup
  efficiently; enabled is included in the query to prevent disabled redirects
  from being returned.
- Cache decisions belong to the host route because cache lifetime and
  invalidation strategy are application-specific.
- The plugin should log resolution faults at a useful level but must not turn a
  malformed editor value into a site-wide route failure.

## Security review checklist

- Verify generated fields do not bypass parent document access.
- Review settings and redirect access in every host project.
- Confirm Local API calls with a user set overrideAccess to false.
- Ensure raw schema is safely serialized by the host.
- Ensure only public/resolvable media URLs become metadata.
- Reject unsafe URL schemes and XML-escape output.
- Test draft exclusion after every Payload upgrade.

## Documentation upkeep

When behavior changes, update the normative document first, implementation
second, tests third, and README last. Record the decision date and release
version in the relevant contract document. Keep non-goals current so features
such as wildcard redirects or SEO scoring are not accidentally added as
incidental work.
