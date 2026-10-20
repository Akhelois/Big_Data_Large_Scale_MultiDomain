import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Overview from "./pages/Overview";
import Dataset from "./pages/Dataset";
import ModelPerformance from "./pages/ModelPerformance";
import AnomalyDetection from "./pages/AnomalyDetection";
import Clustering from "./pages/Clustering";
import Neo4jAnalytics from "./pages/Neo4jAnalytics";
import PcMonitoring from "./pages/PcMonitoring";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [selectedDomain, setSelectedDomain] = useState("All Domains");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    const props = {
      selectedDomain,
      setSelectedDomain
    };

    switch (activePage) {
      case "Overview":
        return <Overview {...props} />;
      case "PC Monitoring":
        return <PcMonitoring />;
      case "Dataset":
        return <Dataset {...props} />;
      case "Model Performance":
        return <ModelPerformance {...props} />;
      case "Anomaly Detection":
        return <AnomalyDetection {...props} />;
      case "Clustering":
        return <Clustering {...props} />;
      case "Neo4j Analytics":
        return <Neo4jAnalytics />;
      default:
        return <Overview {...props} />;
    }
  };

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        activePage={activePage}
        setActivePage={handleNavigate}
        open={sidebarOpen}
      />

      <main className="main-content">
        <Topbar
          activePage={activePage}
          selectedDomain={selectedDomain}
          setSelectedDomain={setSelectedDomain}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />

        <div className="page-container">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
