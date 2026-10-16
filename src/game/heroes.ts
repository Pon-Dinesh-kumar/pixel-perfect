/**
 * Authoritative SCENE roster: 20 original heroes. Every screen (collection, detail, deck, battle)
 * reads hero identity, stats, passive and skill links from here.
 * Tamil heroes (Tamil Nadu): ARUVI, KAVIN, MEENAL, SENTHIL, THAMARAI.
 */
export type HeroId =
  | "aruvi" | "yuki" | "amara" | "liwei" | "kofi" | "ella" | "diego" | "aisha" | "kavin" | "sara"
  | "kimi" | "meenal" | "fatima" | "senthil" | "thabo" | "mei" | "andres" | "zara" | "thamarai" | "sakura";

/** Passive kinds. All read BASE power / board layout only, so nothing accumulates or double-counts. */
export type PassiveKind =
  | "momentum"    // +N if another friendly card is on this carrier
  | "disruptor"   // each enemy card here -N
  | "sentinel"    // +N while rival base power here is higher than yours
  | "lonewolf"    // +N if this is your only card here
  | "center"      // +N in the middle slot
  | "rally"       // every OTHER friendly card here +N
  | "rear"        // +N in the rear (outer) slot
  | "crusher"     // enemy cards here costing 2 or less get -N
  | "lateTide"    // +N from turn 4 onwards
  | "pack"        // +N if you have 3 cards here
  | "overclock"   // +N if a friendly card costing 4+ is here
  | "outnumbered" // +N if the rival has more cards here than you
  | "contested"   // +N if the rival has at least one card here
  | "shoreline"   // +N if the rival has no cards here
  | "resonance"   // +N per other friendly card here
  | "front"       // +N in the front (inner) slot
  | "lane"        // +N on a specific carrier (param = carrier index)
  | "mirage"      // the strongest enemy card here gets -N
  | "tailwind"    // +N if a friendly card is in an adjacent slot
  | "nurture";    // other friendly cards here costing 2 or less get +N

export interface Passive {
  kind: PassiveKind;
  name: string;
  text: string;
  /** When it applies, in plain words. */
  trigger: string;
  targets: "self" | "allies" | "enemies";
  timing: "continuous";
  amount: number;
  param?: number | undefined;
}

export interface Look {
  face: string; skin: string; eyes: string; hair: string; build: string;
  costume: string; accessories: string; focus: string; culture: string; palette: string;
}

export interface HeroDef {
  num: number;
  id: HeroId;
  name: string;
  nation: string;
  inspiration: string;
  archetype: string;
  quote: string;
  description: string;
  cost: number;
  power: number;
  /** Main accent colour (0xRRGGBB). */
  color: number;
  passive: Passive;
  /** Skill ids in unlock order: [Base, Ascend, Apex/ultimate]. */
  skills: [string, string, string];
  look: Look;
  tamil?: boolean;
}

const sk = (id: HeroId): [string, string, string] => [`${id}-s1`, `${id}-s2`, `${id}-ult`];
const P = (kind: PassiveKind, name: string, text: string, trigger: string, amount: number, targets: Passive["targets"] = "self", param?: number): Passive =>
  ({ kind, name, text, trigger, amount, targets, timing: "continuous", param });

export const HEROES: HeroDef[] = [
  { num: 1, id: "aruvi", name: "ARUVI", nation: "India", inspiration: "Madurai, Tamil Nadu", archetype: "Energy Duelist", tamil: true,
    quote: "Motion becomes a weapon.", description: "A Madurai temple-dance prodigy who channels kinetic energy through flowing chakra rings.",
    cost: 3, power: 5, color: 0xff9a2e, skills: sk("aruvi"),
    passive: P("momentum", "FLOW STATE", "+2 with an ally here", "Another friendly card is on this carrier", 2),
    look: { face: "oval face, defined cheekbones, warm confident smile", skin: "warm brown", eyes: "dark brown with amber glow", hair: "long black braid with white jasmine flowers", build: "athletic dancer build", costume: "crimson and gold armoured silk with temple-border trims", accessories: "gold jhumka earrings, nethi chutti forehead ornament", focus: "two glowing orange-gold energy rings around her hands", culture: "Bharatanatyam-inspired stance, Madurai temple gold", palette: "crimson, gold, flame orange" } },
  { num: 2, id: "yuki", name: "YUKI", nation: "Japan", inspiration: "Hokkaido", archetype: "Ice Controller",
    quote: "Stillness is the sharpest edge.", description: "A calm cryo-engineer from snowy Hokkaido who freezes the battlefield into order.",
    cost: 2, power: 4, color: 0x7fd3ff, skills: sk("yuki"),
    passive: P("disruptor", "FROSTBITE", "Enemies here -1", "Always, for enemy cards on this carrier", 1, "enemies"),
    look: { face: "narrow face, serene expression", skin: "fair", eyes: "pale ice blue", hair: "long silver-white straight hair with blunt bangs", build: "slender", costume: "white and navy layered coat with ice-crystal armour plates", accessories: "snowflake hair pin", focus: "swirling ice shards from one hand", culture: "subtle haori-like sleeves", palette: "ice blue, white, navy" } },
  { num: 3, id: "amara", name: "AMARA", nation: "Egypt", inspiration: "Luxor", archetype: "Sun Guardian",
    quote: "Dawn always returns.", description: "A Luxor archaeologist turned guardian, wielding a sunfire shield of solar glass.",
    cost: 4, power: 6, color: 0xffc23a, skills: sk("amara"),
    passive: P("sentinel", "DAWN WARD", "+3 while losing here", "Rival base power on this carrier is higher than yours", 3),
    look: { face: "strong jaw, regal expression", skin: "deep bronze", eyes: "golden brown", hair: "short black curls under a gold circlet", build: "tall, strong", costume: "white linen and polished gold scale armour", accessories: "broad collar necklace with sun disc", focus: "radiant round sun shield", culture: "lotus and sun motifs", palette: "gold, sand, white" } },
  { num: 4, id: "liwei", name: "LI WEI", nation: "China", inspiration: "Chongqing", archetype: "Shadow Operative",
    quote: "You saw nothing.", description: "A Chongqing night-market courier who moves through shadows faster than light.",
    cost: 3, power: 5, color: 0xff3b55, skills: sk("liwei"),
    passive: P("lonewolf", "UNSEEN", "+3 if alone here", "No other friendly card is on this carrier", 3),
    look: { face: "sharp angular face, intense stare", skin: "light", eyes: "dark with red reflection", hair: "messy black undercut", build: "lean", costume: "black tactical jacket with red lining and high collar", accessories: "red scarf, half-mask lowered at the neck", focus: "dual short blades trailing red shadow", culture: "knot-button details", palette: "black, crimson" } },
  { num: 5, id: "kofi", name: "KOFI", nation: "Ghana", inspiration: "Kumasi", archetype: "Earth Sentinel",
    quote: "The ground remembers.", description: "A Kumasi stonemason who raises living rock to hold the line.",
    cost: 3, power: 5, color: 0xd9a35a, skills: sk("kofi"),
    passive: P("center", "BEDROCK", "+3 in the middle slot", "This card is in your middle slot", 3),
    look: { face: "broad face, calm determined look", skin: "dark brown", eyes: "deep brown", hair: "short twists", build: "broad and muscular", costume: "stone-plated armour over kente-pattern sash", accessories: "carved stone pendant", focus: "fists cracked with glowing amber earth", culture: "kente gold and green weave", palette: "earth brown, gold, green" } },
  { num: 6, id: "ella", name: "ELLA", nation: "France", inspiration: "Brittany coast", archetype: "Storm Commander",
    quote: "On my signal.", description: "A Breton fleet captain who commands lightning and leads from the front.",
    cost: 4, power: 6, color: 0x8f7bff, skills: sk("ella"),
    passive: P("rally", "RALLY CRY", "Allies here +1", "Every other friendly card on this carrier", 1, "allies"),
    look: { face: "heart-shaped face, commanding expression", skin: "fair with freckles", eyes: "grey-blue", hair: "wavy platinum blonde shoulder length", build: "tall", costume: "navy officer coat with violet storm piping and epaulettes", accessories: "tricolor-free silver badge", focus: "crackling violet lightning in raised hand", culture: "Breton maritime style", palette: "navy, violet, silver" } },
  { num: 7, id: "diego", name: "DIEGO", nation: "Mexico", inspiration: "Oaxaca", archetype: "Phantom Gunslinger",
    quote: "One shot, one story.", description: "An Oaxacan drifter whose spectral revolvers fire marigold flame.",
    cost: 3, power: 4, color: 0xff6a2e, skills: sk("diego"),
    passive: P("rear", "DEADEYE", "+2 in the rear slot", "This card is in your outermost slot", 2),
    look: { face: "rugged face, short stubble, half smile", skin: "tan", eyes: "dark brown", hair: "dark wavy hair under a wide flat-brim hat", build: "wiry", costume: "black charro-inspired jacket with orange embroidery", accessories: "marigold flowers on hat band, poncho over shoulder", focus: "ghostly orange revolver", culture: "Oaxacan embroidery patterns", palette: "black, marigold orange, red" } },
  { num: 8, id: "aisha", name: "AISHA", nation: "Saudi Arabia", inspiration: "AlUla", archetype: "Gravity Weaver",
    quote: "Everything falls toward me.", description: "An AlUla astronomer who bends gravity like threads on a loom.",
    cost: 3, power: 5, color: 0xb05cff, skills: sk("aisha"),
    passive: P("crusher", "EVENT HORIZON", "Cheap enemies here -2", "Enemy cards costing 2 or less on this carrier", 2, "enemies"),
    look: { face: "soft oval face, focused gaze", skin: "olive", eyes: "dark amber", hair: "covered by a deep purple hijab with star embroidery", build: "medium", costume: "flowing purple and black robes with geometric silver armour", accessories: "astrolabe pendant", focus: "orbiting violet gravity spheres", culture: "Nabataean geometric patterns", palette: "purple, black, silver" } },
  { num: 9, id: "kavin", name: "KAVIN", nation: "India", inspiration: "Chennai, Tamil Nadu", archetype: "Time Tactician", tamil: true,
    quote: "I've already seen this move.", description: "A Chennai chess prodigy who reads seconds ahead and rewinds small moments.",
    cost: 2, power: 4, color: 0x2fe0c8, skills: sk("kavin"),
    passive: P("lateTide", "LATE TIDE", "+3 from turn 4", "From turn 4 onwards", 3),
    look: { face: "young lean face, sharp thoughtful eyes, thin moustache", skin: "deep brown", eyes: "dark brown with teal clock glow", hair: "short neat black hair side parted", build: "slim", costume: "white veshti-inspired armoured wrap with teal tech jacket", accessories: "brass pocket watch chain, rudraksha-free simple bead bracelet", focus: "floating teal clock-face glyphs", culture: "Chennai marina-blue and Kanchipuram silk border trim", palette: "teal, white, brass" } },
  { num: 10, id: "sara", name: "SARA", nation: "Brazil", inspiration: "Amazonas", archetype: "Beast Shifter",
    quote: "The jungle runs with me.", description: "An Amazonas ranger who channels the spirits of jaguar and harpy eagle.",
    cost: 3, power: 5, color: 0x38d46a, skills: sk("sara"),
    passive: P("pack", "PACK HUNT", "+4 with a full team here", "You have 3 cards on this carrier", 4),
    look: { face: "wide smile, fierce eyes", skin: "medium brown", eyes: "green with gold slit glow", hair: "voluminous dark curly hair", build: "athletic", costume: "green leaf-pattern armour with jaguar-spot pauldrons", accessories: "feather earrings", focus: "spectral green jaguar aura", culture: "Amazonian rainforest motifs", palette: "jungle green, gold, black" } },
  { num: 11, id: "kimi", name: "KIMI", nation: "Nigeria", inspiration: "Lagos", archetype: "Tech Alchemist",
    quote: "Code is just modern gold.", description: "A Lagos maker who transmutes scrap into glowing nano-machines.",
    cost: 3, power: 5, color: 0x5fd4ff, skills: sk("kimi"),
    passive: P("overclock", "OVERCLOCK", "+2 with a heavy ally", "A friendly card costing 4+ is on this carrier", 2),
    look: { face: "round face, bright grin", skin: "dark brown", eyes: "dark brown behind cyan visor goggles", hair: "high puff with cyan beads", build: "medium", costume: "purple tech jumpsuit with gold circuit lines and Ankara-print panels", accessories: "goggles, mechanical gauntlet", focus: "glowing cyan nano-swarm", culture: "Ankara wax-print patterns", palette: "purple, cyan, gold" } },
  { num: 12, id: "meenal", name: "MEENAL", nation: "India", inspiration: "Thanjavur, Tamil Nadu", archetype: "Mind Architect", tamil: true,
    quote: "Every mind is a temple to build.", description: "A Thanjavur architect who builds lattices of thought shaped like kolam patterns.",
    cost: 3, power: 5, color: 0x4f8bff, skills: sk("meenal"),
    passive: P("outnumbered", "FORESIGHT", "+2 when outnumbered", "The rival has more cards on this carrier than you", 2),
    look: { face: "round face, serene knowing smile, small bindi", skin: "medium brown", eyes: "black with blue psychic glow", hair: "short chin-length bob with a single gold clip", build: "petite", costume: "royal blue and gold Thanjavur-painting inspired armour coat", accessories: "round spectacles, gold bangles", focus: "floating glowing blue kolam lattice above her palm", culture: "Thanjavur painting gold leaf, kolam geometry", palette: "royal blue, gold, ivory" } },
  { num: 13, id: "fatima", name: "FATIMA", nation: "Turkey", inspiration: "Konya", archetype: "Flame Dancer",
    quote: "Turn, and the fire turns with me.", description: "A Konya dancer whose spinning steps trail rings of fire.",
    cost: 3, power: 5, color: 0xff4a2e, skills: sk("fatima"),
    passive: P("contested", "EMBER WALTZ", "+2 when facing a rival", "The rival has a card on this carrier", 2),
    look: { face: "long face, fierce elegant expression", skin: "light olive", eyes: "hazel", hair: "long wavy auburn hair", build: "slender dancer", costume: "red and black flowing skirt armour with Iznik tile patterns", accessories: "gold coin headband", focus: "ribbons of fire spiralling around her", culture: "Iznik tulip patterns", palette: "red, black, gold" } },
  { num: 14, id: "senthil", name: "SENTHIL", nation: "India", inspiration: "Rameswaram, Tamil Nadu", archetype: "Aqua Ranger", tamil: true,
    quote: "The sea keeps its promises.", description: "A Rameswaram fisher-diver who commands tides and fires pearl-tipped arrows.",
    cost: 2, power: 4, color: 0x2fb8ff, skills: sk("senthil"),
    passive: P("shoreline", "OPEN SHORE", "+3 if no rival here", "The rival has no cards on this carrier", 3),
    look: { face: "square face, weathered warm smile, short beard", skin: "dark brown", eyes: "deep brown with aqua glow", hair: "shoulder-length wavy black hair tied back", build: "strong swimmer build", costume: "sea-blue scale armour over a checked lungi-inspired wrap", accessories: "conch-shell pendant, rope bracers", focus: "water bow with pearl arrows", culture: "Rameswaram fishing-boat colours", palette: "aqua, sea blue, white" } },
  { num: 15, id: "thabo", name: "THABO", nation: "South Africa", inspiration: "Soweto", archetype: "Vibration Knight",
    quote: "Feel the rhythm hit.", description: "A Soweto drummer-knight whose strikes send shockwaves through steel.",
    cost: 4, power: 6, color: 0xe8b04a, skills: sk("thabo"),
    passive: P("resonance", "RESONANCE", "+1 per ally here", "Each other friendly card on this carrier", 1),
    look: { face: "broad face, beard, confident grin", skin: "deep brown", eyes: "brown", hair: "shaved sides with short locs on top", build: "very muscular", costume: "gold and white armour with Ndebele geometric paint", accessories: "beaded collar", focus: "sonic gauntlets emitting gold ripples", culture: "Ndebele patterns", palette: "gold, white, black" } },
  { num: 16, id: "mei", name: "MEI", nation: "South Korea", inspiration: "Seoul", archetype: "Neon Skirmisher",
    quote: "Faster than the beat drops.", description: "A Seoul street racer with neon blades and a taste for the front line.",
    cost: 4, power: 5, color: 0xff4fd8, skills: sk("mei"),
    passive: P("front", "NEON RUSH", "+3 in the front slot", "This card is in your innermost slot", 3),
    look: { face: "small sharp face, playful smirk", skin: "fair", eyes: "dark with pink glow", hair: "bright pink twin-tail hair", build: "petite athletic", costume: "black and hot-pink racing armour with neon strips", accessories: "visor headset", focus: "twin neon pink energy blades", culture: "hanbok-collar inspired detail", palette: "hot pink, black, cyan" } },
  { num: 17, id: "andres", name: "ANDRES", nation: "Spain", inspiration: "Seville", archetype: "Light Bender",
    quote: "Look closer. Then look again.", description: "A Seville glassblower who refracts sunlight into blades and mirrors.",
    cost: 3, power: 5, color: 0xffe066, skills: sk("andres"),
    passive: P("lane", "HIGH SUN", "+2 on AERIAL", "This card is on the AERIAL carrier", 2, "self", 0),
    look: { face: "angular face, trimmed beard, warm smile", skin: "light tan", eyes: "amber", hair: "swept-back dark brown hair", build: "lean", costume: "white and gold coat with Moorish-arch prism armour", accessories: "prism monocle", focus: "beams of refracted yellow light", culture: "Seville tile and arch motifs", palette: "gold, white, yellow" } },
  { num: 18, id: "zara", name: "ZARA", nation: "Iran", inspiration: "Isfahan", archetype: "Illusion Artist",
    quote: "Which of me is real?", description: "An Isfahan miniature painter whose illusions step off the canvas.",
    cost: 3, power: 4, color: 0xc06bff, skills: sk("zara"),
    passive: P("mirage", "MIRAGE", "Strongest enemy here -2", "The highest-power enemy card on this carrier", 2, "enemies"),
    look: { face: "elegant face, mysterious half smile", skin: "light olive", eyes: "green", hair: "long dark wavy hair under a sheer violet scarf", build: "slender", costume: "violet and teal robe with Persian miniature patterns", accessories: "paintbrush hairpin", focus: "translucent mirror copies of herself", culture: "Isfahan tilework blues", palette: "violet, teal, gold" } },
  { num: 19, id: "thamarai", name: "THAMARAI", nation: "India", inspiration: "Nilgiris, Tamil Nadu", archetype: "Wind Striker", tamil: true,
    quote: "The hills taught me to fly.", description: "A Nilgiris tea-estate runner who rides mountain winds with a silambam staff.",
    cost: 3, power: 5, color: 0x9fffd0, skills: sk("thamarai"),
    passive: P("tailwind", "TAILWIND", "+2 next to an ally", "A friendly card is in an adjacent slot", 2),
    look: { face: "angular face, bright determined eyes, nose ring", skin: "brown", eyes: "dark brown with mint glow", hair: "short wind-swept black pixie cut", build: "wiry runner", costume: "mint green and white light armour with a half-saree sash", accessories: "silver anklets, small nose ring", focus: "long bamboo silambam staff wrapped in wind", culture: "silambam martial art, Nilgiri tea-hill greens", palette: "mint, white, emerald" } },
  { num: 20, id: "sakura", name: "SAKURA", nation: "Indonesia", inspiration: "Bali", archetype: "Plant Guardian",
    quote: "Grow, and protect.", description: "A Balinese botanist whose vines shelter allies and choke threats.",
    cost: 3, power: 5, color: 0x6fe05a, skills: sk("sakura"),
    passive: P("nurture", "NURTURE", "Cheap allies here +1", "Other friendly cards costing 2 or less on this carrier", 1, "allies"),
    look: { face: "soft round face, gentle smile", skin: "golden brown", eyes: "dark with green glow", hair: "long black hair with frangipani flowers", build: "medium", costume: "green and gold batik-patterned leaf armour", accessories: "frangipani crown", focus: "glowing green vines from her hands", culture: "Balinese batik patterns", palette: "leaf green, gold, white" } },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h])) as Record<HeroId, HeroDef>;
export const HERO_IDS = HEROES.map((h) => h.id);
export const isHeroId = (x: unknown): x is HeroId => typeof x === "string" && x in HERO_BY_ID;
