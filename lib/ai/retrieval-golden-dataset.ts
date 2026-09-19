/**
 * Extended Graded Golden Retrieval Dataset (Phase 23)
 *
 * Contains 104 curated queries across Slovak, Czech, and English spanning:
 *   - STEM, particle physics, medical, computer science, economics, humanities
 *   - Multilingual query variations and diacritic forms
 *   - Graded relevance targets (0=irrelevant, 1=weak, 2=useful, 3=direct, 4=primary)
 */

import { GOLDEN_RETRIEVAL_SET, type GoldenQuery } from "./retrieval-eval"

export interface GradedTarget {
  sectionSubstring: string
  relevanceGrade: 1 | 2 | 3 | 4
}

export interface GradedGoldenQuery extends GoldenQuery {
  domain: "cs_ai" | "physics_stem" | "biomedical" | "economics_social" | "general_academic"
  gradedTargets: GradedTarget[]
  split: "train" | "val" | "test"
}

const EXTENDED_QUERIES: GradedGoldenQuery[] = [
  // --- Computer Science & AI ---
  {
    criterionId: "methodology_rigor",
    lang: "sk",
    domain: "cs_ai",
    query: "konvolučné neurónové siete trénovacie parametre optimalizátor Adam",
    expectedSections: ["tréning", "model", "neurón", "architekt"],
    gradedTargets: [
      { sectionSubstring: "tréning", relevanceGrade: 4 },
      { sectionSubstring: "architekt", relevanceGrade: 3 },
      { sectionSubstring: "model", relevanceGrade: 2 },
    ],
    split: "test",
  },
  {
    criterionId: "methodology_rigor",
    lang: "en",
    domain: "cs_ai",
    query: "transformer self-attention cross-entropy loss dropout regularization",
    expectedSections: ["model", "transformer", "attention", "method"],
    gradedTargets: [
      { sectionSubstring: "transformer", relevanceGrade: 4 },
      { sectionSubstring: "attention", relevanceGrade: 4 },
      { sectionSubstring: "method", relevanceGrade: 2 },
    ],
    split: "test",
  },
  {
    criterionId: "results_validity",
    lang: "sk",
    domain: "cs_ai",
    query: "F1-skóre matica zámen presnosť a návratnosť klasifikátora",
    expectedSections: ["výsledk", "vyhodnoten", "metrik", "f1"],
    gradedTargets: [
      { sectionSubstring: "f1", relevanceGrade: 4 },
      { sectionSubstring: "výsledk", relevanceGrade: 3 },
    ],
    split: "val",
  },
  {
    criterionId: "results_validity",
    lang: "en",
    domain: "cs_ai",
    query: "ablation study baseline comparison ROC AUC curve",
    expectedSections: ["ablation", "result", "baseline", "auc"],
    gradedTargets: [
      { sectionSubstring: "ablation", relevanceGrade: 4 },
      { sectionSubstring: "baseline", relevanceGrade: 3 },
      { sectionSubstring: "auc", relevanceGrade: 3 },
    ],
    split: "test",
  },
  {
    criterionId: "analytical_execution",
    lang: "cs",
    domain: "cs_ai",
    query: "předzpracování textu tokenizace lemmatizace embeddingy",
    expectedSections: ["předzprac", "metod", "token", "text"],
    gradedTargets: [
      { sectionSubstring: "token", relevanceGrade: 4 },
      { sectionSubstring: "předzprac", relevanceGrade: 3 },
    ],
    split: "train",
  },
  {
    criterionId: "analytical_execution",
    lang: "sk",
    domain: "cs_ai",
    query: "segmentácia obrazu detekcia hrán prahovanie filter",
    expectedSections: ["obraz", "segment", "filter", "metod"],
    gradedTargets: [
      { sectionSubstring: "segment", relevanceGrade: 4 },
      { sectionSubstring: "filter", relevanceGrade: 3 },
    ],
    split: "train",
  },

  // --- STEM & Physics ---
  {
    criterionId: "methodology_rigor",
    lang: "sk",
    domain: "physics_stem",
    query: "meranie účinného prierezu kalibrácia kalorimetra CERN",
    expectedSections: ["kalibr", "metod", "meran", "detektor"],
    gradedTargets: [
      { sectionSubstring: "kalibr", relevanceGrade: 4 },
      { sectionSubstring: "detektor", relevanceGrade: 3 },
      { sectionSubstring: "metod", relevanceGrade: 2 },
    ],
    split: "test",
  },
  {
    criterionId: "results_validity",
    lang: "sk",
    domain: "physics_stem",
    query: "rekonštrukcia dráh častíc p-value štatistická významnosť 5 sigma",
    expectedSections: ["výsledk", "častic", "štatist", "rekonštruk"],
    gradedTargets: [
      { sectionSubstring: "rekonštruk", relevanceGrade: 4 },
      { sectionSubstring: "štatist", relevanceGrade: 4 },
      { sectionSubstring: "výsledk", relevanceGrade: 3 },
    ],
    split: "test",
  },
  {
    criterionId: "analytical_execution",
    lang: "en",
    domain: "physics_stem",
    query: "Monte Carlo detector simulation Geant4 calibration",
    expectedSections: ["simulat", "geant", "calibrat", "method"],
    gradedTargets: [
      { sectionSubstring: "geant", relevanceGrade: 4 },
      { sectionSubstring: "simulat", relevanceGrade: 4 },
      { sectionSubstring: "calibrat", relevanceGrade: 3 },
    ],
    split: "val",
  },
  {
    criterionId: "results_validity",
    lang: "en",
    domain: "physics_stem",
    query: "Higgs boson branching ratio invariant mass peak",
    expectedSections: ["result", "invariant mass", "higgs", "peak"],
    gradedTargets: [
      { sectionSubstring: "higgs", relevanceGrade: 4 },
      { sectionSubstring: "invariant mass", relevanceGrade: 4 },
      { sectionSubstring: "peak", relevanceGrade: 3 },
    ],
    split: "test",
  },

  // --- Biomedical & Clinical ---
  {
    criterionId: "methodology_rigor",
    lang: "sk",
    domain: "biomedical",
    query: "výber vzorky kontrolná skupina randomizovaná štúdia",
    expectedSections: ["pacient", "vzork", "metodik", "skupin"],
    gradedTargets: [
      { sectionSubstring: "vzork", relevanceGrade: 4 },
      { sectionSubstring: "pacient", relevanceGrade: 3 },
    ],
    split: "train",
  },
  {
    criterionId: "results_validity",
    lang: "sk",
    domain: "biomedical",
    query: "prežívanie Kaplan-Meier p-hodnota Cohenovo d",
    expectedSections: ["výsledk", "prežív", "štatist", "kaplan"],
    gradedTargets: [
      { sectionSubstring: "kaplan", relevanceGrade: 4 },
      { sectionSubstring: "prežív", relevanceGrade: 4 },
    ],
    split: "test",
  },
  {
    criterionId: "methodology_rigor",
    lang: "en",
    domain: "biomedical",
    query: "double-blind controlled trial cohort selection criteria",
    expectedSections: ["method", "cohort", "trial", "selection"],
    gradedTargets: [
      { sectionSubstring: "cohort", relevanceGrade: 4 },
      { sectionSubstring: "trial", relevanceGrade: 4 },
    ],
    split: "val",
  },
  {
    criterionId: "ethics_transparency",
    lang: "sk",
    domain: "biomedical",
    query: "informovaný súhlas etická komisia anonymizácia pacientov",
    expectedSections: ["etik", "súhlas", "ochran", "komisi"],
    gradedTargets: [
      { sectionSubstring: "etik", relevanceGrade: 4 },
      { sectionSubstring: "súhlas", relevanceGrade: 4 },
    ],
    split: "train",
  },

  // --- Economics & Social Sciences ---
  {
    criterionId: "methodology_rigor",
    lang: "cs",
    domain: "economics_social",
    query: "ekonometrický model panelová regresie odhad parametrů",
    expectedSections: ["metodik", "model", "regres", "odhad"],
    gradedTargets: [
      { sectionSubstring: "regres", relevanceGrade: 4 },
      { sectionSubstring: "model", relevanceGrade: 3 },
    ],
    split: "train",
  },
  {
    criterionId: "results_validity",
    lang: "cs",
    domain: "economics_social",
    query: "multikolinearita Durbin-Watson koeficient determinace R2",
    expectedSections: ["výsledk", "test", "ekonometr", "regres"],
    gradedTargets: [
      { sectionSubstring: "test", relevanceGrade: 4 },
      { sectionSubstring: "regres", relevanceGrade: 3 },
    ],
    split: "test",
  },
  {
    criterionId: "theoretical_background",
    lang: "sk",
    domain: "economics_social",
    query: "teória hier Nashova rovnováha verejné statky",
    expectedSections: ["teór", "literat", "východisk"],
    gradedTargets: [
      { sectionSubstring: "teór", relevanceGrade: 4 },
      { sectionSubstring: "východisk", relevanceGrade: 3 },
    ],
    split: "train",
  },
  {
    criterionId: "analytical_execution",
    lang: "en",
    domain: "economics_social",
    query: "qualitative coding semi-structured interviews thematic analysis",
    expectedSections: ["qualitat", "interview", "method", "themat"],
    gradedTargets: [
      { sectionSubstring: "interview", relevanceGrade: 4 },
      { sectionSubstring: "themat", relevanceGrade: 4 },
    ],
    split: "val",
  },

  // --- Limitations & Threats to Validity ---
  {
    criterionId: "limitations_future_work",
    lang: "sk",
    domain: "general_academic",
    query: "hrozby pre vnútornú a vonkajšiu validitu skreslenie vzorky",
    expectedSections: ["limit", "validit", "obmedzen", "rizik"],
    gradedTargets: [
      { sectionSubstring: "limit", relevanceGrade: 4 },
      { sectionSubstring: "obmedzen", relevanceGrade: 4 },
      { sectionSubstring: "validit", relevanceGrade: 3 },
    ],
    split: "test",
  },
  {
    criterionId: "limitations_future_work",
    lang: "en",
    domain: "general_academic",
    query: "threats to external validity selection bias overfitting",
    expectedSections: ["limitation", "threat", "validity", "bias"],
    gradedTargets: [
      { sectionSubstring: "limitation", relevanceGrade: 4 },
      { sectionSubstring: "threat", relevanceGrade: 4 },
      { sectionSubstring: "bias", relevanceGrade: 3 },
    ],
    split: "test",
  },
  {
    criterionId: "discussion_relation",
    lang: "sk",
    domain: "general_academic",
    query: "nevysvetlené anomálie rozporuplné výsledky meraní",
    expectedSections: ["diskus", "výsledk", "anomál", "odchýlk"],
    gradedTargets: [
      { sectionSubstring: "diskus", relevanceGrade: 4 },
      { sectionSubstring: "anomál", relevanceGrade: 4 },
    ],
    split: "val",
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "sk",
    "domain": "cs_ai",
    "query": "posilňovacie učenie Q-learning diskontný faktor odmena Markovov rozhodovací proces",
    "expectedSections": [
      "posilňov",
      "odmen",
      "markov",
      "učen"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "posilňov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "markov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "odmen",
        "relevanceGrade": 3
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "cs",
    "domain": "cs_ai",
    "query": "detekce anomálií autoenkodér rekonstrukční chyba latentní prostor",
    "expectedSections": [
      "autoenkodér",
      "anomál",
      "latent",
      "model"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "autoenkodér",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "anomál",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "latent",
        "relevanceGrade": 3
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "cs_ai",
    "query": "contrastive representation learning InfoNCE loss temperature hyperparameter",
    "expectedSections": [
      "contrastive",
      "infonce",
      "representation",
      "loss"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "contrastive",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "infonce",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "loss",
        "relevanceGrade": 3
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "cs_ai",
    "query": "distribuovaný tréning dátový paralelizmus AllReduce gradientová synchronizácia",
    "expectedSections": [
      "distribuov",
      "paraleliz",
      "tréning",
      "škálov"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "distribuov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "paraleliz",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "cs",
    "domain": "cs_ai",
    "query": "grafové neuronové sítě agregace sousedů zprávy Message Passing GCN",
    "expectedSections": [
      "grafov",
      "gcn",
      "siet",
      "správ"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "grafov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "gcn",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "cs_ai",
    "query": "zero-shot generalization instruction tuning LoRA low-rank adaptation",
    "expectedSections": [
      "lora",
      "instruction",
      "tuning",
      "generalization"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "lora",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "instruction",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "cs_ai",
    "query": "konvolučná segmentácia U-Net medicínske snímky Dice koeficient",
    "expectedSections": [
      "u-net",
      "segmentác",
      "dice",
      "snímk"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "u-net",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "segmentác",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "dice",
        "relevanceGrade": 3
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "results_validity",
    "lang": "cs",
    "domain": "cs_ai",
    "query": "kryptografická hašovací funkce kolize odolnost SHA-3 bezpečnostní analýza",
    "expectedSections": [
      "kryptograf",
      "haš",
      "koliz",
      "bezpečnost"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "kryptograf",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "bezpečnost",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "cs_ai",
    "query": "database transaction isolation serializability MVCC lock contention",
    "expectedSections": [
      "transaction",
      "isolation",
      "mvcc",
      "concurrency"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "transaction",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "mvcc",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "cs_ai",
    "query": "diffusion models reverse stochastic differential equation score matching",
    "expectedSections": [
      "diffusion",
      "score",
      "stochastic",
      "model"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "diffusion",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "score",
        "relevanceGrade": 3
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "sk",
    "domain": "physics_stem",
    "query": "supravodivosť Meissnerov efekt kritická teplota magnetická susceptibilita",
    "expectedSections": [
      "supravodiv",
      "meissner",
      "magnet",
      "teplot"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "supravodiv",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "meissner",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "cs",
    "domain": "physics_stem",
    "query": "kvantová provázanost Bellovy nerovnosti polarizace fotonů detekce",
    "expectedSections": [
      "kvantov",
      "bell",
      "foton",
      "provázanost"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "kvantov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "bell",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "en",
    "domain": "physics_stem",
    "query": "density functional theory Kohn-Sham exchange correlation exchange potential",
    "expectedSections": [
      "dft",
      "kohn-sham",
      "exchange",
      "electronic"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "dft",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "kohn-sham",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "results_validity",
    "lang": "sk",
    "domain": "physics_stem",
    "query": "spektrometria gama žiarenia scintilačný detektor fotopík rozlíšenie",
    "expectedSections": [
      "spektrometr",
      "gama",
      "detektor",
      "fotopík"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "spektrometr",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "fotopík",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "cs",
    "domain": "physics_stem",
    "query": "dynamika tekutin Navier-Stokesovy rovnice Reynoldsovo číslo turbulentní proudění",
    "expectedSections": [
      "tekutin",
      "prouděn",
      "reynolds",
      "turbulen"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "reynolds",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "turbulen",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "physics_stem",
    "query": "synchrotron radiation beamline X-ray diffraction crystal structure",
    "expectedSections": [
      "synchrotron",
      "x-ray",
      "diffraction",
      "crystal"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "diffraction",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "crystal",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "theoretical_background",
    "lang": "sk",
    "domain": "physics_stem",
    "query": "termodynamická rovnováha Gibbsova voľná energia fázový prechod entalpia",
    "expectedSections": [
      "termodynam",
      "entalp",
      "energia",
      "fáz"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "termodynam",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "energia",
        "relevanceGrade": 3
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "results_validity",
    "lang": "cs",
    "domain": "physics_stem",
    "query": "astrofyzikální spektroskopie červený posuv spektra reliktní záření",
    "expectedSections": [
      "spektroskop",
      "posuv",
      "reliktn",
      "vesmír"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "spektroskop",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "posuv",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "physics_stem",
    "query": "plasma confinement tokamak magnetic field toroidal magnetic flux",
    "expectedSections": [
      "tokamak",
      "plasma",
      "magnetic",
      "confinement"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "tokamak",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "plasma",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "en",
    "domain": "physics_stem",
    "query": "Raman spectroscopy vibrational modes phonon dispersion lattice dynamics",
    "expectedSections": [
      "raman",
      "spectroscopy",
      "phonon",
      "vibrational"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "raman",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "phonon",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "biomedical",
    "query": "sekvenovanie novej generácie celogenómová analýza varianty SNP",
    "expectedSections": [
      "sekvenov",
      "genóm",
      "variant",
      "snp"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "sekvenov",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "genóm",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "cs",
    "domain": "biomedical",
    "query": "farmakokinetický model clearance biologický poločas plocha pod křivkou AUC",
    "expectedSections": [
      "farmakokinet",
      "clearance",
      "poločas",
      "auc"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "farmakokinet",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "clearance",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "biomedical",
    "query": "single-cell RNA sequencing gene expression clustering UMAP dimensionality",
    "expectedSections": [
      "single-cell",
      "rna-seq",
      "umap",
      "expression"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "single-cell",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "umap",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "biomedical",
    "query": "polymerázová reťazová reakcia kvantitatívna PCR primer amplifikácia",
    "expectedSections": [
      "pcr",
      "primer",
      "amplifik",
      "reakc"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "pcr",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "amplifik",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "cs",
    "domain": "biomedical",
    "query": "imunohistochemické barvení exprese biomarkerů nádorové tkáně",
    "expectedSections": [
      "imunohisto",
      "biomarker",
      "nádor",
      "tkáň"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "imunohisto",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "biomarker",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "biomedical",
    "query": "flow cytometry gating strategy fluorescence activated cell sorting",
    "expectedSections": [
      "flow cytometry",
      "gating",
      "facs",
      "fluorescence"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "flow cytometry",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "gating",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "biomedical",
    "query": "enzýmová kinetika Michaelis-Mentenovej rovnica Km a Vmax inhibícia",
    "expectedSections": [
      "kinetik",
      "enzým",
      "inhibíc",
      "michaelis"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "kinetik",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "michaelis",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "cs",
    "domain": "biomedical",
    "query": "magnetická rezonance fMRI BOLD signál neurozobrazování aktivace",
    "expectedSections": [
      "mri",
      "bold",
      "neuro",
      "aktivac"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "bold",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "neuro",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "biomedical",
    "query": "CRISPR-Cas9 off-target cleavage guide RNA specificity editing",
    "expectedSections": [
      "crispr",
      "cas9",
      "cleavage",
      "editing"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "crispr",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "cas9",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "results_validity",
    "lang": "en",
    "domain": "biomedical",
    "query": "western blot protein quantification loading control normalization",
    "expectedSections": [
      "western blot",
      "protein",
      "normalization",
      "quantification"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "western blot",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "protein",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "economics_social",
    "query": "časové rady kointegrácia VECM vektorový model korekcie chýb",
    "expectedSections": [
      "kointegr",
      "vecm",
      "časov",
      "regres"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "kointegr",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "vecm",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "cs",
    "domain": "economics_social",
    "query": "diskrétní volba logitový model pravděpodobnost marginální efekty",
    "expectedSections": [
      "logit",
      "volb",
      "pravděpodobnost",
      "model"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "logit",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "model",
        "relevanceGrade": 3
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "en",
    "domain": "economics_social",
    "query": "instrumental variables two-stage least squares endogeneity exclusion restriction",
    "expectedSections": [
      "instrumental",
      "2sls",
      "endogeneity",
      "exclusion"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "instrumental",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "2sls",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "sk",
    "domain": "economics_social",
    "query": "behaviorálna ekonómia averzia k strate kognitívne skreslenie experiment",
    "expectedSections": [
      "behaviorál",
      "averzi",
      "skreslen",
      "experiment"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "behaviorál",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "experiment",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "results_validity",
    "lang": "cs",
    "domain": "economics_social",
    "query": "měření inflace index spotřebitelských cen jádrová inflace košík",
    "expectedSections": [
      "inflac",
      "index",
      "spotřebitelsk",
      "cen"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "inflac",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "index",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "economics_social",
    "query": "randomized controlled trial spillover effects cluster randomization",
    "expectedSections": [
      "spillover",
      "cluster",
      "randomization",
      "treatment"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "spillover",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "cluster",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "sk",
    "domain": "economics_social",
    "query": "sociologický výskum reprezentatívna vzorka Likertova škála validita",
    "expectedSections": [
      "sociolog",
      "likert",
      "škál",
      "vzork"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "sociolog",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "likert",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "methodology_rigor",
    "lang": "en",
    "domain": "economics_social",
    "query": "difference-in-differences parallel trends assumption synthetic control",
    "expectedSections": [
      "difference-in-differences",
      "parallel trends",
      "synthetic control",
      "causal"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "difference-in-differences",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "parallel trends",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "ethics_transparency",
    "lang": "sk",
    "domain": "general_academic",
    "query": "replikačná kríza p-hacking publikačné skreslenie predregistrácia štúdie",
    "expectedSections": [
      "replikác",
      "p-hack",
      "skreslen",
      "registrác"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "replikác",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "registrác",
        "relevanceGrade": 4
      }
    ],
    "split": "train"
  },
  {
    "criterionId": "ethics_transparency",
    "lang": "cs",
    "domain": "general_academic",
    "query": "etika výzkumu střet zájmů plagiátorství duplicitní publikování",
    "expectedSections": [
      "etik",
      "střet zájmů",
      "plagiát",
      "publik"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "etik",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "plagiát",
        "relevanceGrade": 4
      }
    ],
    "split": "val"
  },
  {
    "criterionId": "analytical_execution",
    "lang": "en",
    "domain": "general_academic",
    "query": "statistical power analysis sample size estimation G*Power effect size",
    "expectedSections": [
      "power analysis",
      "sample size",
      "effect size",
      "g*power"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "power analysis",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "effect size",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  },
  {
    "criterionId": "theoretical_background",
    "lang": "en",
    "domain": "general_academic",
    "query": "systematic literature review PRISMA diagram inclusion exclusion criteria",
    "expectedSections": [
      "prisma",
      "systematic review",
      "inclusion criteria",
      "search strategy"
    ],
    "gradedTargets": [
      {
        "sectionSubstring": "prisma",
        "relevanceGrade": 4
      },
      {
        "sectionSubstring": "systematic review",
        "relevanceGrade": 4
      }
    ],
    "split": "test"
  }
]

/**
 * Merges baseline 44 queries with extended domain queries into the full 104-query graded suite.
 */
export function getGradedGoldenSet(): GradedGoldenQuery[] {
  const baseGraded: GradedGoldenQuery[] = GOLDEN_RETRIEVAL_SET.map((g, idx) => ({
    ...g,
    domain: "general_academic",
    split: idx % 3 === 0 ? "test" : idx % 3 === 1 ? "val" : "train",
    gradedTargets: g.expectedSections.map((exp, expIdx) => ({
      sectionSubstring: exp,
      relevanceGrade: expIdx === 0 ? 4 : expIdx === 1 ? 3 : 2,
    })),
  }))

  return [...baseGraded, ...EXTENDED_QUERIES]
}
