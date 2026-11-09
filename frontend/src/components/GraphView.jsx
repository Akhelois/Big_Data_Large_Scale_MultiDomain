import { useEffect, useMemo, useRef, useState } from "react";

const PALETTE = ["#0f766e", "#0d9488", "#d97706", "#7c3aed", "#dc2626", "#0284c7", "#16a34a", "#db2777"];

const MIN_W = 320;
const FALLBACK_W = 820;
const EDGE_PAD_X = 30;
const EDGE_PAD_Y = 46;

function radiusOf(node) {
    return 7 + Math.min(15, Math.sqrt(Math.max(node.degree || 1, 1)) * 2.4);
}

function clampToCanvas(x, y, r, W, H) {
    const padX = EDGE_PAD_X + r;
    const padY = EDGE_PAD_Y + r;
    return {
        x: Math.min(W - padX, Math.max(padX, x)),
        y: Math.min(H - padY, Math.max(padY, y)),
    };
}

function buildLayout(nodes, edges, width, height) {
    const W = width;
    const H = height;
    const ns = nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
        const rx = W / 2 - 80;
        const ry = H / 2 - 60;
        const r = radiusOf(n);
        const start = clampToCanvas(W / 2 + rx * Math.cos(angle), H / 2 + ry * Math.sin(angle), r, W, H);
        return {
            ...n,
            r,
            x: start.x,
            y: start.y,
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

        for (let i = 0; i < n; i++) {
            disp[i].x += (W / 2 - ns[i].x) * 0.03;
            disp[i].y += (H / 2 - ns[i].y) * 0.03;

            const dx = disp[i].x;
            const dy = disp[i].y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
            const limit = Math.min(d, temp);
            const next = clampToCanvas(
                ns[i].x + (dx / d) * limit,
                ns[i].y + (dy / d) * limit,
                ns[i].r,
                W,
                H
            );
            ns[i].x = next.x;
            ns[i].y = next.y;
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
    const svgRef = useRef(null);
    const dragState = useRef(null);
    const [width, setWidth] = useState(0);
    const [draggingId, setDraggingId] = useState(null);
    const [dragPositions, setDragPositions] = useState({});

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

    const W = Math.max(Math.round(width) || FALLBACK_W, MIN_W);
    const H = W < 560 ? Math.min(height, 320) : height;

    const labelColors = useMemo(() => {
        const map = new Map();
        nodes.forEach((nd) => {
            const label = nd.label || "Node";
            if (!map.has(label)) map.set(label, PALETTE[map.size % PALETTE.length]);
        });
        return map;
    }, [nodes]);

    const layout = useMemo(
        () => buildLayout(nodes, edges, W, H),
        [nodes, edges, W, H]
    );

    const layoutKey = useMemo(
        () => `${W}x${H}|${nodes.map((n) => n.id).join(",")}|${edges.map((e) => `${e.source}>${e.target}`).join(",")}`,
        [nodes, edges, W, H]
    );
    useEffect(() => {
        setDragPositions({});
    }, [layoutKey]);

    const posOf = (node) => dragPositions[node.id] || { x: node.x, y: node.y };

    const toSvgCoords = (clientX, clientY) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        const scale = Math.min(rect.width / W, rect.height / H) || 1;
        const offsetX = (rect.width - W * scale) / 2;
        const offsetY = (rect.height - H * scale) / 2;
        return {
            x: (clientX - rect.left - offsetX) / scale,
            y: (clientY - rect.top - offsetY) / scale,
        };
    };

    const startDrag = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
        }
        const p = posOf(node);
        const point = toSvgCoords(event.clientX, event.clientY);
        dragState.current = { id: node.id, dx: p.x - point.x, dy: p.y - point.y, r: node.r };
        setDraggingId(node.id);
    };

    const moveDrag = (event) => {
        if (!dragState.current) return;
        const { id, dx, dy, r } = dragState.current;
        const point = toSvgCoords(event.clientX, event.clientY);
        const clamped = clampToCanvas(point.x + dx, point.y + dy, r, W, H);
        setDragPositions((prev) => ({ ...prev, [id]: clamped }));
    };

    const endDrag = () => {
        dragState.current = null;
        setDraggingId(null);
    };

    if (!layout.ns.length) {
        return <div className="empty-state">Tidak ada node untuk divisualisasikan.</div>;
    }

    const scale = W < 560 ? 0.85 : W < 760 ? 0.95 : 1;
    const fontSize = Math.max(9, Math.round(10 * scale));
    const labelMax = W < 560 ? 10 : W < 760 ? 13 : 16;

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Graph analysis"
                style={{ display: "block", maxHeight: H, cursor: draggingId ? "grabbing" : "default" }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
            >
                {layout.es.map((e, i) => {
                    const s = posOf(layout.ns[e.s]);
                    const t = posOf(layout.ns[e.t]);
                    return (
                        <line
                            key={`e-${i}`}
                            x1={s.x}
                            y1={s.y}
                            x2={t.x}
                            y2={t.y}
                            stroke="#dbe2ea"
                            strokeWidth={1}
                        />
                    );
                })}
                {layout.ns.map((node) => {
                    const r = node.r * scale;
                    const p = posOf(node);
                    const color = labelColors.get(node.label || "Node");
                    const isDragging = draggingId === node.id;
                    return (
                        <g
                            key={node.id}
                            onPointerDown={(event) => startDrag(event, node)}
                            style={{ cursor: isDragging ? "grabbing" : "grab" }}
                        >
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={r}
                                fill={color}
                                stroke="#ffffff"
                                strokeWidth={isDragging ? 2.5 : 1.5}
                                opacity={0.92}
                                style={{ touchAction: "none" }}
                            >
                                <title>{`${node.id} — degree ${node.degree ?? 0} (drag untuk memindahkan)`}</title>
                            </circle>
                            <text
                                x={p.x}
                                y={p.y + r + 11}
                                textAnchor="middle"
                                fontSize={fontSize}
                                fill="#78716c"
                                style={{ pointerEvents: "none", userSelect: "none" }}
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
