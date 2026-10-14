# Culture & Taste Daily — Culture Intelligence Source Map

Status: **proposed operating map for research and dry runs**

This document governs factual culture-and-taste research. It is separate from `docs/REFERENCE_SYSTEM.md`, which governs visual and interaction references after the editorial problem is locked.

A publication may appear in both systems for different reasons. An article can support a factual story only when its claims are verified under this map. A project page can teach a design principle only when it passes the detail-evidence rules in the reference system. Neither use authorizes the other.

This is a maintained radar, not a closed whitelist. A source's presence here never makes every article trustworthy, independent, non-commercial, current, or suitable for publication.

## 1. Editorial objective

Culture & Taste should notice more than headline fashion news. The candidate pool must be capable of finding:

- runway collections and changes in fashion language;
- streetwear, sneakers, collaborations, drops, and small breakout objects;
- exhibitions, art fairs, museums, galleries, artist-run spaces, and public art;
- architecture, interiors, retail spaces, hospitality, graphic design, and publishing;
- music, film, photography, books, magazines, beauty, fragrance, and image culture;
- city scenes, local subcultures, community rituals, and changing habits;
- cultural shifts that connect several objects or events without pretending that every popular post is a trend.

The finished issue is not a feed recap or a list of achievements. Research breadth exists so the editor can make a narrower, more interesting, truthful issue.

## Historical baseline from the handoff originals

The 2026-08-20 to 2026-08-22 originals already reached beyond one fashion-news feed. They combined brand and product sources such as Nike and On; editorial sources such as Dazed, Hypebeast, Vogue, ELLE, Pitchfork, The Guardian, and T3; official cultural and event sources such as HKTDC, SFMOMA, museums, galleries, charities, and exhibition organizers; and city-specific material from Los Angeles, Durham, Sydney, San Francisco, and other local contexts.

That breadth should be preserved. The weakness was not a lack of names. The system still needed a consistent way to distinguish announcement from independent reporting, article date from event date, repeated coverage from a new event, commercial material from editorial evidence, and a visually strong signal from a genuinely important story. This map formalizes those missing decisions rather than discarding the earlier source base.

## 2. Evidence tiers

Record a tier for each exact URL, not only for the publisher.

### P0 — Primary fact source

Use for names, dates, status, locations, participants, availability, and the subject's own stated rationale:

- brand newsroom, product page, lookbook, or official store;
- designer, artist, label, gallery, museum, fair, festival, or organizer page;
- official fashion-week calendar;
- government, venue, regulator, court, or public-institution record;
- direct interview or creator-authored case statement when provenance is clear.

A P0 page proves what that subject announced or published. It does not independently prove impact, quality, public reception, cultural importance, scarcity, sustainability, or commercial success.

### P1 — Strong independent editorial source

Use for original reporting, interviews, criticism, context, scene knowledge, and competing interpretation. Independence is assessed per story. A bylined article can still be promotional, affiliate-led, embargoed, or based only on a press release.

### P2 — Local or specialist source

Use for language, local access, emerging designers, city context, niche objects, and developments that global publications miss. Verify the original reporting, masthead, commercial label, and source chain before treating it as independent.

### P3 — Community and discovery signal

Use direct posts, comments, community pages, social search, newsletters, resale observations, and user-made documentation to discover language and behavior. P3 can support a bounded claim about the observed community. It cannot be the sole source for release status, accusations, safety, legal facts, death, attendance, sales, or a population-wide trend.

### Do not count as evidence

- a search-result snippet, AI summary, or cached headline;
- an unattributed repost or screenshot without the original account and date;
- an inaccessible preview whose article was not opened;
- a gallery, ranking, tag, or homepage alone;
- several articles that all repeat the same press release;
- the same publisher, parent group, syndication network, or translated article presented as multiple independent sources.

## 3. Core source families

The routes below are seed entrances. Open the exact detail page used for each candidate and record access time and limits.

### 3.1 Brand and drop confirmation

| Source family | Seed route | Best use | Required caution |
| --- | --- | --- | --- |
| Supreme | <https://us.supreme.com/> | Official news, previews, lookbooks, drop confirmation | Official status only; add independent context before claiming wider impact |
| Palace | <https://www.palaceskateboards.com/> | Current range, lookbook, collaboration, regional shop signal | Commerce page is not cultural reception evidence |
| Nike | <https://about.nike.com/en/newsroom> | Product, collaboration, campaign, innovation, official media | Marketing and performance claims need independent checking |
| adidas | <https://news.adidas.com/> | Product, Originals, partnership, release date, official assets | Separate newsroom fact from editorial interpretation |
| On | <https://press.on-running.com/> | Product, collaboration, retail, innovation, official timing | Company claims and modeled impact require source and method checks |

Extend this family dynamically to the official page of any relevant brand, store, label, designer, artist, or collaborator. The maintained radar at `automation/brand-radar.json` preserves the owner-selected subjects that must be revisited over time; it is a rotational discovery registry, not a whitelist and not a requirement to publish brand news. A Hypebeast or social post about a release triggers an official-page check first.

#### 3.1.1 Maintained brand-and-culture radar

The public registry separates a durable research obligation from any personal social-media account. It contains the established taste anchors and the newly requested streetwear, Japanese, Korean, Greater China, European, luxury, sport, outdoor, retail, and cultural subjects.

Operating rules:

- every candidate day performs a lightweight official-signal check across the complete active registry, then `npm run daily:preflight` chooses one deterministic cohort for a deeper detail-page review;
- the daily public radar must attest the complete-registry quick scan, the exact deep-review cohort, the required standing beats, all five regional lanes, and the prior-two-issue deduplication window; the attestation gate applies from 2026-08-27;
- a radar entry means “check for a relevant new official signal,” not “write about this subject”;
- official brand, designer, retailer, event, or archive pages may establish only subject-originated facts under P0;
- cultural impact, reception, breakout status, or trend claims still require independent or direct community evidence appropriate to the claim;
- the scan must resolve and open the current official detail route rather than treating a saved name, social profile, homepage, or search snippet as evidence;
- Instagram login and social following are not part of the research contract and must never become runtime dependencies;
- missing, renamed, ambiguous, inactive, or compromised identities are recorded as access limits and held until reverified;
- “Daisy” remains excluded from the active rotation until its exact brand and official source identity are supplied; the system must not guess which subject was intended.

### 3.2 Fashion calendars and runway authority

| Region | Primary calendar | Role |
| --- | --- | --- |
| New York | <https://cfda.com/home/nyfw/> | Official NYFW schedule authority |
| London | <https://londonfashionweek.co.uk/> | British Fashion Council schedule and official program |
| Paris | <https://www.fhcm.paris/> | Paris Fashion Week and Haute Couture official calendars |
| Milan | <https://www.cameramoda.it/> | Camera Nazionale della Moda Italiana calendar |
| Shanghai | <https://www.shanghaifashionweek.com/> | Shanghai Fashion Week schedule and program |
| Tokyo | <https://jfw.jp/> | Rakuten Fashion Week TOKYO schedule |
| Taipei | <https://www.moc.gov.tw/> | Ministry of Culture announcements; follow through to the current Taipei Fashion Week program |
| Seoul | <https://english.seoul.go.kr/> | Seoul Metropolitan Government announcements and current schedule |

The Fashion Council Germany international calendar may be used to discover dates across markets: <https://www.fashion-council-germany.org/en/international-fashion-week-calendar>. It is an aggregator. Confirm every selected date with the responsible local council or organizer.

### 3.3 Global fashion, streetwear, and youth culture

| Source | Seed route | Editorial role | Commercial / evidence note |
| --- | --- | --- | --- |
| Dazed | <https://www.dazeddigital.com/> | Youth culture, radical fashion, art, music, film, politics, and ideas | Strong discovery and features; verify exact facts and distinguish Dazed Studio or partnerships |
| Hypebeast | <https://hypebeast.com/> | Fast fashion, footwear, art, design, music, lifestyle, and drop discovery | Publishing, agency, and commerce coexist; `Presented by` is promotional and not independent evidence |
| Highsnobiety | <https://www.highsnobiety.com/> | Style-led youth culture and fashion/lifestyle interpretation | Publishing and commerce can overlap; inspect labels and links |
| Vogue / Vogue Runway | <https://www.vogue.com/fashion-shows> | Collection record, review, designer change, runway context | Prefer official calendar/house for status and Vogue for independent viewing/context |
| AnOther | <https://www.anothermag.com/> | Fashion, photography, art, literature, and longer-form cultural context | Record `In Partnership` separately from independent editorial |
| SHOWstudio | <https://www.showstudio.com/> | Fashion film, live creative process, runway analysis, image-making | Project and uploaded press materials require provenance checks |

Treat different Hypebeast locales, Dazed editions, or Condé Nast editions as useful regional lenses, not automatically independent confirmation of one syndicated fact.

### 3.4 Art, exhibitions, architecture, and design

| Source | Seed route | Editorial role | Evidence note |
| --- | --- | --- | --- |
| Art Basel | <https://www.artbasel.com/events> | Fair and participating-institution discovery | Confirm selected exhibitions with the institution or gallery |
| Frieze | <https://www.frieze.com/fairs> | Fair programs plus art criticism and features | Separate fair promotion from independent Frieze editorial |
| La Biennale di Venezia | <https://www.labiennale.org/> | Official art, architecture, cinema, dance, music, and theatre programs | Use independent reporting for disputes or reception |
| e-flux | <https://www.e-flux.com/announcements> | Global institutional announcements, open calls, and exhibition discovery | Announcements commonly originate with institutions; not independent corroboration |
| The Art Newspaper | <https://www.theartnewspaper.com/> | International art reporting, policy, market, museums, disputes | Check ownership, dates, named sources, and corrections on sensitive stories |
| Wallpaper* | <https://www.wallpaper.com/> | Architecture, design, art, fashion, beauty, travel, objects | Affiliate and commercial relationships must be recorded |
| Dezeen | <https://www.dezeen.com/> | Architecture, interiors, design, technology, city and object signals | Confirm projects with architect/designer/client when used as fact authority |
| designboom | <https://www.designboom.com/> | Early project discovery across architecture, design, art, and technology | Reader submissions and press-release material require explicit source-chain checks |

For an exhibition, the museum, gallery, organizer, or artist page remains the P0 record. Useful regional primary routes include UCCA <https://ucca-group.com/exhibitions/>, Power Station of Art <https://www.powerstationofart.com/whats-on/exhibitions>, M+ <https://www.mplus.org.hk/en/exhibitions/>, and Taipei Fine Arts Museum <https://www.tfam.museum/>. If a JavaScript-only calendar cannot be read, use an equivalent official press release or government listing and record the limitation.

### 3.5 Music, film, books, and image culture

Start with the artist, label, publisher, distributor, festival, cinema, photographer, or venue page. Add an independent specialist source appropriate to the claim, such as Pitchfork for recorded music, a festival's accredited program and criticism for film, or AnOther/Dazed/SHOWstudio for photography and moving-image culture.

Charts, ticketing pages, streaming counts, bestseller lists, awards, and resale prices each measure a narrow behavior. Record the market, window, method, and timestamp; do not turn one metric into a general claim that something “defines the culture.”

## 4. Regional radar

Global coverage does not mean translating only London and New York. Before editorial lock, scan the following lanes. This is research coverage, not a publication quota.

### 4.1 Required daily scan lanes

1. Mainland China plus at least one of Hong Kong or Taiwan.
2. Japan or Korea, alternating emphasis when both cannot be reviewed deeply.
3. Continental Europe or the United Kingdom.
4. United States or Canada.
5. One rotating lane: Southeast Asia, South Asia, MENA, Africa, Latin America, or Oceania.

An issue may publish zero stories from a scanned lane when the evidence or editorial relevance is weak. Record the empty result; do not insert a token regional story.

### 4.2 Regional editorial seeds

| Region | Sources | Best use and boundary |
| --- | --- | --- |
| Mainland China / Chinese language | Hypebeast CN <https://hypebeast.cn/>, Vogue China <https://www.vogue.com.cn/> | Localized discovery and interviews; trace translations, syndication, and press-release origins |
| Hong Kong | M+ <https://www.mplus.org.hk/>, Hypebeast/HBX local reporting, organizer and venue pages | Design, visual culture, retail, art, and city-specific events; keep editorial and group commerce separate |
| Taiwan | Vogue Taiwan <https://www.vogue.com.tw/>, VERSE <https://www.verse.com.tw/>, La Vie <https://www.wowlavie.com/>, TFAM <https://www.tfam.museum/> | Fashion, design, exhibitions, city culture, public issues; label branded projects and verify organizers |
| Japan | FASHIONSNAP <https://www.fashionsnap.com/>, WWDJAPAN <https://www.wwdjapan.com/>, POPEYE Web <https://popeyemagazine.jp/>, JFWO <https://jfw.jp/> | Fast fashion news, business, street/object signals, everyday city culture; preserve `PROMOTION` and commerce labels |
| Korea | Dazed Korea <https://dazedkorea.com/>, Seoul Fashion Week via <https://english.seoul.go.kr/>, brand and institution pages | Fashion and youth culture plus official schedule; cross-check celebrity-driven reach claims |
| MENA | Dazed MENA <https://www.dazed.me/>, Art Dubai <https://www.artdubai.ae/>, local institution and designer pages | Regional fashion, art, film, and youth culture; do not flatten distinct countries into one scene |

The map must grow through reviewed source cards. A new regional source is accepted only after recording ownership or masthead, editorial scope, language, access behavior, commercial labeling, original-reporting evidence, correction path, and known limits.

### 4.3 Paused and recheck-only sources

The Face <https://theface.com/> is not an active daily source as of the 2026-08-24 check: its public route displays a return notice rather than accessible current articles. Keep it in the source-health registry as `paused`, not in the daily scan, until a future check confirms that detail-level editorial access has returned.

## 5. Category lanes

Tag every candidate with one primary category and optional secondary categories:

```text
fashion_runway
streetwear_sneakers
drop_object
art_exhibition
design_architecture
retail_space_hospitality
music_sound
film_moving_image
photography_publishing
beauty_fragrance
city_local_scene
subculture_community
collaboration_campaign
cultural_behavior_shift
technology_culture
```

Category variety is checked across the candidate pool and recent issues. It is not achieved by relabeling several fashion collaborations as different categories.

## 6. Candidate record contract

Candidate records are private. They must not be committed to the public repository or included in a Pages artifact.

```text
candidate_id:
canonical_event_id:
headline_working:
primary_category:
secondary_categories:
regions:
subjects:
source_url:
source_publisher:
source_family:
source_tier: P0 | P1 | P2 | P3
source_relationship: subject | independent | partner | sponsor | affiliate | syndication | community | unknown
published_at:
event_at:
accessed_at:
access_status: verified | partial | unavailable
official_status: rumor | teaser | announced | preorder | released | opened | ongoing | closed | cancelled | disputed
established_facts:
source_stated_rationale:
editorial_inference:
independent_verification:
contradictions:
commercial_label:
image_origin:
image_origin_relationship: first_party_official | independent_media | community
official_image_verified_at:
image_credit:
image_usage_rights_basis:
access_limits:
evidence_confidence: high | medium | low | blocked
editorial_weight: cover | major | signal | watch | omit
selection_reason:
rejection_or_hold_reason:
```

Credit and usage-rights basis are different fields. A visible photographer credit does not grant publication rights.

## 7. Event-level deduplication

Deduplicate by event, not by article title.

- One brand release reported by Supreme, Hypebeast, a local edition, and several repost accounts is one event.
- A new colorway and the later general release are one event unless the availability or cultural consequence materially changes.
- A runway announcement, show, critical response, and retail release can be separate stages, but each must state what is new.
- A touring exhibition at a new city can be a new event when the local curatorial or public context changes.
- An old event re-enters only with a material update, correction, new access, consequence, or changed status.

Preserve all supporting URLs inside the private record while choosing one canonical event ID and one primary public link.

## 8. Confidence and editorial weight are separate

### 8.1 Evidence confidence

- `high`: the exact claim is supported by accessible P0 evidence and, where the claim requires it, an independent source.
- `medium`: the core fact is supported, but reception, scope, access, translation, or a secondary detail remains limited.
- `low`: useful discovery signal with unresolved origin, access, status, or independence. It cannot become cover or major.
- `blocked`: contradiction, inaccessible critical evidence, rights failure, unsafe claim, or unsupported allegation prevents publication.

### 8.2 Editorial weight

- `cover`: the issue's strongest live cultural tension; specific, consequential, visually and editorially supportable, and not merely famous.
- `major`: deserves a developed story because it changes how a scene, object, place, practice, or audience can be understood.
- `signal`: concrete and verified, but still narrow, early, or unable to support a large conclusion.
- `watch`: dated future event, partial-access lead, or emerging pattern that should be checked again.
- `omit`: duplicate, old, promotional without editorial value, irrelevant, unsafe, untraceable, or unsupported.

Ordering rule:

```text
truth and evidence
→ cultural consequence
→ specificity and timeliness
→ connection to the issue's position
→ category and geographic contribution
→ visual potential
```

A beautiful image, famous logo, high view count, or resale price can never move an item ahead of weak evidence.

### 8.3 Cover and major gate

By default, `cover` and `major` require:

- at least one accessible P0 source;
- at least one genuinely independent source when the story makes a claim beyond the announcement itself;
- dates and official status checked on the day of lock;
- commercial relationships recorded;
- a stated cultural consequence and counter-reading;
- at least one exact, story-specific image verified from a first-party official source;
- a separately recorded image usage-rights basis; unknown rights may support only the linked, production-blocked Preview treatment.

If the independent source is not available, narrow the claim and downgrade to `signal` or `watch`.

## 9. Trend and breakout-object gate

Do not call a single launch, celebrity wear, sold-out page, resale spike, or viral post a trend.

A `cultural_behavior_shift` needs:

- a precisely described behavior, object, phrase, silhouette, ritual, or distribution change;
- multiple direct observations that are not copies of one campaign;
- at least two source or community contexts;
- a defined region, audience, and time window;
- at least one alternative explanation such as paid seeding, platform recommendation, scarcity, fandom, or a seasonal event;
- language no broader than the evidence.

A small breakout object can enter as `signal` with one verified product source and direct community evidence. It becomes `major` only when independent context shows why the object carries meaning beyond short-lived attention.

## 10. Sensitive, disputed, and harmful-news gate

Apply this gate to death, grief, conflict, war, identity-based harm, community trauma, abuse, safety incidents, legal allegations, political disputes, cultural appropriation disputes, cancellation, or claims that can materially harm a person or community.

Required handling:

- use at least two independent reporting subjects plus a primary or official record where one exists;
- verify article time, event time, current status, corrections, and exact wording;
- distinguish allegation, filing, investigation, finding, judgment, apology, withdrawal, and rumor;
- preserve disagreement and relevant power relationships;
- do not aestheticize harm or select the story because the imagery is dramatic;
- do not use AI-generated documentary imagery;
- require named human editorial review before publication;
- omit the item when the public-interest case is weaker than the harm or uncertainty.

An official denial and an official accusation are two positions, not two independent confirmations.

## 11. Commercial and sponsored-content handling

Record visible labels such as `Presented by`, `In Partnership`, `Promotion`, `Advertorial`, affiliate disclosure, shop link, or group-commerce relationship.

- Sponsored content can confirm that a campaign or collaboration was presented, but it is not independent evaluation.
- A newsroom, agency, shop, and editorial title owned by one group are separate products but not automatically separate evidence subjects.
- Product roundups with affiliate links may be useful for discovery; verify releases independently.
- A press release reproduced with light editing remains subject-originated evidence even when published by a media outlet.
- Never hide the commercial relationship in the private ledger or use promotional superlatives as Culture & Taste judgment.

POPEYE's visible `PROMOTION` labels and Hypebeast's `Presented by` labels are examples of metadata the collector must preserve.

## 12. Daily scan and verification sequence

### Pass A — Primary radar

Check official calendars, institutions, brands, designers, artists, labels, venues, and organizers for the defined time window.

### Pass B — Independent editorial radar

Check global fashion/culture, art/design, and relevant specialist publications. Open detail articles; never select from a homepage headline alone.

### Pass C — Regional radar

Complete the five required scan lanes. Use original-language search when practical and record translation limits.

### Pass D — Community radar

Look for direct evidence of use, styling, remix, queueing, collecting, criticism, refusal, or local language. Treat algorithms and paid seeding as possible explanations.

### Pass E — Normalize and deduplicate

Create canonical event IDs, merge repeated coverage, separate article date from event date, and resolve release status.

### Pass F — Verify and weight

Assign confidence first, then editorial weight. Run the trend gate or sensitive-news gate where applicable. An item that fails verification is narrowed, held, or omitted.

### Pass G — Lock the issue

Choose the smallest set that can support a clear editorial position and a varied reading rhythm. Record why each selected item belongs in this issue now.

## 13. Pre-draft research gate

Before writing begins, all answers must be `PASS`:

```text
research window and Asia/Shanghai cutoff recorded: PASS | FAIL
required regional lanes scanned or explicit access failure recorded: PASS | FAIL
candidate pool spans more than one real category: PASS | FAIL
selected events deduplicated: PASS | FAIL
every selected fact opens to supporting evidence: PASS | FAIL
official status and dates checked: PASS | FAIL
source relationships and commercial labels recorded: PASS | FAIL
fact / source rationale / editorial inference separated: PASS | FAIL
sensitive or trend gates completed where applicable: PASS | FAIL
image credit and usage-rights basis separated: PASS | FAIL
first-party official image verified for every selected story: PASS | FAIL
cover and major evidence gates passed: PASS | FAIL
```

Any `FAIL` is corrected before drafting. Fewer stories are valid. Unsupported completeness is not.

## 14. Source-health maintenance

Maintain the private source registry separately from issue ledgers:

```text
source_name:
canonical_route:
regions:
categories:
ownership_or_masthead:
languages:
original_reporting_notes:
commercial_labels:
access_pattern:
paywall_or_login:
rss_or_newsletter:
correction_path:
last_checked_at:
last_success_status:
known_limits:
```

Review high-frequency sources monthly and the full map quarterly. A source that becomes inaccessible, heavily syndicated, undisclosed advertising, unreliable, or abandoned is downgraded or removed. Do not let one platform failure stop the run; use an equivalent P0 or regional source and record the substitution.

## 15. Publication boundary

The private ledger can retain rejected candidates, contradictions, access notes, community observations, and rights evidence. The public issue manifest contains only publishable provenance and limitations.

The public repository and Pages artifact must not contain:

- private source-ledger or source-health instances;
- screenshots collected only for research;
- paywalled article copies or copyrighted media archives;
- private community identities or unnecessary personal data;
- internal weighting notes, accusations under review, or rejected rumors;
- credentials, cookies, API keys, or access workarounds.

Public sources and captions must remain useful without exposing the private research system.
