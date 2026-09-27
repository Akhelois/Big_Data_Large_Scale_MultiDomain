import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import {
  Activity,
  Cpu,
  Thermometer,
  Network,
  Monitor,
  HardDrive
} from 'lucide-react'

export default function SystemMonitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/monitoring')
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
        <span>Memuat data monitoring sistem multidomain...</span>
      </div>
    )
  }

  const { iot, linux, network, windows, timeline } = data

  return (
    <div className="content-body">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Linux CPU Load</span>
            <div className="metric-icon-wrap">
              <Cpu size={16} />
            </div>
          </div>
          <div className="metric-value">{linux.avg_cpu}%</div>
          <div className="metric-delta success">PRI: {linux.avg_pri} | MEM: {linux.avg_mem}%</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-header">
            <span className="metric-label">IoT Sensor Suhu</span>
            <div className="metric-icon-wrap">
              <Thermometer size={16} />
            </div>
          </div>
          <div className="metric-value">{iot.avg_temperature} C</div>
          <div className="metric-delta success">Humidity: {iot.avg_humidity}% | Kulkas: {iot.fridge_temperature} C</div>
        </div>

        <div className="metric-card amber">
          <div className="metric-header">
            <span className="metric-label">Network Throughput</span>
            <div className="metric-icon-wrap">
              <Network size={16} />
            </div>
          </div>
          <div className="metric-value">{(network.total_src_bytes / 1048576).toFixed(2)} MB</div>
          <div className="metric-delta success">Total: {network.total_pkts.toLocaleString()} pkts</div>
        </div>

        <div className="metric-card rose">
          <div className="metric-header">
            <span className="metric-label">Windows Processor</span>
            <div className="metric-icon-wrap">
              <Monitor size={16} />
            </div>
          </div>
          <div className="metric-value">{windows.processor_time}%</div>
          <div className="metric-delta danger">Handles: {windows.handle_count.toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Activity size={17} />
              <span>Tren Telemetri Monitoring Sistem Lintas Domain</span>
            </div>
            <div className="card-subtitle">
              Monitoring time-series beban CPU Linux, suhu sensor IoT, dan throughput aliran paket jaringan
            </div>
          </div>
        </div>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="step" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Line
                type="monotone"
                dataKey="linux_cpu"
                name="Linux CPU Load (%)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="iot_temp"
                name="IoT Sensor Temp (C)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net_flow_rate"
                name="Network Flow Rate (pkts/s)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid-equal">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <HardDrive size={17} />
              <span>Detail Monitoring Host Linux & Windows</span>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sistem Host</th>
                  <th>Parameter Utama</th>
                  <th>Nilai Telemetri</th>
                  <th>Status Operasional</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Linux Host (Process)</td>
                  <td>CPU Core Utilization</td>
                  <td>{linux.avg_cpu}%</td>
                  <td><span className="badge badge-normal">Active</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Linux Host (Memory)</td>
                  <td>Virtual Size Allocation</td>
                  <td>{linux.avg_vsize} MB</td>
                  <td><span className="badge badge-normal">Normal</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Windows (Processor)</td>
                  <td>Processor Time %</td>
                  <td>{windows.processor_time}%</td>
                  <td><span className="badge badge-normal">Steady</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Windows (Memory)</td>
                  <td>Available RAM</td>
                  <td>{windows.available_ram_mb} MB</td>
                  <td><span className="badge badge-normal">Sufficient</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Thermometer size={17} />
              <span>Detail Monitoring Sensor IoT & NetFlow</span>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subdomain</th>
                  <th>Fitur Asli</th>
                  <th>Hasil Pengukuran</th>
                  <th>Kondisi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>IoT Weather Sensor</td>
                  <td>Tekanan Atmosfer</td>
                  <td>{iot.avg_pressure} hPa</td>
                  <td><span className="badge badge-normal">Optimal</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>IoT Smart Fridge</td>
                  <td>Internal Temperature</td>
                  <td>{iot.fridge_temperature} C</td>
                  <td><span className="badge badge-normal">Regulated</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Network Flow</td>
                  <td>Average Duration</td>
                  <td>{network.avg_duration} s</td>
                  <td><span className="badge badge-normal">Fast</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Network Inbound/Outbound</td>
                  <td>Bytes Transferred</td>
                  <td>{((network.total_src_bytes + network.total_dst_bytes) / 1048576).toFixed(2)} MB</td>
                  <td><span className="badge badge-normal">Balanced</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
