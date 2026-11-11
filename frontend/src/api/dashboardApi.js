const API_URL = import.meta.env.VITE_API_URL || "/api";

export const API_BASE_URL = API_URL.replace(/\/api\/?$/, "");

async function request(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`);

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
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

export async function getClusteringScatter(refresh = false) {
    return request(`/clustering/scatter${refresh ? "?refresh=1" : ""}`);
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

export async function getMonitoringCorrelation(host) {
    const q = host ? `?host=${encodeURIComponent(host)}` : "";
    return request(`/monitoring/correlation${q}`);
}

export async function getIotSummary() {
    return request("/monitoring/iot/summary");
}

export async function getIotDevices() {
    return request("/monitoring/iot/devices");
}

export async function getIotTelemetry(deviceId = "iot_weather", minutes = 30) {
    return request(`/monitoring/iot/telemetry?device=${encodeURIComponent(deviceId)}&minutes=${minutes}`);
}

export async function getIotAnomalies(limit = 20) {
    return request(`/monitoring/iot/anomalies?limit=${limit}`);
}

export async function getNetworkSummary() {
    return request("/monitoring/network/summary");
}

export async function getNetworkTraffic(minutes = 30) {
    return request(`/monitoring/network/traffic?minutes=${minutes}`);
}

export async function getNetworkFlows(limit = 25) {
    return request(`/monitoring/network/flows?limit=${limit}`);
}

export async function getNetworkThreats(limit = 20) {
    return request(`/monitoring/network/threats?limit=${limit}`);
}

export async function getNetworkProtocols() {
    return request("/monitoring/network/protocols");
}

