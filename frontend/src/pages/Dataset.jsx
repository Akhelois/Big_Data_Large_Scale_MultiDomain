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

import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import { getDataset } from "../api/dashboardApi";
import "../styles/pages/Pages.css";

function Dataset({
    selectedDomain
}) {
    const [dataset, setDataset] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadDataset() {
            try {
                setLoading(true);

                const response = await getDataset();

                if (response.status !== "success") {
                    throw new Error(
                        response.message ||
                        "Failed to load dataset"
                    );
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

    /*
     * Backend:
     * dataset_file_summary.csv
     *
     * Expected:
     * Domain
     * File
     * Records
     */

    const filteredFiles =
        selectedDomain === "All Domains"
            ? dataset
            : dataset.filter(
                (item) =>
                    item.Domain === selectedDomain
            );

    /*
     * Create domain summary
     * from source-file data.
     */
    const domainMap = {};

    filteredFiles.forEach((item) => {
        const domain = item.Domain;
        const records = Number(
            item.Records || 0
        );

        if (!domainMap[domain]) {
            domainMap[domain] = {
                domain,
                records: 0,
                files: 0
            };
        }

        domainMap[domain].records += records;
        domainMap[domain].files += 1;
    });

    const filteredDomains =
        Object.values(domainMap);

    const totalRecords =
        filteredFiles.reduce(
            (sum, item) =>
                sum +
                Number(item.Records || 0),
            0
        );

    const totalFiles =
        filteredFiles.length;

    if (loading) {
        return (
            <>
                <div className="page-heading">
                    <h1>Dataset Explorer</h1>

                    <p>
                        Dataset coverage and source-file
                        composition.
                    </p>
                </div>

                <div className="loading-state">
                    Loading dataset data...
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="page-heading">
                    <h1>Dataset Explorer</h1>

                    <p>
                        Dataset coverage and source-file
                        composition.
                    </p>
                </div>

                <div className="error-state">
                    Failed to load dataset:
                    {" "}
                    {error}
                </div>
            </>
        );
    }

    return (
        <>
            <div className="page-heading">
                <h1>Dataset Explorer</h1>

                <p>
                    Dataset coverage and source-file
                    composition.
                </p>
            </div>

            <div className="stats-grid three">
                <StatCard
                    label="Records"
                    value={totalRecords.toLocaleString()}
                    description="Records included"
                />

                <StatCard
                    label="Files"
                    value={totalFiles}
                    description="Source datasets"
                />

                <StatCard
                    label="Domains"
                    value={filteredDomains.length}
                    description="Available environments"
                />
            </div>

            <SectionHeader
                title="Dataset Distribution"
                description="File and record distribution by domain."
            />

            <div className="chart-grid two">
                <ChartCard
                    title="Files per Domain"
                    description="Number of source files."
                >
                    <ResponsiveContainer
                        width="100%"
                        height={320}
                    >
                        <BarChart
                            data={filteredDomains}
                        >
                            <CartesianGrid
                                stroke="#eef0f4"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="domain"
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                axisLine={false}
                                tickLine={false}
                            />

                            <Tooltip />

                            <Bar
                                dataKey="files"
                                fill="#374151"
                                radius={[
                                    5,
                                    5,
                                    0,
                                    0
                                ]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="Records per Domain"
                    description="Number of processed records."
                >
                    <ResponsiveContainer
                        width="100%"
                        height={320}
                    >
                        <BarChart
                            data={filteredDomains}
                        >
                            <CartesianGrid
                                stroke="#eef0f4"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="domain"
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                axisLine={false}
                                tickLine={false}
                            />

                            <Tooltip />

                            <Bar
                                dataKey="records"
                                fill="#111827"
                                radius={[
                                    5,
                                    5,
                                    0,
                                    0
                                ]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            <SectionHeader
                title="Source Files"
                description="Files included in the current dataset."
            />

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
                        {filteredFiles.map(
                            (file, index) => (
                                <tr
                                    key={`${file.File}-${index}`}
                                >
                                    <td className="strong">
                                        {file.Domain}
                                    </td>

                                    <td>
                                        {file.File}
                                    </td>

                                    <td>
                                        {Number(
                                            file.Records || 0
                                        ).toLocaleString()}
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

export default Dataset;