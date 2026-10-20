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

const ACCENT = "#2563eb";
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
                    throw new Error(response.message || "Failed to load performance data");
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
                <SectionHeader title="Model Performance" description="Evaluation results across the monitored domains." />
                <div className="loading-state">
                    <LuLoader size={18} className="spin" />
                    <span>Loading model performance...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Model Performance" description="Evaluation results across the monitored domains." />
                <div className="error-state">
                    <LuTriangleAlert size={18} />
                    <span>Failed to load performance: {error}</span>
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
                description="Evaluation results across the monitored domains."
            />

            <div className="stats-grid">
                <StatCard icon={LuChartBar} label="Domains evaluated" value={data.length} description="Rows in the evaluation report" />
                <StatCard
                    icon={LuTrendingUp}
                    label="Best F1 score"
                    value={bestDomain ? fmtPct(bestDomain.F1) : "-"}
                    description={bestDomain ? bestDomain.Domain : "No data"}
                />
                <StatCard icon={LuGauge} label="Average F1" value={fmtPct(avgF1)} description="Mean across selected domains" />
                <StatCard icon={LuShieldCheck} label="Records evaluated" value={number.format(totalRecords)} description="Train + test coverage" />
            </div>

            <ChartCard title="Performance by Domain" description="Accuracy, Precision, Recall and F1 score per domain.">
                {chartData.length ? (
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={3}>
                            <CartesianGrid stroke="#eef0f4" vertical={false} />
                            <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                            <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                            <Tooltip
                                cursor={{ fill: "rgba(37,99,235,0.04)" }}
                                formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                            <Bar dataKey="Accuracy" fill={ACCENT} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Precision" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Recall" fill="#d97706" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="F1" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="empty-state">No evaluation rows for this selection.</div>
                )}
            </ChartCard>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Detailed Evaluation</h3>
                        <p>Model metrics for each domain.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Records</th>
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
