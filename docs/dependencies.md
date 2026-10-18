# Dependency maintenance

Install from the lockfile with `npm ci`. Review dependency changes alongside a
production build, the interaction tests, and the document and spreadsheet editors.

The overrides in `package.json` keep Sharp and the Nano ID and selector-parser
dependencies on patched versions. Keep the Nano ID major versions separate:
the spreadsheet uses version 5 and PostCSS uses version 3. Do not replace all
of them with whichever major is newest.

The document editor uses Tiptap 3. Its consolidated table, text-style and utility
packages replace the older extension wrappers. `setContent` must explicitly use
`{ emitUpdate: false }` when loading a saved page; otherwise loading can be
mistaken for a new edit. The toolbar listens to editor transactions directly.

Check current advisories with `npm audit --omit=dev`. On 18 October 2026 the
production dependency scan reported no advisories. The complete scan still flags
the `braces` dependency used by Tailwind 3's build tools. That compiler reads the
repository's trusted source and configuration, and is not part of request
handling. An eventual Tailwind major upgrade needs stylesheet compatibility
checks; do not apply `npm audit fix --force` to a release checkout.

Relevant maintainer notes:

- [Tiptap 3 migration](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [Tiptap attribute handling advisory](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-cp6q-959q-f8rh)
- [Next.js Windows server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
