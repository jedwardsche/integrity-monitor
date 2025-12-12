import { useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

export interface Issue {
  id: string;
  rule_id: string;
  entity: string;
  record_id: string;
  severity: string;
  issue_type: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
  status?: string;
}

export interface IssueFilters {
  type?: string;
  severity?: string;
  rule_id?: string;
  entity?: string;
  status?: string;
  search?: string;
}

export function useFirestoreIssues(filters: IssueFilters = {}, pageSize: number = 50) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    const issuesRef = collection(db, "integrity_issues");
    let q = query(issuesRef);

    // Apply filters
    if (filters.type) {
      q = query(q, where("issue_type", "==", filters.type));
    }
    if (filters.severity) {
      q = query(q, where("severity", "==", filters.severity));
    }
    if (filters.entity) {
      q = query(q, where("entity", "==", filters.entity));
    }
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    } else {
      // Default to open issues
      q = query(q, where("status", "==", "open"));
    }

    // Order by created_at desc
    q = query(q, orderBy("created_at", "desc"), limit(pageSize + 1));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          let transformed: Issue[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              rule_id: data.rule_id || "",
              entity: data.entity || "",
              record_id: data.record_id || "",
              severity: data.severity || "info",
              issue_type: data.issue_type || "",
              description: data.description,
              metadata: data.metadata,
              created_at: data.created_at?.toDate?.() || new Date(),
              updated_at: data.updated_at?.toDate?.() || new Date(),
              status: data.status || "open",
            };
          });

          // Apply search filter if provided
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            transformed = transformed.filter(
              (issue) =>
                issue.rule_id.toLowerCase().includes(searchLower) ||
                issue.record_id.toLowerCase().includes(searchLower) ||
                issue.description?.toLowerCase().includes(searchLower)
            );
          }

          // Check if there are more results
          if (transformed.length > pageSize) {
            setHasMore(true);
            transformed = transformed.slice(0, pageSize);
          } else {
            setHasMore(false);
          }

          setIssues(transformed);
          if (snapshot.docs.length > 0) {
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot);
          }
          setLoading(false);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to process issues");
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters.type, filters.severity, filters.entity, filters.status, filters.search, pageSize]);

  return { data: issues, loading, error, hasMore, lastDoc };
}

