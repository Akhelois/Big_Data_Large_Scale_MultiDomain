import { useEffect, useMemo, useState } from "react";
import {
    LuActivity,
    LuLoader,
    LuNetwork,
    LuShare2,
    LuTriangleAlert
} from "react-icons/lu";

import { getNeo4jAnalytics } from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import GraphView from "../components/GraphView";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const PALETTE = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#dc2626", "#0284c7", "#16a34a", "#db2777"];

function Neo4jAnalytics() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getNeo4jAnalytics()
            .then(setResult)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const graph = useMemo(() => {
        if (result?.status !== "success") return { nodes: [], edges: [], labels: [] };
        const rawNodes = (result.top_nodes || []).map((node) => ({
            id: node.name,
            label: (node.labels || [])[0] || "Node",
            degree: node.degree || 0,
        }));
        const ids = new Set(rawNodes.map((nd) => nd.id));
        const rawEdges = (result.edges || [])
            .filter((e) => ids.has(e.source) && ids.has(e.target))
            .map((e) => ({ source: e.source, target: e.target, type: e.type }));

        const labels = [];
        rawNodes.forEach((nd) => {
            if (!labels.includes(nd.label)) labels.push(nd.label);
        });
        return { nodes: rawNodes, edges: rawEdges, labels };
    }, [result]);

    const labelColor = (label) => PALETTE[graph.labels.indexOf(label) % PALETTE.length];

    const totalDegree = graph.nodes.reduce((sum, nd) => sum + (nd.degree || 0), 0);
    const avgDegree = graph.nodes.length ? (totalDegree / graph.nodes.length).toFixed(1) : "0";

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Graph Analysis" description="Analisis struktur graph dari Neo4j: node, relasi, dan konektivitas." />
                <div className="loading-state">
                    <LuLoader size={18} className="spin" />
                    <span>Menghubungkan ke Neo4j...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Graph Analysis" description="Analisis struktur graph dari Neo4j: node, relasi, dan konektivitas." />
                <div className="error-state">
                    <LuTriangleAlert size={18} />
                    <span>Gagal mengambil data Neo4j: {error}</span>
                </div>
            </div>
        );
    }

    if (result?.status !== "success") {
        return (
            <div className="page-content">
                <SectionHeader title="Graph Analysis" description="Analisis struktur graph dari Neo4j: node, relasi, dan konektivitas." />
                <div className="monitor-banner">{result?.message || "Neo4j belum tersedia."}</div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <SectionHeader
                title="Graph Analysis"
                description="Analisis struktur graph dari Neo4j: node, relasi, dan konektivitas tertinggi."
            />

            <div className="stats-grid">
                <StatCard icon={LuNetwork} label="Graph nodes" value={Number(result.nodes).toLocaleString("id-ID")} description="Total node di Neo4j" />
                <StatCard icon={LuShare2} label="Relationships" value={Number(result.relationships).toLocaleString("id-ID")} description="Relasi terarah antar node" />
                <StatCard icon={LuActivity} label="Avg. degree (top 10)" value={avgDegree} description="Rata-rata koneksi node teratas" />
                <StatCard icon={LuActivity} label="Status" value="Connected" description="Query berhasil dijalankan" />
            </div>

            <ChartCard
                title="Visualisasi Graph"
                description="Top 10 node paling terhubung. Ukuran node mewakili degree (jumlah koneksi)."
            >
                {graph.nodes.length ? (
                    <>
                        <GraphView nodes={graph.nodes} edges={graph.edges} height={420} />
                        <div className="graph-legend">
                            {graph.labels.map((label) => (
                                <span key={label} className="graph-legend-item">
                                    <span className="graph-legend-dot" style={{ background: labelColor(label) }} />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="empty-state">Graph masih kosong.</div>
                )}
            </ChartCard>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Node paling terhubung</h3>
                        <p>Urutan berdasarkan jumlah relasi masuk dan keluar.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr><th>Node</th><th>Labels</th><th>Degree</th></tr>
                        </thead>
                        <tbody>
                            {(result.top_nodes || []).map((node, index) => (
                                <tr key={`${node.name}-${index}`}>
                                    <td className="strong">{node.name}</td>
                                    <td>{(node.labels || []).join(", ")}</td>
                                    <td>{node.degree}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Relasi graph</h3>
                        <p>Sampel hingga 50 relasi yang tersimpan di Neo4j.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr><th>Sumber</th><th>Tipe</th><th>Target</th></tr>
                        </thead>
                        <tbody>
                            {(result.edges || []).map((edge, index) => (
                                <tr key={index}>
                                    <td>{edge.source}</td>
                                    <td className="strong">{edge.type}</td>
                                    <td>{edge.target}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Neo4jAnalytics;
