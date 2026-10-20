# Report Visuals

Semua figur digenerate dari artefak eksekusi nyata oleh `agent/generate_report_visuals.py`.
Jalankan ulang: `python agent/generate_report_visuals.py`

| Figur | Sumber data |
|---|---|
| 01_metrics_per_domain | domain_model_evaluation.csv |
| 02_class_balance | domain_model_evaluation.csv |
| 03_data_split | domain_model_evaluation.csv |
| 04_anomaly_vs_normal | domain_model_evaluation.csv |
| 05_cluster_distribution | cluster_summary.csv |
| 06_attack_type_f1 | anomaly_type_prediction_summary.csv |
| 07_hdfs_storage | verifikasi WebHDFS live 20 Okt |
| 08_monitoring_timeline | monitoring_data.db (embedded agent) |
| 09_graph_degree | Neo4j live (Cypher) |
| 10_graph_centrality_networkx | Neo4j live + networkx |
