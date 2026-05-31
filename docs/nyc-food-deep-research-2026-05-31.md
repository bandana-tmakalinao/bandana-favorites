# NYC food deep research pass

Date: 2026-05-31

Scope: research and knowledge work only. I inspected the current local seed data and source coverage, but did not change app code or seed JSON.

## Executive read

The project now has much deeper seed data than the first memo reflected. Current counts from `src/seed/real-*.data.json`:

| Category | Current count | Main concern |
| --- | ---: | --- |
| Pizza | 54 | Strong; only a few freshness checks remain |
| Bagel | 39 | Strong; add/check a couple Queens and uptown classics |
| Black-and-white cookie | 6 | Still very thin; needs fieldwork |
| Pastrami | 16 | Good core; a few deli omissions |
| Chopped cheese | 6 | Still too thin; needs bodega/crowd fieldwork |
| Bacon, egg & cheese | 37 | Big list, but taxonomy is fuzzy |
| Ramen | 33 | Strong; already added many missing 2026 names |
| Soup dumplings | 31 | Strong; add old-school crowd classics |
| Dim sum | 19 | Needs Queens/modern Cantonese additions |
| Tacos | 35 | Strong |
| Korean fried chicken | 8 | Still too thin and too Manhattan/high-end |
| Pho | 20 | Better, but still Manhattan-heavy |
| Dosa | 12 | Underbuilt; Kanyakumari is missing |
| Cheeseburger | 56 | Very strong; curate more aggressively |
| Steak | 40 | Strong; some classic steakhouse omissions remain |
| Lobster roll | 18 | Adequate but source-thin and seasonal |
| Halal cart | 12 | Underbuilt; missing cart/crowd stalwarts |
| Hot dog | 26 | Strong; a few 2026 misses |
| Cheesecake | 28 | Strong; a few bakery classics missing |
| Cannoli | 24 | Good; needs Villabate Alba / Court Pastry |
| Ice cream | 57 | Very strong; curate more aggressively |

The strongest "shareable" statement:

> We are not trying to scrape a definitive list. We are building a curator-seeded NYC food map that starts from editorial consensus, corrects for borough and category blind spots, then lets first-party head-to-head votes take over.

## Source model

Best source types by category:

- Editorial maps: best for pizza, bagels, tacos, burgers, steak, ramen, ice cream.
- Specialist critics: best for dosa, dim sum, pho, pastrami, old-school neighborhood food.
- Crowd threads: useful for halal carts, chopped cheese, Korean fried chicken, black-and-white cookies, and "which old neighborhood place still hits."
- Michelin: useful as a quality signal for restaurant categories, not enough by itself for street/cart/bodega foods.

Guardrail: still avoid Google/Yelp ratings, reviews, and ranking signals.

Useful current sources checked:

- Eater bagels, updated Mar 2, 2026: https://ny.eater.com/maps/best-bagels-nyc
- Eater pizza, updated Oct 31, 2025: https://ny.eater.com/maps/best-pizza-new-york-city-nyc-pizzerias
- Eater tacos, updated Apr 29, 2025: https://ny.eater.com/maps/best-tacos-nyc
- Eater burgers, updated May 22, 2025: https://ny.eater.com/maps/best-burgers-nyc
- Eater steakhouses, updated Apr 20, 2026: https://ny.eater.com/maps/best-nyc-steakhouse-classic
- Eater breakfast sandwiches: https://ny.eater.com/maps/best-breakfast-sandwiches-nyc
- Eater sandwiches: https://ny.eater.com/maps/best-sandwich-nyc-shops
- Eater dim sum: https://ny.eater.com/maps/best-dim-sum-nyc-2024
- Eater Vietnamese: https://ny.eater.com/maps/best-vietnamese-restaurants-food-nyc
- Eater Indian: https://ny.eater.com/maps/best-indian-restaurants-nyc
- The Infatuation ramen: https://www.theinfatuation.com/new-york/cuisines/ramen
- The Infatuation dumplings, May 6, 2026: https://www.theinfatuation.com/new-york/guides/the-dumpling-map
- The Infatuation chopped cheese: https://www.theinfatuation.com/new-york/guides/best-chopped-cheese-nyc
- Time Out pho: https://www.timeout.com/newyork/restaurants/best-pho-restaurant-nyc
- Michelin ramen: https://guide.michelin.com/ca/en/best-of/best-ramen-new-york-michelin-guide

## Current code audit

Important detail: the local data is already more complete than the first memo. Examples:

- Pizza already includes Lucky Charlie, Chrissy's, Ops, and Rocco's of Roc Beach.
- Bagels already include Bagel Hole, Kossar's, and H&H.
- Pastrami already includes Essen NY Deli and Sarge's.
- Ramen already includes Gogyo, Ramen By Ra, Kohoku-Ku, and Shuya.
- Soup dumplings already include Steam and Din Tai Fung.
- Tacos already include El Lado Taco, Taqueria Ramirez, and Carnitas Ramirez.
- Steak already includes Sparks.
- Hot dog already includes Smitty's.
- Ice cream already includes L'Albero dei Gelati and Sundaes Best.

Still missing after this audit:

- Pugsley Pizza.
- Middle Village Bagels; Between the Bagel in the bagel list.
- One Girl Cookies, Orwashers, Zabar's, Nussbaum & Wu, Breads Bakery, Green's Bakery for black-and-white cookies.
- Mirage Diner, Mile End for pastrami variants.
- Mazzy's Chopped Cheese; Tatiana as an upscale variant.
- Hani's Bakery & Cafe, Ras Plant Based, Ramen by Ra for breakfast sandwich/BEC variants.
- Marufuku Ramen and Jeju Noodle Bar, if the ramen category includes chain/modern Korean noodle context.
- Noodle Village, Shanghai Time, Kung Fu Xiao Long Bao for soup dumplings.
- Moon Kee, New Mulan, Hey Yuet, Long Island Dumplings, Steam for dim sum.
- Pelicana, Mad for Chicken, Turntable Chicken Jazz, Don Chicken, Mr. Dak, bb.q Chicken for Korean fried chicken.
- Diem Eatery, Two Wheels, VPho and Pizzeria, Pho Hoai, Thanh Da, Pho Grand, Sen Saigon for pho.
- Kanyakumari, Dosa Delight, Madras Dosa Cafe, Annapurna Bhavan, Kidilum for dosa.
- One White Street, Emily, Monkey Bar for burgers.
- Royal 35, Strip House, Benjamin Steakhouse, Rocco Steakhouse for steak.
- Ed's Lobster Bar, Flex Mussels, Crave Fishbar, The Clam for lobster rolls.
- Hamza & Madina, Mido's, Kwik Meal, Mahmoud's Corner, Rafiqi's, Sharif's Famous for halal carts.
- Lovely's Old Fashioned, Harlem Shake, Glizzy's NYC, Gotham Burger Social Club for hot dogs.
- Ferrara Bakery & Cafe, Little Cupcake Bakeshop, Martha's Country Bakery for cheesecake.
- Villabate Alba, Court Pastry Shop, Royal Crown Bakery for cannoli.
- Ice Cream Window, Mixue, Thick for ice cream.

## Highest-priority research additions

If I were making one data-quality sprint before sharing this publicly, I would focus here:

1. Korean fried chicken: add mainstream Korean chicken specialists, not just restaurant dishes.
2. Dosa: add Kanyakumari and Queens/casual South Indian specialists.
3. Pho: reduce Manhattan skew with Brooklyn, Queens, Bronx, and older Vietnamese staples.
4. Halal cart: add cart/crowd stalwarts beyond Midtown lines.
5. Black-and-white cookie: build a real list from bakery crawl data.
6. Chopped cheese: add street/bodega truth, not only editorially visible versions.
7. Dim sum: add Moon Kee, New Mulan, Hey Yuet, Long Island Dumplings, and Steam.
8. BEC: decide whether this is "strict BEC" or "breakfast sandwich."

## Category deep notes

### Pizza

Current data strength: very high.

Current borough shape: Brooklyn 25, Manhattan 20, Queens 5, Staten Island 3, Bronx 1.

Likely top confidence tier:

- Lucali
- Una Pizza Napoletana
- L'Industrie
- Mama's Too
- Scarr's
- Joe's Pizza
- Roberta's
- Joe & Pat's
- L&B Spumoni Gardens
- John's of Bleecker
- Rubirosa
- Di Fara

Research read:

- Eater's October 2025 pizza update explicitly added Ops, Lucky Charlie, Chrissy's, and Pugsley, and temporarily removed Rose & Joe's and Louie & Ernie's.
- Your data already has Ops, Lucky Charlie, and Chrissy's; Pugsley is the obvious missing one.
- Keep Louie & Ernie's as a Bronx icon unless the product goal is "current editorial top 30" rather than "NYC canon."

Action:

- Add Pugsley Pizza.
- Keep the current large list, but use confidence tiers so the list does not feel like every pizzeria is equally canonical.

### Bagel

Current data strength: high.

Current borough shape: Manhattan 23, Brooklyn 12, Queens 3, Bronx 1.

Likely top confidence tier:

- Apollo Bagels
- Bo's Bagels
- Russ & Daughters
- Utopia Bagels
- Bagel Hole
- Ess-a-Bagel
- Absolute/2788 Bagels
- Murray's
- Bagel Pub
- Shelsky's
- Tompkins Square Bagels, with a note that some editors have cooled on it

Research read:

- Eater's March 2026 update emphasizes that the city's bagel list keeps evolving. It added Bagel Joint and specifically removed Tompkins Square, Bagel Supreme, and Terrace in that update.
- The current data already includes many old and new poles: Apollo, Utopia, Bagel Hole, Kossar's, H&H, Bagel Joint, Murray's.
- Missing "Between the Bagel" from the bagel category is notable because the same place already appears in BEC. Eater specifically describes it as an Astoria bagel draw with Korean flourishes.

Action:

- Add Between the Bagel to bagels.
- Check Middle Village Bagels as Queens fieldwork.
- Keep Tompkins, Terrace, and Bagel Supreme, but lower confidence if the seed is meant to mirror current editorial consensus.

### Black-and-white cookie

Current data strength: low.

Current borough shape: Manhattan 5, Bronx 1.

Likely top confidence tier:

- William Greenberg Desserts
- Lee Lee's Baked Goods
- Madonia Bakery
- Russ & Daughters / Russ & Daughters Cafe
- Partybus Bakeshop

Research read:

- This is not a category with deep, current, authoritative maps. It is a bakery-crawl category.
- The current list is too small for a launch-quality ranking experience.
- One Girl Cookies, Orwashers, Zabar's, Nussbaum & Wu, Breads Bakery, Green's Bakery, Empire Cake, and possibly By the Way Bakery should be treated as fieldwork candidates.

Action:

- Add a "candidate" tier, not all as top seed.
- Prioritize actual tasting notes: cake texture, frosting balance, fondant snap, vanilla/chocolate contrast, freshness.

### Pastrami

Current data strength: medium-high.

Current borough shape: Manhattan 7, Brooklyn 6, Bronx 2, Queens 1.

Likely top confidence tier:

- Katz's
- Pastrami Queen
- Liebman's
- S&P Lunch
- Frankel's
- 2nd Avenue Deli
- Essen NY Deli
- Sarge's
- David's Brisket House

Research read:

- Your current data already has Essen and Sarge's, which were first-pass additions.
- The remaining question is variant scope: straight pastrami on rye versus reubens, barbecue pastrami, pastrami beef ribs, and Montreal-style deli.

Action:

- Add Mirage Diner if pastrami reubens are allowed.
- Decide whether Mile End belongs. It is useful if the category is "pastrami and smoked meat sandwiches," less clean if it is strictly "NY pastrami on rye."

### Chopped cheese

Current data strength: low.

Current borough shape: Manhattan 4, Brooklyn 2.

Likely top confidence tier:

- Blue Sky Deli / Hajji's
- Bodega Truck
- Compton's
- Cubby's
- Nishaan
- Titi's Empanadas

Research read:

- The current list is entirely Infatuation-visible, which means it is good but not culturally complete.
- This is a neighborhood bodega food. Pure editorial aggregation will miss many real contenders.
- The product will feel more authentic if it includes Harlem, Bronx, Washington Heights/Inwood, Queens, and Brooklyn bodega leads.

Action:

- Add Mazzy's Chopped Cheese as a current dedicated concept.
- Add Tatiana only as an "upscale chopped cheese variant," not canonical.
- Build a crowd/fieldwork list from neighborhood recommendations.

### Bacon, egg & cheese

Current data strength: high as "breakfast sandwiches," medium as strict "BEC."

Current borough shape: Brooklyn 23, Manhattan 13, Queens 1.

Likely top confidence tier if broad breakfast sandwich:

- Daily Provisions
- Court Street Grocers
- Golden Diner
- Win Son Bakery
- Edith's
- Peck's
- Greenberg's Bagels
- John's Deli
- Tompkins Square Bagels
- Montague Diner

Likely top confidence tier if strict BEC:

- Daily Provisions
- John's Deli
- Greenberg's Bagels
- Tompkins Square Bagels
- Modern Bread & Bagel
- Southside Coffee
- Montague Diner
- Best Bagel & Coffee
- Liberty Bagels
- a real bodega/corner deli set, still missing

Research read:

- The category name is BEC, but current candidates include egg sandwiches with sausage, prosciutto, pork belly, pastrami, bulgogi, and vegetarian or chef-driven variants.
- Eater and Infatuation both cover "breakfast sandwiches" more than strict BECs.

Action:

- Product decision needed: rename to "Breakfast Sandwich" or prune to strict BEC.
- If strict BEC, add classic bodega/deli candidates and lower the chef-sandwich variants.
- If broad, add Hani's Bakery & Cafe, Ras Plant Based, and Ramen by Ra as trend/variant candidates.

### Ramen

Current data strength: high.

Current borough shape: Manhattan 24, Brooklyn 7, Queens 2.

Likely top confidence tier:

- Okiboru
- Tonchin
- Ivan Ramen
- Ramen By Ra
- Gogyo
- Kohoku-Ku
- Shuya
- Ramen Ishida
- Momofuku Noodle Bar
- Ichiran
- Ippudo
- Okonomi / Yuji

Research read:

- The data already picked up the important 2026-style names: Ramen By Ra, Gogyo, Kohoku-Ku, Shuya.
- The Infatuation ramen page now functions as a strong freshness source, with recent entries across 2025 and 2026.
- Michelin remains helpful for a high-quality cross-check, but ramen is a neighborhood-specialist category, not only Michelin.

Action:

- Consider Marufuku Ramen if chain/import popularity matters.
- Consider Jeju Noodle Bar only if "Korean ramyun/noodle bar" belongs in the category; otherwise keep it out.
- Add one or two more Queens ramen entries if the category feels Manhattan-heavy.

### Soup dumplings

Current data strength: high.

Current borough shape: Manhattan 20, Brooklyn 6, Queens 5.

Likely top confidence tier:

- Nan Xiang Xiao Long Bao
- Shanghai You Garden
- The Bao
- 456 Shanghai Cuisine
- Joe's Shanghai
- Pinch Chinese
- CheLi
- Little Alley
- Mr Bun
- Din Tai Fung
- Shanghai Zhen Gong Fu

Research read:

- Current list is broad and credible.
- The Infatuation's May 2026 dumpling map is not soup-dumpling-only, but it reinforces Mr. Bun and Liu's Shanghai style Brooklyn/Flushing dumpling coverage.

Action:

- Add Noodle Village, Shanghai Time, and Kung Fu Xiao Long Bao as old-school/crowd leads.
- Decide whether pan-fried soup buns/sheng jian bao belong here or deserve their own future category.

### Dim sum

Current data strength: medium.

Current borough shape: Manhattan 15, Brooklyn 3, Queens 1.

Likely top confidence tier:

- Asian Jewels
- East Harbor Seafood Palace
- Dim Sum Go Go
- Golden Unicorn
- House of Joy
- Nom Wah
- Jing Fong
- Tim Ho Wan
- Buddha Bodai
- Yin Ji Chang Fen

Research read:

- Eater's dim sum map highlights Moon Kee, New Mulan, Hey Yuet, Long Island Dumplings, and Steam. These are all missing from the current local data.
- Current data is too Manhattan-heavy for a dim sum category, where Flushing and Brooklyn should matter more.

Action:

- Add Moon Kee.
- Add New Mulan.
- Add Hey Yuet.
- Add Long Island Dumplings.
- Add Steam.
- Consider Dim Sum Garden Express as a Flushing commuter/snack-shop lead.

### Tacos

Current data strength: high.

Current borough shape: Brooklyn 16, Manhattan 14, Queens 3, Staten Island 1, Bronx 1.

Likely top confidence tier:

- Taqueria Ramirez
- Carnitas Ramirez
- Birria-Landia
- Los Tacos No. 1
- Tacos El Bronco
- Taqueria Al Pastor
- Taco Mix
- Cosme
- Esse Taco
- Plaza Ortega
- Los Mariscos

Research read:

- Eater's April 2025 update added Carnitas Ramirez, Esse Taco, and Birria-Landia. All are in current data.
- The current list is deep enough to support a real ranking experience.

Action:

- Add Taco Veloz only after fieldwork/crowd confirmation.
- Consider whether expensive restaurant tacos should be compared directly against street tacos or marked as a variant.

### Korean fried chicken

Current data strength: low-medium.

Current borough shape: Manhattan 7, Queens 1.

Likely top confidence tier:

- Coqodaq
- Chick Chick
- Ariari
- Atoboy
- Yetnal Tongdak

Research read:

- Current list still reads like "restaurants with notable Korean fried chicken," not "best Korean fried chicken in NYC."
- Missing specialist chains/shops makes it feel incomplete to anyone who eats Korean chicken in K-town, Flushing, Murray Hill, or Bayside.

Action:

- Add Pelicana.
- Add Mad for Chicken.
- Add Turntable Chicken Jazz.
- Add Don Chicken.
- Add Mr. Dak.
- Add bb.q Chicken as a benchmark, even if not top-tier.
- Add more Queens/Manhattan Koreatown coverage.

### Pho

Current data strength: medium.

Current borough shape: Manhattan 15, Brooklyn 3, Queens 1, Bronx 1.

Likely top confidence tier:

- Banh Anh Em
- Banh
- Madame Vo
- Mam
- Pho Bang
- Pho Ga Vang
- Nha Trang One
- Pasteur Grill & Noodles
- Di An Di
- Saigon Social

Research read:

- The current list is much better than before, but still highly Manhattan-weighted.
- Time Out's pho guide and Eater's Vietnamese coverage reinforce that modern Manhattan Vietnamese is only part of the category.

Action:

- Add Diem Eatery if still current/strong.
- Add Two Wheels.
- Add VPho and Pizzeria for Bronx representation.
- Add Pho Hoai or Thanh Da for Brooklyn representation.
- Add Pho Grand as a Chinatown classic if still quality/open.
- Add Sen Saigon as a vegetarian pho option if the category supports non-beef variants.

### Dosa

Current data strength: medium-low.

Current borough shape: Manhattan 7, Queens 3, Brooklyn 2.

Likely top confidence tier:

- NY Dosas
- Temple Canteen
- Semma
- Pongal
- Saravanaa Bhavan
- Dosa Royale
- Hillside Dosa Hutt

Research read:

- Eater's Indian guide specifically calls out Semma's gunpowder dosa as one of the best in town and includes Kanyakumari as an Eater Award-winning regional Indian restaurant.
- Kanyakumari is missing from the dosa data. It is the most obvious current high-confidence omission.
- The category should include both high-end restaurant dosa and everyday South Indian dosa specialists, but not rank them as if they are the same use case.

Action:

- Add Kanyakumari.
- Add Dosa Delight.
- Add Madras Dosa Cafe.
- Add Annapurna Bhavan as a new fieldwork lead.
- Add Kidilum as a new fieldwork lead.

### Cheeseburger

Current data strength: very high, possibly too broad.

Current borough shape: Manhattan 37, Brooklyn 16, Queens 2, Staten Island 1.

Likely top confidence tier:

- Minetta Tavern
- Raoul's
- Red Hook Tavern
- 4 Charles Prime Rib
- Hamburger America
- J.G. Melon
- Rolo's
- Nowon
- Smashed
- 7th Street Burger
- Peter Luger
- Corner Bistro
- Lovely's Old Fashioned

Research read:

- Current list has enough depth to support voting immediately.
- Eater's 2025 burger guide frames the category as broad: fancy patties, budget burgers, smash burgers, pub burgers.
- Missing One White Street is notable because it has recent "best burger" momentum.

Action:

- Add One White Street.
- Add Emily if pizza/burger crossover canon matters.
- Add Monkey Bar for luxe/classic Manhattan.
- Curate by variant: pub burger, smash burger, diner burger, steakhouse burger, restaurant burger.

### Steak

Current data strength: high.

Current borough shape: Manhattan 32, Brooklyn 6, Queens 2.

Likely top confidence tier:

- Cote
- Gallaghers
- Keens
- Peter Luger
- Gage & Tollner
- 4 Charles
- St. Anselm
- Hawksmoor
- Delmonico's
- Sparks
- The Grill

Research read:

- Eater's April 2026 steakhouse map added Sammy's Roumanian, Cuerno, Golden Steer, Gallaghers, and Charlie Palmer Steak IV.
- Your data already includes Cuerno, Golden Steer, Gallaghers, Sparks, and many classics.
- Missing Royal 35, Strip House, Benjamin, and Rocco is mostly a "classic Manhattan steakhouse completeness" issue.

Action:

- Add Royal 35.
- Add Strip House.
- Add Benjamin Steakhouse.
- Add Rocco Steakhouse.
- Consider Sammy's Roumanian if the category includes nostalgic steak/meat restaurants, not just steakhouses.

### Lobster roll

Current data strength: medium.

Current borough shape: Manhattan 12, Brooklyn 6.

Likely top confidence tier:

- Red Hook Lobster Pound
- Luke's Lobster
- Cull & Pistol
- Greenpoint Fish & Lobster
- Lobster Place
- Lure Fishbar
- The Mermaid Inn
- Grand Army

Research read:

- Current source base is narrower than pizza/burger/taco.
- Lobster rolls are seasonal, price-sensitive, and closure-prone.
- Important to distinguish cold Maine-style from warm Connecticut-style.

Action:

- Add Ed's Lobster Bar if current/open and still serving a strong roll.
- Add Flex Mussels.
- Add Crave Fishbar.
- Add The Clam.
- Add style metadata: Maine, Connecticut, both, or variant.

### Halal cart

Current data strength: low-medium.

Current borough shape: Manhattan 9, Queens 2, Brooklyn 1.

Likely top confidence tier:

- Adel's
- Royal Grill
- Sammy's
- Biryani Cart
- Tariq's
- The Halal Guys as historical baseline
- Bay Ridge Halal

Research read:

- Current list is too Midtown-heavy.
- This is a cart/crowd category. Editorial lists help, but neighborhood fieldwork matters more.

Action:

- Add Hamza & Madina.
- Add Mido's.
- Add Kwik Meal.
- Add Mahmoud's Corner.
- Add Rafiqi's as chain/historical baseline.
- Add Sharif's Famous as a fieldwork lead.
- Track exact corner/location, because carts move and names duplicate.

### Hot dog

Current data strength: high.

Current borough shape: Manhattan 16, Brooklyn 6, Queens 3, Staten Island 1.

Likely top confidence tier:

- Dog Day Afternoon
- Crif Dogs
- Gray's Papaya
- Papaya King
- Nathan's Famous
- Katz's
- Schaller's Stube
- Santa Salsa
- Dyckman Dogs
- Smitty's

Research read:

- The data already includes Smitty's.
- Missing Lovely's Old Fashioned and Harlem Shake is notable because both appear in current casual burger/hot dog discourse.

Action:

- Add Lovely's Old Fashioned.
- Add Harlem Shake.
- Add Glizzy's NYC as a newer late-night candidate.
- Add Gotham Burger Social Club if the hot dog remains strong enough after fieldwork.

### Cheesecake

Current data strength: high.

Current borough shape: Manhattan 17, Brooklyn 7, Queens 3, Bronx 1.

Likely top confidence tier:

- Eileen's
- Junior's
- S & S Cheesecake
- La Cheesecake
- Veniero's
- Sarge's
- Mah-Ze-Dahr
- Peter Luger
- Caputo's

Research read:

- Current data is much broader than first pass.
- The missing names are mostly classic/everyday bakery coverage.

Action:

- Keep S & S Cheesecake as its own candidate. Peter Luger may source from it, but the bakery itself deserves candidate status too.
- Add Ferrara Bakery & Cafe.
- Add Martha's Country Bakery.
- Add Little Cupcake Bakeshop.

### Cannoli

Current data strength: medium-high.

Current borough shape: Manhattan 11, Bronx 8, Brooklyn 4, Queens 1.

Likely top confidence tier:

- Gino's Pastry Shop
- Madonia Bakery
- Artuso Pastry Shop
- DeLillo Pastry Shop
- Egidio Pastry Shop
- Morrone Pastry Shop
- Veniero's
- Ferrara
- Cannoli Plus
- Pasticceria Rocco

Research read:

- The Bronx/Arthur Avenue base is good.
- Missing Villabate Alba and Court Pastry creates a Brooklyn/Sicilian bakery gap.

Action:

- Add Villabate Alba.
- Add Court Pastry Shop.
- Add Royal Crown Bakery as a fieldwork lead.
- Recheck whether Cannoli World and Carlo's should be lower-confidence tourist/chain candidates.

### Ice cream

Current data strength: very high, possibly too broad.

Current borough shape: Manhattan 36, Brooklyn 18, Queens 3.

Likely top confidence tier:

- Caffe Panna
- Morgenstern's
- Eddie's Sweet Shop
- Malai
- Chinatown Ice Cream Factory
- Sugar Hill Creamery
- L'Albero dei Gelati
- Il Laboratorio del Gelato
- Brooklyn Farmacy
- Superiority Burger
- Van Leeuwen
- OddFellows

Research read:

- Eater, Infatuation, Time Out, and Resy all produce useful ice cream coverage.
- Current count of 57 is enough that the product needs curation, not merely more names.
- There are at least four substyles competing: scoop shops, gelato, soft serve, sundaes/soda fountains.

Action:

- Add Ice Cream Window.
- Add Mixue if soft serve/value is in-scope.
- Add Thick if newer novelty/pint shops are in-scope.
- Consider splitting future tags: scoop, gelato, soft serve, sundae, kulfi/Asian flavors, vegan.

## Shareable "best-of" confidence tiers

Use these as the clean external-facing story, not as hard rankings.

Highest confidence categories:

- Pizza: iconic and modern consensus are both well covered.
- Tacos: strong current editorial alignment.
- Burgers: very deep, but should be variant-tagged.
- Steak: strong classic and new-school coverage.
- Ice cream: very deep, needs curation more than additions.
- Ramen: strong after recent additions.
- Bagels: strong after recent additions.

Needs one research sprint:

- Dim sum: add missing Queens/modern Cantonese names.
- Pho: reduce Manhattan skew.
- Dosa: add Kanyakumari and casual South Indian shops.
- Halal cart: add cart/crowd stalwarts.
- Korean fried chicken: add specialist chicken shops.
- Pastrami: settle variant scope.
- Lobster roll: verify freshness/open-status and style.

Needs fieldwork more than more listicles:

- Black-and-white cookie.
- Chopped cheese.
- Strict BEC, if kept strict.

## Suggested public language

Short version:

> Bandana Favorites starts each NYC food category with a researched editorial seed: classic institutions, current critic favorites, neighborhood specialists, and obvious crowd favorites. The seed is not the final ranking. It is a clean starting field for first-party head-to-head votes.

Longer version:

> For every category, we look for consensus across current NYC food coverage, older neighborhood institutions, specialist critics, and street-level/crowd knowledge where the food culture demands it. Pizza and burgers can lean on editorial maps; chopped cheese, halal carts, BECs, and black-and-white cookies need more local fieldwork. The goal is not to copy a list. It is to start each ranking with a defensible set of contenders, then let the Bandana community create the real order.
