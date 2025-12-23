export const API_BASE = (() => {
    // Get the env var (which might be "http://localhost:8000" if built locally)
    const envApiBase = import.meta.env.VITE_API_BASE as string | undefined;

    // check if we are currently running on localhost
    const isRunningOnLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    // If we are on localhost, we can use the env var (even if it's localhost)
    // Or default to localhost:8000
    if (isRunningOnLocalhost) {
        const apiBase = envApiBase || "http://localhost:8000";
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:13',message:'API_BASE resolved (localhost)',data:{apiBase,envApiBase,isLocalhost:true},timestamp:Date.now(),sessionId:'debug-session',runId:'api-config',hypothesisId:'H9'})}).catch(()=>{});
        // #endregion agent log
        return apiBase;
    }

    // If we are NOT on localhost (e.g. production), 
    // we should ONLY use the env var if it does NOT point to localhost.
    if (envApiBase && !envApiBase.includes("localhost") && !envApiBase.includes("127.0.0.1")) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:19',message:'API_BASE resolved (production from env)',data:{apiBase:envApiBase,envApiBase,isLocalhost:false},timestamp:Date.now(),sessionId:'debug-session',runId:'api-config',hypothesisId:'H9'})}).catch(()=>{});
        // #endregion agent log
        return envApiBase;
    }

    // Fallback for production: use the current origin
    // This assumes the API is hosted at the same domain/origin
    const fallbackBase = window.location.origin;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:24',message:'API_BASE resolved (fallback to origin)',data:{apiBase:fallbackBase,envApiBase,origin:window.location.origin,isLocalhost:false,warning:'Using origin fallback - backend may not be at this URL'},timestamp:Date.now(),sessionId:'debug-session',runId:'api-config',hypothesisId:'H9'})}).catch(()=>{});
    // #endregion agent log
    return fallbackBase;
})();

export default API_BASE;
