import fs from "fs"
import path from "path"
import sharp from "sharp"

async function generateArchitectureSvg(): Promise<string> {
  return `
<svg width="1200" height="600" viewBox="0 0 1200 600" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Definitions for Gradients and Shadows -->
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#0E7490"/>
    </linearGradient>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#4B5563" />
    </marker>
  </defs>

  <!-- Title & Subtitle -->
  <text x="600" y="45" text-anchor="middle" font-size="22" font-weight="bold" fill="#111827">Multi-Scale Perceptual Tokenizer &amp; Sparse Gated Transformer Trunk</text>
  <text x="600" y="70" text-anchor="middle" font-size="13" fill="#6B7280">Unified End-to-End Multimodal Representation Learning Pipeline</text>

  <!-- Container Box 1: Input Modalities -->
  <g transform="translate(40, 100)">
    <rect width="220" height="440" rx="12" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2" filter="url(#shadow)"/>
    <text x="110" y="35" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F2937">1. Multimodal Inputs</text>
    
    <!-- Vision Input Sub-box -->
    <rect x="20" y="60" width="180" height="150" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
    <text x="110" y="90" text-anchor="middle" font-size="13" font-weight="600" fill="#1E40AF">Vision Patches</text>
    <text x="110" y="115" text-anchor="middle" font-size="11" fill="#3B82F6">X_img ∈ ℝ^{C × H × W}</text>
    <rect x="40" y="135" width="40" height="40" rx="4" fill="#3B82F6" opacity="0.8"/>
    <rect x="90" y="135" width="40" height="40" rx="4" fill="#60A5FA" opacity="0.8"/>
    <rect x="140" y="135" width="40" height="40" rx="4" fill="#93C5FD" opacity="0.8"/>
    <text x="110" y="195" text-anchor="middle" font-size="10" fill="#6B7280">16×16 Linear Embed</text>

    <!-- Language Input Sub-box -->
    <rect x="20" y="240" width="180" height="160" rx="8" fill="#F5F3FF" stroke="#DDD6FE" stroke-width="1.5"/>
    <text x="110" y="270" text-anchor="middle" font-size="13" font-weight="600" fill="#5B21B6">Text Tokens</text>
    <text x="110" y="295" text-anchor="middle" font-size="11" fill="#7C3AED">X_txt ∈ ℝ^{N × d_model}</text>
    <rect x="35" y="315" width="150" height="28" rx="4" fill="#8B5CF6" opacity="0.15" stroke="#C4B5FD"/>
    <text x="110" y="333" text-anchor="middle" font-size="10" font-weight="500" fill="#6D28D9">[CLS] WordPiece Tokens [SEP]</text>
    <text x="110" y="375" text-anchor="middle" font-size="10" fill="#6B7280">+ Learned Positional Encodings</text>
  </g>

  <!-- Arrow 1 to 2 -->
  <line x1="265" y1="320" x2="315" y2="320" stroke="#4B5563" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Container Box 2: Cross-Attention & Gating Fusion -->
  <g transform="translate(320, 100)">
    <rect width="360" height="440" rx="12" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2" filter="url(#shadow)"/>
    <text x="180" y="35" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F2937">2. Cross-Attention Fusion Trunk</text>

    <!-- Gated Cross-Attention Block -->
    <rect x="25" y="60" width="310" height="110" rx="8" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.5"/>
    <text x="180" y="90" text-anchor="middle" font-size="13" font-weight="bold" fill="#065F46">Adaptive Gated Attention</text>
    <text x="180" y="115" text-anchor="middle" font-size="11" fill="#047857">G(x) = σ(W_g [Q, K]) ⊙ Softmax(QK^T / √d) V</text>
    <rect x="50" y="130" width="260" height="24" rx="4" fill="#10B981" opacity="0.2"/>
    <text x="180" y="146" text-anchor="middle" font-size="10" font-weight="600" fill="#047857">LayerNorm + Residual Connection</text>

    <!-- Flow Arrow down -->
    <line x1="180" y1="175" x2="180" y2="205" stroke="#4B5563" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Variational Bottleneck Block -->
    <rect x="25" y="210" width="310" height="95" rx="8" fill="#F0FDFA" stroke="#99F6E4" stroke-width="1.5"/>
    <text x="180" y="238" text-anchor="middle" font-size="13" font-weight="bold" fill="#0F766E">Variational Bottleneck (ELBO)</text>
    <text x="180" y="260" text-anchor="middle" font-size="11" fill="#0D9488">q_ϕ(z|x) ~ 𝒩(μ_ϕ(x), diag(σ_ϕ^2(x)))</text>
    <text x="180" y="285" text-anchor="middle" font-size="10" fill="#6B7280">Information Bottleneck Compression β &gt; 0</text>

    <!-- Flow Arrow down -->
    <line x1="180" y1="310" x2="180" y2="340" stroke="#4B5563" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Feed-Forward / Layer Norm -->
    <rect x="25" y="345" width="310" height="75" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
    <text x="180" y="375" text-anchor="middle" font-size="13" font-weight="bold" fill="#1E40AF">Sparse Feed-Forward Network</text>
    <text x="180" y="400" text-anchor="middle" font-size="11" fill="#3B82F6">FFN(z) = SwiGLU(z W_1, z W_2) W_3</text>
  </g>

  <!-- Arrow 2 to 3 -->
  <line x1="685" y1="320" x2="735" y2="320" stroke="#4B5563" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Container Box 3: Sparse Top-K Routing -->
  <g transform="translate(740, 100)">
    <rect width="210" height="440" rx="12" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2" filter="url(#shadow)"/>
    <text x="105" y="35" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F2937">3. Top-K Routing</text>

    <rect x="15" y="60" width="180" height="70" rx="6" fill="#FEF3C7" stroke="#FDE68A" stroke-width="1.5"/>
    <text x="105" y="90" text-anchor="middle" font-size="12" font-weight="bold" fill="#92400E">Router Gate H(x)</text>
    <text x="105" y="112" text-anchor="middle" font-size="10" fill="#B45309">Top-2 Expert Selection</text>

    <line x1="105" y1="135" x2="60" y2="165" stroke="#D97706" stroke-width="1.5" marker-end="url(#arrow)"/>
    <line x1="105" y1="135" x2="150" y2="165" stroke="#D97706" stroke-width="1.5" marker-end="url(#arrow)"/>

    <!-- Experts -->
    <rect x="15" y="170" width="85" height="60" rx="6" fill="#FFFBEB" stroke="#FCD34D"/>
    <text x="57" y="195" text-anchor="middle" font-size="11" font-weight="bold" fill="#B45309">Expert 1</text>
    <text x="57" y="215" text-anchor="middle" font-size="9" fill="#92400E">Vision Spec</text>

    <rect x="110" y="170" width="85" height="60" rx="6" fill="#FFFBEB" stroke="#FCD34D"/>
    <text x="152" y="195" text-anchor="middle" font-size="11" font-weight="bold" fill="#B45309">Expert 2</text>
    <text x="152" y="215" text-anchor="middle" font-size="9" fill="#92400E">Text Spec</text>

    <rect x="15" y="245" width="85" height="60" rx="6" fill="#F3F4F6" stroke="#D1D5DB"/>
    <text x="57" y="270" text-anchor="middle" font-size="11" font-weight="bold" fill="#6B7280">Expert 3</text>
    <text x="57" y="290" text-anchor="middle" font-size="9" fill="#9CA3AF">(Inactive)</text>

    <rect x="110" y="245" width="85" height="60" rx="6" fill="#F3F4F6" stroke="#D1D5DB"/>
    <text x="152" y="270" text-anchor="middle" font-size="11" font-weight="bold" fill="#6B7280">Expert 4</text>
    <text x="152" y="290" text-anchor="middle" font-size="9" fill="#9CA3AF">(Inactive)</text>

    <!-- Aggregator -->
    <rect x="15" y="340" width="180" height="70" rx="6" fill="#FEF3C7" stroke="#FDE68A" stroke-width="1.5"/>
    <text x="105" y="370" text-anchor="middle" font-size="12" font-weight="bold" fill="#92400E">Sparse Aggregator</text>
    <text x="105" y="392" text-anchor="middle" font-size="10" fill="#B45309">y = ∑ Softmax(H)_i · E_i</text>
  </g>

  <!-- Arrow 3 to 4 -->
  <line x1="955" y1="320" x2="995" y2="320" stroke="#4B5563" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- Container Box 4: Task Output Heads -->
  <g transform="translate(1000, 100)">
    <rect width="160" height="440" rx="12" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2" filter="url(#shadow)"/>
    <text x="80" y="35" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F2937">4. Task Heads</text>

    <rect x="15" y="70" width="130" height="90" rx="8" fill="#FEE2E2" stroke="#FECACA" stroke-width="1.5"/>
    <text x="80" y="105" text-anchor="middle" font-size="12" font-weight="bold" fill="#991B1B">Classification</text>
    <text x="80" y="128" text-anchor="middle" font-size="10" fill="#B91C1C">Top-1 / Top-5</text>
    <text x="80" y="145" text-anchor="middle" font-size="9" font-weight="bold" fill="#7F1D1D">86.9% Acc</text>

    <rect x="15" y="185" width="130" height="90" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
    <text x="80" y="220" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E40AF">Generation</text>
    <text x="80" y="243" text-anchor="middle" font-size="10" fill="#2563EB">Autoregressive</text>
    <text x="80" y="260" text-anchor="middle" font-size="9" font-weight="bold" fill="#1E3A8A">34.2 BLEU</text>

    <rect x="15" y="300" width="130" height="90" rx="8" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.5"/>
    <text x="80" y="335" text-anchor="middle" font-size="12" font-weight="bold" fill="#065F46">Retrieval</text>
    <text x="80" y="358" text-anchor="middle" font-size="10" fill="#059669">Cosine Match</text>
    <text x="80" y="375" text-anchor="middle" font-size="9" font-weight="bold" fill="#064E3B">91.4% R@1</text>
  </g>
</svg>
`
}

async function generateConvergencePlotSvg(): Promise<string> {
  return `
<svg width="1000" height="600" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <defs>
    <filter id="plotShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.05"/>
    </filter>
  </defs>

  <!-- Title -->
  <text x="500" y="45" text-anchor="middle" font-size="20" font-weight="bold" fill="#111827">Training &amp; Validation Loss Convergence Across 100 Epochs</text>
  <text x="500" y="70" text-anchor="middle" font-size="13" fill="#6B7280">Benchmark Comparison: Baseline ResNet-50 vs. ViT-B vs. Our Gated Architecture</text>

  <!-- Plot Area Background -->
  <g transform="translate(100, 100)">
    <rect width="820" height="420" rx="6" fill="#FAFAFA" stroke="#E5E7EB" stroke-width="1.5" filter="url(#plotShadow)"/>

    <!-- Grid Lines (Horizontal) -->
    <line x1="0" y1="70" x2="820" y2="70" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="75" text-anchor="end" font-size="11" fill="#6B7280" font-family="monospace">2.0</text>

    <line x1="0" y1="140" x2="820" y2="140" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="145" text-anchor="end" font-size="11" fill="#6B7280" font-family="monospace">1.6</text>

    <line x1="0" y1="210" x2="820" y2="210" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="215" text-anchor="end" font-size="11" fill="#6B7280" font-family="monospace">1.2</text>

    <line x1="0" y1="280" x2="820" y2="280" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="285" text-anchor="end" font-size="11" fill="#6B7280" font-family="monospace">0.8</text>

    <line x1="0" y1="350" x2="820" y2="350" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="355" text-anchor="end" font-size="11" fill="#6B7280" font-family="monospace">0.4</text>

    <!-- Grid Lines (Vertical Epochs) -->
    <line x1="164" y1="0" x2="164" y2="420" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="164" y="445" text-anchor="middle" font-size="11" fill="#6B7280">20</text>

    <line x1="328" y1="0" x2="328" y2="420" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="328" y="445" text-anchor="middle" font-size="11" fill="#6B7280">40</text>

    <line x1="492" y1="0" x2="492" y2="420" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="492" y="445" text-anchor="middle" font-size="11" fill="#6B7280">60</text>

    <line x1="656" y1="0" x2="656" y2="420" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="656" y="445" text-anchor="middle" font-size="11" fill="#6B7280">80</text>

    <text x="820" y="445" text-anchor="middle" font-size="11" fill="#6B7280">100</text>

    <!-- Axis Labels -->
    <text x="410" y="475" text-anchor="middle" font-size="13" font-weight="bold" fill="#374151">Training Epochs</text>
    <text x="-65" y="210" text-anchor="middle" font-size="13" font-weight="bold" fill="#374151" transform="rotate(-90 -65 210)">Cross-Entropy Loss</text>

    <!-- Curve 1: Baseline ResNet-50 (Red/Coral) -->
    <path d="M 0,35 Q 120,120 250,170 T 500,200 T 820,215" fill="none" stroke="#EF4444" stroke-width="3"/>

    <!-- Curve 2: ViT-B (Amber) -->
    <path d="M 0,45 Q 100,160 250,210 T 500,240 T 820,250" fill="none" stroke="#F59E0B" stroke-width="3"/>

    <!-- Curve 3: Ours (Compact) (Blue) -->
    <path d="M 0,55 Q 80,210 250,280 T 500,310 T 820,325" fill="none" stroke="#3B82F6" stroke-width="3"/>

    <!-- Curve 4: Ours (Full Architecture) (Green) -->
    <path d="M 0,60 Q 60,250 200,320 T 450,355 T 820,370" fill="none" stroke="#10B981" stroke-width="3.5"/>

    <!-- Legend Box inside plot -->
    <g transform="translate(560, 20)">
      <rect width="240" height="140" rx="8" fill="#FFFFFF" stroke="#D1D5DB" opacity="0.95"/>
      <line x1="15" y1="25" x2="45" y2="25" stroke="#EF4444" stroke-width="3"/>
      <text x="55" y="29" font-size="11" font-weight="500" fill="#1F2937">Baseline ResNet-50 (Loss: 1.42)</text>

      <line x1="15" y1="55" x2="45" y2="55" stroke="#F59E0B" stroke-width="3"/>
      <text x="55" y="59" font-size="11" font-weight="500" fill="#1F2937">Vision Transformer ViT-B (1.18)</text>

      <line x1="15" y1="85" x2="45" y2="85" stroke="#3B82F6" stroke-width="3"/>
      <text x="55" y="89" font-size="11" font-weight="500" fill="#1F2937">Ours - Compact (0.94)</text>

      <line x1="15" y1="115" x2="45" y2="115" stroke="#10B981" stroke-width="3.5"/>
      <text x="55" y="119" font-size="11" font-weight="bold" fill="#047857">Ours - Full Model (0.76 ★)</text>
    </g>
  </g>
</svg>
`
}

async function generateThroughputBenchmarkSvg(): Promise<string> {
  return `
<svg width="1000" height="600" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Title -->
  <text x="500" y="45" text-anchor="middle" font-size="20" font-weight="bold" fill="#111827">Inference Throughput &amp; Memory Efficiency Benchmark</text>
  <text x="500" y="70" text-anchor="middle" font-size="13" fill="#6B7280">Measured on NVIDIA A100 (80GB) across varying batch sizes (FP16 vs INT8)</text>

  <!-- Plot Area -->
  <g transform="translate(100, 100)">
    <rect width="820" height="420" rx="6" fill="#FAFAFA" stroke="#E5E7EB" stroke-width="1.5"/>

    <!-- Y Grid lines -->
    <line x1="0" y1="80" x2="820" y2="80" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="85" text-anchor="end" font-size="11" fill="#6B7280">2000</text>

    <line x1="0" y1="160" x2="820" y2="160" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="165" text-anchor="end" font-size="11" fill="#6B7280">1500</text>

    <line x1="0" y1="240" x2="820" y2="240" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="245" text-anchor="end" font-size="11" fill="#6B7280">1000</text>

    <line x1="0" y1="320" x2="820" y2="320" stroke="#E5E7EB" stroke-dasharray="4"/>
    <text x="-15" y="325" text-anchor="end" font-size="11" fill="#6B7280">500</text>

    <!-- Axis Labels -->
    <text x="410" y="475" text-anchor="middle" font-size="13" font-weight="bold" fill="#374151">Batch Size</text>
    <text x="-65" y="210" text-anchor="middle" font-size="13" font-weight="bold" fill="#374151" transform="rotate(-90 -65 210)">Throughput (samples / sec)</text>

    <!-- Grouped Bars per Batch Size -->
    <!-- Batch 1 -->
    <g transform="translate(60, 0)">
      <rect x="0" y="360" width="25" height="40" rx="3" fill="#EF4444"/>
      <rect x="30" y="340" width="25" height="60" rx="3" fill="#F59E0B"/>
      <rect x="60" y="300" width="25" height="100" rx="3" fill="#3B82F6"/>
      <rect x="90" y="250" width="25" height="150" rx="3" fill="#10B981"/>
      <text x="57" y="425" text-anchor="middle" font-size="12" fill="#374151" font-weight="600">B=1</text>
    </g>

    <!-- Batch 8 -->
    <g transform="translate(260, 0)">
      <rect x="0" y="310" width="25" height="90" rx="3" fill="#EF4444"/>
      <rect x="30" y="270" width="25" height="130" rx="3" fill="#F59E0B"/>
      <rect x="60" y="200" width="25" height="200" rx="3" fill="#3B82F6"/>
      <rect x="90" y="140" width="25" height="260" rx="3" fill="#10B981"/>
      <text x="57" y="425" text-anchor="middle" font-size="12" fill="#374151" font-weight="600">B=8</text>
    </g>

    <!-- Batch 32 -->
    <g transform="translate(460, 0)">
      <rect x="0" y="250" width="25" height="150" rx="3" fill="#EF4444"/>
      <rect x="30" y="190" width="25" height="210" rx="3" fill="#F59E0B"/>
      <rect x="60" y="110" width="25" height="290" rx="3" fill="#3B82F6"/>
      <rect x="90" y="60" width="25" height="340" rx="3" fill="#10B981"/>
      <text x="57" y="425" text-anchor="middle" font-size="12" fill="#374151" font-weight="600">B=32</text>
    </g>

    <!-- Batch 64 -->
    <g transform="translate(660, 0)">
      <rect x="0" y="220" width="25" height="180" rx="3" fill="#EF4444"/>
      <rect x="30" y="150" width="25" height="250" rx="3" fill="#F59E0B"/>
      <rect x="60" y="70" width="25" height="330" rx="3" fill="#3B82F6"/>
      <rect x="90" y="20" width="25" height="380" rx="3" fill="#10B981"/>
      <text x="57" y="425" text-anchor="middle" font-size="12" fill="#374151" font-weight="600">B=64</text>
    </g>

    <!-- Legend -->
    <g transform="translate(40, 20)">
      <rect width="420" height="40" rx="6" fill="#FFFFFF" stroke="#D1D5DB" opacity="0.95"/>
      <rect x="15" y="12" width="16" height="16" rx="2" fill="#EF4444"/>
      <text x="38" y="25" font-size="11" fill="#1F2937">ResNet-50</text>

      <rect x="120" y="12" width="16" height="16" rx="2" fill="#F59E0B"/>
      <text x="143" y="25" font-size="11" fill="#1F2937">ViT-B</text>

      <rect x="200" y="12" width="16" height="16" rx="2" fill="#3B82F6"/>
      <text x="223" y="25" font-size="11" fill="#1F2937">Ours (FP16)</text>

      <rect x="310" y="12" width="16" height="16" rx="2" fill="#10B981"/>
      <text x="333" y="25" font-size="11" font-weight="bold" fill="#047857">Ours (INT8 ★)</text>
    </g>
  </g>
</svg>
`
}

async function generateAblationStudySvg(): Promise<string> {
  return `
<svg width="1000" height="600" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <text x="500" y="45" text-anchor="middle" font-size="20" font-weight="bold" fill="#111827">Component-Wise Ablation: Accuracy vs. Latency Trade-Off</text>
  <text x="500" y="70" text-anchor="middle" font-size="13" fill="#6B7280">Systematic isolation of Attention Gating, Residual Links, and Variational ELBO</text>

  <g transform="translate(120, 100)">
    <rect width="760" height="420" rx="6" fill="#FAFAFA" stroke="#E5E7EB" stroke-width="1.5"/>

    <!-- Dual axes -->
    <text x="380" y="475" text-anchor="middle" font-size="13" font-weight="bold" fill="#374151">Model Configuration</text>
    <text x="-60" y="210" text-anchor="middle" font-size="13" font-weight="bold" fill="#2563EB" transform="rotate(-90 -60 210)">Top-1 Accuracy (%)</text>
    <text x="820" y="210" text-anchor="middle" font-size="13" font-weight="bold" fill="#DC2626" transform="rotate(90 820 210)">Latency (ms)</text>

    <!-- Bars for Configurations -->
    <!-- Config 1: Vanilla Trunk -->
    <g transform="translate(50, 0)">
      <rect x="15" y="160" width="50" height="240" rx="4" fill="#3B82F6" opacity="0.85"/>
      <text x="40" y="150" text-anchor="middle" font-size="11" font-weight="bold" fill="#1E40AF">78.4%</text>

      <rect x="75" y="220" width="50" height="180" rx="4" fill="#EF4444" opacity="0.85"/>
      <text x="100" y="210" text-anchor="middle" font-size="11" font-weight="bold" fill="#991B1B">6.8ms</text>

      <text x="70" y="430" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">Vanilla Trunk</text>
    </g>

    <!-- Config 2: + Residuals -->
    <g transform="translate(230, 0)">
      <rect x="15" y="125" width="50" height="275" rx="4" fill="#3B82F6" opacity="0.85"/>
      <text x="40" y="115" text-anchor="middle" font-size="11" font-weight="bold" fill="#1E40AF">81.2%</text>

      <rect x="75" y="215" width="50" height="185" rx="4" fill="#EF4444" opacity="0.85"/>
      <text x="100" y="205" text-anchor="middle" font-size="11" font-weight="bold" fill="#991B1B">6.9ms</text>

      <text x="70" y="430" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">+ Residuals</text>
    </g>

    <!-- Config 3: + Gating -->
    <g transform="translate(410, 0)">
      <rect x="15" y="80" width="50" height="320" rx="4" fill="#3B82F6" opacity="0.85"/>
      <text x="40" y="70" text-anchor="middle" font-size="11" font-weight="bold" fill="#1E40AF">84.7%</text>

      <rect x="75" y="270" width="50" height="130" rx="4" fill="#EF4444" opacity="0.85"/>
      <text x="100" y="260" text-anchor="middle" font-size="11" font-weight="bold" fill="#991B1B">5.1ms</text>

      <text x="70" y="430" text-anchor="middle" font-size="11" font-weight="600" fill="#374151">+ Attention Gate</text>
    </g>

    <!-- Config 4: + Variational ELBO (Full) -->
    <g transform="translate(590, 0)">
      <rect x="15" y="45" width="50" height="355" rx="4" fill="#10B981"/>
      <text x="40" y="35" text-anchor="middle" font-size="11" font-weight="bold" fill="#047857">86.9% ★</text>

      <rect x="75" y="295" width="50" height="105" rx="4" fill="#059669"/>
      <text x="100" y="285" text-anchor="middle" font-size="11" font-weight="bold" fill="#064E3B">4.6ms ★</text>

      <text x="70" y="430" text-anchor="middle" font-size="11" font-weight="bold" fill="#047857">Full Model (Ours)</text>
    </g>
  </g>
</svg>
`
}

async function generateAttentionHeatmapSvg(): Promise<string> {
  return `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <text x="400" y="40" text-anchor="middle" font-size="18" font-weight="bold" fill="#111827">Cross-Modal Attention Matrix Heatmap</text>
  <text x="400" y="65" text-anchor="middle" font-size="12" fill="#6B7280">Normalized Layer-8 Attention Weights (Vision Tokens × Text Tokens)</text>

  <g transform="translate(100, 100)">
    <!-- 8x8 Grid Heatmap -->
    <!-- Row 0 -->
    <rect x="0" y="0" width="70" height="70" fill="#4338CA"/><rect x="75" y="0" width="70" height="70" fill="#6366F1"/><rect x="150" y="0" width="70" height="70" fill="#818CF8"/><rect x="225" y="0" width="70" height="70" fill="#C7D2FE"/><rect x="300" y="0" width="70" height="70" fill="#312E81"/><rect x="375" y="0" width="70" height="70" fill="#4F46E5"/><rect x="450" y="0" width="70" height="70" fill="#F43F5E"/><rect x="525" y="0" width="70" height="70" fill="#FDA4AF"/>
    <!-- Row 1 -->
    <rect x="0" y="75" width="70" height="70" fill="#6366F1"/><rect x="75" y="75" width="70" height="70" fill="#E11D48"/><rect x="150" y="75" width="70" height="70" fill="#F43F5E"/><rect x="225" y="75" width="70" height="70" fill="#4338CA"/><rect x="300" y="75" width="70" height="70" fill="#312E81"/><rect x="375" y="75" width="70" height="70" fill="#4F46E5"/><rect x="450" y="75" width="70" height="70" fill="#FB7185"/><rect x="525" y="75" width="70" height="70" fill="#FFE4E6"/>
    <!-- Row 2 -->
    <rect x="0" y="150" width="70" height="70" fill="#818CF8"/><rect x="75" y="150" width="70" height="70" fill="#F43F5E"/><rect x="150" y="150" width="70" height="70" fill="#BE123C"/><rect x="225" y="150" width="70" height="70" fill="#E11D48"/><rect x="300" y="150" width="70" height="70" fill="#4338CA"/><rect x="375" y="150" width="70" height="70" fill="#6366F1"/><rect x="450" y="150" width="70" height="70" fill="#C7D2FE"/><rect x="525" y="150" width="70" height="70" fill="#312E81"/>
    <!-- Row 3 -->
    <rect x="0" y="225" width="70" height="70" fill="#C7D2FE"/><rect x="75" y="225" width="70" height="70" fill="#4338CA"/><rect x="150" y="225" width="70" height="70" fill="#E11D48"/><rect x="225" y="225" width="70" height="70" fill="#9F1239"/><rect x="300" y="225" width="70" height="70" fill="#F43F5E"/><rect x="375" y="225" width="70" height="70" fill="#818CF8"/><rect x="450" y="225" width="70" height="70" fill="#312E81"/><rect x="525" y="225" width="70" height="70" fill="#4F46E5"/>
    <!-- Row 4 -->
    <rect x="0" y="300" width="70" height="70" fill="#312E81"/><rect x="75" y="300" width="70" height="70" fill="#312E81"/><rect x="150" y="300" width="70" height="70" fill="#4338CA"/><rect x="225" y="300" width="70" height="70" fill="#F43F5E"/><rect x="300" y="300" width="70" height="70" fill="#881337"/><rect x="375" y="300" width="70" height="70" fill="#BE123C"/><rect x="450" y="300" width="70" height="70" fill="#E11D48"/><rect x="525" y="300" width="70" height="70" fill="#FB7185"/>
    <!-- Row 5 -->
    <rect x="0" y="375" width="70" height="70" fill="#4F46E5"/><rect x="75" y="375" width="70" height="70" fill="#4F46E5"/><rect x="150" y="375" width="70" height="70" fill="#6366F1"/><rect x="225" y="375" width="70" height="70" fill="#818CF8"/><rect x="300" y="375" width="70" height="70" fill="#BE123C"/><rect x="375" y="375" width="70" height="70" fill="#9F1239"/><rect x="450" y="375" width="70" height="70" fill="#F43F5E"/><rect x="525" y="375" width="70" height="70" fill="#FDA4AF"/>
    <!-- Row 6 -->
    <rect x="0" y="450" width="70" height="70" fill="#F43F5E"/><rect x="75" y="450" width="70" height="70" fill="#FB7185"/><rect x="150" y="450" width="70" height="70" fill="#C7D2FE"/><rect x="225" y="450" width="70" height="70" fill="#312E81"/><rect x="300" y="450" width="70" height="70" fill="#E11D48"/><rect x="375" y="450" width="70" height="70" fill="#F43F5E"/><rect x="450" y="450" width="70" height="70" fill="#881337"/><rect x="525" y="450" width="70" height="70" fill="#BE123C"/>
    <!-- Row 7 -->
    <rect x="0" y="525" width="70" height="70" fill="#FDA4AF"/><rect x="75" y="525" width="70" height="70" fill="#FFE4E6"/><rect x="150" y="525" width="70" height="70" fill="#312E81"/><rect x="225" y="525" width="70" height="70" fill="#4F46E5"/><rect x="300" y="525" width="70" height="70" fill="#FB7185"/><rect x="375" y="525" width="70" height="70" fill="#FDA4AF"/><rect x="450" y="525" width="70" height="70" fill="#BE123C"/><rect x="525" y="525" width="70" height="70" fill="#881337"/>
  </g>
</svg>
`
}

export async function generateSampleAssets() {
  const workspaces = [
    "ws_tests_paper",
    "ws_tests_poster",
    "ws_tests_slides",
    "prj_atlas_studies"
  ]

  const figures = [
    { name: "fig_architecture.png", gen: generateArchitectureSvg, width: 1200, height: 600 },
    { name: "fig_convergence_plot.png", gen: generateConvergencePlotSvg, width: 1000, height: 600 },
    { name: "fig_throughput_benchmark.png", gen: generateThroughputBenchmarkSvg, width: 1000, height: 600 },
    { name: "fig_ablation_study.png", gen: generateAblationStudySvg, width: 1000, height: 600 },
    { name: "fig_attention_heatmap.png", gen: generateAttentionHeatmapSvg, width: 800, height: 800 },
  ]

  for (const fig of figures) {
    const svg = await fig.gen()
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()

    for (const ws of workspaces) {
      const dir = path.join(process.cwd(), "workspaces", ws, "assets")
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, fig.name), pngBuffer)
    }
  }

  console.log("Successfully generated all 5 professional PNG figures across all workspaces.")
}

if (require.main === module) {
  generateSampleAssets().catch(console.error)
}
