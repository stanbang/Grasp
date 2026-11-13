import argparse
import hashlib
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlmodel import Session
from app.config import PROJECT_ROOT, get_settings
from app.models import DocumentRow, ChunkRow
from app.storage import Storage
from app.parsing import read_pages, chunk_pages
from app.ingestion import index_chunks
from app.llm import build_embedder
from app.retrieval import retrieve_chunks


def main() -> None:
    parser=argparse.ArgumentParser(description='Evaluate 20 source-grounded retrieval cases without changing the study library.')
    parser.add_argument('--live',action='store_true',help='Use configured live embeddings; this makes paid provider requests.')
    parser.add_argument('--output',type=Path,default=PROJECT_ROOT/'docs/evaluation.json')
    args=parser.parse_args()
    configured=get_settings()
    settings=configured.model_copy(update={'mock_llm':not args.live})
    if args.live and not (settings.openai_api_key if settings.llm_provider=='openai' else settings.google_api_key):
        raise SystemExit('Configure the selected provider key in .env before using --live.')
    sample=PROJECT_ROOT/'samples/memory-and-learning.md'
    cases=json.loads((Path(__file__).parent/'questions.json').read_text(encoding='utf-8-sig'))
    with tempfile.TemporaryDirectory(prefix='grasp-evaluation-',ignore_cleanup_errors=True) as directory:
        storage=Storage(settings.model_copy(update={'data_dir':Path(directory)}))
        chunks=chunk_pages(read_pages(sample,'eval-sample'),settings.chunk_size,settings.chunk_overlap)
        with Session(storage.engine) as session:
            session.add(DocumentRow(id='eval-sample',name=sample.name,status='done',uploadedAt=datetime.now(timezone.utc)))
            session.commit()
            for chunk in chunks:session.add(ChunkRow(**chunk.model_dump()))
            session.commit()
        index_chunks(storage,chunks,build_embedder(settings))
        rows=[]
        for case in cases:
            expected=[chunk.id for chunk in chunks if case['expectedQuote'] in chunk.text]
            if not expected:raise ValueError('Expected quote is not contained in a source chunk: '+case['expectedQuote'])
            retrieved=[chunk.id for chunk in retrieve_chunks(storage,case['question'],5,['eval-sample'])]
            ranks=[retrieved.index(cid)+1 for cid in expected if cid in retrieved]
            rank=min(ranks) if ranks else None
            rows.append({**case,'expectedChunkIds':expected,'retrievedChunkIds':retrieved,'rank':rank})
        report={'mode':'live' if args.live else 'mock','embeddingIdentity':storage.embedding_identity,'sampleSha256':hashlib.sha256(sample.read_bytes()).hexdigest(),'chunkCount':len(chunks),'questions':len(rows),'hitAt5':sum(row['rank'] is not None for row in rows)/len(rows),'mrr':sum(1/row['rank'] if row['rank'] else 0 for row in rows)/len(rows),'cases':rows,'limitation':'Small original sample with fewer than five chunks: Hit@5 is a wiring check, not a semantic-quality benchmark.'}
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        print(f"{report['mode']} retrieval: Hit@5={report['hitAt5']:.3f}, MRR={report['mrr']:.3f}, questions={len(rows)}, chunks={len(chunks)}")
        print(report['limitation'])
        storage.close()
    # Chroma's native client may retain Windows file handles until this process exits.

if __name__=='__main__':main()
