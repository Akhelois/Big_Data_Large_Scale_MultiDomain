
import { LuExternalLink } from "react-icons/lu";

import SectionHeader from "../components/SectionHeader";
import "../styles/pages/Pages.css";

function ApiDocs() {
    const docsUrl = "/api/docs";

    return (
        <div className="page-content">
            <SectionHeader
                title="Dokumentasi API"
                description="Dokumentasi OpenAPI interaktif yang dibuat oleh FastAPI."
            />

            <div className="table-card">
                <div className="table-header">
                    <div>
                        <h3>Swagger UI</h3>
                        <p>{docsUrl}</p>
                    </div>
                    <a
                        className="btn-refresh"
                        href={docsUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <LuExternalLink size={14} />
                        Buka di tab baru
                    </a>
                </div>

                <iframe
                    className="api-docs-frame"
                    src={docsUrl}
                    title="FastAPI Swagger UI"
                />
            </div>
        </div>
    );
}

export default ApiDocs;
