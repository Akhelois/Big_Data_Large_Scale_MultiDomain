import { useEffect, useMemo, useRef, useState } from "react";

const PALETTE = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#dc2626", "#0284c7", "#16a34a", "#db2777"];

const MIN_W = 320;
const FALLBACK_W = 820;

function buildLayout(nodes, edges, width, height) {
    const W = width;
    const H = height;
    const ns = nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
        const rx = W / 2 - 80;
        const ry = H / 2 - 60;
        return {
            ...n,
            x: W / 2 + rx * Math.cos(angle),
            y: H / 2 + ry * Math.sin(angle),
        };
    });

    const index = new Map(ns.map((n, i) => [n.id, i]));
    const es = edges
        .map((e) => ({ s: index.get(e.source), t: index.get(e.target) }))
        .filter((e) => e.s !== undefined && e.t !== undefined && e.s !== e.t);

    const n = ns.length;
    if (!n) return { ns, es };
    const k = Math.sqrt((W * H) / n) * 0.72;
    const iterations = 400;

    for (let iter = 0; iter < iterations; iter++) {
        const temp = Math.max(k * (1 - iter / iterations), 0.5);
        const disp = ns.map(() => ({ x: 0, y: 0 }));

        // tolakan antar node
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let dx = ns[i].x - ns[j].x;
                let dy = ns[i].y - ns[j].y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const force = (k * k) / dist;
                dx = (dx / dist) * force;
                dy = (dy / dist) * force;
                disp[i].x += dx; disp[i].y += dy;
                disp[j].x -= dx; disp[j].y -= dy;
            }
        }

        // tarikan relasi (spring)
        for (const e of es) {
            let dx = ns[e.s].x - ns[e.t].x;
            let dy = ns[e.s].y - ns[e.t].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const force = (dist * dist) / k;
            dx = (dx / dist) * force;
            dy = (dy / dist) * force;
            disp[e.s].x -= dx; disp[e.s].y -= dy;
            disp[e.t].x += dx; disp[e.t].y += dy;
        }

        // gravitasi ke tengah + batasi perpindahan (cooling)
        for (let i = 0; i < n; i++) {
            disp[i].x += (W / 2 - ns[i].x) * 0.03;
            disp[i].y += (H / 2 - ns[i].y) * 0.03;

            const dx = disp[i].x;
            const dy = disp[i].y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const limit = Math.min(d, temp);
            ns[i].x = Math.min(W - 30, Math.max(30, ns[i].x + (dx / d) * limit));
            ns[i].y = Math.min(H - 30, Math.max(30, ns[i].y + (dy / d) * limit));
        }
    }

    return { ns, es };
}

function shortLabel(text, max = 16) {
    const s = String(text ?? "");
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function GraphView({ nodes, edges, height = 400 }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const update = () => setWidth(el.clientWidth);
        update();
        if (typeof ResizeObserver !== "undefined") {
            const ro = new ResizeObserver(update);
            ro.observe(el);
            return () => ro.disconnect();
        }
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // lebar kontainer asli; fallback sebelum pengukuran pertama
    const W = Math.max(Math.round(width) || FALLBACK_W, MIN_W);
    // layar sempit: kurangi tinggi agar proporsional
    const H = W < 560 ? Math.min(height, 320) : height;

    const labelColors = useMemo(() => {
        const map = new Map();
        nodes.forEach((nd) => {
            const label = nd.label || "Node";
            if (!map.has(label)) map.set(label, PALETTE[map.size % PALETTE.length]);
        });
        return map;
    }, [nodes]);

    const { ns, es } = useMemo(
        () => buildLayout(nodes, edges, W, H),
        [nodes, edges, W, H]
    );

    if (!ns.length) {
        return <div className="empty-state">Tidak ada node untuk divisualisasikan.</div>;
    }

    // skala elemen mengikuti lebar kontainer (tetap terbaca di layar kecil)
    const scale = W < 560 ? 0.85 : W < 760 ? 0.95 : 1;
    const fontSize = Math.max(9, Math.round(10 * scale));
    const labelMax = W < 560 ? 10 : W < 760 ? 13 : 16;

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Graph analysis"
                style={{ display: "block", maxHeight: H }}
            >
                {es.map((e, i) => (
                    <line
                        key={`e-${i}`}
                        x1={ns[e.s].x}
                        y1={ns[e.s].y}
                        x2={ns[e.t].x}
                        y2={ns[e.t].y}
                        stroke="#dbe2ea"
                        strokeWidth={1}
                    />
                ))}
                {ns.map((node) => {
                    const r = (7 + Math.min(15, Math.sqrt(Math.max(node.degree || 1, 1)) * 2.4)) * scale;
                    const color = labelColors.get(node.label || "Node");
                    return (
                        <g key={node.id}>
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r={r}
                                fill={color}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                opacity={0.92}
                            >
                                <title>{`${node.id} — degree ${node.degree ?? 0}`}</title>
                            </circle>
                            <text
                                x={node.x}
                                y={node.y + r + 11}
                                textAnchor="middle"
                                fontSize={fontSize}
                                fill="#64748b"
                            >
                                {shortLabel(node.id, labelMax)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
