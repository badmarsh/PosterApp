/**
 * Curated posudok galleries — one per thesis-review template.
 *
 * A posudok used to be the one output type with no curated example: creating a
 * "Thesis Review" workspace produced an empty output, and the template picker
 * showed six Finnish… sorry, six *Slovak* forms with different colours. The
 * review record path (AI workspace) fills a document only after a review has
 * been generated, so a user exploring the templates saw nothing at all.
 *
 * Each entry here is a complete, self-consistent review in the template's own
 * language: a different thesis, a different discipline, different criterion
 * commentary, its own classification and its own defence questions. The German
 * Gutachten is a German review — not a Slovak review with a German title.
 *
 * Cards carry `criterionId`, so the weighted criteria table resolves against
 * the production rubric (`SK_ACADEMIC_RUBRIC_V1`) and the printed weights are
 * the real ones, not decoration.
 */

import type { Card, OutputConfig } from "@/lib/poster-types"
import type { BibEntry } from "@/lib/bib-types"
import { getTemplateDef } from "@/lib/output-types"

type PosudokCard = {
  slug: string
  title: string
  content: string
  pattern?: Card["pattern"]
  table?: Card["table"]
  figures?: Array<{ url: string; caption: string }>
}

type PosudokSpec = {
  /** Thesis title as printed in the identification table. */
  thesisTitle: string
  student: string
  thesisType: string
  studyProgramme: string
  academicYear: string
  /** `Institution, Faculty` — split into the letterhead's two lines. */
  venue: string
  reviewer: string
  place: string
  date: string
  grade: string
  scorePercent: number
  recommendation: string
  /** Criterion cards; `criterion` ids come from the production rubric. */
  criteria: Array<{
    criterion: string
    title: string
    /** Lead paragraph, printed in bold-free prose. */
    lead: string
    bullets: Array<{ label: string; text: string }>
    rating: string
    suggestions?: string[]
  }>
  summary: string
  strengths: Array<{ label: string; text: string }>
  citations: Array<{ label: string; text: string }>
  questions: string[]
  /** Title of the identification card. */
  identificationTitle: string
  summaryTitle: string
  strengthsTitle: string
  citationsTitle: string
  questionsTitle: string
  conclusionTitle: string
  /** Labels of the identification table, in the template's language. */
  labels: {
    student: string
    thesis: string
    type: string
    programme: string
    workplace: string
    year: string
    goal: string
    reviewer: string
    reviewerRole: string
  }
  goal: string
  /** Labels of the conclusion stats card. */
  conclusionLabels: { grade: string; recommendation: string; signature: string }
  gradeWord: string
  /** Template language — also selects which posudok figures the cards carry. */
  lang: "sk" | "cs" | "en" | "de" | "pl" | "hu"
}

const ID_PREFIX = "card_"

/** Figure captions, in the template's own language. */
const FIGURE_CAPTIONS: Record<PosudokSpec["lang"], { profile: string; result: string }> = {
  sk: {
    profile: "Profil hodnotenia diplomovej práce podľa kritérií hodnotiaceho rámca univerzity.",
    result: "Vážený výsledok podľa kritérií v porovnaní s celkovým hodnotením práce.",
  },
  cs: {
    profile: "Profil hodnocení diplomové práce podle kritérií hodnocení.",
    result: "Vážený výsledek podle kritérií ve srovnání s celkovým hodnocením práce.",
  },
  en: {
    profile: "Assessment profile of the thesis across the assessed criteria.",
    result: "Weighted result per criterion against the overall assessment.",
  },
  de: {
    profile: "Bewertungsprofil der Masterarbeit über die einzelnen Kriterien.",
    result: "Gewichtetes Ergebnis je Kriterium im Vergleich zur Gesamtbewertung.",
  },
  pl: {
    profile: "Profil oceny pracy magisterskiej według ocenianych kryteriów.",
    result: "Wynik ważony według kryteriów na tle oceny ogólnej pracy.",
  },
  hu: {
    profile: "A diplomamunka értékelési profilja az egyes szempontok szerint.",
    result: "Súlyozott eredmény szempontonként az összesített értékeléshez viszonyítva.",
  },
}

function bulletLines(bullets: Array<{ label: string; text: string }>): string {
  return bullets.map((b) => `- **${b.label}:** ${b.text}`).join("\n")
}

function criterionContent(criterion: PosudokSpec["criteria"][number]): string {
  const parts = [criterion.lead.trim(), bulletLines(criterion.bullets), `- **${criterion.rating.length === 1 ? "Hodnotenie" : "Hodnotenie"}:** ${criterion.rating}`]
  if (criterion.suggestions?.length) {
    parts.splice(2, 0, `**Návrhy na zlepšenie:**\n${criterion.suggestions.map((s) => `- ${s}`).join("\n")}`)
  }
  return parts.filter(Boolean).join("\n\n")
}

/** Rating label per language, so the card text reads naturally. */
const RATING_LABEL: Record<string, string> = {
  "posudok-sk": "Hodnotenie",
  "posudok-cs": "Hodnocení",
  "posudok-en": "Rating",
  "posudok-de": "Bewertung",
  "posudok-pl": "Ocena",
  "posudok-hu": "Értékelés",
}

function cardsFor(templateId: string, spec: PosudokSpec): Card[] {
  const ratingLabel = RATING_LABEL[templateId] ?? "Hodnotenie"
  const cards: PosudokCard[] = [
    {
      slug: "identification",
      title: spec.identificationTitle,
      pattern: "bullets",
      content: [
        `- **${spec.labels.student}:** ${spec.student}`,
        `- **${spec.labels.thesis}:** ${spec.thesisTitle}`,
        `- **${spec.labels.type}:** ${spec.thesisType}`,
        `- **${spec.labels.programme}:** ${spec.studyProgramme}`,
        `- **${spec.labels.workplace}:** ${spec.venue.split(",").slice(1).join(",").trim()}`,
        `- **${spec.labels.year}:** ${spec.academicYear}`,
        `- **${spec.labels.reviewer}:** ${spec.reviewer} (${spec.labels.reviewerRole})`,
        `- **${spec.labels.goal}:** ${spec.goal}`,
      ].join("\n"),
    },
    {
      slug: "summary",
      title: spec.summaryTitle,
      pattern: "bullets",
      content: spec.summary,
    },
  ]

  spec.criteria.forEach((criterion, index) => {
    const figure =
      index === 0
        ? {
            url: `/figures/posudok-profile-${spec.lang}.png`,
            caption:
              FIGURE_CAPTIONS[spec.lang].profile,
          }
        : criterion.criterion === "results_validity"
          ? {
              url: `/figures/posudok-result-${spec.lang}.png`,
              caption: FIGURE_CAPTIONS[spec.lang].result,
            }
          : null
    cards.push({
      slug: `criterion-${criterion.criterion}`,
      title: criterion.title,
      pattern: "bullets",
      figures: figure ? [figure] : undefined,
      content: criterionContent({ ...criterion, rating: criterion.rating }).replace(
        /\*\*Hodnotenie:\*\*/,
        `**${ratingLabel}:**`,
      ),
    })
  })

  cards.push(
    {
      slug: "strengths",
      title: spec.strengthsTitle,
      pattern: "bullets",
      content: bulletLines(spec.strengths),
    },
    {
      slug: "citations",
      title: spec.citationsTitle,
      pattern: "bullets",
      content: bulletLines(spec.citations),
    },
    {
      slug: "questions",
      title: spec.questionsTitle,
      pattern: "bullets",
      content: spec.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    },
    {
      slug: "conclusion",
      title: spec.conclusionTitle,
      pattern: "stats",
      content: [
        `- **${spec.conclusionLabels.grade} ${spec.grade}** ${spec.gradeWord} |  ${spec.scorePercent}%`,
        `- **${spec.conclusionLabels.recommendation}** ${spec.recommendation} | ${spec.venue.split(",")[0]}`,
        `- **${spec.conclusionLabels.signature}** ${spec.reviewer} | ${spec.place}, ${spec.date}`,
      ].join("\n"),
    },
  )

  return cards.map((card, index) => ({
    id: `card_${templateId.replace(/[^a-z0-9]/gi, "").toLowerCase()}_${card.slug.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
    title: card.title,
    column: null,
    order: index,
    pattern: card.pattern ?? "bullets",
    content: card.content,
    criterionId: card.slug.startsWith("criterion-") ? card.slug.replace("criterion-", "") : undefined,
    table: card.table ?? { hasHeader: false, caption: "", rows: [] },
    figures: card.figures ?? [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
  })) as unknown as Card[]
}

// ---------------------------------------------------------------------------
// The six posudky
// ---------------------------------------------------------------------------

const SK: PosudokSpec = {
  thesisTitle: "Sémantická segmentácia pľúcnych lézií hlbokými reziduálnymi sieťami",
  student: "Bc. Martin Kováč",
  thesisType: "Diplomová práca",
  studyProgramme: "Aplikovaná informatika a biofyzika",
  academicYear: "2025/2026",
  venue: "Univerzita Komenského v Bratislave, Fakulta matematiky, fyziky a informatiky",
  reviewer: "doc. RNDr. Róbert Astaloš, PhD.",
  place: "V Bratislave",
  date: "dňa 21. mája 2026",
  grade: "A",
  scorePercent: 92.3,
  recommendation: "Prácu odporúčam k obhajobe",
  gradeWord: "Výborne",
  lang: "sk",
  identificationTitle: "Identifikácia práce a zadanie",
  summaryTitle: "Zhrnutie práce a hlavný prínos",
  strengthsTitle: "Silné stránky práce",
  citationsTitle: "Poznámky k citáciám a bibliografii",
  questionsTitle: "Otázky k obhajobe",
  conclusionTitle: "Záverečné zhodnotenie a klasifikácia",
  labels: {
    student: "Autor práce",
    thesis: "Názov diplomovej práce",
    type: "Typ práce",
    programme: "Študijný program",
    workplace: "Školiace pracovisko",
    year: "Akademický rok",
    goal: "Cieľ práce",
    reviewer: "Vypracoval/a",
    reviewerRole: "Vedúci práce",
  },
  conclusionLabels: { grade: "Hodnotenie", recommendation: "Odporúčanie", signature: "Podpis vedúceho" },
  goal:
    "Návrh a evaluácia modifikovanej ResNet/U-Net architektúry pre automatickú segmentáciu pľúcnych lézií z CT skenov.",
  summary:
    "Práca rieši sémantickú segmentáciu pľúcnych lézií z CT skenov pomocou hlbokých reziduálnych sietí. Autor navrhol modifikovanú ResNet/U-Net architektúru s hybridnou dice-loss funkciou a attention-gated prepojeniami a dôsledne ju validoval na verejnom referenčnom korpuse LIDC-IDRI.\n\nPráca je po odbornej aj formálnej stránke nadpriemerná: experimentálny protokol je reprodukovateľný, výsledky sú štatisticky vyhodnotené a diskusia ich porovnáva s aktuálnym stavom poznania.",
  criteria: [
    {
      criterion: "objectives_clarity",
      title: "Splnenie stanovených cieľov a náročnosť zadania",
      lead: "Zadanie bolo formulované jasne a jeho náročnosť zodpovedá úrovni diplomovej práce; študent tému samostatne rozpracoval do merateľných výskumných otázok.",
      bullets: [
        { label: "Splnenie zadania", text: "Všetky body zadania boli splnené v plnom rozsahu, vrátane nadstavbovej časti venovanej neistote predikcie." },
        { label: "Výskumné otázky", text: "Tri formulované otázky sú testovateľné a priamo naviazané na experimentálny plán práce." },
      ],
      rating: "A",
    },
    {
      criterion: "theoretical_background",
      title: "Odborná úroveň a teoretická báza",
      lead: "Miera spracovania teoretických východísk je nadpriemerná a rešerš je vedená kriticky, nie opisne.",
      bullets: [
        { label: "Práca s literatúrou", text: "Viac než 45 relevantných zahraničných zdrojov (IEEE TMI, Medical Image Analysis, 2022–2026) vrátane prehľadu aktuálnych SOTA architektúr." },
        { label: "Matematická formalizácia", text: "Konvolučné vrstvy, reziduálne prepojenia aj optimalizačné funkcie sú formalizované korektne a v jednotnej notácii." },
      ],
      rating: "A",
    },
    {
      criterion: "methodology_rigor",
      title: "Metodologická primeranosť a postup riešenia",
      lead: "Experimentálna časť je metodicky solídna; výhrady smerujú k voľbe hyperparametrov.",
      bullets: [
        { label: "Dataset a protokol", text: "Verejný referenčný korpus LIDC-IDRI (1018 pacientov) s prísnou 5-násobnou krížovou validáciou a fixným náhodným semienkom." },
        { label: "Kvalita implementácie", text: "Modulárny PyTorch repozitár s unit testami, konfiguračnými súbormi a skriptom reprodukujúcim všetky tabuľky." },
        { label: "Výhrada", text: "Sieť hyperparametrov nebola predmetom systematického vyhľadávania; vplyv learning rate je dokumentovaný len pre tri hodnoty." },
      ],
      rating: "B",
      suggestions: [
        "Doplniť skrátenú štúdiu citlivosti na learning rate a batch size.",
        "Uviesť čas trénovania a hardvérové požiadavky v kapitole 5.",
      ],
    },
    {
      criterion: "results_validity",
      title: "Validita výsledkov a ich interpretácia",
      lead: "Prezentované výsledky sú presvedčivé a podložené štatistickým vyhodnotením.",
      bullets: [
        { label: "Kvantitatívne výsledky", text: "Dice 0,912 a HD95 4,8 mm na validačnej množine, teda zlepšenie oproti publikovanému baseline." },
        { label: "Štatistická významnosť", text: "Párový Wilcoxonov test (p < 0,001) pre všetky tri porovnávané konfigurácie." },
        { label: "Analýza chýb", text: "Chybová analýza podľa veľkosti lézie pomenúva limity pre lézie pod 5 mm." },
      ],
      rating: "A",
    },
    {
      criterion: "discussion_relation",
      title: "Diskusia a nadväznosť na ciele",
      lead: "Diskusia je vedená na úrovni porovnania s publikovanými metódami a nevyhýba sa ani odchýlkam vo výsledkoch.",
      bullets: [
        { label: "Zasadenie do kontextu", text: "Výsledky sú porovnané s piatimi recentnými prácami a rozdiely sú vecne komentované." },
        { label: "Limity", text: "Autor otvorene pomenúva obmedzenia malého počtu anotátorov a absenciu externého testovacieho korpusu." },
      ],
      rating: "A",
    },
  ],
  strengths: [
    { label: "Samostatnosť a iniciatíva", text: "Študent si sám dohodol spoluprácu s klinickým pracoviskom a zabezpečil anotácie pre validačnú množinu." },
    { label: "Reprodukovateľnosť", text: "Kód, konfigurácie aj predtrénované váhy sú zverejnené s návodom na reprodukciu všetkých tabuliek." },
    { label: "Klinická relevancia", text: "Metóda je validovaná spôsobom, ktorý zodpovedá reálnemu diagnostickému pracovnému postupu." },
  ],
  citations: [
    { label: "Chýbajúce DOI", text: "Pri položkách č. 12 a 27 chýba DOI alebo trvalý identifikátor; obe sú dohľadateľné v Crossref." },
    { label: "Nekonzistentný štýl", text: "Tri položky skracujú názvy konferencií odlišne od zvyšku práce." },
    { label: "Prevzaté obrázky", text: "Kapitola 3 preberá tri obrázky bez uvedenia sekundárneho zdroja v popise." },
  ],
  questions: [
    "Ako by navrhovaný model reagoval na prítomnosť obrazových artefaktov spôsobených pohybom pacienta pri nízko-dávkovom CT protokole?",
    "Aká je výpočtová zložitosť inferencie jedného 3D objemu a bolo by možné model nasadiť do real-time klinickej diagnostickej stanice?",
    "Ako by ste metódu rozšírili o odhad neistoty a aké klinické rozhodnutia by také rozšírenie umožnilo?",
  ],
}

const CS: PosudokSpec = {
  thesisTitle: "Predikce poruch obráběcích strojů z vibračních signálů",
  student: "Bc. Tereza Navrátilová",
  thesisType: "Diplomová práce",
  studyProgramme: "Kybernetika a robotika",
  academicYear: "2025/2026",
  venue: "České vysoké učení technické v Praze, Fakulta elektrotechnická",
  reviewer: "doc. Ing. Pavel Hrubý, CSc.",
  place: "V Praze",
  date: "dne 14. května 2026",
  grade: "B",
  scorePercent: 85.0,
  recommendation: "Práci doporučuji k obhajobě",
  gradeWord: "Velmi dobře",
  lang: "cs",
  identificationTitle: "Údaje o práci a jejím zadání",
  summaryTitle: "Shrnutí práce a hlavní přínos",
  strengthsTitle: "Přednosti práce",
  citationsTitle: "Poznámky k citacím a bibliografii",
  questionsTitle: "Otázky k obhajobě",
  conclusionTitle: "Závěrečné hodnocení a klasifikace",
  labels: {
    student: "Autor práce",
    thesis: "Název práce",
    type: "Typ práce",
    programme: "Studijní program",
    workplace: "Pracoviště",
    year: "Akademický rok",
    goal: "Zadání práce",
    reviewer: "Vypracoval",
    reviewerRole: "Oponent",
  },
  conclusionLabels: { grade: "Hodnocení", recommendation: "Doporučení", signature: "Podpis oponenta" },
  goal:
    "Návrh klasifikátoru predikujícího poruchy vřetena a ložisek z vibračních signálů a jeho ověření na datech z výrobní linky.",
  summary:
    "Práce se zabývá prediktivní údržbou obráběcích strojů. Autorka zpracovala vibrační měření z výrobní linky, navrhla příznakový pipeline ve frekvenční i časové oblasti a porovnala tři klasifikační přístupy včetně konvoluční sítě nad spektrogramy.\n\nPřínos práce je především aplikační: klasifikátor dosahuje vysoké přesnosti při krátkém okně měření a autorka jej nasadila do testovacího provozu. Slabší je statistické vyhodnocení a část týkající se nejistoty predikce.",
  criteria: [
    {
      criterion: "problem_relevance",
      title: "Relevance tématu a vymezení problému",
      lead: "Téma je pro obor aktuální a vymezení problému je provedeno pečlivě, včetně ekonomického kontextu prediktivní údržby.",
      bullets: [
        { label: "Vymezení problému", text: "Autorka rozlišuje mezi diagnostikou a predikcí a vysvětluje, proč je pro výrobní linku rozhodující horizont 8 hodin." },
        { label: "Aplikační kontext", text: "Spolupráce s provozovatelem linky je doložena popisem sběru dat i provozního omezení." },
      ],
      rating: "A",
    },
    {
      criterion: "methodology_rigor",
      title: "Metodický postup a jeho zdůvodnění",
      lead: "Postup je logický a zdůvodněný; menší výhrady mám k rozdělení dat.",
      bullets: [
        { label: "Zpracování signálu", text: "Příznaky v časové i frekvenční oblasti, obálková analýza a spektrogramy; předzpracování je reprodukovatelné." },
        { label: "Dělení dat", text: "Rozdělení po segmentech měření místo po jednotlivých oknech je správné, ale chybí křížová validace po strojích." },
        { label: "Výhrada", text: "Tři klasifikátory jsou porovnány na jediném dělení dat, což ztěžuje odhad rozptylu výsledků." },
      ],
      rating: "B",
      suggestions: [
        "Doplnit křížovou validaci po strojích a uvést interval spolehlivosti přesnosti.",
        "Zdůvodnit volbu délky okna měření alespoň odkazem na fyzikální časovou konstantu ložiska.",
      ],
    },
    {
      criterion: "analytical_execution",
      title: "Analytické zpracování a implementace",
      lead: "Implementace je kvalitní, experimenty jsou doložené a kód je čitelný.",
      bullets: [
        { label: "Experimentální evidence", text: "Všechny tabulky a grafy lze znovu vygenerovat přiloženým skriptem." },
        { label: "Výkonnostní analýza", text: "Autorka uvádí i latenci inferia na průmyslovém počítači, což je pro nasazení podstatné." },
      ],
      rating: "A",
    },
    {
      criterion: "results_validity",
      title: "Dosažené výsledky a jejich hodnocení",
      lead: "Výsledky jsou přesvědčivé pro deklarovaný horizont predikce a jsou správně interpretovány.",
      bullets: [
        { label: "Přesnost", text: "F1 = 0,91 pro horizont 8 hodin a 0,78 pro horizont 24 hodin; pokles je věcně vysvětlen." },
        { label: "Srovnání", text: "Porovnání s prahovou diagnostikou ukazuje přínos uvíznutí ložiska, u nevyváženosti je přínos malý." },
      ],
      rating: "B",
    },
    {
      criterion: "citations_quality",
      title: "Práce s literaturou a citace",
      lead: "Literatura je dostatečná a odpovídá tématu, citační styl je však místy nekonzistentní.",
      bullets: [
        { label: "Pokrytí", text: "38 zdrojů včetně přehledových článků o prediktivní údržbě a norem pro měření vibrací." },
        { label: "Výhrada", text: "Šest zdrojů je uvedeno bez DOI a dvě normy jsou citovány odlišným stylem než zbytek práce." },
      ],
      rating: "C",
      suggestions: [
        "Sjednotit citační styl a doplnit DOI u všech žurnálových položek.",
      ],
    },
  ],
  strengths: [
    { label: "Aplikační dopad", text: "Řešení bylo ověřeno v testovacím provozu a autorka popisuje i jeho omezení." },
    { label: "Kvalita zpracování dat", text: "Sběr vibračních dat je popsán natolik podrobně, že jej lze zopakovat na jiném stroji." },
    { label: "Inženýrská samostatnost", text: "Autorka si sama zajistila přístup k měřicímu vybavení i k provozním datům." },
  ],
  citations: [
    { label: "Chybějící DOI", text: "Šest žurnálových položek nemá DOI ani jiný trvalý identifikátor." },
    { label: "Normy", text: "ČSN ISO 10816 a ČSN ISO 13373 jsou citovány dvěma různými způsoby." },
    { label: "Vlastní publikace", text: "Konferenční příspěvek autorky je uveden v seznamu, ale v textu není odlišen od související práce." },
  ],
  questions: [
    "Jak se změní přesnost klasifikátoru, pokud bude model nasazen na stroji, jehož data nebyla v trénovací množině?",
    "Proč jste zvolila právě délku okna měření 0,5 sekundy a jak by se výsledek změnil při delším okně?",
    "Jakým způsobem byste do provozu doplnila sledování nejistoty modelu a jak by se projevilo rozpadnutí rozdělení dat?",
  ],
}

const EN: PosudokSpec = {
  thesisTitle: "De-identification of Clinical Narratives with Federated Learning",
  student: "Bc. Emma Lindqvist",
  thesisType: "Master's thesis",
  studyProgramme: "Health Data Science",
  academicYear: "2025/2026",
  venue: "Uppsala University, Department of Information Technology",
  reviewer: "Prof. Dr. Anders Berglund",
  place: "Uppsala",
  date: "on 12 June 2026",
  grade: "A",
  scorePercent: 90.0,
  recommendation: "I recommend the thesis for defence",
  gradeWord: "Excellent",
  lang: "en",
  identificationTitle: "Thesis identification and assignment",
  summaryTitle: "Executive summary",
  strengthsTitle: "Key strengths",
  citationsTitle: "Citation notes",
  questionsTitle: "Defence questions",
  conclusionTitle: "Overall assessment and classification",
  labels: {
    student: "Author",
    thesis: "Thesis title",
    type: "Thesis type",
    programme: "Study programme",
    workplace: "Department",
    year: "Academic year",
    goal: "Assignment",
    reviewer: "Reviewer",
    reviewerRole: "Supervisor",
  },
  conclusionLabels: { grade: "Grade", recommendation: "Recommendation", signature: "Reviewer signature" },
  goal:
    "Design and evaluate a federated de-identification model for Swedish clinical narratives that never centralises patient text.",
  summary:
    "The thesis studies privacy-preserving de-identification of clinical narratives. The candidate implements a federated training loop over three simulated hospital sites, compares it against a centralised baseline, and quantifies the privacy–utility trade-off with a membership-inference probe.\n\nThe work is methodologically strong: the evaluation is pre-registered, the leakage experiment is thoughtfully designed, and the limitations of the simulated federation are stated plainly rather than glossed over.",
  criteria: [
    {
      criterion: "objectives_clarity",
      title: "Clarity of objectives and research questions",
      lead: "The research questions are stated precisely and each one is answered with a distinct experiment.",
      bullets: [
        { label: "Question–experiment mapping", text: "Three research questions map one-to-one onto the federation, utility and privacy experiments." },
        { label: "Scope control", text: "The candidate deliberately restricts the study to Swedish narratives and justifies the restriction." },
      ],
      rating: "A",
    },
    {
      criterion: "methodology_rigor",
      title: "Methodological rigour",
      lead: "The federated setup is reproduced faithfully and the baselines are strong.",
      bullets: [
        { label: "Federation design", text: "Three sites with non-IID label distributions, secure aggregation simulated, client sampling documented." },
        { label: "Baselines", text: "Centralised model and a rule-based de-identifier are both evaluated under identical splits." },
        { label: "Statistics", text: "Five seeds per configuration with bootstrap confidence intervals; differences are reported with effect sizes." },
      ],
      rating: "A",
    },
    {
      criterion: "analytical_execution",
      title: "Execution and implementation quality",
      lead: "The implementation is portable and the experimental harness is unusually well engineered for a master's thesis.",
      bullets: [
        { label: "Reproducibility", text: "Containerised pipeline with pinned dependencies reproduces every table in the thesis." },
        { label: "Ablations", text: "Ablations over client count and local epochs clarify which design choices actually matter." },
      ],
      rating: "A",
    },
    {
      criterion: "ethics_transparency",
      title: "Ethics, data protection and transparency",
      lead: "Ethics are treated as a design constraint rather than a paragraph of boilerplate.",
      bullets: [
        { label: "Data handling", text: "Synthetic records are generated from a public template corpus, so no real patient text is processed." },
        { label: "Privacy analysis", text: "The membership-inference probe quantifies leakage instead of asserting privacy by construction." },
        { label: "Transparency", text: "Model cards and a data statement accompany the release." },
      ],
      rating: "A",
    },
    {
      criterion: "limitations_future_work",
      title: "Limitations and future work",
      lead: "The limitations section is honest and specific, which raises my confidence in the reported results.",
      bullets: [
        { label: "Simulation gap", text: "The candidate explicitly notes that simulated sites cannot reproduce real cross-hospital heterogeneity." },
        { label: "Named next steps", text: "Differential privacy accounting and multilingual transfer are proposed with concrete first experiments." },
      ],
      rating: "B",
      suggestions: [
        "Add a short differential-privacy accounting sketch to make the leakage claim quantitative.",
        "Report per-client utility variance, not only the mean, to expose fairness across sites.",
      ],
    },
  ],
  strengths: [
    { label: "Rigour of the privacy evaluation", text: "Leakage is measured with an attack, not assumed away." },
    { label: "Reproducible engineering", text: "The containerised harness reproduces every reported number from the released artefacts." },
    { label: "Clear scientific writing", text: "The argument proceeds linearly and each claim is tied to an experiment." },
  ],
  citations: [
    { label: "Preprint citations", text: "Four references are preprints without a peer-reviewed version; this should be stated where they carry a central claim." },
    { label: "Missing dataset version", text: "The MIMIC-derived template corpus is cited without its version identifier." },
    { label: "Style consistency", text: "Two entries use author-year and the remaining entries numeric style." },
  ],
  questions: [
    "How would the membership-inference advantage change if the number of federation rounds were doubled, and what does that imply for the privacy budget?",
    "Which part of your utility loss is attributable to non-IID client distributions rather than to federation itself?",
    "How would your pipeline need to change to comply with a strict purpose-limitation requirement in a hospital ethics review?",
  ],
}

const DE: PosudokSpec = {
  thesisTitle: "Energieoptimierung in Rechenzentren mit bestärkendem Lernen",
  student: "Bc. Lukas Weber",
  thesisType: "Masterarbeit",
  studyProgramme: "Technische Informatik",
  academicYear: "2025/2026",
  venue: "Technische Universität Dresden, Fakultät Informatik",
  reviewer: "Prof. Dr.-Ing. Katharina Vogel",
  place: "Dresden",
  date: "den 9. Juni 2026",
  grade: "B",
  scorePercent: 84.2,
  recommendation: "Ich empfehle die Annahme der Arbeit",
  gradeWord: "Gut",
  lang: "de",
  identificationTitle: "Identifikation der Arbeit und Aufgabenstellung",
  summaryTitle: "Zusammenfassung und Hauptergebnis",
  strengthsTitle: "Stärken der Arbeit",
  citationsTitle: "Anmerkungen zu Zitaten und Literatur",
  questionsTitle: "Fragen zur Verteidigung",
  conclusionTitle: "Gesamtbewertung und Einstufung",
  labels: {
    student: "Verfasser",
    thesis: "Titel der Arbeit",
    type: "Art der Arbeit",
    programme: "Studiengang",
    workplace: "Betreuende Einrichtung",
    year: "Akademisches Jahr",
    goal: "Aufgabenstellung",
    reviewer: "Gutachter/in",
    reviewerRole: "Betreuer",
  },
  conclusionLabels: { grade: "Bewertung", recommendation: "Empfehlung", signature: "Unterschrift des Gutachters" },
  goal:
    "Entwurf und Evaluierung eines bestärkenden Reglers zur Kühlungssteuerung eines Rechenzentrums unter Einhaltung der thermischen Hüllkurve.",
  summary:
    "Die Arbeit behandelt die Energieoptimierung der Kühlung eines Rechenzentrums. Der Verfasser modelliert das Kühlsystem als Markov-Entscheidungsprozess, trainiert einen Soft-Actor-Critic-Agenten gegen ein validiertes Simulationsmodell und vergleicht ihn mit der produktiven Regelstrategie.\n\nBemerkenswert ist die Sorgfalt bei der Sicherheitsabsicherung: Der Agent wird mit einer harten Temperaturschranke betrieben und die Verletzungsrate wird explizit ausgewiesen. Die Übertragbarkeit auf den Realbetrieb bleibt jedoch offen.",
  criteria: [
    {
      criterion: "problem_relevance",
      title: "Relevanz und Abgrenzung der Fragestellung",
      lead: "Die Fragestellung ist für den Betrieb von Rechenzentren hochrelevant und wird sauber von der reinen Lastprognose abgegrenzt.",
      bullets: [
        { label: "Abgrenzung", text: "Der Verfasser grenzt Kühlungsoptimierung, Lastverschiebung und Regelung nachvollziehbar voneinander ab." },
        { label: "Praxisbezug", text: "Die Zielgröße PUE ist an der realen Anlage verankert; die Messgrenzen werden benannt." },
      ],
      rating: "A",
    },
    {
      criterion: "methodology_rigor",
      title: "Methodisches Vorgehen",
      lead: "Das Vorgehen ist begründet und nachvollziehbar; die Modellvalidierung ist der stärkste Teil der Arbeit.",
      bullets: [
        { label: "Simulationsmodell", text: "Zweistufige Validierung gegen Messdaten über vier Wochen mit Angabe der Modellgüte." },
        { label: "Trainingsverfahren", text: "Soft Actor-Critic mit Curriculum über Außentemperaturen; Belohnungsfunktion ist im Anhang vollständig dokumentiert." },
        { label: "Vorbehalt", text: "Der Realbetrieb wird nicht getestet; die Übertragung stützt sich auf die Simulationsvalidierung." },
      ],
      rating: "B",
      suggestions: [
        "Eine zumindest simulierte Hardware-in-the-Loop-Evaluation würde die Übertragbarkeit deutlich stützen.",
        "Die Sensitivität gegenüber Modellfehlern sollte quantifiziert werden, nicht nur qualitativ diskutiert.",
      ],
    },
    {
      criterion: "analytical_execution",
      title: "Durchführung und Implementierung",
      lead: "Die Implementierung ist sauber strukturiert und die Experimente sind vollständig dokumentiert.",
      bullets: [
        { label: "Versuchsplanung", text: "Fünf Zufallsstartwerte je Konfiguration, Angabe von Median und Streuung der Einsparung." },
        { label: "Codequalität", text: "Modulare Trainingspipeline mit Konfigurationsdateien und automatisierten Auswerteskripten." },
      ],
      rating: "A",
    },
    {
      criterion: "results_validity",
      title: "Gültigkeit und Aussagekraft der Ergebnisse",
      lead: "Die Ergebnisse sind solide belegt und werden nicht überinterpretiert.",
      bullets: [
        { label: "Energieeinsparung", text: "Rund 11 % geringerer Kühlenergiebedarf bei gleicher Temperaturhüllkurve im Simulationsmodell." },
        { label: "Sicherheitsnachweis", text: "Verletzungen der Temperaturschranke in unter 0,2 % der Schritte; Ausreißer werden einzeln analysiert." },
        { label: "Vergleichbarkeit", text: "Die Baseline ist die produktive Regelstrategie, nicht ein künstlich schwacher Vergleichsregler." },
      ],
      rating: "B",
    },
    {
      criterion: "structure_coherence",
      title: "Aufbau und sprachliche Qualität",
      lead: "Die Arbeit ist klar gegliedert und sprachlich präzise; kleinere Redundanzen fallen nicht ins Gewicht.",
      bullets: [
        { label: "Gliederung", text: "Problem, Modell, Verfahren, Ergebnisse und Diskussion folgen ohne Brüche aufeinander." },
        { label: "Sprache", text: "Präzise Fachsprache mit konsistenter Terminologie über alle Kapitel." },
        { label: "Vorbehalt", text: "Kapitel 4 wiederholt Teile der Modellbeschreibung aus Kapitel 3." },
      ],
      rating: "B",
    },
  ],
  strengths: [
    { label: "Sorgfalt bei der Sicherheit", text: "Der Agent wird mit harter Temperaturschranke betrieben; Verletzungen werden ausgewiesen statt kaschiert." },
    { label: "Nachvollziehbare Modellvalidierung", text: "Das Simulationsmodell wird gegen vier Wochen Messdaten validiert und die Güte angegeben." },
    { label: "Betriebsnahe Bewertung", text: "Die Bewertung erfolgt gegen die produktive Regelstrategie und mit dem betrieblichen Kennwert PUE." },
  ],
  citations: [
    { label: "Fehlende Auflagenangaben", text: "Bei fünf Normen und Richtlinien fehlen Ausgabejahr und Fassung." },
    { label: "Uneinheitliche Zitierweise", text: "Internetquellen sind teils mit Abrufdatum, teils ohne angegeben." },
    { label: "Sekundärzitate", text: "Zwei zentrale Aussagen stützen sich auf Sekundärzitate, obwohl die Originalarbeiten zugänglich sind." },
  ],
  questions: [
    "Wie würde sich die Einsparung verändern, wenn die Außentemperatur über mehrere Wochen deutlich über dem Trainingsbereich läge?",
    "Welche Sicherheitsmechanismen würden Sie ergänzen, bevor der Regler im Produktivbetrieb zugelassen werden könnte?",
    "Wie empfindlich reagiert die Politik auf Fehler des Simulationsmodells — haben Sie das quantifiziert?",
  ],
}

const PL: PosudokSpec = {
  thesisTitle: "Detekcja dezinformacji w mediach społecznościowych metodami uczenia maszynowego",
  student: "Bc. Anna Kowalska",
  thesisType: "Praca magisterska",
  studyProgramme: "Informatyka stosowana",
  academicYear: "2025/2026",
  venue: "Politechnika Wrocławska, Wydział Informatyki i Telekomunikacji",
  reviewer: "dr hab. inż. Marek Zieliński, prof. PWr",
  place: "Wrocław",
  date: "dnia 5 czerwca 2026",
  grade: "A",
  scorePercent: 88.5,
  recommendation: "Pracę dopuszczam do obrony",
  gradeWord: "Bardzo dobry",
  lang: "pl",
  identificationTitle: "Identyfikacja pracy i zadania",
  summaryTitle: "Streszczenie pracy i główny wkład",
  strengthsTitle: "Mocne strony pracy",
  citationsTitle: "Uwagi do cytowań i bibliografii",
  questionsTitle: "Pytania do obrony",
  conclusionTitle: "Ocena końcowa i klasyfikacja",
  labels: {
    student: "Autor pracy",
    thesis: "Tytuł pracy",
    type: "Rodzaj pracy",
    programme: "Kierunek studiów",
    workplace: "Jednostka dyplomująca",
    year: "Rok akademicki",
    goal: "Zadanie pracy",
    reviewer: "Recenzent",
    reviewerRole: "Promotor",
  },
  conclusionLabels: { grade: "Ocena", recommendation: "Rekomendacja", signature: "Podpis recenzenta" },
  goal:
    "Opracowanie modelu wykrywającego dezinformację w tekstach polskojęzycznych oraz ocena jego odporności na celowe przeformułowania.",
  summary:
    "Praca dotyczy automatycznej detekcji dezinformacji w polskojęzycznych mediach społecznościowych. Autorka zbudowała korpus oznaczony przez trzech adnotatorów, wytrenowała klasyfikator oparty na modelu językowym oraz zbadała odporność modelu na ataki parafrazy i dodawanie szumu.\n\nNajważniejszym wkładem jest rozdział o odporności: autorka nie poprzestaje na wysokiej dokładności na zbiorze testowym, lecz mierzy, jak szybko model się poddaje przy przeformułowaniu tekstu. To dojrzałe podejście jak na pracę magisterską.",
  criteria: [
    {
      criterion: "originality_contribution",
      title: "Oryginalność i wkład własny",
      lead: "Wkład własny jest wyraźny: polskojęzyczny korpus z adnotacjami oraz metodyka oceny odporności.",
      bullets: [
        { label: "Korpus", text: "Około 12 000 tekstów oznaczonych przez trzech adnotatorów z raportowaną zgodnością między sędziami." },
        { label: "Wkład metodyczny", text: "Protokół oceny odporności na parafrazę i szum jest samodzielnym, powtarzalnym elementem." },
      ],
      rating: "A",
    },
    {
      criterion: "methodology_rigor",
      title: "Poprawność metodyczna",
      lead: "Metodyka jest staranna, a podział danych uwzględnia nakładanie się tematów między zbiorami.",
      bullets: [
        { label: "Podział danych", text: "Podział czasowy, a nie losowy, co zapobiega przeciekowi tematycznemu." },
        { label: "Adnotacje", text: "Raportowana zgodność między adnotatorami i opis rozstrzygania sporów." },
        { label: "Zastrzeżenie", text: "Brak testu istotności statystycznej dla różnic między modelami." },
      ],
      rating: "B",
      suggestions: [
        "Dodać przedział ufności lub test istotności dla różnic między modelami.",
        "Opisać, jak dobierano źródła do korpusu, aby ograniczyć obciążenie próby.",
      ],
    },
    {
      criterion: "analytical_execution",
      title: "Realizacja badań i implementacja",
      lead: "Część eksperymentalna jest kompletna, a kod pozwala odtworzyć wszystkie wyniki.",
      bullets: [
        { label: "Powtarzalność", text: "Skrypty treningowe i konfiguracje są dołączone, wraz z ustalonymi ziarnami losowości." },
        { label: "Analiza błędów", text: "Analiza przypadków błędnych pokazuje, że model myli ironię z dezinformacją." },
      ],
      rating: "A",
    },
    {
      criterion: "results_validity",
      title: "Wiarygodność wyników",
      lead: "Wyniki są przekonujące i uczciwie omówione, także tam, gdzie model zawodzi.",
      bullets: [
        { label: "Skuteczność", text: "F1 = 0,87 na zbiorze testowym; po parafrazie spadek do 0,71, co autorka wyraźnie komentuje." },
        { label: "Analiza odporności", text: "Trzy rodzaje przeformułowań z osobnym omówieniem każdego z nich." },
      ],
      rating: "A",
    },
    {
      criterion: "citations_quality",
      title: "Dobór literatury i cytowania",
      lead: "Literatura jest aktualna i dobrze dobrana, choć styl cytowania wymaga ujednolicenia.",
      bullets: [
        { label: "Aktualność", text: "Ponad 50 pozycji, w większości z ostatnich pięciu lat, w tym prace przeglądowe." },
        { label: "Zastrzeżenie", text: "Dziewięć pozycji nie ma numeru DOI, a dwie prace cytowane są w innym stylu niż pozostałe." },
      ],
      rating: "B",
    },
  ],
  strengths: [
    { label: "Dojrzałość badawcza", text: "Autorka mierzy odporność modelu, a nie tylko jego dokładność na zbiorze testowym." },
    { label: "Wartość korpusu", text: "Polskojęzyczny, oznaczony korpus z opisem zgodności adnotatorów jest trwałym wkładem." },
    { label: "Rzetelność dokumentacji", text: "Wszystkie eksperymenty można odtworzyć z dołączonych skryptów i konfiguracji." },
  ],
  citations: [
    { label: "Brak DOI", text: "Dziewięć pozycji nie zawiera numeru DOI ani innego trwałego identyfikatora." },
    { label: "Nieujednolicony styl", text: "Dwie prace cytowane są w stylu odbiegającym od przyjętego w pracy." },
    { label: "Źródła internetowe", text: "Przy trzech źródłach internetowych brakuje daty dostępu." },
  ],
  questions: [
    "Jak zmieniłaby się odporność modelu, gdyby parafrazy pochodziły od osób innych niż adnotatorzy korpusu?",
    "Czy spadek jakości po parafrazie wynika bardziej z cech leksykalnych, czy z rozkładu tematów w zbiorze treningowym?",
    "Jak zabezpieczyłaby Pani taki klasyfikator przed użyciem jako narzędzia cenzury treści?",
  ],
}

const HU: PosudokSpec = {
  thesisTitle: "Autonóm járművek pályatervezése városi forgalomban",
  student: "Bc. Szabó Dániel",
  thesisType: "Diplomamunka",
  studyProgramme: "Mechatronikai mérnöki",
  academicYear: "2025/2026",
  venue: "Budapesti Műszaki és Gazdaságtudományi Egyetem, Villamosmérnöki és Informatikai Kar",
  reviewer: "Dr. Tóth Katalin, PhD",
  place: "Budapesten",
  date: "2026. június 3-án",
  grade: "B",
  scorePercent: 82.0,
  recommendation: "A dolgozatot védésre javaslom",
  gradeWord: "Jó",
  lang: "hu",
  identificationTitle: "A dolgozat azonosítása és a feladat",
  summaryTitle: "A dolgozat összefoglalása és fő eredménye",
  strengthsTitle: "A dolgozat erősségei",
  citationsTitle: "Megjegyzések a hivatkozásokhoz",
  questionsTitle: "Kérdések a védéshez",
  conclusionTitle: "Összegző értékelés és osztályzat",
  labels: {
    student: "Szerző",
    thesis: "A dolgozat címe",
    type: "A dolgozat típusa",
    programme: "Szak",
    workplace: "Kihelyező intézmény",
    year: "Tanév",
    goal: "Feladat",
    reviewer: "Bíráló",
    reviewerRole: "Témavezető",
  },
  conclusionLabels: { grade: "Értékelés", recommendation: "Ajánlás", signature: "Bíráló aláírása" },
  goal:
    "Városi forgalomban működő pályatervező algoritmus kidolgozása és szimulációs vizsgálata, valós idejű számítási korlát betartásával.",
  summary:
    "A dolgozat városi autonóm járművek pályatervezésével foglalkozik. A hallgató mintavételezésen alapuló tervezőt dolgozott ki, azt összekapcsolta egy prediktív forgalmi modellel, és részletes szimulációs vizsgálatot végzett kereszteződési és sávváltási helyzetekben.\n\nA munka mérnöki szempontból gyakorlatias: a szerző valósághű érzékelési bizonytalansággal is tesztel, és nyíltan megmutatja azokat a helyzeteket, amelyekben a tervező összeomlik. Az elméleti megalapozás viszont helyenként felületes.",
  criteria: [
    {
      criterion: "objectives_clarity",
      title: "A célkitűzés tisztasága és a feladat megértése",
      lead: "A célkitűzés világos, a hallgató a feladatot önállóan bontotta mérhető részproblémákra.",
      bullets: [
        { label: "Célkitűzés", text: "Három világosan megfogalmazott kutatási kérdés, amelyekhez külön kísérlet tartozik." },
        { label: "Határok kijelölése", text: "A szerző egyértelműen megadja, hogy milyen forgalmi helyzeteket nem vizsgál." },
      ],
      rating: "A",
    },
    {
      criterion: "theoretical_background",
      title: "Szakmai színvonal és elméleti megalapozás",
      lead: "A szakirodalmi áttekintés megfelelő, de az elméleti fejezet helyenként leíró jellegű marad.",
      bullets: [
        { label: "Szakirodalom", text: "32 releváns forrás, köztük a legfontosabb 2022 utáni pályatervezési munkák." },
        { label: "Elméleti mélység", text: "A mintavételezéses tervezés konvergencia-tulajdonságai csak említés szintjén jelennek meg." },
        { label: "Formalizálás", text: "A járműmodell és a költségfüggvény következetesen formalizált." },
      ],
      rating: "B",
      suggestions: [
        "Az elméleti fejezetben érdemes bizonyítás vagy legalább szimulációs indoklás a paraméterválasztásra.",
        "A prediktív forgalmi modell bizonytalanságát formálisan is be kellene vezetni.",
      ],
    },
    {
      criterion: "methodology_rigor",
      title: "Módszertani megalapozottság",
      lead: "A módszertan gyakorlatias és jól dokumentált, a vizsgálati terv azonban ismétlések nélkül marad.",
      bullets: [
        { label: "Tervezési módszer", text: "Mintavételezésen alapuló tervező prediktív forgalmi modellel összekapcsolva." },
        { label: "Vizsgálati terv", text: "Hét jellemző forgalmi helyzet, érzékelési bizonytalanság szimulálva." },
        { label: "Fenntartás", text: "A futási eredmények egyetlen magparaméterezéssel készültek, ismétlés nélkül." },
      ],
      rating: "B",
    },
    {
      criterion: "analytical_execution",
      title: "Végrehajtás és implementáció minősége",
      lead: "Az implementáció átgondolt, a szimulációs környezet jól paraméterezhető.",
      bullets: [
        { label: "Szoftverminőség", text: "Moduláris ROS-alapú megvalósítás, konfigurációs fájlokkal és automatizált kiértékeléssel." },
        { label: "Számítási korlát", text: "A tervező futásideje minden vizsgált helyzetben a valós idejű korlát alatt marad." },
      ],
      rating: "A",
    },
    {
      criterion: "limitations_future_work",
      title: "Korlátok és továbbfejlesztési lehetőségek",
      lead: "A korlátok őszinte bemutatása erősíti a dolgozat hitelességét.",
      bullets: [
        { label: "Korlátok", text: "A szerző maga mutatja meg azokat a zsúfolt helyzeteket, ahol a tervező nem ad megoldást." },
        { label: "Továbbfejlesztés", text: "Konkrét, megvalósítható javaslatok valós járművön végzett mérésekre." },
      ],
      rating: "B",
    },
  ],
  strengths: [
    { label: "Gyakorlatias szemlélet", text: "A vizsgálatok valósághű érzékelési bizonytalansággal készültek, nem idealizált környezetben." },
    { label: "Őszinte értékelés", text: "A szerző bemutatja a tervező kudarcait is, nem csak a sikeres eseteket." },
    { label: "Jól dokumentált szoftver", text: "A szimulációs környezet és a kiértékelés reprodukálható módon dokumentált." },
  ],
  citations: [
    { label: "Hiányzó azonosítók", text: "Hat hivatkozásnál hiányzik a DOI vagy más állandó azonosító." },
    { label: "Konferencianevek", text: "Három tételnél a konferencianevek rövidítése eltér a dolgozat többi részétől." },
    { label: "Saját forrás", text: "A szerző korábbi TDK-dolgozata szerepel a jegyzékben, de a szövegben nem különül el." },
  ],
  questions: [
    "Hogyan viselkedik a tervező, ha a prediktív forgalmi modell előrejelzése szisztematikusan téves?",
    "Milyen módon bizonyítaná, hogy a futásidő a valós idejű korlát alatt marad gyorsabb járműdinamika esetén is?",
    "Milyen biztonsági tartalékot építene be, mielőtt az algoritmust valós járműre telepítené?",
  ],
}

const SPECS: Record<string, PosudokSpec> = {
  "posudok-sk": SK,
  "posudok-cs": CS,
  "posudok-en": EN,
  "posudok-de": DE,
  "posudok-pl": PL,
  "posudok-hu": HU,
}

/**
 * Curated posudok for a thesis-review template, or `null` for other output
 * types (whose galleries live in `template-showcase-data`).
 */
export function posudokGalleryFor(templateId: string): OutputConfig | null {
  const def = getTemplateDef(templateId)
  if (!def || def.outputType !== "thesis-review") return null
  const spec = SPECS[templateId]
  if (!spec) return null

  return {
    id: `out_gallery_${templateId}`,
    outputType: "thesis-review",
    templateId,
    title: spec.thesisTitle,
    // The output author is the *reviewer*: they sign the posudok. The student
    // is named by the identification card.
    authors: `${spec.reviewer} (${spec.labels.reviewerRole})`,
    venue: spec.venue,
    logoUrl: null,
    secondaryLogoUrl: null,
    themeColor: def.colors?.[0]?.hex ?? null,
    cards: cardsFor(templateId, spec),
  }
}

/**
 * References attached to a posudok.
 *
 * A review does not cite a research bibliography; it documents the thesis it
 * assessed, so each gallery ships the thesis itself as its bibliography entry
 * (the reviewer's own works, where they are relevant, are named by the cards).
 */
export function posudokGalleryBibEntriesFor(templateId: string): BibEntry[] {
  const spec = SPECS[templateId]
  if (!spec) return []
  const author = spec.student.replace(/^(Bc\.|Ing\.|Mgr\.)\s*/, "")
  return [
    {
      id: `thesis_${templateId.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      key: `thesis_${templateId.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      type: "mastersthesis",
      title: spec.thesisTitle,
      authors: [author],
      authorString: author,
      year: spec.academicYear.slice(0, 4),
      journal: spec.venue.split(",")[0],
      rawBibtex: `@mastersthesis{thesis_${templateId.replace(/[^a-z0-9]/gi, "").toLowerCase()},\n  author = {${author}},\n  title = {${spec.thesisTitle}},\n  school = {${spec.venue.split(",")[0]}},\n  year = {${spec.academicYear.slice(0, 4)}},\n  type = {${spec.thesisType}}\n}`,
    },
  ]
}

/** Every thesis-review template that ships a curated posudok. */
export function posudokGalleryTemplateIds(): string[] {
  return Object.keys(SPECS)
}
