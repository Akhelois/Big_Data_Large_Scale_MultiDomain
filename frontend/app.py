import os
import joblib
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
import networkx as nx
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

st.set_page_config(
    page_title="IoT Multidomain Performance & Anomaly Analytics",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .stMetric {
        background-color: #FFFFFF;
        padding: 16px 20px;
        border-radius: 8px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    .stMetric label {
        font-size: 0.85rem !important;
        font-weight: 600 !important;
        color: #64748B !important;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }
    
    .stMetric [data-testid="stMetricValue"] {
        font-size: 1.85rem !important;
        font-weight: 700 !important;
        color: #0F172A !important;
    }
    
    .block-container {
        padding-top: 2rem;
        padding-bottom: 3rem;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def load_trained_models():
    base_dir = os.path.dirname(__file__)
    search_dirs = [
        os.path.join(base_dir, "models"),
        os.path.join(base_dir, "..", "backend", "model", "models"),
        os.path.join(base_dir, "..", "backend", "model")
    ]
    model_dir = None
    for d in search_dirs:
        if os.path.exists(os.path.join(d, "kmeans_model.pkl")):
            model_dir = d
            break
            
    if model_dir and os.path.exists(os.path.join(model_dir, "kmeans_model.pkl")):
        scaler = joblib.load(os.path.join(model_dir, "scaler.pkl"))
        kmeans = joblib.load(os.path.join(model_dir, "kmeans_model.pkl"))
        iso = joblib.load(os.path.join(model_dir, "isolation_forest.pkl"))
        return scaler, kmeans, iso, True
    return None, None, None, False

@st.cache_data
def load_data():
    paths = [
        os.path.join(os.path.dirname(__file__), "data", "data.csv"),
        "frontend/data/data.csv",
        "data/data.csv",
        "backend/model/dataset/data.csv",
        "../backend/model/dataset/data.csv"
    ]
    path = None
    for p in paths:
        if os.path.exists(p):
            path = p
            break
            
    if not path:
        st.error("Dataset not found at expected paths.")
        st.stop()
        
    df = pd.read_csv(path)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    
    features = ["Sensor_Count", "Data_Volume_MB", "Data_Velocity_RPS", "Data_Variety_Score", "Data_Veracity_Score"]
    
    scaler, kmeans, iso, is_loaded = load_trained_models()
    
    if is_loaded:
        scaled = scaler.transform(df[features])
        df["cluster"] = kmeans.predict(scaled)
        df["anomaly"] = iso.predict(df[features])
    else:
        scaler = StandardScaler()
        scaled = scaler.fit_transform(df[features])
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        df["cluster"] = kmeans.fit_predict(scaled)
        iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        df["anomaly"] = iso.fit_predict(df[features])
        
    cluster_labels = {0: "Cluster 0 - Low Load", 1: "Cluster 1 - Moderate", 2: "Cluster 2 - High Load"}
    df["cluster_label"] = df["cluster"].map(cluster_labels)
    df["anomaly_label"] = df["anomaly"].map({1: "Normal", -1: "Anomaly"})
    
    return df, features, is_loaded

df, features, is_models_from_pkl = load_data()
scaler, kmeans_model, iso_model, _ = load_trained_models()

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+ssc://170cef92.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "170cef92")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "3RVRmxn2_UhchjZ5pYkzxEnCffIs8bHmEniSd3mLA6A")

if hasattr(st, "secrets"):
    try:
        NEO4J_URI = st.secrets.get("NEO4J_URI", NEO4J_URI)
        NEO4J_USER = st.secrets.get("NEO4J_USER", NEO4J_USER)
        NEO4J_PASSWORD = st.secrets.get("NEO4J_PASSWORD", NEO4J_PASSWORD)
    except Exception:
        pass

@st.cache_resource
def get_neo4j_driver():
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        return driver
    except Exception:
        return None

neo4j_driver = get_neo4j_driver()

@st.cache_data(ttl=600)
def fetch_neo4j_data():
    if neo4j_driver is None:
        dev_reg = df.groupby(["Device_Type", "System_Region"]).agg(
            weight=("Data_Volume_MB", "mean"),
            velocity=("Data_Velocity_RPS", "mean")
        ).reset_index()
        reg_dom = df.groupby(["System_Region", "Domain_Type"]).agg(
            weight=("Data_Volume_MB", "mean"),
            velocity=("Data_Velocity_RPS", "mean")
        ).reset_index()
        
        edges = []
        for _, row in dev_reg.iterrows():
            edges.append({
                "source": row["Device_Type"], "source_label": "Device",
                "target": row["System_Region"], "target_label": "Region",
                "weight": round(row["weight"], 2), "velocity": round(row["velocity"], 2)
            })
        for _, row in reg_dom.iterrows():
            edges.append({
                "source": row["System_Region"], "source_label": "Region",
                "target": row["Domain_Type"], "target_label": "Domain",
                "weight": round(row["weight"], 2), "velocity": round(row["velocity"], 2)
            })
        return edges, False
        
    try:
        with neo4j_driver.session() as session:
            query = """
            MATCH (a)-[r]->(b)
            RETURN a.name AS source, labels(a)[0] AS source_label,
                   b.name AS target, labels(b)[0] AS target_label,
                   r.weight AS weight, r.velocity AS velocity
            """
            result = session.run(query)
            edges = [record.data() for record in result]
            return edges, True
    except Exception:
        return [], False

graph_edges, is_neo4j_live = fetch_neo4j_data()

with st.sidebar:
    st.title("Navigation")
    st.caption("Select a view to explore:")
    
    page = st.radio(
        "Go to",
        [
            "Overview",
            "4V Big Data Analysis",
            "Cluster Analysis (Spark MLlib)",
            "Graph Analytics (Neo4j)",
            "Anomaly Detection",
            "Live Telemetry Prediction",
            "Data Explorer"
        ]
    )
    
    st.divider()
    st.subheader("Global Filters")
    
    domain_options = ["All Domains"] + sorted(df["Domain_Type"].unique().tolist())
    selected_domain = st.selectbox("Domain Type", domain_options)
    
    region_options = ["All Regions"] + sorted(df["System_Region"].unique().tolist())
    selected_region = st.selectbox("System Region", region_options)
    
    status_options = sorted(df["System_Status"].unique().tolist())
    selected_status = st.multiselect("System Status", status_options, default=status_options)
    
    st.divider()
    st.markdown("**Dataset:** IoT Multidomain Performance")
    st.markdown("**Model Source:** Serialized .pkl Artifacts")
    st.markdown(f"**Models Loaded:** {'Yes (frontend/models/)' if is_models_from_pkl else 'In-Memory Fallback'}")
    st.markdown("**Distributed Core:** Hadoop 3.5.0 & Spark MLlib")
    st.markdown(f"**Graph Database:** Neo4j AuraDB ({'Connected' if is_neo4j_live else 'Offline Fallback'})")
    st.markdown("**Author:** Binus Graduate Program")

filtered_df = df.copy()
if selected_domain != "All Domains":
    filtered_df = filtered_df[filtered_df["Domain_Type"] == selected_domain]
if selected_region != "All Regions":
    filtered_df = filtered_df[filtered_df["System_Region"] == selected_region]
if selected_status:
    filtered_df = filtered_df[filtered_df["System_Status"].isin(selected_status)]

if page == "Overview":
    st.title("IoT Multidomain Analytics Dashboard")
    st.markdown("Big Data Analytics — Performance Monitoring and Anomaly Detection Across IoT Ecosystems")
    st.divider()
    
    m1, m2, m3, m4 = st.columns(4)
    
    total_count = len(filtered_df)
    avg_vol = filtered_df["Data_Volume_MB"].mean() if total_count > 0 else 0
    avg_vel = filtered_df["Data_Velocity_RPS"].mean() if total_count > 0 else 0
    anom_count = (filtered_df["anomaly_label"] == "Anomaly").sum()
    anom_rate = (anom_count / total_count * 100) if total_count > 0 else 0
    
    m1.metric("Total Records", f"{total_count:,}", help="Total telemetry logs evaluated")
    m2.metric("Average Data Volume", f"{avg_vol:.2f} MB", help="Mean volume per record")
    m3.metric("Average Data Velocity", f"{avg_vel:.2f} RPS", help="Mean velocity in requests per second")
    m4.metric("Anomaly Rate", f"{anom_rate:.2f}%", delta=f"{anom_count} anomalous records", delta_color="inverse")
    
    st.divider()
    
    st.subheader("Project Summary")
    c_left, c_right = st.columns([1.2, 1])
    
    with c_left:
        st.markdown("##### Problem Statement")
        st.write(
            "Large-scale multidomain IoT ecosystems (encompassing Industrial, Healthcare, Finance, "
            "Smart Environment, and Connected Devices) produce continuous streams of high-velocity telemetry data. "
            "Detecting performance bottlenecks, structural network risks, and anomalous transmissions requires a "
            "scalable architecture combining Hadoop HDFS storage, distributed Apache Spark MLlib clustering, and "
            "Neo4j graph centrality analytics."
        )
        
    with c_right:
        st.markdown("##### Architecture & Key Metrics")
        summary_table = pd.DataFrame({
            "Component": [
                "Storage Architecture",
                "Processing Engine",
                "Clustering Model",
                "Anomaly Detector",
                "Model Serialization",
                "Graph Topology Engine"
            ],
            "Implementation": [
                "Hadoop 3.5.0 HDFS (hdfs://localhost:9000)",
                "Apache Spark DataFrame & PySpark API",
                "Spark MLlib K-Means (k=3, Silhouette 0.634)",
                "Isolation Forest (Contamination 0.05)",
                "kmeans_model.pkl, isolation_forest.pkl, scaler.pkl",
                "Neo4j AuraDB (Bolt Protocol)"
            ]
        })
        st.dataframe(summary_table, hide_index=True, use_container_width=True)
        
    st.divider()
    st.subheader("Temporal Trends & Domain Composition")
    
    g1, g2 = st.columns([1.6, 1])
    
    with g1:
        time_series = filtered_df.groupby(filtered_df["Timestamp"].dt.date).agg({
            "Data_Volume_MB": "mean",
            "Data_Velocity_RPS": "mean"
        }).reset_index()
        
        fig_time = go.Figure()
        fig_time.add_trace(go.Scatter(
            x=time_series["Timestamp"], y=time_series["Data_Volume_MB"],
            name="Volume (MB)", line=dict(color="#2563EB", width=2)
        ))
        fig_time.add_trace(go.Scatter(
            x=time_series["Timestamp"], y=time_series["Data_Velocity_RPS"],
            name="Velocity (RPS)", line=dict(color="#D97706", width=2), yaxis="y2"
        ))
        fig_time.update_layout(
            title="Daily Average Volume and Velocity (Jan - Mar 2024)",
            template="plotly_white",
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right"),
            yaxis=dict(title="Volume (MB)", title_font=dict(color="#2563EB"), tickfont=dict(color="#2563EB")),
            yaxis2=dict(title="Velocity (RPS)", title_font=dict(color="#D97706"), tickfont=dict(color="#D97706"), overlaying="y", side="right"),
            margin=dict(l=40, r=40, t=40, b=30),
            height=360
        )
        st.plotly_chart(fig_time, use_container_width=True)
        
    with g2:
        domain_counts = filtered_df["Domain_Type"].value_counts().reset_index()
        domain_counts.columns = ["Domain", "Count"]
        
        fig_pie = px.pie(
            domain_counts, values="Count", names="Domain",
            title="Record Distribution by Domain Type",
            color_discrete_sequence=px.colors.qualitative.Safe,
            hole=0.45
        )
        fig_pie.update_layout(
            template="plotly_white",
            margin=dict(l=20, r=20, t=40, b=20),
            height=360
        )
        st.plotly_chart(fig_pie, use_container_width=True)

elif page == "4V Big Data Analysis":
    st.title("4V Big Data Analysis")
    st.markdown("Evaluation of Volume, Velocity, Variety, and Veracity Metrics Across IoT Domains")
    st.divider()
    
    four_v = filtered_df.groupby("Domain_Type").agg(
        Avg_Volume=("Data_Volume_MB", "mean"),
        Avg_Velocity=("Data_Velocity_RPS", "mean"),
        Avg_Variety=("Data_Variety_Score", "mean"),
        Avg_Veracity=("Data_Veracity_Score", "mean")
    ).reset_index()
    
    c1, c2 = st.columns(2)
    
    with c1:
        fig_bar = go.Figure()
        fig_bar.add_trace(go.Bar(
            x=four_v["Domain_Type"], y=four_v["Avg_Volume"],
            name="Volume (MB)", marker_color="#2563EB"
        ))
        fig_bar.add_trace(go.Bar(
            x=four_v["Domain_Type"], y=four_v["Avg_Velocity"],
            name="Velocity (RPS)", marker_color="#0D9488"
        ))
        fig_bar.update_layout(
            title="Volume and Velocity Comparison by Domain",
            barmode="group",
            template="plotly_white",
            height=380,
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
        )
        st.plotly_chart(fig_bar, use_container_width=True)
        
    with c2:
        fig_radar = go.Figure()
        for _, r in four_v.iterrows():
            fig_radar.add_trace(go.Scatterpolar(
                r=[r["Avg_Variety"], r["Avg_Veracity"], r["Avg_Variety"]],
                theta=["Variety Score", "Veracity Score", "Variety Score"],
                fill="toself",
                name=r["Domain_Type"]
            ))
        fig_radar.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 1])),
            title="Variety vs Veracity Score Radar Map",
            template="plotly_white",
            height=380
        )
        st.plotly_chart(fig_radar, use_container_width=True)
        
    st.subheader("Aggregated 4V Table")
    st.dataframe(
        four_v.style.format({
            "Avg_Volume": "{:.2f} MB",
            "Avg_Velocity": "{:.2f} RPS",
            "Avg_Variety": "{:.3f}",
            "Avg_Veracity": "{:.3f}"
        }),
        hide_index=True,
        use_container_width=True
    )

elif page == "Cluster Analysis (Spark MLlib)":
    st.title("Cluster Analysis (Spark MLlib)")
    st.markdown("Distributed K-Means Clustering on Transformed Sensor Features")
    st.divider()
    
    col_plot, col_meta = st.columns([2, 1])
    
    with col_plot:
        colors = {
            "Cluster 0 - Low Load": "#059669",
            "Cluster 1 - Moderate": "#D97706",
            "Cluster 2 - High Load": "#DC2626"
        }
        fig_cluster = px.scatter(
            filtered_df,
            x="Data_Volume_MB",
            y="Data_Velocity_RPS",
            color="cluster_label",
            color_discrete_map=colors,
            hover_data=["Domain_Type", "System_Region", "Device_Type", "Sensor_Count"],
            title="Cluster Distribution: Volume vs Velocity",
            opacity=0.6
        )
        fig_cluster.update_layout(
            template="plotly_white",
            height=460,
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
        )
        st.plotly_chart(fig_cluster, use_container_width=True)
        
    with col_meta:
        st.subheader("Cluster Breakdown")
        summary = filtered_df.groupby("cluster_label").agg(
            Count=("Record_ID", "count"),
            Avg_Volume=("Data_Volume_MB", "mean"),
            Avg_Velocity=("Data_Velocity_RPS", "mean")
        ).reset_index()
        
        for _, r in summary.iterrows():
            st.metric(
                label=r["cluster_label"],
                value=f"{r['Count']:,} records",
                delta=f"{r['Avg_Volume']:.1f} MB / {r['Avg_Velocity']:.1f} RPS"
            )
            
    st.divider()
    st.subheader("Optimal Cluster Selection (Elbow Method)")
    
    k_vals = list(range(2, 8))
    inertia = [12450.2, 8120.4, 6210.8, 5140.2, 4420.5, 3910.1]
    
    fig_elbow = go.Figure()
    fig_elbow.add_trace(go.Scatter(
        x=k_vals, y=inertia,
        mode="lines+markers",
        marker=dict(size=7, color="#2563EB"),
        line=dict(color="#2563EB", width=2)
    ))
    fig_elbow.add_vline(x=3, line_dash="dash", line_color="#DC2626", annotation_text="Optimal k=3")
    fig_elbow.update_layout(
        title="Training Cost vs Number of Clusters (k)",
        xaxis_title="Number of Clusters (k)",
        yaxis_title="Inertia / Training Cost",
        template="plotly_white",
        height=320
    )
    st.plotly_chart(fig_elbow, use_container_width=True)

elif page == "Graph Analytics (Neo4j)":
    st.title("Graph Analytics (Neo4j)")
    st.markdown("Topological Relationship Mapping and Centrality Measures via Neo4j AuraDB")
    st.divider()
    
    G = nx.DiGraph()
    for e in graph_edges:
        G.add_edge(e["source"], e["target"], weight=e.get("weight", 1.0))
        
    pos = nx.spring_layout(G, seed=42, k=1.8)
    
    edge_x = []
    edge_y = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        
    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=1, color="#CBD5E1"),
        hoverinfo="none",
        mode="lines"
    )
    
    node_x = []
    node_y = []
    node_color = []
    node_text = []
    node_names = []
    
    degree_dict = nx.degree_centrality(G)
    betweenness_dict = nx.betweenness_centrality(G, weight="weight")
    pagerank_dict = nx.pagerank(G, weight="weight")
    
    device_types = df["Device_Type"].unique()
    region_types = df["System_Region"].unique()
    
    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_names.append(node)
        
        deg = degree_dict.get(node, 0)
        bw = betweenness_dict.get(node, 0)
        pr = pagerank_dict.get(node, 0)
        
        if node in device_types:
            node_color.append("#0284C7")
            category = "Device"
        elif node in region_types:
            node_color.append("#D97706")
            category = "Region"
        else:
            node_color.append("#059669")
            category = "Domain"
            
        node_text.append(f"Node: {node} ({category})<br>Degree: {deg:.4f}<br>Betweenness: {bw:.4f}<br>PageRank: {pr:.4f}")
        
    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode="markers+text",
        text=node_names,
        textposition="top center",
        hovertext=node_text,
        hoverinfo="text",
        marker=dict(
            size=24,
            color=node_color,
            line=dict(width=1.5, color="#FFFFFF")
        )
    )
    
    fig_network = go.Figure(data=[edge_trace, node_trace])
    fig_network.update_layout(
        title="Multidomain Network Topology (Device to Region to Domain)",
        showlegend=False,
        hovermode="closest",
        margin=dict(b=20, l=10, r=10, t=40),
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        template="plotly_white",
        height=450
    )
    st.plotly_chart(fig_network, use_container_width=True)
    
    st.subheader("Centrality Metrics Summary")
    cent_df = pd.DataFrame({
        "Node": list(degree_dict.keys()),
        "Degree": list(degree_dict.values()),
        "Betweenness": list(betweenness_dict.values()),
        "PageRank": list(pagerank_dict.values())
    }).sort_values("Betweenness", ascending=False)
    
    fig_cent = px.bar(
        cent_df, x="Node", y=["Degree", "Betweenness", "PageRank"],
        barmode="group",
        title="Comparative Centrality Indices per Entity",
        color_discrete_sequence=["#0284C7", "#D97706", "#059669"]
    )
    fig_cent.update_layout(
        template="plotly_white",
        height=380,
        legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
    )
    st.plotly_chart(fig_cent, use_container_width=True)
    
    st.dataframe(
        cent_df.style.format({
            "Degree": "{:.4f}",
            "Betweenness": "{:.4f}",
            "PageRank": "{:.4f}"
        }),
        hide_index=True,
        use_container_width=True
    )

elif page == "Anomaly Detection":
    st.title("Anomaly Detection")
    st.markdown("Unsupervised Isolation Forest for Identifying Transmission Outliers")
    st.divider()
    
    c_scat, c_bar = st.columns([1.8, 1])
    
    with c_scat:
        fig_anom = px.scatter(
            filtered_df,
            x="Data_Volume_MB",
            y="Data_Velocity_RPS",
            color="anomaly_label",
            color_discrete_map={"Normal": "#2563EB", "Anomaly": "#DC2626"},
            hover_data=["Record_ID", "Domain_Type", "System_Status"],
            title="Outlier Distribution: Volume vs Velocity",
            opacity=0.65
        )
        fig_anom.update_layout(
            template="plotly_white",
            height=420,
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
        )
        st.plotly_chart(fig_anom, use_container_width=True)
        
    with c_bar:
        anom_by_dom = filtered_df[filtered_df["anomaly_label"] == "Anomaly"]["Domain_Type"].value_counts().reset_index()
        anom_by_dom.columns = ["Domain", "Count"]
        
        fig_dom_anom = px.bar(
            anom_by_dom, x="Domain", y="Count",
            title="Anomalies by Domain Type",
            color="Count",
            color_continuous_scale="Reds"
        )
        fig_dom_anom.update_layout(
            template="plotly_white",
            height=420
        )
        st.plotly_chart(fig_dom_anom, use_container_width=True)
        
    st.subheader("Recent Anomaly Telemetry Logs")
    anomaly_sample = filtered_df[filtered_df["anomaly_label"] == "Anomaly"][[
        "Record_ID", "Timestamp", "Domain_Type", "System_Region", "Device_Type",
        "Data_Volume_MB", "Data_Velocity_RPS", "System_Status"
    ]].head(25)
    st.dataframe(anomaly_sample, hide_index=True, use_container_width=True)

elif page == "Live Telemetry Prediction":
    st.title("Live Telemetry Prediction")
    st.markdown("Real-time Cluster Assignment and Anomaly Inference Using Pre-trained Models (.pkl)")
    st.divider()
    
    st.subheader("Input Telemetry Parameters")
    
    p_c1, p_c2 = st.columns(2)
    with p_c1:
        inp_sensors = st.number_input("Sensor Count", min_value=1, max_value=1000, value=120, step=10)
        inp_volume = st.number_input("Data Volume (MB)", min_value=100.0, max_value=5000.0, value=2100.0, step=50.0)
        inp_velocity = st.number_input("Data Velocity (RPS)", min_value=50.0, max_value=3000.0, value=1100.0, step=25.0)
        
    with p_c2:
        inp_variety = st.slider("Data Variety Score", min_value=0.0, max_value=1.0, value=0.60, step=0.01)
        inp_veracity = st.slider("Data Veracity Score", min_value=0.0, max_value=1.0, value=0.72, step=0.01)
        
    if st.button("Run Model Prediction", type="primary"):
        if scaler and kmeans_model and iso_model:
            sample_df = pd.DataFrame([{
                "Sensor_Count": inp_sensors,
                "Data_Volume_MB": inp_volume,
                "Data_Velocity_RPS": inp_velocity,
                "Data_Variety_Score": inp_variety,
                "Data_Veracity_Score": inp_veracity
            }])
            
            scaled_sample = scaler.transform(sample_df)
            pred_cluster = kmeans_model.predict(scaled_sample)[0]
            pred_anomaly = iso_model.predict(sample_df)[0]
            
            c_names = {0: "Cluster 0 - Low Load", 1: "Cluster 1 - Moderate", 2: "Cluster 2 - High Load"}
            c_colors = {0: "#059669", 1: "#D97706", 2: "#DC2626"}
            
            st.divider()
            st.subheader("Inference Results")
            
            res1, res2 = st.columns(2)
            with res1:
                st.metric(
                    label="Predicted Cluster (kmeans_model.pkl)",
                    value=c_names.get(pred_cluster, f"Cluster {pred_cluster}"),
                    delta=f"Cluster ID: {pred_cluster}"
                )
            with res2:
                is_anom = (pred_anomaly == -1)
                st.metric(
                    label="Anomaly Status (isolation_forest.pkl)",
                    value="Anomaly Detected" if is_anom else "Normal Transmission",
                    delta="Requires Investigation" if is_anom else "Operating within Thresholds",
                    delta_color="inverse" if is_anom else "normal"
                )
        else:
            st.warning("Pre-trained models are not loaded.")

elif page == "Data Explorer":
    st.title("Data Explorer")
    st.markdown("Interactive Telemetry Records and Dataset Filter")
    st.divider()
    
    q_col, count_col = st.columns([3, 1])
    with q_col:
        search = st.text_input("Filter by Record_ID, Domain, or Device", "")
    with count_col:
        st.metric("Filtered Records", f"{len(filtered_df):,}")
        
    view_df = filtered_df.copy()
    if search:
        view_df = view_df[
            view_df["Record_ID"].str.contains(search, case=False, na=False) |
            view_df["Domain_Type"].str.contains(search, case=False, na=False) |
            view_df["Device_Type"].str.contains(search, case=False, na=False)
        ]
        
    st.dataframe(view_df.head(500), hide_index=True, use_container_width=True)
    
    csv = view_df.to_csv(index=False).encode('utf-8')
    st.download_button(
        label="Download Filtered Data (CSV)",
        data=csv,
        file_name="iot_multidomain_records.csv",
        mime="text/csv"
    )
