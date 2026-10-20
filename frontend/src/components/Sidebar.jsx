import {
    LuLayoutDashboard,
    LuDatabase,
    LuChartBar,
    LuShieldAlert,
    LuChartScatter,
    LuMonitor,
    LuShare2
} from "react-icons/lu";
import "../styles/components/Sidebar.css";

const menuItems = [
    { name: "Overview", icon: LuLayoutDashboard },
    { name: "PC Monitoring", icon: LuMonitor },
    { name: "Dataset", icon: LuDatabase },
    { name: "Model Performance", icon: LuChartBar },
    { name: "Anomaly Detection", icon: LuShieldAlert },
    { name: "Clustering", icon: LuChartScatter },
    { name: "Neo4j Analytics", icon: LuShare2 }
];

function Sidebar({ activePage, setActivePage, open }) {
    return (
        <aside className={`sidebar ${open ? "open" : ""}`}>
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <LuChartBar size={18} />
                </div>

                <div>
                    <div className="brand-name">Multidomain</div>
                    <div className="brand-subtitle">Analytics Monitor</div>
                </div>
            </div>

            <div className="sidebar-section-title">Analytics</div>

            <nav className="sidebar-menu">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.name}
                            className={`sidebar-item ${activePage === item.name ? "active" : ""}`}
                            onClick={() => setActivePage(item.name)}
                        >
                            <span className="sidebar-icon">
                                <Icon size={16} />
                            </span>
                            <span>{item.name}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-bottom">
                <div className="pipeline-status">
                    <div className="status-dot" />
                    <div>
                        <div className="status-title">Pipeline Active</div>
                        <div className="status-description">Analytics ready</div>
                    </div>
                </div>

                <div className="sidebar-footer">Multidomain Monitoring</div>
            </div>
        </aside>
    );
}

export default Sidebar;