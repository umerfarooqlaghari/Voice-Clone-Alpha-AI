import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    console.log('Creating Coqui voice clone:', {
      name,
      description,
      audioFileName: audioFile.name,
      audioFileType: audioFile.type,
      audioFileSize: audioFile.size
    })

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'voices')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save the audio file
    const timestamp = Date.now()
    const fileExtension = audioFile.name.split('.').pop() || 'webm'
    const fileName = `voice_${timestamp}.${fileExtension}`
    const filePath = join(uploadsDir, fileName)

    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create voice model
    const voiceModel = {
      id: `coqui_${timestamp}`,
      name,
      description: description || `Coqui voice clone: ${name}`,
      voice_id: `coqui_${timestamp}`,
      audio_file_path: `/uploads/voices/${fileName}`,
      created_at: new Date().toISOString(),
      type: 'coqui'
    }

    console.log('Voice clone created successfully:', voiceModel)

    return NextResponse.json({
      success: true,
      voiceModel,
      message: 'Voice clone created successfully! You can now use this voice to generate speech.'
    })

  } catch (error) {
    console.error('Voice cloning error:', error)
    return NextResponse.json(
      { error: 'Failed to create voice clone. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Check if Coqui TTS server is running via proxy
    let serverRunning = false
    try {
      const response = await fetch('http://localhost:3001/api/tts?text=test', {
        method: 'GET'
      })
      serverRunning = response.ok || response.status === 200
    } catch (error) {
      serverRunning = false
    }

    return NextResponse.json({
      success: true,
      voiceModels: [], // Voice models are stored in localStorage on frontend
      serverRunning,
      message: serverRunning ? 'Coqui TTS server is ready for voice cloning' : 'Coqui TTS server not accessible'
    })

  } catch (error) {
    console.error('Error checking Coqui server:', error)
    return NextResponse.json({
      success: true,
      voiceModels: [],
      serverRunning: false,
      message: 'Unable to check Coqui TTS server status'
    })
  }
}


