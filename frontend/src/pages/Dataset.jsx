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

const tickStyle = { fontSize: 12, fill: "#9ca3af" };
const tooltipStyle = { borderRadius: 8, border: "1px solid #e5e8ed", fontSize: 12 };

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
                    throw new Error(response.message || "Failed to load dataset");
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
                <SectionHeader title="Dataset Explorer" description="Dataset coverage and source-file composition." />
                <div className="loading-state">Loading dataset data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-content">
                <SectionHeader title="Dataset Explorer" description="Dataset coverage and source-file composition." />
                <div className="error-state">Failed to load dataset: {error}</div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <SectionHeader title="Dataset Explorer" description="Dataset coverage and source-file composition." />

            <div className="stats-grid">
                <StatCard icon={LuDatabase} label="Records" value={totalRecords.toLocaleString()} description="Records included" />
                <StatCard icon={LuFileText} label="Files" value={totalFiles} description="Source datasets" />
                <StatCard icon={LuLayers} label="Domains" value={filteredDomains.length} description="Available environments" />
            </div>

            <SectionHeader title="Dataset Distribution" description="File and record distribution by domain." />

            <div className="chart-grid two">
                <ChartCard title="Files per Domain" description="Number of source files per domain.">
                    {filteredDomains.length ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={filteredDomains} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eef0f4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={tickStyle} />
                                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={tickStyle} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="files" name="Files" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state">No dataset files for this selection.</div>
                    )}
                </ChartCard>

                <ChartCard title="Records per Domain" description="Number of processed records per domain.">
                    {filteredDomains.length ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={filteredDomains} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid stroke="#eef0f4" vertical={false} />
                                <XAxis dataKey="domain" axisLine={false} tickLine={false} tick={tickStyle} />
                                <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="records" name="Records" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state">No dataset files for this selection.</div>
                    )}
                </ChartCard>
            </div>

            {filteredFiles.length > 0 && (
                <>
                    <SectionHeader title="Source Files" description="Files included in the current dataset." />

                    <div className="table-card">
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Domain</th>
                                        <th>Source File</th>
                                        <th>Records</th>
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
