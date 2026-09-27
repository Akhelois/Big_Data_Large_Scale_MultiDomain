import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import Overview from './components/Overview.jsx'
import SystemMonitoring from './components/SystemMonitoring.jsx'
import AnomalyDetection from './components/AnomalyDetection.jsx'
import DomainFeatureAnalytics from './components/DomainFeatureAnalytics.jsx'
import ClusterAnalysis from './components/ClusterAnalysis.jsx'
import GraphAnalytics from './components/GraphAnalytics.jsx'
import LivePrediction from './components/LivePrediction.jsx'
import DataExplorer from './components/DataExplorer.jsx'

export default function App() {
  const [activePage, setActivePage] = useState('overview')
  const [selectedDomain, setSelectedDomain] = useState('All Domains')
  const [selectedRegion, setSelectedRegion] = useState('All Regions')
  const [selectedStatus, setSelectedStatus] = useState('All Status')

  const [overviewData, setOverviewData] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [backendStatus, setBackendStatus] = useState(false)

  const checkHealth = () => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'healthy') {
          setBackendStatus(true)
        }
      })
      .catch(() => setBackendStatus(false))
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setOverviewLoading(true)
    const params = new URLSearchParams()
    if (selectedDomain && selectedDomain !== 'All Domains') {
      params.append('domain', selectedDomain)
    }
    if (selectedRegion && selectedRegion !== 'All Regions') {
      params.append('region', selectedRegion)
    }
    if (selectedStatus && selectedStatus !== 'All Status') {
      params.append('status', selectedStatus)
    }

    fetch(`/api/overview?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setOverviewData(data)
        setOverviewLoading(false)
      })
      .catch(() => setOverviewLoading(false))
  }, [selectedDomain, selectedRegion, selectedStatus])

  const pageMeta = {
    overview: {
      title: 'IoT Multidomain Performance & Anomaly Analytics',
      subtitle: 'Monitoring dan Deteksi Anomali Berbasis Fitur Asli Lintas Domain Heterogen'
    },
    monitoring: {
      title: 'System Monitoring (Telemetri Performa Riil)',
      subtitle: 'Monitoring Beban CPU, Alokasi Memori, Throughput NetFlow, dan Sensor IoT Asli'
    },
    anomalies: {
      title: 'Anomaly Detection (Deteksi Anomali & Serangan)',
      subtitle: 'Deteksi Penyimpangan Telemetri dan Klasifikasi Kategori Serangan Berbasis Fitur Riil'
    },
    domain_features: {
      title: 'Domain Feature Analytics (Fitur Asli per Dataset)',
      subtitle: 'Eksplorasi dan visualisasi mendalam menggunakan fitur-fitur asli dari masing-masing domain'
    },
    clustering: {
      title: 'Cluster Analysis (Spark MLlib)',
      subtitle: 'Segmentasi Status Operasional Sistem (Idle, Steady State, High Burst)'
    },
    graph: {
      title: 'Graph Analytics (Neo4j)',
      subtitle: 'Topologi Relasi Hierarkis Perangkat -> Region -> Domain Sistem Multidomain'
    },
    prediction: {
      title: 'Live Telemetry Prediction (Model .pkl)',
      subtitle: 'Simulasi Inferensi Kluster dan Anomali Real-Time Menggunakan Fitur Asli Masing-Masing Domain'
    },
    explorer: {
      title: 'Data Explorer: Inspeksi 38 File CSV Asli',
      subtitle: 'Pilih domain dan file CSV tertentu untuk melihat struktur kolom asli, statistik, dan baris data mentahnya'
    }
  }

  const currentMeta = pageMeta[activePage] || pageMeta.overview

  return (
    <div className="app-container">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        backendStatus={backendStatus}
      />

      <main className="main-content">
        <TopBar
          pageTitle={currentMeta.title}
          pageSubtitle={currentMeta.subtitle}
          filtersMeta={overviewData?.filters_meta}
          selectedDomain={selectedDomain}
          setSelectedDomain={setSelectedDomain}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
        />

        {activePage === 'overview' && (
          <Overview data={overviewData} loading={overviewLoading} />
        )}

        {activePage === 'monitoring' && <SystemMonitoring />}

        {activePage === 'anomalies' && <AnomalyDetection />}

        {activePage === 'domain_features' && <DomainFeatureAnalytics />}

        {activePage === 'clustering' && <ClusterAnalysis />}

        {activePage === 'graph' && <GraphAnalytics />}

        {activePage === 'prediction' && <LivePrediction />}

        {activePage === 'explorer' && <DataExplorer />}
      </main>
    </div>
  )
}
