import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { LuDatabase, LuFileText, LuLayers } from "react-icons/lu";

import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import { getDataset } from "../api/dashboardApi";
import "../styles/pages/Pages.css";

const tickStyle = { fontSize: 12, fill: "#a8a29e" };
const tooltipStyle = { borderRadius: 8, border: "1px solid #e7e5e3", fontSize: 12 };

function Dataset({ selectedDomain }) {
    const [dataset, setDataset] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadDataset() {
            try {
                setLoading(true);
                const response = await getDataset();
                if (response.status !== "success") {
                    throw new Error(response.message || "Gagal memuat dataset");
                }
                setDataset(response.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadDataset();
    }, []);

    const filteredFiles = selectedDomain === "All Domains"
        ? dataset
        : dataset.filter((item) => item.Domain === selectedDomain);

    const domainMap = {};
    filteredFiles.forEach((item) => {
        const domain = item.Domain;
        const records = Number(item.Records || 0);
        if (!domainMap[domain]) domainMap[domain] = { domain, records: 0, files: 0 };
        domainMap[domain].records += records;
        domainMap[domain].files += 1;
    });

    const filteredDomains = Object.values(domainMap);
    const totalRecords = filteredFiles.reduce((sum, item) => sum + Number(item.Records || 0), 0);
    const totalFiles = filteredFiles.length;

    if (loading) {
        return (
            <div className="page-content">
                <SectionHeader title="Eksplorasi Dataset" description="Cakupan dataset dan komposisi file sumber." />
                <div className="loading-state">Memuat data dataset...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Eksplorasi Dataset" description="Cakupan dataset dan komposisi file sumber." />
                <div className="error-state">Gagal memuat dataset: {error}</div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <SectionHeader title="Eksplorasi Dataset" description="Cakupan dataset dan komposisi file sumber." />

            <div className="stats-grid">
                <StatCard icon={LuDatabase} label="Data" value={totalRecords.toLocaleString()} description="Total data" />
                <StatCard icon={LuFileText} label="File" value={totalFiles} description="Dataset sumber" />
                <StatCard icon={LuLayers} label="Domain" value={filteredDomains.length} description="Lingkungan yang tersedia" />
            </div>

            <SectionHeader title="Distribusi Dataset" description="Distribusi file dan data per domain." />

            <div className="chart-grid two">
                <ChartCard title="File per Domain" description="Jumlah file sumber per domain.">
                    {filteredDomains.length ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={filteredDomains} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eae8e4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={tickStyle} />
                                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={tickStyle} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="files" name="Files" fill="#0f766e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state">Tidak ada file dataset untuk pilihan ini.</div>
                    )}
                </ChartCard>

                <ChartCard title="Data per Domain" description="Jumlah data yang diproses per domain.">
                    {filteredDomains.length ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={filteredDomains} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eae8e4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={tickStyle} />
                                <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="records" name="Data" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state">Tidak ada file dataset untuk pilihan ini.</div>
                    )}
                </ChartCard>
            </div>

            {filteredFiles.length > 0 && (
                <>
                    <SectionHeader title="File Sumber" description="File yang termasuk dalam dataset saat ini." />

                    <div className="table-card">
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Domain</th>
                                        <th>File Sumber</th>
                                        <th>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.map((file, index) => (
                                        <tr key={`${file.Domain}-${file.File}-${index}`}>
                                            <td className="strong">{file.Domain}</td>
                                            <td>{file.File}</td>
                                            <td>{Number(file.Records || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Dataset;
