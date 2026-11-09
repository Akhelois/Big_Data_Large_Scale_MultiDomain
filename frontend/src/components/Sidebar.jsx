import {
    LuChartBar,
    LuChartScatter,
    LuCode,
    LuDatabase,
    LuLayoutDashboard,
    LuMonitor,
    LuNetwork,
    LuRadio,
    LuShare2,
    LuShieldAlert,
    LuUser
} from "react-icons/lu";
import "../styles/components/Sidebar.css";

const menuItems = [
    { name: "Overview", icon: LuLayoutDashboard },
    { name: "PC Monitoring", icon: LuMonitor },
    { name: "IoT Monitoring", icon: LuRadio },
    { name: "Network Monitoring", icon: LuNetwork },
    { name: "Dataset", icon: LuDatabase },
    { name: "Model Performance", icon: LuChartBar },
    { name: "Anomaly Detection", icon: LuShieldAlert },
    { name: "Clustering", icon: LuChartScatter },
    { name: "Neo4j Analytics", icon: LuShare2 },
    { name: "API Docs", icon: LuCode }
];

const domains = ["All Domains", "IoT", "Linux", "Network", "Windows"];

function Sidebar({ activePage, setActivePage, open, selectedDomain, setSelectedDomain }) {
    return (
        <aside className={`sidebar ${open ? "open" : ""}`}>
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <LuChartBar size={18} />
                </div>

                <div>
                    <div className="brand-name">Multidomain</div>
                    <div className="brand-subtitle">Monitor Analitik</div>
                </div>
            </div>

            <div className="sidebar-filter">
                <label htmlFor="sidebar-domain">Domain</label>
                <select
                    id="sidebar-domain"
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                >
                    {domains.map((d) => (
                        <option key={d} value={d}>{d === "All Domains" ? "Semua Domain" : d}</option>
                    ))}
                </select>
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

            <div className="sidebar-profile">
                <div className="profile-avatar">
                    <LuUser size={15} />
                </div>
                <div>
                    <div className="profile-name">Jason Lee</div>
                    <div className="profile-id">2702751580</div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
