
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { compileWorkspace } from '../lib/latex/compile-workspace';

async function main() {
  console.log("Compiling Attention Is All You Need...");
  const res1 = await compileWorkspace('attention-is-all-you-need', {
    installPdf: true,
    forceRecompile: true,
    timeoutMs: 120000
  });
  console.log("WS1 Compile Ok:", res1.ok);
  if (!res1.ok) {
    console.error("WS1 Error:", res1.error);
    console.error("WS1 Log tail:\n", res1.log.slice(-1500));
  } else {
    console.log("WS1 Log tail:\n", res1.log.slice(-500));
  }

  console.log("\nCompiling Deep Residual Learning...");
  const res2 = await compileWorkspace('resnet-deep-residual-learning', {
    installPdf: true,
    forceRecompile: true,
    timeoutMs: 120000
  });
  console.log("WS2 Compile Ok:", res2.ok);
  if (!res2.ok) {
    console.error("WS2 Error:", res2.error);
    console.error("WS2 Log tail:\n", res2.log.slice(-1500));
  } else {
    console.log("WS2 Log tail:\n", res2.log.slice(-500));
  }
}

main().catch(console.error);
