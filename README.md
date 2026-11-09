# Big Data Large Scale MultiDomain Analytics

Dashboard analitik multidomain (IoT, Linux Host, Network Gateway, Windows Workstation) untuk deteksi anomali, clustering, dan graph analytics — dibangun di atas Apache Spark, Hadoop HDFS, Neo4j, dan FastAPI.

> Proyek tugas: COMP8035041 – Big Data Analytics (BINUS Graduate Program)

## Arsitektur

```
┌─────────────────┐   HTTP/JSON   ┌──────────────────┐   membaca CSV   ┌─────────────────────┐
│  React Frontend │ ◄───────────► │  FastAPI Backend │ ◄────────────── │  model/ (hasil ML)  │
│  (Vite, :5173)  │               │  (:8000)         │                 │  CSV evaluasi, model│
└─────────────────┘               └──────┬───────────┘                 └─────────────────────┘
                                         │ SQLite (monitoring_data.db)
                                         │ psutil embedded agent + network discovery
┌─────────────────┐   WebHDFS/HDFS  ┌───▼──────────────┐
│ Hadoop HDFS     │ ◄──────────────► │ Jupyter Notebook │  Spark MLlib + scikit-learn
│ namenode:9870   │                  │ (:8888)          │  K-Means, Isolation Forest, RF
│ datanode        │                  └──────────────────┘
└─────────────────┘                            │
                                               ▼
                                     ┌──────────────────┐
                                     │  Neo4j (AuraDB)  │  Graph analytics
                                     └──────────────────┘
```

## Struktur Proyek

```
Code/
├── backend/          # FastAPI — API dashboard + PC monitoring (embedded agent, discovery, anomaly log)
│   └── app/
├── frontend/         # React + Vite — dashboard (Overview, PC Monitoring, Dataset, Model Performance,
│                     #   Anomaly Detection, Clustering, Neo4j Analytics)
├── model/            # Notebook utama (main.ipynb) — pipeline ML Spark MLlib & scikit-learn,
│                     #   dataset (4 domain), artefak model, hasil evaluasi CSV/PNG
├── docker-compose.yaml  # Hadoop namenode + datanode + Jupyter notebook
└── README.md
```

## Dataset

Dataset multidomain (38 file CSV, ±3.6 GB) tersimpan di `model/dataset/`, terdiri dari 4 domain:

| Domain                        | Isi                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Processed_IoT_dataset`     | Telemetri perangkat IoT (Fridge, GPS Tracker, Modbus, Motion Light, Thermostat, Weather, Garage Door) |
| `Processed_Linux_dataset`   | Metrik host Linux (proses, disk, memori)                                                              |
| `Processed_Network_dataset` | Trafik gateway jaringan                                                                               |
| `Processed_Windows_dataset` | Metrik workstation Windows                                                                            |

## Prasyarat

- Python 3.10+
- Java 17 (untuk PySpark)
- Node.js 18+ (frontend)
- Docker + Docker Compose (untuk Hadoop & notebook)

## Instalasi & Menjalankan

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# konfigurasi — buat backend/.env:
#   MODEL_DIR=../model
#   FRONTEND_URL=http://localhost:5173
#   NEO4J_URI=neo4j+ssc://<instance>.databases.neo4j.io
#   NEO4J_USER=neo4j
#   NEO4J_PASSWORD=<password>

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Saat backend menyala otomatis berjalan:

- **Embedded monitoring agent** — memonitor PC backend via psutil (`EMBEDDED_AGENT=0` untuk mematikan, `AGENT_INTERVAL=10` untuk interval detik)
- **Network discovery** — ping sweep subnet /24 untuk mendeteksi perangkat lain (`DISCOVERY=0` untuk mematikan, `DISCOVERY_INTERVAL=300`)

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev        # development, buka http://localhost:5173
npm run build      # production build ke dist/
```

`frontend/.env` → `VITE_API_URL=http://localhost:8000/api` (opsional, ada default).

### 3. Notebook ML (Spark + HDFS + Neo4j)

Cara cepat tanpa docker (mode lokal):

```bash
cd model
pip install -r requirements.txt
jupyter notebook main.ipynb
```

Dengan Hadoop/HDFS + Jupyter via docker:

```bash
docker compose up -d namenode datanode notebook
# Jupyter: http://localhost:8888
```

Konfigurasi HDFS via `model/.env`:

```env
HDFS_ENABLED=true
HDFS_NAMENODE=hdfs://namenode:9000        # dari dalam container
# HDFS_NAMENODE=webhdfs://<host>:9870     # dari Windows host
HDFS_INPUT_DIR=/user/data/multidomain
HDFS_OUTPUT_DIR=/user/output/multidomain
HDFS_UPLOAD_LOCAL_DATA=true
SPARK_DISTRIBUTED=false                   # storage di HDFS, compute lokal
```

Konfigurasi graph via `model/.env`:

```env
NEO4J_URI=neo4j+ssc://<instance>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
```

### 4. PC Monitoring Agent (untuk PC lain di jaringan)

Dari PC yang ingin dimonitor (backend sudah memonitor dirinya sendiri):

```bash
curl http://<ip-backend>:8000/api/monitoring/agent-script -o agent.py
pip install psutil
python agent.py --backend http://<ip-backend>:8000 --interval 10
```

## API Utama

| Endpoint                                             | Fungsi                                             |
| ---------------------------------------------------- | -------------------------------------------------- |
| `GET /api/overview`                                | Ringkasan dataset & model                          |
| `GET /api/dataset`                                 | Ringkasan file dataset per domain                  |
| `GET /api/performance`                             | Evaluasi model per domain (sklearn vs Spark MLlib) |
| `GET /api/anomaly`                                 | Hasil deteksi anomali                              |
| `GET /api/anomaly/predictions`                     | Prediksi tipe serangan per domain                  |
| `GET /api/clustering`                              | Ringkasan cluster K-Means                          |
| `GET /api/neo4j/analytics`                         | Statistik graph Neo4j (node, relasi, degree)       |
| `POST /api/monitoring/ingest`                      | Ingest metrik dari monitoring agent                |
| `GET /api/monitoring/hosts`                        | Daftar host (agent + hasil discovery)              |
| `GET /api/monitoring/history?host=<id>&minutes=60` | Time-series metrik per host                        |
| `GET /api/monitoring/anomalies`                    | Log anomali CPU/RAM/disk                           |
| `GET /api/monitoring/agent-script`                 | Unduh agent standalone untuk PC lain               |

## Output Utama Notebook

| File                                          | Isi                                                                |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `model/model_summary.csv`                   | Metrik evaluasi per domain (Accuracy, F1, Balanced Accuracy, dll.) |
| `model/domain_model_evaluation.csv`         | Perbandingan Spark MLlib vs scikit-learn                           |
| `model/cluster_summary.csv`                 | Distribusi record per cluster K-Means                              |
| `model/anomaly_type_prediction_summary.csv` | Prediksi tipe serangan per domain                                  |
| `model/models/`                             | Artefak model per domain (.pkl + metadata)                         |
| `model/*.png`                               | Visualisasi (elbow, confusion matrix, graph analytics, dll.)       |
