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
    LuActivity,
    LuArrowUpDown,
    LuDatabase,
    LuGlobe,
    LuLayers,
    LuNetwork,
    LuRefreshCw,
    LuServer,
    LuShieldAlert,
    LuShieldCheck
} from "react-icons/lu";

import {
    getNetworkFlows,
    getNetworkProtocols,
    getNetworkSummary,
    getNetworkThreats,
    getNetworkTraffic
} from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const REFRESH_MS = 6000;

const DEFAULT_SUMMARY = {
    domain: "Network",
    dataset_files: 23,
    total_records_evaluated: 89786,
    gateway_node: "Network_Gateway_Core",
    degree_centrality: 0.4667,
    pagerank: 0.1690,
    detection_f1_mllib: 0.991,
    current_throughput_mbps: 218.4,
    ingress_mbps: 146.2,
    egress_mbps: 72.2,
    packet_rate_pps: 18640
};

const DEFAULT_PROTOCOLS = [
    { protocol: "TCP", percentage: 62.4, flows: 886, bytes_mb: 136.2 },
    { protocol: "UDP", percentage: 27.8, flows: 395, bytes_mb: 60.7 },
    { protocol: "ICMP", percentage: 4.6, flows: 65, bytes_mb: 10.1 },
    { protocol: "Modbus/SCADA", percentage: 3.2, flows: 45, bytes_mb: 7.0 },
    { protocol: "Other (MQTT/DNS)", percentage: 2.0, flows: 29, bytes_mb: 4.4 }
];

const DEFAULT_FLOWS = [
    { id: "fl-01", src_ip: "192.168.1.150", dst_ip: "192.168.1.1", src_port: 54210, dst_port: 80, proto: "TCP", service: "HTTP", duration: 0.42, bytes: 14250, packets: 32, state: "SF", status: "Normal" },
    { id: "fl-02", src_ip: "192.168.1.194", dst_ip: "192.168.1.1", src_port: 49152, dst_port: 502, proto: "TCP", service: "Modbus", duration: 1.15, bytes: 8420, packets: 18, state: "SF", status: "Normal" },
    { id: "fl-03", src_ip: "192.168.1.205", dst_ip: "192.168.1.10", src_port: 61200, dst_port: 80, proto: "TCP", service: "HTTP", duration: 4.80, bytes: 89450, packets: 320, state: "S0", status: "Flagged - DDoS" },
    { id: "fl-04", src_ip: "192.168.1.205", dst_ip: "192.168.1.10", src_port: 61201, dst_port: 80, proto: "TCP", service: "HTTP", duration: 5.10, bytes: 94100, packets: 345, state: "S0", status: "Flagged - DDoS" },
    { id: "fl-05", src_ip: "192.168.1.180", dst_ip: "8.8.8.8", src_port: 53120, dst_port: 53, proto: "UDP", service: "DNS", duration: 0.05, bytes: 240, packets: 4, state: "SF", status: "Normal" },
    { id: "fl-06", src_ip: "192.168.1.199", dst_ip: "192.168.1.15", src_port: 42110, dst_port: 22, proto: "TCP", service: "SSH", duration: 0.12, bytes: 1840, packets: 12, state: "REJ", status: "Flagged - Brute Force" },
    { id: "fl-07", src_ip: "192.168.1.210", dst_ip: "192.168.1.0/24", src_port: 51100, dst_port: 445, proto: "TCP", service: "SMB", duration: 0.02, bytes: 120, packets: 2, state: "S0", status: "Flagged - Scanning" },
    { id: "fl-08", src_ip: "192.168.1.165", dst_ip: "104.244.42.1", src_port: 58310, dst_port: 443, proto: "TCP", service: "SSL", duration: 12.4, bytes: 451000, packets: 820, state: "SF", status: "Normal" },
    { id: "fl-09", src_ip: "192.168.1.140", dst_ip: "192.168.1.1", src_port: 1883, dst_port: 1883, proto: "TCP", service: "MQTT", duration: 60.0, bytes: 48200, packets: 310, state: "SF", status: "Normal" },
    { id: "fl-10", src_ip: "192.168.1.177", dst_ip: "192.168.1.20", src_port: 39110, dst_port: 8080, proto: "TCP", service: "HTTP", duration: 0.35, bytes: 3410, packets: 14, state: "SF", status: "Flagged - XSS" }
];

const DEFAULT_THREATS = [
    { id: 1, type: "DDoS SYN Flood", src_ip: "192.168.1.205", dst_ip: "192.168.1.10", port: "80", severity: "critical", f1_score: 0.993, packets: 12450, action: "Rate-limited via Core Gateway", time: "17:24:10" },
    { id: 2, type: "TCP Port Sweep Scanning", src_ip: "192.168.1.210", dst_ip: "192.168.1.0/24", port: "445/3389", severity: "high", f1_score: 0.997, packets: 4820, action: "IP Quarantined", time: "17:19:35" },
    { id: 3, type: "SSH Password Brute-Force", src_ip: "192.168.1.199", dst_ip: "192.168.1.15", port: "22", severity: "high", f1_score: 0.991, packets: 1940, action: "Connection Dropped", time: "17:13:50" },
    { id: 4, type: "Backdoor Command Channel", src_ip: "192.168.1.218", dst_ip: "45.33.32.156", port: "4444", severity: "critical", f1_score: 0.983, packets: 620, action: "TCP RST Injected", time: "17:05:12" },
    { id: 5, type: "Cross-Site Scripting (XSS)", src_ip: "192.168.1.177", dst_ip: "192.168.1.20", port: "8080", severity: "medium", f1_score: 0.981, packets: 140, action: "WAF Filter Block", time: "16:54:20" },
    { id: 6, type: "SQL Command Injection", src_ip: "192.168.1.182", dst_ip: "192.168.1.25", port: "3306", severity: "high", f1_score: 0.967, packets: 310, action: "Payload Sanitized", time: "16:41:00" }
];

function buildFallbackTraffic() {
    const points = [];
    const now = Math.floor(Date.now() / 1000);
    for (let i = 24; i >= 0; i--) {
        const d = new Date((now - i * 60) * 1000);
        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const jitterIn = Math.sin(i * 0.8) * 18;
        const jitterOut = Math.cos(i * 0.6) * 10;
        const pkts = Math.round(18500 + Math.sin(i * 0.9) * 800);
        points.push({
            time: timeStr,
            ingress: Number((146 + jitterIn).toFixed(1)),
            egress: Number((72 + jitterOut).toFixed(1)),
            packets: pkts,
            flows: Math.round(pkts / 13)
        });
    }
    return points;
}

function NetworkMonitoring() {
    const [summary, setSummary] = useState(DEFAULT_SUMMARY);
    const [traffic, setTraffic] = useState(buildFallbackTraffic);
    const [flows, setFlows] = useState(DEFAULT_FLOWS);
    const [threats, setThreats] = useState(DEFAULT_THREATS);
    const [protocols, setProtocols] = useState(DEFAULT_PROTOCOLS);
    const [windowMinutes, setWindowMinutes] = useState(30);
    const [backendOffline, setBackendOffline] = useState(false);
    const timerRef = useRef(null);

    const refreshData = async () => {
        try {
            const [sumRes, trafRes, flowRes, threatRes, protoRes] = await Promise.all([
                getNetworkSummary(),
                getNetworkTraffic(windowMinutes),
                getNetworkFlows(20),
                getNetworkThreats(15),
                getNetworkProtocols()
            ]);
            if (sumRes?.data) setSummary(sumRes.data);
            if (trafRes?.data?.length) {
                setTraffic(
                    trafRes.data.map((r) => ({
                        time: r.time,
                        ingress: r.ingress_mbps,
                        egress: r.egress_mbps,
                        packets: r.packet_rate_pps,
                        flows: r.flow_rate_fps
                    }))
                );
            }
            if (flowRes?.data?.length) setFlows(flowRes.data);
            if (threatRes?.data?.length) setThreats(threatRes.data);
            if (protoRes?.data?.length) setProtocols(protoRes.data);
            setBackendOffline(false);
        } catch {
            setBackendOffline(true);
        }
    };

    useEffect(() => {
        refreshData();
        timerRef.current = setInterval(refreshData, REFRESH_MS);
        return () => clearInterval(timerRef.current);
    }, [windowMinutes]);

    return (
        <div className="page-content">
            <SectionHeader
                title="Network Monitoring"
                description="Pemantauan lalu lintas paket data, throughput gateway, dan deteksi ancaman ToN_IoT Network secara real-time."
            />

            {backendOffline && (
                <div className="monitor-banner warning">
                    Menampilkan telemetri snapshot lokal ToN_IoT Network. Pastikan backend FastAPI berjalan pada port 8000 untuk sinkronisasi telemetri live.
                </div>
            )}

            <div className="stat-grid">
                <StatCard
                    icon={LuDatabase}
                    label="Volume Rekaman Uji"
                    value={summary?.total_records_evaluated ? summary.total_records_evaluated.toLocaleString("id-ID") : "89.786"}
                    description="23 berkas CSV Zeek / 3.08 GB"
                />
                <StatCard
                    icon={LuServer}
                    label="Simpul Gateway Utama"
                    value={summary?.gateway_node || "Network_Gateway_Core"}
                    description={`Degree ${summary?.degree_centrality ?? "0.4667"} | PageRank ${summary?.pagerank ?? "0.1690"}`}
                />
                <StatCard
                    icon={LuActivity}
                    label="Throughput Jaringan"
                    value={summary?.current_throughput_mbps ? `${summary.current_throughput_mbps} Mbps` : "218.4 Mbps"}
                    description={`Ingress ${summary?.ingress_mbps ?? 146.2} | Egress ${summary?.egress_mbps ?? 72.2}`}
                />
                <StatCard
                    icon={LuArrowUpDown}
                    label="Laju Paket (PPS)"
                    value={summary?.packet_rate_pps ? `${summary.packet_rate_pps.toLocaleString("id-ID")} pps` : "18.640 pps"}
                    description="1.420 aliran aktif"
                />
                <StatCard
                    icon={LuShieldCheck}
                    label="Akurasi Deteksi (F1)"
                    value={summary?.detection_f1_mllib != null ? `${(summary.detection_f1_mllib * 100).toFixed(1)}%` : "99.1%"}
                    description="Spark MLlib & scikit-learn"
                />
            </div>

            <div className="table-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <LuNetwork size={16} color="#0f766e" />
                        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                            Status Koneksi Core Gateway & Segmentasi Subnet ToN_IoT
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <select
                            value={windowMinutes}
                            onChange={(e) => setWindowMinutes(Number(e.target.value))}
                            style={{
                                padding: "0.35rem 0.65rem",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                background: "var(--surface)",
                                color: "inherit",
                                fontSize: "0.75rem"
                            }}
                        >
                            <option value={15}>15 Menit Terakhir</option>
                            <option value={30}>30 Menit Terakhir</option>
                            <option value={60}>60 Menit Terakhir</option>
                        </select>
                        <button
                            type="button"
                            className="btn-refresh"
                            onClick={refreshData}
                        >
                            <LuRefreshCw size={13} /> Refresh
                        </button>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
                    <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Arsitektur Graf Neo4j</div>
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>13 Partisi Terhubung ke Core</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Rasio Serangan Jaringan</div>
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#dc2626" }}>96.3% Serangan (Holdout Test)</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Kelas Dominan Terdeteksi</div>
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>DDoS (F1: 0.962), Scanning (F1: 0.992)</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Status Mitigasi Firewall</div>
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#059669" }}>Aktif (Inspeksi Paket Cepat)</div>
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                <ChartCard
                    title="Throughput Bandwidth Jaringan (Mbps)"
                    description="Distribusi lalu lintas masuk (ingress) dan keluar (egress)"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={traffic} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="time" fontSize={11} stroke="#9ca3af" />
                            <YAxis fontSize={11} stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    borderRadius: "8px",
                                    fontSize: "0.75rem"
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="ingress"
                                name="Ingress (Mbps)"
                                stroke="#0f766e"
                                fill="rgba(15, 118, 110, 0.2)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="egress"
                                name="Egress (Mbps)"
                                stroke="#4f46e5"
                                fill="rgba(79, 70, 229, 0.15)"
                                strokeWidth={2}
                            />
                            <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 6 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="Aktivitas Paket (PPS) & Lonjakan Aliran"
                    description="Deteksi lonjakan volume paket per detik pada Core Gateway"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={traffic} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="time" fontSize={11} stroke="#9ca3af" />
                            <YAxis fontSize={11} stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    borderRadius: "8px",
                                    fontSize: "0.75rem"
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="packets"
                                name="Packet Rate (pps)"
                                stroke="#dc2626"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="flows"
                                name="Flow Rate (fps)"
                                stroke="#ca8a04"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            <div className="table-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <LuLayers size={16} color="#0f766e" /> Distribusi Protokol Jaringan
                    </h3>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        Analisis Komposisi Aliran Paket
                    </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                    {protocols.map((p) => (
                        <div key={p.protocol} style={{ padding: "0.75rem", borderRadius: "8px", background: "var(--bg-subtle, #f9fafb)", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                                <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{p.protocol}</span>
                                <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0f766e" }}>{p.percentage}%</span>
                            </div>
                            <div style={{ width: "100%", height: "5px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden", marginBottom: "0.4rem" }}>
                                <div style={{ width: `${p.percentage}%`, height: "100%", background: "#0f766e", borderRadius: "3px" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                                <span>{p.flows} aliran</span>
                                <span>{p.bytes_mb} MB</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="table-card" style={{ marginBottom: "1.5rem" }}>
                <div className="table-header">
                    <div>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <LuGlobe size={16} color="#4f46e5" /> Aliran Koneksi Jaringan Aktif (Zeek Flow Records)
                        </h3>
                        <p>Inspeksi sesi koneksi langsung dari dataset jaringan</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Aliran</th>
                                <th>IP Sumber : Port</th>
                                <th>IP Tujuan : Port</th>
                                <th>Protokol</th>
                                <th>Layanan</th>
                                <th>Durasi</th>
                                <th>Volume</th>
                                <th>Status State</th>
                                <th>Klasifikasi ML</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flows.map((f) => (
                                <tr key={f.id}>
                                    <td className="strong">{f.id}</td>
                                    <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{f.src_ip}:{f.src_port}</td>
                                    <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{f.dst_ip}:{f.dst_port}</td>
                                    <td>{f.proto}</td>
                                    <td>{f.service}</td>
                                    <td>{f.duration}s</td>
                                    <td style={{ fontSize: "0.75rem" }}>{f.bytes.toLocaleString("id-ID")} B ({f.packets} pkt)</td>
                                    <td><span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{f.state}</span></td>
                                    <td>
                                        <span className={`log-badge ${f.status.includes("Flagged") ? "high" : "low"}`}>
                                            <span className="log-dot" />
                                            {f.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <LuShieldAlert size={16} color="#dc2626" /> Log Mitigasi Serangan Jaringan Terdeteksi
                        </h3>
                        <p>Klasifikasi serangan siber multi-kelas ToN_IoT Network</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Tipe Ancaman</th>
                                <th>IP Sumber</th>
                                <th>IP Target : Port</th>
                                <th>Tingkat Bahaya</th>
                                <th>Skor F1</th>
                                <th>Paket Diblokir</th>
                                <th>Tindakan Sistem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {threats.map((item) => (
                                <tr key={item.id}>
                                    <td style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{item.time}</td>
                                    <td className="strong">{item.type}</td>
                                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{item.src_ip}</td>
                                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{item.dst_ip}:{item.port}</td>
                                    <td>
                                        <span className={`log-badge ${item.severity === "critical" ? "high" : item.severity}`}>
                                            <span className="log-dot" />
                                            {item.severity.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{(item.f1_score * 100).toFixed(1)}%</td>
                                    <td>{item.packets.toLocaleString("id-ID")}</td>
                                    <td style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>{item.action}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default NetworkMonitoring;
