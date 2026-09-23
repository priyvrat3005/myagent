"""
LLM Client abstraction layer.

Implements the interface pattern so that adding new providers
(e.g., OpenAI, Google, local models) requires no caller changes.
"""
from typing import Any, Dict, List, Optional, Protocol
from dataclasses import dataclass


@dataclass
class LLMResponse:
    content: str
    tokens_used: int
    cost_usd: float
    model: str
    finish_reason: str


class LLMClient(Protocol):
    """Interface for LLM providers. Implement this to add new providers."""
    
    async def messages(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """Send a messages request to the LLM."""
        ...
    
    async def count_tokens(self, text: str) -> int:
        """Count tokens in text for this provider's tokenizer."""
        ...


class AnthropicClient:
    """
    Concrete implementation using Anthropic's Messages API.
    
    TODO: In production, use the anthropic Python SDK.
    This implementation shows the interface pattern.
    """
    
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.api_key = api_key
        self.model = model
        # TODO: self.client = anthropic.AsyncAnthropic(api_key=api_key)
    
    async def messages(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """Call Anthropic Messages API."""
        # TODO: Implement actual API call
        # response = await self.client.messages.create(
        #     model=self.model,
        #     max_tokens=max_tokens,
        #     system=system or "",
        #     messages=messages,
        #     tools=tools or [],
        #     temperature=temperature,
        # )
        
        # Simulated response for development
        return LLMResponse(
            content="Simulated LLM response",
            tokens_used=len(str(messages)) // 4,
            cost_usd=len(str(messages)) * 0.00001,
            model=self.model,
            finish_reason="end_turn",
        )
    
    async def count_tokens(self, text: str) -> int:
        """Approximate token count (4 chars per token)."""
        # TODO: Use actual Anthropic tokenizer
        return len(text) // 4


class LLMClientFactory:
    """Factory for creating LLM clients by provider name."""
    
    _providers = {
        "anthropic": AnthropicClient,
        # TODO: Add more providers
        # "openai": OpenAIClient,
        # "google": GoogleClient,
    }
    
    @classmethod
    def create(cls, provider: str, **kwargs) -> LLMClient:
        provider_cls = cls._providers.get(provider)
        if not provider_cls:
            raise ValueError(f"Unknown LLM provider: {provider}. Available: {list(cls._providers.keys())}")
        return provider_cls(**kwargs)
