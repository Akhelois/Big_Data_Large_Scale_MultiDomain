import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Download,
  Database,
  Columns,
  Hash,
  BarChart2
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'

export default function DataExplorer() {
  const [fileList, setFileList] = useState({})
  const [selectedDomain, setSelectedDomain] = useState('IoT')
  const [selectedFile, setSelectedFile] = useState('')
  const [limit, setLimit] = useState(500)
  const [fileData, setFileData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('table')
  const [selectedCol, setSelectedCol] = useState('')

  useEffect(() => {
    fetch('/api/explorer/files')
      .then((res) => res.json())
      .then((data) => {
        setFileList(data)
        const domains = Object.keys(data)
        if (domains.length > 0) {
          const firstDom = domains[0]
          setSelectedDomain(firstDom)
          if (data[firstDom]?.length > 0) {
            setSelectedFile(data[firstDom][0])
          }
        }
      })
  }, [])

  const loadData = () => {
    if (!selectedDomain || !selectedFile) return
    setLoading(true)
    const params = new URLSearchParams({
      domain: selectedDomain,
      file: selectedFile,
      limit: limit.toString()
    })
    if (selectedCol) {
      params.append('column', selectedCol)
    }

    fetch(`/api/explorer/data?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setFileData(data)
        if (data.numeric_columns?.length > 0 && !selectedCol) {
          setSelectedCol(data.numeric_columns[0])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedFile) {
      loadData()
    }
  }, [selectedFile, limit])

  useEffect(() => {
    if (selectedCol && selectedFile) {
      loadData()
    }
  }, [selectedCol])

  const handleDomainChange = (dom) => {
    setSelectedDomain(dom)
    const files = fileList[dom] || []
    if (files.length > 0) {
      setSelectedFile(files[0])
      setSelectedCol('')
    } else {
      setSelectedFile('')
    }
  }

  const handleDownload = () => {
    if (!selectedDomain || !selectedFile) return
    window.open(`/api/explorer/download?domain=${encodeURIComponent(selectedDomain)}&file=${encodeURIComponent(selectedFile)}`, '_blank')
  }

  return (
    <div className="content-body">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <FileSpreadsheet size={17} />
              <span>Inspeksi File CSV Mentah per Domain</span>
            </div>
            <div className="card-subtitle">
              Eksplorasi struktur kolom asli, distribusi data numerik, dan ringkasan statistik
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Pilih Domain</label>
            <select
              className="filter-select"
              value={selectedDomain}
              onChange={(e) => handleDomainChange(e.target.value)}
            >
              {Object.keys(fileList).map((d) => (
                <option key={d} value={d}>
                  {d} Domain
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Pilih File CSV Asli ({fileList[selectedDomain]?.length || 0} files)</label>
            <select
              className="filter-select"
              value={selectedFile}
              onChange={(e) => {
                setSelectedFile(e.target.value)
                setSelectedCol('')
              }}
            >
              {(fileList[selectedDomain] || []).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Batas Baris Dimuat</label>
            <select
              className="filter-select"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={500}>500 Baris</option>
              <option value={1000}>1,000 Baris</option>
              <option value={2000}>2,000 Baris</option>
              <option value={5000}>5,000 Baris</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Membaca file {selectedFile}...</span>
        </div>
      ) : fileData ? (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Baris Dimuat</span>
                <Database size={16} />
              </div>
              <div className="metric-value">
                {fileData.total_rows_loaded?.toLocaleString()}
              </div>
            </div>

            <div className="metric-card emerald">
              <div className="metric-header">
                <span className="metric-label">Total Kolom Asli</span>
                <Columns size={16} />
              </div>
              <div className="metric-value">{fileData.total_columns} Kolom</div>
            </div>

            <div className="metric-card amber">
              <div className="metric-header">
                <span className="metric-label">Kolom Numerik</span>
                <Hash size={16} />
              </div>
              <div className="metric-value">
                {fileData.numeric_columns?.length || 0} Kolom
              </div>
            </div>
          </div>

          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <FileSpreadsheet size={15} />
              <span>Tabel Data Mentah</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <Columns size={15} />
              <span>Statistik Deskriptif</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'dist' ? 'active' : ''}`}
              onClick={() => setActiveTab('dist')}
            >
              <BarChart2 size={15} />
              <span>Visualisasi Distribusi Kolom</span>
            </button>
          </div>

          {activeTab === 'table' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Pratinjau Data ({selectedFile})</span>
                </div>
                <div>
                  <button className="btn btn-secondary" onClick={handleDownload}>
                    <Download size={14} />
                    <span>Unduh CSV Asli</span>
                  </button>
                </div>
              </div>
              <div className="table-container" style={{ maxHeight: 500 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {fileData.columns?.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.table?.map((row, idx) => (
                      <tr key={idx}>
                        {fileData.columns?.map((c) => (
                          <td key={c}>{String(row[c] !== undefined ? row[c] : '-')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Statistik Deskriptif Kolom Numerik (df.describe())</span>
                </div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      {fileData.describe?.length > 0 &&
                        Object.keys(fileData.describe[0]).map((k) => <th key={k}>{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.describe?.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(row).map((k) => (
                          <td key={k} style={{ fontFamily: typeof row[k] === 'number' ? 'var(--font-mono)' : 'inherit' }}>
                            {String(row[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'dist' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Distribusi Nilai Kolom: {selectedCol}</span>
                </div>
                <div>
                  <select
                    className="filter-select"
                    value={selectedCol}
                    onChange={(e) => setSelectedCol(e.target.value)}
                  >
                    {fileData.numeric_columns?.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fileData.column_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="range" stroke="#6b7280" fontSize={10} angle={-30} textAnchor="end" interval={0} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12
                      }}
                    />
                    <Bar dataKey="count" name="Frekuensi Nilai" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
