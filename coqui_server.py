#!/usr/bin/env python3
"""
Simple Coqui TTS Server for Voice Cloning
This server provides voice cloning capabilities using Coqui TTS
"""

import os
import io
import json
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
from TTS.api import TTS
import numpy as np
import soundfile as sf
import logging

# Fix PyTorch weights loading issue
import torch.serialization
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig
torch.serialization.add_safe_globals([XttsConfig, XttsAudioConfig])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize TTS model
tts = None

def initialize_tts():
    """Initialize the TTS model"""
    global tts
    try:
        # Use XTTS v2 for voice cloning capabilities
        model_name = "tts_models/multilingual/multi-dataset/xtts_v2"
        logger.info(f"Loading TTS model: {model_name}")

        # Set weights_only=False to bypass PyTorch security restrictions
        import torch
        original_load = torch.load
        torch.load = lambda *args, **kwargs: original_load(*args, **kwargs, weights_only=False)

        tts = TTS(model_name)

        # Restore original torch.load
        torch.load = original_load

        logger.info("TTS model loaded successfully")
        logger.info(f"Model type: {type(tts.synthesizer.tts_model).__name__}")

        return True
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        return False

@app.route('/api/tts', methods=['GET', 'POST'])
def text_to_speech():
    """Generate speech from text"""
    try:
        if request.method == 'GET':
            # Health check
            return jsonify({
                "status": "ready",
                "model": "xtts_v2",
                "message": "Coqui TTS server is running"
            })
        
        # Handle POST request for TTS generation
        if request.content_type == 'application/json':
            data = request.get_json()
            text = data.get('text', '')
            speaker_wav = data.get('speaker_wav')
            language = data.get('language', 'en')
        else:
            # Handle form data
            text = request.form.get('text', '')
            language = request.form.get('language', 'en')
            speaker_wav = None
            
            # Check if speaker_wav file is uploaded
            if 'speaker_wav' in request.files:
                speaker_file = request.files['speaker_wav']
                if speaker_file.filename:
                    # Save uploaded file temporarily
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                        speaker_file.save(tmp_file.name)
                        speaker_wav = tmp_file.name

        if not text:
            return jsonify({"error": "Text is required"}), 400

        logger.info(f"Generating speech for text: {text[:50]}...")
        
        # Generate speech with XTTS v2
        if speaker_wav:
            # Voice cloning with speaker reference
            logger.info(f"Using speaker reference for voice cloning: {speaker_wav}")
            try:
                wav = tts.tts(text=text, speaker_wav=speaker_wav, language=language)
            except Exception as clone_error:
                logger.error(f"Voice cloning failed: {clone_error}")
                raise Exception(f"Voice cloning failed: {str(clone_error)}")
        else:
            # For XTTS v2, we need a speaker reference. Let's create a simple default one
            logger.info("No speaker reference provided, using default voice")

            # Use a pre-existing audio file from the temp_voices directory if available
            temp_voices_dir = "temp_voices"
            default_speaker_path = None

            if os.path.exists(temp_voices_dir):
                # Look for WAV files only (Coqui TTS works best with WAV)
                voice_files = [f for f in os.listdir(temp_voices_dir) if f.endswith('.wav')]
                if voice_files:
                    default_speaker_path = os.path.join(temp_voices_dir, voice_files[0])
                    logger.info(f"Using existing WAV voice file as default: {default_speaker_path}")
                else:
                    # If no WAV files, look for other formats and convert them
                    other_files = [f for f in os.listdir(temp_voices_dir) if f.endswith(('.webm', '.mp3', '.m4a'))]
                    if other_files:
                        source_file = os.path.join(temp_voices_dir, other_files[0])
                        logger.info(f"Found non-WAV file, will create default speaker instead: {source_file}")

            if not default_speaker_path:
                # Create a minimal default speaker audio
                import numpy as np

                # Generate a simple voice-like sound (formant synthesis approximation)
                sample_rate = 22050
                duration = 2.0  # 2 seconds
                t = np.linspace(0, duration, int(sample_rate * duration), False)

                # Create a more voice-like sound with multiple harmonics
                fundamental = 150  # Hz, typical male voice
                voice_signal = (
                    0.5 * np.sin(2 * np.pi * fundamental * t) +
                    0.3 * np.sin(2 * np.pi * fundamental * 2 * t) +
                    0.2 * np.sin(2 * np.pi * fundamental * 3 * t) +
                    0.1 * np.sin(2 * np.pi * fundamental * 4 * t)
                )

                # Add some envelope to make it more natural
                envelope = np.exp(-t * 0.5)  # Decay envelope
                voice_signal *= envelope

                # Normalize
                voice_signal = voice_signal / np.max(np.abs(voice_signal)) * 0.7

                # Save as temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                    sf.write(tmp_file.name, voice_signal, sample_rate)
                    default_speaker_path = tmp_file.name

                logger.info(f"Created default speaker audio: {default_speaker_path}")

            try:
                wav = tts.tts(text=text, speaker_wav=default_speaker_path, language=language)

                # Clean up temporary file if we created one
                if default_speaker_path and default_speaker_path.startswith('/tmp'):
                    os.unlink(default_speaker_path)

            except Exception as default_error:
                # Clean up temporary file if we created one
                if default_speaker_path and default_speaker_path.startswith('/tmp') and os.path.exists(default_speaker_path):
                    os.unlink(default_speaker_path)
                logger.error(f"Default TTS generation failed: {default_error}")
                raise Exception(f"TTS generation failed: {str(default_error)}. For best results, please upload a voice sample for cloning.")
        
        # Convert to audio file with proper format
        audio_buffer = io.BytesIO()

        # Ensure wav is a numpy array and has the right format
        if isinstance(wav, list):
            wav = np.array(wav)

        # Normalize audio to prevent clipping
        if wav.max() > 1.0 or wav.min() < -1.0:
            wav = wav / np.max(np.abs(wav))

        # Write as WAV with proper sample rate
        sf.write(audio_buffer, wav, 22050, format='WAV', subtype='PCM_16')
        audio_buffer.seek(0)

        # Get the size for proper headers
        audio_size = audio_buffer.getbuffer().nbytes

        # Clean up temporary file if created
        if speaker_wav and os.path.exists(speaker_wav):
            os.unlink(speaker_wav)

        # Return with proper headers to avoid 206 Partial Content
        return send_file(
            audio_buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='speech.wav',
            conditional=False  # Disable conditional requests that cause 206
        )
        
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts/speaker-similarity', methods=['POST'])
def speaker_similarity_tts():
    """Generate speech with speaker similarity (voice cloning)"""
    try:
        text = request.form.get('text', '')
        language = request.form.get('language', 'en')
        
        if not text:
            return jsonify({"error": "Text is required"}), 400
            
        if 'speaker_wav' not in request.files:
            return jsonify({"error": "Speaker audio file is required"}), 400
            
        speaker_file = request.files['speaker_wav']

        # Save uploaded file temporarily and ensure it's a proper WAV file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            speaker_file.save(tmp_file.name)
            speaker_wav_path = tmp_file.name

        # Verify and convert the audio file to a format Coqui TTS can read
        try:
            import soundfile as sf
            import numpy as np

            # First, try to read the file directly
            try:
                data, samplerate = sf.read(speaker_wav_path)
                logger.info(f"Successfully read speaker file: {len(data)} samples at {samplerate}Hz")
            except Exception as sf_error:
                logger.warning(f"Soundfile couldn't read the file directly: {sf_error}")

                # If soundfile can't read it, try using pydub to convert it
                try:
                    from pydub import AudioSegment
                    from pydub.utils import which
                    logger.info("Attempting to convert audio using pydub...")

                    # Set ffmpeg path explicitly
                    AudioSegment.converter = "/opt/homebrew/bin/ffmpeg"
                    AudioSegment.ffmpeg = "/opt/homebrew/bin/ffmpeg"
                    AudioSegment.ffprobe = "/opt/homebrew/bin/ffprobe"

                    # Load the audio file with pydub (supports many formats)
                    audio = AudioSegment.from_file(speaker_wav_path)

                    # Convert to WAV format with the right settings
                    audio = audio.set_frame_rate(22050).set_channels(1)

                    # Save as proper WAV file
                    converted_path = speaker_wav_path.replace('.wav', '_converted.wav')
                    audio.export(converted_path, format="wav")

                    # Replace the original file
                    os.unlink(speaker_wav_path)
                    os.rename(converted_path, speaker_wav_path)

                    # Now try to read it again
                    data, samplerate = sf.read(speaker_wav_path)
                    logger.info(f"Successfully converted and read speaker file: {len(data)} samples at {samplerate}Hz")

                except ImportError:
                    logger.error("pydub not available for audio conversion")
                    raise Exception("Audio file format not supported. Please upload a WAV file.")
                except Exception as pydub_error:
                    logger.error(f"pydub conversion failed: {pydub_error}")
                    raise Exception(f"Failed to convert audio file: {str(pydub_error)}")

            # Ensure the audio is in the right format for Coqui TTS
            if samplerate != 22050:
                logger.info(f"Resampling from {samplerate}Hz to 22050Hz")
                from scipy import signal

                # Calculate resampling ratio
                resample_ratio = 22050 / samplerate
                new_length = int(len(data) * resample_ratio)

                # Resample the audio
                data = signal.resample(data, new_length)

                # Save the resampled audio
                sf.write(speaker_wav_path, data, 22050)
                logger.info("Resampled audio saved")

            # Ensure mono audio
            if len(data.shape) > 1:
                data = np.mean(data, axis=1)
                sf.write(speaker_wav_path, data, 22050)
                logger.info("Converted to mono audio")

        except Exception as audio_error:
            logger.error(f"Failed to process speaker audio file: {audio_error}")
            # Clean up the temporary file
            if os.path.exists(speaker_wav_path):
                os.unlink(speaker_wav_path)
            raise Exception(f"Invalid audio file format: {str(audio_error)}")
        
        logger.info(f"Voice cloning with speaker file: {speaker_wav_path}")
        
        # Generate speech with voice cloning
        wav = tts.tts(text=text, speaker_wav=speaker_wav_path, language=language)
        
        # Convert to audio file with proper format
        audio_buffer = io.BytesIO()

        # Ensure wav is a numpy array and has the right format
        if isinstance(wav, list):
            wav = np.array(wav)

        # Normalize audio to prevent clipping
        if wav.max() > 1.0 or wav.min() < -1.0:
            wav = wav / np.max(np.abs(wav))

        # Write as WAV with proper sample rate
        sf.write(audio_buffer, wav, 22050, format='WAV', subtype='PCM_16')
        audio_buffer.seek(0)

        # Clean up temporary file
        os.unlink(speaker_wav_path)

        # Return with proper headers to avoid 206 Partial Content
        return send_file(
            audio_buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='cloned_speech.wav',
            conditional=False  # Disable conditional requests that cause 206
        )
        
    except Exception as e:
        logger.error(f"Speaker similarity TTS error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts/info', methods=['GET'])
def get_server_info():
    """Get server information and available models"""
    try:
        return jsonify({
            "models": ["tts_models/multilingual/multi-dataset/xtts_v2"],
            "languages": ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko"],
            "speakers": [],
            "status": "ready"
        })
    except Exception as e:
        logger.error(f"Server info error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": tts is not None
    })

if __name__ == '__main__':
    logger.info("Starting Coqui TTS Server...")
    
    # Initialize TTS model
    if not initialize_tts():
        logger.error("Failed to initialize TTS model. Exiting.")
        exit(1)
    
    logger.info("Starting Flask server on port 5002...")
    app.run(host='0.0.0.0', port=5002, debug=False)
