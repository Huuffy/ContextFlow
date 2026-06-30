from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import UploadedDocument, FileType, Agent
from app.core.security import get_current_agent
from app.config import settings
from pydantic import BaseModel
from pathlib import Path
import re
import asyncio
from datetime import datetime
from typing import Optional

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_SAFE_FILENAME = re.compile(r"[^a-zA-Z0-9._-]")

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentOut(BaseModel):
    id: str
    customer_id: str
    filename: str
    file_type: str
    processed: bool
    chunk_count: int
    created_at: datetime


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    customer_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Determine file type
    raw_name = file.filename or "upload"
    ext = Path(raw_name).suffix.lower().lstrip(".")
    if ext not in ("pdf", "csv"):
        raise HTTPException(status_code=400, detail="Only PDF and CSV files are supported")

    # Sanitize filename — strip path separators and special chars
    safe_stem = _SAFE_FILENAME.sub("_", Path(raw_name).stem)[:100]
    name = f"{safe_stem}.{ext}"

    # Enforce file size limit before writing to disk
    content = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    # Save file — verify resolved path stays within upload_dir
    upload_root = Path(settings.upload_dir).resolve()
    customer_dir = upload_root / customer_id
    customer_dir.mkdir(parents=True, exist_ok=True)
    file_path = (customer_dir / name).resolve()
    if not str(file_path).startswith(str(upload_root)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    file_path.write_bytes(content)

    doc = UploadedDocument(
        customer_id=customer_id,
        filename=name,
        file_type=FileType(ext),
        uploaded_by=None,
        file_path=str(file_path),
        processed=False,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Process in background
    asyncio.create_task(_process_document(doc.id, str(file_path), ext, customer_id))

    return DocumentOut(id=doc.id, customer_id=doc.customer_id, filename=doc.filename,
                       file_type=doc.file_type.value, processed=doc.processed,
                       chunk_count=doc.chunk_count, created_at=doc.created_at)


async def _process_document(doc_id: str, file_path: str, ext: str, customer_id: str) -> None:
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.db.session import AsyncSessionLocal
        from app.ai.embedder import embed_batch
        from app.db.lancedb_client import get_document_chunks_table
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        import uuid

        # Extract text
        if ext == "pdf":
            import fitz
            doc = fitz.open(file_path)
            text = "\n".join(page.get_text() for page in doc)
        else:
            import pandas as pd
            df = pd.read_csv(file_path)
            text = df.to_string(index=False)

        # Chunk
        splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=80)
        chunks = splitter.split_text(text)

        # Embed and store in LanceDB
        vectors = embed_batch(chunks)
        table = get_document_chunks_table()
        rows = [{
            "chunk_id": str(uuid.uuid4()),
            "document_id": doc_id,
            "customer_id": customer_id,
            "content": chunk,
            "chunk_index": i,
            "vector": vec,
        } for i, (chunk, vec) in enumerate(zip(chunks, vectors))]
        if rows:
            table.add(rows)

        # Mark processed
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            result = await db.execute(select(UploadedDocument).where(UploadedDocument.id == doc_id))
            doc_record = result.scalar_one_or_none()
            if doc_record:
                doc_record.processed = True
                doc_record.chunk_count = len(chunks)
                await db.commit()
        logger.info(f"Document {doc_id} processed: {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Document processing error {doc_id}: {e}", exc_info=True)


@router.get("/customers/{customer_id}/documents", response_model=list[DocumentOut])
async def list_documents(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedDocument).where(UploadedDocument.customer_id == customer_id))
    return [DocumentOut(id=d.id, customer_id=d.customer_id, filename=d.filename,
                        file_type=d.file_type.value, processed=d.processed,
                        chunk_count=d.chunk_count, created_at=d.created_at)
            for d in result.scalars().all()]
