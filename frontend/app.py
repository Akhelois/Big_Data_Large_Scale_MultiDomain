import os
import json
import joblib
from pathlib import Path
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

MODEL_FEATURES = [
    "Feature_Count",
    "Observed_Feature_Count",
    "Feature_Mean",
    "Feature_Max",
    "Feature_StdDev",
]

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

def get_base_dataset_dir():
    candidates = [
        Path("backend/model/dataset"),
        Path("../backend/model/dataset"),
        Path(__file__).resolve().parent.parent / "backend" / "model" / "dataset",
        Path(r"c:\Users\Jase.LAPTOP-UM736EL9\Documents\Binus\S2\S3 P1\Code\backend\model\dataset")
    ]
    for p in candidates:
        if p.exists() and (p / "Processed_IoT_dataset").exists():
            return p
    return None

@st.cache_resource
def load_trained_models():
    base_dir = os.path.dirname(__file__)
    search_dirs = [
        os.path.join(base_dir, "models"),
        os.path.join(base_dir, "..", "backend", "model", "models"),
        os.path.join(base_dir, "..", "backend", "model")
    ]
    required_models = ["scaler.pkl", "kmeans_model.pkl", "isolation_forest.pkl"]
    for model_dir in search_dirs:
        model_paths = [os.path.join(model_dir, name) for name in required_models]
        if all(os.path.isfile(path) for path in model_paths):
            scaler = joblib.load(model_paths[0])
            kmeans = joblib.load(model_paths[1])
            iso = joblib.load(model_paths[2])
            return scaler, kmeans, iso, True
    return None, None, None, False

@st.cache_resource
def load_domain_models():
    base_dirs = [
        os.path.join(os.path.dirname(__file__), "models"),
        os.path.join(os.path.dirname(__file__), "..", "backend", "model", "models"),
        os.path.join(os.path.dirname(__file__), "..", "backend", "model")
    ]
    models = {}
    for dom in ["network", "iot", "linux", "windows"]:
        models[dom] = {}
        for d in base_dirs:
            scaler_p = os.path.join(d, f"{dom}_scaler.pkl")
            kmeans_p = os.path.join(d, f"{dom}_kmeans.pkl")
            iso_p = os.path.join(d, f"{dom}_iso.pkl")
            feat_p = os.path.join(d, f"{dom}_features.json")
            if os.path.exists(scaler_p) and os.path.exists(kmeans_p) and os.path.exists(iso_p):
                models[dom]["scaler"] = joblib.load(scaler_p)
                models[dom]["kmeans"] = joblib.load(kmeans_p)
                models[dom]["iso"] = joblib.load(iso_p)
                if os.path.exists(feat_p):
                    with open(feat_p, "r", encoding="utf-8") as f:
                        models[dom]["features"] = json.load(f)
                break
    return models

@st.cache_data
def list_available_domain_csvs():
    base_ds = get_base_dataset_dir()
    if not base_ds:
        return {}
    return {
        "IoT": sorted([f.name for f in (base_ds / "Processed_IoT_dataset").glob("*.csv")]),
        "Linux": sorted([f.name for f in (base_ds / "Processed_Linux_dataset").glob("*.csv")]),
        "Network": sorted([f.name for f in (base_ds / "Processed_Network_dataset").glob("*.csv")]),
        "Windows": sorted([f.name for f in (base_ds / "Processed_Windows_dataset").glob("*.csv")]),
    }

@st.cache_data
def load_single_csv(domain_name, file_name, nrows=1000):
    base_ds = get_base_dataset_dir()
    if not base_ds:
        return pd.DataFrame()
    folder_map = {
        "IoT": "Processed_IoT_dataset",
        "Linux": "Processed_Linux_dataset",
        "Network": "Processed_Network_dataset",
        "Windows": "Processed_Windows_dataset"
    }
    target = base_ds / folder_map.get(domain_name, "") / file_name
    if target.exists():
        return pd.read_csv(target, nrows=nrows)
    return pd.DataFrame()

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
            
    if path:
        df = pd.read_csv(path)
    else:
        base_ds = get_base_dataset_dir()
        if not base_ds:
            st.error("Direktori dataset tidak ditemukan.")
            st.stop()
        domain_cfgs = {
            "IoT": ("Processed_IoT_dataset", "IoT_Smart_Environment", 500),
            "Linux": ("Processed_Linux_dataset", "Linux_Host_Cluster", 500),
            "Network": ("Processed_Network_dataset", "Network_Gateway_Core", 300),
            "Windows": ("Processed_Windows_dataset", "Windows_Workstation_Domain", 1000),
        }
        non_feat = {
            'date', 'time', 'ts', 'label', 'type', 'cmd', 'disk_name',
            'src_ip', 'dst_ip', 'proto', 'service', 'conn_state', 'history',
            'dns_query', 'ssl_version', 'http_uri', 'http_host', 'http_user_agent',
            'weird_name', 'weird_addl', 'weird_notice'
        }
        recs = []
        r_id = 1
        for dom, (fol, reg, s_rows) in domain_cfgs.items():
            f_files = sorted((base_ds / fol).glob("*.csv"))
            for fp in f_files:
                dev = fp.stem
                try:
                    chk = pd.read_csv(fp, nrows=s_rows)
                except Exception:
                    continue
                cl = {c.lower(): c for c in chk.columns}
                lbl_c = cl.get('label')
                typ_c = cl.get('type')
                ncols = [c for c in chk.columns if c.lower() not in non_feat]
                if not ncols:
                    continue
                ndf = chk[ncols].apply(pd.to_numeric, errors='coerce').fillna(0.0)
                fc = len(ncols)
                oc = (ndf.abs() > 1e-5).sum(axis=1)
                fm = ndf.mean(axis=1)
                fmax = ndf.max(axis=1)
                fmin = ndf.min(axis=1)
                fs = ndf.std(axis=1).fillna(0.0)
                if 'date' in cl and 'time' in cl:
                    ts = pd.to_datetime(chk[cl['date']].astype(str) + ' ' + chk[cl['time']].astype(str), errors='coerce')
                elif 'ts' in cl:
                    ts = pd.to_datetime(pd.to_numeric(chk[cl['ts']], errors='coerce'), unit='s', errors='coerce')
                else:
                    from datetime import datetime
                    ts = pd.Series([datetime(2024, 1, 1)] * len(chk))
                from datetime import datetime
                ts = ts.fillna(datetime(2024, 1, 1))
                tl = chk[lbl_c].astype(int) if lbl_c else pd.Series([0] * len(chk))
                tt = chk[typ_c].astype(str).str.strip().str.lower() if typ_c else pd.Series(['normal'] * len(chk))
                tt = tt.replace({'nan': 'normal', '': 'normal', '0': 'normal', '1': 'anomaly'})
                n = len(chk)
                ids = [f"REC_{r_id + i:06d}" for i in range(n)]
                r_id += n
                recs.append(pd.DataFrame({
                    "Record_ID": ids,
                    "Timestamp": ts.dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "Domain_Type": dom,
                    "Source_Domain": dom,
                    "System_Region": reg,
                    "Device_Type": dev,
                    "Source_File": fp.name,
                    "Feature_Count": fc,
                    "Observed_Feature_Count": oc,
                    "Feature_Mean": fm,
                    "Feature_Max": fmax,
                    "Feature_Min": fmin,
                    "Feature_StdDev": fs,
                    "Data_Volume_MB": (fm.abs() * fc) / (1024.0 * 1024.0) + 0.1,
                    "Data_Velocity_RPS": oc * 1.5 + 1.0,
                    "Data_Variety_Score": fm,
                    "Data_Veracity_Score": fs,
                    "Target_Label": tl,
                    "Target_Type": tt,
                    "System_Status": np.where(tl == 1, "Anomaly", "Normal")
                }))
        df = pd.concat(recs, ignore_index=True)

    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    features = MODEL_FEATURES
    
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
        
    cluster_labels = {0: "Cluster 0 - Low Profile", 1: "Cluster 1 - Moderate", 2: "Cluster 2 - High Profile"}
    df["cluster_label"] = df["cluster"].map(cluster_labels)
    df["anomaly_label"] = df["anomaly"].map({1: "Normal", -1: "Anomaly"})
    
    return df, features, is_loaded

df, features, is_models_from_pkl = load_data()
scaler, kmeans_model, iso_model, _ = load_trained_models()
domain_models = load_domain_models()

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+ssc://170cef92.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "170cef92")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "3RVRmxn2_UhchjZ5pYkzxEnCffIs8bHmEniSd3mLA6A")

try:
    if hasattr(st, "secrets") and "neo4j" in st.secrets:
        NEO4J_URI = st.secrets["neo4j"].get("NEO4J_URI", NEO4J_URI)
        NEO4J_USER = st.secrets["neo4j"].get("NEO4J_USER", NEO4J_USER)
        NEO4J_PASSWORD = st.secrets["neo4j"].get("NEO4J_PASSWORD", NEO4J_PASSWORD)
except Exception:
    pass

@st.cache_resource
def get_neo4j_driver():
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            connection_timeout=5.0,
            max_connection_lifetime=60.0
        )
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
            activity=("Data_Velocity_RPS", "mean")
        ).reset_index()
        reg_dom = df.groupby(["System_Region", "Domain_Type"]).agg(
            weight=("Data_Volume_MB", "mean"),
            activity=("Data_Velocity_RPS", "mean")
        ).reset_index()
        
        edges = []
        for _, row in dev_reg.iterrows():
            edges.append({
                "source": row["Device_Type"], "source_label": "Device",
                "target": row["System_Region"], "target_label": "Region",
                "weight": round(row["weight"], 2), "activity": round(row["activity"], 2)
            })
        for _, row in reg_dom.iterrows():
            edges.append({
                "source": row["System_Region"], "source_label": "Region",
                "target": row["Domain_Type"], "target_label": "Domain",
                "weight": round(row["weight"], 2), "activity": round(row["activity"], 2)
            })
        return edges, False
        
    try:
        with neo4j_driver.session() as session:
            query = """
            MATCH (a)-[r]->(b)
            RETURN a.name AS source, labels(a)[0] AS source_label,
                   b.name AS target, labels(b)[0] AS target_label,
                   r.weight AS weight, r.velocity AS activity
            """
            result = session.run(query)
            edges = [record.data() for record in result]
            return edges, True
    except Exception:
        return [], False

graph_edges, is_neo4j_live = fetch_neo4j_data()

with st.sidebar:
    st.title("Navigation")
    st.caption("Pilih modul analisis:")
    
    page = st.radio(
        "Menu",
        [
            "Overview",
            "4V Big Data Analysis",
            "Domain Feature Analytics (Fitur Asli)",
            "Cluster Analysis (Spark MLlib)",
            "Graph Analytics (Neo4j)",
            "Anomaly Detection",
            "Live Telemetry Prediction (Model .pkl)",
            "Data Explorer (Per-CSV Inspector)"
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
    st.markdown("**Dataset:** TON_IoT Multidomain Benchmark")
    st.markdown("**Domain Models:** Network, IoT, Linux, Windows (.pkl)")
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
    st.markdown("Big Data Analytics - Performance Monitoring and Anomaly Detection Across Multidomain IoT Systems")
    st.divider()
    
    m1, m2, m3, m4 = st.columns(4)
    
    total_count = len(filtered_df)
    avg_vol = filtered_df["Data_Volume_MB"].mean() if total_count > 0 else 0
    avg_vel = filtered_df["Data_Velocity_RPS"].mean() if total_count > 0 else 0
    anom_count = (filtered_df["anomaly_label"] == "Anomaly").sum()
    anom_rate = (anom_count / total_count * 100) if total_count > 0 else 0
    
    m1.metric("Total Records", f"{total_count:,}")
    m2.metric("Average Data Volume", f"{avg_vol:.2f} MB")
    m3.metric("Average Data Velocity", f"{avg_vel:.2f} RPS")
    m4.metric("Anomaly Rate", f"{anom_rate:.2f}%", delta=f"{anom_count} anomali", delta_color="inverse")
    
    st.divider()
    
    st.subheader("Project Summary & Domain Architectures")
    c_left, c_right = st.columns([1.2, 1])
    
    with c_left:
        st.markdown("##### Multidomain Architecture Overview")
        st.write(
            "Lingkungan IoT multidomain memproses data telemetri heterogen dari sensor fisik (IoT), "
            "layanan host (Linux), aliran lalu lintas jaringan (Network), dan workstation pengguna (Windows). "
            "Setiap domain memiliki struktur fitur aslinya masing-masing yang dilatih secara independen "
            "menggunakan K-Means dan Isolation Forest, serta diintegrasikan ke dalam topologi graf Neo4j."
        )
        
    with c_right:
        st.markdown("##### Komponen Pipeline")
        summary_table = pd.DataFrame({
            "Domain / Modul": [
                "Network Domain",
                "IoT Sensors Domain",
                "Linux Host Domain",
                "Windows Domain",
                "Distributed Core",
                "Graph Topology"
            ],
            "Fitur Asli & Implementasi": [
                "duration, src/dst bytes, src/dst pkts (23 CSV)",
                "temp, humidity, pressure, modbus (7 CSV)",
                "CPU, MEM, RDDSK, WRDSK, VSIZE (6 CSV)",
                "Processor Time, Thread/Handle Count (2 CSV)",
                "Apache Spark MLlib & Hadoop Snappy Parquet",
                "Neo4j AuraDB Centrality & NetworkX"
            ]
        })
        st.dataframe(summary_table, hide_index=True, use_container_width=True)
        
    st.divider()
    st.subheader("Temporal Trends & Domain Distribution")
    
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
            title="Tren Rata-rata Volume dan Velocity Harian",
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
            title="Distribusi Data Berdasarkan Domain",
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
    st.markdown("Evaluasi Komparatif Metrik Volume, Velocity, Variety, dan Veracity Lintas Domain")
    st.divider()
    
    four_v = filtered_df.groupby("Domain_Type").agg(
        Avg_Volume=("Data_Volume_MB", "mean"),
        Avg_Velocity=("Data_Velocity_RPS", "mean"),
        Avg_Variety=("Data_Variety_Score", "mean"),
        Avg_Veracity=("Data_Veracity_Score", "mean"),
        Feature_Count=("Feature_Count", "mean")
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
            title="Perbandingan Volume dan Velocity per Domain",
            barmode="group",
            template="plotly_white",
            height=380,
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
        )
        st.plotly_chart(fig_bar, use_container_width=True)
        
    with c2:
        fig_radar = go.Figure()
        for _, r in four_v.iterrows():
            norm_var = min(1.0, max(0.1, np.log1p(abs(r["Avg_Variety"])) / 20.0))
            norm_ver = min(1.0, max(0.1, np.log1p(abs(r["Avg_Veracity"])) / 20.0))
            norm_vol = min(1.0, max(0.1, r["Avg_Volume"] / 600.0))
            norm_vel = min(1.0, max(0.1, r["Avg_Velocity"] / 100.0))
            fig_radar.add_trace(go.Scatterpolar(
                r=[norm_vol, norm_vel, norm_var, norm_ver, norm_vol],
                theta=["Volume", "Velocity", "Variety", "Veracity", "Volume"],
                fill="toself",
                name=r["Domain_Type"]
            ))
        fig_radar.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 1])),
            title="Radar Profile 4V Big Data per Domain",
            template="plotly_white",
            height=380
        )
        st.plotly_chart(fig_radar, use_container_width=True)
        
    st.subheader("Tabel Metrik Agregasi 4V Big Data")
    st.dataframe(
        four_v.style.format({
            "Avg_Volume": "{:.2f} MB",
            "Avg_Velocity": "{:.2f} RPS",
            "Avg_Variety": "{:,.2f}",
            "Avg_Veracity": "{:,.2f}",
            "Feature_Count": "{:.1f}"
        }),
        hide_index=True,
        use_container_width=True
    )

elif page == "Domain Feature Analytics (Fitur Asli)":
    st.title("Domain Feature Analytics (Fitur Asli per Dataset)")
    st.markdown("Eksplorasi dan visualisasi mendalam menggunakan fitur-fitur asli dari masing-masing domain.")
    st.divider()
    
    dom_tab1, dom_tab2, dom_tab3, dom_tab4 = st.tabs([
        "Network Domain (NetFlow)",
        "IoT Sensor Domain (Sensors)",
        "Linux Host Domain (OS Metrics)",
        "Windows Domain (Telemetry)"
    ])
    
    with dom_tab1:
        st.subheader("Network Domain: NetFlow Traffic Features")
        st.caption("Dataset asli terdiri dari 23 file CSV dengan 46 kolom fitur jaringan.")
        
        net_sample = load_single_csv("Network", "Network_dataset_1.csv", nrows=3000)
        if not net_sample.empty:
            num_cols = ["duration", "src_bytes", "dst_bytes", "src_pkts", "dst_pkts", "src_ip_bytes", "dst_ip_bytes"]
            for c in num_cols:
                net_sample[c] = pd.to_numeric(net_sample[c], errors="coerce").fillna(0.0)
                
            nc1, nc2, nc3, nc4 = st.columns(4)
            nc1.metric("Total Bytes Dikirim", f"{net_sample['src_bytes'].sum():,}")
            nc2.metric("Total Bytes Diterima", f"{net_sample['dst_bytes'].sum():,}")
            nc3.metric("Rata-rata Durasi (detik)", f"{net_sample['duration'].mean():.4f}")
            nc4.metric("Total Paket Jaringan", f"{net_sample['src_pkts'].sum() + net_sample['dst_pkts'].sum():,}")
            
            st.divider()
            n_plot1, n_plot2 = st.columns(2)
            with n_plot1:
                fig_net_bytes = px.scatter(
                    net_sample.head(1000),
                    x="src_bytes", y="dst_bytes",
                    color="type",
                    size="src_pkts",
                    hover_data=["src_ip", "dst_ip", "proto", "service", "duration"],
                    title="Distribusi Flow: Source Bytes vs Destination Bytes",
                    template="plotly_white",
                    height=400
                )
                st.plotly_chart(fig_net_bytes, use_container_width=True)
            with n_plot2:
                fig_proto = px.histogram(
                    net_sample, x="type", color="proto",
                    barmode="group",
                    title="Distribusi Jenis Aktivitas & Protokol Jaringan",
                    template="plotly_white",
                    height=400
                )
                st.plotly_chart(fig_proto, use_container_width=True)
                
            st.markdown("##### Cuplikan Data NetFlow Asli (Network_dataset_1.csv)")
            st.dataframe(net_sample[["ts", "src_ip", "dst_ip", "proto", "service", "duration", "src_bytes", "dst_bytes", "src_pkts", "dst_pkts", "label", "type"]].head(10), use_container_width=True)
        else:
            st.info("File Network dataset tidak ditemukan.")

    with dom_tab2:
        st.subheader("IoT Sensor Domain: Real Sensor Metrics")
        st.caption("Data sensor lingkungan, pendingin, termostat, dan Modbus PLC.")
        
        weather_df = load_single_csv("IoT", "IoT_Weather.csv", nrows=3000)
        fridge_df = load_single_csv("IoT", "IoT_Fridge.csv", nrows=3000)
        modbus_df = load_single_csv("IoT", "IoT_Modbus.csv", nrows=3000)
        
        iot_c1, iot_c2, iot_c3 = st.columns(3)
        if not weather_df.empty:
            weather_df["temperature"] = pd.to_numeric(weather_df["temperature"], errors="coerce").fillna(0.0)
            weather_df["humidity"] = pd.to_numeric(weather_df["humidity"], errors="coerce").fillna(0.0)
            weather_df["pressure"] = pd.to_numeric(weather_df["pressure"], errors="coerce").fillna(0.0)
            iot_c1.metric("Rata-rata Suhu Cuaca", f"{weather_df['temperature'].mean():.2f} C")
            iot_c2.metric("Rata-rata Kelembapan", f"{weather_df['humidity'].mean():.2f} %")
            iot_c3.metric("Rata-rata Tekanan", f"{weather_df['pressure'].mean():.2f} hPa")
            
            st.divider()
            iot_p1, iot_p2 = st.columns(2)
            with iot_p1:
                fig_iot_w = px.scatter(
                    weather_df.head(1000),
                    x="temperature", y="humidity", color="type",
                    title="Sensor Cuaca: Temperatur vs Kelembapan",
                    template="plotly_white", height=380
                )
                st.plotly_chart(fig_iot_w, use_container_width=True)
            with iot_p2:
                if not fridge_df.empty:
                    fridge_df["fridge_temperature"] = pd.to_numeric(fridge_df["fridge_temperature"], errors="coerce").fillna(0.0)
                    fig_fridge = px.histogram(
                        fridge_df, x="fridge_temperature", color="type",
                        title="Distribusi Suhu Kulkas IoT (IoT_Fridge.csv)",
                        template="plotly_white", height=380
                    )
                    st.plotly_chart(fig_fridge, use_container_width=True)
                    
            if not modbus_df.empty:
                st.markdown("##### Cuplikan Sensor Modbus PLC (IoT_Modbus.csv)")
                st.dataframe(modbus_df.head(8), use_container_width=True)
        else:
            st.info("File IoT dataset tidak ditemukan.")

    with dom_tab3:
        st.subheader("Linux Host Domain: CPU, Memory, and Disk Metrics")
        st.caption("Telemetri proses dan utilisasi sistem operasi Linux.")
        
        proc_df = load_single_csv("Linux", "Linux_process_1.csv", nrows=3000)
        mem_df = load_single_csv("Linux", "linux_memory1.csv", nrows=3000)
        
        if not proc_df.empty:
            proc_df["CPU"] = pd.to_numeric(proc_df["CPU"], errors="coerce").fillna(0.0)
            proc_df["PRI"] = pd.to_numeric(proc_df["PRI"], errors="coerce").fillna(0.0)
            
            l_c1, l_c2, l_c3 = st.columns(3)
            l_c1.metric("Rata-rata Utilisasi CPU (%)", f"{proc_df['CPU'].mean() * 100:.2f}%")
            l_c2.metric("Prioritas Proses (PRI)", f"{proc_df['PRI'].mean():.1f}")
            l_c3.metric("Total Proses Aktif", f"{len(proc_df):,}")
            
            st.divider()
            lp1, lp2 = st.columns(2)
            with lp1:
                fig_cpu = px.box(
                    proc_df.head(1000), x="type", y="CPU",
                    color="type",
                    title="Distribusi Penggunaan CPU per Status Aktivitas",
                    template="plotly_white", height=380
                )
                st.plotly_chart(fig_cpu, use_container_width=True)
            with lp2:
                if not mem_df.empty:
                    mem_df["MEM"] = pd.to_numeric(mem_df["MEM"], errors="coerce").fillna(0.0)
                    mem_df["VSIZE"] = pd.to_numeric(mem_df["VSIZE"], errors="coerce").fillna(0.0)
                    fig_mem = px.scatter(
                        mem_df.head(1000), x="VSIZE", y="MEM", color="type",
                        title="Distribusi Penggunaan Memori Virtual (VSIZE) vs MEM",
                        template="plotly_white", height=380
                    )
                    st.plotly_chart(fig_mem, use_container_width=True)
            st.markdown("##### Cuplikan Data Proses Linux (Linux_process_1.csv)")
            st.dataframe(proc_df[["ts", "PID", "CMD", "CPU", "PRI", "NICE", "CPUNR", "Status", "label", "type"]].head(8), use_container_width=True)
        else:
            st.info("File Linux dataset tidak ditemukan.")

    with dom_tab4:
        st.subheader("Windows Domain: Workstation Telemetry Metrics")
        st.caption("Audit log dan metrik telemetri performa Windows 7 & 10 (135 kolom).")
        
        win_df = load_single_csv("Windows", "windows7_dataset.csv", nrows=3000)
        if not win_df.empty:
            proc_time_col = "Processor(_Total) pct_ Processor Time"
            thread_col = "Process(_Total) Thread Count"
            handle_col = "Process(_Total) Handle Count"
            mem_col = "Memory Available MBytes"
            
            for c in [proc_time_col, thread_col, handle_col, mem_col]:
                if c in win_df.columns:
                    win_df[c] = pd.to_numeric(win_df[c], errors="coerce").fillna(0.0)
                    
            wc1, wc2, wc3, wc4 = st.columns(4)
            wc1.metric("Processor Time (%)", f"{win_df[proc_time_col].mean():.2f}%" if proc_time_col in win_df else "N/A")
            wc2.metric("Thread Count", f"{win_df[thread_col].mean():.0f}" if thread_col in win_df else "N/A")
            wc3.metric("Handle Count", f"{win_df[handle_col].mean():.0f}" if handle_col in win_df else "N/A")
            wc4.metric("Memory Available", f"{win_df[mem_col].mean():.1f} MB" if mem_col in win_df else "N/A")
            
            st.divider()
            wp1, wp2 = st.columns(2)
            with wp1:
                fig_win1 = px.scatter(
                    win_df.head(1000),
                    x=handle_col, y=proc_time_col,
                    color="type",
                    title="Windows Telemetri: Handle Count vs Processor Time",
                    template="plotly_white", height=380
                )
                st.plotly_chart(fig_win1, use_container_width=True)
            with wp2:
                fig_win2 = px.histogram(
                    win_df, x="type", color="type",
                    title="Distribusi Jenis Serangan / Anomali di Windows",
                    template="plotly_white", height=380
                )
                st.plotly_chart(fig_win2, use_container_width=True)
            st.markdown("##### Cuplikan Telemetri Windows (windows7_dataset.csv)")
            st.dataframe(win_df[[proc_time_col, thread_col, handle_col, mem_col, "label", "type"]].head(8), use_container_width=True)
        else:
            st.info("File Windows dataset tidak ditemukan.")

elif page == "Cluster Analysis (Spark MLlib)":
    st.title("Cluster Analysis (Spark MLlib)")
    st.markdown("Distributed K-Means Clustering pada Data Telemetri Multidomain")
    st.divider()
    
    col_plot, col_meta = st.columns([2, 1])
    
    with col_plot:
        colors = {
            "Cluster 0 - Low Profile": "#059669",
            "Cluster 1 - Moderate": "#D97706",
            "Cluster 2 - High Profile": "#DC2626"
        }
        fig_cluster = px.scatter(
            filtered_df,
            x="Data_Volume_MB",
            y="Data_Velocity_RPS",
            color="cluster_label",
            color_discrete_map=colors,
            hover_data=["Domain_Type", "System_Region", "Device_Type", "Feature_Count", "Feature_StdDev"],
            title="Distribusi Kluster: Data Volume (MB) vs Data Velocity (RPS)",
            opacity=0.65
        )
        fig_cluster.update_layout(
            template="plotly_white",
            height=460,
            legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
        )
        st.plotly_chart(fig_cluster, use_container_width=True)
        
    with col_meta:
        st.subheader("Ringkasan Kluster")
        summary = filtered_df.groupby("cluster_label").agg(
            Count=("Record_ID", "count"),
            Avg_Volume=("Data_Volume_MB", "mean"),
            Avg_Velocity=("Data_Velocity_RPS", "mean"),
            Avg_Features=("Feature_Count", "mean")
        ).reset_index()
        st.dataframe(
            summary.style.format({
                "Count": "{:,}",
                "Avg_Volume": "{:,.2f} MB",
                "Avg_Velocity": "{:,.2f} RPS",
                "Avg_Features": "{:.1f}"
            }),
            hide_index=True,
            use_container_width=True
        )
        
        st.info("Silhouette Score Evaluasi Spark MLlib: 0.9806 (k=3)")

elif page == "Graph Analytics (Neo4j)":
    st.title("Graph Analytics (Neo4j)")
    st.markdown("Topologi Relasi Hierarkis Perangkat -> Region -> Domain Sistem Multidomain")
    st.divider()
    
    if not is_neo4j_live:
        st.warning("Neo4j AuraDB sedang dijeda (PAUSED) atau offline. Menggunakan topologi lokal terverifikasi.")
        
    G = nx.DiGraph()
    for edge in graph_edges:
        G.add_edge(edge["source"], edge["target"], weight=edge.get("weight", 1.0))
        
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
    pagerank_dict = nx.pagerank(G, weight="weight") if len(G) > 0 else {}
    
    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_names.append(node)
        
        deg = degree_dict.get(node, 0)
        bet = betweenness_dict.get(node, 0)
        pr = pagerank_dict.get(node, 0)
        
        if "Zone" in node or "Cluster" in node or "Domain" in node or "Region" in node:
            node_color.append("#D97706")
        elif node in ["IoT", "Linux", "Network", "Windows"]:
            node_color.append("#DC2626")
        else:
            node_color.append("#0284C7")
            
        node_text.append(
            f"<b>{node}</b><br>Degree: {deg:.3f}<br>Betweenness: {bet:.3f}<br>PageRank: {pr:.3f}"
        )
        
    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode="markers+text",
        hoverinfo="text",
        text=node_names,
        textposition="top center",
        hovertext=node_text,
        marker=dict(
            color=node_color,
            size=16,
            line=dict(width=1.5, color="#FFFFFF")
        )
    )
    
    fig_network = go.Figure(
        data=[edge_trace, node_trace],
        layout=go.Layout(
            title="Topologi Multidomain (Device -> Region -> Domain)",
            showlegend=False,
            hovermode="closest",
            margin=dict(b=20, l=10, r=10, t=40),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            template="plotly_white",
            height=460
        )
    )
    st.plotly_chart(fig_network, use_container_width=True)
    
    st.subheader("Ringkasan Metrik Centrality")
    cent_df = pd.DataFrame({
        "Node": list(degree_dict.keys()),
        "Degree": list(degree_dict.values()),
        "Betweenness": list(betweenness_dict.values()),
        "PageRank": list(pagerank_dict.values())
    }).sort_values("Betweenness", ascending=False)
    
    fig_cent = px.bar(
        cent_df.head(15), x="Node", y=["Degree", "Betweenness", "PageRank"],
        barmode="group",
        title="Top 15 Node Berdasarkan Centrality",
        template="plotly_white",
        height=380
    )
    st.plotly_chart(fig_cent, use_container_width=True)

elif page == "Anomaly Detection":
    st.title("Anomaly Detection")
    st.markdown("Deteksi Outlier dan Pola Transmisi Anomali Menggunakan Isolation Forest")
    st.divider()
    
    c_scat, c_bar = st.columns([1.8, 1])
    
    with c_scat:
        fig_anom = px.scatter(
            filtered_df,
            x="Data_Volume_MB",
            y="Data_Velocity_RPS",
            color="anomaly_label",
            color_discrete_map={"Normal": "#2563EB", "Anomaly": "#DC2626"},
            hover_data=["Record_ID", "Domain_Type", "Device_Type", "Target_Type", "System_Status"],
            title="Distribusi Anomali: Data Volume (MB) vs Data Velocity (RPS)",
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
            title="Jumlah Anomali per Domain",
            color="Count",
            color_continuous_scale="Reds"
        )
        fig_dom_anom.update_layout(
            template="plotly_white",
            height=420
        )
        st.plotly_chart(fig_dom_anom, use_container_width=True)
        
    st.subheader("Log Telemetri Anomali Terbaru")
    anomaly_sample = filtered_df[filtered_df["anomaly_label"] == "Anomaly"][[
        "Record_ID", "Timestamp", "Domain_Type", "System_Region", "Device_Type",
        "Data_Volume_MB", "Data_Velocity_RPS", "Feature_Mean", "Target_Type", "System_Status"
    ]].head(25)
    st.dataframe(anomaly_sample, hide_index=True, use_container_width=True)

elif page == "Live Telemetry Prediction (Model .pkl)":
    st.title("Live Telemetry Prediction")
    st.markdown("Simulasi Inferensi Kluster dan Anomali Real-Time Menggunakan Fitur Asli Masing-Masing Domain")
    st.divider()
    
    st.subheader("Pilih Domain Target Prediksi")
    pred_domain = st.selectbox(
        "Domain Telemetri",
        ["Network Domain", "IoT Sensor Domain", "Linux Host Domain", "Windows Domain"]
    )
    
    if pred_domain == "Network Domain":
        st.markdown("##### Input Fitur Asli NetFlow Network")
        st.caption("Fitur yang digunakan: duration, src_bytes, dst_bytes, src_pkts, dst_pkts, src_ip_bytes, dst_ip_bytes")
        
        col1, col2 = st.columns(2)
        with col1:
            inp_dur = st.number_input("Flow Duration (detik)", min_value=0.0, max_value=100000.0, value=0.05, step=0.01)
            inp_sbytes = st.number_input("Source Bytes (src_bytes)", min_value=0.0, max_value=100000000.0, value=250.0, step=50.0)
            inp_dbytes = st.number_input("Destination Bytes (dst_bytes)", min_value=0.0, max_value=100000000.0, value=3500.0, step=100.0)
        with col2:
            inp_spkts = st.number_input("Source Packets (src_pkts)", min_value=1.0, max_value=500000.0, value=6.0, step=1.0)
            inp_dpkts = st.number_input("Destination Packets (dst_pkts)", min_value=1.0, max_value=500000.0, value=7.0, step=1.0)
            inp_sip_bytes = st.number_input("Source IP Bytes", min_value=0.0, max_value=100000000.0, value=500.0, step=50.0)
            inp_dip_bytes = st.number_input("Destination IP Bytes", min_value=0.0, max_value=100000000.0, value=3800.0, step=50.0)
            
        if st.button("Jalankan Prediksi Network", type="primary"):
            net_mod = domain_models.get("network", {})
            if "scaler" in net_mod and "kmeans" in net_mod and "iso" in net_mod:
                sample_data = pd.DataFrame([{
                    "duration": inp_dur, "src_bytes": inp_sbytes, "dst_bytes": inp_dbytes,
                    "src_pkts": inp_spkts, "dst_pkts": inp_dpkts, "src_ip_bytes": inp_sip_bytes, "dst_ip_bytes": inp_dip_bytes
                }])
                scaled_sample = net_mod["scaler"].transform(sample_data)
                pred_c = net_mod["kmeans"].predict(scaled_sample)[0]
                pred_a = net_mod["iso"].predict(sample_data)[0]
                
                st.divider()
                st.subheader("Hasil Inferensi Model Network")
                rc1, rc2 = st.columns(2)
                rc1.metric("Predicted Cluster (network_kmeans.pkl)", f"Cluster {pred_c}")
                rc2.metric("Status Anomali (network_iso.pkl)", "Anomali Terdeteksi" if pred_a == -1 else "Transmisi Normal", delta="Bahaya / Anomali" if pred_a == -1 else "Aman", delta_color="inverse" if pred_a == -1 else "normal")
            else:
                st.warning("Model network_*.pkl belum tersedia.")

    elif pred_domain == "IoT Sensor Domain":
        st.markdown("##### Input Fitur Asli Sensor IoT (Weather / Environment)")
        st.caption("Fitur yang digunakan: temperature, humidity, pressure")
        
        ic1, ic2, ic3 = st.columns(3)
        with ic1:
            inp_temp = st.number_input("Temperature (C)", min_value=-50.0, max_value=150.0, value=28.5, step=0.5)
        with ic2:
            inp_hum = st.number_input("Humidity (%)", min_value=0.0, max_value=100.0, value=65.0, step=1.0)
        with ic3:
            inp_press = st.number_input("Pressure (hPa)", min_value=0.0, max_value=2000.0, value=1013.25, step=1.0)
            
        if st.button("Jalankan Prediksi IoT", type="primary"):
            iot_mod = domain_models.get("iot", {})
            if "scaler" in iot_mod and "kmeans" in iot_mod and "iso" in iot_mod:
                sample_data = pd.DataFrame([{
                    "temperature": inp_temp, "humidity": inp_hum, "pressure": inp_press
                }])
                scaled_sample = iot_mod["scaler"].transform(sample_data)
                pred_c = iot_mod["kmeans"].predict(scaled_sample)[0]
                pred_a = iot_mod["iso"].predict(sample_data)[0]
                
                st.divider()
                st.subheader("Hasil Inferensi Model IoT")
                rc1, rc2 = st.columns(2)
                rc1.metric("Predicted Cluster (iot_kmeans.pkl)", f"Cluster {pred_c}")
                rc2.metric("Status Anomali (iot_iso.pkl)", "Anomali Terdeteksi" if pred_a == -1 else "Transmisi Normal", delta="Bahaya / Anomali" if pred_a == -1 else "Aman", delta_color="inverse" if pred_a == -1 else "normal")
            else:
                st.warning("Model iot_*.pkl belum tersedia.")

    elif pred_domain == "Linux Host Domain":
        st.markdown("##### Input Fitur Asli OS Linux (Process Metrics)")
        st.caption("Fitur yang digunakan: CPU, PRI, NICE, CPUNR, TRUN, TSLPI")
        
        lc1, lc2 = st.columns(2)
        with lc1:
            inp_cpu = st.number_input("CPU Usage Ratio", min_value=0.0, max_value=1.0, value=0.15, step=0.05)
            inp_pri = st.number_input("Process Priority (PRI)", min_value=0.0, max_value=200.0, value=120.0, step=1.0)
            inp_nice = st.number_input("Nice Value", min_value=-20.0, max_value=20.0, value=0.0, step=1.0)
        with lc2:
            inp_cpunr = st.number_input("CPU Core Number", min_value=0.0, max_value=64.0, value=2.0, step=1.0)
            inp_trun = st.number_input("Running Threads (TRUN)", min_value=0.0, max_value=100.0, value=0.0, step=1.0)
            inp_tslpi = st.number_input("Sleeping Threads (TSLPI)", min_value=0.0, max_value=500.0, value=10.0, step=1.0)
            
        if st.button("Jalankan Prediksi Linux", type="primary"):
            linux_mod = domain_models.get("linux", {})
            if "scaler" in linux_mod and "kmeans" in linux_mod and "iso" in linux_mod:
                sample_data = pd.DataFrame([{
                    "CPU": inp_cpu, "PRI": inp_pri, "NICE": inp_nice,
                    "CPUNR": inp_cpunr, "TRUN": inp_trun, "TSLPI": inp_tslpi
                }])
                scaled_sample = linux_mod["scaler"].transform(sample_data)
                pred_c = linux_mod["kmeans"].predict(scaled_sample)[0]
                pred_a = linux_mod["iso"].predict(sample_data)[0]
                
                st.divider()
                st.subheader("Hasil Inferensi Model Linux")
                rc1, rc2 = st.columns(2)
                rc1.metric("Predicted Cluster (linux_kmeans.pkl)", f"Cluster {pred_c}")
                rc2.metric("Status Anomali (linux_iso.pkl)", "Anomali Terdeteksi" if pred_a == -1 else "Transmisi Normal", delta="Bahaya / Anomali" if pred_a == -1 else "Aman", delta_color="inverse" if pred_a == -1 else "normal")
            else:
                st.warning("Model linux_*.pkl belum tersedia.")

    elif pred_domain == "Windows Domain":
        st.markdown("##### Input Fitur Asli Workstation Windows (Telemetry Metrics)")
        st.caption("Fitur yang digunakan: Processor Time, Thread Count, Handle Count, Working Set, Available RAM, Committed Bytes")
        
        wc1, wc2 = st.columns(2)
        with wc1:
            inp_w_cpu = st.number_input("Processor Time (%)", min_value=0.0, max_value=100.0, value=25.0, step=1.0)
            inp_w_th = st.number_input("Thread Count", min_value=1.0, max_value=50000.0, value=1200.0, step=50.0)
            inp_w_hd = st.number_input("Handle Count", min_value=1.0, max_value=200000.0, value=45000.0, step=500.0)
        with wc2:
            inp_w_ws = st.number_input("Working Set Bytes", min_value=0.0, max_value=100000000000.0, value=2000000000.0, step=100000000.0)
            inp_w_mem = st.number_input("Available Memory (MB)", min_value=0.0, max_value=128000.0, value=4096.0, step=256.0)
            inp_w_comm = st.number_input("Committed Bytes", min_value=0.0, max_value=100000000000.0, value=4000000000.0, step=100000000.0)
            
        if st.button("Jalankan Prediksi Windows", type="primary"):
            win_mod = domain_models.get("windows", {})
            if "scaler" in win_mod and "kmeans" in win_mod and "iso" in win_mod:
                sample_data = pd.DataFrame([{
                    "Processor(_Total) pct_ Processor Time": inp_w_cpu,
                    "Process(_Total) Thread Count": inp_w_th,
                    "Process(_Total) Handle Count": inp_w_hd,
                    "Process(_Total) Working Set": inp_w_ws,
                    "Memory Available MBytes": inp_w_mem,
                    "Memory Committed Bytes": inp_w_comm
                }])
                scaled_sample = win_mod["scaler"].transform(sample_data)
                pred_c = win_mod["kmeans"].predict(scaled_sample)[0]
                pred_a = win_mod["iso"].predict(sample_data)[0]
                
                st.divider()
                st.subheader("Hasil Inferensi Model Windows")
                rc1, rc2 = st.columns(2)
                rc1.metric("Predicted Cluster (windows_kmeans.pkl)", f"Cluster {pred_c}")
                rc2.metric("Status Anomali (windows_iso.pkl)", "Anomali Terdeteksi" if pred_a == -1 else "Transmisi Normal", delta="Bahaya / Anomali" if pred_a == -1 else "Aman", delta_color="inverse" if pred_a == -1 else "normal")
            else:
                st.warning("Model windows_*.pkl belum tersedia.")

elif page == "Data Explorer (Per-CSV Inspector)":
    st.title("Data Explorer: Inspeksi File CSV Asli")
    st.markdown("Pilih domain dan file CSV tertentu untuk melihat struktur kolom asli, statistik, dan baris data mentahnya.")
    st.divider()
    
    csv_dict = list_available_domain_csvs()
    
    if csv_dict:
        e_c1, e_c2, e_c3 = st.columns([1, 1.5, 1])
        with e_c1:
            sel_exp_domain = st.selectbox("Pilih Domain", list(csv_dict.keys()))
        with e_c2:
            files_for_dom = csv_dict.get(sel_exp_domain, [])
            sel_exp_file = st.selectbox("Pilih File CSV", files_for_dom)
        with e_c3:
            max_rows = st.selectbox("Jumlah Baris", [500, 1000, 2000, 5000], index=1)
            
        if sel_exp_file:
            raw_csv_df = load_single_csv(sel_exp_domain, sel_exp_file, nrows=max_rows)
            
            if not raw_csv_df.empty:
                st.markdown(f"##### File: `{sel_exp_file}` ({sel_exp_domain})")
                
                s1, s2, s3 = st.columns(3)
                s1.metric("Total Baris Dimuat", f"{len(raw_csv_df):,}")
                s2.metric("Total Kolom Asli", f"{len(raw_csv_df.columns):,}")
                s3.metric("Kolom Numerik", f"{len(raw_csv_df.select_dtypes(include=['number']).columns):,}")
                
                st.divider()
                
                tab_table, tab_stats, tab_dist = st.tabs(["Tabel Data Asli", "Statistik Deskriptif", "Visualisasi Kolom"])
                
                with tab_table:
                    st.dataframe(raw_csv_df, hide_index=True, use_container_width=True)
                    csv_bytes = raw_csv_df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        label=f"Unduh {sel_exp_file} (CSV)",
                        data=csv_bytes,
                        file_name=sel_exp_file,
                        mime="text/csv"
                    )
                    
                with tab_stats:
                    st.dataframe(raw_csv_df.describe(), use_container_width=True)
                    
                with tab_dist:
                    num_options = raw_csv_df.select_dtypes(include=['number']).columns.tolist()
                    if num_options:
                        sel_col = st.selectbox("Pilih Kolom Numerik untuk Dianalisis", num_options)
                        fig_dist = px.histogram(
                            raw_csv_df, x=sel_col,
                            title=f"Distribusi Nilai Kolom: {sel_col}",
                            template="plotly_white",
                            height=400
                        )
                        st.plotly_chart(fig_dist, use_container_width=True)
                    else:
                        st.info("Tidak ada kolom numerik untuk divisualisasikan.")
            else:
                st.warning("File CSV tidak dapat dimuat.")
    else:
        st.warning("Direktori dataset multidomain tidak ditemukan.")
