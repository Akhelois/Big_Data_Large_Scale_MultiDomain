import { LuMenu } from "react-icons/lu";
import "../styles/components/Topbar.css";

function Topbar({ activePage, onMenuClick }) {
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
            </div>
        </header>
    );
}

export default Topbar;
