import React from 'react'
import {
  LayoutDashboard,
  Activity,
  Cpu,
  Share2,
  GitFork,
  AlertTriangle,
  Radio,
  FileSpreadsheet
} from 'lucide-react'

export default function Sidebar({ activePage, setActivePage, backendStatus }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitoring', label: 'System Monitoring', icon: Activity },
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
    { id: 'domain_features', label: 'Domain Features (Asli)', icon: Cpu },
    { id: 'clustering', label: 'Cluster Analysis (Spark)', icon: Share2 },
    { id: 'graph', label: 'Graph Analytics (Neo4j)', icon: GitFork },
    { id: 'prediction', label: 'Live Telemetry Prediction', icon: Radio },
    { id: 'explorer', label: 'Data Explorer (CSV)', icon: FileSpreadsheet }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <Activity size={20} />
        </div>
        <div>
          <div className="brand-title">IoT Multidomain</div>
          <div className="brand-subtitle">Monitoring & Anomaly System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Modul Analisis</div>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="status-badge">
          <span className={`status-dot ${backendStatus ? 'online' : 'offline'}`} />
          <span>Backend API: {backendStatus ? 'Online (:8000)' : 'Connecting...'}</span>
        </div>
        <div>Fitur: Parameter Asli (No 4V)</div>
        <div>Core: Spark MLlib & Isolation Forest</div>
        <div>Dataset: 38 File CSV Multidomain</div>
      </div>
    </aside>
  )
}
