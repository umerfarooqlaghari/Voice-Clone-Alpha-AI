import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voiceModelId, settings } = body

    if (!text || !voiceModelId) {
      return NextResponse.json(
        { error: 'Text and voice model ID are required' },
        { status: 400 }
      )
    }

    // Validate text length
    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text must be less than 5000 characters' },
        { status: 400 }
      )
    }

    console.log('Generating Coqui speech:', {
      text: text.substring(0, 100) + '...',
      voiceModelId,
      settings
    })

    // Check if Coqui TTS server is running
    let isServerRunning = false
    try {
      const response = await fetch('http://localhost:5002', { method: 'GET' })
      isServerRunning = response.ok
    } catch (error) {
      isServerRunning = false
    }

    if (!isServerRunning) {
      return NextResponse.json({
        error: 'Coqui TTS server not running',
        message: 'Please start the Coqui TTS server to generate speech'
      }, { status: 503 })
    }

    // Get voice model (in a real implementation, you'd fetch from database)
    // For now, we'll create a mock voice model
    const voiceModel = {
      id: voiceModelId,
      name: 'Coqui Voice',
      model_path: settings?.model || 'tts_models/multilingual/multi-dataset/xtts_v2',
      speaker_wav_path: settings?.speaker_wav_path || '',
      language: settings?.language || 'en'
    }

    try {
      // Generate speech using Coqui TTS server with form data
      const formData = new URLSearchParams()
      formData.append('text', text)

      const response = await fetch('http://localhost:5002/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Speech generation failed: ${response.status} - ${error}`)
      }

      const audioBuffer = await response.arrayBuffer()

      // Return audio data
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      })

    } catch (coquiError) {
      console.error('Coqui speech generation failed:', coquiError)
      
      // Return error with helpful message
      return NextResponse.json({
        error: 'Speech generation failed',
        details: coquiError instanceof Error ? coquiError.message : 'Unknown error',
        suggestion: 'Make sure the Coqui TTS server is running and the model is loaded'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Coqui speech generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech. Please try again.' },
      { status: 500 }
    )
  }
}

// Get available models and server status
export async function GET() {
  try {
    let isServerRunning = false
    try {
      const response = await fetch('http://localhost:5002', { method: 'GET' })
      isServerRunning = response.ok
    } catch (error) {
      isServerRunning = false
    }

    if (!isServerRunning) {
      return NextResponse.json({
        serverRunning: false,
        models: [],
        message: 'Coqui TTS server is not running'
      })
    }

    return NextResponse.json({
      serverRunning: true,
      models: ['tts_models/en/ljspeech/tacotron2-DDC'],
      message: 'Coqui TTS server is running and ready'
    })

  } catch (error) {
    console.error('Error checking Coqui server status:', error)
    return NextResponse.json({
      serverRunning: false,
      models: [],
      error: 'Failed to check server status'
    })
  }
}
