import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Overview from "./pages/Overview";
import Dataset from "./pages/Dataset";
import ModelPerformance from "./pages/ModelPerformance";
import AnomalyDetection from "./pages/AnomalyDetection";
import Clustering from "./pages/Clustering";
import Neo4jAnalytics from "./pages/Neo4jAnalytics";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [selectedDomain, setSelectedDomain] = useState("All Domains");

  const renderPage = () => {
    const props = {
      selectedDomain,
      setSelectedDomain
    };

    switch (activePage) {
      case "Overview":
        return <Overview {...props} />;
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
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="main-content">
        <Topbar
          activePage={activePage}
          selectedDomain={selectedDomain}
          setSelectedDomain={setSelectedDomain}
        />

        <div className="page-container">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
