import { useEffect, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import {
    LuActivity,
    LuCircleCheck,
    LuDatabase,
    LuRefreshCw,
    LuShieldCheck,
    LuTriangleAlert
} from "react-icons/lu";

import { getClusters, getDataset, getOverview, getPerformance } from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const number = new Intl.NumberFormat("id-ID");
const percentage = (v) => v === null || v === undefined || v === "" ? "-" : `${(Number(v) * 100).toFixed(1)}%`;
const hasUpdatedEvaluation = (rows) => rows.some((row) => row.Sklearn_IF_F1 !== undefined && row.Dummy_F1 !== undefined);

const COLORS = {
    primary: "#0f766e",
    secondary: "#a8a29e",
    muted: "#d6d3d1"
};

function getMonitorStatus(row, currentEvaluation) {
    if (!row) return { label: "Tidak ada hasil", tone: "muted" };
    if (Number(row.Test || 0) < 100) return { label: "Test set kecil", tone: "warning" };
    if (!currentEvaluation) return { label: "Evaluasi lama", tone: "muted" };
    if (Number(row.Balanced_Accuracy || 0) < 0.65 || Number(row.F1 || 0) + 0.005 < Number(row.Dummy_F1 || 0)) {
        return { label: "Perlu ditinjau", tone: "warning" };
    }
    return { label: "Lolos pemeriksaan", tone: "good" };
}

function Overview({ selectedDomain }) {
    const [overview, setOverview] = useState(null);
    const [dataset, setDataset] = useState([]);
    const [performance, setPerformance] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [lastChecked, setLastChecked] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        Promise.all([getOverview(), getDataset(), getPerformance(), getClusters()])
            .then(([ov, ds, pf, cl]) => {
                const failed = [ov, ds, pf, cl].find((r) => r.status !== "success");
                if (failed) throw new Error(failed.message || "Satu sumber data gagal dimuat");
                if (!active) return;
                setOverview(ov.data);
                setDataset(ds.data || []);
                setPerformance(pf.data || []);
                setClusters(cl.data || []);
                setLastChecked(new Date());
            })
            .catch((err) => { if (active) setError(err.message); })
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [reload]);

    const currentEvaluation = hasUpdatedEvaluation(performance);
    const activeModel = performance.find((row) => row.Domain === (selectedDomain === "All Domains" ? "Multidomain" : selectedDomain));
    const visibleFiles = selectedDomain === "All Domains" ? dataset : dataset.filter((row) => row.Domain === selectedDomain);
    const visiblePerformance = selectedDomain === "All Domains"
        ? performance.filter((row) => row.Domain !== "Multidomain")
        : performance.filter((row) => row.Domain === selectedDomain);

    const fileTotals = visibleFiles.reduce((acc, row) => ({
        records: acc.records + Number(row.Records || 0),
        files: acc.files + 1
    }), { records: 0, files: 0 });

    const totals = {
        records: fileTotals.records || (selectedDomain === "All Domains" ? Number(overview?.totalRecords || 0) : 0),
        files: fileTotals.files || (selectedDomain === "All Domains" ? Number(overview?.totalFiles || 0) : 0)
    };

    const domainsNeedingReview = visiblePerformance.filter((row) => getMonitorStatus(row, currentEvaluation).tone !== "good").length;

    const qualityData = visiblePerformance.map((row) => ({
        domain: row.Domain,
        F1: Number(row.F1 || 0),
        Baseline: currentEvaluation ? Number(row.Dummy_F1 || 0) : null
    }));

    const rateData = visiblePerformance.map((row) => ({
        domain: row.Domain,
        "Label positif": Number(row.Positive_Rate || 0),
        "Prediksi positif": Number(row.Predicted_Anomaly_Rate || 0)
    }));

    const clusterData = clusters
        .filter((row) => selectedDomain === "All Domains" || row.Domain_Type === selectedDomain)
        .map((row) => ({ cluster: `${row.Domain_Type} - C${row.cluster}`, Records: Number(row.Records || 0) }));

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Ringkasan Monitoring" description="Kesehatan model batch dan cakupan dataset." />
                <div className="loading-state">Memuat data monitoring...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Ringkasan Monitoring" description="Kesehatan model batch dan cakupan dataset." />
                <div className="error-state">Gagal memuat data monitoring: {error}</div>
                <button className="monitor-refresh" onClick={() => setReload((v) => v + 1)}>
                    <LuRefreshCw size={13} /> Coba lagi
                </button>
            </div>
        );
    }

    const activeStatus = getMonitorStatus(activeModel, currentEvaluation);

    return (
        <div className="page-content monitoring-page">
            <div className="monitor-heading-row">
                <SectionHeader
                    title="Ringkasan Monitoring"
                    description="Kesehatan evaluasi offline dan cakupan dataset untuk domain terpilih."
                />
                <div className="monitor-toolbar">
                    {lastChecked && <span>Diperiksa {lastChecked.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
                    <button className="monitor-refresh" onClick={() => setReload((v) => v + 1)}>
                        <LuRefreshCw size={13} /> Muat ulang
                    </button>
                </div>
            </div>

            {!currentEvaluation && (
                <div className="monitor-banner warning">
                    File evaluasi masih dari run Isolation Forest sebelumnya. Jalankan ulang notebook untuk mem-publish metrik classifier, baseline, dan monitoring per domain.
                </div>
            )}

            {currentEvaluation && domainsNeedingReview > 0 && (
                <div className="monitor-banner warning">
                    {selectedDomain === "All Domains"
                        ? `${domainsNeedingReview} domain perlu ditinjau. Classifier gabungan menerima Domain_Type sebagai input; skor agregatnya bisa sebagian mencerminkan identitas domain.`
                        : `${selectedDomain} ditandai untuk ditinjau. Anggap ini evaluasi batch, bukan bukti deteksi anomali live.`}
                </div>
            )}

            <div className="stats-grid monitoring-stats">
                <StatCard icon={LuDatabase} label="Total data" value={number.format(totals.records)} description="Pada file dataset terpilih" />
                <StatCard icon={LuDatabase} label="Jumlah file" value={number.format(totals.files)} description="Termasuk dalam pilihan ini" />
                <StatCard icon={LuActivity} label="Model F1" value={percentage(activeModel?.F1)} description={activeModel?.Domain || "Belum ada evaluasi"} />
                <StatCard icon={LuShieldCheck} label="Balanced accuracy" value={activeModel ? percentage(activeModel.Balanced_Accuracy) : "-"} description="Menimbang kedua kelas label" />
                <StatCard
                    icon={activeStatus.tone === "good" ? LuCircleCheck : LuTriangleAlert}
                    label="Status evaluasi"
                    value={activeStatus.label}
                    description={activeModel ? `${number.format(Number(activeModel.Test || 0))} baris uji` : "Tidak ada model yang cocok"}
                />
            </div>

            <div className="chart-grid two monitoring-charts">
                <ChartCard title="Kualitas model per domain" description="F1 dibandingkan baseline kelas mayoritas.">
                    {qualityData.length ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={qualityData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eae8e4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#a8a29e" }} />
                                <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                <Tooltip formatter={(v) => percentage(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="F1" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                {currentEvaluation && <Bar dataKey="Baseline" fill={COLORS.muted} radius={[4, 4, 0, 0]} />}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">Belum ada evaluasi domain.</div>}
                </ChartCard>

                <ChartCard title="Rasio label dan prediksi" description="Menunjukkan apakah model menandai porsi data yang mirip dengan label.">
                    {rateData.some((row) => row["Label positif"] > 0 || row["Prediksi positif"] > 0) ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={rateData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eae8e4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#a8a29e" }} />
                                <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                <Tooltip formatter={(v) => percentage(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="Label positif" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Prediksi positif" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">Detail rasio positif tidak tersedia di evaluasi ini.</div>}
                </ChartCard>
            </div>

            <div className="chart-grid monitoring-charts">
                <ChartCard title="Jumlah cluster pada sampel model" description="Penugasan sampel per domain dan cluster.">
                    {clusterData.length ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={clusterData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eae8e4" vertical={false} />
                                <XAxis dataKey="cluster" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => number.format(v)} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                <Tooltip formatter={(v) => number.format(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 }} />
                                <Bar dataKey="Records" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">Belum ada ringkasan cluster.</div>}
                </ChartCard>
            </div>

            <div className="table-card monitor-table-card">
                <div className="table-header">
                    <div>
                        <h3>Kesehatan domain</h3>
                        <p>Tinjau kualitas skor, selisih baseline, dan ukuran test set sekaligus.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Data</th>
                                <th>Baris uji</th>
                                <th>Split</th>
                                <th>F1</th>
                                <th>Baseline F1</th>
                                <th>Balanced accuracy</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visiblePerformance.map((row) => {
                                const status = getMonitorStatus(row, currentEvaluation);
                                const records = dataset.filter((f) => f.Domain === row.Domain).reduce((sum, f) => sum + Number(f.Records || 0), 0);
                                return (
                                    <tr key={row.Domain}>
                                        <td className="strong">{row.Domain}</td>
                                        <td>{number.format(records)}</td>
                                        <td>{number.format(Number(row.Test || 0))}</td>
                                        <td>{row.Split || "Previous run"}</td>
                                        <td>{percentage(row.F1)}</td>
                                        <td>{currentEvaluation ? percentage(row.Dummy_F1) : "-"}</td>
                                        <td>{currentEvaluation ? percentage(row.Balanced_Accuracy) : "-"}</td>
                                        <td><span className={`monitor-status ${status.tone}`}>{status.label}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="monitor-footnote">
                Halaman ini membaca file ringkasan CSV yang digenerate. Muat ulang hanya membaca ulang file tersebut, bukan streaming event live atau melatih ulang model.
                Flag peninjauan adalah heuristik screening: test set di bawah 100 baris, balanced accuracy di bawah 65%, atau F1 lebih dari 0,5 pp di bawah baseline kelas mayoritas.
            </p>
        </div>
    );
}

export default Overview;
