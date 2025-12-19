import { useEffect, useState, useCallback, useRef } from "react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
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
  related_records?: string[];
  created_at?: Date;
  updated_at?: Date;
  status?: string;
  run_id?: string;
}

export interface IssueFilters {
  type?: string;
  severity?: string;
  rule_id?: string;
  entity?: string;
  status?: string;
  search?: string;
  run_id?: string;
}

const PAGE_SIZE = 100;

export function useFirestoreIssues(filters: IssueFilters = {}, pageSize: number = PAGE_SIZE) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Store cursor history for pagination
  const cursorHistory = useRef<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const buildQuery = useCallback(
    (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
      const issuesRef = collection(db, "integrity_issues");
      const constraints: any[] = [];

      // Apply filters
      if (filters.type) {
        constraints.push(where("issue_type", "==", filters.type));
      }
      if (filters.severity) {
        constraints.push(where("severity", "==", filters.severity));
      }
      if (filters.entity) {
        constraints.push(where("entity", "==", filters.entity));
      }
      if (filters.run_id) {
        constraints.push(where("run_id", "==", filters.run_id));
      }
      // Apply status filter only if explicitly set and not "all"
      if (filters.status && filters.status !== "all") {
        constraints.push(where("status", "==", filters.status));
      } else if (filters.status === undefined) {
        // Default to open issues when status is not provided (backward compatibility)
        constraints.push(where("status", "==", "open"));
      }
      // If filters.status === "all", don't apply status filter (show all statuses)

      // Order by created_at desc
      constraints.push(orderBy("created_at", "desc"));

      // Pagination cursor
      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      // Limit + 1 to check for more
      constraints.push(limit(pageSize + 1));

      return query(issuesRef, ...constraints);
    },
    [filters.type, filters.severity, filters.entity, filters.status, filters.run_id, pageSize]
  );

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
      setLoading(true);
      setError(null);

      try {
        const q = buildQuery(cursor);
        const snapshot = await getDocs(q);

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
            related_records: data.related_records,
            created_at: data.created_at?.toDate?.() || new Date(),
            updated_at: data.updated_at?.toDate?.() || new Date(),
            status: data.status || "open",
            run_id: data.run_id,
          };
        });

        // Apply search filter client-side (Firestore doesn't support text search)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          transformed = transformed.filter(
            (issue) =>
              issue.rule_id.toLowerCase().includes(searchLower) ||
              issue.record_id.toLowerCase().includes(searchLower) ||
              issue.description?.toLowerCase().includes(searchLower)
          );
        }

        // Check for more results
        const hasMoreResults = snapshot.docs.length > pageSize;
        setHasMore(hasMoreResults);

        // Trim to page size
        if (hasMoreResults) {
          transformed = transformed.slice(0, pageSize);
        }

        // Store last doc for next page
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[Math.min(snapshot.docs.length - 1, pageSize - 1)] as QueryDocumentSnapshot<DocumentData>;
        } else {
          lastDocRef.current = null;
        }

        setIssues(transformed);
      } catch (err: any) {
        const errorCode = err.code;
        let userMessage = err.message;

        if (errorCode === "permission-denied") {
          userMessage = "Access denied. Please check your permissions.";
        } else if (errorCode === "resource-exhausted") {
          userMessage = "Quota exceeded. Please try again later.";
        } else if (errorCode === "unavailable" || errorCode === "deadline-exceeded") {
          userMessage = "Service temporarily unavailable. Please try again.";
        }

        console.error("Firestore query error:", errorCode, err.message);
        setError(userMessage);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, filters.search, pageSize]
  );

  // Reset pagination when filters change
  useEffect(() => {
    cursorHistory.current = [null];
    setCurrentPage(1);
    setHasPrev(false);
    fetchPage(null);
  }, [filters.type, filters.severity, filters.entity, filters.status, filters.search, filters.run_id, fetchPage]);

  const nextPage = useCallback(() => {
    if (!hasMore || !lastDocRef.current) return;

    // Save current cursor
    cursorHistory.current.push(lastDocRef.current);
    setCurrentPage((p) => p + 1);
    setHasPrev(true);
    fetchPage(lastDocRef.current);
  }, [hasMore, fetchPage]);

  const prevPage = useCallback(() => {
    if (currentPage <= 1) return;

    // Pop last cursor and go to previous
    cursorHistory.current.pop();
    const prevCursor = cursorHistory.current[cursorHistory.current.length - 1];
    setCurrentPage((p) => p - 1);
    setHasPrev(cursorHistory.current.length > 1);
    fetchPage(prevCursor);
  }, [currentPage, fetchPage]);

  const goToPage = useCallback(
    async (page: number, totalPages?: number) => {
      if (page === currentPage || page < 1) return;
      
      // Going to page 1
      if (page === 1) {
        cursorHistory.current = [null];
        setCurrentPage(1);
        setHasPrev(false);
        fetchPage(null);
        return;
      }

      // Going backward to a visited page
      if (page < currentPage && page <= cursorHistory.current.length) {
        // Trim cursor history to target page
        cursorHistory.current = cursorHistory.current.slice(0, page);
        const cursor = cursorHistory.current[page - 1];
        setCurrentPage(page);
        setHasPrev(page > 1);
        fetchPage(cursor);
        return;
      }

      // Going forward - need to fetch intermediate pages
      if (page > currentPage) {
        setLoading(true);
        try {
          let cursor = lastDocRef.current;
          let currentP = currentPage;

          // Fetch pages until we reach target
          while (currentP < page) {
            if (!cursor && currentP > 1) break; // No more data

            const q = buildQuery(cursor);
            const snapshot = await getDocs(q);

            if (snapshot.docs.length === 0) break;

            // Store cursor for this page
            const lastDoc = snapshot.docs[Math.min(snapshot.docs.length - 1, pageSize - 1)] as QueryDocumentSnapshot<DocumentData>;
            cursorHistory.current.push(lastDoc);
            cursor = lastDoc;
            currentP++;

            // Check if this is the last page
            if (snapshot.docs.length <= pageSize) {
              // This is the last page, stop here
              break;
            }
          }

          // Now fetch the target page data
          const targetCursor = cursorHistory.current[cursorHistory.current.length - 1];
          setCurrentPage(currentP);
          setHasPrev(currentP > 1);
          lastDocRef.current = targetCursor;
          fetchPage(targetCursor);
        } catch (err) {
          console.error("Error navigating to page:", err);
          setLoading(false);
        }
      }
    },
    [currentPage, fetchPage, buildQuery, pageSize]
  );

  const goToLastPage = useCallback(
    async (totalPages: number) => {
      if (totalPages <= 1 || currentPage === totalPages) return;
      
      setLoading(true);
      setError(null);
      
      try {
        let cursor = lastDocRef.current;
        let currentP = currentPage;
        let hasMoreData = true;

        // Fetch pages until we reach the actual last page
        while (hasMoreData && currentP < totalPages) {
          if (!cursor && currentP > 1) {
            // No cursor available, we've gone as far as we can
            break;
          }

          const q = buildQuery(cursor);
          const snapshot = await getDocs(q);

          if (snapshot.docs.length === 0) {
            // No more documents
            hasMoreData = false;
            break;
          }

          // Check if this is the last page (fewer docs than pageSize + 1)
          if (snapshot.docs.length <= pageSize) {
            // This is the last page
            hasMoreData = false;
            // Store cursor for this page
            const lastDoc = snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot<DocumentData>;
            cursorHistory.current.push(lastDoc);
            cursor = lastDoc;
            currentP++;
            break;
          }

          // Store cursor for this page and continue
          const lastDoc = snapshot.docs[pageSize - 1] as QueryDocumentSnapshot<DocumentData>;
          cursorHistory.current.push(lastDoc);
          cursor = lastDoc;
          currentP++;
        }

        // Fetch and display the last page
        const targetCursor = cursorHistory.current[cursorHistory.current.length - 1];
        if (targetCursor) {
          setCurrentPage(currentP);
          setHasPrev(currentP > 1);
          setHasMore(false); // We're on the last page
          lastDocRef.current = targetCursor;
          fetchPage(targetCursor);
        } else {
          // Fallback: just go to the last known page
          setCurrentPage(currentP);
          setHasPrev(currentP > 1);
          setHasMore(false);
          if (cursorHistory.current.length > 0) {
            fetchPage(cursorHistory.current[cursorHistory.current.length - 1]);
          }
        }
      } catch (err) {
        console.error("Error navigating to last page:", err);
        setError(err instanceof Error ? err.message : "Failed to navigate to last page");
        setLoading(false);
      }
    },
    [currentPage, buildQuery, pageSize, fetchPage]
  );

  const refresh = useCallback(() => {
    const cursor = cursorHistory.current[cursorHistory.current.length - 1];
    fetchPage(cursor);
  }, [fetchPage]);

  return {
    data: issues,
    loading,
    error,
    hasMore,
    hasPrev,
    currentPage,
    nextPage,
    prevPage,
    goToPage,
    goToLastPage,
    refresh,
  };
}
