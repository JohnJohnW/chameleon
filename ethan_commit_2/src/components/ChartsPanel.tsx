// // // ChartsPanel.tsx
// // import React, { useEffect, useMemo, useReducer } from "react";
// // import {
// //   BarChart,
// //   Bar,
// //   XAxis,
// //   YAxis,
// //   CartesianGrid,
// //   Tooltip,
// //   Legend,
// //   RadarChart,
// //   PolarGrid,
// //   PolarAngleAxis,
// //   PolarRadiusAxis,
// //   Radar,
// //   ResponsiveContainer,
// // } from "recharts";

// // /* ----------------------------- Types ----------------------------- */
// // type Severity = "low" | "medium" | "high" | "critical";
// // type Dimension = "identity" | "contact" | "social" | "location" | "credential" | "broker";

// // type FindingEvent = {
// //   id: string;
// //   source: string;
// //   pii: string[];
// //   severity: Severity;
// //   confidence: number;   // 0..1
// //   dimension: Dimension;
// //   timestamp: number;    // epoch seconds
// // };

// // // events coming from the local runner (SSE)
// // type RunnerEvent =
// //   | { type: "log"; text: string }
// //   | {
// //       type: "result";
// //       item: {
// //         id: string;
// //         site: string;
// //         url?: string;
// //         title?: string;
// //         snippet?: string;
// //         severity?: string;
// //         confidence?: number;
// //         dimension?: Dimension;
// //         timestamp?: number;
// //       };
// //     }
// //   | { type: "done" };

// // /* ----------------------- Config / Mappings ----------------------- */
// // const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
// // const DIMENSIONS: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];

// // // Severity weights drive radar scoring
// // const SEVERITY_WEIGHT: Record<Severity, number> = {
// //   low: 1,
// //   medium: 2,
// //   high: 4,
// //   critical: 6,
// // };

// // // Cap used for normalizing radar scores to 0..100
// // // Tune this to how "big" a scan usually is.
// // const RADAR_SCORE_CAP = 40; // total weighted points that map to 100%

// // /* ----------------------------- State ----------------------------- */
// // type State = {
// //   seenIds: Set<string>;
// //   // counts by severity
// //   severityCounts: Record<Severity, number>;
// //   // raw scores by dimension (not yet normalized)
// //   dimensionScores: Record<Dimension, number>;
// //   // (optional) totals
// //   totalFindings: number;
// // };

// // type Action =
// //   | { type: "ADD_EVENT"; payload: FindingEvent }
// //   | { type: "RESET" };

// // const initialState: State = {
// //   seenIds: new Set(),
// //   severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
// //   dimensionScores: { identity: 0, contact: 0, social: 0, location: 0, credential: 0, broker: 0 },
// //   totalFindings: 0,
// // };

// // function reducer(state: State, action: Action): State {
// //   switch (action.type) {
// //     case "ADD_EVENT": {
// //       const e = action.payload;
// //       if (state.seenIds.has(e.id)) return state; // dedupe
// //       const next = {
// //         ...state,
// //         seenIds: new Set(state.seenIds),
// //         severityCounts: { ...state.severityCounts },
// //         dimensionScores: { ...state.dimensionScores },
// //       };
// //       next.seenIds.add(e.id);
// //       next.severityCounts[e.severity] += 1;
// //       next.dimensionScores[e.dimension] += SEVERITY_WEIGHT[e.severity] * Math.max(0, Math.min(1, e.confidence));
// //       next.totalFindings += 1;
// //       return next;
// //     }
// //     case "RESET":
// //       return initialState;
// //     default:
// //       return state;
// //   }
// // }

// // /* ----------------------- Data Derivations ------------------------ */
// // function useBarData(severityCounts: State["severityCounts"]) {
// //   // Recharts expects an array of objects
// //   return SEVERITIES.map((sev) => ({
// //     severity: sev,
// //     count: severityCounts[sev],
// //   }));
// // }

// // function useRadarData(dimensionScores: State["dimensionScores"]) {
// //   // normalize each dim to 0..100
// //   const norm = (v: number) => Math.min(100, Math.round((v / RADAR_SCORE_CAP) * 100));
// //   return DIMENSIONS.map((dim) => ({
// //     dimension: labelForDimension(dim),
// //     score: norm(dimensionScores[dim]),
// //   }));
// // }

// // function labelForDimension(d: Dimension) {
// //   switch (d) {
// //     case "credential": return "Credentials";
// //     case "broker": return "Data Brokers";
// //     case "location": return "Location";
// //     case "identity": return "Identity";
// //     case "contact": return "Contact";
// //     case "social": return "Social";
// //   }
// // }

// // /* ----------------------- Stream Integration ---------------------- */
// // /**
// //  * SSE mode: connects to http://localhost:41234/stream/:jobId and forwards "result" events.
// //  * Mock mode: generates synthetic events for demo.
// //  */
// // function useSherlockStream(
// //   dispatch: React.Dispatch<Action>,
// //   opts: { mode: "sse" | "mock"; jobId?: string }
// // ) {
// //   useEffect(() => {
// //     if (opts.mode === "sse") {
// //       if (!opts.jobId) return;
// //       const es = new EventSource(`http://localhost:41234/stream/${opts.jobId}`);
// //       es.onmessage = (ev) => {
// //         try {
// //           const parsed: RunnerEvent = JSON.parse(ev.data);
// //           if (parsed.type === "result" && parsed.item) {
// //             const e = mapRunnerResultToFinding(parsed.item);
// //             dispatch({ type: "ADD_EVENT", payload: e });
// //           }
// //         } catch {
// //           // ignore malformed lines
// //         }
// //       };
// //       return () => es.close();
// //     }

// //     // mock mode
// //     const sources = ["twitter", "linkedin", "pipl", "leak-lookup", "google", "spokeo"];
// //     const dims: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];
// //     const sevs: Severity[] = ["low", "medium", "high", "critical"];

// //     let n = 0;
// //     const interval = setInterval(() => {
// //       n++;
// //       const sev = weightedSeverity();
// //       const dim = dims[Math.floor(Math.random() * dims.length)];
// //       const src = sources[Math.floor(Math.random() * sources.length)];
// //       const conf = +(0.6 + Math.random() * 0.4).toFixed(2);
// //       const id = `${src}:${dim}:${sev}:${n}`;

// //       const evt: FindingEvent = {
// //         id,
// //         source: src,
// //         pii: ["username"],
// //         severity: sev,
// //         confidence: conf,
// //         dimension: dim,
// //         timestamp: Math.floor(Date.now() / 1000),
// //       };
// //       dispatch({ type: "ADD_EVENT", payload: evt });
// //     }, 600); // new result ~ every 0.6s

// //     return () => clearInterval(interval);

// //     function weightedSeverity(): Severity {
// //       // roughly biased toward medium/high
// //       const r = Math.random();
// //       if (r < 0.15) return "low";
// //       if (r < 0.55) return "medium";
// //       if (r < 0.9) return "high";
// //       return "critical";
// //     }
// //   }, [dispatch, opts.mode, opts.jobId]);
// // }

// // // map runner result to our FindingEvent shape
// // function mapRunnerResultToFinding(item: RunnerEvent & any["item"]): FindingEvent {
// //   const sev = normalizeSeverity(item.severity);
// //   const dim = item.dimension ?? inferDimensionFromSite(item.site);
// //   return {
// //     id: item.id,
// //     source: item.site || "unknown",
// //     pii: ["unknown"],
// //     severity: sev,
// //     confidence: clamp01(item.confidence ?? 0.9),
// //     dimension: dim,
// //     timestamp: Math.floor((item.timestamp ? item.timestamp * 1000 : Date.now()) / 1000),
// //   };
// // }

// // function normalizeSeverity(s?: string): Severity {
// //   const v = (s || "").toLowerCase();
// //   if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
// //   return "medium";
// // }

// // function inferDimensionFromSite(site?: string): Dimension {
// //   const s = (site || "").toLowerCase();
// //   if (/(leak|breach|paste|pwn|haveibeenpwned)/.test(s)) return "credential";
// //   if (/(spokeo|pipl|broker|peek|searchpeople|people|whitepages)/.test(s)) return "broker";
// //   if (/(twitter|x\.com|instagram|facebook|linkedin|github|reddit|tiktok)/.test(s)) return "social";
// //   if (/(maps|address|geocode|strava|geotag)/.test(s)) return "location";
// //   if (/(email|phone|contact)/.test(s)) return "contact";
// //   return "identity";
// // }

// // function clamp01(n: number) {
// //   return Math.max(0, Math.min(1, n));
// // }

// // /* ---------------------------- Component -------------------------- */
// // export default function ChartsPanel({
// //   jobId,
// //   useMock = true,
// // }: {
// //   jobId?: string;
// //   useMock?: boolean;
// // }) {
// //   const [state, dispatch] = useReducer(reducer, initialState);

// //   // Hook to stream: SSE if jobId provided and useMock=false; otherwise mock.
// //   useSherlockStream(dispatch, { mode: useMock ? "mock" : "sse", jobId });

// //   const barData = useBarData(state.severityCounts);
// //   const radarData = useRadarData(state.dimensionScores);

// //   const totals = useMemo(
// //     () => ({
// //       low: state.severityCounts.low,
// //       medium: state.severityCounts.medium,
// //       high: state.severityCounts.high,
// //       critical: state.severityCounts.critical,
// //       total: state.totalFindings,
// //     }),
// //     [state]
// //   );

// //   return (
// //     <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
// //       {/* Summary strip */}
// //       <div className="lg:col-span-2 flex items-center justify-between rounded-2xl border p-4">
// //         <div className="text-xl font-semibold">Scan in progress</div>
// //         <div className="flex gap-4 text-sm">
// //           <Badge label="Total" value={totals.total} />
// //           <Badge label="Critical" value={totals.critical} />
// //           <Badge label="High" value={totals.high} />
// //           <Badge label="Med" value={totals.medium} />
// //           <Badge label="Low" value={totals.low} />
// //         </div>
// //       </div>

// //       {/* Severity Bar Chart */}
// //       <Panel title="Findings by severity">
// //         <ResponsiveContainer width="100%" height={320}>
// //           <BarChart data={barData} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
// //             <CartesianGrid strokeDasharray="3 3" />
// //             <XAxis dataKey="severity" />
// //             <YAxis allowDecimals={false} />
// //             <Tooltip />
// //             <Legend />
// //             <Bar dataKey="count" name="Count" />
// //           </BarChart>
// //         </ResponsiveContainer>
// //       </Panel>

// //       {/* Risk Radar Chart */}
// //       <Panel title="Risk by dimension (normalized)">
// //         <ResponsiveContainer width="100%" height={320}>
// //           <RadarChart data={radarData}>
// //             <PolarGrid />
// //             <PolarAngleAxis dataKey="dimension" />
// //             <PolarRadiusAxis angle={30} domain={[0, 100]} />
// //             <Radar name="Risk" dataKey="score" fillOpacity={0.6} />
// //             <Legend />
// //             <Tooltip />
// //           </RadarChart>
// //         </ResponsiveContainer>
// //       </Panel>

// //       {/* Controls */}
// //       <div className="lg:col-span-2 flex gap-3">
// //         <button
// //           className="rounded-xl border px-4 py-2 hover:bg-gray-50"
// //           onClick={() => dispatch({ type: "RESET" })}
// //         >
// //           Reset charts
// //         </button>
// //         {/* Example wiring point for “Stop Scan” etc. */}
// //         <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">Stop scan</button>
// //       </div>
// //     </div>
// //   );
// // }

// // /* ---------------------------- UI Bits ---------------------------- */
// // function Panel({ title, children }: { title: string; children: React.ReactNode }) {
// //   return (
// //     <div className="rounded-2xl border p-4">
// //       <div className="mb-3 font-semibold">{title}</div>
// //       {children}
// //     </div>
// //   );
// // }

// // function Badge({ label, value }: { label: string; value: number }) {
// //   return (
// //     <div className="rounded-full border px-3 py-1">
// //       <span className="font-medium">{label}:</span>{" "}
// //       <span className="tabular-nums">{value}</span>
// //     </div>
// //   );
// // }

// import React, { useEffect, useMemo, useReducer, useState } from "react";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   RadarChart,
//   PolarGrid,
//   PolarAngleAxis,
//   PolarRadiusAxis,
//   Radar,
//   ResponsiveContainer,
// } from "recharts";

// /* ----------------------------- Types ----------------------------- */
// type Severity = "low" | "medium" | "high" | "critical";
// type Dimension = "identity" | "contact" | "social" | "location" | "credential" | "broker";

// type FindingEvent = {
//   id: string;
//   source: string;
//   pii: string[];
//   severity: Severity;
//   confidence: number;   // 0..1
//   dimension: Dimension;
//   timestamp: number;    // epoch seconds
// };

// // events coming from the local runner (SSE)
// type RunnerEvent =
//   | { type: "log"; text: string }
//   | {
//       type: "result";
//       item: {
//         id: string;
//         site: string;
//         url?: string;
//         title?: string;
//         snippet?: string;
//         severity?: string;
//         confidence?: number;
//         dimension?: Dimension;
//         timestamp?: number;
//       };
//     }
//   | { type: "done" };

// /* ----------------------- Config / Mappings ----------------------- */
// const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
// const DIMENSIONS: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];

// // Severity weights drive radar scoring
// const SEVERITY_WEIGHT: Record<Severity, number> = {
//   low: 1,
//   medium: 2,
//   high: 4,
//   critical: 6,
// };

// // Cap used for normalizing radar scores to 0..100
// const RADAR_SCORE_CAP = 40;

// // For list sorting by severity
// const SEVERITY_ORDER: Record<Severity, number> = {
//   critical: 3,
//   high: 2,
//   medium: 1,
//   low: 0,
// };

// /* ----------------------------- State ----------------------------- */
// type State = {
//   seenIds: Set<string>;
//   severityCounts: Record<Severity, number>;
//   dimensionScores: Record<Dimension, number>;
//   totalFindings: number;
// };

// type Action =
//   | { type: "ADD_EVENT"; payload: FindingEvent }
//   | { type: "RESET" };

// const initialState: State = {
//   seenIds: new Set(),
//   severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
//   dimensionScores: { identity: 0, contact: 0, social: 0, location: 0, credential: 0, broker: 0 },
//   totalFindings: 0,
// };

// function reducer(state: State, action: Action): State {
//   switch (action.type) {
//     case "ADD_EVENT": {
//       const e = action.payload;
//       if (state.seenIds.has(e.id)) return state; // dedupe
//       const next = {
//         ...state,
//         seenIds: new Set(state.seenIds),
//         severityCounts: { ...state.severityCounts },
//         dimensionScores: { ...state.dimensionScores },
//       };
//       next.seenIds.add(e.id);
//       next.severityCounts[e.severity] += 1;
//       next.dimensionScores[e.dimension] += SEVERITY_WEIGHT[e.severity] * Math.max(0, Math.min(1, e.confidence));
//       next.totalFindings += 1;
//       return next;
//     }
//     case "RESET":
//       return initialState;
//     default:
//       return state;
//   }
// }

// /* ----------------------- Data Derivations ------------------------ */
// function useBarData(severityCounts: State["severityCounts"]) {
//   return SEVERITIES.map((sev) => ({
//     severity: sev,
//     count: severityCounts[sev],
//   }));
// }

// function useRadarData(dimensionScores: State["dimensionScores"]) {
//   const norm = (v: number) => Math.min(100, Math.round((v / RADAR_SCORE_CAP) * 100));
//   return DIMENSIONS.map((dim) => ({
//     dimension: labelForDimension(dim),
//     score: norm(dimensionScores[dim]),
//   }));
// }

// function labelForDimension(d: Dimension) {
//   switch (d) {
//     case "credential": return "Credentials";
//     case "broker": return "Data Brokers";
//     case "location": return "Location";
//     case "identity": return "Identity";
//     case "contact": return "Contact";
//     case "social": return "Social";
//   }
// }

// /* ----------------------- Stream Integration ---------------------- */
// /**
//  * SSE mode: connects to http://localhost:41234/stream/:jobId and forwards "result" events.
//  * Mock mode: generates synthetic events for demo.
//  * onResult: optional callback to receive raw items for the UI list.
//  */
// function useSherlockStream(
//   dispatch: React.Dispatch<Action>,
//   opts: { mode: "sse" | "mock"; jobId?: string },
//   onResult?: (item: RunnerEvent & any["item"]) => void
// ) {
//   useEffect(() => {
//     if (opts.mode === "sse") {
//       if (!opts.jobId) return;
//       const es = new EventSource(`http://localhost:41234/stream/${opts.jobId}`);
//       es.onmessage = (ev) => {
//         try {
//           const parsed: RunnerEvent = JSON.parse(ev.data);
//           if (parsed.type === "result" && parsed.item) {
//             const e = mapRunnerResultToFinding(parsed.item);
//             dispatch({ type: "ADD_EVENT", payload: e });
//             onResult?.(parsed.item);
//           }
//         } catch {
//           // ignore malformed lines
//         }
//       };
//       return () => es.close();
//     }

//     // mock mode
//     const sources = ["twitter", "linkedin", "pipl", "leak-lookup", "google", "spokeo"];
//     const dims: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];
//     const sevs: Severity[] = ["low", "medium", "high", "critical"];

//     let n = 0;
//     const interval = setInterval(() => {
//       n++;
//       const sev = weightedSeverity();
//       const dim = dims[Math.floor(Math.random() * dims.length)];
//       const src = sources[Math.floor(Math.random() * sources.length)];
//       const conf = +(0.6 + Math.random() * 0.4).toFixed(2);
//       const id = `${src}:${dim}:${sev}:${n}`;

//       const evt: FindingEvent = {
//         id,
//         source: src,
//         pii: ["username"],
//         severity: sev,
//         confidence: conf,
//         dimension: dim,
//         timestamp: Math.floor(Date.now() / 1000),
//       };
//       dispatch({ type: "ADD_EVENT", payload: evt });
//       onResult?.({
//         id,
//         site: src,
//         url: "",
//         title: `${src} match`,
//         snippet: "username",
//         severity: sev,
//         confidence: conf,
//         dimension: dim,
//         timestamp: Date.now() / 1000,
//       } as any);
//     }, 600);

//     return () => clearInterval(interval);

//     function weightedSeverity(): Severity {
//       const r = Math.random();
//       if (r < 0.15) return "low";
//       if (r < 0.55) return "medium";
//       if (r < 0.9) return "high";
//       return "critical";
//     }
//   }, [dispatch, opts.mode, opts.jobId, onResult]);
// }

// // map runner result to our FindingEvent shape
// function mapRunnerResultToFinding(item: RunnerEvent & any["item"]): FindingEvent {
//   const sev = normalizeSeverity(item.severity);
//   const dim = item.dimension ?? inferDimensionFromSite(item.site);
//   return {
//     id: item.id,
//     source: item.site || "unknown",
//     pii: ["unknown"],
//     severity: sev,
//     confidence: clamp01(item.confidence ?? 0.9),
//     dimension: dim,
//     timestamp: Math.floor((item.timestamp ? item.timestamp * 1000 : Date.now()) / 1000),
//   };
// }

// function normalizeSeverity(s?: string): Severity {
//   const v = (s || "").toLowerCase();
//   if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
//   return "medium";
// }

// function inferDimensionFromSite(site?: string): Dimension {
//   const s = (site || "").toLowerCase();
//   if (/(leak|breach|paste|pwn|haveibeenpwned)/.test(s)) return "credential";
//   if (/(spokeo|pipl|broker|peek|searchpeople|people|whitepages)/.test(s)) return "broker";
//   if (/(twitter|x\.com|instagram|facebook|linkedin|github|reddit|tiktok)/.test(s)) return "social";
//   if (/(maps|address|geocode|strava|geotag)/.test(s)) return "location";
//   if (/(email|phone|contact)/.test(s)) return "contact";
//   return "identity";
// }

// function clamp01(n: number) {
//   return Math.max(0, Math.min(1, n));
// }

// /* ---------------------------- Component -------------------------- */
// export default function ChartsPanel({
//   jobId,
//   useMock = true,
// }: {
//   jobId?: string;
//   useMock?: boolean;
// }) {
//   const [state, dispatch] = useReducer(reducer, initialState);

//   // NEW: keep a deduped list of found items for display
//   type FoundItem = {
//     id: string;
//     site: string;
//     url?: string;
//     title?: string;
//     severity: Severity;
//     dimension: Dimension;
//   };
//   const [found, setFound] = useState<FoundItem[]>([]);
//   const seen = React.useRef<Set<string>>(new Set());

//   // Hook to stream: SSE if jobId provided and useMock=false; otherwise mock.
//   useSherlockStream(
//     dispatch,
//     { mode: useMock ? "mock" : "sse", jobId },
//     (item) => {
//       const severity = normalizeSeverity(item.severity) as Severity;
//       const dimension = item.dimension ?? inferDimensionFromSite(item.site);
//       if (!seen.current.has(item.id)) {
//         seen.current.add(item.id);
//         setFound((prev) =>
//           [...prev, {
//             id: item.id,
//             site: item.site,
//             url: item.url,
//             title: item.title,
//             severity,
//             dimension,
//           }].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
//         );
//       }
//     }
//   );

//   const barData = useBarData(state.severityCounts);
//   const radarData = useRadarData(state.dimensionScores);

//   const totals = useMemo(
//     () => ({
//       low: state.severityCounts.low,
//       medium: state.severityCounts.medium,
//       high: state.severityCounts.high,
//       critical: state.severityCounts.critical,
//       total: state.totalFindings,
//     }),
//     [state]
//   );

//   return (
//     <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
//       {/* Summary strip */}
//       <div className="lg:col-span-2 flex items-center justify-between rounded-2xl border p-4">
//         <div className="text-xl font-semibold">Scan in progress</div>
//         <div className="flex gap-4 text-sm">
//           <Badge label="Total" value={totals.total} />
//           <Badge label="Critical" value={totals.critical} />
//           <Badge label="High" value={totals.high} />
//           <Badge label="Med" value={totals.medium} />
//           <Badge label="Low" value={totals.low} />
//         </div>
//       </div>

//       {/* Severity Bar Chart */}
//       <Panel title="Findings by severity">
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart data={barData} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="severity" />
//             <YAxis allowDecimals={false} />
//             <Tooltip />
//             <Legend />
//             <Bar dataKey="count" name="Count" />
//           </BarChart>
//         </ResponsiveContainer>
//       </Panel>

//       {/* Risk Radar Chart */}
//       <Panel title="Risk by dimension (normalized)">
//         <ResponsiveContainer width="100%" height={320}>
//           <RadarChart data={radarData}>
//             <PolarGrid />
//             <PolarAngleAxis dataKey="dimension" />
//             <PolarRadiusAxis angle={30} domain={[0, 100]} />
//             <Radar name="Risk" dataKey="score" fillOpacity={0.6} />
//             <Legend />
//             <Tooltip />
//           </RadarChart>
//         </ResponsiveContainer>
//       </Panel>

//       {/* NEW: Found sites list */}
//       <div className="lg:col-span-2">
//         <Panel title={`Found websites (${found.length})`}>
//           <div className="max-h-72 overflow-auto pr-1">
//             {found.length === 0 ? (
//               <div className="text-sm text-gray-500">No sites found yet…</div>
//             ) : (
//               <ul className="space-y-2">
//                 {found.map((f) => (
//                   <li key={f.id} className="flex items-start justify-between rounded-xl border p-3">
//                     <div className="min-w-0">
//                       <div className="font-medium truncate">{f.title || f.site}</div>
//                       <div className="text-sm text-gray-600 truncate">
//                         {f.url ? (
//                           <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
//                             {f.url}
//                           </a>
//                         ) : (
//                           <span className="italic text-gray-500">no URL provided</span>
//                         )}
//                       </div>
//                     </div>
//                     <div className="flex items-center gap-2 pl-3 shrink-0">
//                       <Pill variant={f.severity}>{f.severity}</Pill>
//                       <span className="text-xs rounded-full border px-2 py-0.5">{labelForDimension(f.dimension)}</span>
//                     </div>
//                   </li>
//                 ))}
//               </ul>
//             )}
//           </div>
//         </Panel>
//       </div>

//       {/* Controls */}
//       <div className="lg:col-span-2 flex gap-3">
//         <button
//           className="rounded-xl border px-4 py-2 hover:bg-gray-50"
//           onClick={() => {
//             // reset charts + found list
//             seen.current = new Set();
//             setFound([]);
//             // reducer reset
//             // Note: dispatching RESET replaces state, but we must re-create the Set in initialState
//             dispatch({ type: "RESET" });
//           }}
//         >
//           Reset charts & list
//         </button>
//         <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">Stop scan</button>
//       </div>
//     </div>
//   );
// }

// /* ---------------------------- UI Bits ---------------------------- */
// function Panel({ title, children }: { title: string; children: React.ReactNode }) {
//   return (
//     <div className="rounded-2xl border p-4">
//       <div className="mb-3 font-semibold">{title}</div>
//       {children}
//     </div>
//   );
// }

// function Badge({ label, value }: { label: string; value: number }) {
//   return (
//     <div className="rounded-full border px-3 py-1">
//       <span className="font-medium">{label}:</span>{" "}
//       <span className="tabular-nums">{value}</span>
//     </div>
//   );
// }

// function Pill({ variant, children }: { variant: Severity; children: React.ReactNode }) {
//   const cls = {
//     critical: "bg-red-600 text-white",
//     high: "bg-orange-500 text-white",
//     medium: "bg-yellow-400 text-black",
//     low: "bg-gray-300 text-black",
//   }[variant];
//   return <span className={`text-xs rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
// }


import React, { useEffect, useMemo, useReducer, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

/* ----------------------------- Types ----------------------------- */
type Severity = "low" | "medium" | "high" | "critical";
type Dimension = "identity" | "contact" | "social" | "location" | "credential" | "broker";

type FindingEvent = {
  id: string;
  source: string;
  pii: string[];
  severity: Severity;
  confidence: number;   // 0..1
  dimension: Dimension;
  timestamp: number;    // epoch seconds
};

// events coming from the local runner (SSE)
type RunnerEvent =
  | { type: "log"; text: string }
  | {
      type: "result";
      item: {
        id: string;
        site: string;
        url?: string;
        title?: string;
        snippet?: string;
        severity?: string;
        confidence?: number;
        dimension?: Dimension;
        timestamp?: number;
      };
    }
  | { type: "done" };

/* ----------------------- Config / Mappings ----------------------- */
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const DIMENSIONS: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];

// Severity weights drive radar scoring
const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 6,
};

// Cap used for normalizing radar scores to 0..100
const RADAR_SCORE_CAP = 40;

// For list sorting by severity
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

// Toggle: randomize severity for SSE results (for demo without AI)
const RANDOMIZE_SEVERITY = true;

/* ----------------------------- State ----------------------------- */
type State = {
  seenIds: Set<string>;
  severityCounts: Record<Severity, number>;
  dimensionScores: Record<Dimension, number>;
  totalFindings: number;
};

type Action =
  | { type: "ADD_EVENT"; payload: FindingEvent }
  | { type: "RESET" };

const initialState: State = {
  seenIds: new Set(),
  severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
  dimensionScores: { identity: 0, contact: 0, social: 0, location: 0, credential: 0, broker: 0 },
  totalFindings: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_EVENT": {
      const e = action.payload;
      if (state.seenIds.has(e.id)) return state; // dedupe
      const next = {
        ...state,
        seenIds: new Set(state.seenIds),
        severityCounts: { ...state.severityCounts },
        dimensionScores: { ...state.dimensionScores },
      };
      next.seenIds.add(e.id);
      next.severityCounts[e.severity] += 1;
      next.dimensionScores[e.dimension] += SEVERITY_WEIGHT[e.severity] * Math.max(0, Math.min(1, e.confidence));
      next.totalFindings += 1;
      return next;
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

/* ----------------------- Data Derivations ------------------------ */
function useBarData(severityCounts: State["severityCounts"]) {
  return SEVERITIES.map((sev) => ({
    severity: sev,
    count: severityCounts[sev],
  }));
}

function useRadarData(dimensionScores: State["dimensionScores"]) {
  const norm = (v: number) => Math.min(100, Math.round((v / RADAR_SCORE_CAP) * 100));
  return DIMENSIONS.map((dim) => ({
    dimension: labelForDimension(dim),
    score: norm(dimensionScores[dim]),
  }));
}

function labelForDimension(d: Dimension) {
  switch (d) {
    case "credential": return "Credentials";
    case "broker": return "Data Brokers";
    case "location": return "Location";
    case "identity": return "Identity";
    case "contact": return "Contact";
    case "social": return "Social";
  }
}

/* ----------------------- Stream Integration ---------------------- */
/**
 * SSE mode: connects to http://localhost:41234/stream/:jobId and forwards "result" events.
 * Mock mode: generates synthetic events for demo.
 * onResult: optional callback to receive raw items for the UI list.
 */
function useSherlockStream(
  dispatch: React.Dispatch<Action>,
  opts: { mode: "sse" | "mock"; jobId?: string },
  onResult?: (item: RunnerEvent & any["item"]) => void
) {
  useEffect(() => {
    if (opts.mode === "sse") {
      if (!opts.jobId) return;
      const es = new EventSource(`http://localhost:41234/stream/${opts.jobId}`);
      es.onmessage = (ev) => {
        try {
          const parsed: RunnerEvent = JSON.parse(ev.data);
          if (parsed.type === "result" && parsed.item) {
            // Randomize or normalize severity once, then use the same value everywhere
            const chosenSeverity: Severity = RANDOMIZE_SEVERITY
              ? randomSeverityWeighted()
              : normalizeSeverity(parsed.item.severity);

            const mapped = mapRunnerResultToFinding(parsed.item, chosenSeverity);
            dispatch({ type: "ADD_EVENT", payload: mapped });

            // Pass item to UI list with the same chosen severity to stay consistent
            onResult?.({ ...parsed.item, severity: chosenSeverity } as any);
          }
        } catch {
          // ignore malformed lines
        }
      };
      return () => es.close();
    }

    // mock mode (already randomizes severity)
    const sources = ["twitter", "linkedin", "pipl", "leak-lookup", "google", "spokeo"];
    const dims: Dimension[] = ["identity", "contact", "social", "location", "credential", "broker"];
    const sevs: Severity[] = ["low", "medium", "high", "critical"];

    let n = 0;
    const interval = setInterval(() => {
      n++;
      const sev = weightedSeverity();
      const dim = dims[Math.floor(Math.random() * dims.length)];
      const src = sources[Math.floor(Math.random() * sources.length)];
      const conf = +(0.6 + Math.random() * 0.4).toFixed(2);
      const id = `${src}:${dim}:${sev}:${n}`;

      const evt: FindingEvent = {
        id,
        source: src,
        pii: ["username"],
        severity: sev,
        confidence: conf,
        dimension: dim,
        timestamp: Math.floor(Date.now() / 1000),
      };
      dispatch({ type: "ADD_EVENT", payload: evt });
      onResult?.({
        id,
        site: src,
        url: "",
        title: `${src} match`,
        snippet: "username",
        severity: sev,
        confidence: conf,
        dimension: dim,
        timestamp: Date.now() / 1000,
      } as any);
    }, 600);

    return () => clearInterval(interval);
  }, [dispatch, opts.mode, opts.jobId, onResult]);
}

// Weighted RNG for demo (rough bias to medium/high)
function randomSeverityWeighted(): Severity {
  const r = Math.random();
  if (r < 0.45) return "low";
  if (r < 0.8) return "medium";   // 45%
  if (r < 0.9) return "high";     // 30%
  return "critical";              // 10%
}

function weightedSeverity(): Severity {
  // used by mock mode
  const r = Math.random();
  if (r < 0.15) return "low";
  if (r < 0.55) return "medium";
  if (r < 0.9) return "high";
  return "critical";
}

// map runner result to our FindingEvent shape (with optional severity override)
function mapRunnerResultToFinding(
  item: RunnerEvent & any["item"],
  severityOverride?: Severity
): FindingEvent {
  const sev = severityOverride ?? normalizeSeverity(item.severity);
  const dim = item.dimension ?? inferDimensionFromSite(item.site);
  return {
    id: item.id,
    source: item.site || "unknown",
    pii: ["unknown"],
    severity: sev,
    confidence: clamp01(item.confidence ?? 0.9),
    dimension: dim,
    timestamp: Math.floor((item.timestamp ? item.timestamp * 1000 : Date.now()) / 1000),
  };
}

function normalizeSeverity(s?: string): Severity {
  const v = (s || "").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function inferDimensionFromSite(site?: string): Dimension {
  const s = (site || "").toLowerCase();
  if (/(leak|breach|paste|pwn|haveibeenpwned)/.test(s)) return "credential";
  if (/(spokeo|pipl|broker|peek|searchpeople|people|whitepages)/.test(s)) return "broker";
  if (/(twitter|x\.com|instagram|facebook|linkedin|github|reddit|tiktok)/.test(s)) return "social";
  if (/(maps|address|geocode|strava|geotag)/.test(s)) return "location";
  if (/(email|phone|contact)/.test(s)) return "contact";
  return "identity";
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/* ---------------------------- Component -------------------------- */
export default function ChartsPanel({
  jobId,
  useMock = true,
}: {
  jobId?: string;
  useMock?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // NEW: keep a deduped list of found items for display
  type FoundItem = {
    id: string;
    site: string;
    url?: string;
    title?: string;
    severity: Severity;
    dimension: Dimension;
  };
  const [found, setFound] = useState<FoundItem[]>([]);
  const seen = React.useRef<Set<string>>(new Set());

  // Hook to stream: SSE if jobId provided and useMock=false; otherwise mock.
  useSherlockStream(
    dispatch,
    { mode: useMock ? "mock" : "sse", jobId },
    (item) => {
      const severity = normalizeSeverity(item.severity as string) as Severity;
      const dimension = (item.dimension as Dimension) ?? inferDimensionFromSite(item.site);
      if (!seen.current.has(item.id)) {
        seen.current.add(item.id);
        setFound((prev) =>
          [...prev, {
            id: item.id,
            site: item.site,
            url: item.url,
            title: item.title,
            severity,
            dimension,
          }].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
        );
      }
    }
  );

  const barData = useBarData(state.severityCounts);
  const radarData = useRadarData(state.dimensionScores);

  const totals = useMemo(
    () => ({
      low: state.severityCounts.low,
      medium: state.severityCounts.medium,
      high: state.severityCounts.high,
      critical: state.severityCounts.critical,
      total: state.totalFindings,
    }),
    [state]
  );

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Summary strip */}
      <div className="lg:col-span-2 flex items-center justify-between rounded-2xl border p-4">
        <div className="text-xl font-semibold">Scan in progress</div>
        <div className="flex gap-4 text-sm">
          <Badge label="Total" value={totals.total} />
          <Badge label="Critical" value={totals.critical} />
          <Badge label="High" value={totals.high} />
          <Badge label="Med" value={totals.medium} />
          <Badge label="Low" value={totals.low} />
        </div>
      </div>

      {/* Severity Bar Chart */}
      <Panel title="Findings by severity">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={barData} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="severity" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Risk Radar Chart */}
      <Panel title="Risk by dimension (normalized)">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Risk" dataKey="score" fillOpacity={0.6} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Found sites list */}
      <div className="lg:col-span-2">
        <Panel title={`Found websites (${found.length})`}>
          <div className="max-h-72 overflow-auto pr-1">
            {found.length === 0 ? (
              <div className="text-sm text-gray-500">No sites found yet…</div>
            ) : (
              <ul className="space-y-2">
                {found.map((f) => (
                  <li key={f.id} className="flex items-start justify-between rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{f.title || f.site}</div>
                      <div className="text-sm text-gray-600 truncate">
                        {f.url ? (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {f.url}
                          </a>
                        ) : (
                          <span className="italic text-gray-500">no URL provided</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-3 shrink-0">
                      <Pill variant={f.severity}>{f.severity}</Pill>
                      <span className="text-xs rounded-full border px-2 py-0.5">{labelForDimension(f.dimension)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* Controls */}
      <div className="lg:col-span-2 flex gap-3">
        <button
          className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          onClick={() => {
            // reset charts + found list
            seen.current = new Set();
            setFound([]);
            dispatch({ type: "RESET" });
          }}
        >
          Reset charts & list
        </button>
        <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">Stop scan</button>
      </div>
    </div>
  );
}

/* ---------------------------- UI Bits ---------------------------- */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Badge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border px-3 py-1">
      <span className="font-medium">{label}:</span>{" "}
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Pill({ variant, children }: { variant: Severity; children: React.ReactNode }) {
  const cls = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-400 text-black",
    low: "bg-gray-300 text-black",
  }[variant];
  return <span className={`text-xs rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}
