"""Download the tested voice and speech-recognition assets, never personal data."""
from pathlib import Path
import hashlib, json, urllib.request
ROOT = Path(__file__).resolve().parent.parent
SUPERTONIC = 'Supertone/supertonic-3'
REVISION = '3cadd1ee6394adea1bd021217a0e650ede09a323'
VOICE_FILES = ['LICENSE','onnx/duration_predictor.onnx','onnx/text_encoder.onnx','onnx/tts.json','onnx/unicode_indexer.json','onnx/vector_estimator.onnx','onnx/vocoder.onnx'] + [f'voice_styles/F{i}.json' for i in range(1,6)]
def download(repo, revision, filename, destination, expected=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and (not expected or hashlib.sha256(destination.read_bytes()).hexdigest() == expected): return
    temporary = destination.with_suffix(destination.suffix + '.download')
    print('Downloading',filename,flush=True)
    urllib.request.urlretrieve(f'https://huggingface.co/{repo}/resolve/{revision}/{filename}', temporary)
    if expected and hashlib.sha256(temporary.read_bytes()).hexdigest() != expected: raise RuntimeError('Checksum failed for '+filename)
    temporary.replace(destination)
for filename in VOICE_FILES:
    download(SUPERTONIC, REVISION, filename, ROOT/'models/supertonic-3'/filename)
sense = 'csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17'
for filename, checksum in [('model.int8.onnx','c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51'),('tokens.txt',None)]:
    download(sense, 'main', filename, ROOT/'models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17'/filename, checksum)
print('Local speech models ready.')
