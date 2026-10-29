"""Deterministic locally synthesized PCM cues. No external assets or speech."""
from pathlib import Path
import math, struct, wave
ROOT=Path(__file__).resolve().parent
SAMPLE_RATE=48000
CUES=[("cue-identity.wav",0.48,[440.0,660.0]),("cue-clarity.wav",0.48,[523.2511306,783.990872]),("cue-review.wav",0.62,[587.329536,880.0,1174.659072])]
for filename,duration,frequencies in CUES:
 samples=[]
 for index in range(round(duration*SAMPLE_RATE)):
  time=index/SAMPLE_RATE
  attack=min(1.0,time/0.012)
  release=min(1.0,max(0.0,(duration-time)/0.1))
  envelope=attack*release*math.exp(-time*6.2)
  sample=0.20*envelope*sum(math.sin(2*math.pi*frequency*time) for frequency in frequencies)/len(frequencies)
  value=round(max(-1.0,min(1.0,sample))*32767)
  samples.append(struct.pack("<hh",value,value))
 with wave.open(str(ROOT/"assets"/filename),"wb") as audio:
  audio.setnchannels(2);audio.setsampwidth(2);audio.setframerate(SAMPLE_RATE);audio.writeframes(b"".join(samples))
