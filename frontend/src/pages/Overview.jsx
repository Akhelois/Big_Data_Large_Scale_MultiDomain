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
const hasUpdatedEvaluation = (rows) => rows.some((row) => row.IF_F1 !== undefined && row.Dummy_F1 !== undefined);

const COLORS = {
    primary: "#2563eb",
    secondary: "#94a3b8",
    muted: "#cbd5e1"
};

function getMonitorStatus(row, currentEvaluation) {
    if (!row) return { label: "No result", tone: "muted" };
    if (Number(row.Test || 0) < 100) return { label: "Small test set", tone: "warning" };
    if (!currentEvaluation) return { label: "Old evaluation", tone: "muted" };
    if (Number(row.Balanced_Accuracy || 0) < 0.65 || Number(row.F1 || 0) + 0.005 < Number(row.Dummy_F1 || 0)) {
        return { label: "Needs review", tone: "warning" };
    }
    return { label: "Checks pass", tone: "good" };
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
                if (failed) throw new Error(failed.message || "A data source could not be loaded");
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
        "Labeled positive": Number(row.Positive_Rate || 0),
        "Predicted positive": Number(row.Predicted_Anomaly_Rate || 0)
    }));

    const clusterData = clusters
        .filter((row) => selectedDomain === "All Domains" || row.Domain_Type === selectedDomain)
        .map((row) => ({ cluster: `${row.Domain_Type} - C${row.cluster}`, Records: Number(row.Records || 0) }));

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Monitoring Overview" description="Batch model health and dataset coverage." />
                <div className="loading-state">Loading monitoring data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Monitoring Overview" description="Batch model health and dataset coverage." />
                <div className="error-state">Failed to load monitoring data: {error}</div>
                <button className="monitor-refresh" onClick={() => setReload((v) => v + 1)}>
                    <LuRefreshCw size={13} /> Retry
                </button>
            </div>
        );
    }

    const activeStatus = getMonitorStatus(activeModel, currentEvaluation);

    return (
        <div className="page-content monitoring-page">
            <div className="monitor-heading-row">
                <SectionHeader
                    title="Monitoring Overview"
                    description="Offline evaluation health and dataset coverage for the selected domain."
                />
                <div className="monitor-toolbar">
                    {lastChecked && <span>Checked {lastChecked.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
                    <button className="monitor-refresh" onClick={() => setReload((v) => v + 1)}>
                        <LuRefreshCw size={13} /> Refresh
                    </button>
                </div>
            </div>

            {!currentEvaluation && (
                <div className="monitor-banner warning">
                    Evaluation files are from the previous Isolation Forest run. Rerun the notebook to publish classifier, baseline, and per-domain monitoring metrics.
                </div>
            )}

            {currentEvaluation && domainsNeedingReview > 0 && (
                <div className="monitor-banner warning">
                    {selectedDomain === "All Domains"
                        ? `${domainsNeedingReview} domains need review. The combined classifier receives Domain_Type as an input; its aggregate score may partly reflect domain identity.`
                        : `${selectedDomain} is flagged for review. Treat this score as a batch evaluation, not proof of live anomaly detection.`}
                </div>
            )}

            <div className="stats-grid monitoring-stats">
                <StatCard icon={LuDatabase} label="Source records" value={number.format(totals.records)} description="In selected dataset files" />
                <StatCard icon={LuDatabase} label="Source files" value={number.format(totals.files)} description="Included in this selection" />
                <StatCard icon={LuActivity} label="Model F1" value={percentage(activeModel?.F1)} description={activeModel?.Domain || "No evaluation"} />
                <StatCard icon={LuShieldCheck} label="Balanced accuracy" value={activeModel ? percentage(activeModel.Balanced_Accuracy) : "-"} description="Weights both label classes" />
                <StatCard
                    icon={activeStatus.tone === "good" ? LuCircleCheck : LuTriangleAlert}
                    label="Evaluation status"
                    value={activeStatus.label}
                    description={activeModel ? `${number.format(Number(activeModel.Test || 0))} test rows` : "No matching model"}
                />
            </div>

            <div className="chart-grid two monitoring-charts">
                <ChartCard title="Model quality by domain" description="F1 compared with the majority-class baseline.">
                    {qualityData.length ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={qualityData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eef0f4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                                <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                                <Tooltip formatter={(v) => percentage(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="F1" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                {currentEvaluation && <Bar dataKey="Baseline" fill={COLORS.muted} radius={[4, 4, 0, 0]} />}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">No domain evaluation available.</div>}
                </ChartCard>

                <ChartCard title="Label and prediction rates" description="Shows whether the model flags a similar share of records as the labels.">
                    {rateData.some((row) => row["Labeled positive"] > 0 || row["Predicted positive"] > 0) ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={rateData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eef0f4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                                <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                                <Tooltip formatter={(v) => percentage(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="Labeled positive" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Predicted positive" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">Positive-rate detail not available in this evaluation.</div>}
                </ChartCard>
            </div>

            <div className="chart-grid monitoring-charts">
                <ChartCard title="Cluster counts in model sample" description="Sampled assignments by domain and cluster.">
                    {clusterData.length ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={clusterData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eef0f4" vertical={false} />
                                <XAxis dataKey="cluster" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => number.format(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                                <Tooltip formatter={(v) => number.format(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }} />
                                <Bar dataKey="Records" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state">No cluster summary available.</div>}
                </ChartCard>
            </div>

            <div className="table-card monitor-table-card">
                <div className="table-header">
                    <div>
                        <h3>Domain health</h3>
                        <p>Review score quality, baseline gap, and test-set size together.</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Records</th>
                                <th>Test rows</th>
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
                This page reads generated CSV summaries. Refresh reloads those files; it does not stream live events or rerun model training.
                Review flags are screening heuristics: test sets below 100 rows, balanced accuracy below 65%, or F1 more than 0.5 pp below the majority baseline.
            </p>
        </div>
    );
}

export default Overview;
