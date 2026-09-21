# Speculative Decoding with Provable Latency Guarantees and Lossless Verification

**Authors:** Julian Richter, Maya Lin, Aris Thorne, Sunita Deshmukh  
**Affiliation:** Systems and Machine Learning Laboratory, ETH Zürich & Stanford University  
**Venue:** Advances in Neural Information Processing Systems (NeurIPS), 2026

## Abstract
Speculative decoding accelerates large language model (LLM) generation by employing a lightweight draft model to hypothesize sequences of candidate tokens, followed by parallel verification under the target foundation model. However, standard speculative decoding faces severe tail-latency bottlenecks under distribution drift, and heuristic tree search introduces unbounded verification latency. Here we introduce MartingaleTree, an exact speculative decoding architecture equipped with provable latency bounds and lossless verification. By framing the sequential acceptance of draft branches as a stopped sub-martingale, we derive dynamic pruning thresholds via Ville's inequality that terminate speculative verification before tail latency degradation occurs. Coupled with a customized fused Triton tree-attention kernel and zero-copy ring-buffer KV-cache reuse, MartingaleTree achieves a $3.42\times$ wall-clock speedup on Llama-3-70B across MT-Bench, GSM8K, and HumanEval with strictly zero divergence from the target autoregressive token distribution ($D_{\text{TV}} = 0.000$, $\text{KL} = 0.000$).

## Methods
Let $p(x_t \mid x_{<t})$ denote the target foundation model distribution and $q(x_t \mid x_{<t})$ the draft model distribution. In tree-based speculative decoding, the draft model generates a prefix tree $\mathcal{T} = (\mathcal{V}, \mathcal{E})$ with branching factors $(b_1, \dots, b_d)$ containing $K = |\mathcal{V}|$ candidate tokens. The target model computes logits for all $K$ candidates in a single batched forward pass using a custom 2D tree-attention mask:
$$M_{i,j} = \begin{cases} 0 & \text{if } v_j \in \text{Ancestors}(v_i) \cup \{v_i\} \\ -\infty & \text{otherwise} \end{cases}$$

To guarantee exact distribution equivalence, candidate tokens along a branch path are accepted via modified rejection sampling:
$$r_i = \min\left(1, \frac{p(x_{t+i} \mid x_{<t+i})}{q(x_{t+i} \mid x_{<t+i})}\right)$$
A draft token is accepted if a uniform sample $u_i \sim \mathcal{U}(0, 1) \le r_i$. Upon the first rejection at node $k$, the target model resamples the next token from the residual distribution:
$$p_{\text{res}}(x) = \frac{\max(0, p(x) - q(x))}{1 - \sum_{y} \min(p(y), q(y))}$$
which mathematically guarantees that the marginal distribution of the output sequence is identically equal to $p(x)$.

To bound execution latency, we monitor the cumulative likelihood ratio process:
$$M_k = \prod_{j=1}^k \frac{p(x_{t+j} \mid x_{<t+j})}{q(x_{t+j} \mid x_{<t+j})}$$
Under the null hypothesis of aligned generation, $\{M_k\}_{k \ge 1}$ forms a non-negative martingale with $\mathbb{E}[M_k] = 1$. By Ville's maximal inequality:
$$\mathbb{P}\left(\sup_{1 \le k \le K} M_k \ge \lambda\right) \le \frac{1}{\lambda}$$
We define the Martingale stopping time $\tau = \inf \{k \in [1, K] : M_k < 1 - \delta\}$, dynamically pruning speculative branches when predicted draft alignment collapses below the confidence threshold $1 - \delta$.

## Results
We evaluated MartingaleTree against standard autoregressive decoding and leading speculative inference frameworks using Llama-3-70B-Instruct as the target model and Llama-3-1.5B as the draft model on 8× NVIDIA H100 GPUs (FP16/BF16).
1. **End-to-End Speedup:**
   - Autoregressive Baseline: 19.4 tok/s, 51.5 ms/tok (1.00×).
   - Standard Speculative Decoding ($K=4$): 42.1 tok/s, 23.8 ms/tok (2.17× speedup).
   - EAGLE / Medusa (Static Tree): 53.6 tok/s, 18.7 ms/tok (2.76× speedup).
   - **MartingaleTree (Ours):** **66.3 tok/s, 15.1 ms/tok (3.42× speedup)** ($p < 0.001$, 95% CI [64.8, 67.8] tok/s).
2. **Tail Latency Stability:** The 99th-percentile token generation latency is reduced from 48.6 ms in unconstrained tree speculative decoding to 18.2 ms under Martingale early stopping.
3. **Lossless Verification:** Across 100,000 generated tokens, the Total Variation distance $D_{\text{TV}}(P_{\text{spec}}, P_{\text{tgt}}) = 0.000000$ and Kullback-Leibler divergence $D_{\text{KL}} = 0.000$, confirming zero degradation on reasoning benchmarks (GSM8K: 92.4% vs 92.4%; HumanEval: 84.1% vs 84.1%).

## Limitations
1. Draft-Target Architectural Co-design: Speculative speedup depends on high draft model token acceptance ($>70\%$); on highly domain-specific tasks (e.g. niche assembly code), acceptance can decline, requiring smaller speculative tree depths.
2. High-Concurrency Batching: When serving thousands of concurrent users under severe compute saturation, batched autoregressive decoding becomes compute-bound rather than memory-bandwidth bound, reducing relative speculative speedup.
