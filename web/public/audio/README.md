# /public/audio

Self-hosted audio served at the site root (no third party, GDPR-clean).

## Listening moment on the landing ("Posłuchaj", movement II)

Drop the excerpt here — the moment on `/` self-activates the moment the file is reachable
(no code change needed). Until then, the `ListenMoment` island renders nothing.

Expected filenames (provide either or both):

- `vox-excerpt.webm` — Opus, primary (smaller, best quality)
- `vox-excerpt.m4a` — AAC, Safari/iOS fallback

The player tries `.webm` first, falls back to `.m4a`. URL at runtime: `/audio/vox-excerpt.webm`.

### Producing the files from a source recording

Use a **public-domain composition** (the recording is yours, but the work must also be free —
Monteverdi, Victoria, Gallus, Allegri, Bruckner, Stanford, Gibbons, Bach…). Pick an 18–30 s
a cappella phrase that starts near-silence and blooms.

```bash
# Opus / WebM — primary
ffmpeg -ss 00:01:12 -t 24 -i source.wav \
  -af "afade=t=in:d=0.4, afade=t=out:st=23:d=1.0, loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:a libopus -b:a 112k -ar 48000 vox-excerpt.webm

# AAC / M4A — Safari/iOS fallback
ffmpeg -ss 00:01:12 -t 24 -i source.wav \
  -af "afade=t=in:d=0.4, afade=t=out:st=23:d=1.0, loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:a aac -b:a 160k -ar 48000 vox-excerpt.m4a
```

`-ss` = start, `-t` = length. `st=23` (fade-out start) = length − 1 s; adjust both if you
change the duration. The caption shown under the waveform lives in `CAPTION` inside
`web/src/islands/landing/ListenMoment.tsx`.
