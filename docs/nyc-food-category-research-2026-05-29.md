# NYC food category research memo

Date: 2026-05-29

Scope: research only. No app code or seed data was changed.

## Method

I audited the 21 current real-data seed files in `src/seed`, then cross-checked the categories against current NYC food sources: Eater NY, The Infatuation, Time Out New York, The Michelin Guide, Resy where relevant, and selected FoodNYC/AskNYC Reddit threads only as crowd-signal or fieldwork leads. I did not use Google or Yelp ratings, which keeps this aligned with the existing data-sourcing guardrails.

The current seed is already directionally good. The main opportunity is not replacing it, but making the editorial seed more defensible: add missing consensus places, split fuzzy categories, and reduce Manhattan/new-restaurant bias in categories where outer-borough neighborhood institutions matter.

## Overall diagnosis

Strongest launch lists:

- Pizza, tacos, cheeseburger, steak, soup dumplings, hot dog, ice cream.
- These already have 22-30 candidates, multiple current editorial source families, and a good mix of classics and newer places.

Needs the most research depth:

- Black-and-white cookie: only 5 candidates; source base is very thin.
- Chopped cheese: only 6 candidates; the best versions are often local bodegas rather than editorially reviewed restaurants.
- Korean fried chicken: only 5 candidates and too weighted toward high-end restaurant dishes.
- Dosa: 11 candidates; missing newer South Indian consensus, especially Kanyakumari and several casual Queens/Manhattan specialists.
- Halal cart: 11 candidates; needs more cart-specific/crowd mapping.
- Pho: 13 candidates; current list skews modern Manhattan and needs more outer-borough Vietnamese staples.
- Pastrami: 14 candidates; missing several obvious deli/pastrami-specific contenders.

Taxonomy issue:

- The `bacon-egg-cheese` list currently contains many destination breakfast sandwiches that are explicitly not default BECs. That is fine if the category becomes "breakfast sandwich," but if the user-facing promise is "Bacon, Egg & Cheese," the list should either get stricter or split into two categories.

## Category audit and recommendations

### 1. Pizza

Current count: 30

Current seed read: very strong. Lucali, Una Pizza Napoletana, L'Industrie, Mama's Too, Scarr's, Joe's, Roberta's, Joe & Pat's, L&B, John's of Bleecker, Rubirosa, Chrissy's, F&F, Louie & Ernie's, Lucia Avenue X, Denino's, Di Fara, Ops, Don Antonio, See No Evil, Andrew Bellucci, Paulie Gee's, Luigi's, Best Pizza, and others.

Research signal:

- Eater's current iconic pizzeria map explicitly added Ops East Village, Lucky Charlie, Chrissy's, and Pugsley Pizza in its October 2025 update.
- Time Out's recent list has Mama's Too, Scarr's, Una Pizza Napoletana, and Rubirosa as major signals.
- Infatuation's 2026 pizza hub remains a useful recency check.

High-priority checks:

- Add/verify Lucky Charlie and Pugsley Pizza.
- Keep Chrissy's high in the set; it is now showing up as a newer consensus name.
- Verify whether Louie & Ernie's should remain in the current "top" seed after Eater temporarily removed it in a recent update. It is still an iconic Bronx pick, so I would not remove it automatically.

Verdict: strong. Needs small 2025-2026 freshness additions, not a rebuild.

### 2. Bagel and lox

Current count: 21

Current seed read: strong but slightly skewed toward destination/media bagel shops. Apollo, Bo's, Russ & Daughters, Shelsky's, Tompkins Square Bagels, Utopia, PopUp, Bagel Pub, Ess-a-Bagel, 2788/Absolute, Bergen, Best Bagel & Coffee, Knickerbocker, Liberty, Terrace, Bagel Oasis, Tal, Bagel Joint, Bagels & Co., Greenberg's, Murray's.

Research signal:

- Eater's 2026 bagel map and Infatuation's March 2026 bagel guide both indicate the category is still actively changing.
- Time Out refreshed its bagel list in late 2025.
- FoodNYC crowd signal keeps bringing up less-hyped classic/dense bagel shops like Bagel Hole and Middle Village Bagels alongside Apollo/Utopia/Best Bagel.

High-priority checks:

- Add Bagel Hole as an old-school, dense/crusty counterweight.
- Add or verify Middle Village Bagels as a Queens fieldwork lead.
- Consider Kossar's and H&H Bagels for historical completeness, but do not over-rank purely on nostalgia.
- Between the Bagel appears in the BEC seed; consider whether it also belongs in the bagel set.

Verdict: strong, but add a few less-hype classic shops to balance Apollo/PopUp-style modern attention.

### 3. Black-and-white cookie

Current count: 5

Current seed read: very thin. Russ & Daughters Cafe, Lee Lee's, William Greenberg, Madonia, Partybus Bakeshop.

Research signal:

- Eat This NY is actively covering black-and-white cookies in 2026 and recently highlighted One Girl Cookies.
- FoodNYC crowd signal remains strongest for William Greenberg, but also names Orwashers and other bakery counters.
- This category lacks a deep, reliable, recent editorial map. It needs fieldwork more than aggregation.

High-priority checks:

- Add/verify One Girl Cookies.
- Add/verify Orwashers.
- Add/verify Zabar's, Nussbaum & Wu, Breads Bakery, Green's Bakery, and Empire Cake as candidates, but rank conservatively until tasted or supported by multiple sources.
- Keep William Greenberg near the top of the initial editorial seed.

Verdict: under-researched. Needs a dedicated black-and-white cookie crawl.

### 4. Pastrami on rye

Current count: 14

Current seed read: good core, but missing obvious pastrami-specific entries. Current includes Katz's, Pastrami Queen, Frankel's, Liebman's, S&P, 2nd Avenue Deli, Butcher Block, David's Brisket House, Hometown Bar-B-Que, Junior's, Mendy's, Moe's, Morgan's, USA Brooklyn.

Research signal:

- Infatuation's pastrami guide highlights Essen NY Deli, Sarge's, Mirage Diner, and S&P as meaningful pastrami/reuben destinations.
- Michelin's deli guide reinforces the broader deli category and classic NYC deli framing.
- Eater's sandwich coverage keeps S&P prominent.

High-priority checks:

- Add Essen NY Deli.
- Add Sarge's Delicatessen as pastrami, not only cheesecake.
- Add Mirage Diner for pastrami reuben if the category permits pastrami variants.
- Consider Mile End only if Montreal-style deli belongs in the taxonomy.

Verdict: good, but add Essen/Sarge's/Mirage before treating this as complete.

### 5. Chopped cheese

Current count: 6

Current seed read: small but sensible. Blue Sky Deli/Hajji's, Bodega Truck, Compton's, Cubby's, Nishaan, Titi's Empanadas.

Research signal:

- Infatuation's September 2025 list frames the best versions as often coming from random bodegas, especially uptown and in the Bronx.
- Eater covered Mazzy's Chopped Cheese in Hell's Kitchen as a dedicated chopped-cheese concept.
- Crowd signal is culturally important here, but noisy; many locals treat "best chopped cheese" as a neighborhood/convenience question, not a destination-food question.

High-priority checks:

- Add Mazzy's Chopped Cheese.
- Consider Tatiana's truffle/ribeye chopped cheese only as an upscale variant, not a canonical chopped cheese.
- Run borough fieldwork for East Harlem, Bronx, Washington Heights/Inwood, and central Brooklyn bodegas.

Verdict: needs a ground-truth/crowd pass. Editorial sources alone will underrepresent the real category.

### 6. Bacon, egg & cheese

Current count: 19

Current seed read: the list is really a "destination breakfast sandwich" list. Current notes explicitly mark several entries as not default BECs: C&B, Cafe Mado, Frankel's, Sullivan Street, Thai Diner, Between the Bagel, etc.

Research signal:

- Infatuation's 2025 breakfast sandwich guide is excellent, but it covers destination breakfast sandwiches, not only BECs.
- Eater's 2025 breakfast sandwich map similarly mixes BECs and broader egg sandwiches.
- Resy and Forbes add trend/newcomer signal, including Ramen by Ra breakfast ramen and Ras Plant Based vegan BEC.

High-priority checks:

- Decide taxonomy: strict "Bacon, Egg & Cheese" or broader "Breakfast Sandwich."
- If strict BEC: emphasize Tompkins Square Bagels, Daily Provisions, Court Street Grocers, John's Deli, Greenberg's, Modern Bread & Bagel, Southside Coffee, Montague Diner, and classic bodega-style contenders.
- If broader breakfast sandwich: add Hani's Bakery & Cafe, Peck's, Edith's Sandwich Counter, Ras Plant Based, and possibly Ramen by Ra.

Verdict: good food list, but fuzzy taxonomy. This is the biggest category-cleanup issue.

### 7. Ramen

Current count: 19

Current seed read: solid: Ivan Ramen, Okiboru, Tonchin, Momofuku Noodle Bar, Ichiran, Okonomi/Yuji, Ippudo, Karazishi Botan, Shalom Japan, Chick Chick, Mr. Taka, Rockmeisha, Ramen Ishida, Afuri, Chuko, Nakamura, Nishida Sho-ten, Tabetomo, E.A.K.

Research signal:

- Infatuation's January 2026 ramen guide has Okiboru, Gogyo, Ramen By Ra, Kohoku-Ku, and Momofuku as top rated.
- Michelin's ramen guide was updated December 2025.
- Crowd signal also mentions Tonchin and Shuya as enthusiast picks.

High-priority checks:

- Add Gogyo.
- Add Ramen By Ra.
- Add Kohoku-Ku Ramen.
- Consider Marufuku Ramen if it has settled into the NYC scene post-opening.
- Consider Jeju Noodle Bar or Shuya if the category can include Korean/Japanese hybrid or enthusiast-style noodle bowls.

Verdict: strong, but add the 2026 Infatuation top-rated misses.

### 8. Soup dumplings

Current count: 22

Current seed read: strong and broad. RedFarm, Shanghai You Garden, The Bao, Dim Sum Go Go, Little Alley, 456 Shanghai, Antidote, Baodega, CheLi, DD, Din Tai Fung, Dumpling Story, Grandma's Home, Jiang Nan, Joe's Shanghai, La Salle, Mr Bun, Nan Xiang Express, Nan Xiang XLB, Pinch Chinese, Shanghai Heping, Shanghai Zhen Gong Fu.

Research signal:

- Michelin's dim sum list explicitly calls out xiaolongbao in the broader dim sum context.
- Infatuation's May 2026 dumpling guide provides a fresh citywide dumpling reference.
- Time Out's 2025 dumpling list covers soup dumplings alongside other dumpling formats.
- FoodNYC crowd signal often mentions Noodle Village, Shanghai Zhen Gong Fu, Shanghai Time, and Din's/Din's Kitchen.

High-priority checks:

- Add Noodle Village as a crowd/old-school Chinatown lead.
- Add Shanghai Time as a pan-fried/soup dumpling lead.
- Add Steam if soup dumplings remain strong there.
- Add Kung Fu Xiao Long Bao if still open and consistently praised.
- Consider whether sheng jian bao belongs in this category or a separate "pan-fried soup bun" variant.

Verdict: strong. Mostly needs a few crowd classics and variant decisions.

### 9. Dim sum

Current count: 18

Current seed read: good classic base, but misses several current Eater/Michelin names. Current includes Asian Jewels, Dim Sum Go Go, East Harbor, Little Alley, Awesum Dimsum, Bamboo Garden, Buddha Bodai, Dim Sum Palace, Dim Sum Sam, Golden Unicorn, House of Joy, Jing Fong, Nom Wah, Pacificana, Ping's, RedFarm, Tim Ho Wan, Yin Ji Chang Fen.

Research signal:

- Eater's January 2025 dim sum map adds Moon Kee, New Mulan, Hey Yuet, Long Island Dumplings, Steam, and East Harbor as major picks.
- Michelin's May 2025 dim sum guide keeps the category high-signal but narrower.
- Infatuation's dim sum guide remains a good practical group-dining reference.

High-priority checks:

- Add Moon Kee.
- Add New Mulan.
- Add Hey Yuet.
- Add Long Island Dumplings.
- Add Steam.
- Recheck whether Jing Fong's smaller post-closure format belongs at the same rank as legacy Jing Fong.

Verdict: good, but missing obvious current 2025 additions.

### 10. Tacos

Current count: 22

Current seed read: very strong. Birria-Landia, Carnitas Ramirez, Esse Taco, Los Tacos No. 1, Tacos El Bronco, Taqueria Al Pastor, Taqueria Ramirez, Cosme, Oso, Taco Mix, Taqueria El Gallo Azteca, Taqueria Sinaloense, Beto's, Border Town, Cuerno, Los Mariscos, Plaza Ortega, Santo Taco, Tacoway Beach, Taqueria El Chato, Wayne & Sons, Yellow Rose.

Research signal:

- Eater's April 2025 update specifically added Carnitas Ramirez, Esse Taco, and Birria-Landia, all already in the seed.
- Infatuation's April 2026 taco hub top-rates Taqueria Ramirez, Carnitas Ramirez, Birria-Landia, Plaza Ortega, and Taqueria Al Pastor, all already in the seed.
- Crowd signal remains split between destination places and neighborhood trucks.

High-priority checks:

- Add El Lado Taco in Astoria as a current Infatuation breakfast-taco lead.
- Add Taco Veloz as a crowd/fieldwork lead if the team wants stronger Queens/Bronx representation.
- Consider Ollin, La Morada, and other masa/antojito specialists only if their taco program is the ranked unit.

Verdict: one of the best-researched categories already.

### 11. Korean fried chicken

Current count: 5

Current seed read: too thin and too restaurant/high-end weighted. Current includes Coqodaq, Chick Chick, Ariari, Atoboy, Yetnal Tongdak.

Research signal:

- Eater's fried chicken map includes Chick Chick and discusses Korean/Nashville-style forms.
- Infatuation's April 2026 fried chicken hub top-rates Coqodaq among fried chicken spots.
- Michelin has Coqodaq as a Bib Gourmand and specifically describes the bucket feast.
- FoodNYC crowd signal points to Queens/Koreatown specialists that are not in the seed.

High-priority checks:

- Add Pelicana Chicken.
- Add Mad for Chicken.
- Add Turntable Chicken Jazz.
- Add Don Chicken and/or Mr. Dak as Queens fieldwork candidates.
- Add Yoon Haeundae Galbi if its fried chicken remains a standout.
- Add bb.q Chicken only if chain representation is desired; otherwise keep as benchmark, not seed leader.

Verdict: needs expansion before launch. Current list undersells the mainstream Korean fried chicken category.

### 12. Pho

Current count: 13

Current seed read: promising but Manhattan-heavy and modern. Ly Ly, Banh Anh Em, La Dong, Banh, Madame Vo, Mam, Pho Bang, Pho Ga Vang, Di An Di, Hello Saigon, Nha Trang One, Pasteur, Saigon Social.

Research signal:

- Time Out's 2025 pho guide is current and specifically framed by a Vietnamese phở enthusiast.
- Michelin's Vietnamese guide provides quality signal for broader Vietnamese restaurants.
- Eater's Vietnamese map points back to its pho tour and calls out outer-borough strengths.
- FoodNYC Vietnamese-food crowd threads are especially useful because many users compare NYC pho against Vietnamese-dense regions.

High-priority checks:

- Add Diem Eatery.
- Add Two Wheels for UWS modern/casual pho representation.
- Add VPho and Pizzeria as a Bronx/Sietsema fieldwork lead.
- Add Pho Hoai or Thanh Da for Brooklyn/Sunset Park/Bay Ridge representation.
- Add Pho Grand or another Chinatown classic if open/strong.
- Add Sen Saigon for vegetarian pho if the category wants non-beef variants.

Verdict: needs outer-borough balance and more traditional broth-focused anchors.

### 13. Dosa

Current count: 11

Current seed read: decent starter set: NY Dosas, Pongal, Semma, Temple Canteen, Lore, Lungi, Adyar Ananda Bhavan, Ammi, Dosa Royale, Hillside Dosa Hutt, Saravanaa Bhavan.

Research signal:

- Eater's October 2025 Indian guide calls Kanyakumari's gunpowder dosa one of the best in town.
- Eater's Semma opening review called Semma's dosa a best-in-town candidate.
- Infatuation's April 2026 Indian guide explicitly points to Temple Canteen and the iconic Washington Square Park dosa cart.
- FoodNYC South Indian threads repeatedly mention Dosa Delight, Saravanaa Bhavan, Madras Dosa Cafe, Temple Canteen, and newer openings like Annapurna Bhavan/Kidilum.

High-priority checks:

- Add Kanyakumari.
- Add Dosa Delight.
- Add Madras Dosa Cafe.
- Add Annapurna Bhavan as a 2026 fieldwork lead.
- Add Kidilum as a very new 2026 fieldwork lead.
- Keep NY Dosas and Temple Canteen as iconic casual anchors.

Verdict: underbuilt. Kanyakumari is the most obvious missing current consensus pick.

### 14. Cheeseburger

Current count: 22

Current seed read: strong. Minetta, Raoul's, Red Hook Tavern, 4 Charles, Hamburger America, J.G. Melon, Smacking Burger, Nowon, Smashed, Eel Bar, Gallaghers, Gus's, Joe Jr., Le B., Lori Jayne, Rolo's, Keens, Lord's, 7th Street, Deux Luxe, Peter Luger, Sip & Guzzle.

Research signal:

- Eater's 2025 burger map spans fancy, cheap, and smash styles.
- Eater's 2026 video feature says One White Street's cheeseburger went viral and was being called one of the best in NYC.
- Infatuation's May 2026 burger guide is fresh.
- Time Out named Deux Luxe its 2025 best burger, already in the seed.

High-priority checks:

- Add One White Street.
- Add Emily if the list wants the modern wood-fired/pizza-burger canon.
- Add Monkey Bar as a current classic/luxe burger.
- Add Lovely's Old Fashioned and Harlem Shake as no-fuss/hot-dog-burger overlap contenders.
- Add Corner Bistro and P.J. Clarke's only if historical/classic representation matters.

Verdict: strong. One White Street is the key current omission.

### 15. Steak

Current count: 22

Current seed read: strong. Cote, Gallaghers, 4 Charles, Gage & Tollner, Peter Luger, Gui, La Tete d'Or, Cuerno, Delmonico's, Golden Steer, Hawksmoor, Keens, Old Homestead, St. Anselm, The Grill, The Dynamo Room, Carne Mare, Minetta, Christos, Smith & Wollensky, Wolfgang's, Bowery Meat Company.

Research signal:

- Eater's steakhouse map was updated very recently in 2026.
- Infatuation's April 2026 steakhouse guide reinforces Gallaghers and the classic steakhouse set.
- FoodNYC crowd signal keeps Keens, Peter Luger, La Tete d'Or, Royal 35, Sparks, Strip House, and Rocco in the conversation.

High-priority checks:

- Add Sparks.
- Add Royal 35.
- Add Strip House.
- Add Benjamin Steakhouse or Benjamin Prime.
- Add Rocco Steakhouse as a Manhattan classic/crowd lead.
- Recheck Golden Steer after more NYC-specific reviews; it is notable, but new-import hype may outrun settled consensus.

Verdict: strong. Add a few classic/crowd stalwarts.

### 16. Lobster roll

Current count: 18

Current seed read: pretty good, but source base is narrower than the strongest categories. Current includes Cull & Pistol, Burger & Lobster, Essex Pearl, Fish Tales, Grand Army, Greenpoint Fish & Lobster, Jeffrey's Grocery, Lobster Place, Luke's Lobster, Lure Fishbar, Minetta Tavern, Oyster Party, P.J. Clarke's, Red Hook Lobster Pound, Smithereens, The Crabby Shack, The Fulton, The Mermaid Inn.

Research signal:

- Current seed sources are primarily Infatuation and Michelin.
- The category is seasonal/price-sensitive, and several historically famous lobster-roll places have closed or changed over time, so opening-status verification matters more than in pizza/bagels.

High-priority checks:

- Keep Red Hook Lobster Pound, Luke's, Cull & Pistol, Greenpoint Fish & Lobster, and Lobster Place as core.
- Verify Ed's Lobster Bar, Flex Mussels, Crave Fishbar, The Clam, and other seafood specialists before adding; do not assume old lobster-roll lists are still current.
- Consider splitting Maine-style vs Connecticut-style if users will compare cold mayo rolls against warm butter rolls.

Verdict: likely adequate, but needs a dedicated freshness/open-status pass.

### 17. Halal cart

Current count: 11

Current seed read: good starter set but not broad enough. Adel's, Bay Ridge Halal, Biryani Cart, Chef G, Gold Street, Indian Tasty, Royal Grill, Sammy's, Sammy's East Village, Tariq's, The Halal Guys.

Research signal:

- DoThings NYC's 2025 halal cart guide highlights Adel's and Hamza & Madina, plus Rafiqi's for citywide consistency.
- Infatuation's 2025 halal guide is broader than carts but useful for the overall halal food scene.
- FoodNYC crowd threads mention Mido's, Hamza & Madina, Kwik Meal, Royal Grill, Mahmoud's Corner, and the limits of over-ranking cart food.

High-priority checks:

- Add Hamza & Madina.
- Add Mido's.
- Add Kwik Meal.
- Add Mahmoud's Corner.
- Add Rafiqi's if citywide historical/cart-chain representation matters.
- Add Sharif's Famous as a fieldwork lead if still drawing crowd praise.

Verdict: needs cart/crowd mapping. Do not over-index on Midtown tourist lines alone.

### 18. Hot dog

Current count: 22

Current seed read: strong and broad. Crif Dogs, Dog Day Afternoon, Gray's Papaya, Katz's, Santa Salsa, Schaller's Stube, Nathan's, Rudy's, Bobbi's Italian Beef, Dyckman Dogs, NoMad Diner, Peek Inn, Skippy's, Brooklyn Diner, La Perrada de Chalo, Moritz, Old Town, PDT, Prontito, Emmett's, Kings of Kobe, Papaya King.

Research signal:

- Eater's hot dog map covers 30 standout dogs across the city.
- Infatuation's May 2026 hot dog hub top-rates Dog Day Afternoon, Dyckman Dogs, Papaya King, Lovely's Old Fashioned, Harlem Shake, and Smitty's.
- Secret NYC's 2025 list includes new/late-night Glizzy's and classics like Nathan's and Schaller's.

High-priority checks:

- Add Lovely's Old Fashioned.
- Add Harlem Shake.
- Add Smitty's Hot Dogs.
- Add Glizzy's NYC if the category wants newer late-night franks.
- Add Gotham Burger Social Club if Eater's hot-dog crawl still supports it.
- Add Sarge's if including deli-style Snap-O-Razzo.

Verdict: strong. Add the 2026 Infatuation misses.

### 19. New York cheesecake

Current count: 18

Current seed read: strong. Eileen's, Junior's, Peter Luger, La Cheesecake, Mah-Ze-Dahr, Sarge's, Veniero's, Francie, Junoon, Caputo's, Carnegie Deli, Mia's, S&S, Stu's, Cheesecake Factory, Breads, Harbs, Keki.

Research signal:

- Time Out's 2025 cheesecake list frames cheesecake as one of NYC's most iconic desserts and includes classic and new-school versions.
- Michelin and Infatuation provide broader dessert/bakery support, but Time Out is the clearest recent category-specific source found in this pass.

High-priority checks:

- Add Ferrara Bakery & Cafe for classic Italian-American cheesecake representation.
- Add Little Cupcake Bakeshop if it still has strong cheesecake signal.
- Add Martha's Country Bakery as a Queens/Brooklyn everyday cheesecake lead.
- Keep Eileen's, Junior's, S&S/La Cheesecake, Sarge's, and Veniero's as the core traditional set.

Verdict: strong, but add Ferrara/Martha's/Little Cupcake style everyday bakery coverage.

### 20. Cannoli

Current count: 21

Current seed read: strong Bronx/Little Italy/Brooklyn starter set. Gino's, Ferrara, Veniero's, Circo's, Artuso, DeLillo, Egidio, Madonia, Morrone, Caffe Palermo, Cannoli Plus, Cannoli World, Carlo's, Fortunato Brothers, Joe's Sicilian, La Bella Ferrara, La Delice, Napoli, Pasticceria Monteleone, Rocco, Zeppola.

Research signal:

- Eater best-dishes coverage in December 2025 included a nostalgic Bronx cannoli signal.
- FoodNYC crowd signal repeatedly points to Gino's, Veniero's, Circo's, Court Pastry, Villabate Alba, and Monteleone.
- This category is more neighborhood-institution driven than listicle-driven, especially Arthur Avenue, Bensonhurst, Carroll Gardens, and Little Italy.

High-priority checks:

- Add Villabate Alba.
- Add Court Pastry Shop.
- Add Royal Crown Bakery as a Staten Island/Brooklyn-Italian fieldwork lead.
- Verify Cannoli World and Carlo's; they may be less useful as "best in NYC" contenders than neighborhood bakeries.

Verdict: good, but add Villabate Alba and Court Pastry.

### 21. Ice cream

Current count: 22

Current seed read: strong. Brooklyn Farmacy, Caffe Panna, Eddie's, Malai, Morgenstern's, Salt & Straw, Sugar Hill, Chinatown Ice Cream Factory, Il Laboratorio, Julia Jean's, OddFellows, Van Leeuwen, Island Pops, Lai Rai, Mr. P's, Taiyaki, Big Gay, Ferrara, Gelateria Gentile, Glace, Sedutto, Superiority Burger.

Research signal:

- Eater's May 2026 ice cream map merged soft serve and gelato and added Mixue, Ice Cream Window, Il Laboratorio, Gelateria Gentile, Ferrara, and Superiority Burger.
- Infatuation's May 2026 guide highlights Caffe Panna, Morgenstern's, L'Albero dei Gelati, Sugar Hill, Chinatown Ice Cream Factory, Brooklyn Farmacy, and more.
- Resy 2025 and crowd threads support a wider "restaurant dessert ice cream" angle, but the current app category is likely scoop-shop oriented.

High-priority checks:

- Add L'Albero dei Gelati.
- Add Ice Cream Window.
- Add Mixue if soft serve/value belongs.
- Add Sundaes Best as a Korea-town/Asian flavor fieldwork lead.
- Add Thick if the category wants newer pint/cake-mix style shops.

Verdict: strong. Add L'Albero and Ice Cream Window first.

## Highest-priority next data additions

If only doing one batch of research updates, I would start with:

1. Black-and-white cookie: One Girl Cookies, Orwashers, Zabar's, Nussbaum & Wu, Breads, Green's.
2. Korean fried chicken: Pelicana, Mad for Chicken, Turntable Chicken Jazz, Don Chicken/Mr. Dak, Yoon.
3. Dosa: Kanyakumari, Dosa Delight, Madras Dosa Cafe, Annapurna Bhavan, Kidilum.
4. Dim sum: Moon Kee, New Mulan, Hey Yuet, Long Island Dumplings, Steam.
5. Pho: Diem Eatery, Two Wheels, VPho and Pizzeria, Pho Hoai/Thanh Da, Pho Grand.
6. Pastrami: Essen NY Deli, Sarge's, Mirage Diner.
7. Halal cart: Hamza & Madina, Mido's, Kwik Meal, Mahmoud's Corner, Rafiqi's.
8. Bacon egg cheese: first decide strict BEC vs destination breakfast sandwich.

## Source index

General/current source families:

- Eater NY guides: https://ny.eater.com/guides
- The Infatuation New York categories: https://www.theinfatuation.com/new-york
- Time Out New York restaurants: https://www.timeout.com/newyork/restaurants
- Michelin Guide New York restaurants: https://guide.michelin.com/us/en/new-york-state/restaurants

Category links used in this pass:

- Eater pizza: https://ny.eater.com/maps/nyc-best-iconic-pizza-pizzeria
- Time Out pizza: https://www.timeout.com/newyork/restaurants/best-pizza-in-nyc
- Infatuation pizza: https://www.theinfatuation.com/new-york/cuisines/pizza
- Eater bagels: https://ny.eater.com/maps/best-bagels-nyc
- Infatuation bagels: https://www.theinfatuation.com/new-york/cuisines/bagels
- Time Out bagels: https://www.timeout.com/newyork/restaurants/15-best-bagels-in-new-york-ranked
- Infatuation pastrami: https://www.theinfatuation.com/new-york/guides/best-pastrami-sandwiches-nyc
- Michelin delis: https://guide.michelin.com/us/en/article/dining-out/best-delis-nyc
- Eater sandwiches: https://ny.eater.com/maps/best-sandwich-nyc-shops
- Infatuation chopped cheese: https://www.theinfatuation.com/new-york/guides/best-chopped-cheese-nyc
- Eater Mazzy's chopped cheese: https://ny.eater.com/2024/2/14/24072171/mazzys-chopped-cheese-hells-kitchen-opening
- Infatuation breakfast sandwiches: https://www.theinfatuation.com/new-york/guides/best-breakfast-sandwiches-nyc
- Eater breakfast sandwiches: https://ny.eater.com/maps/best-breakfast-sandwiches-nyc
- Infatuation ramen: https://www.theinfatuation.com/new-york/cuisines/ramen
- Michelin ramen: https://guide.michelin.com/ca/en/best-of/best-ramen-new-york-michelin-guide
- Eater tacos: https://ny.eater.com/maps/best-tacos-nyc
- Infatuation tacos: https://www.theinfatuation.com/new-york/cuisines/tacos
- Eater burgers: https://ny.eater.com/maps/new-york-city-best-burgers-restaurants-burger-week
- Eater One White Street burger: https://www.eater.com/dining-out/949418/one-white-street-the-experts-video-best-burger-nyc
- Infatuation burgers: https://www.theinfatuation.com/new-york/cuisines/burgers
- Time Out 2025 burger: https://www.timeout.com/newyork/news/this-is-officially-the-best-burger-in-new-york-for-2025-according-to-time-out-102925
- Eater steakhouses: https://ny.eater.com/maps/best-nyc-steakhouse-classic
- Infatuation steakhouses: https://www.theinfatuation.com/new-york/guides/best-steakhouses-nyc
- Eater soup/dim sum context: https://ny.eater.com/maps/best-restaurants-chinatown-manhattan-nyc
- Michelin dim sum: https://guide.michelin.com/us/en/best-of/best-dim-sum-nyc
- Infatuation dumplings: https://www.theinfatuation.com/new-york/guides/the-dumpling-map
- Time Out dumplings: https://www.timeout.com/newyork/restaurants/best-dumplings-in-nyc
- Eater dim sum: https://ny.eater.com/maps/best-dim-sum-nyc-2024
- Infatuation dim sum: https://www.theinfatuation.com/new-york/guides/best-dim-sum-nyc
- Eater fried chicken: https://ny.eater.com/maps/nyc-fried-chicken-best/
- Infatuation fried chicken: https://www.theinfatuation.com/new-york/cuisines/fried-chicken
- Michelin Coqodaq: https://guide.michelin.com/us/en/new-york-state/new-york/restaurant/coqodaq
- Eater Vietnamese: https://ny.eater.com/maps/best-vietnamese-restaurants-food-nyc
- Eater Banh Anh Em: https://ny.eater.com/dining-report/406188/banh-anh-em-restaurant-review-nyc-vietnamese-banh-mi
- Michelin Vietnamese: https://guide.michelin.com/us/en/article/dining-out/best-vietnamese-restaurants-nyc
- Time Out pho: https://www.timeout.com/newyork/restaurants/best-pho-restaurant-nyc
- Eater Indian: https://ny.eater.com/maps/best-indian-restaurants-nyc
- Eater Semma dosa: https://ny.eater.com/2021/10/25/22739010/south-indian-restaurant-semma-opens-greenwich-village-nyc/
- Infatuation Indian: https://www.theinfatuation.com/new-york/guides/the-best-indian-restaurants-in-nyc
- DoThings halal carts: https://dothings.nyc/articles/guides/best-halal-carts-nyc
- Infatuation halal: https://www.theinfatuation.com/new-york/guides/best-halal-restaurants-nyc
- Royal Grill: https://royalhalalgrill.com/
- Eater hot dogs: https://ny.eater.com/maps/best-hot-dogs-new-york-classic
- Infatuation hot dogs: https://www.theinfatuation.com/new-york/cuisines/hot-dogs
- Secret NYC hot dogs: https://secretnyc.co/best-hot-dogs-in-nyc/
- Time Out hot dogs: https://www.timeout.com/newyork/restaurants/best-hot-dogs-in-nyc
- Time Out cheesecake: https://www.timeout.com/newyork/restaurants/the-best-cheesecake-in-nyc
- Eater ice cream: https://ny.eater.com/maps/best-new-ice-cream-shops-new-york-city
- Infatuation ice cream: https://www.theinfatuation.com/new-york/guides/the-best-ice-cream-in-nyc
- Eat This NY black-and-white cookie: https://eatthisny.com/2026/04/17/black-and-white-cookie/black-and-white-cookie-in-new-york-one-girl-cookies/
- Eater desserts: https://ny.eater.com/maps/best-desserts-nyc/
