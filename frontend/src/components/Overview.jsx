import React from 'react'
import {
  Database,
  Cpu,
  Layers,
  ShieldAlert,
  Server,
  FileSpreadsheet
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'

export default function Overview({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Memuat metrik analitik IoT...</span>
      </div>
    )
  }

  const { metrics, domain_distribution, attack_distribution } = data

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']

  const pipelineRows = [
    {
      module: 'Network Domain',
      features: 'duration, src/dst bytes, src/dst pkts, ip_bytes (23 CSV)',
      model: 'network_kmeans.pkl + network_iso.pkl'
    },
    {
      module: 'IoT Sensors Domain',
      features: 'temperature, humidity, pressure, fridge_temp, modbus (7 CSV)',
      model: 'iot_kmeans.pkl + iot_iso.pkl'
    },
    {
      module: 'Linux Host Domain',
      features: 'CPU, PRI, NICE, CPUNR, TRUN, TSLPI, MEM, VSIZE (6 CSV)',
      model: 'linux_kmeans.pkl + linux_iso.pkl'
    },
    {
      module: 'Windows Domain',
      features: 'Processor Time, Thread/Handle Count, Working Set, RAM (2 CSV)',
      model: 'windows_kmeans.pkl + windows_iso.pkl'
    },
    {
      module: 'Distributed Core',
      features: 'Apache Spark MLlib & Snappy Parquet terdistribusi',
      model: 'Evaluasi Silhouette (0.9806)'
    },
    {
      module: 'Graph Topology',
      features: 'Neo4j AuraDB & NetworkX Topology Hierarkis',
      model: 'Degree, Betweenness, PageRank'
    }
  ]

  return (
    <div className="content-body">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Telemetry Records</span>
            <div className="metric-icon-wrap">
              <Database size={16} />
            </div>
          </div>
          <div className="metric-value">
            {metrics?.total_records?.toLocaleString() || 0}
          </div>
          <div className="metric-delta success">Dataset 38 File CSV</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-label">Perangkat & Host Aktif</span>
            <div className="metric-icon-wrap">
              <Cpu size={16} />
            </div>
          </div>
          <div className="metric-value">{metrics?.active_devices || 0} Nodes</div>
          <div className="metric-delta success">Heterogen Multidomain</div>
        </div>

        <div className="metric-card amber">
          <div className="metric-header">
            <span className="metric-label">Dataset Sources</span>
            <div className="metric-icon-wrap">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <div className="metric-value">{metrics?.total_csv_sources || 38} File</div>
          <div className="metric-delta success">IoT, Linux, Net, Win</div>
        </div>

        <div className="metric-card rose">
          <div className="metric-header">
            <span className="metric-label">Anomaly Rate</span>
            <div className="metric-icon-wrap">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="metric-value">{metrics?.anomaly_rate || 0}%</div>
          <div className="metric-delta danger">
            {metrics?.anomaly_count?.toLocaleString() || 0} insiden terdeteksi
          </div>
        </div>
      </div>

      <div className="charts-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <ShieldAlert size={17} />
                <span>Distribusi Kategori Serangan & Anomali</span>
              </div>
              <div className="card-subtitle">
                Frekuensi insiden anomali berdasarkan label jenis serangan riil
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attack_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="attack_type" stroke="#6b7280" fontSize={11} tickLine={false} />
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

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Server size={17} />
                <span>Distribusi Data Berdasarkan Domain</span>
              </div>
              <div className="card-subtitle">
                Proporsi rekaman per sektor arsitektur sistem
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={domain_distribution}
                  dataKey="count"
                  nameKey="domain"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                >
                  {domain_distribution?.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Server size={17} />
              <span>Multidomain Architecture & Monitoring Overview</span>
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: '#9ca3af', lineHeight: 1.7 }}>
            Sistem IoT multidomain memproses dan memantau telemetri heterogen dari sensor fisik (IoT),
            layanan host (Linux), aliran lalu lintas jaringan (Network), dan workstation pengguna (Windows).
            Setiap domain dimonitor menggunakan struktur fitur aslinya masing-masing, dilatih secara independen
            menggunakan algoritma K-Means dan Isolation Forest, serta diintegrasikan ke dalam topologi graf Neo4j
            untuk deteksi anomali komprehensif.
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={17} />
              <span>Komponen Pipeline & Model Status</span>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain / Modul</th>
                  <th>Fitur Asli yang Dimonitor</th>
                  <th>Model Machine Learning</th>
                </tr>
              </thead>
              <tbody>
                {pipelineRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{row.module}</td>
                    <td style={{ color: '#9ca3af' }}>{row.features}</td>
                    <td>
                      <span className="badge badge-normal">{row.model}</span>
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
