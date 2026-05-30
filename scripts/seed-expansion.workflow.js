export const meta = {
  name: 'seed-expansion',
  description: 'Research up to 50 signature dishes per NYC food category from 2025+ best-of lists, verify, return seed data',
  whenToUse: 'Scaling the Bandana Favorites curated dish seed toward ~50 contenders per food type',
  phases: [
    { title: 'Research', detail: 'one agent per food type: 2025+ editorial lists → consensus places + signature dishes' },
    { title: 'Verify', detail: 'skeptical fact-check: drop non-2025+ / forbidden-source / fabricated entries' },
  ],
}

// slug → human dish name used in prompts. Covers all 21 live food types.
const CATEGORIES = [
  ['pizza', 'pizza (slice or pie)'],
  ['ramen', 'ramen'],
  ['bagels', 'bagel & lox / bagel sandwiches'],
  ['ice-cream', 'ice cream & gelato'],
  ['steak', 'steakhouse steak'],
  ['pastrami', 'pastrami on rye'],
  ['chopped-cheese', 'chopped cheese'],
  ['bacon-egg-cheese', 'bacon, egg & cheese'],
  ['halal-cart', 'halal cart platters & gyros'],
  ['cheesecake', 'cheesecake'],
  ['black-and-white-cookie', 'black & white cookie'],
  ['hot-dog', 'hot dogs'],
  ['soup-dumplings', 'soup dumplings (xiao long bao)'],
  ['dim-sum', 'dim sum'],
  ['cheeseburger', 'cheeseburgers'],
  ['tacos', 'tacos'],
  ['korean-fried-chicken', 'Korean fried chicken'],
  ['lobster-roll', 'lobster rolls'],
  ['pho', 'pho'],
  ['cannoli', 'cannoli'],
  ['dosa', 'dosa'],
]

const SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          date: { type: 'string' },
          url: { type: 'string' },
          included: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['name', 'included'],
      },
    },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          neighborhood: { type: 'string' },
          borough: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          signatureDish: { type: 'string' },
          appearsOn: { type: 'array', items: { type: 'string' } },
          appearanceCount: { type: 'integer' },
          seedQuality: { type: 'number' },
        },
        required: ['name', 'neighborhood', 'borough', 'title', 'appearsOn', 'seedQuality'],
      },
    },
  },
  required: ['slug', 'entries'],
}

const researchPrompt = (slug, dish) => `You are researching the best **${dish}** in NYC to seed a food-ranking app. Produce a consensus list of up to 50 NYC places known for ${dish}, each with its signature dish. The current month is May 2026.

STRICT SOURCING RULES (the app's policy — non-negotiable):
- Use ONLY editorial best-of lists / guides / reviews published or updated in **2025 or later**. For EVERY source, find its publication or last-updated date. If you cannot confirm it is 2025+, do NOT use it.
- ALLOWED sources: The Infatuation, Eater NY, Time Out New York, The New York Times, MICHELIN Guide, Resy, Bon Appétit, Grub Street / NY Magazine, Robb Report, The LO Times (Ryan Sutton), Thrillist (2025+ only).
- FORBIDDEN — never use, they do not count: Yelp, TripAdvisor, Google, Reddit, cozymeal, classpop, atly, 8it, slowtravelnyc, OpenTable blogs, and any SEO/affiliate listicle.
- Never copy any single publication's ranking order.

METHOD:
1. Search for 2025+ "best ${dish} NYC" editorial lists. Open 3-6 ALLOWED sources and verify each date is 2025+.
2. Extract every recommended place + its specific signature ${dish} dish + neighborhood + borough (Manhattan/Brooklyn/Queens/Bronx/Staten Island).
3. Tally how many of your verified 2025+ sources feature each place (appearanceCount = appearsOn.length).
4. Build OUR OWN consensus order: more lists = higher; break ties by notability.
5. Aim for up to 50 REAL, genuinely-recommended places. Quality over quantity — if only 15 are well-sourced, return 15. NEVER invent places or sources.

Per place: name; neighborhood; borough; title (clean menu-style dish name, e.g. "Tonkotsu Ramen", "Lamb Barbacoa Taco"); description (short phrase); signatureDish (raw text); appearsOn (the 2025+ source names); appearanceCount; seedQuality 0.0-1.0 (single-source ~0.55-0.65, two ~0.75-0.82, three+ ~0.88-0.96).
Also return "sources": every list considered, with name, date, url, included(bool), reason-if-excluded.
slug must be "${slug}". Return ONLY the structured object.`

const verifyPrompt = (slug, dish, researched) => `You are a skeptical fact-checker for a food-ranking seed. Below is a researched consensus of the best ${dish} in NYC with claimed 2025+ sources. Remove anything you cannot stand behind.

${JSON.stringify(researched)}

CHECKS:
- Every entry must trace to at least one ALLOWED editorial source (Infatuation, Eater NY, Time Out NY, NYT, MICHELIN, Resy, Bon Appétit, Grub Street, LO Times, Robb Report) published 2025 or later. Drop entries whose only sources are forbidden (Yelp/TripAdvisor/Reddit/SEO blogs) or pre-2025.
- Spot-check: actually search or fetch 1-2 of the cited sources. If a cited source isn't 2025+ or doesn't exist, drop the entries depending on it and record why in "sources".
- Drop obvious fabrications and any place not genuinely known for ${dish}.
- Dedupe by place name. Cap at 50, keeping highest-consensus entries. Keep titles menu-style and descriptions short.

Return the SAME structured shape with the cleaned "entries" (and "sources" updated with any you invalidated: included:false + reason). slug must be "${slug}". Return ONLY the object.`

log(`Expanding ${CATEGORIES.length} food categories toward ~50 each (2025+ sources only)`)

const results = await pipeline(
  CATEGORIES,
  ([slug, dish]) =>
    agent(researchPrompt(slug, dish), {
      label: `research:${slug}`,
      phase: 'Research',
      agentType: 'general-purpose',
      schema: SCHEMA,
    }),
  (researched, [slug, dish]) =>
    agent(verifyPrompt(slug, dish, researched), {
      label: `verify:${slug}`,
      phase: 'Verify',
      agentType: 'general-purpose',
      schema: SCHEMA,
    }),
)

const clean = results.filter(Boolean)
const summary = clean.map((r) => ({ slug: r.slug, count: (r.entries || []).length }))
log(`Done: ${summary.map((s) => `${s.slug}=${s.count}`).join(', ')}`)

// Returned to the main loop, which merges each category's entries via scripts/seed_merge.py.
return { categories: clean }
