import { useEffect, useState } from "react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    Tooltip,
    ResponsiveContainer
} from "recharts";

import ChartCard from "../components/ChartCard";
import SectionHeader from "../components/SectionHeader";
import { getPerformance } from "../api/dashboardApi";
import "../styles/pages/Pages.css";

function ModelPerformance({
    selectedDomain
}) {
    const [performanceData, setPerformanceData] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    useEffect(() => {
        async function loadPerformance() {
            try {
                setLoading(true);

                const response =
                    await getPerformance();

                if (response.status !== "success") {
                    throw new Error(
                        response.message ||
                        "Failed to load performance data"
                    );
                }

                setPerformanceData(
                    response.data || []
                );
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadPerformance();
    }, []);

    const data =
        selectedDomain === "All Domains"
            ? performanceData
            : performanceData.filter(
                (item) =>
                    item.Domain === selectedDomain
            );

    const hasCurrentEvaluation = performanceData.some(
        (item) => item.IF_F1 !== undefined && item.Dummy_F1 !== undefined
    );

    const chartData = data.map(
        (item) => ({
            domain: item.Domain,
            Model_F1: Number(item.F1 || 0),
            Dummy_F1: hasCurrentEvaluation ? Number(item.Dummy_F1 || 0) : null,
            IF_F1: hasCurrentEvaluation ? Number(item.IF_F1 || 0) : null
        })
    );

    if (loading) {
        return (
            <>
                <div className="page-heading">
                    <h1>Model Performance</h1>

                    <p>
                        Evaluation results across the
                        monitored domains.
                    </p>
                </div>

                <div className="loading-state">
                    Loading model performance...
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="page-heading">
                    <h1>Model Performance</h1>

                    <p>
                        Evaluation results across the
                        monitored domains.
                    </p>
                </div>

                <div className="error-state">
                    Failed to load performance:
                    {" "}
                    {error}
                </div>
            </>
        );
    }

    return (
        <>
            <div className="page-heading">
                <h1>Model Performance</h1>

                <p>
                    Evaluation results across the
                    monitored domains.
                </p>
            </div>

            <SectionHeader
                title="Model Quality"
                description={hasCurrentEvaluation
                    ? "Compare the supervised classifier with the majority and Isolation Forest baselines."
                    : "Stored evaluation from the previous model run."}
            />

            <ChartCard
                title="F1 by Domain"
                description="F1 can look high on imbalanced labels, so compare it with the majority baseline."
            >
                <ResponsiveContainer
                    width="100%"
                    height={410}
                >
                    <BarChart
                        data={chartData}
                    >
                        <CartesianGrid stroke="#e9edeb" vertical={false} />

                        <XAxis
                            dataKey="domain"
                            axisLine={false}
                            tickLine={false}
                        />

                        <YAxis
                            domain={[0, 1]}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `${Math.round(value * 100)}%`}
                        />

                        <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(2)}%`} />
                        <Legend />

                        <Bar
                            dataKey="Model_F1"
                            name={hasCurrentEvaluation ? "Random Forest F1" : "Stored F1"}
                            fill="#718b81"
                            radius={[4, 4, 0, 0]}
                        />
                        {hasCurrentEvaluation && <Bar dataKey="Dummy_F1" name="Majority baseline" fill="#c5cfca" radius={[4, 4, 0, 0]} />}
                        {hasCurrentEvaluation && <Bar dataKey="IF_F1" name="Isolation Forest F1" fill="#91a2aa" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <SectionHeader
                title="Detailed Evaluation"
                description="Includes evaluation split and class-aware metrics where available."
            />

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Test rows</th>
                            <th>Split</th>
                            <th>F1</th>
                            {hasCurrentEvaluation && <th>Dummy F1</th>}
                            {hasCurrentEvaluation && <th>IF F1</th>}
                            <th>Balanced accuracy</th>
                            <th>Average precision</th>
                        </tr>
                    </thead>

                    <tbody>
                        {data.map(
                            (item) => (
                                <tr
                                    key={
                                        item.Domain
                                    }
                                >
                                    <td className="strong">
                                        {item.Domain}
                                    </td>
                                    <td>{Number(item.Test || 0).toLocaleString("id-ID")}</td>
                                    <td>{item.Split || "Previous run"}</td>
                                    <td>{(Number(item.F1 || 0) * 100).toFixed(2)}%</td>
                                    {hasCurrentEvaluation && <td>{(Number(item.Dummy_F1 || 0) * 100).toFixed(2)}%</td>}
                                    {hasCurrentEvaluation && <td>{(Number(item.IF_F1 || 0) * 100).toFixed(2)}%</td>}
                                    <td>{item.Balanced_Accuracy === undefined ? "-" : `${(Number(item.Balanced_Accuracy) * 100).toFixed(2)}%`}</td>
                                    <td>{item.Average_Precision === undefined ? "-" : `${(Number(item.Average_Precision) * 100).toFixed(2)}%`}</td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

export default ModelPerformance;
