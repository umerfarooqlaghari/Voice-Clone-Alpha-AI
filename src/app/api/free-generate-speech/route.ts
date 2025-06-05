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

    console.log('Generating free speech:', {
      text: text.substring(0, 100) + '...',
      voiceModelId,
      settings
    })

    // Since we're using client-side Web Speech API, we'll return instructions
    // for the client to generate the speech
    const speechConfig = {
      text,
      voiceSettings: {
        rate: settings?.rate || 0.9,
        pitch: settings?.pitch || 1.0,
        volume: settings?.volume || 0.8,
        voiceName: settings?.voiceName || 'default'
      },
      voiceModelId
    }

    // Return configuration for client-side speech generation
    return NextResponse.json({
      success: true,
      speechConfig,
      message: 'Speech configuration ready for client-side generation',
      type: 'client-side'
    })

  } catch (error) {
    console.error('Free speech generation error:', error)
    return NextResponse.json(
      { error: 'Failed to prepare speech generation. Please try again.' },
      { status: 500 }
    )
  }
}

// Alternative endpoint that generates a simple audio response
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const text = searchParams.get('text')
    const voiceId = searchParams.get('voiceId')

    if (!text) {
      return NextResponse.json(
        { error: 'Text parameter is required' },
        { status: 400 }
      )
    }

    // For demo purposes, return a simple text response that can be read by screen readers
    // In a real implementation, you might use a server-side TTS library
    const demoMessage = `Free TTS Demo: "${text}". This would be spoken using the voice model ${voiceId || 'default'}.`
    
    return new NextResponse(demoMessage, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': demoMessage.length.toString(),
      },
    })

  } catch (error) {
    console.error('Free speech generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}
