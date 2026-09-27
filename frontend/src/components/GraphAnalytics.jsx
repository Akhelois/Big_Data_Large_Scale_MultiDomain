import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import { GitFork, Activity, CheckCircle2, AlertCircle } from 'lucide-react'

export default function GraphAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/graph')
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
        <span>Memuat topologi relasi graf Neo4j...</span>
      </div>
    )
  }

  const { is_neo4j_live, nodes, links, centrality_top } = data

  const svgWidth = 800
  const svgHeight = 360

  const nodePositions = {}
  const domainNodes = nodes?.filter((n) => n.group === 'domain') || []
  const regionNodes = nodes?.filter((n) => n.group === 'region') || []
  const deviceNodes = nodes?.filter((n) => n.group === 'device') || []

  domainNodes.forEach((n, i) => {
    const x = 700
    const y = 60 + i * ((svgHeight - 120) / Math.max(1, domainNodes.length - 1))
    nodePositions[n.id] = { x, y }
  })

  regionNodes.forEach((n, i) => {
    const x = 400
    const y = 50 + i * ((svgHeight - 100) / Math.max(1, regionNodes.length - 1))
    nodePositions[n.id] = { x, y }
  })

  deviceNodes.slice(0, 16).forEach((n, i) => {
    const x = 100
    const y = 30 + i * ((svgHeight - 60) / Math.max(1, Math.min(deviceNodes.length, 16) - 1))
    nodePositions[n.id] = { x, y }
  })

  const getNodeColor = (grp) => {
    if (grp === 'domain') return '#f43f5e'
    if (grp === 'region') return '#f59e0b'
    return '#3b82f6'
  }

  return (
    <div className="content-body">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <GitFork size={17} />
              <span>Topologi Relasi Hierarkis (Device -&gt; Region -&gt; Domain)</span>
            </div>
            <div className="card-subtitle">
              Struktur alur telemetri edge gateway dan host cluster
            </div>
          </div>
          <div>
            {is_neo4j_live ? (
              <span className="badge badge-normal">
                <CheckCircle2 size={12} />
                <span>Neo4j AuraDB Terhubung</span>
              </span>
            ) : (
              <span className="badge badge-anomaly">
                <AlertCircle size={12} />
                <span>Topologi Lokal Terverifikasi</span>
              </span>
            )}
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 12 }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', minWidth: 600, height: svgHeight }}>
            {links?.map((link, idx) => {
              const src = nodePositions[link.source]
              const tgt = nodePositions[link.target]
              if (!src || !tgt) return null
              return (
                <line
                  key={idx}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1}
                />
              )
            })}

            {Object.keys(nodePositions).map((nodeId) => {
              const pos = nodePositions[nodeId]
              const n = nodes.find((item) => item.id === nodeId)
              if (!n) return null
              const col = getNodeColor(n.group)
              return (
                <g key={nodeId}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={n.group === 'domain' ? 9 : n.group === 'region' ? 7 : 5}
                    fill={col}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={pos.x + (n.group === 'domain' ? 12 : n.group === 'region' ? -10 : -10)}
                    y={pos.y + 4}
                    textAnchor={n.group === 'domain' ? 'start' : 'end'}
                    fill="#e5e7eb"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                  >
                    {n.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Activity size={17} />
              <span>Top 15 Node Berdasarkan Analisis Centrality</span>
            </div>
            <div className="card-subtitle">
              Perbandingan Degree, Betweenness, dan PageRank
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={centrality_top} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={10} angle={-35} textAnchor="end" interval={0} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar dataKey="degree" name="Degree Centrality" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="betweenness" name="Betweenness" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pagerank" name="PageRank" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
