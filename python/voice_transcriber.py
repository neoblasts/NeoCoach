#!/usr/bin/env python3
"""
NeoCoach Voice Transcriber — Powered by faster-whisper + SoundDevice
====================================================================

Live voice-to-text listener for the NeoCoach AI Assistant.
Streams transcribed text to stdout in real-time (JSON lines).
Designed to be spawned as a child process by Electron.

Setup (one-time):
  pip install faster-whisper sounddevice numpy

Usage (standalone test):
  python voice_transcriber.py

Electron spawns this and reads stdout line-by-line.
"""

import sys
import json
import time
import math
import struct
import threading
import argparse
import numpy as np
import queue

try:
    import sounddevice as sd
except ImportError:
    print(json.dumps({"type": "error", "message": "sounddevice not installed. Run: pip install sounddevice"}), flush=True)
    sys.exit(1)

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({"type": "error", "message": "faster-whisper not installed. Run: pip install faster-whisper"}), flush=True)
    sys.exit(1)


# ─── Configuration ────────────────────────────────────────────────────────────

SAMPLE_RATE     = 16000         # Hz — Whisper native sample rate
CHUNK_SIZE      = 1024          # PCM samples per read
CHANNELS        = 1             # Mono mic
DTYPE           = 'int16'       # 16-bit integer PCM

# VAD settings
SILENCE_THRESHOLD_RMS   = 400   # RMS amplitude below this → silence
SILENCE_HOLD_SECS       = 1.6   # Seconds of silence before segment commit
MIN_SPEECH_SECS         = 0.4   # Minimum speech duration to bother transcribing
MAX_SEGMENT_SECS        = 18    # Hard cutoff per segment

# Whisper model
WHISPER_MODEL   = "base"        # "tiny" is even faster; "small" is more accurate
DEVICE          = "cpu"
COMPUTE_TYPE    = "int8"        # Fast and lightweight on CPU


# ─── Emit JSON line to stdout (Electron reads these) ─────────────────────────

def emit(event: str, **kwargs):
    payload = {"type": event, **kwargs}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


# ─── RMS energy calculation ───────────────────────────────────────────────────

def rms(data: bytes) -> float:
    """Return Root Mean Square energy of PCM int16 audio chunk."""
    if not data:
        return 0.0
    count = len(data) // 2
    shorts = struct.unpack(f"{count}h", data[:count * 2])
    if count == 0:
        return 0.0
    sum_sq = sum(s * s for s in shorts)
    return math.sqrt(sum_sq / count)


# ─── Main Transcriber Class ────────────────────────────────────────────────────

class VoiceTranscriber:
    """
    Continuous microphone listener with VAD.
    Emits JSON events to stdout.
    """

    def __init__(self, model_name=WHISPER_MODEL, device=DEVICE, compute_type=COMPUTE_TYPE):
        self.model_name     = model_name
        self.device         = device
        self.compute_type   = compute_type
        self.model          = None
        self._running       = False
        self.q              = queue.Queue()

    def _load_model(self):
        emit("status", message=f"Loading Whisper '{self.model_name}' model on {self.device}...")
        self.model = WhisperModel(
            self.model_name,
            device=self.device,
            compute_type=self.compute_type,
        )
        emit("status", message="Model loaded. Voice transcriber ready.")

    def _bytes_to_float32(self, pcm_bytes: bytes) -> np.ndarray:
        """Convert raw PCM int16 bytes → float32 numpy array for Whisper."""
        audio_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        return audio_int16.astype(np.float32) / 32768.0

    def _transcribe_segment(self, audio_bytes: bytes) -> str:
        """Run Whisper on a PCM bytes segment. Returns stripped text string."""
        if len(audio_bytes) < SAMPLE_RATE * 2 * MIN_SPEECH_SECS:
            return ""
        try:
            audio_array = self._bytes_to_float32(audio_bytes)
            segments, _ = self.model.transcribe(
                audio_array,
                beam_size=3,
                vad_filter=True,
                vad_parameters={"threshold": 0.4, "min_silence_duration_ms": 400},
                initial_prompt="Haan, I am fine. Kaise ho aap? Please transcribe entirely in Latin script. Do not use Devanagari.",
                condition_on_previous_text=False,
            )
            parts = [s.text.strip() for s in segments]
            return " ".join(p for p in parts if p).strip()
        except Exception as ex:
            emit("error", message=f"Transcription error: {ex}")
            return ""

    def _audio_callback(self, indata, frames, time_info, status):
        if status:
            emit("status", message=str(status))
        self.q.put(bytes(indata))

    def listen_and_transcribe(self):
        """Main blocking loop — records mic, detects voice, transcribes, emits."""
        self._running = True

        # State machine
        speech_buffer   = b""
        silence_chunks  = 0
        speaking        = False

        chunks_per_sec  = SAMPLE_RATE / CHUNK_SIZE
        silence_limit   = int(SILENCE_HOLD_SECS * chunks_per_sec)
        max_chunks      = int(MAX_SEGMENT_SECS * chunks_per_sec)
        partial_every   = max(1, int(0.8 * chunks_per_sec))  # emit partial every ~0.8s
        chunk_count     = 0

        try:
            with sd.RawInputStream(samplerate=SAMPLE_RATE, blocksize=CHUNK_SIZE,
                                   dtype=DTYPE, channels=CHANNELS, callback=self._audio_callback):
                emit("ready")
                while self._running:
                    try:
                        raw = self.q.get(timeout=0.1)
                    except queue.Empty:
                        continue

                    energy = rms(raw)
                    is_voiced = energy > SILENCE_THRESHOLD_RMS

                    if is_voiced:
                        if not speaking:
                            speaking = True
                            emit("listening")
                        silence_chunks = 0
                        speech_buffer += raw
                        chunk_count += 1

                        # Emit partial transcript periodically while speaking
                        if chunk_count % partial_every == 0 and len(speech_buffer) > SAMPLE_RATE * 2:
                            partial = self._transcribe_segment(speech_buffer)
                            if partial:
                                emit("partial", text=partial)

                        # Hard cut if segment too long
                        if chunk_count > max_chunks:
                            text = self._transcribe_segment(speech_buffer)
                            if text:
                                emit("transcript", text=text)
                            speech_buffer  = b""
                            silence_chunks = 0
                            chunk_count    = 0

                    elif speaking:
                        # Voiced chunk just ended — accumulate silence
                        speech_buffer  += raw
                        silence_chunks += 1

                        if silence_chunks >= silence_limit:
                            # Silence held long enough — commit segment
                            emit("silence")
                            text = self._transcribe_segment(speech_buffer)
                            if text:
                                emit("transcript", text=text)
                            # Reset
                            speech_buffer  = b""
                            silence_chunks = 0
                            chunk_count    = 0
                            speaking       = False
        except Exception as ex:
            emit("error", message=f"Stream error: {ex}")
        finally:
            self._running = False
            emit("stopped")

    def stop(self):
        """Signal the listen loop to stop cleanly."""
        self._running = False


# ─── Entry point ───────────────────────────────────────────────────────────────

def listen_and_transcribe(model="base", device="cpu", compute_type="int8"):
    """
    Convenience function: create and run a VoiceTranscriber.
    Blocks until interrupted (SIGINT / stdin close from Electron).
    """
    transcriber = VoiceTranscriber(
        model_name=model,
        device=device,
        compute_type=compute_type,
    )
    transcriber._load_model()

    # Listen for shutdown signal from Electron on stdin
    def stdin_watcher():
        for line in sys.stdin:
            cmd = line.strip()
            if cmd in ("stop", "quit", "exit"):
                transcriber.stop()
                break

    watcher = threading.Thread(target=stdin_watcher, daemon=True)
    watcher.start()

    transcriber.listen_and_transcribe()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NeoCoach Voice Transcriber")
    parser.add_argument("--model",        default="base",  help="Whisper model: tiny|base|small")
    parser.add_argument("--device",       default="cpu",   help="Device: cpu|cuda")
    parser.add_argument("--compute-type", default="int8",  help="Compute type: int8|float16|float32")
    args = parser.parse_args()

    listen_and_transcribe(
        model=args.model,
        device=args.device,
        compute_type=args.compute_type,
    )
