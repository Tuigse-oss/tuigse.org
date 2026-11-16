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

`index.html` marks the parts that come from GitHub releases:

```html
<!-- release Tuigse-oss/HiveMend -->
...version line and Download button...
<!-- /release -->
```

`node scripts/update-releases.mjs` rewrites those regions from each repo's
latest release. A repo with no release shows "No release yet" and no
Download button; when its first release is published, the button appears on
the next run. The `verify` region does the same for the checksum and
attestation commands. If GitHub can't be reached, the page keeps what it
has.

The deploy workflow runs the script before every deploy and once a day. To
refresh straight after an app release:

```bash
gh api repos/Tuigse-oss/tuigse.org/dispatches -f event_type=app-released
```

## Adding an app

Copy one of the `<article class="app">` blocks in `site/index.html`, change
the repo name in its `release` marker, put a screenshot in
`site/assets/img/`, and run the script.

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
