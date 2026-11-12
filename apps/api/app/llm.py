import hashlib
import math
import re
from typing import Any, TypeVar
from collections.abc import Callable

from langchain_core.embeddings import Embeddings
from langchain_core.exceptions import OutputParserException
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import Runnable
from pydantic import BaseModel, ValidationError

from .config import Settings
from .schemas import ProviderCheck

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


class FixtureChatModel(FakeListChatModel):
    def with_structured_output(
        self, schema: type[BaseModel], **kwargs: Any
    ) -> Runnable:
        # FakeListChatModel has no tool binding; parse its fixture through the same schema.
        return self | PydanticOutputParser(pydantic_object=schema)


class DeterministicEmbeddings(Embeddings):
    dimensions: int = 256

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for word in re.findall(r"\w+", text.casefold()):
            digest = hashlib.sha256(word.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            vector[index] += 1.0 if digest[4] % 2 else -1.0
        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector] if norm else vector


def provider_check(settings: Settings) -> ProviderCheck:
    if settings.mock_llm:
        return ProviderCheck(configured=True, provider="mock", model="deterministic-fixtures")
    key = settings.openai_api_key if settings.llm_provider == "openai" else settings.google_api_key
    return ProviderCheck(
        configured=bool(key), provider=settings.llm_provider, model=settings.llm_model
    )


def build_chat_model(settings: Settings, responses: list[str] | None = None) -> BaseChatModel:
    if settings.mock_llm:
        if not responses:
            raise ValueError("Mock generation needs an explicit fixture for its response schema.")
        return FixtureChatModel(responses=responses)
    if not provider_check(settings).configured:
        raise ValueError("Set the selected provider's API key in .env or use MOCK_LLM=1.")
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.llm_model, api_key=settings.openai_api_key,
            max_retries=0, timeout=30,
        )
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=settings.llm_model, api_key=settings.google_api_key,
        max_retries=0, timeout=30,
    )


def build_embedder(settings: Settings) -> Embeddings:
    if settings.mock_llm:
        return DeterministicEmbeddings()
    if not provider_check(settings).configured:
        raise ValueError("Set the selected provider's API key in .env or use MOCK_LLM=1.")
    if settings.llm_provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            model=settings.embedding_model, api_key=settings.openai_api_key,
            max_retries=0, request_timeout=30,
        )
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model, google_api_key=settings.google_api_key,
    )


class LLMClient:
    def __init__(self, model: BaseChatModel):
        self.model = model

    def generate(
        self, prompt: str, schema: type[ResponseModel],
        validate: Callable[[ResponseModel], None] | None = None,
    ) -> ResponseModel:
        structured_model = self.model.with_structured_output(schema)
        current_prompt = prompt
        for attempt in range(2):
            try:
                output = structured_model.invoke(current_prompt)
                response = schema.model_validate(output)
                if validate:
                    validate(response)
                return response
            except (ValidationError, OutputParserException):
                if attempt == 1:
                    raise
                current_prompt = (
                    f"{prompt}\nThe previous response did not match the response schema. "
                    "Return all required fields with the correct types."
                )
        raise AssertionError("Structured response validation did not finish.")
