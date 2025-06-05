// Coqui TTS integration for free voice cloning
// This uses the open-source Coqui TTS library

export interface CoquiVoiceModel {
  id: string
  name: string
  description?: string
  model_path: string
  speaker_wav_path?: string
  language: string
  created_at: string
}

export interface CoquiSynthesisOptions {
  text: string
  speaker_wav?: string
  language?: string
  speed?: number
  emotion?: string
}

export class CoquiTTSService {
  private baseUrl: string
  private isServerRunning: boolean = false

  constructor(baseUrl: string = 'http://localhost:5002') {
    this.baseUrl = baseUrl
  }

  // Check if Coqui TTS server is running
  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
      this.isServerRunning = response.ok
      return this.isServerRunning
    } catch (error) {
      console.log('Coqui TTS server not running:', error)
      this.isServerRunning = false
      return false
    }
  }

  // Get available TTS models
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts/models`)
      if (!response.ok) throw new Error('Failed to fetch models')
      
      const data = await response.json()
      return data.models || []
    } catch (error) {
      console.error('Error fetching Coqui models:', error)
      return []
    }
  }

  // Clone voice using speaker reference audio
  async cloneVoice(
    name: string,
    description: string,
    audioFile: File,
    language: string = 'en'
  ): Promise<CoquiVoiceModel> {
    try {
      // First, upload the reference audio
      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('name', name)
      formData.append('description', description)
      formData.append('language', language)

      const response = await fetch(`${this.baseUrl}/api/tts/clone`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Voice cloning failed: ${response.status} - ${error}`)
      }

      const result = await response.json()
      
      return {
        id: result.voice_id || `coqui_${Date.now()}`,
        name,
        description,
        model_path: result.model_path || '',
        speaker_wav_path: result.speaker_wav_path || '',
        language,
        created_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('Coqui voice cloning error:', error)
      throw error
    }
  }

  // Generate speech using cloned voice
  async generateSpeech(
    text: string,
    voiceModel: CoquiVoiceModel,
    options: Partial<CoquiSynthesisOptions> = {}
  ): Promise<ArrayBuffer> {
    try {
      const requestBody = {
        text,
        model_name: voiceModel.model_path || 'tts_models/en/ljspeech/tacotron2-DDC',
        speaker_wav: voiceModel.speaker_wav_path,
        language: voiceModel.language || 'en',
        speed: options.speed || 1.0,
        ...options
      }

      const response = await fetch(`${this.baseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Speech generation failed: ${response.status} - ${error}`)
      }

      return response.arrayBuffer()
    } catch (error) {
      console.error('Coqui speech generation error:', error)
      throw error
    }
  }

  // Generate speech with speaker similarity (voice cloning)
  async generateSpeechWithSpeaker(
    text: string,
    speakerWavFile: File,
    language: string = 'en'
  ): Promise<ArrayBuffer> {
    try {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('speaker_wav', speakerWavFile)
      formData.append('language', language)

      const response = await fetch(`${this.baseUrl}/api/tts/speaker-similarity`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Speaker similarity TTS failed: ${response.status} - ${error}`)
      }

      return response.arrayBuffer()
    } catch (error) {
      console.error('Coqui speaker similarity error:', error)
      throw error
    }
  }

  // Get server info and available models
  async getServerInfo(): Promise<{
    models: string[]
    languages: string[]
    speakers: string[]
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts/info`)
      if (!response.ok) throw new Error('Failed to get server info')
      
      return response.json()
    } catch (error) {
      console.error('Error getting Coqui server info:', error)
      return {
        models: [],
        languages: ['en'],
        speakers: []
      }
    }
  }

  // Setup instructions for Coqui TTS server
  static getSetupInstructions(): string {
    return `
To use Coqui TTS, you need to run the TTS server locally:

1. Install Coqui TTS:
   pip install TTS

2. Start the TTS server:
   tts-server --model_name tts_models/multilingual/multi-dataset/xtts_v2 --port 5002

3. The server will be available at http://localhost:5002

4. For voice cloning, use models that support speaker similarity like:
   - tts_models/multilingual/multi-dataset/xtts_v2
   - tts_models/en/vctk/vits

Alternative: Use Docker:
   docker run --rm -it -p 5002:5002 ghcr.io/coqui-ai/tts-cpu --model_name tts_models/multilingual/multi-dataset/xtts_v2
    `
  }
}

export const coquiTTSService = new CoquiTTSService()

// Utility functions for Coqui TTS
export const coquiUtils = {
  // Check if audio file is compatible with Coqui
  validateAudioForCoqui(file: File): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/flac', 'audio/ogg']

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 50MB for Coqui TTS' }
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File must be WAV, MP3, FLAC, or OGG for best results with Coqui' }
    }

    return { valid: true }
  },

  // Convert audio to WAV format (preferred by Coqui)
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    // This would require additional audio processing libraries
    // For now, return the original blob
    return audioBlob
  },

  // Get recommended models for voice cloning
  getRecommendedModels(): string[] {
    return [
      'tts_models/multilingual/multi-dataset/xtts_v2',
      'tts_models/en/vctk/vits',
      'tts_models/en/ljspeech/tacotron2-DDC',
      'tts_models/en/ljspeech/glow-tts'
    ]
  }
}
