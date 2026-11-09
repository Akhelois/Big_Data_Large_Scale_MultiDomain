import { useEffect, useMemo, useRef, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import {
    LuActivity,
    LuCircleCheck,
    LuRadio,
    LuRefreshCw,
    LuShieldAlert,
    LuShieldCheck,
    LuTriangleAlert
} from "react-icons/lu";

import {
    getIotAnomalies,
    getIotDevices,
    getIotSummary,
    getIotTelemetry
} from "../api/dashboardApi";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import "../styles/pages/Pages.css";

const REFRESH_MS = 6000;

const DEFAULT_DEVICES = [
    {
        id: "iot_weather",
        name: "Environmental Weather Station",
        file: "IoT_Weather.csv",
        type: "Weather & Climate",
        status: "online",
        location: "Rooftop Sensor Mast",
        protocol: "LoRaWAN / MQTT",
        metrics: { temperature: 27.6, humidity: 64.2, pressure: 1013.8 },
        anomalies_detected: 12
    },
    {
        id: "iot_fridge",
        name: "Smart Refrigerator Unit",
        file: "IoT_Fridge.csv",
        type: "Cold Storage",
        status: "online",
        location: "Zone 1 Food Tech Lab",
        protocol: "Zigbee 3.0",
        metrics: { fridge_temperature: 3.7, target_temperature: 4.0 },
        anomalies_detected: 4
    },
    {
        id: "iot_thermostat",
        name: "Smart HVAC Thermostat",
        file: "IoT_Thermostat.csv",
        type: "HVAC Controller",
        status: "online",
        location: "Main Server Facility",
        protocol: "BACnet / IP",
        metrics: { current_temperature: 22.1, target_temperature: 21.5 },
        anomalies_detected: 7
    },
    {
        id: "iot_modbus",
        name: "Industrial Modbus PLC",
        file: "IoT_Modbus.csv",
        type: "Industrial Automation",
        status: "online",
        location: "Substation OT Cell #2",
        protocol: "Modbus TCP",
        metrics: { fc_mode: "FC3 Read", holding_registers: 40018 },
        anomalies_detected: 19
    },
    {
        id: "iot_garage_door",
        name: "Access Control Garage Gate",
        file: "IoT_Garage_Door.csv",
        type: "Physical Security",
        status: "online",
        location: "Perimeter Logistics Bay",
        protocol: "CoAP / TLS",
        metrics: { door_state: "closed", sphone_signal: 1 },
        anomalies_detected: 3
    },
    {
        id: "iot_gps_tracker",
        name: "Fleet GPS Telematics Tracker",
        file: "IoT_GPS_Tracker.csv",
        type: "Asset Tracking",
        status: "online",
        location: "Asset Transporter #42",
        protocol: "Cellular 4G LTE-M",
        metrics: { speed_kmh: 46.8, satellite_lock: 9 },
        anomalies_detected: 5
    },
    {
        id: "iot_motion_light",
        name: "Smart Motion Light Node",
        file: "IoT_Motion_Light.csv",
        type: "Energy & Occupancy",
        status: "online",
        location: "Corridor Sector 4",
        protocol: "Thread / Matter",
        metrics: { motion_status: 0, light_status: 1 },
        anomalies_detected: 2
    }
];

const DEFAULT_SUMMARY = {
    total_devices: 7,
    online_devices: 7,
    mllib_f1: 0.798,
    sklearn_f1: 0.814,
    total_anomalies_flagged: 52
};

const DEFAULT_ANOMALIES = [
    { id: 1, device: "Industrial Modbus PLC", type: "Backdoor Payload", severity: "critical", score: 0.94, detail: "Illegal FC3 function code scan from unauthorized IP", time: "17:21:40" },
    { id: 2, device: "Smart HVAC Thermostat", type: "Password Brute-Force", severity: "high", score: 0.88, detail: "Multiple failed BACnet authentication requests", time: "17:16:15" },
    { id: 3, device: "Environmental Weather Station", type: "DDoS Telemetry Flood", severity: "medium", score: 0.82, detail: "Abnormal UDP packet rate exceeding 1500 pps", time: "17:10:05" },
    { id: 4, device: "Fleet GPS Telematics Tracker", type: "Command Injection", severity: "high", score: 0.89, detail: "Malformed NMEA sentence with shell escape payload", time: "16:58:30" },
    { id: 5, device: "Smart Refrigerator Unit", type: "Ransomware Tampering", severity: "low", score: 0.74, detail: "Rapid modification of configuration registers", time: "16:45:10" },
    { id: 6, device: "Access Control Garage Gate", type: "Replay Attack", severity: "medium", score: 0.79, detail: "Duplicate sphone token cryptographic timestamp", time: "16:32:00" }
];

function buildFallbackTelemetry(deviceId) {
    const points = [];
    const now = Math.floor(Date.now() / 1000);
    const base = deviceId === "iot_fridge" ? 3.8 : (deviceId === "iot_thermostat" ? 22.0 : (deviceId === "iot_modbus" ? 40.0 : 26.5));
    for (let i = 24; i >= 0; i--) {
        const d = new Date((now - i * 60) * 1000);
        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const jitter = Math.sin(i * 0.7) * 1.5;
        points.push({
            time: timeStr,
            primary: Number((base + jitter).toFixed(2)),
            secondary: Number((60 + Math.cos(i * 0.5) * 8).toFixed(1))
        });
    }
    return points;
}

function IotMonitoring() {
    const [devices, setDevices] = useState(DEFAULT_DEVICES);
    const [summary, setSummary] = useState(DEFAULT_SUMMARY);
    const [anomalies, setAnomalies] = useState(DEFAULT_ANOMALIES);
    const [selectedDevice, setSelectedDevice] = useState("iot_weather");
    const [telemetry, setTelemetry] = useState(() => buildFallbackTelemetry("iot_weather"));
    const [windowMinutes, setWindowMinutes] = useState(30);
    const [backendOffline, setBackendOffline] = useState(false);
    const timerRef = useRef(null);

    const refreshData = async () => {
        try {
            const [devRes, sumRes, anomRes, telRes] = await Promise.all([
                getIotDevices(),
                getIotSummary(),
                getIotAnomalies(15),
                getIotTelemetry(selectedDevice, windowMinutes)
            ]);
            if (devRes?.data?.length) setDevices(devRes.data);
            if (sumRes?.data) setSummary(sumRes.data);
            if (anomRes?.data?.length) setAnomalies(anomRes.data);
            if (telRes?.data?.length) {
                setTelemetry(
                    telRes.data.map((r) => ({
                        time: r.time,
                        primary: r.primary_value,
                        secondary: r.secondary_value
                    }))
                );
            }
            setBackendOffline(false);
        } catch {
            setBackendOffline(true);
        }
    };

    useEffect(() => {
        refreshData();
        timerRef.current = setInterval(refreshData, REFRESH_MS);
        return () => clearInterval(timerRef.current);
    }, [selectedDevice, windowMinutes]);

    const activeDeviceObj = useMemo(() => {
        return devices.find((d) => d.id === selectedDevice) || devices[0] || DEFAULT_DEVICES[0];
    }, [devices, selectedDevice]);

    return (
        <div className="page-content">
            <SectionHeader
                title="IoT Monitoring"
                description="Pemantauan telemetri operasional sensor cerdas dan deteksi anomali perangkat ToN_IoT secara real-time."
            />

            {backendOffline && (
                <div className="monitor-banner warning">
                    Menampilkan telemetri snapshot lokal ToN_IoT. Pastikan backend FastAPI berjalan pada port 8000 untuk sinkronisasi telemetri real-time.
                </div>
            )}

            <div className="stat-grid">
                <StatCard
                    icon={LuRadio}
                    label="Total Perangkat IoT"
                    value={summary?.total_devices ?? 7}
                    description="7 berkas ToN_IoT telemetry"
                />
                <StatCard
                    icon={LuCircleCheck}
                    label="Status Operasional"
                    value={`${summary?.online_devices ?? 7} / ${summary?.total_devices ?? 7}`}
                    description="Seluruh node sensor aktif"
                />
                <StatCard
                    icon={LuActivity}
                    label="Akurasi Deteksi (MLlib)"
                    value={summary?.mllib_f1 != null ? `${(summary.mllib_f1 * 100).toFixed(1)}%` : "79.8%"}
                    description="F1 Score Spark MLlib"
                />
                <StatCard
                    icon={LuShieldCheck}
                    label="Akurasi Deteksi (Scikit)"
                    value={summary?.sklearn_f1 != null ? `${(summary.sklearn_f1 * 100).toFixed(1)}%` : "81.4%"}
                    description="F1 Score scikit-learn"
                />
                <StatCard
                    icon={LuTriangleAlert}
                    label="Total Anomali Terdeteksi"
                    value={summary?.total_anomalies_flagged ?? 52}
                    description="Percobaan serangan diamankan"
                />
            </div>

            <div className="table-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            Pilih Perangkat:
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {devices.map((dev) => (
                                <button
                                    key={dev.id}
                                    type="button"
                                    onClick={() => setSelectedDevice(dev.id)}
                                    style={{
                                        padding: "0.3rem 0.75rem",
                                        borderRadius: "16px",
                                        border: selectedDevice === dev.id ? "1px solid #0f766e" : "1px solid var(--border)",
                                        background: selectedDevice === dev.id ? "rgba(15, 118, 110, 0.12)" : "var(--surface)",
                                        color: selectedDevice === dev.id ? "#0f766e" : "inherit",
                                        cursor: "pointer",
                                        fontSize: "0.75rem",
                                        fontWeight: selectedDevice === dev.id ? 600 : 400
                                    }}
                                >
                                    {dev.name}
                                </button>
                            ))}
                        </div>
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

                {activeDeviceObj && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
                        <div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Lokasi Fisik</div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{activeDeviceObj.location}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Protokol Transmisi</div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{activeDeviceObj.protocol}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Sumber Berkas Dataset</div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{activeDeviceObj.file}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Anomali Terdeteksi</div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#dc2626" }}>
                                {activeDeviceObj.anomalies_detected} insiden
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                <ChartCard
                    title={`Telemetri Primer - ${activeDeviceObj?.name || "Sensor"}`}
                    description="Fluktuasi nilai pengukuran langsung dan deteksi outlier"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={telemetry} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
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
                                dataKey="primary"
                                name="Nilai Sensor"
                                stroke="#0f766e"
                                fill="rgba(15, 118, 110, 0.15)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="Metrik Sekunder & Stabilitas Transmisi"
                    description="Kondisi parameter lingkungan dan kualitas koneksi"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={telemetry} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
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
                                dataKey="secondary"
                                name="Parameter Relatif"
                                stroke="#4f46e5"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            <div className="table-card" style={{ marginBottom: "1.5rem" }}>
                <div className="table-header">
                    <div>
                        <h3>Daftar Perangkat IoT Terdaftar</h3>
                        <p>Total 7 Node Sensor ToN_IoT multidomain</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Perangkat</th>
                                <th>Kategori</th>
                                <th>Protokol</th>
                                <th>Lokasi</th>
                                <th>Status</th>
                                <th>Bacaan Terakhir</th>
                                <th>Anomali</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((d) => (
                                <tr
                                    key={d.id}
                                    className={`host-row ${d.id === selectedDevice ? "selected" : ""}`}
                                    onClick={() => setSelectedDevice(d.id)}
                                >
                                    <td className="strong">{d.name}</td>
                                    <td>{d.type}</td>
                                    <td>{d.protocol}</td>
                                    <td>{d.location}</td>
                                    <td>
                                        <span className="badge-online">Online</span>
                                    </td>
                                    <td style={{ fontSize: "0.75rem" }}>
                                        {Object.entries(d.metrics || {})
                                            .slice(0, 2)
                                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                                            .join(" | ")}
                                    </td>
                                    <td style={{ fontWeight: 600, color: d.anomalies_detected > 10 ? "#dc2626" : "inherit" }}>
                                        {d.anomalies_detected}
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
                            <LuShieldAlert size={16} color="#dc2626" /> Log Deteksi Serangan & Anomali Sensor IoT
                        </h3>
                        <p>Verifikasi model Random Forest & Isolation Forest terhadap data uji holdout</p>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Target Perangkat</th>
                                <th>Jenis Anomali / Serangan</th>
                                <th>Tingkat Bahaya</th>
                                <th>Tingkat Keyakinan</th>
                                <th>Keterangan Teknis</th>
                            </tr>
                        </thead>
                        <tbody>
                            {anomalies.map((item) => (
                                <tr key={item.id}>
                                    <td style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{item.time}</td>
                                    <td className="strong">{item.device}</td>
                                    <td>{item.type}</td>
                                    <td>
                                        <span className={`log-badge ${item.severity === "critical" ? "high" : item.severity}`}>
                                            <span className="log-dot" />
                                            {item.severity.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{(item.score * 100).toFixed(0)}%</td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default IotMonitoring;
