# tuigse.org

The Tuigse LLC website: OpenCB Radio and the open-source apps in
[Tuigse-oss](https://github.com/Tuigse-oss).

It is a single static page with no JavaScript and no third-party requests.
The fonts (Alegreya and Alegreya Sans, SIL Open Font License) are served
from the site itself.

```
site/                 everything that is published
  index.html
  styles.css
  favicon.png
  assets/img/         emblem and app screenshots
  assets/fonts/       woff2 files and their OFL licenses
scripts/
  update-releases.mjs fills in each app's latest version from GitHub
.github/workflows/
  pages.yml           deploys site/ to GitHub Pages
```

## Preview

```bash
python3 -m http.server -d site 8000
```

Then open http://localhost:8000.

## App versions

`index.html` marks the parts that come from GitHub releases, each naming a
repository:

| Marker | What the script writes |
| --- | --- |
| `<!-- version OWNER/REPO -->…<!-- /version -->` | "0.1.6, released November 16, 2026", or "Not released yet" |
| `<!-- download OWNER/REPO -->…<!-- /download -->` | direct links to the 64-bit installer and portable zip with their sizes, the unsigned-build note, and the release page; or "No release yet" with a build-from-source link |
| `<!-- verify OWNER/REPO -->…<!-- /verify -->` | `Get-FileHash` and `gh attestation verify` for the installer, or the zip if there is no installer |

`node scripts/update-releases.mjs` rewrites those regions from each repo's
latest release. When a repo publishes its first release, its Download
buttons appear on the next run. If GitHub can't be reached, the page keeps
what it has.

The deploy workflow runs the script before every deploy and once a day. To
refresh straight after an app release:

```bash
gh api repos/Tuigse-oss/tuigse.org/dispatches -f event_type=app-released
```

## Adding an app

Copy one of the `<article class="app">` blocks in `site/index.html`, change
the repo name in its markers, add a `verify` block for it in the
"Check a download" section, add it to the product index near the top, put a
screenshot in `site/assets/img/`, and run the script.

## Deploying

Pushing to `main` deploys to GitHub Pages. The custom domain is set in the
repository's Pages settings, not with a `CNAME` file, because the site is
published by a workflow.

DNS for tuigse.org (Cloudflare, DNS only):

| Type | Name | Value |
| --- | --- | --- |
| A | `tuigse.org` | `185.199.108.153` |
| A | `tuigse.org` | `185.199.109.153` |
| A | `tuigse.org` | `185.199.110.153` |
| A | `tuigse.org` | `185.199.111.153` |
| AAAA | `tuigse.org` | `2606:50c0:8000::153` |
| AAAA | `tuigse.org` | `2606:50c0:8001::153` |
| AAAA | `tuigse.org` | `2606:50c0:8002::153` |
| AAAA | `tuigse.org` | `2606:50c0:8003::153` |
| CNAME | `www` | `tuigse-oss.github.io` |
