import { useEffect, useRef, useState, useCallback } from 'react'

const FAIRY_STOCKFISH_PATH = '/fairy-stockfish/fairy-stockfish.js'

export function useFairyStockfish({ uciVariant, uciChess960 = false, depth = 12, skillLevel = 5 } = {}) {
  const workerRef = useRef(null)
  const resolveRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(FAIRY_STOCKFISH_PATH)
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : e.data?.toString?.() ?? ''
      if (msg === 'uciok') {
        if (uciVariant) worker.postMessage(`setoption name UCI_Variant value ${uciVariant}`)
        if (uciChess960) worker.postMessage('setoption name UCI_Chess960 value true')
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
      resolveRef.current?.(null)
      resolveRef.current = null
      setReady(false)
      worker.postMessage('quit')
      worker.terminate()
    }
  }, [uciVariant, uciChess960, skillLevel])

  const getBestMove = useCallback((fen) => {
    return new Promise((resolve) => {
      if (!workerRef.current || !ready) { resolve(null); return }
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
