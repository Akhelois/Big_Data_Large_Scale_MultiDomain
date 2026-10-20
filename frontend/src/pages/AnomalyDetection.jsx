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
    LuDatabase,
    LuList,
    LuTarget,
    LuTriangleAlert
} from "react-icons/lu";

import { getAnomalyLog, getAttackPredictions, getPerformance } from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const percent = (v) => v === null || v === undefined || v === "" ? "-" : `${(Number(v) * 100).toFixed(1)}%`;

function AnomalyDetection({ selectedDomain }) {
    const [rows, setRows] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [predictionStatus, setPredictionStatus] = useState("loading");
    const [predictionMessage, setPredictionMessage] = useState("");
    const [log, setLog] = useState({ status: "loading", data: [], evaluated_at: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([getPerformance(), getAttackPredictions(), getAnomalyLog()])
            .then(([performance, attackTypes, anomalyLog]) => {
                if (performance.status !== "success") throw new Error(performance.message || "Model evaluation tidak tersedia");
                setRows(performance.data || []);
                setPredictionStatus(attackTypes.status);
                setPredictionMessage(attackTypes.message || "");
                setPredictions(attackTypes.data || []);
                setLog(anomalyLog || { status: "unavailable", data: [], evaluated_at: null });
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const domainPredictions = predictions.filter(
        (item) => selectedDomain === "All Domains" || item.Domain === selectedDomain
    );

    const logEntries = (log.data || []).filter(
        (entry) => selectedDomain === "All Domains" || entry.Domain === selectedDomain
    );

    const chartData = domainPredictions
        .filter((item) => item.Attack_Type.toLowerCase() !== "normal")
        .map((item) => ({
            attack: item.Attack_Type.toUpperCase(),
            actual: Number(item.Actual_Count || 0),
            predicted: Number(item.Predicted_Count || 0)
        }));

    const evaluation = rows.find(
        (item) => item.Domain === (selectedDomain === "All Domains" ? "Multidomain" : selectedDomain)
    );

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Anomaly Detection" description="Prediksi kategori serangan pada data test." />
                <div className="loading-state">Memuat prediksi...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Anomaly Detection" description="Prediksi kategori serangan pada data test." />
                <div className="error-state">Gagal memuat evaluasi: {error}</div>
            </div>
        );
    }

    const evaluatedAt = log.evaluated_at
        ? new Date(log.evaluated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
        : null;

    return (
        <div className="page-content">
            <SectionHeader title="Anomaly Detection" description="Hasil prediksi jenis serangan pada test set, dilengkapi evaluasi model per domain." />

            <div className="stats-grid anomaly-stats">
                <StatCard icon={LuTarget} label="Model F1" value={evaluation ? percent(evaluation.F1) : "-"} description={evaluation?.Domain || "Pilih domain"} />
                <StatCard icon={LuActivity} label="Balanced accuracy" value={evaluation ? percent(evaluation.Balanced_Accuracy) : "-"} description="Metrik untuk dua kelas tidak seimbang" />
                <StatCard
                    icon={LuTriangleAlert}
                    label="Predicted anomalies"
                    value={evaluation ? (Number(evaluation.Predicted_Anomaly_Rate || 0) * Number(evaluation.Test || 0)).toLocaleString("id-ID") : "-"}
                    description="Pada test set"
                />
                <StatCard icon={LuDatabase} label="Test records" value={evaluation ? Number(evaluation.Test).toLocaleString("id-ID") : "-"} description={evaluation?.Split || "Belum dievaluasi"} />
            </div>

            {predictionStatus !== "success" ? (
                <div className="monitor-banner">{predictionMessage || "Prediksi per jenis serangan belum dibuat."}</div>
            ) : (
                <>
                    <ChartCard title="Prediksi per jenis serangan" description="Jumlah label aktual dan hasil prediksi pada data test. Bukan traffic live.">
                        {chartData.length ? (
                            <ResponsiveContainer width="100%" height={340}>
                                <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                                    <CartesianGrid stroke="#eef0f4" vertical={false} />
                                    <XAxis dataKey="attack" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="actual" name="Aktual di test set" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="predicted" name="Diprediksi model" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state">Tidak ada tipe serangan untuk domain ini. Jalankan ulang notebook setelah perubahan.</div>
                        )}
                    </ChartCard>

                    <div className="table-card">
                        <div className="table-header">
                            <div>
                                <h3>Evaluasi tipe serangan</h3>
                                <p>Precision, recall, dan F1 dihitung dari label test dan prediksi tipe kelas.</p>
                            </div>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Attack type</th>
                                        <th>Aktual</th>
                                        <th>Prediksi</th>
                                        <th>Precision</th>
                                        <th>Recall</th>
                                        <th>F1</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domainPredictions
                                        .filter((item) => item.Attack_Type.toLowerCase() !== "normal")
                                        .map((item) => (
                                            <tr key={`${item.Domain}-${item.Attack_Type}`}>
                                                <td className="strong">{item.Attack_Type.toUpperCase()}</td>
                                                <td>{Number(item.Actual_Count).toLocaleString("id-ID")}</td>
                                                <td>{Number(item.Predicted_Count).toLocaleString("id-ID")}</td>
                                                <td>{percent(item.Precision)}</td>
                                                <td>{percent(item.Recall)}</td>
                                                <td>{percent(item.F1)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>
                            <LuList size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                            Anomaly Log
                        </h3>
                        <p>
                            Deteksi anomali per tipe serangan dari hasil evaluasi model.
                            {evaluatedAt ? ` Run evaluasi terakhir: ${evaluatedAt}.` : ""}
                        </p>
                    </div>
                </div>
                <div className="table-container">
                    {log.status === "success" && logEntries.length ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Severity</th>
                                    <th>Domain</th>
                                    <th>Attack type</th>
                                    <th>Detections</th>
                                    <th>Aktual</th>
                                    <th>Precision</th>
                                    <th>Recall</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logEntries.map((entry, index) => (
                                    <tr key={`${entry.Domain}-${entry.Attack_Type}-${index}`}>
                                        <td>
                                            <span className={`log-badge ${entry.Severity}`}>
                                                <span className="log-dot" />
                                                {entry.Severity === "high" ? "High" : entry.Severity === "medium" ? "Medium" : "Low"}
                                            </span>
                                        </td>
                                        <td className="strong">{entry.Domain}</td>
                                        <td>{entry.Attack_Type}</td>
                                        <td>{Number(entry.Predicted_Count).toLocaleString("id-ID")}</td>
                                        <td>{Number(entry.Actual_Count).toLocaleString("id-ID")}</td>
                                        <td>{percent(entry.Precision)}</td>
                                        <td>{percent(entry.Recall)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            {log.status === "success"
                                ? "Tidak ada anomali terdeteksi untuk domain ini."
                                : log.message || "Log anomali belum tersedia."}
                        </div>
                    )}
                </div>
            </div>

            <section className="analysis-note">
                <div className="analysis-note-mark">i</div>
                <div>
                    <h3>Cara membaca hasil</h3>
                    <p>Angka menunjukkan evaluasi offline pada test set terpisah. Ini belum monitoring traffic real-time. Kelas yang tidak muncul di test set tidak bisa dievaluasi pada split ini.</p>
                </div>
            </section>
        </div>
    );
}

export default AnomalyDetection;
