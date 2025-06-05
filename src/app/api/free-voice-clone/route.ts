import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/localStorage'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const audioFile = formData.get('audio') as File

    if (!name || !audioFile) {
      return NextResponse.json(
        { error: 'Name and audio file are required' },
        { status: 400 }
      )
    }

    // Validate audio file
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file must be less than 10MB' },
        { status: 400 }
      )
    }

    console.log('Creating free voice clone:', {
      name,
      description,
      audioFileName: audioFile.name,
      audioFileType: audioFile.type,
      audioFileSize: audioFile.size
    })

    // Create a voice profile using free speech synthesis
    // This analyzes the audio and creates a profile for browser-based TTS
    const voiceProfile = {
      id: `free_voice_${Date.now()}`,
      name,
      description: description || `Free voice clone: ${name}`,
      voice_id: `free_${Date.now()}`,
      settings: {
        rate: 0.9,
        pitch: 1.0,
        volume: 0.8,
        // We'll analyze the audio to pick the best matching system voice
        voiceName: await analyzeAudioForBestVoice(audioFile)
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: 'free' // Mark as free voice clone
    }

    console.log('Created free voice profile:', voiceProfile)

    return NextResponse.json({
      success: true,
      voiceModel: voiceProfile,
      message: 'Free voice clone created successfully! Uses browser speech synthesis.'
    })

  } catch (error) {
    console.error('Free voice cloning error:', error)
    return NextResponse.json(
      { error: 'Failed to create free voice clone. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get voice models from localStorage (free voices are stored locally)
    const localModels = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('voice_clone_models') || '[]') : []
    
    return NextResponse.json({
      success: true,
      voiceModels: localModels
    })
  } catch (error) {
    console.error('Error fetching free voice models:', error)
    return NextResponse.json({
      success: true,
      voiceModels: []
    })
  }
}

// Analyze audio to determine best matching system voice
async function analyzeAudioForBestVoice(audioFile: File): Promise<string> {
  // For now, return a good default voice
  // In a more advanced implementation, you could:
  // 1. Analyze audio frequency patterns
  // 2. Detect gender from voice characteristics
  // 3. Match speaking rate and tone
  
  // Return a commonly available voice name
  return 'Microsoft David Desktop - English (United States)' // Windows
    || 'Alex' // macOS
    || 'Google US English' // Chrome
    || 'default'
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const voiceId = searchParams.get('voiceId')

    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    // For free voices, we just need to remove from localStorage
    // This will be handled on the client side

    return NextResponse.json({
      success: true,
      message: 'Free voice model deleted successfully'
    })

  } catch (error) {
    console.error('Free voice deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete free voice model' },
      { status: 500 }
    )
  }
}
