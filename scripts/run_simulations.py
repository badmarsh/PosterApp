# PosterApp Mathematical Benchmark and Simulation Suite
#
# NOTE (2026-09-19, empirical-evaluation rework): this script computes statistics
# over artifacts/eval/raw-query-evaluations.json. It does NOT generate retrieval
# results itself — every retrieval number it touches comes from that input file.
# Its output therefore inherits the input's methodology: until the real-corpus
# benchmark writes that file from measured runs, anything downstream of it is
# only as real as the input. The input's self-declared "methodology" field is
# propagated into both output artifacts so simulated vs empirical data cannot be
# silently conflated.

import os
import json
import math
from datetime import datetime, timezone
import numpy as np
import scipy.stats as stats

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

RUN_TIMESTAMP = datetime.now(timezone.utc).isoformat()

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW_EVAL_PATH = os.path.join(ROOT_DIR, 'artifacts', 'eval', 'raw-query-evaluations.json')
SIM_RESULTS_PATH = os.path.join(ROOT_DIR, 'artifacts', 'eval', 'simulation-results.json')
STAT_TESTS_PATH = os.path.join(ROOT_DIR, 'artifacts', 'eval', 'statistical-tests.json')

print(f'[Init] Seed={RANDOM_SEED}')

with open(RAW_EVAL_PATH, 'r', encoding='utf-8') as f:
    raw_eval_data = json.load(f)

# Propagate the input's own methodology declaration. Producers of the raw
# artifact MUST set this field ("empirical" for measured runs; "simulated" for
# synthetic ones). "unspecified" is kept visible rather than guessed.
INPUT_METHODOLOGY = raw_eval_data.get('methodology', 'unspecified')
print(f'[Init] Input methodology declaration: {INPUT_METHODOLOGY}')

queries = raw_eval_data['queries']
N_QUERIES = len(queries)
print(f'[Data] Loaded {N_QUERIES} queries.')

ARCH_IDS = [
    'lexical-bm25',
    'dense-minilm',
    'dense-bge-m3',
    'dense-multilingual-e5',
    'naive-rag',
    'late-interaction-colbert',
    'posterapp-sota'
]

DOMAINS = ['cs_ai', 'physics_stem', 'biomedical', 'economics_social', 'general_academic']
LANGUAGES = ['sk', 'en', 'cs']

arch_metrics = {arch: {
    'r5': np.zeros(N_QUERIES),
    'r10': np.zeros(N_QUERIES),
    'r20': np.zeros(N_QUERIES),
    'ndcg10': np.zeros(N_QUERIES),
    'mrr': np.zeros(N_QUERIES),
    'latencyMs': np.zeros(N_QUERIES),
    'hit10': np.zeros(N_QUERIES, dtype=int),
    'fullHit10': np.zeros(N_QUERIES, dtype=int),
} for arch in ARCH_IDS}

query_domains = []
query_langs = []

for i, q in enumerate(queries):
    query_domains.append(q['domain'])
    query_langs.append(q['lang'])
    for arch in ARCH_IDS:
        res = q['architectures'][arch]
        arch_metrics[arch]['r5'][i] = res['r5']
        arch_metrics[arch]['r10'][i] = res['r10']
        arch_metrics[arch]['r20'][i] = res['r20']
        arch_metrics[arch]['ndcg10'][i] = res['ndcg10']
        arch_metrics[arch]['mrr'][i] = res['mrr']
        arch_metrics[arch]['latencyMs'][i] = res['latencyMs']
        arch_metrics[arch]['hit10'][i] = res['hit10']
        arch_metrics[arch]['fullHit10'][i] = res['fullHit10']

query_domains = np.array(query_domains)
query_langs = np.array(query_langs)

# ==============================================================================
# 2. MONTE CARLO BOOTSTRAPPING (10,000 Iterations for 95% Confidence Intervals)
# ==============================================================================
BOOTSTRAP_ITERATIONS = 10000
print(f'[Bootstrap] Running {BOOTSTRAP_ITERATIONS} iterations...')

def compute_bca_interval(data, stat_fn, boot_stats, alpha=0.05):
    n = len(data)
    orig_stat = stat_fn(data)
    prop_less = np.mean(boot_stats < orig_stat)
    prop_less = np.clip(prop_less, 1e-6, 1 - 1e-6)
    z0 = stats.norm.ppf(prop_less)

    jack_stats = np.zeros(n)
    for i in range(n):
        jack_sample = np.delete(data, i)
        jack_stats[i] = stat_fn(jack_sample)
    jack_mean = np.mean(jack_stats)
    diff = jack_mean - jack_stats
    sum_cubed = np.sum(diff**3)
    sum_squared = np.sum(diff**2)
    a = 0.0 if sum_squared == 0 else sum_cubed / (6.0 * (sum_squared**1.5))

    z_alpha = stats.norm.ppf(alpha / 2.0)
    z_1_alpha = stats.norm.ppf(1.0 - alpha / 2.0)

    denom_lower = 1.0 - a * (z0 + z_alpha)
    denom_upper = 1.0 - a * (z0 + z_1_alpha)

    if denom_lower == 0 or denom_upper == 0:
        return float(np.percentile(boot_stats, 2.5)), float(np.percentile(boot_stats, 97.5))

    alpha_lower = stats.norm.cdf(z0 + (z0 + z_alpha) / denom_lower)
    alpha_upper = stats.norm.cdf(z0 + (z0 + z_1_alpha) / denom_upper)
    alpha_lower = np.clip(alpha_lower, 0.0001, 0.9999)
    alpha_upper = np.clip(alpha_upper, 0.0001, 0.9999)

    return float(np.percentile(boot_stats, 100 * alpha_lower)), float(np.percentile(boot_stats, 100 * alpha_upper))

boot_indices = np.random.randint(0, N_QUERIES, size=(BOOTSTRAP_ITERATIONS, N_QUERIES))
bootstrap_results = {}

for arch in ARCH_IDS:
    arch_res = {}
    for m in ['r5', 'r10', 'r20', 'ndcg10', 'mrr', 'latencyMs']:
        arr = arch_metrics[arch][m]
        resampled = arr[boot_indices]
        boot_means = np.mean(resampled, axis=1)

        sample_mean = float(np.mean(arr))
        boot_mean = float(np.mean(boot_means))
        boot_se = float(np.std(boot_means, ddof=1))
        bias = float(boot_mean - sample_mean)

        pct_ci_lower = float(np.percentile(boot_means, 2.5))
        pct_ci_upper = float(np.percentile(boot_means, 97.5))
        bca_ci_lower, bca_ci_upper = compute_bca_interval(arr, np.mean, boot_means, alpha=0.05)

        arch_res[m] = {
            'sampleMean': round(sample_mean, 4),
            'bootMean': round(boot_mean, 4),
            'standardError': round(boot_se, 4),
            'bias': round(bias, 6),
            'ci95Percentile': [round(pct_ci_lower, 4), round(pct_ci_upper, 4)],
            'ci95Bca': [round(bca_ci_lower, 4), round(bca_ci_upper, 4)]
        }

    lat_arr = arch_metrics[arch]['latencyMs']
    boot_p50 = np.percentile(lat_arr[boot_indices], 50, axis=1)
    boot_p95 = np.percentile(lat_arr[boot_indices], 95, axis=1)

    arch_res['latencyP50'] = {
        'sampleP50': float(np.percentile(lat_arr, 50)),
        'bootMeanP50': round(float(np.mean(boot_p50)), 2),
        'ci95Percentile': [round(float(np.percentile(boot_p50, 2.5)), 2), round(float(np.percentile(boot_p95, 97.5)), 2)]
    }
    arch_res['latencyP95'] = {
        'sampleP95': float(np.percentile(lat_arr, 95)),
        'bootMeanP95': round(float(np.mean(boot_p95)), 2),
        'ci95Percentile': [round(float(np.percentile(boot_p50, 2.5)), 2), round(float(np.percentile(boot_p95, 97.5)), 2)]
    }
    bootstrap_results[arch] = arch_res

pairwise_delta_bootstrap = {}
posterapp_r10 = arch_metrics['posterapp-sota']['r10']
posterapp_ndcg = arch_metrics['posterapp-sota']['ndcg10']

for base in ARCH_IDS:
    if base == 'posterapp-sota':
        continue
    diff_r10 = posterapp_r10 - arch_metrics[base]['r10']
    diff_ndcg = posterapp_ndcg - arch_metrics[base]['ndcg10']

    boot_diff_r10 = np.mean(diff_r10[boot_indices], axis=1)
    boot_diff_ndcg = np.mean(diff_ndcg[boot_indices], axis=1)

    pairwise_delta_bootstrap[base] = {
        'deltaRecallAt10': {
            'meanDelta': round(float(np.mean(diff_r10)), 4),
            'se': round(float(np.std(boot_diff_r10, ddof=1)), 4),
            'ci95': [round(float(np.percentile(boot_diff_r10, 2.5)), 4), round(float(np.percentile(boot_diff_r10, 97.5)), 4)]
        },
        'deltaNdcgAt10': {
            'meanDelta': round(float(np.mean(diff_ndcg)), 4),
            'se': round(float(np.std(boot_diff_ndcg, ddof=1)), 4),
            'ci95': [round(float(np.percentile(boot_diff_ndcg, 2.5)), 4), round(float(np.percentile(boot_diff_ndcg, 97.5)), 4)]
        }
    }
print('[Bootstrap] 10,000 iterations completed.')

# ==============================================================================
# 3. MCNEMAR TESTS (Paired Binary Outcomes)
# ==============================================================================
print('[McNemar] Running paired binary outcome tests...')

def run_mcnemar_test(y_target, y_base, test_label=''):
    a = int(np.sum((y_target == 1) & (y_base == 1)))
    b = int(np.sum((y_target == 1) & (y_base == 0)))
    c = int(np.sum((y_target == 0) & (y_base == 1)))
    d = int(np.sum((y_target == 0) & (y_base == 0)))

    discordant = b + c
    if discordant > 0:
        chi2_corrected = float(((abs(b - c) - 1.0) ** 2) / discordant)
        p_val_chi2 = float(1.0 - stats.chi2.cdf(chi2_corrected, df=1))
        p_val_exact = float(2.0 * stats.binom.cdf(min(b, c), discordant, 0.5))
        p_val_exact = min(1.0, p_val_exact)
    else:
        chi2_corrected = 0.0
        p_val_chi2 = 1.0
        p_val_exact = 1.0

    odds_ratio = float((b + 0.5) / (c + 0.5))
    se_ln_or = math.sqrt(1.0 / (b + 0.5) + 1.0 / (c + 0.5))
    ci_or_lower = math.exp(math.log(odds_ratio) - 1.96 * se_ln_or)
    ci_or_upper = math.exp(math.log(odds_ratio) + 1.96 * se_ln_or)

    return {
        'test': test_label,
        'contingencyTable': {
            'targetSuccess_baseSuccess_a': a,
            'targetSuccess_baseFail_b': b,
            'targetFail_baseSuccess_c': c,
            'targetFail_baseFail_d': d
        },
        'discordantPairs': discordant,
        'mcnemarChi2': round(chi2_corrected, 4),
        'chi2PValue': float(p_val_chi2),
        'exactBinomialPValue': float(p_val_exact),
        'oddsRatio': round(odds_ratio, 3),
        'oddsRatio95CI': [round(ci_or_lower, 3), round(ci_or_upper, 3)],
        'significantAtAlpha001': bool(p_val_exact < 0.01),
        'significantAtAlpha005': bool(p_val_exact < 0.05)
    }

mcnemar_results = {}
binary_targets = [
    ('hit_at_10', lambda m: m['hit10']),
    ('full_hit_at_10', lambda m: m['fullHit10']),
    ('high_quality_ndcg_ge_08', lambda m: (m['ndcg10'] >= 0.80).astype(int)),
]

for crit_name, extractor in binary_targets:
    crit_dict = {}
    target_binary = extractor(arch_metrics['posterapp-sota'])
    for base in ARCH_IDS:
        if base == 'posterapp-sota':
            continue
        base_binary = extractor(arch_metrics[base])
        crit_dict[base] = run_mcnemar_test(target_binary, base_binary, f'PosterApp SOTA vs {base} ({crit_name})')
    mcnemar_results[crit_name] = crit_dict

print('[McNemar] McNemar tests complete.')

# ==============================================================================
# 4. WILCOXON SIGNED-RANK TESTS (Overall, Domains, and Languages)
# ==============================================================================
print('[Wilcoxon] Running Wilcoxon signed-rank tests...')

def compute_wilcoxon_exact(x, y):
    diff = x - y
    non_zero = diff[diff != 0]
    n_r = len(non_zero)
    if n_r == 0:
        return {
            'nTotal': len(x),
            'nNonZero': 0,
            'sumPositiveRanks': 0.0,
            'sumNegativeRanks': 0.0,
            'testStatisticW': 0.0,
            'zScore': 0.0,
            'pValue': 1.0,
            'effectSizeR': 0.0,
            'effectMagnitude': 'none',
            'significantAtAlpha001': False,
            'significantAtAlpha005': False
        }

    abs_diff = np.abs(non_zero)
    ranks = stats.rankdata(abs_diff)
    w_pos = float(np.sum(ranks[non_zero > 0]))
    w_neg = float(np.sum(ranks[non_zero < 0]))
    w_stat = min(w_pos, w_neg)

    scipy_res = stats.wilcoxon(x, y, zero_method='pratt', correction=True, alternative='two-sided')

    unique_ranks, counts = np.unique(abs_diff, return_counts=True)
    tie_term = np.sum(counts**3 - counts) / 48.0
    mean_w = n_r * (n_r + 1) / 4.0
    var_w = (n_r * (n_r + 1) * (2 * n_r + 1)) / 24.0 - tie_term
    sd_w = math.sqrt(max(var_w, 1e-9))

    z = (w_pos - mean_w - 0.5 * np.sign(w_pos - mean_w)) / sd_w
    effect_size_r = abs(z) / math.sqrt(len(x))

    return {
        'nTotal': int(len(x)),
        'nNonZero': int(n_r),
        'sumPositiveRanksWPlus': round(w_pos, 2),
        'sumNegativeRanksWMinus': round(w_neg, 2),
        'testStatisticW': round(w_stat, 2),
        'zScore': round(float(z), 4),
        'pValue': float(scipy_res.pvalue),
        'effectSizeR': round(float(effect_size_r), 4),
        'effectMagnitude': 'large' if effect_size_r >= 0.5 else ('medium' if effect_size_r >= 0.3 else 'small'),
        'significantAtAlpha001': bool(float(scipy_res.pvalue) < 0.01),
        'significantAtAlpha005': bool(float(scipy_res.pvalue) < 0.05)
    }

wilcoxon_results = {
    'overall': {'ndcg10': {}, 'recall10': {}},
    'byDomain': {d: {'ndcg10': {}, 'recall10': {}} for d in DOMAINS},
    'byLanguage': {l: {'ndcg10': {}, 'recall10': {}} for l in LANGUAGES}
}

p_sota_ndcg = arch_metrics['posterapp-sota']['ndcg10']
p_sota_r10 = arch_metrics['posterapp-sota']['r10']

for base in ARCH_IDS:
    if base == 'posterapp-sota':
        continue
    wilcoxon_results['overall']['ndcg10'][base] = compute_wilcoxon_exact(p_sota_ndcg, arch_metrics[base]['ndcg10'])
    wilcoxon_results['overall']['recall10'][base] = compute_wilcoxon_exact(p_sota_r10, arch_metrics[base]['r10'])

for d in DOMAINS:
    mask = (query_domains == d)
    for base in ARCH_IDS:
        if base == 'posterapp-sota':
            continue
        wilcoxon_results['byDomain'][d]['ndcg10'][base] = compute_wilcoxon_exact(p_sota_ndcg[mask], arch_metrics[base]['ndcg10'][mask])
        wilcoxon_results['byDomain'][d]['recall10'][base] = compute_wilcoxon_exact(p_sota_r10[mask], arch_metrics[base]['r10'][mask])

for l in LANGUAGES:
    mask = (query_langs == l)
    for base in ARCH_IDS:
        if base == 'posterapp-sota':
            continue
        wilcoxon_results['byLanguage'][l]['ndcg10'][base] = compute_wilcoxon_exact(p_sota_ndcg[mask], arch_metrics[base]['ndcg10'][mask])
        wilcoxon_results['byLanguage'][l]['recall10'][base] = compute_wilcoxon_exact(p_sota_r10[mask], arch_metrics[base]['r10'][mask])

print('[Wilcoxon] Wilcoxon tests complete.')

# ==============================================================================
# 4b. SUMMARY CONCLUSION — computed from the tests above, never hardcoded.
#     The previous version wrote fixed strings asserting "p < 0.001 in all
#     tests" regardless of what the tests actually returned; the conclusion is
#     now derived from the computed results so it can no longer contradict
#     the data.
# ==============================================================================

BASELINE_ARCH_IDS = [a for a in ARCH_IDS if a != 'posterapp-sota']

def compute_summary_conclusion(arch_metrics, wilcoxon_results, mcnemar_results, input_methodology):
    # 1. Does PosterApp actually lead on the raw means?
    mean_r10 = {a: float(np.mean(arch_metrics[a]['r10'])) for a in ARCH_IDS}
    mean_ndcg = {a: float(np.mean(arch_metrics[a]['ndcg10'])) for a in ARCH_IDS}
    best_baseline = max(BASELINE_ARCH_IDS, key=lambda a: mean_r10[a])
    posterapp_leads_recall = mean_r10['posterapp-sota'] > mean_r10[best_baseline]
    posterapp_leads_ndcg = mean_ndcg['posterapp-sota'] > max(mean_ndcg[a] for a in BASELINE_ARCH_IDS)

    # 2. Significance across the overall Wilcoxon tests (both metrics, all baselines)
    wilcoxon_tests = []
    for metric in ('ndcg10', 'recall10'):
        for base, res in wilcoxon_results['overall'][metric].items():
            wilcoxon_tests.append(res)
    n_wilcoxon = len(wilcoxon_tests)
    n_sig_005 = sum(1 for t in wilcoxon_tests if t['significantAtAlpha005'])
    n_sig_001 = sum(1 for t in wilcoxon_tests if t['significantAtAlpha001'])
    all_sig_001 = n_wilcoxon > 0 and n_sig_001 == n_wilcoxon

    # 3. Significance across McNemar outcomes
    mcnemar_tests = []
    for outcome in mcnemar_results.values():
        for res in outcome.values():
            mcnemar_tests.append(res)
    n_mcnemar = len(mcnemar_tests)
    n_mc_sig_001 = sum(1 for t in mcnemar_tests if t['significantAtAlpha001'])
    all_mc_sig_001 = n_mcnemar > 0 and n_mc_sig_001 == n_mcnemar

    # 4. Effect sizes: Wilcoxon r against each baseline (recall10 + ndcg10, overall)
    effect_sizes = [t['effectSizeR'] for t in wilcoxon_tests]
    min_r = min(effect_sizes) if effect_sizes else 0.0
    max_r = max(effect_sizes) if effect_sizes else 0.0

    superiority = (
        f"PosterApp SOTA mean Recall@10 = {mean_r10['posterapp-sota']:.4f} vs best baseline "
        f"({best_baseline} = {mean_r10[best_baseline]:.4f}): "
        + ("leads" if posterapp_leads_recall else "DOES NOT LEAD")
        + f"; mean nDCG@10 = {mean_ndcg['posterapp-sota']:.4f}: "
        + ("leads all baselines" if posterapp_leads_ndcg else "does not lead all baselines")
        + f". Overall Wilcoxon tests: {n_sig_001}/{n_wilcoxon} significant at alpha=0.01 "
        f"({n_sig_005}/{n_wilcoxon} at alpha=0.05). McNemar tests: {n_mc_sig_001}/{n_mcnemar} "
        "significant at alpha=0.01. "
        + ("All tests significant at alpha=0.01."
           if (all_sig_001 and all_mc_sig_001)
           else "NOT all tests are significant — any blanket superiority claim is unsupported by these data.")
    )
    large_effect_sizes = (
        f"Wilcoxon effect size r ranges from {min_r:.3f} to {max_r:.3f} across the overall "
        "baseline comparisons (recall@10 and nDCG@10)."
    )
    methodology_note = (
        f"These conclusions describe the input artifact only (methodology: {input_methodology}). "
        "They are statistics over the supplied per-query numbers, not a guarantee that those "
        "numbers were measured on a real corpus."
    )

    return {
        'superiority': superiority,
        'largeEffectSizes': large_effect_sizes,
        'methodologyNote': methodology_note,
        'posterappMeanRecallAt10': round(mean_r10['posterapp-sota'], 4),
        'bestBaselineId': best_baseline,
        'bestBaselineMeanRecallAt10': round(mean_r10[best_baseline], 4),
        'wilcoxonOverall': {'total': n_wilcoxon, 'significantAtAlpha001': n_sig_001, 'significantAtAlpha005': n_sig_005},
        'mcnemar': {'total': n_mcnemar, 'significantAtAlpha001': n_mc_sig_001},
        'effectSizeRange': [round(min_r, 4), round(max_r, 4)],
    }

# ==============================================================================
# 5. CONCURRENCY & QUEUEING THEORY SIMULATION (1 to 20 Concurrent Users)
# ==============================================================================
print('[Concurrency] Simulating multi-user queueing dynamics...')

CONCURRENCY_LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20]
SIM_REQUESTS_PER_LEVEL = 25000

concurrency_simulation_results = []

NUM_WORKERS = 4
NUM_DBCONNS = 10

for concurrency in CONCURRENCY_LEVELS:
    worker_available_at = np.zeros(NUM_WORKERS)
    db_available_at = np.zeros(NUM_DBCONNS)

    response_times = np.zeros(SIM_REQUESTS_PER_LEVEL)
    service_times = np.zeros(SIM_REQUESTS_PER_LEVEL)
    wait_times = np.zeros(SIM_REQUESTS_PER_LEVEL)

    user_ready_time = np.zeros(concurrency)

    for req_idx in range(SIM_REQUESTS_PER_LEVEL):
        user_idx = int(np.argmin(user_ready_time))
        arrival_time = user_ready_time[user_idx]

        # Stage 1: Embedding (Worker pool)
        t_stage1 = max(4.0, float(np.random.normal(12.0, 2.0)))
        w_idx = int(np.argmin(worker_available_at))
        start_st1 = max(arrival_time, worker_available_at[w_idx])
        finish_st1 = start_st1 + t_stage1
        worker_available_at[w_idx] = finish_st1

        # Stage 2 & 3: DB (HNSW + FTS + Graph DRIFT)
        t_db = float(np.random.lognormal(mean=2.8, sigma=0.25))
        db_idx = int(np.argmin(db_available_at))
        start_db = max(finish_st1, db_available_at[db_idx])
        finish_db = start_db + t_db
        db_available_at[db_idx] = finish_db

        # Stage 4: Fusion & Context Expansion (CPU)
        t_stage4 = max(1.0, float(np.random.normal(3.0, 0.4)))
        finish_st4 = finish_db + t_stage4

        # Stage 5: BGE Reranker (Worker pool)
        t_rerank = float(np.random.lognormal(mean=2.6, sigma=0.25))
        w_idx2 = int(np.argmin(worker_available_at))
        start_rerank = max(finish_st4, worker_available_at[w_idx2])
        finish_rerank = start_rerank + t_rerank
        worker_available_at[w_idx2] = finish_rerank

        # Stage 6: Deterministic verification & adjudication (CPU)
        t_verify = max(1.0, float(np.random.normal(5.0, 0.8)))
        finish_time = finish_rerank + t_verify

        total_resp = finish_time - arrival_time
        pure_service = t_stage1 + t_db + t_stage4 + t_rerank + t_verify
        pure_wait = total_resp - pure_service

        response_times[req_idx] = total_resp
        service_times[req_idx] = pure_service
        wait_times[req_idx] = max(0.0, pure_wait)

        user_ready_time[user_idx] = finish_time + 50.0

    mean_resp_ms = float(np.mean(response_times))
    mean_serv_ms = float(np.mean(service_times))
    mean_wait_ms = float(np.mean(wait_times))

    cycle_time_sec = (mean_resp_ms + 50.0) / 1000.0
    throughput_rps = concurrency / cycle_time_sec

    p50_ms = float(np.percentile(response_times, 50))
    p90_ms = float(np.percentile(response_times, 90))
    p95_ms = float(np.percentile(response_times, 95))
    p99_ms = float(np.percentile(response_times, 99))

    worker_utilization = min(1.0, (throughput_rps * 0.026) / NUM_WORKERS)
    db_utilization = min(1.0, (throughput_rps * 0.017) / NUM_DBCONNS)

    concurrency_simulation_results.append({
        'concurrencyUsers': concurrency,
        'throughputRps': round(throughput_rps, 2),
        'meanResponseTimeMs': round(mean_resp_ms, 2),
        'meanServiceTimeMs': round(mean_serv_ms, 2),
        'meanQueueWaitTimeMs': round(mean_wait_ms, 2),
        'p50LatencyMs': round(p50_ms, 2),
        'p90LatencyMs': round(p90_ms, 2),
        'p95LatencyMs': round(p95_ms, 2),
        'p99LatencyMs': round(p99_ms, 2),
        'workerPoolUtilization': round(worker_utilization, 3),
        'dbPoolUtilization': round(db_utilization, 3),
        'saturationRatio': round(throughput_rps / (NUM_WORKERS / 0.026), 3),
        # Little's law check L = lambda * W. By construction of the closed-loop
        # model (throughput = concurrency / cycle_time), this is consistent
        # whenever the arithmetic holds; it is computed, not asserted.
        'littlesLawConsistent': bool(abs(throughput_rps * cycle_time_sec - concurrency) < 0.01 * max(1, concurrency))
    })

latencies = [c['meanResponseTimeMs'] for c in concurrency_simulation_results]
concurrencies = [c['concurrencyUsers'] for c in concurrency_simulation_results]
slopes = [(latencies[i] - latencies[i-1]) / (concurrencies[i] - concurrencies[i-1]) for i in range(1, len(latencies))]
knee_idx = int(np.argmax(slopes)) + 1
saturation_knee_users = concurrencies[knee_idx]
max_sustainable_rps = max(c['throughputRps'] for c in concurrency_simulation_results)

print(f'[Concurrency] Saturation knee={saturation_knee_users}, max RPS={max_sustainable_rps}')

# ==============================================================================
# 6. EXACT MATHEMATICAL PROPERTIES
# ==============================================================================
print('[Exact Math] Computing RRF stability, Graph DRIFT bounds, Claim verification, and O(V+E) scaling...')

# 6.1 RRF Stability
K_VALUES = [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200]
N_ITEMS = 100
M_SOURCES = 6
WEIGHTS = np.array([1.0, 0.9, 0.6, 0.6, 0.4, 0.5])

def compute_rrf_ranks(rmat, k, weights):
    scores = np.sum(weights[np.newaxis, :] / (k + rmat), axis=1)
    ranked_indices = np.argsort(-scores)
    item_ranks = np.empty_like(ranked_indices)
    item_ranks[ranked_indices] = np.arange(1, len(scores) + 1)
    return item_ranks, scores

np.random.seed(123)
rank_matrix = np.zeros((N_ITEMS, M_SOURCES))
for s in range(M_SOURCES):
    rank_matrix[:, s] = np.random.permutation(N_ITEMS) + 1

rank_matrix[0, :4] = [2, 3, 4, 3]
rank_matrix[1, :] = [1, 80, 90, 85, 70, 75]

ref_ranks, ref_scores = compute_rrf_ranks(rank_matrix, k=60, weights=WEIGHTS)

rrf_stability_analysis = {
    'mathematicalFormulation': {
        'scoreFormula': 'RRF(d) = sum_{m in M} (w_m / (k + r_m(d)))',
        'firstDerivative': 'd(RRF)/dr_m = -w_m / (k + r_m)^2',
        'secondDerivative': 'd^2(RRF)/dr_m^2 = 2 * w_m / (k + r_m)^3',
        'rank1ToRank10SensitivityRatio': 'S(k) = ((k + 10) / (k + 1))^2',
        'twoSourceConsensusThreshold': 'r_threshold = k + 2'
    },
    'kParameterSweep': []
}

for k_val in K_VALUES:
    cur_ranks, cur_scores = compute_rrf_ranks(rank_matrix, k=k_val, weights=WEIGHTS)
    tau, _ = stats.kendalltau(ref_ranks, cur_ranks)
    rho, _ = stats.spearmanr(ref_ranks, cur_ranks)
    sens_ratio = ((k_val + 10.0) / (k_val + 1.0)) ** 2
    consensus_beat_solo_rank = k_val + 2

    noisy_matrix = np.clip(rank_matrix + np.random.normal(0, 2.0, size=rank_matrix.shape), 1, N_ITEMS)
    noisy_ranks, _ = compute_rrf_ranks(noisy_matrix, k=k_val, weights=WEIGHTS)
    inversion_rate = float(np.mean(np.abs(cur_ranks - noisy_ranks) > 2))

    rrf_stability_analysis['kParameterSweep'].append({
        'k': k_val,
        'kendallTauVsK60': round(float(tau), 4),
        'spearmanRhoVsK60': round(float(rho), 4),
        'sensitivityRatioRank1to10': round(float(sens_ratio), 3),
        'consensusRankDominanceThreshold': consensus_beat_solo_rank,
        'noiseRankInversionRate': round(inversion_rate, 4),
        'firstDerivativeAtRank1': round(-1.0 / ((k_val + 1.0)**2), 6),
        'firstDerivativeAtRank10': round(-1.0 / ((k_val + 10.0)**2), 6)
    })

# 6.2 Graph DRIFT Bounds
ALPHA = 0.85
EPSILONS = [0.1, 0.05, 0.01, 0.005, 0.001, 1e-4, 1e-5]
drift_ppr_convergence_bounds = []
for eps in EPSILONS:
    t_bound = math.ceil(math.log(2.0 / eps) / math.log(1.0 / ALPHA))
    drift_ppr_convergence_bounds.append({
        'epsilonTarget': eps,
        'dampingFactorAlpha': ALPHA,
        'contractionRate': ALPHA,
        'theoreticalMaxIterations': t_bound,
        'residualL1Bound': round(2.0 * (ALPHA ** t_bound), 6)
    })

DRIFT_SIM_RUNS = 5000
drift_sim_iterations = []
drift_sim_final_nodes = []
drift_sim_marginal_gains = []

for _ in range(DRIFT_SIM_RUNS):
    num_seeds = np.random.randint(2, 5)
    visited = set(range(num_seeds))
    frontier = set(range(num_seeds))
    iter_count = 0
    gain_hist = []
    for it in range(1, 4):
        iter_count += 1
        prev_count = len(visited)
        next_frontier = set()
        for f in frontier:
            deg = np.random.poisson(3.2)
            neighbors = np.random.randint(0, 80, size=deg)
            for n in neighbors:
                if n not in visited and len(visited) < 40:
                    visited.add(n)
                    next_frontier.add(n)
                if len(visited) >= 40:
                    break
            if len(visited) >= 40:
                break
        newly_disc = len(visited) - prev_count
        gain = newly_disc / prev_count if prev_count > 0 else 1.0
        gain_hist.append(gain)
        if gain < 0.05 or newly_disc == 0 or len(visited) >= 40:
            break
        frontier = next_frontier
        if len(frontier) == 0:
            break
    drift_sim_iterations.append(iter_count)
    drift_sim_final_nodes.append(len(visited))
    drift_sim_marginal_gains.append(gain_hist[-1])

graph_drift_analysis = {
    'personalizedPageRankBounds': {
        'dampingFactorAlpha': ALPHA,
        'spectralRadiusContraction': ALPHA,
        'lipshitzConstantL1': ALPHA,
        'convergenceEquation': '||p^{(t)} - p*||_1 <= 2 * alpha^t',
        'iterationsToEpsilon': drift_ppr_convergence_bounds
    },
    'frontierExpansionSimulation': {
        'totalRuns': DRIFT_SIM_RUNS,
        'maxIterationsConfigured': 3,
        'maxNodeBudgetConfigured': 40,
        'convergenceThresholdGain': 0.05,
        'meanIterationsExecuted': round(float(np.mean(drift_sim_iterations)), 3),
        'p95IterationsExecuted': int(np.percentile(drift_sim_iterations, 95)),
        'meanNodesExpanded': round(float(np.mean(drift_sim_final_nodes)), 2),
        'p95NodesExpanded': int(np.percentile(drift_sim_final_nodes, 95)),
        'iterationDistribution': {
            '1_iteration_pct': round(float(np.mean(np.array(drift_sim_iterations) == 1) * 100), 2),
            '2_iterations_pct': round(float(np.mean(np.array(drift_sim_iterations) == 2) * 100), 2),
            '3_iterations_pct': round(float(np.mean(np.array(drift_sim_iterations) == 3) * 100), 2)
        },
        'guaranteedTerminationProof': 'Since V_t is monotonically non-decreasing and bounded above by min(|V|, 40), and Delta_t is strictly evaluated per iteration with hard stop at t=3, termination is strictly guaranteed in O(1) time steps <= 3.'
    }
}

# 6.3 Claim Verification Precision/Recall
N_CLAIMS = 200
np.random.seed(42)

scores_supported = np.random.beta(8, 2, size=100)
scores_contradicted = np.random.beta(2, 8, size=60)
scores_unsupported = np.random.beta(3, 5, size=40)

y_true = np.concatenate([np.ones(100), np.zeros(100)])
y_scores = np.concatenate([scores_supported, scores_contradicted, scores_unsupported])

TAU_STEPS = np.linspace(0.0, 1.0, 101)
curve_points = []

for tau in TAU_STEPS:
    y_pred = (y_scores >= tau).astype(int)
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))

    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 1.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 1.0
    f1 = float(2.0 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    youden_j = recall + specificity - 1.0

    curve_points.append({
        'tau': round(float(tau), 2),
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn,
        'precision': round(precision, 4),
        'recall_sensitivity': round(recall, 4),
        'specificity': round(specificity, 4),
        'fpr': round(fpr, 4),
        'f1': round(f1, 4),
        'youdenJ': round(youden_j, 4)
    })

fprs = np.array([p['fpr'] for p in curve_points])
recalls = np.array([p['recall_sensitivity'] for p in curve_points])
precisions = np.array([p['precision'] for p in curve_points])

roc_order = np.argsort(fprs)
auc_roc = float(np.trapezoid(recalls[roc_order], fprs[roc_order]))

pr_order = np.argsort(recalls)
auc_pr = float(np.trapezoid(precisions[pr_order], recalls[pr_order]))

f1_scores = [p['f1'] for p in curve_points]
j_scores = [p['youdenJ'] for p in curve_points]

best_f1_idx = int(np.argmax(f1_scores))
best_j_idx = int(np.argmax(j_scores))

optimal_tau_f1 = curve_points[best_f1_idx]['tau']
optimal_tau_j = curve_points[best_j_idx]['tau']

claim_verification_analysis = {
    'dataset': {
        'totalClaims': N_CLAIMS,
        'supportedTruePositives': 100,
        'contradicted': 60,
        'unsupported': 40
    },
    'aucRoc': round(auc_roc, 4),
    'aucPr': round(auc_pr, 4),
    'optimalThresholdF1': {
        'tau': optimal_tau_f1,
        'maxF1': curve_points[best_f1_idx]['f1'],
        'precision': curve_points[best_f1_idx]['precision'],
        'recall': curve_points[best_f1_idx]['recall_sensitivity'],
        'specificity': curve_points[best_f1_idx]['specificity']
    },
    'optimalThresholdYoudenJ': {
        'tau': optimal_tau_j,
        'maxYoudenJ': curve_points[best_j_idx]['youdenJ'],
        'sensitivity': curve_points[best_j_idx]['recall_sensitivity'],
        'specificity': curve_points[best_j_idx]['specificity']
    },
    'sampledCurve': [p for i, p in enumerate(curve_points) if i % 5 == 0]
}

# 6.4 O(V+E) vs O(N^2) Scaling
CORPUS_SIZES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
scaling_comparison = []

for N in CORPUS_SIZES:
    V = N
    E = 4 * N
    mem_sparse_bytes = 256 * V + 64 * E
    mem_sparse_mb = mem_sparse_bytes / (1024 * 1024)
    latency_drift_ms = 8.0 + 1.2 * math.log10(N)

    mem_dense_bytes = 4 * (N ** 2)
    mem_dense_mb = mem_dense_bytes / (1024 * 1024)
    mem_dense_gb = mem_dense_bytes / (1024 * 1024 * 1024)
    dense_flops = 2 * (N ** 2) * 1024
    dense_latency_ms = max(0.1, (dense_flops / 1e10) * 1000.0)

    scaling_comparison.append({
        'corpusSizeN': N,
        'graphDrift': {
            'complexityClass': 'O(V + E)',
            'memoryMb': round(mem_sparse_mb, 2),
            'latencyMs': round(latency_drift_ms, 2),
            'feasibleInteractive': True
        },
        'denseAllPairs': {
            'complexityClass': 'O(N^2)',
            'memoryMb': round(mem_dense_mb, 2),
            'memoryGb': round(mem_dense_gb, 4),
            'flops': dense_flops,
            'latencyMs': round(dense_latency_ms, 2),
            'feasibleInteractive': bool(mem_dense_gb <= 4.0 and dense_latency_ms <= 200.0)
        },
        'memoryRatioDenseOverSparse': round(mem_dense_bytes / mem_sparse_bytes, 2),
        'latencyRatioDenseOverSparse': round(dense_latency_ms / latency_drift_ms, 2)
    })

crossover_memory_1gb_N = math.ceil(math.sqrt((1024**3) / 4.0))
crossover_latency_100ms_N = math.ceil(math.sqrt((100.0 / 1000.0) * 1e10 / (2 * 1024)))

scaling_analysis = {
    'mathematicalModels': {
        'sparseGraphDrift': {
            'asymptoticMemory': 'O(V + E) = O((1 + d) * V)',
            'asymptoticQueryTime': 'O(min(d^h, V_max)) + O(log V)',
            'memoryEquationBytes': 'M_sparse(V) = 256 * V + 64 * (d * V)',
            'empiricalAverageDegree': 4.0
        },
        'denseAllPairs': {
            'asymptoticMemory': 'O(N^2)',
            'asymptoticQueryTime': 'O(N^2 * D_embed)',
            'memoryEquationBytes': 'M_dense(N) = 4 * N^2',
            'dimensionsD': 1024
        }
    },
    'crossoverLimits': {
        'denseMemoryExceeds1GbAtN': crossover_memory_1gb_N,
        'denseLatencyExceeds100msAtN': crossover_latency_100ms_N,
        'verdict': 'Dense all-pairs cross-matching collapses for N > 20,000 entities due to O(N^2) memory exhaustion, whereas PosterApp localized DRIFT maintains sub-20ms latency and minimal memory at 1,000,000 nodes.'
    },
    'scalingTable': scaling_comparison
}

# ==============================================================================
# 7. ASSEMBLE JSON ARTIFACTS
# ==============================================================================
print('[Export] Writing artifacts/eval/simulation-results.json and statistical-tests.json...')

simulation_results_payload = {
    'schemaVersion': '2.1-posterapp-simulation',
    'timestamp': RUN_TIMESTAMP,
    'randomSeed': RANDOM_SEED,
    'inputFile': RAW_EVAL_PATH,
    'inputMethodology': INPUT_METHODOLOGY,
    'goldenDatasetQueriesCount': N_QUERIES,
    'concurrencySimulation': {
        'methodology': 'simulated — closed-loop queueing model with assumed stage-time distributions; not a measurement of the deployed system',
        'protocol': 'Closed-loop queueing simulation with M/M/m and M/G/m stage dynamics',
        'concurrencyLevelsTested': CONCURRENCY_LEVELS,
        'requestsPerLevel': SIM_REQUESTS_PER_LEVEL,
        'saturationKneeConcurrency': saturation_knee_users,
        'maxSustainableRps': max_sustainable_rps,
        'results': concurrency_simulation_results
    },
    'reciprocalRankFusionStability': {
        'methodology': 'analytic/synthetic — closed-form RRF properties computed on random rank matrices; not a measurement of PosterApp',
        **rrf_stability_analysis,
    },
    'graphDriftConvergenceBounds': {
        'methodology': 'analytic PPR contraction bound plus synthetic random-graph frontier simulation; not a measurement of the production knowledge graph',
        **graph_drift_analysis,
    },
    'claimVerificationPrecisionRecallCurve': {
        'methodology': 'simulated — classifier scores drawn from Beta distributions; NOT an evaluation of lib/ai/claim-verifier.ts',
        **claim_verification_analysis,
    },
    'complexityScalingAnalysis': {
        'methodology': 'analytic model with assumed per-node/per-edge constants; not a measurement',
        **scaling_analysis,
    }
}

with open(SIM_RESULTS_PATH, 'w', encoding='utf-8') as f:
    json.dump(simulation_results_payload, f, indent=2)
print(f'[Export] Saved simulation results to: {SIM_RESULTS_PATH}')

statistical_tests_payload = {
    'schemaVersion': '2.1-posterapp-statistical-tests',
    'timestamp': RUN_TIMESTAMP,
    'inputFile': RAW_EVAL_PATH,
    'inputMethodology': INPUT_METHODOLOGY,
    'goldenDatasetQueriesCount': N_QUERIES,
    'bootstrapConfidenceIntervals': {
        'iterations': BOOTSTRAP_ITERATIONS,
        'alpha': 0.05,
        'method': 'Percentile and Bias-Corrected and Accelerated (BCa)',
        'architectures': bootstrap_results,
        'pairwiseDeltasVsPosterApp': pairwise_delta_bootstrap
    },
    'mcnemarTests': {
        'description': 'Continuity-corrected and exact binomial paired McNemar tests comparing PosterApp SOTA vs each baseline',
        'outcomes': mcnemar_results
    },
    'wilcoxonSignedRankTests': {
        'description': 'Two-sided Wilcoxon signed-rank tests for nDCG@10 and Recall@10 across all queries, by academic domain, and by language',
        'tests': wilcoxon_results
    },
    'summaryConclusion': compute_summary_conclusion(arch_metrics, wilcoxon_results, mcnemar_results, INPUT_METHODOLOGY)
}

with open(STAT_TESTS_PATH, 'w', encoding='utf-8') as f:
    json.dump(statistical_tests_payload, f, indent=2)
print(f'[Export] Saved statistical tests to: {STAT_TESTS_PATH}')

print('[Success] Complete mathematical simulation suite executed successfully.')
