"""Rebuild the circular two-track mix from the supplied, audio-only MP3 assets."""
from pathlib import Path
import subprocess
import numpy as np
root=Path(__file__).resolve().parents[1]/'public/audio/medal-cove'
def decode(path):
    command=['ffmpeg','-nostdin','-v','error','-i',str(path),'-map','0:a:0','-f','f32le','-ar','48000','-ac','2','-']
    return np.frombuffer(subprocess.check_output(command),dtype='<f4').reshape(-1,2).copy()
a,b=decode(root/'coin-sound.mp3'),decode(root/'calm-sanctuary.mp3')
n=60000  # 1.25 seconds at 48 kHz
t=np.linspace(0,1,n,dtype=np.float32)[:,None]
def cross(x,y):
    return x*np.cos(t*np.pi/2)+y*np.sin(t*np.pi/2)
joined=np.concatenate([a[:-n],cross(a[-n:],b[:n]),b[n:]])
loop=np.concatenate([joined[n:-n],cross(joined[-n:],joined[:n])])
loop*=min(1,.89/np.max(np.abs(loop)))
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','f32le','-ar','48000','-ac','2','-i','-','-c:a','libmp3lame','-b:a','160k','-map_metadata','-1',str(root/'sanctuary-mix.mp3')],input=loop.astype('<f4').tobytes(),check=True)
print(f'Built {len(loop)/48000:.3f}s circular mix with two equal-power crossfades.')
