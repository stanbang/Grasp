import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import ChunkRow, DocumentRow, GraphNodeRow, ProgressRow
from app.storage import create_sqlite_engine

API_ROOT = Path(__file__).resolve().parents[1]


class SqliteTests(unittest.TestCase):
    def test_progress_initialization_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first = create_sqlite_engine(Path(directory))
            with Session(first) as session:
                progress = session.get(ProgressRow, 1)
                self.assertIsNotNone(progress)
                progress.totalNodes = 3
                session.add(progress)
                session.commit()
            first.dispose()
            second = create_sqlite_engine(Path(directory))
            with Session(second) as session:
                rows = session.exec(select(ProgressRow)).all()
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0].totalNodes, 3)
            second.dispose()

    def test_chunk_document_foreign_key_is_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            engine = create_sqlite_engine(Path(directory))
            with Session(engine) as session:
                session.add(ChunkRow(id="c", docId="missing", page=1, text="notes", charStart=0, charEnd=5))
                with self.assertRaises(IntegrityError):
                    session.commit()
                session.rollback()
            engine.dispose()

    def test_graph_provenance_round_trips_without_positions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            engine = create_sqlite_engine(Path(directory))
            with Session(engine) as session:
                session.add(DocumentRow(id="d", name="note.md", status="done", uploadedAt=datetime.now(timezone.utc)))
                session.add(GraphNodeRow(id="n", label="Memory", summary="A concept", docIds=["d"], sourceChunkIds=["c"]))
                session.commit()
                node = session.get(GraphNodeRow, "n")
                self.assertEqual(node.sourceChunkIds, ["c"])
                self.assertNotIn("x", GraphNodeRow.model_fields)
                self.assertNotIn("y", GraphNodeRow.model_fields)
                self.assertNotIn("z", GraphNodeRow.model_fields)
            engine.dispose()


class ChromaPersistenceTests(unittest.TestCase):
    def test_vectors_survive_a_process_restart(self) -> None:
        write_script = """
from pathlib import Path
import sys
from app.config import Settings
from app.storage import Storage
storage = Storage(Settings(data_dir=Path(sys.argv[1])))
store = storage.vector_store()
text = 'Retrieval practice means recalling an idea before reading the answer.'
store.add_texts([text], metadatas=[{'docId':'sample','page':1,'charStart':0,'charEnd':len(text)}], ids=['chunk-fixture'])
assert storage.check_sqlite() and storage.check_chroma()
storage.close()
"""
        read_script = """
from pathlib import Path
import sys
from app.config import Settings
from app.storage import Storage
storage = Storage(Settings(data_dir=Path(sys.argv[1])))
assert storage.collection.count() == 1
results = storage.vector_store().similarity_search('retrieval practice', k=1)
assert results[0].metadata['docId'] == 'sample'
assert results[0].page_content.startswith('Retrieval practice')
storage.close()
"""
        environment = {**os.environ, "PYTHONPATH": str(API_ROOT)}
        with tempfile.TemporaryDirectory() as directory:
            for script in (write_script, read_script):
                result = subprocess.run(
                    [sys.executable, "-c", script, directory], env=environment,
                    capture_output=True, text=True, timeout=90,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
