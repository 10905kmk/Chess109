import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VARIANTS } from '../variants/index.js'
import styles from './VariantSelectPage.module.css'

const PLAY_MODES = [
  { id: 'local', label: '로컬 2인', icon: '♟', description: '같은 화면에서 번갈아 두기' },
  { id: 'ai',    label: 'AI 대전',  icon: '🤖', description: 'Fairy-Stockfish와 대결' },
  { id: 'online',label: '친선전',   icon: '🤝', description: '방 코드로 친구와 대전' },
]

export default function VariantSelectPage() {
  const navigate = useNavigate()
  const [selectedVariant, setSelectedVariant] = useState(null)

  const handleModeSelect = (modeId) => {
    if (!selectedVariant) return
    const variant = VARIANTS.find(v => v.id === selectedVariant)
    if (modeId === 'ai' && variant?.aiType === null) return
    navigate(`/variant/${selectedVariant}/${modeId}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.title}>변형체스</h2>
        <div />
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>1단계: 변형 선택</h3>
        <div className={styles.grid}>
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              className={`${styles.card} ${selectedVariant === v.id ? styles.selected : ''}`}
              style={{ '--card-color': v.color }}
              onClick={() => setSelectedVariant(v.id)}
            >
              <span className={styles.icon}>{v.icon}</span>
              <div>
                <div className={styles.cardTitle}>{v.label}</div>
                <div className={styles.cardDesc}>{v.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedVariant && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>2단계: 플레이 방식</h3>
          <div className={styles.modeGrid}>
            {PLAY_MODES.map((mode) => {
              const variant = VARIANTS.find(v => v.id === selectedVariant)
              const disabled = mode.id === 'ai' && variant?.aiType === null
              return (
                <button
                  key={mode.id}
                  className={`${styles.modeCard} ${disabled ? styles.disabled : ''}`}
                  onClick={() => handleModeSelect(mode.id)}
                  disabled={disabled}
                  title={disabled ? 'AI 미지원 변형' : undefined}
                >
                  <span className={styles.modeIcon}>{mode.icon}</span>
                  <div className={styles.modeLabel}>{mode.label}</div>
                  <div className={styles.modeDesc}>{disabled ? 'AI 미지원' : mode.description}</div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
