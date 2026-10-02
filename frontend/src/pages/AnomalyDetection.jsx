import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getAttackPredictions, getPerformance } from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const percent = (value) => value === null || value === undefined || value === "" ? "-" : `${(Number(value) * 100).toFixed(1)}%`;

function AnomalyDetection({ selectedDomain }) {
  const [rows, setRows] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionStatus, setPredictionStatus] = useState("loading");
  const [predictionMessage, setPredictionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getPerformance(), getAttackPredictions()])
      .then(([performance, attackTypes]) => {
        if (performance.status !== "success") throw new Error(performance.message || "Model evaluation tidak tersedia");
        setRows(performance.data || []);
        setPredictionStatus(attackTypes.status);
        setPredictionMessage(attackTypes.message || "");
        setPredictions(attackTypes.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const domainPredictions = useMemo(() => predictions.filter((item) => selectedDomain === "All Domains" || item.Domain === selectedDomain), [predictions, selectedDomain]);
  const chartData = domainPredictions.filter((item) => item.Attack_Type.toLowerCase() !== "normal").map((item) => ({
    attack: item.Attack_Type.toUpperCase(), actual: Number(item.Actual_Count || 0), predicted: Number(item.Predicted_Count || 0)
  }));
  const evaluation = rows.find((item) => item.Domain === (selectedDomain === "All Domains" ? "Multidomain" : selectedDomain));

  if (loading) return <div className="page-content"><SectionHeader title="Anomaly Detection" description="Prediksi kategori serangan pada data test yang ditahan dari pelatihan." /><div className="loading-state">Memuat prediksi...</div></div>;
  if (error) return <div className="page-content"><SectionHeader title="Anomaly Detection" description="Prediksi kategori serangan pada data test yang ditahan dari pelatihan." /><div className="error-state">Gagal memuat evaluasi: {error}</div></div>;

  return <div className="page-content">
    <SectionHeader title="Anomaly Detection" description="Hasil prediksi jenis serangan pada test set, dilengkapi evaluasi model per domain." />
    <div className="stats-grid anomaly-stats">
      <StatCard label="Model F1" value={evaluation ? percent(evaluation.F1) : "-"} description={evaluation?.Domain || "Pilih domain"} />
      <StatCard label="Balanced accuracy" value={evaluation ? percent(evaluation.Balanced_Accuracy) : "-"} description="Metrik untuk dua kelas tidak seimbang" />
      <StatCard label="Predicted anomalies" value={evaluation ? Number(evaluation.Predicted_Anomaly_Rate * evaluation.Test).toLocaleString("id-ID") : "-"} description="Pada test set" />
      <StatCard label="Test records" value={evaluation ? Number(evaluation.Test).toLocaleString("id-ID") : "-"} description={evaluation?.Split || "Belum dievaluasi"} />
    </div>

    {predictionStatus !== "success" ? <div className="monitor-banner">{predictionMessage || "Prediksi per jenis serangan belum dibuat."}</div> : <>
      <ChartCard title="Prediksi per jenis serangan" description="Jumlah label aktual dan hasil prediksi pada data test. Bukan traffic live.">
        {chartData.length ? <ResponsiveContainer width="100%" height={360}><BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e9edeb" vertical={false} /><XAxis dataKey="attack" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip /><Legend />
          <Bar dataKey="actual" name="Aktual di test set" fill="#b7c1bc" radius={[4, 4, 0, 0]} /><Bar dataKey="predicted" name="Diprediksi model" fill="#718b81" radius={[4, 4, 0, 0]} />
        </BarChart></ResponsiveContainer> : <div className="empty-state">Tidak ada tipe serangan untuk domain ini pada file prediksi. Jalankan ulang notebook setelah perubahan.</div>}
      </ChartCard>
      <div className="table-card" style={{ marginTop: 20 }}><div className="table-header"><div><h3>Evaluasi tipe serangan</h3><p>Precision, recall, dan F1 dihitung dari label test dan prediksi tipe kelas.</p></div></div>
        <div className="table-container"><table className="data-table"><thead><tr><th>Attack type</th><th>Aktual</th><th>Prediksi</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead><tbody>
          {domainPredictions.filter((item) => item.Attack_Type.toLowerCase() !== "normal").map((item) => <tr key={`${item.Domain}-${item.Attack_Type}`}><td className="strong">{item.Attack_Type.toUpperCase()}</td><td>{Number(item.Actual_Count).toLocaleString("id-ID")}</td><td>{Number(item.Predicted_Count).toLocaleString("id-ID")}</td><td>{percent(item.Precision)}</td><td>{percent(item.Recall)}</td><td>{percent(item.F1)}</td></tr>)}
        </tbody></table></div>
      </div>
    </>}
    <section className="analysis-note"><div className="analysis-note-mark">i</div><div><h3>Cara membaca hasil</h3><p>Angka menunjukkan evaluasi offline pada test set terpisah berdasarkan file sumber bila jumlah file mendukung. Ini belum monitoring traffic real-time. Kelas yang tidak muncul di test set tidak bisa dievaluasi pada split ini.</p></div></section>
  </div>;
}

export default AnomalyDetection;
