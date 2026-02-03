/*
  Vaultfire doc sweep
  - Adds a non-normative banner to historical/audit/deprecated docs.
  - Softens absolute guarantee language in a small set of high-risk phrases.

  Usage:
    node tools/doc_sweep.js
*/

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p, out);
    } else if (ent.isFile()) {
      out.push(p);
    }
  }
  return out;
}

const banner =
  "<!--\n" +
  "NON-NORMATIVE DOCUMENT\n\n" +
  "This file is historical/legacy/audit material and may contain aspirational language.\n" +
  "The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md\n" +
  "-->\n\n";

const shouldBanner = (rel) => {
  const norm = rel.replace(/\\/g, '/');
  if (norm.startsWith('docs/deprecated/')) return true;
  if (norm.startsWith('docs/deprecated/enterprise/')) return true;
  if (norm.startsWith('docs/deprecated/runbooks/')) return true;
  if (norm.startsWith('docs/deprecated/vaultfire_pilot_bundle/')) return true;

  // Root-level audit / report dumps (keep, but mark non-normative)
  const base = path.basename(norm);
  const upper = base.toUpperCase();
  if (upper.includes('AUDIT') || upper.includes('READINESS') || upper.includes('PROFESSIONAL') || upper.includes('COMPREHENSIVE') || upper.includes('ULTIMATE')) {
    // Exclude the new normative claims doc
    if (norm === 'docs/CLAIMS_AND_LIMITS.md') return false;
    return true;
  }
  // Marketing/pitch materials that often contain absolutes
  if (norm.startsWith('partnerships/')) return true;
  if (norm.startsWith('pilot-kit/')) return true;
  if (norm.startsWith('vaultfire-partner-docs/')) return true;
  return false;
};

const replacements = [
  // Deletion absolutism
  {
    from: /supports right to be forgotten\b/gi,
    to: 'supports deletion requests (see on-chain immutability limits)'
  },
  {
    from: /users can delete their data anytime\b/gi,
    to: 'users can request deletion; future writes should stop and off-chain systems should delete/redact (on-chain history is immutable)'
  },
  {
    from: /Right to be Forgotten: Users can delete their data anytime\b/gi,
    to: 'Right to be Forgotten: Users can request deletion (stop future writes + off-chain deletion/redaction; on-chain history is immutable)'
  },
  // Over-absolute privacy
  {
    from: /ZK proofs mean we CAN'T see your data\b/g,
    to: 'ZK proofs + client-side processing are designed so we don’t need to see your raw data'
  },
  {
    from: /100% private\b/gi,
    to: 'privacy-preserving by design'
  },
  // Uptime guarantees in docs (convert to target)
  {
    from: /99\.9% uptime guarantee\b/gi,
    to: '99.9% uptime target (SLA subject to deployment + contract terms)'
  },
];

function applyReplacements(text) {
  let changed = false;
  let out = text;
  for (const r of replacements) {
    const next = out.replace(r.from, r.to);
    if (next !== out) changed = true;
    out = next;
  }
  return { out, changed };
}

function hasBanner(text) {
  return text.startsWith('<!--\nNON-NORMATIVE DOCUMENT');
}

function main() {
  const files = walk(repoRoot).filter((p) => p.toLowerCase().endsWith('.md'));
  let touched = 0;
  let bannered = 0;
  let rewritten = 0;

  for (const abs of files) {
    const rel = path.relative(repoRoot, abs);
    if (rel.replace(/\\/g, '/') === 'docs/CLAIMS_AND_LIMITS.md') continue;

    const raw = fs.readFileSync(abs, 'utf8');

    let next = raw;
    let changed = false;

    // Add banners where appropriate
    if (shouldBanner(rel) && !hasBanner(next)) {
      next = banner + next;
      changed = true;
      bannered++;
    }

    // Apply replacements everywhere except node_modules already excluded
    const rep = applyReplacements(next);
    if (rep.changed) {
      next = rep.out;
      changed = true;
      rewritten++;
    }

    if (changed) {
      fs.writeFileSync(abs, next, 'utf8');
      touched++;
    }
  }

  console.log(
    JSON.stringify(
      {
        touched,
        bannered,
        rewritten,
        scanned: files.length,
      },
      null,
      2
    )
  );
}

main();
