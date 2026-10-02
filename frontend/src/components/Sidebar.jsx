import "../styles/components/Sidebar.css";

function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    {
      name: "Overview",
      icon: "⌂"
    },
    {
      name: "Dataset",
      icon: "▦"
    },
    {
      name: "Model Performance",
      icon: "◈"
    },
    {
      name: "Anomaly Detection",
      icon: "△"
    },
    {
      name: "Clustering",
      icon: "◌"
    
    },
    {
      name: "Neo4j Analytics",
      icon: "G"
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">M</div>

        <div>
          <div className="brand-name">
            Multidomain
          </div>

          <div className="brand-subtitle">
            Analytics Monitor
          </div>
        </div>
      </div>

      <div className="sidebar-section-title">
        ANALYTICS
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.name}
            className={`sidebar-item ${activePage === item.name ? "active" : ""
              }`}
            onClick={() => setActivePage(item.name)}
          >
            <span className="sidebar-icon">
              {item.icon}
            </span>

            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="pipeline-status">
          <div className="status-dot" />

          <div>
            <div className="status-title">
              Pipeline Active
            </div>

            <div className="status-description">
              Analytics ready
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          Multidomain Monitoring
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;