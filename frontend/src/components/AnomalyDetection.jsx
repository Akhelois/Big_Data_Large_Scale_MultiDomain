import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import { AlertTriangle, ShieldCheck, ListOrdered, Filter } from 'lucide-react'

export default function AnomalyDetection() {
  const [selectedDomain, setSelectedDomain] = useState('Network')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/anomalies?domain=${selectedDomain.toLowerCase()}`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedDomain])

  if (loading || !data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Memuat deteksi anomali fitur asli domain {selectedDomain}...</span>
      </div>
    )
  }

  const { total_anomalies_domain, domain_counts, attack_breakdown, scatter, logs } = data

  const normalPoints = scatter?.filter((p) => p.status === 'Normal') || []
  const anomalyPoints = scatter?.filter((p) => p.status === 'Anomaly') || []

  const xLabel = scatter?.[0]?.x_label || 'Parameter X'
  const yLabel = scatter?.[0]?.y_label || 'Parameter Y'

  return (
    <div className="content-body">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Filter size={17} />
              <span>Pilih Domain untuk Analisis Anomali Fitur Asli</span>
            </div>
            <div className="card-subtitle">
              Pemeriksaan anomali dan klasifikasi serangan menggunakan atribut riil per dataset
            </div>
          </div>
          <div>
            <select
              className="filter-select"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              <option value="Network">Network Domain (NetFlow)</option>
              <option value="IoT">IoT Sensor Domain (Weather & Fridge)</option>
              <option value="Linux">Linux Host Domain (CPU & PRI)</option>
              <option value="Windows">Windows Domain (Handles & CPU)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card rose">
          <div className="metric-header">
            <span className="metric-label">Anomali Terdeteksi ({selectedDomain})</span>
            <AlertTriangle size={16} color="#f43f5e" />
          </div>
          <div className="metric-value">{total_anomalies_domain.toLocaleString()}</div>
          <div className="metric-delta danger">Isolation Forest / Ground Truth</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-label">Model Anomali Domain</span>
            <ShieldCheck size={16} color="#10b981" />
          </div>
          <div className="metric-value">{selectedDomain.toLowerCase()}_iso.pkl</div>
          <div className="metric-delta success">Contamination: 0.05</div>
        </div>
      </div>

      <div className="charts-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <AlertTriangle size={17} />
                <span>Distribusi Anomali: {xLabel} vs {yLabel}</span>
              </div>
              <div className="card-subtitle">
                Pola transmisi normal vs anomali pada fitur asli domain {selectedDomain}
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="x" name={xLabel} stroke="#6b7280" fontSize={11} />
                <YAxis type="number" dataKey="y" name={yLabel} stroke="#6b7280" fontSize={11} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Scatter name="Normal" data={normalPoints} fill="#3b82f6" opacity={0.5} />
                <Scatter name="Anomaly / Attack" data={anomalyPoints} fill="#f43f5e" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <span>Distribusi Kategori Serangan ({selectedDomain})</span>
              </div>
              <div className="card-subtitle">
                Frekuensi insiden anomali berdasarkan jenis serangan riil
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attack_breakdown} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="type" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <Bar dataKey="count" name="Jumlah Kasus" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ListOrdered size={17} />
            <span>Log Telemetri Anomali Riil ({selectedDomain})</span>
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Domain</th>
                <th>Device</th>
                <th>Jenis Anomali / Serangan</th>
                <th>Atribut Fitur 1</th>
                <th>Atribut Fitur 2</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.timestamp}</td>
                  <td>{row.domain}</td>
                  <td>{row.device}</td>
                  <td>
                    <span className="badge badge-anomaly">{row.type}</span>
                  </td>
                  <td>{row.metric_1}</td>
                  <td>{row.metric_2}</td>
                  <td>
                    <span className="badge badge-anomaly">{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
