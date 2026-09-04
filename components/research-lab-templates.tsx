"use client"

import React, { useState } from "react"
import {
  FlaskConical,
  Clock,
  Copy,
  Check,
  Play,
  Layers,
  FileCode2,
  Sparkles,
  BarChart3,
  Search,
  BookOpen,
  Split,
  Workflow,
  ShieldAlert,
  GitBranch,
  ChevronRight,
  Database,
  ArrowRight,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface ScientificTask {
  id: string
  title: string
  shortTitle: string
  question: string
  estimatedRuntime: string
  category: string
  badgeVariant?: "default" | "secondary" | "outline" | "destructive"
  scientificQuestion: string
  prompt: string
  phases: {
    phase: string
    title: string
    duration?: string
    tools: string[]
    summary: string
    details: string[]
  }[]
  benchmarkTable?: {
    headers: string[]
    rows: { [key: string]: string | number }[]
    caption: string
  }
  keyFindings: string[]
  deliverables: string[]
  setupCards: SeedCard[]
  placeholderResultCards: SeedCard[]
  initialCards: SeedCard[]
}

export interface SeedCard {
  title: string
  pattern: string
  content: string
}

export const SCIENTIFIC_TASKS: ScientificTask[] = [
  {
    id: "retrieval-tournament",
    title: "Retrieval Strategy Tournament",
    shortTitle: "Retrieval Tournament",
    question: "Which retrieval strategy actually works best for my poster's domain?",
    estimatedRuntime: "4–6 hours",
    category: "Information Retrieval",
    badgeVariant: "secondary",
    scientificQuestion:
      "Your poster currently uses one retrieval approach (e.g. dense contriever). But is it actually the best one for your specific corpus and claim types? Nobody has compared strategies against your actual workspace content.",
    prompt:
      "Run a systematic retrieval strategy tournament on my workspace. Compare dense-only, sparse-only (BM25), hybrid, and reranked retrieval across all my ingested documents. Use my actual card claims as the query set. Find the winner, explain why, and update my methodology card with the findings.",
    phases: [
      {
        phase: "PHASE 1",
        title: "RESEARCH",
        duration: "~30 min",
        tools: ["posterapp.cards.list", "search_academic", "posterapp.rag.query"],
        summary: "Extracts claims from cards and prepares baseline evaluation corpus.",
        details: [
          "Lead agent extracts 11 card claims as test query benchmarks.",
          "Subagent A searches academic literature (BEIR, MTEB) for retrieval baselines.",
          "Subagent B dumps chunk embeddings to /workspace/corpus.jsonl and queries to /workspace/queries.jsonl.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "PROTOTYPING",
        duration: "~45 min",
        tools: ["bash.sandbox", "python.faiss", "python.rank_bm25"],
        summary: "Builds 4 distinct retrieval engines inside the execution sandbox.",
        details: [
          "dense.py: Contriever embeddings + FAISS indexing.",
          "sparse.py: BM25 lexical retrieval via rank_bm25.",
          "hybrid.py: Reciprocal Rank Fusion (RRF α=0.6) of dense + sparse.",
          "reranked.py: Dense first-stage + cross-encoder reranker.",
        ],
      },
      {
        phase: "PHASE 3",
        title: "EXPERIMENTATION",
        duration: "~2 hours",
        tools: ["subagent.batch", "bash.sandbox"],
        summary: "Spawns 4 concurrent subagents executing queries in parallel.",
        details: [
          "Subagent-Dense evaluates all 11 claims against corpus.",
          "Subagent-Sparse tests exact lexical keyword matching.",
          "Subagent-Hybrid executes fused reciprocal ranking.",
          "Subagent-Reranked computes cross-encoder logit scores.",
        ],
      },
      {
        phase: "PHASE 4",
        title: "EVALUATION",
        duration: "~45 min",
        tools: ["python.evaluate", "llm.faithfulness_judge"],
        summary: "Computes Recall@5, MRR, Faithfulness, and Latency per strategy.",
        details: [
          "Computes Recall@5 and Mean Reciprocal Rank (MRR).",
          "Executes LLM-as-a-judge faithfulness verification for top-k chunks.",
          "Measures wall-clock query latency in milliseconds.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "ANALYSIS & FIGURES",
        duration: "~30 min",
        tools: ["matplotlib", "seaborn"],
        summary: "Generates publication-grade figures and heatmaps.",
        details: [
          "Generates retrieval_comparison_radar.png (4 metrics × 4 systems).",
          "Plots latency vs Recall@5 Pareto frontier.",
          "Creates per_query_heatmap.png showing per-claim winning strategies.",
        ],
      },
      {
        phase: "PHASE 6",
        title: "SYNTHESIS & WORKSPACE UPDATE",
        duration: "~15 min",
        tools: ["posterapp.snapshots.create", "posterapp.cards.update"],
        summary: "Creates safety snapshot and updates workspace cards (reversible via snapshot).",
        details: [
          "Creates pre-agent:methodology-update snapshot.",
          "Proposes methodology card update incorporating hybrid RRF findings.",
          "Proposed changes are written immediately and reversible via snapshot.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["Strategy", "Recall@5", "MRR", "Faithfulness", "Latency"],
      rows: [
        { Strategy: "Dense", "Recall@5": "0.76", MRR: "0.71", Faithfulness: "0.82", Latency: "47ms" },
        { Strategy: "Sparse", "Recall@5": "0.68", MRR: "0.63", Faithfulness: "0.74", Latency: "12ms" },
        { Strategy: "Hybrid (Winner)", "Recall@5": "0.87", MRR: "0.79", Faithfulness: "0.89", Latency: "70ms" },
        { Strategy: "Reranked", "Recall@5": "0.85", MRR: "0.81", Faithfulness: "0.91", Latency: "340ms" },
      ],
      caption: "Tournament complete. Hybrid (RRF α=0.6) achieves highest Recall@5 (+14.2% over dense).",
    },
    keyFindings: [
      "Hybrid retrieval wins on 8 of 11 claims, outperforming dense-only by 14.2% Recall@5 and 8.1% MRR.",
      "Sparse retrieval is superior only on 2 exact-match definition queries.",
      "Cross-encoder reranking yields +2% faithfulness over hybrid, but adds 340ms latency overhead.",
    ],
    deliverables: [
      "/workspace/evaluation_report.csv (Full metrics per query)",
      "/workspace/figures/retrieval_comparison_radar.png (Figure ready for poster)",
      "/workspace/figures/per_query_heatmap.png (Supplementary chart)",
      "Automated methodology card revision draft",
    ],
    setupCards: [
      {
        title: "Research Question & Baseline",
        pattern: "methods",
        content:
          "Does dense vector retrieval remain optimal under domain-specific scientific claim queries? We evaluate dense, lexical (BM25), hybrid reciprocal rank fusion, and cross-encoder rerankers across poster claim statements.",
      },
      {
        title: "Tournament Evaluation Protocol",
        pattern: "methods",
        content:
          "Queries derived directly from poster claims. Benchmark metrics: Recall@5, Mean Reciprocal Rank (MRR), Faithfulness via LLM verification, and query response latency.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Comparative Performance Matrix",
        pattern: "results",
        content:
          "Hybrid RRF (α=⟨opt_alpha⟩) demonstrated superiority, reaching Recall@5 of ⟨Recall@5⟩ (+⟨gain_pct⟩% over dense baseline) and MRR of ⟨MRR⟩ with ⟨latency_ms⟩ms latency.",
      },
      {
        title: "Methodological Conclusions",
        pattern: "results",
        content:
          "Dense vector retrieval miss rate on domain terminology evaluated (⟨miss_rate⟩). Multi-modal hybrid fusion performance across exact numeric formulations yields ⟨hybrid_gain⟩ advantage pending experimental results.",
      },
    ],
    initialCards: [
      {
        title: "Research Question & Baseline",
        pattern: "methods",
        content:
          "Does dense vector retrieval remain optimal under domain-specific scientific claim queries? We evaluate dense, lexical (BM25), hybrid reciprocal rank fusion, and cross-encoder rerankers across poster claim statements.",
      },
      {
        title: "Tournament Evaluation Protocol",
        pattern: "methods",
        content:
          "Queries derived directly from poster claims. Benchmark metrics: Recall@5, Mean Reciprocal Rank (MRR), Faithfulness via LLM verification, and query response latency.",
      },
      {
        title: "Comparative Performance Matrix",
        pattern: "results",
        content:
          "Hybrid RRF (α=⟨opt_alpha⟩) demonstrated superiority, reaching Recall@5 of ⟨Recall@5⟩ (+⟨gain_pct⟩% over dense baseline) and MRR of ⟨MRR⟩ with ⟨latency_ms⟩ms latency.",
      },
      {
        title: "Methodological Conclusions",
        pattern: "results",
        content:
          "Dense vector retrieval miss rate on domain terminology evaluated (⟨miss_rate⟩). Multi-modal hybrid fusion performance across exact numeric formulations yields ⟨hybrid_gain⟩ advantage pending experimental results.",
      },
    ],
  },
  {
    id: "confidence-calibration",
    title: "Claim Confidence Calibration Study",
    shortTitle: "Confidence Calibration",
    question: "How confident should I actually be in each claim on my poster?",
    estimatedRuntime: "3–5 hours",
    category: "Literature Calibration",
    badgeVariant: "default",
    scientificQuestion:
      "You make claims. Those claims have citations. But how strong is the actual evidence base when you quantify it rigorously — literature volume, recency, methodological consistency, effect size agreement?",
    prompt:
      "For every claim on my poster, build a quantitative confidence score based on the published literature. Run the full evidence base analysis. I want a calibrated confidence level per claim, not a vague 'well-supported'.",
    phases: [
      {
        phase: "PHASE 1",
        title: "CLAIM EXTRACTION & TAXONOMY",
        duration: "~20 min",
        tools: ["posterapp.cards.list", "claims_taxonomy.json"],
        summary: "Parses all workspace cards and categorizes claims into typed propositions.",
        details: [
          "Extracts 11 discrete empirical and methodological claims.",
          "Categorizes each by type (empirical, methodological, theoretical) and domain.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "LITERATURE SWEEP",
        duration: "~1.5 hours",
        tools: ["subagent.batch", "search_academic", "browser"],
        summary: "Deploys 11 parallel subagents querying supporting and counter-evidence.",
        details: [
          "Searches both affirmation and negation queries for every claim.",
          "Extracts sample size, evaluation metrics, and qualification boundaries from OA papers.",
        ],
      },
      {
        phase: "PHASE 3",
        title: "STATISTICAL META-ANALYSIS",
        duration: "~45 min",
        tools: ["scipy", "meta_analysis.py"],
        summary: "Performs vote counting, effect size distributions, and publication bias checks.",
        details: [
          "Computes Cohen's d effect sizes across published papers.",
          "Evaluates heterogeneity variance (σ) across scientific domains.",
          "Conducts funnel plot checks for publication bias.",
        ],
      },
      {
        phase: "PHASE 4",
        title: "CONFIDENCE SCORING MODEL",
        duration: "~30 min",
        tools: ["score_claims.py"],
        summary: "Builds a multi-factor calibrated confidence index for each claim.",
        details: [
          "Weighted formula: Support Ratio (30%), Effect Consistency (25%), Sample Adequacy (20%), Recency (15%), Replication (10%).",
          "Calculates calibrated score [0.0 - 1.0] with empirical 95% confidence intervals.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "VISUALIZATION & REVIEW CORRELATION",
        duration: "~30 min",
        tools: ["posterapp.review.run", "matplotlib"],
        summary: "Maps scores against automated thesis/poster reviews to surface vulnerabilities.",
        details: [
          "Generates claim_confidence_heatmap.png and evidence_funnel plots.",
          "Runs PosterApp review engine; finds 0.81 correlation with review warning flags.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["Confidence Tier", "Claim Statement", "Score", "Literature Base", "Action"],
      rows: [
        {
          "Confidence Tier": "HIGH (≥0.80)",
          "Claim Statement": "RAG improves F1 on SciQA",
          Score: "0.91",
          "Literature Base": "14 papers, median Δ +8.3 F1",
          Action: "Retain robust claim",
        },
        {
          "Confidence Tier": "MEDIUM (0.55-0.79)",
          "Claim Statement": "Dense outperforms sparse on SciQA",
          Score: "0.67",
          "Literature Base": "8 support, 3 contradict (σ=4.1)",
          Action: "Scope to NLP domain",
        },
        {
          "Confidence Tier": "LOW (<0.55)",
          "Claim Statement": "Chunk size 512 is optimal",
          Score: "0.38",
          "Literature Base": "2 papers only (σ=8.9)",
          Action: "Reframe as design choice",
        },
      ],
      caption: "Evidence calibration identifies 2 high-risk claims requiring rephrasing before peer review.",
    },
    keyFindings: [
      "Core thesis claim (RAG effectiveness) is backed by 14 papers with zero direct contradictions (0.91 score).",
      "Chunk size 512 is an unproven assumption (0.38 score) — must be labeled as an empirical default rather than an optimal discovery.",
      "81% correlation between low confidence scores and automated reviewer critique flags.",
    ],
    deliverables: [
      "/workspace/confidence_scores.json (Per-claim quantitative calibration)",
      "/workspace/figures/claim_confidence_heatmap.png (Visual confidence breakdown)",
      "/workspace/figures/evidence_funnel_claim07.png (Publication bias check)",
      "Targeted claim softening & limitation recommendations",
    ],
    setupCards: [
      {
        title: "Claim Taxonomy & Evidence Scope",
        pattern: "methods",
        content:
          "Systematic calibration of poster claims against published academic literature, indexing sample size, effect consistency, and domain transferability.",
      },
      {
        title: "Scope & Stated Limitations",
        pattern: "methods",
        content:
          "Claims reframed: engineering configurations explicitly distinguished from empirical optima. Query boundaries constrained to domain text.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Calibrated Confidence Breakdown",
        pattern: "results",
        content:
          "Core retrieval claims validation: Score ⟨Score_Core⟩. Hyperparameter claims literature consistency: Score ⟨Score_HP⟩.",
      },
      {
        title: "Meta-Analytic Heterogeneity",
        pattern: "results",
        content:
          "Variance analysis across ⟨N_Studies⟩ peer-reviewed evaluations evaluating retrieval performance variations across specialized query formulations.",
      },
    ],
    initialCards: [
      {
        title: "Claim Taxonomy & Evidence Scope",
        pattern: "methods",
        content:
          "Systematic calibration of poster claims against published academic literature, indexing sample size, effect consistency, and domain transferability.",
      },
      {
        title: "Scope & Stated Limitations",
        pattern: "methods",
        content:
          "Claims reframed: engineering configurations explicitly distinguished from empirical optima. Query boundaries constrained to domain text.",
      },
      {
        title: "Calibrated Confidence Breakdown",
        pattern: "results",
        content:
          "Core retrieval claims validation: Score ⟨Score_Core⟩. Hyperparameter claims literature consistency: Score ⟨Score_HP⟩.",
      },
      {
        title: "Meta-Analytic Heterogeneity",
        pattern: "results",
        content:
          "Variance analysis across ⟨N_Studies⟩ peer-reviewed evaluations evaluating retrieval performance variations across specialized query formulations.",
      },
    ],
  },
  {
    id: "ablation-study",
    title: "Automated Ablation Study",
    shortTitle: "Ablation Study",
    question: "What actually contributes to my results, and what's dead weight?",
    estimatedRuntime: "6–10 hours",
    category: "Component Attribution",
    badgeVariant: "secondary",
    scientificQuestion:
      "Your poster reports a result. But which components actually drive that result? What if a reviewer asks 'what happens if you remove component X?'",
    prompt:
      "My poster reports F1=76.1 with our full RAG pipeline. Run a systematic ablation study on all major components. I want to know which parts actually matter and by how much. Generate the ablation table I'd put in a paper.",
    phases: [
      {
        phase: "PHASE 1",
        title: "COMPONENT IDENTIFICATION",
        duration: "~30 min",
        tools: ["posterapp.cards.get", "ablation_config.json"],
        summary: "Parses methodology to define 7 independent architectural components.",
        details: [
          "Identifies 7 components: Retriever, Chunk Size, Retrieved k, Reranking, Reader Size, Query Expansion, Chunk Overlap.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "EXPERIMENT DESIGN",
        duration: "~30 min",
        tools: ["generate_ablation_configs.py"],
        summary: "Constructs 11 experimental conditions with 3 random seeds (33 total runs).",
        details: [
          "7 one-at-a-time component removals.",
          "4 high-likelihood interaction conditions.",
          "Generates 33 execution configs with random seed isolation.",
        ],
      },
      {
        phase: "PHASE 3",
        title: "PARALLEL EXECUTION",
        duration: "~5 hours",
        tools: ["subagent.batch", "bash.sandbox"],
        summary: "Launches 11 subagents executing seeded test batches with restart resilience.",
        details: [
          "Runs evaluations in isolated sandboxes.",
          "State persists safely across network disconnects and interruptions.",
        ],
      },
      {
        phase: "PHASE 4",
        title: "STATISTICAL ANALYSIS",
        duration: "~45 min",
        tools: ["analyze_ablation.py", "scipy.stats"],
        summary: "Calculates paired t-tests, p-values, and Cohen's d effect sizes.",
        details: [
          "Evaluates statistical significance of delta F1 against full system baseline.",
          "Categorizes each component as critical, marginal, or dead weight.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "TABLE & WATERFALL CHARTS",
        duration: "~45 min",
        tools: ["latex.table", "matplotlib.waterfall"],
        summary: "Generates camera-ready LaTeX table and attribution waterfall chart.",
        details: [
          "Compiles ablation_table.tex formatted for ACM/IEEE publication.",
          "Renders ablation_waterfall.png illustrating cumulative score degradation.",
        ],
      },
      {
        phase: "PHASE 6",
        title: "WORKSPACE UPDATE",
        duration: "~15 min",
        tools: ["posterapp.snapshots.create", "posterapp.cards.update"],
        summary: "Updates Results and Methodology cards with exact statistical attribution.",
        details: [
          "Queues safe updates reflecting true component value.",
          "Prunes unsupported claims regarding non-significant components.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["System Configuration", "Mean F1 ± std", "Δ F1 Drop", "Significance", "Verdict"],
      rows: [
        { "System Configuration": "Full System (Baseline)", "Mean F1 ± std": "76.1 ± 0.4", "Δ F1 Drop": "—", Significance: "—", Verdict: "Reference" },
        { "System Configuration": "w/o Retrieval", "Mean F1 ± std": "61.3 ± 0.6", "Δ F1 Drop": "−14.8", Significance: "p < 0.001 ***", Verdict: "Dominant Component" },
        { "System Configuration": "k=1 (was k=5)", "Mean F1 ± std": "70.8 ± 0.7", "Δ F1 Drop": "−5.3", Significance: "p < 0.001 ***", Verdict: "Critical Parameter" },
        { "System Configuration": "Reader = Base (was Large)", "Mean F1 ± std": "71.2 ± 0.8", "Δ F1 Drop": "−4.9", Significance: "p < 0.001 ***", Verdict: "Critical Capacity" },
        { "System Configuration": "w/o Reranking", "Mean F1 ± std": "74.2 ± 0.5", "Δ F1 Drop": "−1.9", Significance: "p < 0.05 *", Verdict: "Moderate Gain" },
        { "System Configuration": "Chunk 256 (was 512)", "Mean F1 ± std": "74.9 ± 0.4", "Δ F1 Drop": "−1.2", Significance: "p = 0.21 (ns)", Verdict: "Non-significant" },
        { "System Configuration": "w/o Query Expansion", "Mean F1 ± std": "75.6 ± 0.5", "Δ F1 Drop": "−0.5", Significance: "p = 0.42 (ns)", Verdict: "Dead Weight (Remove)" },
      ],
      caption: "33 seeded runs demonstrate retrieval is the primary driver (+14.8 F1), while query expansion is redundant.",
    },
    keyFindings: [
      "Retrieval accounts for the vast majority of performance (+14.8 F1) — poster correctly highlights it.",
      "Query expansion provides negligible advantage (+0.5 F1, p=0.42); recommended for removal from poster contributions.",
      "Chunk size difference (512 vs 256) is statistically indistinguishable (p=0.21).",
    ],
    deliverables: [
      "/workspace/ablation_table.tex (Publication-ready LaTeX)",
      "/workspace/figures/ablation_waterfall.png (Attribution chart)",
      "/workspace/ablation_analysis.json (Statistical test outputs)",
      "Card update drafts removing dead-weight claims",
    ],
    setupCards: [
      {
        title: "System Architecture & Ablation Space",
        pattern: "methods",
        content:
          "Systematic isolation of modular components across seeded experimental runs to establish causal attribution on downstream SciQA F1 performance.",
      },
      {
        title: "Architectural Pruning & Findings",
        pattern: "methods",
        content:
          "Component sensitivity analysis protocol: redundant query expansion evaluated for latency trade-offs, and chunk size parameters assessed against baseline defaults.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Ablation Matrix & Significance",
        pattern: "results",
        content:
          "Component removal impacts: ablating retrieval triggers performance drop of ⟨ΔF1_retrieval⟩ (p=⟨p_val⟩). Reader capacity contributes ⟨ΔF1_reader⟩. Query expansion contributes ⟨ΔF1_expansion⟩.",
      },
      {
        title: "Component Contribution Waterfall",
        pattern: "results",
        content:
          "Statistical waterfall analysis attribution: retrieval and multi-chunk passage integration deliver ⟨pct_retrieval⟩% of overall augmentation gains.",
      },
    ],
    initialCards: [
      {
        title: "System Architecture & Ablation Space",
        pattern: "methods",
        content:
          "Systematic isolation of modular components across seeded experimental runs to establish causal attribution on downstream SciQA F1 performance.",
      },
      {
        title: "Architectural Pruning & Findings",
        pattern: "methods",
        content:
          "Component sensitivity analysis protocol: redundant query expansion evaluated for latency trade-offs, and chunk size parameters assessed against baseline defaults.",
      },
      {
        title: "Ablation Matrix & Significance",
        pattern: "results",
        content:
          "Component removal impacts: ablating retrieval triggers performance drop of ⟨ΔF1_retrieval⟩ (p=⟨p_val⟩). Reader capacity contributes ⟨ΔF1_reader⟩. Query expansion contributes ⟨ΔF1_expansion⟩.",
      },
      {
        title: "Component Contribution Waterfall",
        pattern: "results",
        content:
          "Statistical waterfall analysis attribution: retrieval and multi-chunk passage integration deliver ⟨pct_retrieval⟩% of overall augmentation gains.",
      },
    ],
  },
  {
    id: "failure-taxonomy",
    title: "Failure Mode Taxonomy",
    shortTitle: "Failure Taxonomy",
    question: "Where does my system actually break, and why?",
    estimatedRuntime: "4–6 hours",
    category: "Error Analysis",
    badgeVariant: "outline",
    scientificQuestion:
      "Your poster shows aggregate F1. But where does it fail? A failure mode taxonomy is publishable in its own right, and it defends you against 'your benchmark hides the weakness' reviewers.",
    prompt:
      "Systematically find and categorize every failure mode in my RAG pipeline. For each failure type, find at least 3 examples from the test set, measure how common it is, and suggest a fix. Generate a failure analysis section I can add to my poster.",
    phases: [
      {
        phase: "PHASE 1",
        title: "FAILURE COLLECTION",
        duration: "~45 min",
        tools: ["collect_failures.py"],
        summary: "Evaluates full 4,102 test items; filters 847 sub-threshold errors.",
        details: [
          "Runs comprehensive evaluation across held-out evaluation set.",
          "Collects all items scoring F1 < 0.5 into /workspace/failures.jsonl.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "TAXONOMY CONSTRUCTION",
        duration: "~2 hours",
        tools: ["sentence-transformers", "hdbscan", "subagent.batch"],
        summary: "Clusters error embeddings and dispatches 7 subagents to diagnose root causes.",
        details: [
          "Embeds error representations and discovers 7 discrete semantic clusters.",
          "Assigns one diagnostic subagent per cluster to extract canonical examples.",
          "Searches academic literature to match errors to established terminology.",
        ],
      },
      {
        phase: "PHASE 3",
        title: "QUANTIFICATION & VISUALIZATION",
        duration: "~45 min",
        tools: ["visualize_failures.py"],
        summary: "Generates distribution plots, heatmaps, and failure case matrices.",
        details: [
          "Calculates relative frequency across all 847 test failures.",
          "Builds 3-way error comparison table (Query, Retrieved, Predicted, Gold).",
        ],
      },
      {
        phase: "PHASE 4",
        title: "LITERATURE GROUNDING",
        duration: "~30 min",
        tools: ["search_academic", "failure_taxonomy.md"],
        summary: "Maps error modes to prior literature (Izacard 2021, Min 2023, Dua 2019).",
        details: [
          "Maps 'Attribution Error' to Min et al. (2023) FaithDial.",
          "Maps 'Numerical Extraction' to Dua et al. (2019) DROP benchmark.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "NEW POSTER CARD CREATION",
        duration: "~15 min",
        tools: ["posterapp.snapshots.create", "posterapp.cards.update"],
        summary: "Generates a dedicated 'Failure Analysis' card directly addressing thesis review flags.",
        details: [
          "Drafts comprehensive error breakdown card.",
          "Satisfies reviewer requirement: 'Evaluation lacks qualitative error analysis'.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["Failure Category", "% of Failures", "Literature Grounding", "Root Cause & Mitigation"],
      rows: [
        { "Failure Category": "Type 1: Retrieval Miss", "% of Failures": "32.1%", "Literature Grounding": "Izacard (2021)", "Root Cause & Mitigation": "Answer in appendix, not top-k; increase k or use parent-doc" },
        { "Failure Category": "Type 2: Numerical Extraction", "% of Failures": "22.7%", "Literature Grounding": "Dua et al. (2019)", "Root Cause & Mitigation": "Reader rounds or truncates digits; add regex post-processor" },
        { "Failure Category": "Type 3: Attribution Error", "% of Failures": "14.3%", "Literature Grounding": "Min et al. (2023)", "Root Cause & Mitigation": "Confuses author vs institution; add NER-aware reader prompt" },
        { "Failure Category": "Type 4: Multi-hop Gap", "% of Failures": "11.2%", "Literature Grounding": "Yang et al. (2018)", "Root Cause & Mitigation": "Requires reasoning over 2+ chunks; multi-step retrieval" },
        { "Failure Category": "Type 5: Negation & Scoping", "% of Failures": "8.4%", "Literature Grounding": "Ribeiro et al. (2020)", "Root Cause & Mitigation": "Misses negative qualifiers in query; contrastive training" },
        { "Failure Category": "Type 6: Format Truncation", "% of Failures": "6.8%", "Literature Grounding": "Lewis et al. (2020)", "Root Cause & Mitigation": "Output token budget exhausted; increase max_tokens" },
        { "Failure Category": "Type 7: Out-of-Corpus", "% of Failures": "4.5%", "Literature Grounding": "Rajpurkar (2018)", "Root Cause & Mitigation": "Entity missing from index; enable abstention mechanism" },
      ],
      caption: "100% of 847 failures successfully classified across 7 grounded scientific error categories.",
    },
    keyFindings: [
      "Retrieval recall bottlenecks remain the primary failure point (32.1%), followed by numerical rounding (22.7%).",
      "Model exhibits specific vulnerability confusing author citations with institutional affiliations in 78% of attribution failures.",
      "Directly remediates automated review critique: 'evaluation lacks qualitative failure analysis'.",
    ],
    deliverables: [
      "/workspace/failure_taxonomy.md (Complete taxonomy with citations)",
      "/workspace/figures/failure_distribution_pie.png (Ready for poster display)",
      "/workspace/failures.jsonl (847 classified error instances)",
      "New 'Error Taxonomy & Failure Modes' poster card",
    ],
    setupCards: [
      {
        title: "Attribution & Entity Misalignment",
        pattern: "methods",
        content:
          "Qualitative diagnosis protocol to evaluate whether the generator accurately retrieves factual passages but misattributes findings across adjacent institutional entities.",
      },
      {
        title: "Defensive Engineering & Fixes",
        pattern: "methods",
        content:
          "Proposed mitigations: parent-document hierarchical chunking to resolve recall misses and NER-guided verification for numerical and attribution fidelity.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Evaluation Set & Error Distribution",
        pattern: "results",
        content:
          "Comprehensive evaluation of test queries identifying sub-threshold failure cases (F1 < 0.5), clustered into ⟨N_Classes⟩ formal error modes.",
      },
      {
        title: "7-Class Failure Taxonomy",
        pattern: "results",
        content:
          "Retrieval recall bottlenecks account for ⟨pct_retrieval⟩% of errors, followed by numerical extraction gaps (⟨pct_numerical⟩%) and entity attribution confusion (⟨pct_attribution⟩%).",
      },
    ],
    initialCards: [
      {
        title: "Attribution & Entity Misalignment",
        pattern: "methods",
        content:
          "Qualitative diagnosis protocol to evaluate whether the generator accurately retrieves factual passages but misattributes findings across adjacent institutional entities.",
      },
      {
        title: "Defensive Engineering & Fixes",
        pattern: "methods",
        content:
          "Proposed mitigations: parent-document hierarchical chunking to resolve recall misses and NER-guided verification for numerical and attribution fidelity.",
      },
      {
        title: "Evaluation Set & Error Distribution",
        pattern: "results",
        content:
          "Comprehensive evaluation of test queries identifying sub-threshold failure cases (F1 < 0.5), clustered into ⟨N_Classes⟩ formal error modes.",
      },
      {
        title: "7-Class Failure Taxonomy",
        pattern: "results",
        content:
          "Retrieval recall bottlenecks account for ⟨pct_retrieval⟩% of errors, followed by numerical extraction gaps (⟨pct_numerical⟩%) and entity attribution confusion (⟨pct_attribution⟩%).",
      },
    ],
  },
  {
    id: "bayesian-hpo",
    title: "Bayesian Hyperparameter Search",
    shortTitle: "Bayesian HPO",
    question: "What's the actual optimal configuration for my pipeline?",
    estimatedRuntime: "8–12 hours (Overnight)",
    category: "Optimization",
    badgeVariant: "secondary",
    scientificQuestion:
      "Most papers pick hyperparameters by intuition or grid search. Bayesian optimization finds the true optimum with far fewer evaluations.",
    prompt:
      "Run Bayesian hyperparameter optimization on my RAG pipeline overnight. Search over chunk size, overlap, k, retrieval alpha (hybrid weighting), and reranker threshold. Find the configuration that maximizes F1 on my validation set. If it beats my current poster result, update the numbers.",
    phases: [
      {
        phase: "PHASE 1",
        title: "SEARCH SPACE DEFINITION",
        duration: "~30 min",
        tools: ["optuna", "setup_optuna.py"],
        summary: "Configures TPE search space with SQLite persistence for overnight stability.",
        details: [
          "Defines parameters: chunk_size [128-1024], overlap [0-256], k [1-10], hybrid_alpha [0.0-1.0], rerank_threshold [0.3-0.9].",
          "Configures Optuna Tree-structured Parzen Estimator (TPE) with median pruning.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "OPTIMIZATION LOOP",
        duration: "~8 hours (Overnight)",
        tools: ["run_optuna.py", "optuna.db"],
        summary: "Executes 150 trials with automated pruning of non-promising trajectories.",
        details: [
          "Runs in persistent background execution mode.",
          "Early stops unpromising configurations via median pruner.",
          "Identifies global peak at trial 103.",
        ],
      },
      {
        phase: "PHASE 3",
        title: "TEST SET VALIDATION",
        duration: "~1 hour",
        tools: ["validate_best.py"],
        summary: "Evaluates optimal hyperparameters across 3 seeds on held-out test split.",
        details: [
          "Confirms test F1 improves from 76.1 to 78.9 ± 0.3.",
          "Validates against data leakage across validation and test partitions.",
        ],
      },
      {
        phase: "PHASE 4",
        title: "SIGNIFICANCE TESTING",
        duration: "~30 min",
        tools: ["significance_test.py", "mcnemar_test"],
        summary: "Conducts McNemar test and Bootstrap 95% confidence intervals.",
        details: [
          "McNemar test confirms p=0.003 statistical significance.",
          "95% bootstrap CI [78.2, 79.6] shows zero overlap with previous 76.1 baseline.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "WORKSPACE UPDATE",
        duration: "~15 min",
        tools: ["posterapp.snapshots.create", "posterapp.cards.update"],
        summary: "Prepares verified update for Results and Methodology cards.",
        details: [
          "Generates optuna_history.png and param_importance.png.",
          "Prepares verified card update elevating reported F1 to 78.9.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["Hyperparameter", "Original Poster Value", "Optimized Value", "Variance Explained", "Impact"],
      rows: [
        { Hyperparameter: "hybrid_alpha (RRF)", "Original Poster Value": "N/A (Dense only)", "Optimized Value": "0.62", "Variance Explained": "34%", Impact: "Highest Gain Driver" },
        { Hyperparameter: "top_k chunks", "Original Poster Value": "5", "Optimized Value": "6", "Variance Explained": "28%", Impact: "Optimal Context Window" },
        { Hyperparameter: "chunk_size", "Original Poster Value": "512 tokens", "Optimized Value": "384 tokens", "Variance Explained": "19%", Impact: "Better Granularity" },
        { Hyperparameter: "rerank_threshold", "Original Poster Value": "N/A (No reranker)", "Optimized Value": "0.58", "Variance Explained": "12%", Impact: "Noise Filtering" },
        { Hyperparameter: "chunk_overlap", "Original Poster Value": "128 tokens", "Optimized Value": "96 tokens", "Variance Explained": "7%", Impact: "Boundary Preservation" },
      ],
      caption: "Optuna TPE (150 trials) unlocks +2.8 F1 gain (76.1 → 78.9, p=0.003).",
    },
    keyFindings: [
      "Optimal configuration achieves F1 = 78.9 ± 0.3 (+2.8 F1 over current poster, p=0.003).",
      "hybrid_alpha (0.62) and top_k (6) explain 62% of total performance variance.",
      "Intermediate chunk size (384) outperforms both 256 and 512, revealing non-linear chunking dynamics.",
    ],
    deliverables: [
      "/workspace/optuna.db (Full 150-trial SQLite study)",
      "/workspace/figures/param_importance.png (Hyperparameter impact ranking)",
      "/workspace/figures/parallel_coords.png (Multi-dimensional Pareto space)",
      "Card update queue reflecting validated 78.9 F1 score",
    ],
    setupCards: [
      {
        title: "Bayesian Optimization Framework",
        pattern: "methods",
        content:
          "Hyperparameters tuned via Tree-structured Parzen Estimator (TPE) Bayesian search over chunk size, overlap, retrieval fusion weight, and reranker cutoff.",
      },
      {
        title: "Empirical Tuning Protocol",
        pattern: "methods",
        content:
          "Search history persisted in SQLite. Validation trials executed with seed repeats and early median pruning to prevent overfitting.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Optimal Configuration & Gains",
        pattern: "results",
        content:
          "Bayesian optimization downstream F1 shift: from ⟨baseline_F1⟩ to ⟨opt_F1⟩ ± ⟨std_dev⟩ (McNemar test p=⟨p_val⟩). Best parameters: chunk ⟨opt_chunk⟩, overlap ⟨opt_overlap⟩, k=⟨opt_k⟩, hybrid alpha ⟨opt_alpha⟩.",
      },
      {
        title: "Parameter Sensitivity & Importance",
        pattern: "results",
        content:
          "Variance decomposition of hyperparameter influence: hybrid weighting (⟨var_hybrid⟩%) and context budget k (⟨var_k⟩%) dictate performance, while chunk overlap provides ⟨var_overlap⟩% impact.",
      },
    ],
    initialCards: [
      {
        title: "Bayesian Optimization Framework",
        pattern: "methods",
        content:
          "Hyperparameters tuned via Tree-structured Parzen Estimator (TPE) Bayesian search over chunk size, overlap, retrieval fusion weight, and reranker cutoff.",
      },
      {
        title: "Empirical Tuning Protocol",
        pattern: "methods",
        content:
          "Search history persisted in SQLite. Validation trials executed with seed repeats and early median pruning to prevent overfitting.",
      },
      {
        title: "Optimal Configuration & Gains",
        pattern: "results",
        content:
          "Bayesian optimization downstream F1 shift: from ⟨baseline_F1⟩ to ⟨opt_F1⟩ ± ⟨std_dev⟩ (McNemar test p=⟨p_val⟩). Best parameters: chunk ⟨opt_chunk⟩, overlap ⟨opt_overlap⟩, k=⟨opt_k⟩, hybrid alpha ⟨opt_alpha⟩.",
      },
      {
        title: "Parameter Sensitivity & Importance",
        pattern: "results",
        content:
          "Variance decomposition of hyperparameter influence: hybrid weighting (⟨var_hybrid⟩%) and context budget k (⟨var_k⟩%) dictate performance, while chunk overlap provides ⟨var_overlap⟩% impact.",
      },
    ],
  },
  {
    id: "replication-package",
    title: "Independent Replication Study",
    shortTitle: "Replication Study",
    question: "Can my results actually be reproduced by someone else?",
    estimatedRuntime: "5–8 hours",
    category: "Open Science",
    badgeVariant: "default",
    scientificQuestion:
      "Reproducibility crisis is real. Before you present at a conference, have an independent agent try to reproduce your results from scratch — using only what you'd put in a paper appendix.",
    prompt:
      "Pretend you have never seen my poster before. You are an independent researcher trying to reproduce my results using only the methodology description in my poster cards. Follow those instructions exactly. If you can't reproduce my F1=76.1, tell me exactly why not and what's underspecified.",
    phases: [
      {
        phase: "PHASE 1",
        title: "READ POSTER METHODOLOGY ONLY",
        duration: "~15 min",
        tools: ["posterapp.cards.get"],
        summary: "Strict zero-context isolation: reads only poster text cards.",
        details: [
          "Agent access strictly constrained to Methodology and Results cards.",
          "Identifies 4 immediate ambiguities: missing chunk overlap, unstated threshold, unpinned HF checkpoint, ambiguous dataset split.",
        ],
      },
      {
        phase: "PHASE 2",
        title: "BLIND REPRODUCTION ATTEMPT",
        duration: "~2 hours",
        tools: ["bash.sandbox", "python.reproduce"],
        summary: "Attempts clean-room implementation from external sources.",
        details: [
          "Downloads SciQA from HuggingFace, discovers version differences.",
          "Runs baseline evaluation; scores F1 = 73.8 vs reported 76.1 (−2.3 F1 gap).",
        ],
      },
      {
        phase: "PHASE 3",
        title: "GAP ANALYSIS SUBAGENTS",
        duration: "~2.5 hours",
        tools: ["subagent.batch", "gap_diagnostics"],
        summary: "Launches 5 diagnostic subagents to isolate root causes of performance discrepancy.",
        details: [
          "Subagent-A (Overlap): discovers unstated overlap=96 accounts for 2.2 F1 of the 2.3 gap.",
          "Subagent-B (Dataset): version discrepancy accounts for 0.2 F1.",
          "Subagent-C (Threshold): reveals 76.1 is reproducible only at threshold=0.45.",
          "Subagent-D (Checkpoint): verifies Flan-T5 model commit hash.",
        ],
      },
      {
        phase: "PHASE 4",
        title: "REPRODUCTION PACKAGE GENERATION",
        duration: "~1 hour",
        tools: ["generate_repro_package.py"],
        summary: "Builds a self-contained, turnkey reproducibility archive.",
        details: [
          "Creates /workspace/reproduction_package/ with README.md, pinned requirements.txt, reproduce.py, config.json, and run_tests.sh.",
        ],
      },
      {
        phase: "PHASE 5",
        title: "METHODOLOGY SPECIFICATION",
        duration: "~15 min",
        tools: ["posterapp.snapshots.create", "posterapp.cards.update"],
        summary: "Updates poster methodology to make all critical parameters explicit.",
        details: [
          "Amends methodology card with explicit overlap and threshold values.",
          "Eliminates reviewer rejection risk stemming from reproducibility doubts.",
        ],
      },
    ],
    benchmarkTable: {
      headers: ["Parameter Omission", "F1 Impact", "Status in Original Poster", "Remediation"],
      rows: [
        { "Parameter Omission": "chunk_overlap = 96", "F1 Impact": "2.2 F1 Gap", "Status in Original Poster": "Unstated (Defaulted to 0)", Remediation: "Explicitly specified in Methods" },
        { "Parameter Omission": "match_threshold = 0.45", "F1 Impact": "1.0 F1 Gap", "Status in Original Poster": "Omitted", Remediation: "Added to evaluation card" },
        { "Parameter Omission": "SciQA Dataset Version (v1.1)", "F1 Impact": "0.2 F1 Gap", "Status in Original Poster": "Ambiguous 'standard split'", Remediation: "Pinned HF dataset revision tag" },
        { "Parameter Omission": "Reader Model Checkpoint", "F1 Impact": "0.7 F1 Variance", "Status in Original Poster": "Unpinned 'Flan-T5-large'", Remediation: "Documented exact commit hash" },
      ],
      caption: "Discrepancy resolved: unstated chunk overlap and threshold accounted for the entire 2.3 F1 gap.",
    },
    keyFindings: [
      "Blind reproduction achieved F1 = 73.8 — original poster is not reproducible as written.",
      "Unspecified chunk overlap alone caused 2.2 F1 drop in third-party replication.",
      "Complete reproduction package generated with pinned dependencies, ready for Zenodo / GitHub supplementary upload.",
    ],
    deliverables: [
      "/workspace/reproduction_package/README.md (Self-contained instructions)",
      "/workspace/reproduction_package/requirements.txt (Pinned dependency graph)",
      "/workspace/reproduction_package/reproduce.py (Single-command repro script)",
      "Amended methodology card specifying all hidden parameters",
    ],
    setupCards: [
      {
        title: "Reproducibility Audit & Blind Protocol",
        pattern: "methods",
        content:
          "Independent clean-room reproduction conducted exclusively from poster methodology specifications to evaluate claim reproducibility from documented text alone.",
      },
      {
        title: "Validated Replication Package",
        pattern: "methods",
        content:
          "Full reproduction bundle released containing deterministic seeds, pinned virtual environment manifests, and automated verification scripts.",
      },
    ],
    placeholderResultCards: [
      {
        title: "Sensitivity to Hidden Hyperparameters",
        pattern: "results",
        content:
          "Diagnostic subagent isolation demonstrated unstated chunk overlap (⟨opt_overlap⟩ tokens) and match threshold (⟨opt_threshold⟩) account for ⟨pct_discrepancy⟩% of performance discrepancies in third-party implementations.",
      },
      {
        title: "Fully Specified Evaluation Standard",
        pattern: "results",
        content:
          "All evaluation splits, HuggingFace commit hashes, and inference threshold gates are explicitly documented, targeting reproducible ⟨target_F1⟩ F1 outcomes.",
      },
    ],
    initialCards: [
      {
        title: "Reproducibility Audit & Blind Protocol",
        pattern: "methods",
        content:
          "Independent clean-room reproduction conducted exclusively from poster methodology specifications to evaluate claim reproducibility from documented text alone.",
      },
      {
        title: "Validated Replication Package",
        pattern: "methods",
        content:
          "Full reproduction bundle released containing deterministic seeds, pinned virtual environment manifests, and automated verification scripts.",
      },
      {
        title: "Sensitivity to Hidden Hyperparameters",
        pattern: "results",
        content:
          "Diagnostic subagent isolation demonstrated unstated chunk overlap (⟨opt_overlap⟩ tokens) and match threshold (⟨opt_threshold⟩) account for ⟨pct_discrepancy⟩% of performance discrepancies in third-party implementations.",
      },
      {
        title: "Fully Specified Evaluation Standard",
        pattern: "results",
        content:
          "All evaluation splits, HuggingFace commit hashes, and inference threshold gates are explicitly documented, targeting reproducible ⟨target_F1⟩ F1 outcomes.",
      },
    ],
  },
]

export function ResearchLabTemplates({
  onLaunchTask,
  onCopyPrompt,
  isCreating,
}: {
  onLaunchTask: (task: ScientificTask) => void
  onCopyPrompt?: (prompt: string) => void
  isCreating?: boolean
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(SCIENTIFIC_TASKS[0].id)
  const [copied, setCopied] = useState<boolean>(false)
  const [activeView, setActiveView] = useState<"catalog" | "matrix">("catalog")

  const selectedTask = SCIENTIFIC_TASKS.find((t) => t.id === selectedTaskId) || SCIENTIFIC_TASKS[0]

  const handleCopy = (promptText: string) => {
    navigator.clipboard.writeText(promptText)
    setCopied(true)
    if (onCopyPrompt) onCopyPrompt(promptText)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <FlaskConical className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Long-Horizon Scientific Tasks for DeerFlow × PosterApp
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">SuperAgent Research Lab</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous, multi-hour experimental protocols with sandboxed code execution, parallel subagents, and snapshot-safe card updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <Button
            size="sm"
            variant={activeView === "catalog" ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            onClick={() => setActiveView("catalog")}
          >
            Protocols (6)
          </Button>
          <Button
            size="sm"
            variant={activeView === "matrix" ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            onClick={() => setActiveView("matrix")}
          >
            Lifecycle Matrix
          </Button>
        </div>
      </div>

      {activeView === "matrix" ? (
        /* The 6-Phase Lifecycle Comparison Matrix */
        <div className="flex-1 overflow-auto rounded-lg border bg-card p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Workflow className="size-4 text-primary" />
              The Pattern Across All 6 Scientific Protocols
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Effective long-horizon research depends not simply on extending interaction time, but on jointly maintaining executable state, adapting research trajectories, and aligning utility.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold">Protocol</th>
                  <th className="py-2.5 px-3 font-semibold">1. Research</th>
                  <th className="py-2.5 px-3 font-semibold">2. Prototype</th>
                  <th className="py-2.5 px-3 font-semibold">3. Experiment</th>
                  <th className="py-2.5 px-3 font-semibold">4. Evaluate</th>
                  <th className="py-2.5 px-3 font-semibold">5. Finding Back to Poster</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {SCIENTIFIC_TASKS.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                      {t.shortTitle}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {t.phases[0]?.summary || "Lit review"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {t.phases[1]?.summary || "Sandbox modules"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {t.phases[2]?.summary || "Parallel subagents"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {t.phases[3]?.summary || "Metrics & scoring"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-primary">
                      {t.deliverables[t.deliverables.length - 1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2 border border-border/60">
            <Info className="size-4 shrink-0 text-primary mt-0.5" />
            <p>
              {"Each protocol leverages DeerFlow's full agent stack: background tasks, sandboxed Python, subagent batches, and authenticated PosterApp endpoints. Proposed changes are written immediately and are individually reversible via automatic snapshots."}
            </p>
          </div>
        </div>
      ) : (
        /* Two-Column Protocol Explorer */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
          {/* Task Navigation List (Left) */}
          <div className="md:col-span-4 flex flex-col gap-2 overflow-y-auto pr-1">
            {SCIENTIFIC_TASKS.map((task, idx) => {
              const isSelected = task.id === selectedTaskId
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-card hover:bg-muted/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono text-muted-foreground">Task {idx + 1}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                      <Clock className="size-2.5 text-muted-foreground" />
                      {task.estimatedRuntime}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground leading-snug">
                    {task.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">
                    &ldquo;{task.question}&rdquo;
                  </p>
                </button>
              )
            })}
          </div>

          {/* Task Detailed View (Right) */}
          <div className="md:col-span-8 flex flex-col rounded-lg border bg-card overflow-hidden">
            {/* Header / Actions */}
            <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={selectedTask.badgeVariant ?? "secondary"} className="text-xs">
                    {selectedTask.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1 font-mono">
                    <Clock className="size-3 text-muted-foreground" />
                    {selectedTask.estimatedRuntime}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedTask.title}
                </h3>
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;{selectedTask.question}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleCopy(selectedTask.prompt)}
                >
                  {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied Prompt" : "Copy Prompt"}
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  disabled={isCreating}
                  onClick={() => onLaunchTask(selectedTask)}
                >
                  <Play className="size-3.5 fill-current" />
                  {isCreating ? "Initializing..." : "Launch Lab Workspace"}
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 p-4 max-h-[52vh]">
              <div className="space-y-4 pr-3">
                {/* Scientific Question Context */}
                <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-primary" />
                    The Scientific Question
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {selectedTask.scientificQuestion}
                  </p>
                </div>

                {/* The Verbatim Prompt Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <FileCode2 className="size-3.5 text-primary" />
                      DeerFlow Prompt (Type or Paste in Agent)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedTask.prompt)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? "Copied!" : "Copy prompt text"}
                    </button>
                  </div>
                  <div className="relative rounded-md border bg-muted/60 p-3 font-mono text-xs text-foreground/90 leading-relaxed">
                    {selectedTask.prompt}
                  </div>
                </div>

                {/* Phase-by-Phase Roadmap */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Workflow className="size-3.5 text-primary" />
                    Autonomous Execution Lifecycle ({selectedTask.phases.length} Phases)
                  </span>
                  <div className="space-y-2">
                    {selectedTask.phases.map((p, pIdx) => (
                      <div key={pIdx} className="rounded-md border border-border/60 bg-card p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[10px] text-primary px-1.5 py-0.5 rounded bg-primary/10">
                              {p.phase}
                            </span>
                            <span className="font-semibold text-foreground">{p.title}</span>
                            {p.duration && (
                              <span className="text-[10px] text-muted-foreground font-mono">({p.duration})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {p.tools.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/40"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {p.summary}
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                          {p.details.map((d, dIdx) => (
                            <li key={dIdx} className="text-[11px]">{d}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Benchmark Table / Expected Results */}
                {selectedTask.benchmarkTable && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <BarChart3 className="size-3.5 text-primary" />
                      Simulated Experimental Outcome & Benchmark
                    </span>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/60 border-b">
                            {selectedTask.benchmarkTable.headers.map((h) => (
                              <th key={h} className="py-2 px-2.5 font-semibold text-muted-foreground">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {selectedTask.benchmarkTable.rows.map((r, rIdx) => (
                            <tr key={rIdx} className="hover:bg-muted/30">
                              {selectedTask.benchmarkTable!.headers.map((h) => (
                                <td key={h} className="py-2 px-2.5 font-mono text-[11px]">
                                  {r[h]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      {selectedTask.benchmarkTable.caption}
                    </p>
                  </div>
                )}

                {/* Key Findings */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Key Scientific Findings:</span>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1">
                    {selectedTask.keyFindings.map((kf, kIdx) => (
                      <div key={kIdx} className="flex items-start gap-1.5 text-xs text-foreground/90">
                        <ArrowRight className="size-3 text-primary shrink-0 mt-0.5" />
                        <span>{kf}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deliverables & Initial Workspace Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-md border p-2.5 bg-card space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Database className="size-3 text-primary" />
                      Generated Artifacts
                    </span>
                    <ul className="space-y-1 text-xs text-muted-foreground font-mono text-[11px]">
                      {selectedTask.deliverables.map((deliv, dIdx) => (
                        <li key={dIdx} className="truncate">• {deliv}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border p-2.5 bg-card space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3 text-primary" />
                      Initial Workspace Cards ({selectedTask.initialCards.length})
                    </span>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {selectedTask.initialCards.map((c, cIdx) => (
                        <li key={cIdx} className="truncate font-medium text-foreground">
                          {cIdx + 1}. {c.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}
