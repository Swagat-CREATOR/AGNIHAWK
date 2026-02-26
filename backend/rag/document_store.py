# RAG document store setup
# pathway's xpack handles all the heavy lifting here
# we just point it at a folder of txt files and it builds
# a live index with chunking + embeddings
#
# using sentence-transformers for embeddings since it's free
# and runs locally — no API key needed

import pathway as pw
from pathway.xpacks.llm.document_store import DocumentStore
from pathway.xpacks.llm.servers import DocumentStoreServer
from pathway.xpacks.llm.splitters import TokenCountSplitter
from pathway.xpacks.llm.embedders import SentenceTransformerEmbedder
import os


def create_document_store(docs_dir=None):
    """sets up the pathway document store for fire safety RAG.
    
    indexes everything in fire_safety_docs/ — the store stays in sync
    automatically if you add/modify files while it's running.
    returns (store, server) tuple. caller should do server.run(threaded=True).
    """
    if docs_dir is None:
        docs_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "fire_safety_docs"
        )

    # read all text files — pathway watches the dir for changes
    docs = pw.io.fs.read(docs_dir, format="binary", with_metadata=True)

    # chunker: 50-300 tokens per chunk
    splitter = TokenCountSplitter(
        min_tokens=50,
        max_tokens=300,
        encoding_name="cl100k_base",
    )

    # all-MiniLM-L6-v2 is tiny (80MB) and fast, 384-dim vectors
    # good enough for our use case and doesn't need a GPU
    embedder = SentenceTransformerEmbedder(model="all-MiniLM-L6-v2")

    store = DocumentStore(docs=docs, splitter=splitter, embedder=embedder)

    port = int(os.getenv("PATHWAY_PORT", "8765"))
    server = DocumentStoreServer(
        host="127.0.0.1",
        port=port,
        document_store=store,
    )

    print(f"[rag] document store on port {port}")
    print(f"[rag] embedder: all-MiniLM-L6-v2 (local, free)")
    print(f"[rag] docs from: {docs_dir}")

    return store, server
