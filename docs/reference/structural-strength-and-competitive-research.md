# Structural Strength References & Competitive/Monetization Research

Research memo, not a spec — informal reference material gathered
2026-09-04 to ground future work on
[structural-check design](../superpowers/specs/2026-08-25-wood-cad-workshop-structural-check-design.md)
(currently scoped to the pull-up bar only, MOR-based simply-supported
beam formula, one hardcoded `bendingStrength` constant) and on product/
business decisions for `wood-cad-workshop/`.

## 1. Strength/mechanics reference books

**Primary pick — authoritative data source:**

[Wood Handbook: Wood as an Engineering Material](https://research.fs.usda.gov/treesearch/download/37440.pdf)
— USDA Forest Products Laboratory, Centennial Edition, free official PDF.
The standard reference the wood-engineering world cites. Contains
species-by-species mechanical property tables (MOR, MOE, compression
parallel/perpendicular to grain, shear, hardness), moisture-content
adjustment factors, and dedicated chapters on fastener/connector design
and structural analysis. This is exactly the kind of source that should
back any future `bendingStrength`-style constant or species lookup table
(current spec explicitly notes "exact citation-grade sourcing is not
required" for the one hardcoded value — this book is where citation-grade
sourcing would come from if that changes).

**Secondary pick — practitioner intuition:**

*Understanding Wood: A Craftsman's Guide to Wood Technology* — R. Bruce
Hoadley (Taunton Press). Explains *why* wood behaves mechanically the way
it does (grain direction, moisture movement, defects, species variation)
in craftsman-accessible terms rather than raw engineering tables.
Considered the standard woodworking-world reference, complements the
Wood Handbook's data with intuition. No official free PDF found (buy or
library).

**Optional free web resources, joint-specific** (Wood Handbook covers
material properties, not joint geometry):

- [Joinery Handbook (Swedish Wood, Ed. 2:2020)](https://www.swedishwood.com/siteassets/5-publikationer/pdfer/joinery-handbook.pdf)
  — free PDF, practical dimensioning rules for softwood furniture joints.
- [BioResources journal](https://bioresources.cnr.ncsu.edu/) — open-access
  peer-reviewed papers with empirical strength data comparing joint types.
  Relevant papers found: "Strength and Stiffness Analyses of Standard and
  Double Mortise and Tenon Joints" and "Numerical Analyses of Various
  Sizes of Mortise and Tenon Furniture Joints." Useful once/if structural
  checks extend beyond the pull-up bar to general connections — e.g.
  mortise-tenon joints average ~172 lbs strength vs ~135 lbs for dowel
  joints in one cited study.
- [woodgears.ca/joint_strength](https://woodgears.ca/joint_strength/) —
  amateur-engineer empirical joint-strength tests. Not academic-grade but
  a practical sanity-check reference, frequently cited in the hobbyist
  community.

For a more formal, code-based (US NDS) approach if the project ever needs
it: *Structural Wood Design: A Practice-Oriented Approach* — Abi Aghayere.
More rigorous than this project needs today (aimed at building/structure
design, not furniture), noted for completeness.

## 2. Reference apps / competitors

Closest to this project's core mechanic — mobile-first, board-based snap
assembly with connection-point/anchor logic:

| App | Platform | Notes |
|---|---|---|
| **Moblo** | iOS/Android, free | Closest direct competitor: mobile-first 3D furniture modeling with AR preview. Magnetic snapping is bounding-box-based; users explicitly complain about lacking point-to-point (corner-to-corner) snapping — exactly the gap this project's connection-point/anchor system fills. |
| **PolyBoard** | Desktop | Cabinet/joinery-specific. Its "links" concept — a parametric connection between two parts that defines joint type (tenon/mortise/groove/hardware) — is the closest conceptual analog to this project's connection-point architecture. Worth studying if the anchor/connection system needs a richer joint-type model later. |
| **SketchList 3D** | Desktop | Woodworker-specific CAD (not general CAD like Fusion/SketchUp). Joinery options + automated cutlist/material reports, low learning curve by design. Good reference for a future cutlist/material-optimization feature. |
| **Shaper Studio** | Mobile + web | Simplified CAD for craftspeople — closest audience/positioning match. See monetization below. |
| **Shapr3D** | iPad | Professional-grade precision CAD, "desktop-grade precision on mobile" positioning. Upper-tier reference, not audience-matched but shows the ceiling. |

Other named apps (measurement/cutlist utilities, not full modelers):
WoodMaster, CutList Optimizer, Board Feet Easy Calculator — relevant only
if a cutlist/material-optimization feature is scoped later.

**Academic references** (conceptual inspiration, not implementation
guides): [Computational Interlocking Furniture Assembly (ACM TOG)](https://dl.acm.org/doi/10.1145/2766892)
and [Digital Joinery for Hybrid Carpentry (CHI 2018)](https://dl.acm.org/doi/10.1145/3173574.3173741)
— academic work specifically on parametric/interlocking joint generation,
conceptually adjacent to this project's snap-assembly mechanic.

## 3. Monetization research

- Freemium + subscription is the dominant 2026 model for consumer/
  creative apps generally (Spotify/Canva/Duolingo-style), and specifically
  for CAD-adjacent creative tools.
- **Closest comparable: Shaper Studio** — $60/year ($5/month billed
  annually), free tier capped at 3 design exports/month. Same audience
  positioning as this project (craftsperson-oriented, simplified CAD, not
  general-purpose) — the strongest direct pricing analog found.
- **Upper-tier comparable: Shapr3D** — $339/year, positioned as
  professional-grade precision on mobile. Shows a much higher price point
  is viable for a more professional/precision-focused positioning, if
  that's ever the target instead of hobbyist.
- General freemium conversion benchmarks (industry-wide, not woodworking-
  specific): visitor→free-signup 11.8–15.5%, free→paid 2.6–5.8%. Useful
  as a sanity check on revenue projections, not a woodworking-specific
  number.
- **Suggested shape for an initial model** (not a decision — flagging as
  the pattern that best matches the closest comparable, Shaper Studio):
  free tier = core modeling + capped project/export count; paid tier =
  unlimited projects, cutlist/material optimization, any future expanded
  structural-check coverage, AR/CNC export.

## Sources

- [Wood Handbook — Centennial Edition PDF](https://research.fs.usda.gov/treesearch/download/37440.pdf)
- [Understanding Wood — Amazon listing](https://www.amazon.com/Understanding-Wood-Craftsmans-Guide-Technology/dp/1561583584)
- [Joinery Handbook — Swedish Wood PDF](https://www.swedishwood.com/siteassets/5-publikationer/pdfer/joinery-handbook.pdf)
- [BioResources — Strength and Stiffness Analyses of Standard and Double Mortise and Tenon Joints](https://bioresources.cnr.ncsu.edu/resources/strength-and-stiffness-analyses-of-standard-and-double-mortise-and-tenon-joints/)
- [woodgears.ca joint strength testing](https://woodgears.ca/joint_strength/)
- [Structural Wood Design — Aghayere, Amazon listing](https://www.amazon.com/Structural-Wood-Design-Practice-Oriented-Approach/dp/0470056789)
- [Moblo — App Store](https://apps.apple.com/us/app/moblo-3d-furniture-modeling/id1549380017)
- [PolyBoard — product page](https://www.boole.eu/polyboard.php)
- [SketchList 3D](https://sketchlist.com/)
- [Shaper Studio pricing](https://www.shapertools.com/en-us/blog/studio-price-changes)
- [Shapr3D furniture design content](https://www.shapr3d.com/content-library/furniture-design-software)
- [Computational Interlocking Furniture Assembly (ACM TOG)](https://dl.acm.org/doi/10.1145/2766892)
- [Digital Joinery for Hybrid Carpentry (CHI 2018)](https://dl.acm.org/doi/10.1145/3173574.3173741)
- [Freemium monetization strategy overview — adapty.io](https://adapty.io/blog/freemium-app-monetization-strategies/)
