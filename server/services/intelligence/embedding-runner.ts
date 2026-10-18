// Embedded in the Nitro bundle: the production server does not depend on a source-tree path.
export const EMBEDDING_PYTHON_RUNNER = String.raw`
import json, sys, os, contextlib
# Node sends UTF-8 JSON. Isolated Python ignores PYTHONUTF8 and Windows pipes
# otherwise default to cp1252, corrupting Unicode titles before tokenization.
sys.stdin.reconfigure(encoding='utf-8', errors='strict')
sys.stdout.reconfigure(encoding='utf-8', errors='strict')
sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
with contextlib.redirect_stdout(sys.stderr):
    import torch
    from sentence_transformers import SentenceTransformer
    torch.set_num_threads(4)
    model = SentenceTransformer(
        sys.argv[1], revision=sys.argv[2], device='cpu', local_files_only=True,
        config_kwargs={'vision_config': None, 'audio_config': None},
        model_kwargs={'torch_dtype': torch.float32}, trust_remote_code=False,
    )
    model.max_seq_length = 2048
dimensions = int(sys.argv[3])
for line in sys.stdin:
    try:
        request = json.loads(line)
        with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
            vectors = model.encode(request['texts'], prompt='', batch_size=4,
                show_progress_bar=False, normalize_embeddings=True, truncate_dim=dimensions)
        print(json.dumps({'vectors': vectors.tolist()}, allow_nan=False), flush=True)
    except Exception:
        print(json.dumps({'error': 'Embedding inference failed.'}), flush=True)
`;
