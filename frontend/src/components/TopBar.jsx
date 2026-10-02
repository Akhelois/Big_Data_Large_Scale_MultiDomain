import "../styles/components/Topbar.css";

function Topbar({
  activePage,
  selectedDomain,
  setSelectedDomain
}) {
  const domains = [
    "All Domains",
    "IoT",
    "Linux",
    "Network",
    "Windows"
  ];

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-page">
          {activePage}
        </span>

        <span className="topbar-separator">
          /
        </span>

        <span className="topbar-context">
          Monitoring
        </span>
      </div>

      <div className="topbar-actions">
        <div className="domain-filter">
          <span className="filter-label">
            Domain
          </span>

          <select
            value={selectedDomain}
            onChange={(event) =>
              setSelectedDomain(event.target.value)
            }
          >
            {domains.map((domain) => (
              <option
                key={domain}
                value={domain}
              >
                {domain}
              </option>
            ))}
          </select>
        </div>

        <div className="profile">
          <div className="profile-avatar">
            A
          </div>

          <div className="profile-info">
            <div className="profile-name">
              Analytics
            </div>

            <div className="profile-role">
              Monitoring
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;