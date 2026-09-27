import React from 'react'

export default function TopBar({
  pageTitle,
  pageSubtitle,
  filtersMeta,
  selectedDomain,
  setSelectedDomain,
  selectedRegion,
  setSelectedRegion,
  selectedStatus,
  setSelectedStatus
}) {
  return (
    <header className="top-bar">
      <div className="page-header">
        <h1>{pageTitle}</h1>
        <p>{pageSubtitle}</p>
      </div>

      <div className="filters-bar">
        <select
          className="filter-select"
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
        >
          {(filtersMeta?.domains || ['All Domains']).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
        >
          {(filtersMeta?.regions || ['All Regions']).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          {(filtersMeta?.statuses || ['All Status', 'Normal', 'Anomaly']).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </header>
  )
}
