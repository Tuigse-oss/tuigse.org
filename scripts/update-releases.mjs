#!/usr/bin/env node
// Refresh the release details in site/index.html from GitHub.
//
// The page marks three kinds of region, each naming a repository:
//   <!-- version OWNER/REPO --> ... <!-- /version -->
//       "0.1.6, released November 16, 2026" or "Not released yet"
//   <!-- download OWNER/REPO --> ... <!-- /download -->
//       direct links to the installer and portable zip, with sizes, and
//       the unsigned-build note (or how to build from source)
//   <!-- verify OWNER/REPO --> ... <!-- /verify -->
//       Get-FileHash and gh attestation commands for the main download
//
// Usage: node scripts/update-releases.mjs [path/to/index.html]
// Set GITHUB_TOKEN to raise the API rate limit (CI does this).
// If GitHub can't be reached, the regions are left as they are, so a
// deploy still goes out with the last known details.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const file = process.argv[2] ?? fileURLToPath(new URL("../site/index.html", import.meta.url));

const headers = { Accept: "application/vnd.github+json", "User-Agent": "tuigse-site-build" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const cache = new Map();
function latestRelease(repo) {
  if (!cache.has(repo)) {
    cache.set(repo, (async () => {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
      if (res.status === 404) return null; // no published release yet
      if (!res.ok) throw new Error(`${repo}: GitHub answered ${res.status}`);
      return res.json();
    })());
  }
  return cache.get(repo);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

// 64-bit Windows downloads; 32-bit builds stay on the release page.
function windowsAssets(rel) {
  const assets = rel?.assets ?? [];
  return {
    installer: assets.find((a) => /-x86_64-setup\.exe$/i.test(a.name)),
    zip: assets.find((a) => /-x86_64-windows\.zip$/i.test(a.name)),
  };
}

const render = {
  version(repo, rel) {
    if (!rel) return "Not released yet";
    return `${esc(rel.tag_name.replace(/^v/i, ""))}, released ${dateFmt.format(new Date(rel.published_at))}`;
  },

  download(repo, rel, indent) {
    const i = indent;
    if (!rel) {
      return `${i}<p class="note">No release yet. <a href="https://github.com/${repo}#readme">Build it from source</a> with a current Rust toolchain.</p>`;
    }
    const { installer, zip } = windowsAssets(rel);
    const lines = [];
    if (installer || zip) {
      lines.push(`${i}<p class="downloads">`);
      if (installer) lines.push(`${i}  <a class="button" href="${esc(installer.browser_download_url)}">Download installer <span class="size">(${mb(installer.size)})</span></a>`);
      if (zip) {
        const cls = installer ? "button button-quiet" : "button";
        const label = installer ? "Portable zip" : "Download portable zip";
        lines.push(`${i}  <a class="${cls}" href="${esc(zip.browser_download_url)}">${label} <span class="size">(${mb(zip.size)})</span></a>`);
      }
      lines.push(`${i}</p>`);
      lines.push(`${i}<p class="note">Not code-signed yet, so Windows may show a SmartScreen warning. <a href="#verify">Check the file before you run it</a>.</p>`);
    }
    lines.push(`${i}<p class="note"><a href="${esc(rel.html_url)}">Release notes and all files</a></p>`);
    return lines.join("\n");
  },

  verify(repo, rel, indent) {
    const { installer, zip } = windowsAssets(rel);
    const asset = installer ?? zip;
    if (!asset) return null; // keep whatever is there
    return `${indent}<pre class="code"><code>Get-FileHash .\\${esc(asset.name)}
gh attestation verify ${esc(asset.name)} --repo ${esc(repo)}</code></pre>`;
  },
};

// Block regions sit on their own lines; inline ones (version) share a line.
const region = /<!-- (version|download|verify) ([\w.-]+\/[\w.-]+) -->([\s\S]*?)<!-- \/\1 -->/g;

let html = await readFile(file, "utf8");
const jobs = [...html.matchAll(region)].map((m) => ({ whole: m[0], kind: m[1], repo: m[2], body: m[3] }));

let changed = 0;
let failed = 0;
for (const job of jobs) {
  let rel;
  try {
    rel = await latestRelease(job.repo);
  } catch (err) {
    console.warn(`warning: ${err.message}; keeping the current ${job.kind} details for ${job.repo}`);
    failed++;
    continue;
  }
  const block = job.body.startsWith("\n");
  let next;
  if (block) {
    // Look the region up in the current text: earlier replacements shift
    // everything after them.
    const at = html.indexOf(job.whole);
    const lineStart = html.lastIndexOf("\n", at) + 1;
    const indent = html.slice(lineStart, at);
    const body = render[job.kind](job.repo, rel, indent);
    if (body == null) continue;
    next = `<!-- ${job.kind} ${job.repo} -->\n${body}\n${indent}<!-- /${job.kind} -->`;
  } else {
    const body = render[job.kind](job.repo, rel, "");
    if (body == null) continue;
    next = `<!-- ${job.kind} ${job.repo} -->${body}<!-- /${job.kind} -->`;
  }
  if (next !== job.whole) {
    html = html.replace(job.whole, () => next);
    changed++;
  }
  console.log(`${job.kind} ${job.repo}: ${rel ? rel.tag_name : "no release"}`);
}

if (changed) await writeFile(file, html);
console.log(`${jobs.length} regions, ${changed} updated${failed ? `, ${failed} left as they were` : ""}.`);
