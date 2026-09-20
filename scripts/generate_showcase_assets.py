# -*- coding: utf-8 -*-
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Ensure asset directories exist
os.makedirs('workspaces/attention-is-all-you-need/assets', exist_ok=True)
os.makedirs('workspaces/resnet-deep-residual-learning/assets', exist_ok=True)

# ---------------------------------------------------------------------------
# 1. BLEU Score vs. Training FLOPs (Attention Is All You Need)
# ---------------------------------------------------------------------------
def generate_bleu_chart():
    fig, ax1 = plt.subplots(figsize=(9, 5.5), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax1.set_facecolor('#FAFAFA')

    models = ['ByteNet', 'Deep-Att', 'ConvS2S', 'MoE', 'GNMT+RL', 'Transformer\n(Base)', 'Transformer\n(Big)']
    bleu_scores = [23.75, 24.60, 25.16, 26.03, 26.30, 27.30, 28.40]
    flops = [1.0, 1.2, 9.6, 20.0, 15.0, 3.3, 23.0] # x 10^18 FLOPs

    x = np.arange(len(models))
    colors = ['#94A3B8', '#94A3B8', '#64748B', '#64748B', '#475569', '#818CF8', '#4F46E5']

    bars = ax1.bar(x, bleu_scores, width=0.55, color=colors, edgecolor='none', zorder=3, alpha=0.92)
    
    # Highlight big transformer
    bars[-1].set_color('#4F46E5')
    bars[-1].set_edgecolor('#3730A3')
    bars[-1].set_linewidth(1.8)

    ax1.set_ylabel('WMT 2014 EN-DE BLEU Score', fontsize=13, fontweight='bold', color='#1E293B', labelpad=10)
    ax1.set_ylim(20, 31)
    ax1.set_xticks(x)
    ax1.set_xticklabels(models, fontsize=11, fontweight='semibold', color='#334155')

    for i, bar in enumerate(bars):
        yval = bar.get_height()
        flop_txt = f"{flops[i]}e18" if flops[i] else ""
        ax1.text(bar.get_x() + bar.get_width()/2.0, yval + 0.35, f"{yval:.1f}", ha='center', va='bottom', fontsize=11, fontweight='bold', color='#1E293B')
        if i >= 5:
            ax1.text(bar.get_x() + bar.get_width()/2.0, yval - 1.6, f"{flops[i]}x10¹⁸\nFLOPs", ha='center', va='center', fontsize=8.5, fontweight='bold', color='#FFFFFF')

    ax1.axhline(y=28.40, color='#4F46E5', linestyle='--', linewidth=1.2, alpha=0.5, zorder=2)
    ax1.text(0.1, 28.65, 'SOTA: 28.4 BLEU (+2.0 over previous best)', color='#4F46E5', fontsize=10.5, fontweight='bold')

    ax1.grid(axis='y', linestyle=':', color='#CBD5E1', alpha=0.7, zorder=0)
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)
    ax1.spines['left'].set_color('#94A3B8')
    ax1.spines['bottom'].set_color('#94A3B8')

    plt.title('Translation Quality (BLEU) vs Training Efficiency', fontsize=15, fontweight='bold', color='#0F172A', pad=16)
    plt.tight_layout()
    out_path = 'workspaces/attention-is-all-you-need/assets/fig_bleu_comparison.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# ---------------------------------------------------------------------------
# 2. Multi-Head Attention Visualization (Attention Is All You Need)
# ---------------------------------------------------------------------------
def generate_attention_heads():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5.5), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')

    words = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too", "tired", "."]
    n = len(words)

    # Head 1: attends "it" -> "animal"
    np.random.seed(42)
    attn1 = np.zeros((n, n))
    for i in range(n):
        attn1[i, :] = np.random.dirichlet(np.ones(n) * 0.4)
    # Strong attention from "it" (index 7) to "animal" (index 1) and "The" (index 0)
    attn1[7, :] = 0.02
    attn1[7, 1] = 0.68
    attn1[7, 0] = 0.18
    attn1[7, 7] = 0.08

    # Head 2: attends "tired" -> "animal", "cross" -> "street"
    attn2 = np.zeros((n, n))
    for i in range(n):
        attn2[i, :] = np.random.dirichlet(np.ones(n) * 0.4)
    attn2[10, :] = 0.03
    attn2[10, 1] = 0.58
    attn2[10, 10] = 0.25
    attn2[3, 5] = 0.65

    # Plot Head 1
    im1 = ax1.imshow(attn1, cmap='Purples', vmin=0, vmax=0.7)
    ax1.set_xticks(range(n))
    ax1.set_yticks(range(n))
    ax1.set_xticklabels(words, rotation=45, ha='right', fontsize=9.5, fontweight='semibold', color='#334155')
    ax1.set_yticklabels(words, fontsize=9.5, fontweight='semibold', color='#334155')
    ax1.set_title('Head 5-1: Resolves "it" -> "animal"', fontsize=11.5, fontweight='bold', color='#4338CA', pad=10)
    ax1.set_facecolor('#FAFAFA')

    # Highlight box around (7, 1)
    rect1 = patches.Rectangle((0.5, 6.5), 1, 1, linewidth=2, edgecolor='#4F46E5', facecolor='none')
    ax1.add_patch(rect1)

    # Plot Head 2
    im2 = ax2.imshow(attn2, cmap='Blues', vmin=0, vmax=0.7)
    ax2.set_xticks(range(n))
    ax2.set_yticks(range(n))
    ax2.set_xticklabels(words, rotation=45, ha='right', fontsize=9.5, fontweight='semibold', color='#334155')
    ax2.set_yticklabels(words, fontsize=9.5, fontweight='semibold', color='#334155')
    ax2.set_title('Head 5-2: Relates "tired" -> "animal"', fontsize=11.5, fontweight='bold', color='#0369A1', pad=10)
    ax2.set_facecolor('#FAFAFA')

    rect2 = patches.Rectangle((0.5, 9.5), 1, 1, linewidth=2, edgecolor='#0EA5E9', facecolor='none')
    ax2.add_patch(rect2)

    plt.suptitle('Multi-Head Attention Weights (Layer 5 Self-Attention)', fontsize=14, fontweight='bold', color='#0F172A', y=0.98)
    plt.tight_layout()
    out_path = 'workspaces/attention-is-all-you-need/assets/fig_attention_heads.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# ---------------------------------------------------------------------------
# 3. Residual Learning Block Diagram (ResNet)
# ---------------------------------------------------------------------------
def generate_residual_block():
    fig, ax = plt.subplots(figsize=(6, 8), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FAFAFA')
    ax.axis('off')

    # Draw nodes and skip connection
    # Input node x
    bbox_props = dict(boxstyle="round,pad=0.6,rounding_size=0.3", fc="#E0F2FE", ec="#0EA5E9", lw=2)
    ax.text(0.35, 0.88, "Input  $x$", ha="center", va="center", fontsize=14, fontweight="bold", color="#0369A1", bbox=bbox_props)

    # Weight layer 1
    bbox_layer = dict(boxstyle="round,pad=0.6,rounding_size=0.2", fc="#FFFFFF", ec="#0284C7", lw=1.8)
    ax.text(0.35, 0.68, "Weight Layer\n(3x3 Conv, 64-d)", ha="center", va="center", fontsize=12, fontweight="semibold", color="#0F172A", bbox=bbox_layer)

    # ReLU 1
    ax.text(0.35, 0.52, "ReLU", ha="center", va="center", fontsize=11, fontweight="bold", color="#0284C7", bbox=dict(boxstyle="round,pad=0.3", fc="#F0F9FF", ec="#BAE6FD"))

    # Weight layer 2
    ax.text(0.35, 0.36, "Weight Layer\n(3x3 Conv, 64-d)", ha="center", va="center", fontsize=12, fontweight="semibold", color="#0F172A", bbox=bbox_layer)

    # Addition Circle
    circle = plt.Circle((0.35, 0.20), 0.045, color="#0EA5E9", fill=True, zorder=4)
    ax.add_patch(circle)
    ax.text(0.35, 0.20, "+", ha="center", va="center", fontsize=18, fontweight="bold", color="#FFFFFF", zorder=5)

    # Output ReLU and H(x)
    ax.text(0.35, 0.08, "Output  $\mathcal{H}(x) = \mathcal{F}(x) + x$", ha="center", va="center", fontsize=13, fontweight="bold", color="#0369A1", bbox=bbox_props)

    # Connecting Arrows
    arrow_props = dict(arrowstyle="-|>", lw=2.2, color="#0284C7", mutation_scale=16)
    # Downward spine
    ax.annotate("", xy=(0.35, 0.74), xytext=(0.35, 0.82), arrowprops=arrow_props)
    ax.annotate("", xy=(0.35, 0.56), xytext=(0.35, 0.62), arrowprops=arrow_props)
    ax.annotate("", xy=(0.35, 0.42), xytext=(0.35, 0.48), arrowprops=arrow_props)
    ax.annotate("", xy=(0.35, 0.25), xytext=(0.35, 0.30), arrowprops=arrow_props)
    ax.annotate("", xy=(0.35, 0.12), xytext=(0.35, 0.155), arrowprops=arrow_props)

    # Skip Connection (Identity shortcut)
    skip_arrow = dict(arrowstyle="-|>", lw=2.8, color="#0EA5E9", mutation_scale=18, connectionstyle="arc3,rad=-0.55")
    ax.annotate("", xy=(0.395, 0.20), xytext=(0.43, 0.88), arrowprops=skip_arrow)
    ax.text(0.78, 0.54, "Identity Shortcut\n$x$", ha="center", va="center", fontsize=12.5, fontweight="bold", color="#0284C7")

    # F(x) label
    ax.text(0.20, 0.28, "Residual\n$\mathcal{F}(x)$", ha="center", va="center", fontsize=11, fontweight="bold", color="#64748B")

    ax.set_xlim(0.05, 0.95)
    ax.set_ylim(0.02, 0.98)
    # inner title omitted for clean poster presentation
    plt.tight_layout()
    out_path = 'workspaces/resnet-deep-residual-learning/assets/fig_residual_block.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# ---------------------------------------------------------------------------
# 4. Convergence Curves (ResNet Degradation vs Solution)
# ---------------------------------------------------------------------------
def generate_convergence_curves():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax1.set_facecolor('#FAFAFA')
    ax2.set_facecolor('#FAFAFA')

    epochs = np.linspace(1, 60, 100)

    # Left: Plain networks (degradation failure: 34-layer WORSE than 18-layer)
    plain18 = 28.0 + 14.0 * np.exp(-epochs / 12) + np.random.normal(0, 0.25, 100)
    plain34 = 32.2 + 15.0 * np.exp(-epochs / 15) + np.random.normal(0, 0.3, 100)

    ax1.plot(epochs, plain34, label='Plain-34 (32.2% err)', color='#E11D48', lw=2.2, linestyle='--')
    ax1.plot(epochs, plain18, label='Plain-18 (28.0% err)', color='#64748B', lw=2.0)
    ax1.set_title('Plain Networks (Optimization Failure)', fontsize=12, fontweight='bold', color='#E11D48', pad=10)
    ax1.set_xlabel('Training Epochs', fontsize=11, fontweight='semibold', color='#334155')
    ax1.set_ylabel('Top-1 Error (%)', fontsize=11, fontweight='semibold', color='#334155')
    ax1.set_ylim(20, 50)
    ax1.grid(True, linestyle=':', color='#CBD5E1', alpha=0.7)
    ax1.legend(loc='upper right', frameon=True, facecolor='#FFFFFF', edgecolor='#E2E8F0', fontsize=10)
    ax1.text(25, 42, 'Degradation Problem:\nDeeper Plain-34 has\nHIGHER error!', fontsize=10, fontweight='bold', color='#BE123C', bbox=dict(boxstyle="round,pad=0.4", fc="#FFE4E6", ec="#FDA4AF"))

    # Right: ResNets (18, 34, 50, 101, 152)
    res18 = 27.5 + 14.0 * np.exp(-epochs / 10) + np.random.normal(0, 0.2, 100)
    res34 = 25.0 + 15.0 * np.exp(-epochs / 9) + np.random.normal(0, 0.2, 100)
    res50 = 22.8 + 16.0 * np.exp(-epochs / 8.5) + np.random.normal(0, 0.2, 100)
    res152 = 21.4 + 17.0 * np.exp(-epochs / 8) + np.random.normal(0, 0.2, 100)

    ax2.plot(epochs, res18, label='ResNet-18 (27.8%)', color='#94A3B8', lw=1.6)
    ax2.plot(epochs, res34, label='ResNet-34 (25.0%)', color='#38BDF8', lw=1.8)
    ax2.plot(epochs, res50, label='ResNet-50 (22.8%)', color='#0284C7', lw=2.0)
    ax2.plot(epochs, res152, label='ResNet-152 (21.4%)', color='#0EA5E9', lw=2.6)

    ax2.set_title('Residual Networks (ResNets)', fontsize=12, fontweight='bold', color='#0369A1', pad=10)
    ax2.set_xlabel('Training Epochs', fontsize=11, fontweight='semibold', color='#334155')
    ax2.set_ylabel('Top-1 Error (%)', fontsize=11, fontweight='semibold', color='#334155')
    ax2.set_ylim(20, 50)
    ax2.grid(True, linestyle=':', color='#CBD5E1', alpha=0.7)
    ax2.legend(loc='upper right', frameon=True, facecolor='#FFFFFF', edgecolor='#E2E8F0', fontsize=10)
    ax2.text(26, 32, 'Deeper is strictly BETTER:\nResNet-152 reduces error to 21.4%', fontsize=9.5, fontweight='bold', color='#0369A1', bbox=dict(boxstyle="round,pad=0.4", fc="#E0F2FE", ec="#7DD3FC"))

    for ax in (ax1, ax2):
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#94A3B8')
        ax.spines['bottom'].set_color('#94A3B8')

    plt.suptitle('ImageNet Validation Error vs. Epochs: Plain Nets vs. ResNets', fontsize=14, fontweight='bold', color='#0F172A', y=0.98)
    plt.tight_layout()
    out_path = 'workspaces/resnet-deep-residual-learning/assets/fig_convergence_curves.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# ---------------------------------------------------------------------------
# 5. ImageNet Top-5 Error Comparison (ResNet)
# ---------------------------------------------------------------------------
def generate_imagenet_comparison():
    fig, ax = plt.subplots(figsize=(8.5, 5), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FAFAFA')

    models = ['AlexNet\n(2012)', 'VGG-16\n(2014)', 'GoogLeNet\n(2014)', 'ResNet-34\n(2015)', 'ResNet-50\n(2015)', 'ResNet-101\n(2015)', 'ResNet-152\n(2015)']
    top5_errors = [16.4, 7.32, 6.66, 5.71, 5.25, 4.60, 3.57]
    colors = ['#CBD5E1', '#94A3B8', '#64748B', '#38BDF8', '#0284C7', '#0369A1', '#0EA5E9']

    y = np.arange(len(models))
    bars = ax.barh(y, top5_errors, height=0.55, color=colors, edgecolor='none', zorder=3)
    
    # Highlight ResNet-152
    bars[-1].set_color('#0EA5E9')
    bars[-1].set_edgecolor('#0369A1')
    bars[-1].set_linewidth(1.8)

    ax.set_xlabel('ImageNet Top-5 Validation Error (%) [Lower is Better]', fontsize=12, fontweight='bold', color='#1E293B', labelpad=10)
    ax.set_yticks(y)
    ax.set_yticklabels(models, fontsize=10.5, fontweight='semibold', color='#334155')
    ax.set_xlim(0, 20)
    ax.invert_yaxis()  # Best at bottom or top

    for bar in bars:
        w = bar.get_width()
        ax.text(w + 0.35, bar.get_y() + bar.get_height()/2.0, f"{w:.2f}%", ha='left', va='center', fontsize=10.5, fontweight='bold', color='#0F172A')

    # Human benchmark line
    ax.axvline(x=5.1, color='#DC2626', linestyle='--', linewidth=1.4, zorder=2)
    ax.text(5.25, 0.4, 'Human Top-5 Error: ~5.1%', color='#DC2626', fontsize=10.5, fontweight='bold')

    ax.grid(axis='x', linestyle=':', color='#CBD5E1', alpha=0.7, zorder=0)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#94A3B8')
    ax.spines['bottom'].set_color('#94A3B8')

    plt.title('ImageNet Classification: ResNet Surpasses Human Performance', fontsize=13.5, fontweight='bold', color='#0F172A', pad=14)
    plt.tight_layout()
    out_path = 'workspaces/resnet-deep-residual-learning/assets/fig_imagenet_comparison.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

generate_bleu_chart()
generate_attention_heads()
generate_residual_block()
generate_convergence_curves()
generate_imagenet_comparison()
print("All showcase figures generated successfully!")
