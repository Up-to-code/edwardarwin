from pathlib import Path
import json, numpy as np, soundfile as sf
from supertonic import TTS
root=Path(__file__).resolve().parent.parent;model=TTS(model_dir=root/'models/supertonic-3',auto_download=False);style=model.get_voice_style('F4')
lines=[('exp_02','Hey! I’m Emma. Emma Darwin, if we’re being formal.'),('exp_06','I’m a little desktop companion with a surprisingly dramatic wardrobe.'),('exp_02','You can chat or talk to me. I speak English, move, and change my expression.'),('exp_07','Ask me to open Chrome, save links with tags, find your saved sources, or capture your screen.'),('exp_01','Your memories stay in a local SQLite database. My voice and speech recognition run on your Mac.'),('exp_04','AI helped build me. My backend is open source, and the desktop source is on GitHub, at Up to code, slash Edward Darwin.'),('exp_02','It’s a funny little experiment, made for you. Come say hello!')]
chunks=[];segments=[];offset=0
for expression,text in lines:
 audio,_=model.synthesize(text,voice_style=style,lang='en',speed=1.05,total_steps=8);audio=audio.reshape(-1);duration=len(audio)/44100
 segments.append(dict(start=offset,end=offset+duration,expression=expression,text=text));chunks.extend([audio,np.zeros(8820,dtype=np.float32)]);offset+=duration+.2
sf.write(root/'studio-assets/intro/emma-intro.wav',np.concatenate(chunks),44100,subtype='PCM_16')
(root/'studio-assets/intro/emma-intro.json').write_text(json.dumps(segments,ensure_ascii=False,indent=2))
print('Generated Emma F4 introduction:',round(offset,2),'seconds')
