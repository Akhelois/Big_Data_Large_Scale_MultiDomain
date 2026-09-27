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
  CartesianGrid,
  ZAxis
} from 'recharts'
import { Network, Thermometer, Terminal, Monitor, Table } from 'lucide-react'

export default function DomainFeatureAnalytics() {
  const [activeTab, setActiveTab] = useState('Network')
  const [domainData, setDomainData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/domain-features/${activeTab.toLowerCase()}`)
      .then((res) => res.json())
      .then((data) => {
        setDomainData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activeTab])

  const tabs = [
    { id: 'Network', label: 'Network Domain (NetFlow)', icon: Network },
    { id: 'IoT', label: 'IoT Sensor Domain (Sensors)', icon: Thermometer },
    { id: 'Linux', label: 'Linux Host Domain (OS Metrics)', icon: Terminal },
    { id: 'Windows', label: 'Windows Domain (Telemetry)', icon: Monitor }
  ]

  return (
    <div className="content-body">
      <div className="tab-nav">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {loading || !domainData ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Memuat telemetri fitur asli {activeTab}...</span>
        </div>
      ) : (
        <>
          {activeTab === 'Network' && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Total Bytes Dikirim</span>
                  <div className="metric-value">
                    {domainData.metrics?.total_src_bytes?.toLocaleString()} B
                  </div>
                </div>
                <div className="metric-card emerald">
                  <span className="metric-label">Total Bytes Diterima</span>
                  <div className="metric-value">
                    {domainData.metrics?.total_dst_bytes?.toLocaleString()} B
                  </div>
                </div>
                <div className="metric-card amber">
                  <span className="metric-label">Rata-rata Durasi Flow</span>
                  <div className="metric-value">
                    {domainData.metrics?.avg_duration} s
                  </div>
                </div>
                <div className="metric-card rose">
                  <span className="metric-label">Total Paket Jaringan</span>
                  <div className="metric-value">
                    {domainData.metrics?.total_pkts?.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="charts-grid-equal">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Distribusi Flow: Source Bytes vs Destination Bytes</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="src_bytes" name="Source Bytes" stroke="#6b7280" fontSize={11} />
                        <YAxis type="number" dataKey="dst_bytes" name="Destination Bytes" stroke="#6b7280" fontSize={11} />
                        <ZAxis type="number" dataKey="src_pkts" range={[40, 200]} name="Source Packets" />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="NetFlow Packets" data={domainData.scatter} fill="#3b82f6" opacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Distribusi Protokol Jaringan Teratas</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={domainData.proto_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="proto" stroke="#6b7280" fontSize={11} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Bar dataKey="count" name="Jumlah Sesi" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Table size={17} />
                    <span>Cuplikan Data NetFlow Asli (Network_dataset_1.csv)</span>
                  </div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Src IP</th>
                        <th>Dst IP</th>
                        <th>Proto</th>
                        <th>Service</th>
                        <th>Duration</th>
                        <th>Src Bytes</th>
                        <th>Dst Bytes</th>
                        <th>Packets</th>
                        <th>Type</th>
                        <th>Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainData.table?.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.ts}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.src_ip}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.dst_ip}</td>
                          <td><span className="badge badge-normal">{row.proto}</span></td>
                          <td>{row.service}</td>
                          <td>{Number(row.duration).toFixed(4)}s</td>
                          <td>{Number(row.src_bytes).toLocaleString()}</td>
                          <td>{Number(row.dst_bytes).toLocaleString()}</td>
                          <td>{Number(row.src_pkts) + Number(row.dst_pkts)}</td>
                          <td>{row.type}</td>
                          <td>
                            <span className={`badge ${row.label === 1 ? 'badge-anomaly' : 'badge-normal'}`}>
                              {row.label === 1 ? 'Attack' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'IoT' && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Rata-rata Suhu Cuaca</span>
                  <div className="metric-value">{domainData.metrics?.avg_temperature} C</div>
                </div>
                <div className="metric-card emerald">
                  <span className="metric-label">Rata-rata Kelembapan</span>
                  <div className="metric-value">{domainData.metrics?.avg_humidity} %</div>
                </div>
                <div className="metric-card amber">
                  <span className="metric-label">Rata-rata Tekanan Atmosfer</span>
                  <div className="metric-value">{domainData.metrics?.avg_pressure} hPa</div>
                </div>
              </div>

              <div className="charts-grid-equal">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Sensor Cuaca: Temperatur vs Kelembapan</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="temperature" name="Temperature" stroke="#6b7280" fontSize={11} />
                        <YAxis type="number" dataKey="humidity" name="Humidity" stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="Weather Sensors" data={domainData.scatter} fill="#10b981" opacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Distribusi Suhu Kulkas IoT (IoT_Fridge.csv)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="fridge_temperature" name="Fridge Temperature (C)" stroke="#6b7280" fontSize={11} />
                        <YAxis type="category" dataKey="type" name="Status" stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="Fridge Readings" data={domainData.fridge_sample} fill="#06b6d4" opacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {domainData.modbus_table?.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <Table size={17} />
                      <span>Cuplikan Sensor Modbus PLC (IoT_Modbus.csv)</span>
                    </div>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {Object.keys(domainData.modbus_table[0]).slice(0, 8).map((k) => (
                            <th key={k}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {domainData.modbus_table.map((row, idx) => (
                          <tr key={idx}>
                            {Object.keys(row).slice(0, 8).map((k) => (
                              <td key={k}>{String(row[k])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'Linux' && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Rata-rata Utilisasi CPU</span>
                  <div className="metric-value">{domainData.metrics?.avg_cpu}%</div>
                </div>
                <div className="metric-card emerald">
                  <span className="metric-label">Prioritas Proses (PRI)</span>
                  <div className="metric-value">{domainData.metrics?.avg_pri}</div>
                </div>
                <div className="metric-card amber">
                  <span className="metric-label">Total Proses Aktif</span>
                  <div className="metric-value">
                    {domainData.metrics?.total_active_processes?.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="charts-grid-equal">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Distribusi Penggunaan CPU Berdasarkan Status Aktivitas</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="category" dataKey="type" name="Status" stroke="#6b7280" fontSize={11} />
                        <YAxis type="number" dataKey="cpu" name="CPU Usage Ratio" stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="CPU Usage" data={domainData.cpu_distribution} fill="#f59e0b" opacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Memori Virtual (VSIZE) vs Resident Memory (MEM)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="vsize" name="Virtual Size" stroke="#6b7280" fontSize={11} />
                        <YAxis type="number" dataKey="mem" name="Memory Ratio" stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="Memory Allocation" data={domainData.mem_scatter} fill="#8b5cf6" opacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Table size={17} />
                    <span>Cuplikan Data Proses Linux (Linux_process_1.csv)</span>
                  </div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>PID</th>
                        <th>CMD</th>
                        <th>CPU Ratio</th>
                        <th>PRI</th>
                        <th>NICE</th>
                        <th>CPUNR</th>
                        <th>Status</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainData.table?.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.ts}</td>
                          <td>{row.PID}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.CMD}</td>
                          <td>{Number(row.CPU).toFixed(4)}</td>
                          <td>{row.PRI}</td>
                          <td>{row.NICE}</td>
                          <td>Core {row.CPUNR}</td>
                          <td><span className="badge badge-normal">{row.Status}</span></td>
                          <td>{row.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Windows' && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Processor Time</span>
                  <div className="metric-value">{domainData.metrics?.avg_proc_time}%</div>
                </div>
                <div className="metric-card emerald">
                  <span className="metric-label">Thread Count</span>
                  <div className="metric-value">{domainData.metrics?.avg_thread_count}</div>
                </div>
                <div className="metric-card amber">
                  <span className="metric-label">Handle Count</span>
                  <div className="metric-value">
                    {domainData.metrics?.avg_handle_count?.toLocaleString()}
                  </div>
                </div>
                <div className="metric-card rose">
                  <span className="metric-label">Available RAM</span>
                  <div className="metric-value">{domainData.metrics?.avg_mem_available} MB</div>
                </div>
              </div>

              <div className="charts-grid-equal">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Windows Telemetri: Handle Count vs Processor Time</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="handle_count" name="Handle Count" stroke="#6b7280" fontSize={11} />
                        <YAxis type="number" dataKey="proc_time" name="Processor Time (%)" stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            fontSize: 12
                          }}
                        />
                        <Scatter name="Workstation Telemetry" data={domainData.scatter} fill="#8b5cf6" opacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      <span>Distribusi Jenis Serangan / Anomali di Windows</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={domainData.attack_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                        <Bar dataKey="count" name="Frekuensi Kejadian" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Table size={17} />
                    <span>Cuplikan Telemetri Windows (windows7_dataset.csv)</span>
                  </div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {domainData.table?.length > 0 &&
                          Object.keys(domainData.table[0]).map((k) => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {domainData.table?.map((row, idx) => (
                        <tr key={idx}>
                          {Object.keys(row).map((k) => (
                            <td key={k}>{String(row[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
