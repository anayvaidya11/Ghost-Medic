/**
 * Reading-level check for the site's prose.
 *
 * The site is written for someone technical enough to smell exaggeration but
 * not an embedded engineer. That is a claim about the writing, and claims on
 * this project are supposed to be checkable, so this measures it instead.
 *
 * Reports Flesch-Kincaid grade level per page. Grade 12 is a US high-school
 * leaver; the target here is 10 or below, which leaves headroom for the
 * sentences that genuinely need a number in them.
 *
 * Verbatim artifacts are skipped, deliberately and permanently: <pre> holds
 * test output, model transcripts, code and the sensor block, and the house
 * style says those are never edited to fit the prose style. Scoring them would
 * push the numbers around for text nobody is allowed to touch.
 *
 *   node tools/prose/readability.mjs            check every page in site/
 *   node tools/prose/readability.mjs --verbose  also list the hardest sentences
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE = new URL('../../site/', import.meta.url).pathname;
const TARGET = 10.0;
const verbose = process.argv.includes('--verbose');

/**
 * Strips markup and everything that is not prose the reader is meant to read.
 *
 * Closing block tags become full stops first. Without that, a table's cells and
 * a list's items run together into one enormous "sentence" and the score is
 * meaningless: the first version of this script rated the real-vs-standing-in
 * table as a single grade-72 sentence.
 */
function proseOf(html) {
  return html
    .replace(/<(script|style|svg|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')   // same boilerplate on every page
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<\/(p|li|td|th|h[1-6]|figcaption|caption|div|section|blockquote)>/gi, '. ')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vowel-group heuristic. Not perfect, but consistent, which is what a
 *  before-and-after comparison actually needs. */
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function sentencesOf(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(“"']|\d)/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
}

function score(text) {
  const sentences = sentencesOf(text);
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (!sentences.length || !words.length) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const wps = words.length / sentences.length;
  const spw = syl / words.length;
  return {
    grade: 0.39 * wps + 11.8 * spw - 15.59,
    words: words.length,
    sentences: sentences.length,
    wps,
    list: sentences,
  };
}

const pages = readdirSync(SITE).filter((f) => f.endsWith('.html')).sort();
let worst = 0;
const rows = [];

for (const page of pages) {
  const s = score(proseOf(readFileSync(join(SITE, page), 'utf8')));
  if (!s) continue;
  worst = Math.max(worst, s.grade);
  rows.push({ page, ...s });
}

console.log(`Flesch-Kincaid grade level, target ${TARGET.toFixed(1)} or below\n`);
console.log('page                 grade   words  sentences  words/sentence');
for (const r of rows) {
  const flag = r.grade > TARGET ? '  OVER' : '';
  console.log(
    `${r.page.padEnd(20)} ${r.grade.toFixed(1).padStart(5)}  ${String(r.words).padStart(6)}` +
    `  ${String(r.sentences).padStart(9)}  ${r.wps.toFixed(1).padStart(14)}${flag}`);
}

if (verbose) {
  for (const r of rows) {
    // A minimum length matters here. Flesch-Kincaid is unreliable on fragments,
    // so without it the list fills up with link labels and email addresses
    // rather than the long sentences actually worth rewriting.
    const hard = r.list
      .map((t) => ({ t, g: score(t)?.grade ?? 0, n: t.split(/\s+/).length }))
      .filter((x) => x.n >= 14 && x.g > TARGET + 2)
      .sort((a, b) => b.g - a.g)
      .slice(0, 6);
    if (!hard.length) continue;
    console.log(`\n--- ${r.page}: hardest sentences ---`);
    for (const h of hard) console.log(`  [${h.g.toFixed(1)}] ${h.t}`);
  }
}

console.log(`\nworst page: ${worst.toFixed(1)}`);
process.exit(worst > TARGET ? 1 : 0);
