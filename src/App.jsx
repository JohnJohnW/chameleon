// // App.jsx (minimal)
// import { useState } from "react";
// import ChartsPanel from "./components/ChartsPanel";

// export default function App() {
//   const [query, setQuery] = useState("");
//   const [jobId, setJobId] = useState(null);//<String | null>(null);
//   const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || "http://localhost:41234";

//   const startScan = async () => {
//     if (!query.trim()) {
//       alert("Enter a username to scan.");
//       return;
//     }
//     try {
//       const r = await fetch(`${RUNNER_URL}/scan`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ query }),   // <-- text input goes here
//       });
//       if (!r.ok) throw new Error(`scan failed: ${r.status}`);
//       const { jobId } = await r.json();
//       setJobId(jobId);
//     } catch (e) {
//       console.error(e);
//       alert("Could not start scan. Is the server running?");
//     }
//   };

//   return (
//     <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
//       <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
//         <input
//           value={query}
//           onChange={(e) => setQuery(e.target.value)}
//           placeholder="username (e.g. torvalds)"
//           style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}
//         />
//         <button onClick={startScan} style={{ padding: "10px 14px", borderRadius: 8 }}>
//           Scan now
//         </button>
//       </div>

//       {/* When jobId exists, connect to SSE */}
//       {jobId && <ChartsPanel jobId={jobId} useMock={false} />}
//     </div>
//   );
// }
// App.jsx (charts page)
import { useEffect, useState } from "react";
import ChartsPanel from "./components/ChartsPanel";

export default function App() {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState(null);
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || "http://localhost:41234";

  // Allow programmatic trigger: startScan(optionalQuery)
  const startScan = async (q) => {
    const toScan = (typeof q === "string" ? q : query).trim();
    if (!toScan) {
      alert("Enter a username to scan.");
      return;
    }
    try {
      const r = await fetch(`${RUNNER_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: toScan }),
      });
      if (!r.ok) throw new Error(`scan failed: ${r.status}`);
      const { jobId } = await r.json();
      // ensure input reflects the value we actually scanned
      setQuery(toScan);
      setJobId(jobId);
    } catch (e) {
      console.error(e);
      alert("Could not start scan. Is the server running?");
    }
  };

  // On first mount, if /scan?query=... is present, auto trigger scan once.
  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search);
      const q = qp.get("query");
      if (q && !jobId) {
        // Set it in the input immediately so the UI shows it
        setQuery(q);
        // Fire the scan (no alert path because q is non-empty)
        startScan(q);
      }
    } catch (_) {
      // ignore URL parsing errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ 
        display: "none" // Hide the redundant input/button since Results page has the query
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="username (e.g. torvalds)"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <button onClick={() => startScan()} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Scan now
        </button>
      </div>

      {/* When jobId exists, connect to SSE */}
      {jobId && <ChartsPanel jobId={jobId} useMock={false} />}
    </div>
  );
}
