/**
 * Versioned Rubric & Applicability Engine for Academic Thesis Review.
 *
 * Implements the Slovak Academic Rubric v1 (sk-academic-v1) with discipline-aware
 * applicability, minimum evidence requirements, caution guidance, and ECTS scoring.
 */

import type { ReviewLanguage, ThesisType, CriterionRating } from "./thesis-rubric"
import type { DetailedThesisType } from "./document-understanding"

export interface RubricCriterionConfig {
  id: string
  key: string
  category: "problem" | "theory" | "methodology" | "results" | "formal" | "impact" | "defense"
  weight: number
  labels: Record<ReviewLanguage, string>
  description: Record<ReviewLanguage, string>
  expectedEvidence: Record<ReviewLanguage, string[]>
  commonWeaknesses: Record<ReviewLanguage, string[]>
  cautionGuidance: Record<ReviewLanguage, string>
  prohibitedInferences: Record<ReviewLanguage, string[]>
  applicabilityRule: (thesisType: DetailedThesisType) => "applicable" | "partially_applicable" | "not_applicable"
}

export interface ReviewRubricDefinition {
  id: string
  slug: string
  version: string
  name: Record<ReviewLanguage, string>
  description: Record<ReviewLanguage, string>
  criteria: RubricCriterionConfig[]
}

export const SK_ACADEMIC_RUBRIC_V1: ReviewRubricDefinition = {
  id: "rubric-sk-academic-v1",
  slug: "sk-academic-v1",
  version: "1.0.0",
  name: {
    sk: "Štandardné slovenské univerzitné kritériá (v1.0)",
    cs: "Standardní akademická kritéria (v1.0)",
    en: "Standard Slovak University Academic Rubric (v1.0)",
  },
  description: {
    sk: "Komplexné hodnotenie záverečných a dizertačných prác podľa štandardov akreditácie vysokých škôl.",
    cs: "Komplexní hodnocení závěrečných a disertačních prací dle vysokoškolských standardů.",
    en: "Comprehensive final thesis assessment rubric aligned with university accreditation standards.",
  },
  criteria: [
    {
      id: "problem_relevance",
      key: "problem_relevance",
      category: "problem",
      weight: 5,
      labels: {
        sk: "Aktuálnosť a formulácia problému",
        cs: "Aktuálnost a formulace problému",
        en: "Relevance and problem formulation",
      },
      description: {
        sk: "Vymedzenie výskumného problému, odôvodnenie aktuálnosti a spoločenskej alebo odbornej potreby témy.",
        cs: "Vymezení výzkumného problému, zdůvodnění aktuálnosti a odborné potřebnosti.",
        en: "Definition of the research problem, justification of relevance and domain significance.",
      },
      expectedEvidence: {
        sk: [
          "Jasné zdôvodnenie výberu témy v úvode",
          "Kontextualizácia voči súčasnému stavu poznania",
          "Formulácia konkrétnej výskumnej medzery (research gap)",
        ],
        cs: [
          "Jasné zdůvodnění výběru tématu v úvodu",
          "Kontextualizace vůči současnému stavu poznání",
          "Formulace výzkumné mezery",
        ],
        en: [
          "Clear justification of topic selection in introduction",
          "Contextualization against state of the art",
          "Formulation of a concrete research gap",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Vágne alebo príliš široké vymedzenie témy bez špecifikácie problému",
          "Chýbajúce odôvodnenie praktického alebo teoretického významu",
        ],
        cs: [
          "Vágní nebo příliš široké vymezení tématu",
          "Chybějící zdůvodnění významu",
        ],
        en: [
          "Vague or overly broad topic scope without precise problem definition",
          "Missing justification of practical or theoretical value",
        ],
      },
      cautionGuidance: {
        sk: "Absencia explicitnej vety 'Cieľom je' v úvode nemusí znamenať absenciu problému; overte celkový úvodný kontext.",
        cs: "Absence explicitní věty nemusí znamenat absenci problému.",
        en: "Absence of a specific phrasing does not prove absence of problem framing.",
      },
      prohibitedInferences: {
        sk: [
          "Nezamieňajte stručnosť úvodu za neznalosť problematiky bez analýzy ďalších kapitol.",
        ],
        cs: [
          "Nezaměňujte stručnost úvodu za neznalost problematiky.",
        ],
        en: [
          "Do not infer lack of domain knowledge solely from concise introductory text.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "objectives_clarity",
      key: "objectives_clarity",
      category: "problem",
      weight: 5,
      labels: {
        sk: "Jasnosť cieľov a výskumných otázok",
        cs: "Jasnost cílů a výzkumných otázek",
        en: "Clarity of objectives and research questions",
      },
      description: {
        sk: "Formulácia hlavného cieľa, čiastkových cieľov, výskumných otázok alebo hypotéz.",
        cs: "Formulace hlavního cíle, dílčích cílů, výzkumných otázek nebo hypotéz.",
        en: "Formulation of primary objective, sub-goals, research questions, or hypotheses.",
      },
      expectedEvidence: {
        sk: [
          "Explicitne vyjadrený hlavný cieľ práce",
          "Dekompozícia na merateľné čiastkové ciele",
          "Výskumné otázky (VO) alebo testovateľné hypotézy",
        ],
        cs: [
          "Explicitně vyjádřený hlavní cíl",
          "Strukturované dílčí cíle",
          "Výzkumné otázky nebo testovatelné hypotézy",
        ],
        en: [
          "Explicitly stated primary thesis goal",
          "Decomposition into measurable sub-goals",
          "Research questions or testable hypotheses",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Ciele sú definované ako procesné činnosti (napr. 'prečítať literatúru') namiesto výstupov",
          "Nekonzistentnosť medzi cieľmi v úvode a dosiahnutými výsledkami",
        ],
        cs: [
          "Cíle formulované jako činnosti namísto výsledků",
          "Nekonzistence mezi cíli a výsledky",
        ],
        en: [
          "Goals defined as activities rather than measurable outcomes",
          "Inconsistency between introductory goals and actual findings",
        ],
      },
      cautionGuidance: {
        sk: "V aplikačných prácach môžu byť ciele formulované ako technické požiadavky na systém.",
        cs: "V technických pracích mohou být cíle formulovány jako systémové požadavky.",
        en: "In engineering theses, objectives may be phrased as functional system requirements.",
      },
      prohibitedInferences: {
        sk: [
          "Nevyžadujte formálne hypotézy pri čisto deskriptívnom alebo vývojovom projekte.",
        ],
        cs: [
          "Nevyžadujte formální hypotézy u vývojového projektu.",
        ],
        en: [
          "Do not mandate statistical hypotheses for pure software/engineering design projects.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "theoretical_background",
      key: "theoretical_background",
      category: "theory",
      weight: 15,
      labels: {
        sk: "Teoretické východiská a rešerš literatúry",
        cs: "Teoretická východiska a rešerše literatury",
        en: "Theoretical background and literature review",
      },
      description: {
        sk: "Kvalita spracovania teórie, prehľad domácej a zahraničnej odbornej literatúry a kritická syntéza.",
        cs: "Kvalita teoretické části, přehled literatury a kritická syntéza.",
        en: "Quality of theoretical framework, coverage of literature, and critical synthesis.",
      },
      expectedEvidence: {
        sk: [
          "Kritické porovnanie viacerých zdrojov a prístupov",
          "Zahrnutie recentných zdrojov (posledných 5 rokov)",
          "Definícia kľúčových pojmov a teoretických modelov",
        ],
        cs: [
          "Kritické srovnání zdrojů",
          "Zahrnutí aktuálních publikací",
          "Definice klíčových pojmů",
        ],
        en: [
          "Critical synthesis of multiple peer-reviewed sources",
          "Inclusion of recent literature (last 5 years)",
          "Clear definition of concepts and theoretical grounding",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Iba encyklopedický alebo kompilátorský popis bez vlastného kritického postoja",
          "Zastarané alebo neodborné internetové zdroje (napr. blogy, Wikipedia)",
        ],
        cs: [
          "Pouhý kompilační výčet bez syntézy",
          "Zastaralé nebo neodborné zdroje",
        ],
        en: [
          "Pure encyclopedic compilation lacking critical comparative synthesis",
          "Over-reliance on outdated or non-peer-reviewed web links",
        ],
      },
      cautionGuidance: {
        sk: "Označte ako MISSING_EVIDENCE, pokiaľ je teoretická časť v parsovanom texte len čiastočne zachytená.",
        cs: "Označte jako MISSING_EVIDENCE při neúplném parsování.",
        en: "Classify as MISSING_EVIDENCE if literature chapters were partially truncated.",
      },
      prohibitedInferences: {
        sk: [
          "Netvrďte, že autor nečítal kľúčové diela, pokiaľ cituje ich etablované alternatívy.",
        ],
        cs: [
          "Netvrďte absenci zdrojů, pokud jsou citovány relevantní alternativy.",
        ],
        en: [
          "Do not allege lack of scholarship if credible alternative literature is cited.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "methodology_rigor",
      key: "methodology_rigor",
      category: "methodology",
      weight: 15,
      labels: {
        sk: "Metodologická primeranosť a postup riešenia",
        cs: "Metodologická přiměřenost a postup řešení",
        en: "Methodological appropriateness and procedure",
      },
      description: {
        sk: "Výber a odôvodnenie metód, opis výskumného postupu, výber vzorky, nástrojov a overovania.",
        cs: "Volba a zdůvodnění metod, výzkumný postup a nástroje.",
        en: "Selection and rationale of methods, procedure description, sample/materials, and validation.",
      },
      expectedEvidence: {
        sk: [
          "Explicitné zdôvodnenie zvolenej metodiky",
          "Podrobný popis postupu zberu a spracovania dát alebo návrhu systému",
          "Diskusia o spoľahlivosti, validite alebo replikovateľnosti",
        ],
        cs: [
          "Zdůvodnění metodiky",
          "Popis postupu sběru dat či návrhu",
          "Validita a replikovatelnost",
        ],
        en: [
          "Explicit justification of methodological choices",
          "Detailed description of data collection / system design procedures",
          "Transparency regarding validity, reliability, or reproducibility",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Chýbajúce odôvodnenie, prečo boli použité konkrétne algoritmy, nástroje či vzorka",
          "Neprehľadný alebo nedostatočne zdokumentovaný postup",
        ],
        cs: [
          "Chybějící zdůvodnění volby metod",
          "Nepřehledný postup",
        ],
        en: [
          "Missing rationale for selected algorithms, tools, or cohort",
          "Undocumented or opaque experimental pipeline",
        ],
      },
      cautionGuidance: {
        sk: "Absencia v parsovanom texte nie je dôkazom absencie v celom PDF; overte, či sekcia Metodika nebola označená iným nadpisom.",
        cs: "Absence v textu není důkazem nepřítomnosti v originálu.",
        en: "Missing text in parser excerpt is not conclusive proof of total absence.",
      },
      prohibitedInferences: {
        sk: [
          "Nekritizujte absenciu štatistických testov v kvalitatívnom alebo vývojovom dizajne.",
        ],
        cs: [
          "Nekritizujte absenci statistiky u kvalitativního výzkumu.",
        ],
        en: [
          "Do not penalize qualitative or software engineering work for omitting statistical hypothesis tests.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "analytical_execution",
      key: "analytical_execution",
      category: "methodology",
      weight: 10,
      labels: {
        sk: "Realizácia a analytická dôslednosť",
        cs: "Realizace a analytická důslednost",
        en: "Execution and analytical rigor",
      },
      description: {
        sk: "Kvalita realizácie výskumu, spracovania dát, softvérového kódu, experimentálnych meraní.",
        cs: "Kvalita realizace výzkumu, zpracování dat, experimentů či kódu.",
        en: "Quality of research execution, data processing, code implementation, and experimental runs.",
      },
      expectedEvidence: {
        sk: [
          "Dôsledné a bezchybné vykonanie plánovaných krokov",
          "Správne použitie analytických nástrojov, štatistiky alebo programovacích technológií",
          "Ošetrenie chybových stavov alebo okrajových podmienok",
        ],
        cs: [
          "Důsledné provedení plánovaných kroků",
          "Správné použití nástrojů",
          "Ošetření okrajových podmínek",
        ],
        en: [
          "Rigorous execution of planned experimental/developmental steps",
          "Correct application of analytical tools or programming frameworks",
          "Proper handling of edge cases and error bounds",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Povrchná realizácia, neúplné experimenty alebo nedokončený softvérový modul",
          "Zjavné logické či kalkulačné chyby v analýze",
        ],
        cs: [
          "Povrchní realizace, nedokončený modul",
          "Chyby v kalkulacích či logice",
        ],
        en: [
          "Superficial execution or incomplete feature modules",
          "Calculation errors or unaddressed experimental artifacts",
        ],
      },
      cautionGuidance: {
        sk: "Hodnoťte len doloženú realizáciu; nepripisujte chyby softvéru bez konkrétneho dôkazu v texte práce.",
        cs: "Hodnoťte pouze doloženou realizaci.",
        en: "Evaluate only evidenced execution; do not speculate on unverified runtime errors.",
      },
      prohibitedInferences: {
        sk: [
          "Neusudzujte na zlú kvalitu kódu len na základe stručného diagramu.",
        ],
        cs: [
          "Neusuzujte na kvalitu kódu jen ze schématu.",
        ],
        en: [
          "Do not infer low code quality purely from high-level architecture diagrams.",
        ],
      },
      applicabilityRule: (t) => (t === "theoretical" ? "partially_applicable" : "applicable"),
    },
    {
      id: "results_validity",
      key: "results_validity",
      category: "results",
      weight: 10,
      labels: {
        sk: "Validita výsledkov a interpretácia",
        cs: "Validita výsledků a interpretace",
        en: "Validity of results and interpretation",
      },
      description: {
        sk: "Prezentácia dosiahnutých výsledkov, ich interpretácia, presnosť a vecná správnosť záverov.",
        cs: "Prezentace výsledků, interpretace a správnost závěrů.",
        en: "Presentation of achieved results, objective interpretation, and correctness of findings.",
      },
      expectedEvidence: {
        sk: [
          "Prehľadná prezentácia dát v tabuľkách, grafoch alebo modeloch",
          "Objektívna interpretácia bez nepodložených zovšeobecnení",
          "Priame prepojenie výsledkov na stanovené ciele",
        ],
        cs: [
          "Přehledná prezentace dat",
          "Objektivní interpretace",
          "Napojení výsledků na cíle",
        ],
        en: [
          "Clear presentation of data in tables/graphs/models",
          "Objective interpretation without over-generalization",
          "Direct mapping from results back to stated objectives",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Neprehľadná prezentácia bez popisu grafov či tabuliek",
          "Prehnané alebo nepodložené závery nepodporené dátami",
        ],
        cs: [
          "Nepřehledná prezentace dat",
          "Přehnané závěry bez opory v datech",
        ],
        en: [
          "Unclear data representation without explanatory captions",
          "Overstated conclusions unsupported by empirical evidence",
        ],
      },
      cautionGuidance: {
        sk: "Každé tvrdenie o chybnej interpretácii musí citovať konkrétny výrok autora a doložiť dôvod rozporu.",
        cs: "Každé tvrzení o chybě musí citovat konkrétní výrok.",
        en: "Any criticism of invalid interpretation must quote the specific claim.",
      },
      prohibitedInferences: {
        sk: [
          "Netvrďte, že výsledky sú neplatné, pokiaľ autor sám uviedol obmedzenia ich platnosti.",
        ],
        cs: [
          "Netvrďte neplatnost, pokud autor sám uvedl limity.",
        ],
        en: [
          "Do not allege invalidity if the author explicitly noted corresponding scope limitations.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "discussion_relation",
      key: "discussion_relation",
      category: "results",
      weight: 10,
      labels: {
        sk: "Diskusia a nadväznosť na ciele",
        cs: "Diskuse a vazba na cíle",
        en: "Discussion and relation to objectives",
      },
      description: {
        sk: "Kritická diskusia výsledkov, porovnanie s inými autormi, zhodnotenie splnenia cieľov.",
        cs: "Kritická diskuse, srovnání s literaturou, zhodnocení cílů.",
        en: "Critical discussion of findings, comparison with existing literature, and evaluation of goal fulfillment.",
      },
      expectedEvidence: {
        sk: [
          "Porovnanie vlastných zistení s publikovanými výsledkami iných autorov",
          "Zhodnotenie miery naplnenia každého čiastkového cieľa",
          "Identifikácia neočakávaných zistení a anomálií",
        ],
        cs: [
          "Srovnání s publikovanými výsledky",
          "Zhodnocení naplnění dílčích cílů",
          "Reflexe anomálií",
        ],
        en: [
          "Comparison of own findings against external literature baselines",
          "Systematic assessment of each sub-goal's fulfillment",
          "Reflection on unexpected findings or discrepancies",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Diskusia je len zopakovaním výsledkov bez ich konfrontácie s literatúrou",
          "Chýba reflexia toho, či boli všetky ciele reálne splnené",
        ],
        cs: [
          "Diskuse pouze opakuje výsledky",
          "Chybí konfrontace s literaturou",
        ],
        en: [
          "Discussion merely restates results without literature benchmarking",
          "Failure to reflect on whether all stated goals were genuinely achieved",
        ],
      },
      cautionGuidance: {
        sk: "V niektorých prácach je diskusia spojená s výsledkami do jednej kapitoly (Výsledky a diskusia).",
        cs: "Diskuse může být spojena s výsledky v jedné kapitole.",
        en: "Discussion may be combined with results in a joint chapter.",
      },
      prohibitedInferences: {
        sk: [
          "Neoznačujte diskusiu za chýbajúcu, ak je integrovaná v kapitole Výsledky.",
        ],
        cs: [
          "Neoznačujte diskusi za chybějící při společné kapitole.",
        ],
        en: [
          "Do not claim discussion is absent if integrated directly in the results chapter.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "originality_contribution",
      key: "originality_contribution",
      category: "impact",
      weight: 10,
      labels: {
        sk: "Originalita a prínos práce",
        cs: "Originalita a přínos práce",
        en: "Originality and contribution",
      },
      description: {
        sk: "Miera samostatného autorského prínosu, inovatívnosť a prínos pre vedu alebo prax.",
        cs: "Míra vlastního přínosu, inovativnost a přínos pro vědu či praxi.",
        en: "Extent of original author contribution, innovation, and value for science or industry.",
      },
      expectedEvidence: {
        sk: [
          "Jasne identifikovaný vlastný autorský vklad",
          "Nový teoretický poznatok, metodický postup, softvér alebo experimentálne dáta",
          "Využiteľnosť výstupov v aplikačnej praxi",
        ],
        cs: [
          "Jasný autorský vklad",
          "Nový poznatek či funkční výstup",
          "Využitelnost v praxi",
        ],
        en: [
          "Distinctly attributable author contribution",
          "Novel insight, methodology, software artifact, or dataset",
          "Practical applicability and transferability of outputs",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Nízka pridaná hodnota, práca len mechanicky opakuje existujúce postupy",
          "Nejasné vymedzenie medzi prevzatým a vlastným materiálom",
        ],
        cs: [
          "Nízká přidaná hodnota",
          "Nejasná hranice mezi převzatým a vlastním",
        ],
        en: [
          "Low added value beyond mechanical replication",
          "Ambiguous boundary between cited baseline work and novel contribution",
        ],
      },
      cautionGuidance: {
        sk: "Od bakalárskych prác sa neočakáva prelomový vedecký objav, ale kvalitná samostatná aplikácia poznatkov.",
        cs: "U bakalářských prací se očekává samostatná aplikace, nikoli vědecký průlom.",
        en: "For bachelor theses, evaluate competent execution rather than pioneering scientific breakthroughs.",
      },
      prohibitedInferences: {
        sk: [
          "Nekritizujte bakalársku prácu za absenciu publikácie v karentovanom časopise.",
        ],
        cs: [
          "Nekritizujte bakalářskou práci za absenci mezinárodní publikace.",
        ],
        en: [
          "Do not penalize undergraduate work for lack of indexed journal publications.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "structure_coherence",
      key: "structure_coherence",
      category: "formal",
      weight: 5,
      labels: {
        sk: "Štruktúra, koherencia a odborný štýl",
        cs: "Struktura, koherence a odborný styl",
        en: "Structure, coherence, and academic writing",
      },
      description: {
        sk: "Logická stavba textu, proporcionalita kapitol, gramatická správnosť a akademický štýl.",
        cs: "Logická stavba textu, proporcionalita, gramatika a akademický styl.",
        en: "Logical chapter structure, proportionality, grammar, and academic register.",
      },
      expectedEvidence: {
        sk: [
          "Logická nadväznosť jednotlivých častí práce",
          "Vyvážený rozsah jednotlivých kapitol",
          "Spisovný jazyk, správna odborná terminológia a typografia",
        ],
        cs: [
          "Logická návaznost",
          "Vyvážený rozsah kapitol",
          "Spisovný jazyk a terminologie",
        ],
        en: [
          "Coherent and logical progression across sections",
          "Proportionate chapter lengths",
          "Appropriate academic terminology, tone, and grammar",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Nesúvislý text s častými odbočkami, neprimerane dlhé alebo príliš krátke kapitoly",
          "Hovorové výrazy, gramatické chyby a nejednotné formátovanie",
        ],
        cs: [
          "Nesouvislý text a stylistické chyby",
          "Nejednotné formátování",
        ],
        en: [
          "Fragmented structure with jarring transitions or disproportional chapters",
          "Informal register, recurring grammatical slips, or inconsistent formatting",
        ],
      },
      cautionGuidance: {
        sk: "Zohľadnite prípadný cudzí jazyk práce (angličtina u nerodilého hovoriaceho).",
        cs: "Zohledněte cizí jazyk práce.",
        en: "Take into account non-native English writing while focusing on semantic clarity.",
      },
      prohibitedInferences: {
        sk: [
          "Nezamieňajte formálne chyby parsovania PDF za gramatické chyby študenta.",
        ],
        cs: [
          "Nezaměňujte chyby parsování za chyby autora.",
        ],
        en: [
          "Do not mistake PDF extraction artifacts for author typos.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "citations_quality",
      key: "citations_quality",
      category: "formal",
      weight: 5,
      labels: {
        sk: "Kvalita citácií a zoznam literatúry",
        cs: "Kvalita citací a seznam literatury",
        en: "Citation and bibliography quality",
      },
      description: {
        sk: "Dodržiavanie citačnej normy (ISO 690 / APA / IEEE), úplnosť bibliografie a etika citovania.",
        cs: "Dodržování citační normy, úplnost bibliografie a etika.",
        en: "Adherence to citation standards (ISO 690 / APA / IEEE), bibliography completeness, and citation ethics.",
      },
      expectedEvidence: {
        sk: [
          "Konzistentný citačný štýl v celom dokumente",
          "Každý zdroj v texte má záznam v zozname literatúry",
          "Dostatočné zastúpenie relevantných odborných zdrojov",
        ],
        cs: [
          "Konzistentní citační styl",
          "Spárování citací se seznamem literatury",
          "Relevantní odborné zdroje",
        ],
        en: [
          "Consistent citation style throughout document",
          "Every in-text citation correctly resolved in reference list",
          "Appropriate density of peer-reviewed primary sources",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Nekonzistentné formáty záznamov, chýbajúce roky vydania, autori alebo DOI",
          "Odkazy v texte, ktoré chýbajú v zozname literatúry",
        ],
        cs: [
          "Nekonzistentní formáty záznamů",
          "Nespárované citace",
        ],
        en: [
          "Inconsistent bibliographic formatting, missing publication years or DOIs",
          "In-text citation markers missing in references list",
        ],
      },
      cautionGuidance: {
        sk: "Mechanické rozdiely vo formátovaní označte ako drobné, pokiaľ je zdroj dohľadateľný.",
        cs: "Drobné formální rozdíly nepřeceňujte.",
        en: "Treat mechanical formatting variations as minor if the cited source is unambiguously identifiable.",
      },
      prohibitedInferences: {
        sk: [
          "Netvrďte, že citácia je neplatná, pokiaľ zlyhalo len externé vyhľadávanie v databáze.",
        ],
        cs: [
          "Netvrďte neplatnost při selhání externího vyhledávání.",
        ],
        en: [
          "Do not allege fake citations solely because an external API lookup timed out.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "ethics_transparency",
      key: "ethics_transparency",
      category: "formal",
      weight: 5,
      labels: {
        sk: "Etika, reprodukovateľnosť a transparentnosť dát",
        cs: "Etika, reprodukovatelnost a data",
        en: "Ethics, reproducibility, and data transparency",
      },
      description: {
        sk: "Dodržanie etických zásad výskumu, ochrana osobných údajov, dostupnosť dát a kódu.",
        cs: "Dodržení etických zásad, ochrana údajů, dostupnost dat.",
        en: "Adherence to research ethics, data protection, and open science / artifact availability.",
      },
      expectedEvidence: {
        sk: [
          "Čestné vyhlásenie o samostatnom vypracovaní",
          "Informovaný súhlas účastníkov pri výskume na ľuďoch",
          "Odkaz na repozitár so zdrojovým kódom alebo datasetom (ak relevantné)",
        ],
        cs: [
          "Čestné prohlášení",
          "Informovaný souhlas",
          "Odkaz na data/kód",
        ],
        en: [
          "Declaration of academic integrity and originality",
          "Informed consent disclosures for human subjects",
          "Public/institutional links to code repository or datasets where applicable",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Chýbajúca informácia o etickom schválení pri práci s citlivými dátami",
          "Nedostupnosť podkladových dát potrebných na overenie výsledkov",
        ],
        cs: [
          "Chybějící etické schválení",
          "Nedostupnost dat",
        ],
        en: [
          "Omission of ethical oversight details for sensitive human data",
          "Lack of access to underlying artifacts preventing empirical replication",
        ],
      },
      cautionGuidance: {
        sk: "V teoretických a rešeršných prácach je toto kritérium viazané primárne na čestné vyhlásenie.",
        cs: "U teoretických prací se váže k čestnému prohlášení.",
        en: "In theoretical theses, this criterion focuses on academic integrity declarations.",
      },
      prohibitedInferences: {
        sk: [
          "Neobviňujte autora z etického pochybenia bez explicitného dôkazu.",
        ],
        cs: [
          "Neobviňujte bez explicitního důkazu.",
        ],
        en: [
          "Never allege ethical breach without explicit proof in the source document.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
    {
      id: "limitations_future_work",
      key: "limitations_future_work",
      category: "results",
      weight: 5,
      labels: {
        sk: "Limity práce a návrhy do budúcna",
        cs: "Limity práce a výhled do budoucna",
        en: "Limitations and future work",
      },
      description: {
        sk: "Kritické sebahodnotenie obmedzení výskumu, metodických limitov a návrhy ďalšieho smerovania.",
        cs: "Kritické sebehodnocení limitů a návrhy dalšího výzkumu.",
        en: "Critical self-assessment of research constraints, methodological boundaries, and future directions.",
      },
      expectedEvidence: {
        sk: [
          "Explicitná diskusia o limitoch metód, dát a rozsahu práce",
          "Konkrétne a realizovateľné návrhy na pokračovanie výskumu",
        ],
        cs: [
          "Diskuse limitů a rozsahu",
          "Konkrétní návrhy na pokračování",
        ],
        en: [
          "Explicit reflection on data, methodological, and scope limitations",
          "Actionable suggestions for future research extensions",
        ],
      },
      commonWeaknesses: {
        sk: [
          "Úplná absencia sebareflexie alebo zľahčovanie zjavných limitov",
          "Vágne a formálne návrhy do budúcna bez konkrétneho obsahu",
        ],
        cs: [
          "Absence sebereflexe",
          "Vágní návrhy dalšího postupu",
        ],
        en: [
          "Total absence of self-critical reflection or dismissal of obvious scope bounds",
          "Generic and superficial future work platitudes",
        ],
      },
      cautionGuidance: {
        sk: "Uvedenie limitov autorom je znakom vedeckej zrelosti, nie slabinou práce.",
        cs: "Uvedení limitů je známkou vyzrálosti.",
        en: "Author-acknowledged limitations demonstrate academic maturity, not automatic flaws.",
      },
      prohibitedInferences: {
        sk: [
          "Netrestajte autora znížením známky za to, že poctivo pomenoval limity svojej práce.",
        ],
        cs: [
          "Netrestejte poctivé pojmenování limitů.",
        ],
        en: [
          "Do not penalize an author for candid and rigorous disclosure of study limitations.",
        ],
      },
      applicabilityRule: () => "applicable",
    },
  ],
}

/**
 * Returns active criteria configured with dynamic weights and applicability for a thesis type.
 */
export function getApplicableCriteriaForThesisType(
  thesisType: DetailedThesisType,
  rubric: ReviewRubricDefinition = SK_ACADEMIC_RUBRIC_V1
): Array<{ criterion: RubricCriterionConfig; applicability: "applicable" | "partially_applicable" | "not_applicable" }> {
  return rubric.criteria.map((criterion) => {
    const applicability = criterion.applicabilityRule(thesisType)
    return {
      criterion,
      applicability,
    }
  })
}

/**
 * Converts a numeric score (0-100) or score range to an ECTS grade.
 */
export function calculateGradeRange(score: number): { grade: CriterionRating; range: string; minScore: number; maxScore: number } {
  const minScore = Math.max(0, score - 5)
  const maxScore = Math.min(100, score + 5)

  let grade: CriterionRating = "A"
  if (score >= 90) grade = "A"
  else if (score >= 80) grade = "B"
  else if (score >= 70) grade = "C"
  else if (score >= 60) grade = "D"
  else if (score >= 50) grade = "E"
  else grade = "FX"

  const minGrade = minScore >= 90 ? "A" : minScore >= 80 ? "B" : minScore >= 70 ? "C" : minScore >= 60 ? "D" : minScore >= 50 ? "E" : "FX"
  const maxGrade = maxScore >= 90 ? "A" : maxScore >= 80 ? "B" : maxScore >= 70 ? "C" : maxScore >= 60 ? "D" : maxScore >= 50 ? "E" : "FX"

  const range = minGrade === maxGrade ? minGrade : `${minGrade} – ${maxGrade}`

  return { grade, range, minScore, maxScore }
}

/**
 * Maps granular rubric criteria (12 from SK_ACADEMIC_RUBRIC_V1 + formal_language)
 * to the display/export criteria (7 core criteria from THESIS_CRITERIA).
 */
export const RUBRIC_CRITERIA_MAP: Record<string, string> = {
  problem_relevance: "goal_definition",
  objectives_clarity: "goal_definition",
  theoretical_background: "goal_definition",
  methodology_rigor: "methodology",
  analytical_execution: "methodology",
  results_validity: "results",
  discussion_relation: "results",
  limitations_future_work: "results",
  originality_contribution: "originality",
  structure_coherence: "formal_structure",
  citations_quality: "citations_bibliography",
  ethics_transparency: "formal_structure",
  formal_language: "language_quality",
}

export const NO_FINDINGS_SYNTHESIS: Record<ReviewLanguage, string> = {
  sk: "V tejto oblasti neboli identifikované žiadne zásadné nedostatky. Práca spĺňa stanovené požiadavky na primeranej úrovni.",
  cs: "V této oblasti nebyly identifikovány žádné zásadní nedostatky. Práce splňuje stanovené požadavky na odpovídající úrovni.",
  en: "No significant deficiencies were identified in this area. The thesis meets the established requirements at an appropriate standard.",
}

export function mapRubricCriterionToDisplay(criterionIdOrKey: string): string {
  return RUBRIC_CRITERIA_MAP[criterionIdOrKey] || criterionIdOrKey
}

const ECTS_TO_SCORE: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, E: 55, FX: 20 }
// Starting value; needs empirical tuning
export const HARSH_OUTLIER_THRESHOLD = 20
export const GRADE_DIVERGENCE_THRESHOLD = 15

export interface GradeReconciliationResult {
  grade: string
  note?: string
  harshOutlierDivergence?: boolean
  divergenceDelta?: number
  divergenceWarning?: string
}

/**
 * Reconciles the LLM's free-text self-reported grade against the evidence-derived
 * score. Never allows the saved grade to be more LENIENT than the derived grade by
 * more than GRADE_DIVERGENCE_THRESHOLD score points — a self-report that is harsher
 * than the derived score is left alone (erring conservative is safe).
 *
 * Additionally flags severe divergences (|selfScore - derivedScore| >= HARSH_OUTLIER_THRESHOLD)
 * with `harshOutlierDivergence: true` and a warning to alert the human reviewer.
 */
export function reconcileGrade(
  selfReportedGrade: string | undefined,
  derivedScore: number,
  derivedGrade: string
): GradeReconciliationResult {
  if (!selfReportedGrade || !(selfReportedGrade in ECTS_TO_SCORE)) {
    return { grade: derivedGrade }
  }
  const selfScore = ECTS_TO_SCORE[selfReportedGrade]
  const delta = Math.abs(selfScore - derivedScore)
  const isHarshOutlier = delta >= HARSH_OUTLIER_THRESHOLD

  const divergenceWarning = isHarshOutlier
    ? `Primary self-reported assessment (${selfReportedGrade}, ~${selfScore}) and evidence-derived score (${Math.round(derivedScore)} \u2192 ${derivedGrade}) diverged significantly (delta = ${Math.round(delta)} >= ${HARSH_OUTLIER_THRESHOLD}). Human reviewer should carefully verify findings before finalizing grade.`
    : undefined

  if (selfScore - derivedScore > GRADE_DIVERGENCE_THRESHOLD) {
    const note = `AI self-reported grade (${selfReportedGrade}, ~${selfScore}) was more lenient than the evidence-derived score (${Math.round(derivedScore)} \u2192 ${derivedGrade}) by more than ${GRADE_DIVERGENCE_THRESHOLD} points. Downgraded to the derived grade as the more conservative, evidence-grounded estimate.`
    return {
      grade: derivedGrade,
      note: divergenceWarning ? `${note}\n\n[Warning] ${divergenceWarning}` : note,
      harshOutlierDivergence: isHarshOutlier,
      divergenceDelta: Math.round(delta),
      divergenceWarning,
    }
  }

  return {
    grade: selfReportedGrade,
    note: divergenceWarning ? `[Warning] ${divergenceWarning}` : undefined,
    harshOutlierDivergence: isHarshOutlier,
    divergenceDelta: Math.round(delta),
    divergenceWarning,
  }
}

