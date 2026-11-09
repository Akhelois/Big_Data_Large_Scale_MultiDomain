import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import {
    LuChartBar,
    LuGauge,
    LuLoader,
    LuShieldCheck,
    LuTrendingUp,
    LuTriangleAlert
} from "react-icons/lu";

import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import { getPerformance } from "../api/dashboardApi";
import "../styles/pages/Pages.css";

const ACCENT = "#0f766e";
const number = new Intl.NumberFormat("id-ID");

const fmtPct = (v) =>
    v === null || v === undefined || v === "" || Number.isNaN(Number(v))
        ? "-"
        : `${(Number(v) * 100).toFixed(2)}%`;

const metric = (row, key) => {
    const v = Number(row[key]);
    return Number.isFinite(v) ? v : 0;
};

function MetricBar({ value }) {
    const pct = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
    const tone = pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";

    return (
        <div className="metric-cell">
            <span className="metric-value">{fmtPct(value)}</span>
            <span className="metric-bar">
                <span className={`metric-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
            </span>
        </div>
    );
}

function ModelPerformance({ selectedDomain }) {
    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadPerformance() {
            try {
                setLoading(true);
                const response = await getPerformance();
                if (response.status !== "success") {
                    throw new Error(response.message || "Gagal memuat data performa");
                }
                if (active) setPerformanceData(response.data || []);
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        }
        loadPerformance();

        return () => { active = false; };
    }, []);

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Model Performance" description="Hasil evaluasi di seluruh domain yang dimonitor." />
                <div className="loading-state">
                    <LuLoader size={18} className="spin" />
                    <span>Memuat performa model...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Model Performance" description="Hasil evaluasi di seluruh domain yang dimonitor." />
                <div className="error-state">
                    <LuTriangleAlert size={18} />
                    <span>Gagal memuat performa: {error}</span>
                </div>
            </div>
        );
    }

    const data = selectedDomain === "All Domains"
        ? performanceData
        : performanceData.filter((item) => item.Domain === selectedDomain);

    const chartData = data.map((item) => ({
        domain: item.Domain,
        Accuracy: metric(item, "Accuracy"),
        Precision: metric(item, "Precision"),
        Recall: metric(item, "Recall"),
        F1: metric(item, "F1")
    }));

    const bestDomain = data.reduce(
        (best, item) => (metric(item, "F1") > metric(best || {}, "F1") ? item : best),
        null
    );
    const avgF1 = data.length
        ? data.reduce((sum, item) => sum + metric(item, "F1"), 0) / data.length
        : 0;
    const totalRecords = data.reduce((sum, item) => sum + Number(item.Records || 0), 0);

    return (
        <div className="page-content">
            <SectionHeader
                title="Model Performance"
                description="Hasil evaluasi di seluruh domain yang dimonitor."
            />

            <div className="stats-grid">
                <StatCard icon={LuChartBar} label="Domain dievaluasi" value={data.length} description="Baris pada laporan evaluasi" />
                <StatCard
                    icon={LuTrendingUp}
                    label="Skor F1 terbaik"
                    value={bestDomain ? fmtPct(bestDomain.F1) : "-"}
                    description={bestDomain ? bestDomain.Domain : "Tidak ada data"}
                />
                <StatCard icon={LuGauge} label="Rata-rata F1" value={fmtPct(avgF1)} description="Rata-rata pada domain terpilih" />
                <StatCard icon={LuShieldCheck} label="Data dievaluasi" value={number.format(totalRecords)} description="Cakupan train + test" />
            </div>

            <ChartCard title="Performa per Domain" description="Skor Accuracy, Precision, Recall, dan F1 per domain.">
                {chartData.length ? (
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={3}>
                            <CartesianGrid stroke="#eae8e4" vertical={false} />
                            <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#a8a29e" }} />
                            <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                            <Tooltip
                                cursor={{ fill: "rgba(15,118,110,0.04)" }}
                                formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                                contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                            <Bar dataKey="Accuracy" fill={ACCENT} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Precision" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Recall" fill="#d97706" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="F1" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="empty-state">Tidak ada baris evaluasi untuk pilihan ini.</div>
                )}
            </ChartCard>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Evaluasi Detail</h3>
                        <p>Metrik model untuk setiap domain.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Data</th>
                                <th>Train</th>
                                <th>Test</th>
                                <th>Accuracy</th>
                                <th>Balanced Acc.</th>
                                <th>Precision</th>
                                <th>Recall</th>
                                <th>F1 Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item) => (
                                <tr key={item.Domain}>
                                    <td className="strong">{item.Domain}</td>
                                    <td>{number.format(Number(item.Records || 0))}</td>
                                    <td>{number.format(Number(item.Train || 0))}</td>
                                    <td>{number.format(Number(item.Test || 0))}</td>
                                    <td>{fmtPct(item.Accuracy)}</td>
                                    <td>{fmtPct(item.Balanced_Accuracy)}</td>
                                    <td>{fmtPct(item.Precision)}</td>
                                    <td>{fmtPct(item.Recall)}</td>
                                    <td><MetricBar value={item.F1} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ModelPerformance;
