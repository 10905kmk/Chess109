import { useEffect, useRef, useState, useCallback } from 'react'

const STOCKFISH_PATH = '/stockfish/stockfish-nnue-16.js'

export function useStockfish({ depth = 15, skillLevel = 10 } = {}) {
  const workerRef = useRef(null)
  const resolveRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(STOCKFISH_PATH)
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg === 'uciok') {
        worker.postMessage('isready')
      } else if (msg === 'readyok') {
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`)
        setReady(true)
      } else if (msg.startsWith('bestmove') && resolveRef.current) {
        const parts = msg.split(' ')
        const move = parts[1]
        resolveRef.current(move === '(none)' ? null : move)
        resolveRef.current = null
      }
    }

    worker.postMessage('uci')

    return () => {
      worker.postMessage('quit')
      worker.terminate()
    }
  }, [skillLevel])

  const getBestMove = useCallback((fen) => {
    return new Promise((resolve) => {
      if (!workerRef.current || !ready) {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth}`)
    })
  }, [ready, depth])

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
  }, [])

  return { ready, getBestMove, stop }
}
