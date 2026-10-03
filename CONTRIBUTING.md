# Contributing to Pota

Thanks for helping. Bug reports, league requests and pull requests are all welcome.

## Reporting a problem

Open an [issue](https://github.com/Cafu1107/pota/issues) with:

- the page address (for example `/mac/bsl/346283`),
- what you expected and what you saw,
- a screenshot if it is a layout problem, and whether it happens in light or dark mode, Turkish or English.

## Working on the code

You need Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173, with the data proxy built in
npm test           # unit tests, no network needed
npm run test:live  # checks the real APIs still look the way the adapters expect
npm run typecheck
```

A few rules keep the project consistent:

- **One data model.** A new source gets its own adapter in `src/data/providers/` that returns the types in `src/data/types.ts`. Pages and components never call a source directly.
- **Proxy rules live in one place.** New upstream hosts and their cache times go in `server/upstreams.mjs`, which both the local proxy and the Cloudflare Worker use.
- **Both languages, always.** Every new UI string goes into `src/i18n/tr.ts` and `src/i18n/en.ts`.
- **Design tokens, not raw values.** Colors, radii and type sizes come from `src/styles/tokens.css`; see `DESIGN.md` for the rules (red means live and nothing else, team colors only where they pass the contrast check).
- **Check it in a browser** at phone and desktop widths, in both themes, before opening the pull request.

## License

By contributing you agree that your work is released under the [GPL-3.0-or-later](LICENSE) license.
