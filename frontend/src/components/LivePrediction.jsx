import React, { useState } from 'react'
import { Radio, Play, CheckCircle2, AlertOctagon, ShieldAlert, Layers } from 'lucide-react'

export default function LivePrediction() {
  const [selectedDomain, setSelectedDomain] = useState('Network')
  const [result, setResult] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const [networkInputs, setNetworkInputs] = useState({
    duration: 0.05,
    src_bytes: 250.0,
    dst_bytes: 3500.0,
    src_pkts: 6.0,
    dst_pkts: 7.0,
    src_ip_bytes: 500.0,
    dst_ip_bytes: 3800.0
  })

  const [iotInputs, setIotInputs] = useState({
    temperature: 28.5,
    humidity: 65.0,
    pressure: 1013.25
  })

  const [linuxInputs, setLinuxInputs] = useState({
    CPU: 0.15,
    PRI: 120.0,
    NICE: 0.0,
    CPUNR: 2.0,
    TRUN: 0.0,
    TSLPI: 10.0
  })

  const [windowsInputs, setWindowsInputs] = useState({
    'Processor(_Total) pct_ Processor Time': 25.0,
    'Process(_Total) Thread Count': 1200.0,
    'Process(_Total) Handle Count': 45000.0,
    'Process(_Total) Working Set': 2000000000.0,
    'Memory Available MBytes': 4096.0,
    'Memory Committed Bytes': 4000000000.0
  })

  const handlePredict = async () => {
    setPredicting(true)
    setErrorMsg(null)
    setResult(null)

    let payload = {}
    if (selectedDomain === 'Network') payload = networkInputs
    else if (selectedDomain === 'IoT') payload = iotInputs
    else if (selectedDomain === 'Linux') payload = linuxInputs
    else if (selectedDomain === 'Windows') payload = windowsInputs

    try {
      const res = await fetch(`/api/predict/${selectedDomain.toLowerCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: payload })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Inferensi gagal')
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setPredicting(false)
    }
  }

  return (
    <div className="content-body">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Radio size={17} />
              <span>Simulasi Inferensi Telemetri Real-Time</span>
            </div>
            <div className="card-subtitle">
              Pilih domain dan input parameter fitur untuk inferensi model .pkl di backend
            </div>
          </div>
          <div>
            <select
              className="filter-select"
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value)
                setResult(null)
                setErrorMsg(null)
              }}
            >
              <option value="Network">Network Domain (.pkl)</option>
              <option value="IoT">IoT Sensor Domain (.pkl)</option>
              <option value="Linux">Linux Host Domain (.pkl)</option>
              <option value="Windows">Windows Domain (.pkl)</option>
            </select>
          </div>
        </div>

        {selectedDomain === 'Network' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Flow Duration (detik)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={networkInputs.duration}
                onChange={(e) => setNetworkInputs({ ...networkInputs, duration: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Source Bytes (src_bytes)</label>
              <input
                type="number"
                step="50"
                className="form-input"
                value={networkInputs.src_bytes}
                onChange={(e) => setNetworkInputs({ ...networkInputs, src_bytes: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Destination Bytes (dst_bytes)</label>
              <input
                type="number"
                step="100"
                className="form-input"
                value={networkInputs.dst_bytes}
                onChange={(e) => setNetworkInputs({ ...networkInputs, dst_bytes: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Source Packets (src_pkts)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={networkInputs.src_pkts}
                onChange={(e) => setNetworkInputs({ ...networkInputs, src_pkts: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Destination Packets (dst_pkts)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={networkInputs.dst_pkts}
                onChange={(e) => setNetworkInputs({ ...networkInputs, dst_pkts: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Source IP Bytes</label>
              <input
                type="number"
                step="50"
                className="form-input"
                value={networkInputs.src_ip_bytes}
                onChange={(e) => setNetworkInputs({ ...networkInputs, src_ip_bytes: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Destination IP Bytes</label>
              <input
                type="number"
                step="50"
                className="form-input"
                value={networkInputs.dst_ip_bytes}
                onChange={(e) => setNetworkInputs({ ...networkInputs, dst_ip_bytes: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}

        {selectedDomain === 'IoT' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Temperature (C)</label>
              <input
                type="number"
                step="0.5"
                className="form-input"
                value={iotInputs.temperature}
                onChange={(e) => setIotInputs({ ...iotInputs, temperature: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Humidity (%)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={iotInputs.humidity}
                onChange={(e) => setIotInputs({ ...iotInputs, humidity: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pressure (hPa)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={iotInputs.pressure}
                onChange={(e) => setIotInputs({ ...iotInputs, pressure: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}

        {selectedDomain === 'Linux' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">CPU Usage Ratio (0.0 - 1.0)</label>
              <input
                type="number"
                step="0.05"
                className="form-input"
                value={linuxInputs.CPU}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, CPU: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Process Priority (PRI)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={linuxInputs.PRI}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, PRI: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nice Value</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={linuxInputs.NICE}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, NICE: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">CPU Core Number</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={linuxInputs.CPUNR}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, CPUNR: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Running Threads (TRUN)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={linuxInputs.TRUN}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, TRUN: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sleeping Threads (TSLPI)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={linuxInputs.TSLPI}
                onChange={(e) => setLinuxInputs({ ...linuxInputs, TSLPI: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}

        {selectedDomain === 'Windows' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Processor Time (%)</label>
              <input
                type="number"
                step="1"
                className="form-input"
                value={windowsInputs['Processor(_Total) pct_ Processor Time']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Processor(_Total) pct_ Processor Time': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Thread Count</label>
              <input
                type="number"
                step="50"
                className="form-input"
                value={windowsInputs['Process(_Total) Thread Count']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Process(_Total) Thread Count': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Handle Count</label>
              <input
                type="number"
                step="500"
                className="form-input"
                value={windowsInputs['Process(_Total) Handle Count']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Process(_Total) Handle Count': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Working Set Bytes</label>
              <input
                type="number"
                step="100000000"
                className="form-input"
                value={windowsInputs['Process(_Total) Working Set']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Process(_Total) Working Set': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Available Memory (MB)</label>
              <input
                type="number"
                step="256"
                className="form-input"
                value={windowsInputs['Memory Available MBytes']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Memory Available MBytes': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Committed Bytes</label>
              <input
                type="number"
                step="100000000"
                className="form-input"
                value={windowsInputs['Memory Committed Bytes']}
                onChange={(e) =>
                  setWindowsInputs({
                    ...windowsInputs,
                    'Memory Committed Bytes': parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handlePredict} disabled={predicting}>
            <Play size={15} />
            <span>{predicting ? 'Menjalankan Inferensi...' : `Jalankan Prediksi ${selectedDomain}`}</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: 12, backgroundColor: 'rgba(244,63,94,0.1)', color: '#fb7185', borderRadius: 8, fontSize: 13 }}>
            {errorMsg}
          </div>
        )}

        {result && (
          <div className="prediction-result-card">
            <div className="card-title">
              <span>Hasil Inferensi Model Machine Learning</span>
            </div>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Predicted Cluster ({selectedDomain.toLowerCase()}_kmeans.pkl)</span>
                <div className="metric-value">Cluster {result.cluster}</div>
                <div className="metric-delta success">
                  <Layers size={13} />
                  <span>K-Means Partition</span>
                </div>
              </div>

              <div className={`metric-card ${result.is_anomaly ? 'rose' : 'emerald'}`}>
                <span className="metric-label">Status Anomali ({selectedDomain.toLowerCase()}_iso.pkl)</span>
                <div className="metric-value">{result.anomaly_label}</div>
                <div className={`metric-delta ${result.is_anomaly ? 'danger' : 'success'}`}>
                  {result.is_anomaly ? (
                    <>
                      <ShieldAlert size={13} />
                      <span>Bahaya / Pola Transmisi Anomali</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Aman / Transmisi Normal</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
