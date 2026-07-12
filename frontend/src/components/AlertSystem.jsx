import { AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react'

const ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  critical: AlertOctagon
}

export default function AlertSystem({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.priority] || Info
        return (
          <div key={toast.id} className={`toast ${toast.priority}`}>
            <Icon className="toast-icon" />
            <span className="toast-text">{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
