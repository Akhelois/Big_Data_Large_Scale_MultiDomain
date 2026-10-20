import { LuChevronRight, LuMenu, LuSlidersHorizontal, LuUser } from "react-icons/lu";
import "../styles/components/Topbar.css";

const domains = ["All Domains", "IoT", "Linux", "Network", "Windows"];

function Topbar({ activePage, selectedDomain, setSelectedDomain, onMenuClick }) {
    return (
        <header className="topbar">
            <div className="topbar-title">
                <button
                    className="menu-btn"
                    onClick={onMenuClick}
                    aria-label="Buka menu"
                >
                    <LuMenu size={18} />
                </button>
                <span className="topbar-page">{activePage}</span>
                <LuChevronRight size={14} color="#d1d5db" className="topbar-chevron" />
                <span className="topbar-context">Monitoring</span>
            </div>

            <div className="topbar-actions">
                <div className="domain-filter">
                    <LuSlidersHorizontal size={13} color="#9ca3af" />
                    <span className="filter-label">Domain</span>
                    <select
                        value={selectedDomain}
                        onChange={(e) => setSelectedDomain(e.target.value)}
                    >
                        {domains.map((d) => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                <div className="profile">
                    <div className="profile-avatar">
                        <LuUser size={15} />
                    </div>
                    <div className="profile-info">
                        <div className="profile-name">Analytics</div>
                        <div className="profile-role">Monitoring</div>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Topbar;