import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import { Share2, CheckCircle, Cpu, Table } from 'lucide-react'

export default function ClusterAnalysis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clustering')
      .then((res) => res.json())
      .then((resData) => {
        setData(resData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Memuat hasil K-Means Clustering Spark MLlib...</span>
      </div>
    )
  }

  const { silhouette_score, k, profiles, points } = data

  const c0Points = points?.filter((p) => p.cluster === 0) || []
  const c1Points = points?.filter((p) => p.cluster === 1) || []
  const c2Points = points?.filter((p) => p.cluster === 2) || []

  return (
    <div className="content-body">
      <div className="metrics-grid">
        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-label">Silhouette Evaluation</span>
            <CheckCircle size={16} color="#10b981" />
          </div>
          <div className="metric-value">{silhouette_score}</div>
          <div className="metric-delta success">Optimal Clustering Index</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Cluster Count (k)</span>
            <Share2 size={16} />
          </div>
          <div className="metric-value">{k} Kluster</div>
          <div className="metric-delta success">Spark MLlib Partitioned</div>
        </div>

        <div className="metric-card amber">
          <div className="metric-header">
            <span className="metric-label">Distributed Engine</span>
            <Cpu size={16} />
          </div>
          <div className="metric-value">Spark MLlib</div>
          <div className="metric-delta success">Fitur Asli NetFlow & Host</div>
        </div>
      </div>

      <div className="charts-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Share2 size={17} />
                <span>Distribusi Kluster: Source Bytes vs Packets Count</span>
              </div>
              <div className="card-subtitle">
                Segmentasi status operasional sistem berdasarkan laju throughput dan transmisi riil
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="x" name="Source Bytes" stroke="#6b7280" fontSize={11} />
                <YAxis type="number" dataKey="y" name="Packets Count" stroke="#6b7280" fontSize={11} />
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
                <Scatter name="Cluster 0 - Low / Idle" data={c0Points} fill="#10b981" opacity={0.65} />
                <Scatter name="Cluster 1 - Moderate Load" data={c1Points} fill="#f59e0b" opacity={0.65} />
                <Scatter name="Cluster 2 - High Burst" data={c2Points} fill="#f43f5e" opacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Table size={17} />
              <span>Profil Kluster Operasional Sistem</span>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kluster</th>
                  <th>Deskripsi Status</th>
                  <th>Estimasi Rekaman</th>
                </tr>
              </thead>
              <tbody>
                {profiles?.map((prof, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${prof.badge}`}>{prof.label}</span>
                    </td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>{prof.description}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {prof.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
