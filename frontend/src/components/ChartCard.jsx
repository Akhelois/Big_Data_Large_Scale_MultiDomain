import "../styles/components/ChartCard.css";

function ChartCard({
  title,
  description,
  children,
  className = ""
}) {
  return (
    <section className={`chart-card ${className}`}>
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">
            {title}
          </div>

          {description && (
            <div className="chart-card-description">
              {description}
            </div>
          )}
        </div>
      </div>

      <div className="chart-card-content">
        {children}
      </div>
    </section>
  );
}

export default ChartCard;