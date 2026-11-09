import { isValidElement } from "react";
import "../styles/components/StatCard.css";

function StatCard({ label, title, value, description, subtitle, icon: Icon }) {
    const displayLabel = label || title;
    const displayDescription = description || subtitle;

    return (
        <div className="stat-card">
            <div className="stat-label">
                {Icon && (
                    <span className="stat-icon">
                        {isValidElement(Icon) ? Icon : <Icon size={13} />}
                    </span>
                )}
                {displayLabel}
            </div>

            <div className="stat-value">{value}</div>

            {displayDescription && (
                <div className="stat-description">{displayDescription}</div>
            )}
        </div>
    );
}

export default StatCard;
