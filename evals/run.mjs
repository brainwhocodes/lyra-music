import { mkdir } from 'node:fs/promises';
import { runEvalite } from 'evalite/runner';
import { createInMemoryStorage } from 'evalite/in-memory-storage';

const mode = process.argv[2] || 'policy';
if (!['policy', 'models'].includes(mode)) throw new Error('Use policy or models.');
process.env.LYRA_MODEL_EVALS = mode === 'models' ? '1' : '0';
await mkdir('evals/results', { recursive: true });
await runEvalite({
  mode: 'run-once-and-exit',
  path: mode === 'models' ? 'evals/semantic.eval.ts' : 'evals/policy.eval.ts',
  outputPath: `evals/results/${mode}.json`,
  scoreThreshold: 100,
  // Isolate exports: Evalite 0.16 exports the latest run from its storage, so
  // simultaneous policy/model invocations must not share the default SQLite DB.
  storage: createInMemoryStorage(),
});
