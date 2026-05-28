import styles from './GameStatus.module.css'

export default function GameStatus({ turn, isCheck, isCheckmate, isDraw, isGameOver, onReset }) {
  let message = null
  let type = 'info'

  if (isCheckmate) {
    const winner = turn === 'w' ? '흑' : '백'
    message = `체크메이트! ${winner}이 승리했습니다`
    type = 'end'
  } else if (isDraw) {
    message = '무승부!'
    type = 'end'
  } else if (isCheck) {
    message = `${turn === 'w' ? '백' : '흑'} 체크!`
    type = 'check'
  } else {
    message = `${turn === 'w' ? '백' : '흑'}의 차례`
    type = 'turn'
  }

  return (
    <div className={`${styles.container} ${styles[type]}`}>
      <div className={styles.indicator}>
        <span className={`${styles.dot} ${turn === 'w' ? styles.white : styles.black}`} />
        <span className={styles.message}>{message}</span>
      </div>
      {isGameOver && (
        <button className={styles.resetBtn} onClick={onReset}>
          새 게임
        </button>
      )}
    </div>
  )
}
