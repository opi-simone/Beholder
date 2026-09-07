import type { JSX, ReactNode } from 'react'

type Props = {
  title: string
  showMinimize?: boolean
  showMaximize?: boolean
  onClose?: () => void
  actions?: ReactNode
}

export default function TitleBar({
  title,
  showMinimize = true,
  showMaximize = true,
  onClose,
  actions
}: Props): JSX.Element {
  const handleClose = (): void => {
    if (onClose) onClose()
    else void window.beholder.closeWindow()
  }

  return (
    <header className="titlebar drag">
      <div className="titlebar-title">{title}</div>
      <div className="titlebar-controls no-drag">
        {actions}
        {showMinimize && (
          <button type="button" className="titlebar-btn" aria-label="Riduci" onClick={() => void window.beholder.minimize()}>
            ─
          </button>
        )}
        {showMaximize && (
          <button type="button" className="titlebar-btn" aria-label="Ingrandisci" onClick={() => void window.beholder.maximize()}>
            □
          </button>
        )}
        <button type="button" className="titlebar-btn titlebar-close" aria-label="Chiudi" onClick={handleClose}>
          ✕
        </button>
      </div>
    </header>
  )
}
