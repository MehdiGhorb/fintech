import { loadSkill, houseMethod } from '../lib/agents/prompts';
import { resolveAsset } from '../lib/sources/resolve';
import { DEPTH_SETTINGS } from '../lib/agents/context';

const files = [
  'business-analyst',
  'forensics-analyst',
  'valuation-analyst',
  'management-analyst',
  'competitive-analyst',
  'catalyst-analyst',
  'sentiment-analyst',
  'macro-analyst',
  'technical-analyst',
  'quant-strategist',
  'bull-researcher',
  'bear-researcher',
  'red-team',
  'crypto-analyst',
  'risk-manager',
  'portfolio-manager',
  'fact-checker',
];

async function main() {
  for (const f of files) {
    const t = loadSkill(f);
    if (t.length < 400) throw new Error(`${f} too short`);
  }
  if (houseMethod().length < 1000) throw new Error('house method missing');
  const a = await resolveAsset('NVDA');
  if (!a || a.symbol !== 'NVDA') throw new Error('resolve failed');
  console.log('skills', files.length, 'ok');
  console.log('resolve', a);
  console.log('depths', Object.keys(DEPTH_SETTINGS).join(','));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
