import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, model_validator

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)
    mock_llm: bool = True
    access_token: str = Field(default="", repr=False)
    requests_per_minute: int = Field(default=120, ge=1)
    ocr_enabled: bool = False
    ocr_language: str = "eng"
    llm_provider: Literal["openai", "gemini"] = "openai"
    llm_model: str = "gpt-4.1-mini"
    embedding_model: str = "text-embedding-3-small"
    openai_api_key: str = Field(default="", repr=False)
    google_api_key: str = Field(default="", repr=False)
    data_dir: Path = PROJECT_ROOT / "data"
    max_nodes_per_document: int = Field(default=40, ge=1, le=200)
    concept_similarity_threshold: float = Field(default=0.9, ge=0, le=1)
    chunk_size: int = Field(default=900, ge=100, le=4000)
    chunk_overlap: int = Field(default=150, ge=0, le=3999)
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1)

    @model_validator(mode="after")
    def check_chunk_overlap(self) -> "Settings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE.")
        return self


@lru_cache
def get_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    data_dir = Path(os.getenv("DATA_DIR", "data"))
    if not data_dir.is_absolute():
        data_dir = PROJECT_ROOT / data_dir
    mock_value = os.getenv("MOCK_LLM", "1")
    if mock_value not in {"0", "1"}:
        raise ValueError("MOCK_LLM must be 0 or 1.")
    return Settings(
        mock_llm=mock_value == "1",
        access_token=os.getenv("ACCESS_TOKEN", ""),
        requests_per_minute=os.getenv("REQUESTS_PER_MINUTE", "120"),
        ocr_enabled=os.getenv("OCR_ENABLED", "0") == "1",
        ocr_language=os.getenv("OCR_LANGUAGE", "eng"),
        llm_provider=os.getenv("LLM_PROVIDER", "openai"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4.1-mini"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        google_api_key=os.getenv("GOOGLE_API_KEY", ""),
        data_dir=data_dir,
        max_nodes_per_document=os.getenv("MAX_NODES_PER_DOCUMENT", "40"),
        concept_similarity_threshold=os.getenv("CONCEPT_SIMILARITY_THRESHOLD", "0.90"),
        chunk_size=os.getenv("CHUNK_SIZE", "900"),
        chunk_overlap=os.getenv("CHUNK_OVERLAP", "150"),
        max_upload_bytes=os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)),
    )
