// Free speech synthesis using Web Speech API
// This provides a completely free alternative to paid TTS services

export interface VoiceProfile {
  id: string
  name: string
  description?: string
  settings: {
    rate: number
    pitch: number
    volume: number
    voiceName?: string
  }
  created_at: string
}

export interface SpeechSettings {
  rate?: number // 0.1 to 10
  pitch?: number // 0 to 2
  volume?: number // 0 to 1
  voiceName?: string
}

export class FreeSpeechService {
  private synth: SpeechSynthesis
  private voices: SpeechSynthesisVoice[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis
      this.loadVoices()
    }
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices()
    
    // If voices aren't loaded yet, wait for the event
    if (this.voices.length === 0) {
      this.synth.onvoiceschanged = () => {
        this.voices = this.synth.getVoices()
      }
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  // Create a voice profile based on recorded audio characteristics
  createVoiceProfile(name: string, description: string, audioBlob: Blob): Promise<VoiceProfile> {
    return new Promise((resolve) => {
      // Analyze the audio to determine best matching voice characteristics
      this.analyzeAudioForVoiceMatching(audioBlob).then((analysis) => {
        const voiceProfile: VoiceProfile = {
          id: `voice_${Date.now()}`,
          name,
          description,
          settings: {
            rate: analysis.rate,
            pitch: analysis.pitch,
            volume: analysis.volume,
            voiceName: analysis.bestMatchVoice
          },
          created_at: new Date().toISOString()
        }
        
        resolve(voiceProfile)
      })
    })
  }

  private async analyzeAudioForVoiceMatching(audioBlob: Blob): Promise<{
    rate: number
    pitch: number
    volume: number
    bestMatchVoice: string
  }> {
    // Simple analysis - in a real implementation, you'd use audio analysis
    // For now, we'll return reasonable defaults and pick a good voice
    
    const availableVoices = this.getAvailableVoices()
    
    // Prefer English voices
    const englishVoices = availableVoices.filter(voice => 
      voice.lang.startsWith('en') && !voice.name.includes('Google')
    )
    
    // Pick a natural-sounding voice
    let bestVoice = englishVoices.find(voice => 
      voice.name.includes('Natural') || 
      voice.name.includes('Enhanced') ||
      voice.name.includes('Premium')
    ) || englishVoices[0] || availableVoices[0]

    return {
      rate: 0.9, // Slightly slower for clarity
      pitch: 1.0, // Normal pitch
      volume: 0.8, // Slightly quieter
      bestMatchVoice: bestVoice?.name || 'default'
    }
  }

  generateSpeech(text: string, voiceProfile: VoiceProfile): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text)
      
      // Apply voice settings
      utterance.rate = voiceProfile.settings.rate
      utterance.pitch = voiceProfile.settings.pitch
      utterance.volume = voiceProfile.settings.volume
      
      // Find and set the voice
      if (voiceProfile.settings.voiceName) {
        const voice = this.voices.find(v => v.name === voiceProfile.settings.voiceName)
        if (voice) {
          utterance.voice = voice
        }
      }

      // Record the speech using Web Audio API
      this.recordSpeechSynthesis(utterance).then(resolve).catch(reject)
    })
  }

  private recordSpeechSynthesis(utterance: SpeechSynthesisUtterance): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create audio context for recording
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const destination = audioContext.createMediaStreamDestination()
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      const chunks: Blob[] = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        resolve(audioBlob)
      }
      
      mediaRecorder.onerror = reject
      
      // Start recording
      mediaRecorder.start()
      
      // Set up utterance events
      utterance.onend = () => {
        setTimeout(() => {
          mediaRecorder.stop()
          audioContext.close()
        }, 100) // Small delay to ensure all audio is captured
      }
      
      utterance.onerror = (event) => {
        mediaRecorder.stop()
        audioContext.close()
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }
      
      // Start speech synthesis
      this.synth.speak(utterance)
    })
  }

  // Simple text-to-speech without recording (for immediate playback)
  speak(text: string, settings: SpeechSettings = {}): void {
    if (!this.synth) return
    
    // Cancel any ongoing speech
    this.synth.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = settings.rate || 0.9
    utterance.pitch = settings.pitch || 1.0
    utterance.volume = settings.volume || 0.8
    
    if (settings.voiceName) {
      const voice = this.voices.find(v => v.name === settings.voiceName)
      if (voice) {
        utterance.voice = voice
      }
    }
    
    this.synth.speak(utterance)
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel()
    }
  }
}

export const freeSpeechService = new FreeSpeechService()
