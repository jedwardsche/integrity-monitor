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
        return envApiBase || "http://localhost:8000";
    }

    // If we are NOT on localhost (e.g. production), 
    // we should ONLY use the env var if it does NOT point to localhost.
    if (envApiBase && !envApiBase.includes("localhost") && !envApiBase.includes("127.0.0.1")) {
        return envApiBase;
    }

    // Fallback for production: use the current origin
    // This assumes the API is hosted at the same domain/origin
    return window.location.origin;
})();

export default API_BASE;
