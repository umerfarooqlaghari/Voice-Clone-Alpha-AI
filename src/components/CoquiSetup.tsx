'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, CheckCircle, XCircle, RefreshCw, ExternalLink, Copy } from 'lucide-react'

interface CoquiSetupProps {
  onServerReady?: () => void
}

export default function CoquiSetup({ onServerReady }: CoquiSetupProps) {
  const [serverStatus, setServerStatus] = useState<'checking' | 'running' | 'stopped'>('checking')
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    checkServerStatus()
    const interval = setInterval(checkServerStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/coqui-generate-speech')
      const data = await response.json()
      
      if (data.serverRunning) {
        setServerStatus('running')
        onServerReady?.()
      } else {
        setServerStatus('stopped')
      }
    } catch (error) {
      setServerStatus('stopped')
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const installCommands = [
    {
      id: 'install',
      title: 'Install Coqui TTS',
      command: 'pip install TTS',
      description: 'Install the Coqui TTS library'
    },
    {
      id: 'server',
      title: 'Start TTS Server',
      command: 'tts-server --model_name tts_models/multilingual/multi-dataset/xtts_v2 --port 5002',
      description: 'Start the server with voice cloning model'
    },
    {
      id: 'docker',
      title: 'Alternative: Docker',
      command: 'docker run --rm -it -p 5002:5002 ghcr.io/coqui-ai/tts-cpu --model_name tts_models/multilingual/multi-dataset/xtts_v2',
      description: 'Run using Docker (easier setup)'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center">
            <Terminal className="w-5 h-5 mr-2 text-blue-400" />
            Coqui TTS Server Status
          </h3>
          <button
            onClick={checkServerStatus}
            className="btn-secondary flex items-center space-x-2"
            disabled={serverStatus === 'checking'}
          >
            <RefreshCw className={`w-4 h-4 ${serverStatus === 'checking' ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          {serverStatus === 'running' ? (
            <>
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <div className="text-green-400 font-medium">Server Running</div>
                <div className="text-sm text-gray-400">Coqui TTS is ready for voice cloning</div>
              </div>
            </>
          ) : serverStatus === 'stopped' ? (
            <>
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <div className="text-red-400 font-medium">Server Not Running</div>
                <div className="text-sm text-gray-400">Please start the Coqui TTS server</div>
              </div>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
              <div>
                <div className="text-blue-400 font-medium">Checking...</div>
                <div className="text-sm text-gray-400">Verifying server status</div>
              </div>
            </>
          )}
        </div>

        {serverStatus === 'stopped' && (
          <div className="mt-4">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="btn-primary flex items-center space-x-2"
            >
              <Terminal className="w-4 h-4" />
              <span>{showInstructions ? 'Hide' : 'Show'} Setup Instructions</span>
            </button>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card"
          >
            <h3 className="text-xl font-semibold mb-4">Setup Coqui TTS</h3>
            
            <div className="space-y-6">
              {installCommands.map((cmd, index) => (
                <div key={cmd.id} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <h4 className="font-medium">{cmd.title}</h4>
                  </div>
                  
                  <p className="text-sm text-gray-400 ml-8">{cmd.description}</p>
                  
                  <div className="ml-8 relative">
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                      <code className="text-green-400">{cmd.command}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(cmd.command, cmd.id)}
                      className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
                      title="Copy command"
                    >
                      {copied === cmd.id ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <h4 className="font-medium text-blue-300 mb-2">📝 Notes:</h4>
              <ul className="text-sm text-blue-200 space-y-1">
                <li>• The server will download the model on first run (~1.5GB)</li>
                <li>• Make sure you have Python 3.8+ installed</li>
                <li>• The server runs on port 5002 by default</li>
                <li>• Voice cloning works best with 10-30 seconds of clear audio</li>
              </ul>
            </div>

            <div className="mt-4 flex items-center space-x-4">
              <a
                href="https://docs.coqui.ai/en/latest/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Coqui Documentation</span>
              </a>
              
              <a
                href="https://github.com/coqui-ai/TTS"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Benefits */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Why Coqui TTS?</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium">100% Free & Open Source</div>
                <div className="text-sm text-gray-400">No API costs or usage limits</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium">High Quality Voice Cloning</div>
                <div className="text-sm text-gray-400">State-of-the-art neural models</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium">Privacy Focused</div>
                <div className="text-sm text-gray-400">Runs locally on your machine</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <div className="font-medium">Multiple Languages</div>
                <div className="text-sm text-gray-400">Supports 17+ languages</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
