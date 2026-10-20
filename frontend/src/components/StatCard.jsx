import "../styles/components/StatCard.css";

function StatCard({ label, value, description, icon: Icon }) {
    return (
        <div className="stat-card">
            <div className="stat-label">
                {Icon && (
                    <span className="stat-icon">
                        <Icon size={13} />
                    </span>
                )}
                {label}
            </div>

            <div className="stat-value">{value}</div>

            {description && (
                <div className="stat-description">{description}</div>
            )}
        </div>
    );
}

export default StatCard;