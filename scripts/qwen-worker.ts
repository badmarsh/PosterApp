/**
 * Qwen-Coder Worker Utility for Antigravity
 * 
 * Delegates heavy coding, refactoring, code review, and test generation
 * to local Qwen-Coder (qwen3-coder-plus / 480B / DeepSeek) via OpenCodeX / AliProxy.
 * 
 * Saves Antigravity Gemini quota while leveraging 1.38B free tokens.
 */

import fs from 'fs';
import path from 'path';

interface WorkerOptions {
  task: string;
  files?: string[];
  model?: string;
  mode?: 'code' | 'review' | 'refactor' | 'test' | 'ask';
  outputFile?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

const DEFAULT_MODEL = "qwen/qwen3-coder-plus";
const OPENCODEX_URL = "http://127.0.0.1:10100/v1/chat/completions";
const ALIPROXY_URL = "http://127.0.0.1:8080/v1/chat/completions";
const ALIPROXY_KEY = "sk-aliproxy-dcae3bef25eb00f79c6b32d8e49aaded8d38ce536f98324c";

export async function dispatchToWorker(opts: WorkerOptions): Promise<string> {
  const model = opts.model || DEFAULT_MODEL;
  const temperature = opts.temperature ?? 0.2;
  const maxTokens = opts.maxTokens ?? 4096;

  let contextText = "";
  if (opts.files && opts.files.length > 0) {
    for (const f of opts.files) {
      const fullPath = path.resolve(f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        contextText += `\n\n### File: ${f}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }
  }

  let systemPrompt = opts.systemPrompt;
  if (!systemPrompt) {
    switch (opts.mode) {
      case "review":
        systemPrompt = "You are an elite code reviewer. Identify bugs, performance issues, logic flaws, and suggest concise fixes.";
        break;
      case "refactor":
        systemPrompt = "You are a senior software engineer. Refactor the provided code cleanly, adhering to best practices, typing, and efficiency. Return the complete refactored code without skipping any sections.";
        break;
      case "test":
        systemPrompt = "You are a test automation engineer. Generate comprehensive unit / integration tests covering edge cases.";
        break;
      case "code":
      default:
        systemPrompt = "You are an expert full-stack developer and coding assistant. Provide precise, production-grade code adhering to modern standards, without unnecessary pleasantries.";
        break;
    }
  }

  const userContent = contextText 
    ? `${opts.task}\n\nContext files:\n${contextText}` 
    : opts.task;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature,
    max_tokens: maxTokens
  };

  // Try OpenCodeX first, then fall back to direct AliProxy
  let responseText = "";
  let success = false;
  let endpointUsed = "";

  try {
    const res = await fetch(OPENCODEX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    });
    if (res.ok) {
      const json = await res.json();
      responseText = json.choices?.[0]?.message?.content || "";
      success = true;
      endpointUsed = "OpenCodeX (:10100)";
    }
  } catch (err: any) {
    // Fall back to AliProxy
  }

  if (!success) {
    try {
      // Map model slug to direct AliProxy model ID if needed
      const rawModel = model.replace(/^(qwen|aliproxy)\//, "");
      const res = await fetch(ALIPROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ALIPROXY_KEY}`
        },
        body: JSON.stringify({ ...payload, model: rawModel }),
        signal: AbortSignal.timeout(60000)
      });
      if (res.ok) {
        const json = await res.json();
        responseText = json.choices?.[0]?.message?.content || "";
        success = true;
        endpointUsed = "AliProxy direct (:8080)";
      } else {
        throw new Error(`AliProxy error ${res.status}: ${await res.text()}`);
      }
    } catch (err: any) {
      throw new Error(`Worker execution failed on both endpoints: ${err.message}`);
    }
  }

  if (opts.outputFile && responseText) {
    const outPath = path.resolve(opts.outputFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, responseText, "utf8");
    console.error(`[Worker] Output written to: ${outPath}`);
  }

  return responseText;
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith("qwen-worker.ts")) {
  const args = process.argv.slice(2);
  const opts: WorkerOptions = { task: "" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--task" || arg === "-t") {
      opts.task = args[++i];
    } else if (arg === "--file" || arg === "-f") {
      opts.files = opts.files || [];
      opts.files.push(args[++i]);
    } else if (arg === "--model" || arg === "-m") {
      opts.model = args[++i];
    } else if (arg === "--mode") {
      opts.mode = args[++i] as any;
    } else if (arg === "--out" || arg === "-o") {
      opts.outputFile = args[++i];
    }
  }

  if (!opts.task) {
    console.error("Usage: tsx scripts/qwen-worker.ts --task <string> [--file <path>] [--model <slug>] [--mode code|review|refactor|test] [--out <path>]");
    process.exit(1);
  }

  const startTime = Date.now();
  dispatchToWorker(opts)
    .then((result) => {
      const elapsed = Date.now() - startTime;
      console.log(result);
      console.error(`\n[Worker Finished in ${elapsed}ms]`);
    })
    .catch((err) => {
      console.error(`[Worker Error]:`, err.message);
      process.exit(1);
    });
}
