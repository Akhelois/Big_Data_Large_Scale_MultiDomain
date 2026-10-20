# Bukti Verifikasi HDFS Live — 2026-10-20 11:32

Namenode: 10.38.10.84 (docker, bde2020/hadoop-namenode:2.0.0-hadoop3.2.1)
Akses dari laptop via WebHDFS API (port 9870) — sesuai HDFS_NAMENODE di model/.env

HDFS root: ['analytics', 'datasets']
/datasets/multidomain/Processed_IoT_dataset: 7 file, 167.0 MB
/datasets/multidomain/Processed_Linux_dataset: 6 file, 316.3 MB
/datasets/multidomain/Processed_Network_dataset: 23 file, 3076.7 MB
/datasets/multidomain/Processed_Windows_dataset: 2 file, 59.5 MB
TOTAL dataset di HDFS: 38 file, 3.53 GB

/analytics/iot-multidomain/clustered_parquet: 10 part-snappy.parquet + _SUCCESS, 196.3 MB
(hasil K-Means Spark MLlib yang ditulis Spark ke HDFS; _SUCCESS = job selesai)

Verifikasi konten: part-00000 dibaca ulang via WebHDFS OPEN -> 3.290.100 baris,
kolom Record_ID, Domain_Type, System_Region, Device_Type, Source_File, Target_Label, Target_Type, cluster.
Distribusi cluster part-00000: cluster 0 = 2.380.423, cluster 1 = 909.677 -> data valid & konsisten dengan cluster_summary.csv (2 cluster per domain).