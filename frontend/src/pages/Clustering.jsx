import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    Legend
} from "recharts";

import SectionHeader from "../components/SectionHeader";
import ChartCard from "../components/ChartCard";
import { getClusters, getClusteringScatter } from "../api/dashboardApi";
import "../styles/pages/Pages.css";

const CLUSTER_COLORS = ["#2563eb", "#d97706", "#0d9488", "#7c3aed", "#dc2626"];

function KMeansScatterPanel() {
    const [scatter, setScatter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = (refresh) => {
        setLoading(true);
        setError("");
        getClusteringScatter(refresh)
            .then((res) => {
                if (res.status !== "success") throw new Error(res.message || "Gagal memuat scatter");
                setScatter(res.data || null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load(false);
    }, []);

    if (loading && !scatter) {
        return <div className="empty-state">Menghitung proyeksi PCA dari model &amp; dataset (cache dibangun sekali)...</div>;
    }
    if (error && !scatter) {
        return <div className="empty-state">{error}</div>;
    }
    if (!scatter?.domains?.length) {
        return <div className="empty-state">Data scatter tidak tersedia.</div>;
    }

    return (
        <>
            <div className="chart-grid two">
                {scatter.domains.map((dom) => {
                    const groups = {};
                    dom.points.forEach((p) => {
                        (groups[p.cluster] ||= []).push(p);
                    });
                    return (
                        <ChartCard
                            key={dom.domain}
                            title={`K-Means — ${dom.domain}`}
                            description={`n=${dom.n.toLocaleString("id-ID")} sampel · PCA 2D (var ${dom.pca_variance?.[0] ?? "-"}% / ${dom.pca_variance?.[1] ?? "-"}%)`}
                        >
                            <ResponsiveContainer width="100%" height={260}>
                                <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                                    <CartesianGrid stroke="#eef0f4" />
                                    <XAxis type="number" dataKey="x" name="PC1" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                                    <YAxis type="number" dataKey="y" name="PC2" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
                                    <ZAxis range={[35, 36]} />
                                    <Tooltip
                                        cursor={{ strokeDasharray: "3 3" }}
                                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }}
                                        formatter={(v, name) => [Number(v).toFixed(2), name]}
                                        labelFormatter={() => ""}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    {Object.keys(groups).sort((a, b) => a - b).map((c) => (
                                        <Scatter
                                            key={c}
                                            name={`cluster ${c} (${(groups[c].length * Math.ceil(dom.n / dom.points.length)).toLocaleString("id-ID")} ≈)`}
                                            data={groups[c]}
                                            fill={CLUSTER_COLORS[c % CLUSTER_COLORS.length]}
                                            fillOpacity={0.45}
                                        />
                                    ))}
                                    <Scatter
                                        name="centroid"
                                        data={dom.centroids.map((c, i) => ({ ...c, cluster: i }))}
                                        shape="cross"
                                        fill="#111827"
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    );
                })}
            </div>
            <p className="monitor-footnote">
                Sumber: model multidomain (k={scatter.n_clusters}) + dataset asli, sampel {scatter.sample_per_domain.toLocaleString("id-ID")} baris/domain,
                digenerate {new Date(scatter.generated_at).toLocaleString("id-ID")}.{" "}
                {error && <span style={{ color: "var(--red)" }}>(refresh gagal: {error})</span>}
            </p>
            <button className="btn-refresh" onClick={() => load(true)} disabled={loading}>
                {loading ? "Menghitung ulang..." : "Hitung ulang dari dataset"}
            </button>
        </>
    );
}

function Clustering({ selectedDomain }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadClusters() {
            try {
                setLoading(true);
                const response = await getClusters();
                if (response.status !== "success") {
                    throw new Error(response.message || "Failed to load clustering data");
                }
                setData(response.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadClusters();
    }, []);

    const visibleData = data.filter(
        (row) => selectedDomain === "All Domains" || row.Domain_Type === selectedDomain
    );

    const chartData = visibleData.map((row) => ({
        ...row,
        clusterLabel: `${row.Domain_Type} - C${row.cluster}`,
        Records: Number(row.Records || 0)
    }));

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Clustering" description="Cluster analysis generated from the machine learning pipeline." />
                <div className="loading-state">Loading clustering data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Clustering" description="Cluster analysis generated from the machine learning pipeline." />
                <div className="error-state">Failed to load clustering data: {error}</div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <SectionHeader title="Clustering" description="Cluster analysis generated from the machine learning pipeline." />

            <ChartCard title="Cluster Distribution" description="Number of records assigned to each cluster.">
                {chartData.length === 0 ? (
                    <div className="empty-state">No clustering data available.</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                            <CartesianGrid stroke="#eef0f4" vertical={false} />
                            <XAxis dataKey="clusterLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }} />
                            <Bar dataKey="Records" name="Records" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Sebaran Cluster K-Means (PCA 2D)</h3>
                        <p>Proyeksi 2D hasil clustering per domain — dihitung dari model asli + dataset.</p>
                    </div>
                </div>
                <div style={{ padding: "16px" }}>
                    <KMeansScatterPanel />
                </div>
            </div>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Cluster Summary</h3>
                        <p>Summary statistics generated by the clustering model.</p>
                    </div>
                </div>
                <div className="table-container">
                    {visibleData.length === 0 ? (
                        <div className="empty-state">No cluster summary available.</div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {Object.keys(visibleData[0]).map((col) => (
                                        <th key={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleData.map((row, idx) => (
                                    <tr key={idx}>
                                        {Object.keys(visibleData[0]).map((col) => (
                                            <td key={col}>{row[col] ?? "-"}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Clustering;
