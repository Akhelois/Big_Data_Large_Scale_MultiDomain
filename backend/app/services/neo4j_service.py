from app.core.config import NEO4J_PASSWORD, NEO4J_URI, NEO4J_USER


def get_neo4j_analytics():
    if not NEO4J_URI or not NEO4J_PASSWORD:
        return {
            "status": "unavailable",
            "message": "Atur NEO4J_URI, NEO4J_USER, dan NEO4J_PASSWORD di backend/.env untuk mengambil data graph.",
            "nodes": 0,
            "relationships": 0,
            "top_nodes": [],
            "edges": [],
        }

    try:
        from neo4j import GraphDatabase

        with GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)) as driver:
            driver.verify_connectivity()
            with driver.session() as session:
                graph_rows = session.run("MATCH (n) RETURN count(n) AS nodes").single()
                relationship_rows = session.run("MATCH ()-[r]->() RETURN count(r) AS relationships").single()
                counts = {"nodes": graph_rows["nodes"], "relationships": relationship_rows["relationships"]}
                top_nodes = session.run(
                    "MATCH (n) RETURN coalesce(n.name, n.id, elementId(n)) AS name, labels(n) AS labels, COUNT { (n)-[]-() } AS degree ORDER BY degree DESC LIMIT 10"
                )
                edges = session.run(
                    "MATCH (a)-[r]->(b) RETURN coalesce(a.name, a.id, elementId(a)) AS source, type(r) AS type, coalesce(b.name, b.id, elementId(b)) AS target LIMIT 50"
                )
                return {
                    "status": "success",
                    "nodes": int(counts["nodes"]),
                    "relationships": int(counts["relationships"]),
                    "top_nodes": [record.data() for record in top_nodes],
                    "edges": [record.data() for record in edges],
                }
    except Exception as error:
        return {
            "status": "unavailable",
            "message": f"Koneksi/query Neo4j gagal: {type(error).__name__}",
            "nodes": 0,
            "relationships": 0,
            "top_nodes": [],
            "edges": [],
        }
