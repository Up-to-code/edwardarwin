import atexit
import requests
from openai import NOT_GIVEN
from loguru import logger
from .openai_compatible_llm import AsyncLLM


class OllamaLLM(AsyncLLM):
    def __init__(
        self,
        model: str,
        base_url: str,
        llm_api_key: str = "z",
        organization_id: str = "z",
        project_id: str = "z",
        temperature: float = 1.0,
        keep_alive: float = -1,
        unload_at_exit: bool = True,
    ):
        self.keep_alive = keep_alive
        self.unload_at_exit = unload_at_exit
        self.cleaned = False
        super().__init__(
            model=model,
            base_url=base_url,
            llm_api_key=llm_api_key,
            organization_id=organization_id,
            project_id=project_id,
            temperature=temperature,
        )
        self.support_vision = None
        try:
            response = requests.post(
                base_url.removesuffix("/v1").rstrip("/") + "/api/show",
                json={"model": model},
                timeout=10,
            )
            response.raise_for_status()
            capabilities = response.json().get("capabilities")
            if capabilities is not None:
                self.support_vision = "vision" in capabilities
        except (requests.RequestException, ValueError) as exc:
            logger.warning(f"Could not determine Ollama model capabilities: {exc}")
        try:
            # preload model
            logger.info("Preloading model for Ollama")
            # Send the POST request to preload model
            logger.debug(
                requests.post(
                    base_url.replace("/v1", "") + "/api/chat",
                    json={
                        "model": model,
                        "keep_alive": keep_alive,
                    },
                )
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Failed to preload model: {e}")
            logger.critical(
                "Fail to connect to Ollama backend. Is Ollama server running? Try running `ollama list` to start the server and try again.\nThe AI will repeat 'Error connecting chat endpoint' until the server is running."
            )
        except Exception as e:
            logger.error(f"Failed to preload model: {e}")
        # If keep_alive is less than 0, register cleanup to unload the model
        if unload_at_exit:
            atexit.register(self.cleanup)

    def _prepare_messages(self, messages):
        """Retain text when a known text-only model receives camera/screen images."""
        if self.support_vision is not False:
            return messages, False
        prepared = []
        latest_image = False
        for index, message in enumerate(messages):
            content = message.get("content")
            if not isinstance(content, list):
                prepared.append(message)
                continue
            parts = [part for part in content if part.get("type") != "image_url"]
            if len(parts) != len(content):
                parts = [
                    *parts,
                    {
                        "type": "text",
                        "text": "[Attached images are unavailable: this model cannot see images. "
                        "Answer from text only; never claim to have viewed them.]",
                    },
                ]
                latest_image = latest_image or index == len(messages) - 1
            prepared.append({**message, "content": parts})
        return prepared, latest_image

    async def chat_completion(self, messages, system=None, tools=NOT_GIVEN):
        messages, latest_image = self._prepare_messages(messages)
        if latest_image:
            logger.warning(
                f"Ignoring image attachments for text-only model {self.model}"
            )
            yield "My current local model cannot view attached images. "
        async for chunk in super().chat_completion(messages, system, tools):
            yield chunk

    def __del__(self):
        """Destructor to unload the model"""
        self.cleanup()

    def cleanup(self):
        """Clean up function to unload the model when exitting"""
        if not self.cleaned and self.unload_at_exit:
            logger.info(f"Ollama: Unloading model: {self.model}")
            # Unload the model
            # unloading is just the same as preload, but with keep alive set to 0
            logger.debug(
                requests.post(
                    self.base_url.replace("/v1", "") + "/api/chat",
                    json={
                        "model": self.model,
                        "keep_alive": 0,
                    },
                )
            )
            self.cleaned = True
