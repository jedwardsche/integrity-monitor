import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type AirtableSchema } from "../utils/airtable";
import { useAuth } from "../hooks/useAuth";
import { API_BASE } from "../config/api";

interface AirtableSchemaContextType {
  schema: AirtableSchema | null;
  loading: boolean;
  error: string | null;
}

const AirtableSchemaContext = createContext<
  AirtableSchemaContextType | undefined
>(undefined);

export function AirtableSchemaProvider({ children }: { children: ReactNode }) {
  const [schema, setSchema] = useState<AirtableSchema | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, user } = useAuth();

  useEffect(() => {
    let mounted = true;

    const fetchSchema = async () => {
      // Don't fetch if no user
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication required");
        }

        const response = await fetch(`${API_BASE}/airtable/schema`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }

        const data = await response.json();
        if (mounted) {
          setSchema(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          // Try to load local schema as fallback
          try {
            console.warn(
              "Fetching remote schema failed, trying local fallback",
              err
            );
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "AirtableSchemaContext.tsx:63",
                  message: "Attempting local schema fallback",
                  data: {
                    remoteError:
                      err instanceof Error ? err.message : String(err),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "schema-fetch",
                  hypothesisId: "H1",
                }),
              }
            ).catch(() => {});
            // #endregion agent log
            const localResponse = await fetch("/airtable-schema.json");
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "AirtableSchemaContext.tsx:65",
                  message: "Local response received",
                  data: {
                    ok: localResponse.ok,
                    status: localResponse.status,
                    statusText: localResponse.statusText,
                    contentType: localResponse.headers.get("content-type"),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "schema-fetch",
                  hypothesisId: "H1",
                }),
              }
            ).catch(() => {});
            // #endregion agent log
            if (localResponse.ok) {
              const contentType =
                localResponse.headers.get("content-type") || "";
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "AirtableSchemaContext.tsx:68",
                    message: "Checking content type before JSON parse",
                    data: {
                      contentType,
                      isJson: contentType.includes("application/json"),
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "schema-fetch",
                    hypothesisId: "H2",
                  }),
                }
              ).catch(() => {});
              // #endregion agent log
              if (!contentType.includes("application/json")) {
                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "AirtableSchemaContext.tsx:70",
                      message: "Content type is not JSON, reading as text",
                      data: { contentType },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "schema-fetch",
                      hypothesisId: "H2",
                    }),
                  }
                ).catch(() => {});
                // #endregion agent log
                const text = await localResponse.text();
                // #region agent log
                fetch(
                  "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "AirtableSchemaContext.tsx:72",
                      message: "Response text preview",
                      data: {
                        textPreview: text.substring(0, 100),
                        isHtml: text.trim().startsWith("<!"),
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "schema-fetch",
                      hypothesisId: "H1",
                    }),
                  }
                ).catch(() => {});
                // #endregion agent log
                throw new Error(
                  `Expected JSON but received ${contentType}. The file /airtable-schema.json may not exist in production.`
                );
              }
              const localData = await localResponse.json();
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "AirtableSchemaContext.tsx:75",
                    message: "Local schema parsed successfully",
                    data: { hasSchema: !!localData },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "schema-fetch",
                    hypothesisId: "H1",
                  }),
                }
              ).catch(() => {});
              // #endregion agent log
              setSchema(localData);
              setError(null); // Clear error if fallback succeeds
            } else {
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "AirtableSchemaContext.tsx:79",
                    message: "Local response not ok",
                    data: {
                      status: localResponse.status,
                      statusText: localResponse.statusText,
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "schema-fetch",
                    hypothesisId: "H1",
                  }),
                }
              ).catch(() => {});
              // #endregion agent log
              setError(
                err instanceof Error ? err.message : "Failed to load schema"
              );
            }
          } catch (fallbackErr) {
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "AirtableSchemaContext.tsx:82",
                  message: "Fallback error caught",
                  data: {
                    fallbackError:
                      fallbackErr instanceof Error
                        ? fallbackErr.message
                        : String(fallbackErr),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "schema-fetch",
                  hypothesisId: "H3",
                }),
              }
            ).catch(() => {});
            // #endregion agent log
            setError(
              err instanceof Error ? err.message : "Failed to load schema"
            );
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSchema();

    return () => {
      mounted = false;
    };
  }, [user, getToken]);

  return (
    <AirtableSchemaContext.Provider value={{ schema, loading, error }}>
      {children}
    </AirtableSchemaContext.Provider>
  );
}

export function useAirtableSchema() {
  const context = useContext(AirtableSchemaContext);
  if (context === undefined) {
    throw new Error(
      "useAirtableSchema must be used within an AirtableSchemaProvider"
    );
  }
  return context;
}
