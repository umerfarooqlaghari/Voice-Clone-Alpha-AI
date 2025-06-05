'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Download, Volume2 } from 'lucide-react'

interface FreeSpeechGeneratorProps {
  text: string
  voiceSettings: {
    rate: number
    pitch: number
    volume: number
    voiceName?: string
  }
  onAudioGenerated?: (audioBlob: Blob) => void
}

export default function FreeSpeechGenerator({
  text,
  voiceSettings,
  onAudioGenerated
}: FreeSpeechGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [error, setError] = useState<string | null>(null)

  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      loadVoices()
    }
  }, [])

  const loadVoices = () => {
    if (!synthRef.current) return

    const voices = synthRef.current.getVoices()
    setAvailableVoices(voices)

    // If voices aren't loaded yet, wait for the event
    if (voices.length === 0) {
      synthRef.current.onvoiceschanged = () => {
        setAvailableVoices(synthRef.current!.getVoices())
      }
    }
  }

  const generateSpeech = async () => {
    if (!synthRef.current || !text.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = voiceSettings.rate
      utterance.pitch = voiceSettings.pitch
      utterance.volume = voiceSettings.volume

      // Find and set the voice
      if (voiceSettings.voiceName) {
        const voice = availableVoices.find(v => 
          v.name === voiceSettings.voiceName || 
          v.name.includes(voiceSettings.voiceName!)
        )
        if (voice) {
          utterance.voice = voice
        }
      }

      // Record the speech
      const audioBlob = await recordSpeechSynthesis(utterance)
      
      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      const newAudioUrl = URL.createObjectURL(audioBlob)
      setAudioBlob(audioBlob)
      setAudioUrl(newAudioUrl)
      onAudioGenerated?.(audioBlob)

    } catch (err) {
      console.error('Speech generation failed:', err)
      setError('Failed to generate speech. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const recordSpeechSynthesis = (utterance: SpeechSynthesisUtterance): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
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
          audioContext.close()
          resolve(audioBlob)
        }
        
        mediaRecorder.onerror = (event) => {
          audioContext.close()
          reject(new Error('Recording failed'))
        }
        
        // Start recording
        mediaRecorder.start()
        
        // Set up utterance events
        utterance.onend = () => {
          setTimeout(() => {
            mediaRecorder.stop()
          }, 100) // Small delay to ensure all audio is captured
        }
        
        utterance.onerror = (event) => {
          mediaRecorder.stop()
          reject(new Error(`Speech synthesis error: ${event.error}`))
        }
        
        // Start speech synthesis
        synthRef.current!.speak(utterance)
        
      } catch (err) {
        reject(err)
      }
    })
  }

  const playAudio = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const downloadAudio = () => {
    if (!audioBlob) return

    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `free-voice-clone-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const speakDirectly = () => {
    if (!synthRef.current) return

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = voiceSettings.rate
    utterance.pitch = voiceSettings.pitch
    utterance.volume = voiceSettings.volume

    if (voiceSettings.voiceName) {
      const voice = availableVoices.find(v => 
        v.name === voiceSettings.voiceName || 
        v.name.includes(voiceSettings.voiceName!)
      )
      if (voice) {
        utterance.voice = voice
      }
    }

    synthRef.current.speak(utterance)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={generateSpeech}
          disabled={isGenerating || !text.trim()}
          className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              <span>Generate & Record</span>
            </>
          )}
        </button>

        <button
          onClick={speakDirectly}
          disabled={!text.trim()}
          className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          <span>Speak Now</span>
        </button>
      </div>

      {audioUrl && (
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={playAudio}
                className="btn-secondary flex items-center space-x-2"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <div className="text-sm text-gray-400">
                Free speech generated
              </div>
            </div>

            <button
              onClick={downloadAudio}
              className="btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      <div className="text-xs text-gray-500">
        💡 This uses your browser's built-in speech synthesis - completely free!
      </div>
    </div>
  )
}
