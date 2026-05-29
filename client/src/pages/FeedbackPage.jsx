import { useNavigate } from 'react-router-dom'
import styles from './FeedbackPage.module.css'

const TO = 'kimjy0905@gmail.com'

export default function FeedbackPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.pageTitle}>건의하기</h2>
        <div />
      </header>

      <div className={styles.content}>
        <div className={styles.card}>
          <p className={styles.desc}>
            버그 제보, 기능 제안, 기타 의견이 있으시면 아래 이메일로 보내주세요.
          </p>
          <div className={styles.emailBox}>
            <span className={styles.email}>{TO}</span>
          </div>
          <p className={styles.hint}>
            제목에 <strong>[Chess109]</strong> 를 붙여주시면 확인이 빠릅니다.
          </p>
        </div>
      </div>
    </div>
  )
}
