import styles from './MoveHistory.module.css'

export default function MoveHistory({ history }) {
  const pairs = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ number: Math.floor(i / 2) + 1, white: history[i], black: history[i + 1] })
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>기보</h3>
      <div className={styles.list}>
        {pairs.length === 0 && (
          <p className={styles.empty}>아직 이동이 없습니다</p>
        )}
        {pairs.map(({ number, white, black }) => (
          <div key={number} className={styles.pair}>
            <span className={styles.number}>{number}.</span>
            <span className={styles.move}>{white?.san}</span>
            <span className={styles.move}>{black?.san ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
