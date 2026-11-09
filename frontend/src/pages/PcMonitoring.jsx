import { useEffect, useMemo, useRef, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import {
    LuTriangleAlert,
    LuCpu,
    LuHardDrive,
    LuMemoryStick,
    LuMonitor,
    LuRefreshCw,
    LuTerminal,
    LuWifi
} from "react-icons/lu";

import {
    getMonitoringAnomalies,
    getMonitoringCorrelation,
    getMonitoringHistory,
    getMonitoringHosts,
    getMonitoringSummary
} from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const REFRESH_MS = 5000;

const timeLabel = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const onlineOf = (host) => {
    if (!host?.last_seen) return false;
    return Date.now() - new Date(host.last_seen).getTime() < 120000;
};

const isDiscovered = (host) => num(host?.cpu_percent) === null;
const hasAgent = (host) => !isDiscovered(host);

const num = (v) => (v === null || v === undefined ? null : Number(v));
const fmt = (v, suffix = "") => (num(v) === null ? "-" : `${num(v)}${suffix}`);
const metricLabel = (metric) => ({
    cpu_percent: "CPU",
    mem_percent: "RAM",
    disk_percent: "Disk"
}[metric] || metric);

const CORR_LABELS = {
    cpu_percent: "CPU %",
    mem_percent: "RAM %",
    mem_used_gb: "RAM GB",
    disk_percent: "Disk %",
    disk_used_gb: "Disk GB",
    net_recv_kbps: "Net ↓",
    net_sent_kbps: "Net ↑"
};

function corrColor(v) {
    const clamp = Math.max(-1, Math.min(1, v));
    if (clamp >= 0) {
        const a = 0.15 + clamp * 0.85;
        return `rgba(15, 118, 110, ${a.toFixed(2)})`;
    }
    const a = 0.15 + Math.abs(clamp) * 0.85;
    return `rgba(220, 38, 38, ${a.toFixed(2)})`;
}

function HostCorrelationHeatmap({ host, discovered }) {
    const [corr, setCorr] = useState(null);

    useEffect(() => {
        let active = true;
        const fetchCorr = () => {
            getMonitoringCorrelation(host)
                .then((res) => { if (active) setCorr(res.data || null); })
                .catch(() => {});
        };
        fetchCorr();
        const timer = setInterval(fetchCorr, REFRESH_MS);
        return () => { active = false; clearInterval(timer); };
    }, [host]);

    if (!corr || !corr.columns?.length) {
        return (
            <div className="empty-cell">
                {discovered
                    ? "Host ini hasil scan jaringan (tanpa agent), tidak ada snapshot metrik untuk dihitung."
                    : "Menunggu cukup snapshot metrik untuk menghitung korelasi..."}
            </div>
        );
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 480 }}>
                <thead>
                    <tr>
                        <th></th>
                        {corr.columns.map((c) => (
                            <th key={c} style={{ textAlign: "center" }}>{CORR_LABELS[c] || c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {corr.columns.map((rowC, i) => (
                        <tr key={rowC}>
                            <td className="strong">{CORR_LABELS[rowC] || rowC}</td>
                            {corr.matrix[i].map((v, j) => (
                                <td
                                    key={j}
                                    style={{
                                        background: v === null ? "transparent" : corrColor(v),
                                        color: v !== null && Math.abs(v) > 0.55 ? "#ffffff" : "inherit",
                                        textAlign: "center",
                                        fontWeight: i === j ? 700 : 500
                                    }}
                                    title={v === null ? `${CORR_LABELS[rowC]} vs ${CORR_LABELS[corr.columns[j]]}: tidak terdefinisi (data konstan)` : `${CORR_LABELS[rowC]} vs ${CORR_LABELS[corr.columns[j]]}: r=${v}`}
                                >
                                    {v === null ? "-" : v.toFixed(2)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="monitor-footnote" style={{ borderTop: "none", paddingTop: 8, marginTop: 0 }}>
                Korelasi Pearson dari {corr.n.toLocaleString("id-ID")} snapshot live host <strong>{corr.hostname || "-"}</strong>. Biru = positif, merah = negatif.
            </p>
        </div>
    );
}

function PcMonitoring() {
    const [hosts, setHosts] = useState([]);
    const [summary, setSummary] = useState(null);
    const [anomalies, setAnomalies] = useState([]);
    const [selectedHost, setSelectedHost] = useState("");
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [windowMinutes, setWindowMinutes] = useState(30);
    const timerRef = useRef(null);
    const selectedHostRef = useRef("");

    selectedHostRef.current = selectedHost;

    const refresh = async () => {
        try {
            const [hostsRes, summaryRes, anomaliesRes] = await Promise.all([
                getMonitoringHosts(),
                getMonitoringSummary(),
                getMonitoringAnomalies(50)
            ]);
            const nextHosts = hostsRes.data || [];
            setHosts(nextHosts);
            setSummary(summaryRes.data || null);
            setAnomalies(anomaliesRes.data || []);
            setError("");

            let current = selectedHostRef.current;
            if (!current || !nextHosts.some((h) => h.host_id === current)) {
                const online = nextHosts.find((h) => onlineOf(h));
                current = (online || nextHosts[0])?.host_id || "";
            }
            if (current) {
                const histRes = await getMonitoringHistory(current, windowMinutes);
                if (selectedHostRef.current === current || !selectedHostRef.current) {
                    setHistory(histRes.data || []);
                }
                setSelectedHost(current);
            } else {
                setHistory([]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        timerRef.current = setInterval(refresh, REFRESH_MS);
        return () => clearInterval(timerRef.current);
    }, [windowMinutes]);

    const selected = useMemo(
        () => hosts.find((h) => h.host_id === selectedHost) || null,
        [hosts, selectedHost]
    );

    const onlineCount = hosts.filter((h) => onlineOf(h)).length;

    const chartData = useMemo(
        () =>
            history
                .map((row) => ({
                    time: timeLabel(row.ts),
                    cpu: num(row.cpu_percent),
                    mem: num(row.mem_percent),
                    disk: num(row.disk_percent),
                    net_recv: num(row.net_recv_kbps),
                    net_sent: num(row.net_sent_kbps)
                }))
                .filter((row) => row.cpu !== null || row.mem !== null),
        [history]
    );

    const latest = history.length ? history[history.length - 1] : null;

    return (
        <div className="page-content">
            <SectionHeader
                title="PC Monitoring"
                description={`Metrik live dari PC di jaringan lokal via agent. Auto-refresh tiap ${REFRESH_MS / 1000} detik.`}
            />

            {loading ? (
                <div className="loading-state">Memuat data monitoring...</div>
            ) : error ? (
                <div className="error-state">Gagal memuat monitoring: {error}</div>
            ) : hosts.length === 0 ? (
                <div className="monitor-banner">
                    Belum ada host terdaftar. Backend otomatis memonitor dirinya sendiri (agent built-in) — pastikan backend berjalan.
                    Untuk memonitor PC lain, unduh agent dari backend lalu jalankan di PC tersebut:{" "}
                    <code>curl http://&lt;ip-backend&gt;:8000/api/monitoring/agent-script -o agent.py</code> →{" "}
                    <code>pip install psutil &amp;&amp; python agent.py --backend http://&lt;ip-backend&gt;:8000</code>
                </div>
            ) : (
                <>
                    {!onlineCount && hosts.some(hasAgent) && (
                        <div className="monitor-banner warning">
                            Semua host dengan agent sedang offline (tidak ada data 2 menit terakhir). Pastikan backend berjalan — agent built-in aktif otomatis saat backend menyala.
                        </div>
                    )}

                    <div className="stats-grid anomaly-stats">
                        <StatCard icon={LuMonitor} label="Host terdaftar" value={summary?.total_hosts ?? hosts.length} description={`${summary?.online_hosts ?? 0} online · ${summary?.discovered_hosts ?? 0} via scan jaringan`} />
                        <StatCard icon={LuCpu} label="CPU rata-rata (online)" value={summary?.avg_cpu != null ? `${summary.avg_cpu}%` : "-"} description="Seluruh host online" />
                        <StatCard icon={LuMemoryStick} label="RAM rata-rata (online)" value={summary?.avg_mem != null ? `${summary.avg_mem}%` : "-"} description="Seluruh host online" />
                        <StatCard icon={LuTriangleAlert} label="Anomali 24 jam" value={summary?.anomalies_24h ?? 0} description="CPU/RAM/disk melewati batas" />
                    </div>

                    <div className="table-card">
                        <div className="table-header">
                            <div>
                                <h3>Host di jaringan lokal</h3>
                                <p>Klik host untuk melihat detail time-series di bawah. Host "Terdeteksi" ditemukan via scan jaringan tanpa agent.</p>
                            </div>
                            <button className="btn-refresh" onClick={refresh} title="Refresh sekarang">
                                <LuRefreshCw size={14} /> Muat ulang
                            </button>
                        </div>
                        <div className="table-container scroll-y">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Hostname</th>
                                        <th>IP</th>
                                        <th>OS</th>
                                        <th>CPU</th>
                                        <th>RAM</th>
                                        <th>Disk</th>
                                        <th>Net KB/s</th>
                                        <th>Status</th>
                                        <th>Last seen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hosts.map((h) => (
                                        <tr
                                            key={h.host_id}
                                            className={`host-row ${h.host_id === selectedHost ? "selected" : ""}`}
                                            onClick={() => setSelectedHost(h.host_id)}
                                        >
                                            <td className="strong">{h.hostname}</td>
                                            <td>{h.ip}</td>
                                            <td>{h.os || "-"}</td>
                                            <td>{fmt(h.cpu_percent, "%")}</td>
                                            <td>{fmt(h.mem_percent, "%")}</td>
                                            <td>{fmt(h.disk_percent, "%")}</td>
                                            <td>{fmt(h.net_recv_kbps)} / {fmt(h.net_sent_kbps)}</td>
                                            <td>
                                                {isDiscovered(h) ? (
                                                    <span className="badge-discovered">Terdeteksi</span>
                                                ) : (
                                                    <span className={onlineOf(h) ? "badge-online" : "badge-offline"}>
                                                        {onlineOf(h) ? "Online" : "Offline"}
                                                    </span>
                                                )}
                                            </td>
                                            <td>{timeLabel(h.last_seen)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="table-header">
                            <div>
                                <h3>Log anomali sistem</h3>
                                <p>Kejadian CPU/RAM/disk melewati batas aman, beserta pemulihannya. Tersimpan di backend meski agent berhenti.</p>
                            </div>
                            <button className="btn-refresh" onClick={refresh} title="Refresh sekarang">
                                <LuRefreshCw size={14} /> Muat ulang
                            </button>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>Host</th>
                                        <th>Metrik</th>
                                        <th>Nilai</th>
                                        <th>Batas</th>
                                        <th>Severity</th>
                                        <th>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {anomalies.length ? (
                                        anomalies.map((a, i) => (
                                            <tr key={`${a.ts}-${a.hostname}-${a.metric}-${i}`}>
                                                <td>{timeLabel(a.ts)}</td>
                                                <td className="strong">{a.hostname}</td>
                                                <td>{metricLabel(a.metric)}</td>
                                                <td>{fmt(a.value, "%")}</td>
                                                <td>{a.threshold != null ? `${Number(a.threshold).toFixed(0)}%` : "-"}</td>
                                                <td>
                                                    <span className={`log-badge ${a.event === "recovery" ? "low" : a.severity || "low"}`}>
                                                        <span className="log-dot" />
                                                        {a.event === "recovery" ? "Recovered" : a.severity === "high" ? "Kritis" : "Peringatan"}
                                                    </span>
                                                </td>
                                                <td>{a.message || (a.event === "recovery" ? "Metrik kembali normal" : "")}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={7} className="empty-cell">Belum ada anomali tercatat. Semua metrik dalam batas aman.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {selected && (
                        <>
                            <div className="pm-detail-header">
                                <h3>
                                    {selected.hostname}
                                    <span className="pm-detail-sub">{selected.ip} · {selected.os || "unknown OS"}</span>
                                </h3>
                                <select
                                    className="pm-select"
                                    value={windowMinutes}
                                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                                >
                                    <option value={15}>15 menit terakhir</option>
                                    <option value={30}>30 menit terakhir</option>
                                    <option value={60}>1 jam terakhir</option>
                                    <option value={180}>3 jam terakhir</option>
                                    <option value={720}>12 jam terakhir</option>
                                    <option value={1440}>24 jam terakhir</option>
                                </select>
                            </div>

                            <div className="stats-grid anomaly-stats">
                                <StatCard icon={LuCpu} label="CPU" value={fmt(latest?.cpu_percent, "%")} description="Snapshot terakhir" />
                                <StatCard
                                    icon={LuMemoryStick}
                                    label="RAM"
                                    value={fmt(latest?.mem_percent, "%")}
                                    description={latest?.mem_used_gb != null ? `${latest.mem_used_gb} / ${latest.mem_total_gb} GB` : ""}
                                />
                                <StatCard
                                    icon={LuHardDrive}
                                    label="Disk"
                                    value={fmt(latest?.disk_percent, "%")}
                                    description={latest?.disk_used_gb != null ? `${latest.disk_used_gb} / ${latest.disk_total_gb} GB` : ""}
                                />
                                <StatCard
                                    icon={LuWifi}
                                    label="Network"
                                    value={latest ? `↓${fmt(latest.net_recv_kbps)} ↑${fmt(latest.net_sent_kbps)}` : "-"}
                                    description="Throughput agregat (KB/s)"
                                />
                            </div>

                            <ChartBlock title="CPU / RAM / Disk (%)" description={`Riwayat ${windowMinutes} menit terakhir`}>
                                {chartData.length ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                                            <CartesianGrid stroke="#eae8e4" vertical={false} />
                                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} minTickGap={40} />
                                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 }} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#0f766e" dot={false} strokeWidth={2} />
                                            <Line type="monotone" dataKey="mem" name="RAM %" stroke="#10b981" dot={false} strokeWidth={2} />
                                            <Line type="monotone" dataKey="disk" name="Disk %" stroke="#f59e0b" dot={false} strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="empty-state">Belum ada riwayat untuk host ini pada rentang waktu terpilih.</div>
                                )}
                            </ChartBlock>

                            <ChartBlock title="Network throughput (KB/s)" description="Agregat semua interface">
                                {chartData.length ? (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                                            <CartesianGrid stroke="#eae8e4" vertical={false} />
                                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} minTickGap={40} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a8a29e" }} />
                                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 }} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Area type="monotone" dataKey="net_recv" name="Download" stroke="#0f766e" fill="#ccfbf1" fillOpacity={0.6} strokeWidth={2} />
                                            <Area type="monotone" dataKey="net_sent" name="Upload" stroke="#8b5cf6" fill="#ede9fe" fillOpacity={0.6} strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="empty-state">Belum ada data jaringan.</div>
                                )}
                            </ChartBlock>

                            <ChartBlock
                                title="Korelasi metrik host (live)"
                                description={`Dihitung ulang dari snapshot monitoring terbaru${selected ? ` — ${selected.hostname}` : ""}`}
                            >
                                <HostCorrelationHeatmap host={selectedHost} discovered={selected ? !hasAgent(selected) : false} />
                            </ChartBlock>

                            <div className="table-card">
                                <div className="table-header">
                                    <div>
                                        <h3>
                                            <LuTerminal size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                                            Proses teratas
                                        </h3>
                                        <p>5 proses dengan CPU tertinggi dari snapshot terakhir.</p>
                                    </div>
                                </div>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr><th>PID</th><th>Nama proses</th><th>CPU %</th></tr>
                                        </thead>
                                        <tbody>
                                            {parseList(latest?.top_processes).length ? (
                                                parseList(latest.top_processes).map((p, i) => (
                                                    <tr key={`${p.pid}-${i}`}>
                                                        <td>{p.pid}</td>
                                                        <td className="strong">{p.name}</td>
                                                        <td>{fmt(p.cpu_percent, "%")}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={3} className="empty-cell">Tidak ada data proses.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function parseList(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function ChartBlock({ title, description, children }) {
    return (
        <div className="table-card">
            <div className="table-header">
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>
            <div style={{ padding: "0 8px 8px" }}>{children}</div>
        </div>
    );
}

export default PcMonitoring;
