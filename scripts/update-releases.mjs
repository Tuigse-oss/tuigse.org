#!/usr/bin/env node
// Refresh the release details in site/index.html from GitHub.
//
// The page marks two kinds of region:
//   <!-- release OWNER/REPO --> ... <!-- /release -->
//       version line and Download button (or a "no release yet" line)
//   <!-- verify OWNER/REPO --> ... <!-- /verify -->
//       the Get-FileHash / gh attestation commands for the latest installer
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
async function latestRelease(repo) {
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

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

function versionOf(rel) {
  return rel.tag_name.replace(/^v/i, "");
}

function pickInstaller(rel) {
  const names = (rel.assets ?? []).map((a) => a.name);
  return names.find((n) => /-x86_64-setup\.exe$/i.test(n))
      ?? names.find((n) => /-x86_64-windows\.zip$/i.test(n))
      ?? names.find((n) => /\.(exe|zip|msi)$/i.test(n));
}

function releaseBlock(repo, rel, indent) {
  if (!rel) {
    return `${indent}<p class="release">No release yet. You can build it from source today.</p>`;
  }
  const when = dateFmt.format(new Date(rel.published_at));
  const hasWindows = Boolean(pickInstaller(rel));
  const lines = [`${indent}<p class="release">Version ${esc(versionOf(rel))}, released ${when}</p>`];
  if (hasWindows) {
    lines.push(`${indent}<a class="button" href="https://github.com/${repo}/releases/latest">Download for Windows</a>`);
  } else {
    lines.push(`${indent}<a class="button" href="https://github.com/${repo}/releases/latest">Release notes</a>`);
  }
  return lines.join("\n");
}

function verifyBlock(repo, rel, indent) {
  const asset = rel && pickInstaller(rel);
  if (!asset) return null; // keep whatever is there
  return `${indent}<pre class="code"><code>Get-FileHash .\\${esc(asset)}
gh attestation verify ${esc(asset)} --repo ${esc(repo)}</code></pre>`;
}

const region = /(^[ \t]*)<!-- (release|verify) ([\w.-]+\/[\w.-]+) -->\n[\s\S]*?\n[ \t]*<!-- \/\2 -->/gm;

let html = await readFile(file, "utf8");
const jobs = [];
html.replace(region, (whole, indent, kind, repo) => {
  jobs.push({ whole, indent, kind, repo });
  return whole;
});

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
  const body = job.kind === "release"
    ? releaseBlock(job.repo, rel, job.indent)
    : verifyBlock(job.repo, rel, job.indent);
  if (body == null) continue;
  const next = `${job.indent}<!-- ${job.kind} ${job.repo} -->\n${body}\n${job.indent}<!-- /${job.kind} -->`;
  if (next !== job.whole) {
    html = html.replace(job.whole, () => next);
    changed++;
  }
  console.log(`${job.kind} ${job.repo}: ${rel ? rel.tag_name : "no release"}`);
}

if (changed) await writeFile(file, html);
console.log(`${jobs.length} regions, ${changed} updated${failed ? `, ${failed} left as they were` : ""}.`);
