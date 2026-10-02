import { useEffect, useState } from "react";
import { getNeo4jAnalytics } from "../api/dashboardApi";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

function Neo4jAnalytics() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getNeo4jAnalytics().then(setResult).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return <div className="page-content">
    <SectionHeader title="Neo4j Analytics" description="Ringkasan node, relasi, dan node dengan konektivitas tertinggi dari graph database." />
    {loading ? <div className="loading-state">Menghubungkan ke Neo4j...</div> : error ? <div className="error-state">Gagal mengambil analytics Neo4j: {error}</div> : result?.status !== "success" ? <div className="monitor-banner">{result?.message || "Neo4j belum tersedia."} Hasil graph lokal tidak ditampilkan sebagai hasil Neo4j.</div> : <>
      <div className="stats-grid three"><StatCard label="Graph nodes" value={Number(result.nodes).toLocaleString("id-ID")} description="Data saat ini di Neo4j" /><StatCard label="Relationships" value={Number(result.relationships).toLocaleString("id-ID")} description="Relasi terarah" /><StatCard label="Status" value="Connected" description="Query berhasil" /></div>
      <div className="table-card"><div className="table-header"><div><h3>Node paling terhubung</h3><p>Urutan berdasarkan jumlah relasi masuk dan keluar.</p></div></div><div className="table-container"><table className="data-table"><thead><tr><th>Node</th><th>Labels</th><th>Degree</th></tr></thead><tbody>{(result.top_nodes || []).map((node, index) => <tr key={`${node.name}-${index}`}><td className="strong">{node.name}</td><td>{(node.labels || []).join(", ")}</td><td>{node.degree}</td></tr>)}</tbody></table></div></div>
      <div className="table-card" style={{ marginTop: 18 }}><div className="table-header"><div><h3>Relasi graph</h3><p>Contoh sampai 50 relasi yang tersimpan di Neo4j.</p></div></div><div className="table-container"><table className="data-table"><thead><tr><th>Sumber</th><th>Tipe</th><th>Target</th></tr></thead><tbody>{(result.edges || []).map((edge, index) => <tr key={index}><td>{edge.source}</td><td className="strong">{edge.type}</td><td>{edge.target}</td></tr>)}</tbody></table></div></div>
    </>}
  </div>;
}

export default Neo4jAnalytics;
