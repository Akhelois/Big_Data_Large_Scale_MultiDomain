const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000/api";


async function request(endpoint) {
    const response = await fetch(
        `${API_URL}${endpoint}`
    );

    if (!response.ok) {
        throw new Error(
            `Request failed: ${response.status}`
        );
    }

    return response.json();
}


export async function getOverview() {
    return request("/overview");
}


export async function getDataset() {
    return request("/dataset");
}


export async function getPerformance() {
    return request("/performance");
}


export async function getAnomalies() {
    return request("/anomaly");
}

export async function getAttackPredictions() {
    return request("/anomaly/predictions");
}

export async function getAnomalyLog() {
    return request("/anomaly/log");
}

export async function getNeo4jAnalytics() {
    return request("/neo4j/analytics");
}


export async function getClusters() {
    return request("/clustering");
}

export async function getMonitoringHosts() {
    return request("/monitoring/hosts");
}

export async function getMonitoringSummary() {
    return request("/monitoring/summary");
}

export async function getMonitoringHistory(hostId, minutes = 60) {
    return request(`/monitoring/history?host=${encodeURIComponent(hostId)}&minutes=${minutes}`);
}

export async function getMonitoringAnomalies(limit = 50) {
    return request(`/monitoring/anomalies?limit=${limit}`);
}
