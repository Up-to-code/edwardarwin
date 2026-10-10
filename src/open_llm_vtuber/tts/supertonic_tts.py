"""Offline English speech using locally downloaded Supertonic 3 assets."""

import threading
from pathlib import Path

import soundfile as sf
from supertonic import TTS

from .tts_interface import TTSInterface


class TTSEngine(TTSInterface):
    def __init__(self, model_dir: str, voice: str = "F4", speed: float = 1.05):
        self.model = TTS(model_dir=Path(model_dir), auto_download=False)
        self.style = self.model.get_voice_style(voice)
        self.speed = speed
        self.lock = threading.Lock()

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        path = self.generate_cache_file_name(file_name_no_ext, "wav")
        with self.lock:
            audio, _ = self.model.synthesize(
                text,
                voice_style=self.style,
                lang="en",
                speed=self.speed,
                total_steps=8,
            )
            sf.write(path, audio.reshape(-1), 44100, subtype="PCM_16")
        return path
