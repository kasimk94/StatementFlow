'use strict';

/**
 * MoneySorted — Automated Blog Post Generator
 *
 * Usage:
 *   npm run generate-post
 *
 * Picks the next unused keyword from scripts/keywords.json, asks Claude
 * to write a full blog post, and saves it to lib/generatedPosts.json.
 * The blog pages merge this file automatically — no manual edits needed.
 *
 * Requires ANTHROPIC_API_KEY in .env or .env.local
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const KEYWORDS_FILE = join(__dirname, 'keywords.json');
const GENERATED_FILE = join(ROOT, 'lib', 'generatedPosts.json');

// ── Load env vars from .env.local / .env ─────────────────────────────────────

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const idx = line.indexOf('=');
        if (idx < 0) return;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
      });
    break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function wordCount(html) {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('\nError: ANTHROPIC_API_KEY is not set.');
    console.error('Add it to .env.local:\n  ANTHROPIC_API_KEY=sk-ant-...\n');
    process.exit(1);
  }

  // Pick next unused keyword
  const keywordsData = JSON.parse(readFileSync(KEYWORDS_FILE, 'utf8'));
  const next = keywordsData.keywords.find(k => !k.used);

  if (!next) {
    console.log('\nAll 20 keywords have been used. Add more to scripts/keywords.json to continue.\n');
    process.exit(0);
  }

  const remaining = keywordsData.keywords.filter(k => !k.used).length;
  console.log(`\nGenerating post for: "${next.keyword}"`);
  console.log(`Keywords remaining (including this one): ${remaining}\n`);

  // Build prompt
  const prompt = `Write a blog post for MoneySorted, a free UK bank statement analyser.

Topic: "${next.keyword}"

Requirements:
- 600–800 words of genuine, practical content
- UK English throughout (analyse, colour, programme, etc.)
- Do NOT include an H1 or title — the title is rendered separately
- Use <h2> for 2–3 main sections, <h3> for sub-points where helpful
- Use <p>, <ul>, <li>, <strong>, <a> tags only — no markdown
- Mention MoneySorted naturally once or twice where genuinely relevant
- MoneySorted links must use exactly: <a href="https://www.getmoneysorted.co.uk">MoneySorted</a>
- End with a final <h2>Try MoneySorted Free</h2> section (a short 2–3 sentence paragraph encouraging the reader to upload their statement — this acts as the CTA)
- Tone: authoritative and helpful, not salesy

Also produce:
- title: SEO-friendly, 6–10 words, matches the topic
- metaDescription: 145–160 characters including the keyword naturally
- excerpt: 1–2 sentences for the blog listing card

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "title": "...",
  "metaDescription": "...",
  "excerpt": "...",
  "content": "<p>Full HTML content...</p>"
}`;

  // Call Claude
  console.log('Calling Claude (claude-haiku-4-5-20251001)...');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`\nAnthropic API error (${res.status}):`, errText);
    process.exit(1);
  }

  const apiData = await res.json();
  const rawText = apiData.content[0].text.trim();

  // Parse response — strip accidental markdown fences if present
  let postData;
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    postData = JSON.parse(cleaned);
  } catch {
    // Fallback: extract the first {...} block
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('\nFailed to parse Claude response as JSON.');
      console.error('Raw response:\n', rawText);
      process.exit(1);
    }
    try {
      postData = JSON.parse(match[0]);
    } catch (e2) {
      console.error('\nJSON parse error:', e2.message);
      console.error('Extracted:\n', match[0]);
      process.exit(1);
    }
  }

  // Validate fields
  const missing = ['title', 'metaDescription', 'excerpt', 'content'].filter(f => !postData[f]);
  if (missing.length) {
    console.error(`\nMissing fields in Claude response: ${missing.join(', ')}`);
    process.exit(1);
  }

  const slug = toSlug(postData.title);
  const date = new Date().toISOString().split('T')[0];
  const words = wordCount(postData.content);

  const newPost = {
    slug,
    title: postData.title,
    date,
    readTime: `${Math.ceil(words / 200)} min read`,
    metaDescription: postData.metaDescription,
    excerpt: postData.excerpt,
    content: postData.content,
  };

  // Check for duplicate slug
  const existing = JSON.parse(readFileSync(GENERATED_FILE, 'utf8'));
  if (existing.some(p => p.slug === slug)) {
    console.warn(`\nWarning: slug "${slug}" already exists in generatedPosts.json. Appending anyway.`);
  }

  // Save generated post
  existing.push(newPost);
  writeFileSync(GENERATED_FILE, JSON.stringify(existing, null, 2), 'utf8');

  // Mark keyword as used
  next.used = true;
  next.slug = slug;
  next.generatedAt = date;
  writeFileSync(KEYWORDS_FILE, JSON.stringify(keywordsData, null, 2), 'utf8');

  const stillRemaining = keywordsData.keywords.filter(k => !k.used).length;

  console.log('✓ Post saved to lib/generatedPosts.json');
  console.log(`\n  Title    : ${postData.title}`);
  console.log(`  Slug     : /blog/${slug}`);
  console.log(`  Words    : ~${words}`);
  console.log(`  Read time: ${newPost.readTime}`);
  console.log(`\n  Keywords remaining: ${stillRemaining} / ${keywordsData.keywords.length}`);
  if (stillRemaining > 0) {
    console.log(`  Next up  : "${keywordsData.keywords.find(k => !k.used)?.keyword}"`);
  }
  console.log('\nDeploy or run `npm run dev` to see the new post at /blog\n');
}

main().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
