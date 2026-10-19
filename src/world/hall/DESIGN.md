# PR Cauldron Hall: hall design

## Concept and mood

The great hall of a scholar alchemist's keep at night. Warm candle gold and firelight fill the room, with cold moonlit blue coming through the windows. The materials are old dressed stone, dark oak, brass and gilt, and wrought iron.

The magic is quiet and deliberate. Nothing floats at random: every moving thing has a job or a path. Books fly a slow loop under the roof, a quill writes by the painting, a ladle stirs the hearth pot, a duster tidies a shelf, and candles circle the chandeliers they belong to.

Readability comes first. The four stage zones, their names and their PR counts must read from anywhere in the hall. The floor under the cauldrons stays plain stone with no coloured rugs.

Fixed by layout.ts and not changed here: hall size 25 m x 24.4 m x 9 m walls, the four zones at x = -8.25, -2.75, 2.75 and 8.25, cauldron stations near z 6 and 2.6, the door at z 18, the walkable floor and collisions. New floor-level objects stand against the walls. Nothing new goes inside a zone below 4.5 m.

## Palette (2 to 3 shades per colour)

| Family | Light | Mid | Deep |
| --- | --- | --- | --- |
| Stone | #8a7f73 | #6d645b | #4a433d (mortar #24201c) |
| Oak | #a07450 | #5a3c26 | #21150d |
| Gold and brass | #f0cf7a | #d9a743 | #8a6420 |
| Iron | #5a5a62 | #34343a | #1a1a1e |
| Moonlight | #cfd8ff | #7d93e0 | #1b2546 |
| Candle and fire | #fff4d6 | #ffb347 | #ff6a1f |
| Violet magic | #c7a6ff | #9b6bff | #4a2e6b |
| Emerald magic | #7dffc0 | #2fe07a | #1d3d2a |
| Cloth (tapestries) | #c9a24a gold thread | #5a1f2a burgundy | #1a2446 midnight |

Stage colours stay as the theme defines them, each with a glow tint and a deep field:

| Stage | Glow | Banner | Deep |
| --- | --- | --- | --- |
| Draft | #d6dade | #6b6f76 | #33363b |
| Review | #8fb0ff | #24448f | #13244d |
| Changes | #ff8f8f | #9c1c28 | #4a0c13 |
| Approved | #8fe6ad | #1f7a45 | #0e3b21 |

## Motifs and runes

- **The Keep's seal:** a ring holding a four-point star, one point per stage, with a crescent in the top quarter. It appears on the entrance floor inlay, the chimney breasts, the bookcase pediments and the tapestries.
- **Lozenge chain:** diamonds joined by small roundels. It runs on the wall frieze and the floor border.
- **Runes:** glyphs built from a vertical stem with one to three branches, arcs or dots (`drawRune`). They are never letters of a real script.
- **Stage sigils:** the seal's star with one point lit in the stage colour, plus a stage mark. Draft is an open ring (unformed), Review is an eye-shaped lozenge, Changes is a broken ring crossed by a bar, Approved is a closed ring with a lit star.

## Zone by zone

### Entrance (front wall, z 18)
- Oak double door inside a pointed stone portal arch with a carved seal in the tympanum.
- Two tapestries with the seal flank the door at x = ±6. The owls on their perches (±2.8), the barrels and the crate stay where they are.
- On the floor between the door and the front corridor (z 10.5 to 16.5) sits a large inlaid seal in two stone tones with brass lines. It is a carved inlay, not a rug, and it glows only faintly.

### Side walls (x = ±12.5)
- Bottom to top: a plinth moulding, then oak wainscot panelling to 1.8 m (raised panels, base rail, cap rail), then a stone string course at 2.72 m just above the window sills, then the upper ashlar, then the carved lozenge frieze under the top moulding.
- Each 6 m bay has a carved bookcase under a pointed-arch window with a stone hood mould and keystone.
- Clustered gothic pillars (a main shaft with four colonnettes, a moulded base and a carved capital) separate the bays. Each carries an iron sconce torch on its inner face.
- Moonlight shafts fall through the windows on the moon's side (-x), with dust in them.

### Back wall (z = backZ)
- In the centre: a large gilded, carved frame holding an original painting. It shows a moonlit keep on a cliff with a robed wizard raising a glowing staff. It is a living portrait: clouds drift and a star twinkles.
- Under the painting: a stone console with an open book and a floating quill that writes glowing script in the air.
- At ±4.4: potion shelves (kept as they are).
- At ±8.2: rebuilt hearths (see below).
- At ±11.2, the outer corners: tapestries.
- Low fog gathers along the back of the hall.

### Ceiling
- A closed timber roof following the 3.2 m pitch, replacing the open sky.
- Oak trusses at every pillar have:
  - a tie beam with chamfered edges and gilded pendant bosses;
  - a king post and two queen posts;
  - curved arched braces springing from the pillar capitals, with a gilded pendant where each brace meets the tie beam.
- Purlins run the length of the hall, with a ridge beam at the top. Cross ribs halfway between trusses divide each slope into coffers about 3 m square.
- Each coffer is a recessed panel painted as a night sky: deep navy, faint stars, gilt eight-point stars and thin gold constellation lines. The panels glow faintly, so the roof reads in the dark.
- A gilded rosette boss sits at every place where a rib crosses a purlin.
- Masonry gables close the roof at both end walls, each with a round rose window of leaded, moonlit glass.
- The four chandeliers hang on chains from the tie beam at z 5.4, one over each zone. Each has a ring of six candles slowly circling it at 1.7 m radius.
- Two flights of open books flap along slow oval loops at about 7 to 7.6 m: six over the entrance (centre z 12, half-axes 8 by 4) and four over the back of the hall (centre z backZ + 2.9, half-axes 7.5 by 1.7). Both loops stay more than a metre clear of the chandeliers, their candle rings, the crests and the tie beams.

### Stage areas
- The floor stays plain stone. Thin inlaid stone lane lines (no colour) at x = 0 and ±5.5 separate the zones.
- A small brass sigil sits at each zone's front edge (z 8.4) and glows in the stage colour. It is lines only, 0.55 m radius.
- Each zone's sign is a heraldic crest hung on chains from the roof truss behind the zone (z -0.6), 5.6 m up. It has a gilt-rimmed shield in the stage colour with the PR count in large gilded numerals, and a gilded scroll below with the stage name and its plain meaning. It is drawn in a canvas texture inside the scene, not as DOM, so it always renders, reads from across the hall, and can be clicked to jump to the zone.

## Lighting plan

Real lights (kept to ten point lights, because each one adds to every lit shader):
- The moon: a directional light from -x above. The hall renders with no shadow maps; contact shadow decals ground the furniture instead.
- Ambient light plus a hemisphere light (cool sky, warm ground).
- Four chandelier point lights (warm, gentle flicker).
- Four torch point lights (every other torch, stronger flicker).
- Two hearth point lights (strong flicker) that play on the floor and the walls nearby.

Faked glows (additive billboards and emissive surfaces, no light cost):
- Candle, torch and hearth flames, each with a halo.
- The hearth's warm glow on the floor (a flickering decal).
- Potion inner glows and coloured light pools on the shelves; orbs and crystals.
- Runes on the bookcases, the floor border and the zone sigils; moonlight shafts.
- The crest numerals (a gentle flicker), the painting's staff glow and star twinkle.

## Objects

- **Chandeliers (keep):** gold and silver frame with crystal strands, glints, sparkles and wall caustics. New: the circling candle ring replaces the random floating candles.
- **Torches (keep):** iron sconces with magic outer flames and a warm core, sparks and smoke.
- **Potions (keep):** the varied glass, glowing liquids, labels and spills stay as they are. Small potion sets also appear on the bookcases and the mantels.
- **Bookcases (richer):** carved side panels with inset arches, a pediment with the seal medallion, deeper shadow in each compartment and brass bookends. More spine designs with raised bands, tall folios on the bottom shelf and small books on top. Brass shelf label plates and a rolling ladder on one bookcase per side. Charms: a feather duster tidying a top shelf, and one book per case that slides itself out and back.
- **Hearths (rebuilt):**
  - The stone surround has jambs, a carved lintel and a mantel shelf on scroll corbels, under a chimney breast to the roof with a carved seal.
  - The firebox is open and has depth: a soot-dark back, angled cheeks, a throat and a raised apron.
  - The fire sits on an iron grate with andirons, burning split logs with bark and glowing ends. Layered flames, rising embers and smoke go up into the flue.
  - The left hearth has a crane-hung pot with a self-stirring ladle and steam.
  - Mantel props: candlesticks, an hourglass, small potions and a framed ink sketch.
- **Atmosphere:** wainscot, string course, frieze and pillars give the walls depth. The floor has patterned flagstones with wear, the border with runes, the entrance seal and the lane lines. Moonlight shafts, dust motes and sparkles fill the air, low fog lies along the walls and at the back, and soft contact shadows ground the furniture.

## Performance rules

- Repeated parts share geometry and materials and are merged or instanced. Each object type adds only a handful of draw calls.
- The point light count is fixed at ten, with no transmission. Glass is alpha-blended with fresnel edges.
- Animated charms move a few instances on the CPU (fewer than 200 matrices a frame). Particles animate on the GPU from a shared clock.
