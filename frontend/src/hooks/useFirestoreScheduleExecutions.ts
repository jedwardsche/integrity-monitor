import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Timestamp, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  group_id: string;
  scheduled_for: Timestamp;
  started_at: Timestamp;
  status: "started" | "error";
  run_id?: string;
  error?: {
    message: string;
    code?: string;
  };
  run_config: {
    entities?: string[];
  };
}

const PAGE_SIZE = 10;

export function useFirestoreScheduleExecutions(
  scheduleId: string,
  pageSize: number = PAGE_SIZE
) {
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Store cursor history for pagination
  const cursorHistory = useRef<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const buildQuery = useCallback(
    (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
      const executionsRef = collection(db, "schedule_executions");
      const constraints: any[] = [
        where("schedule_id", "==", scheduleId),
        orderBy("started_at", "desc"),
      ];

      // Pagination cursor
      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      // Limit + 1 to check for more
      constraints.push(limit(pageSize + 1));

      return query(executionsRef, ...constraints);
    },
    [scheduleId, pageSize]
  );

  const fetchCount = useCallback(async () => {
    try {
      const countQuery = query(
        collection(db, "schedule_executions"),
        where("schedule_id", "==", scheduleId)
      );
      const snapshot = await getCountFromServer(countQuery);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.error("Error fetching execution count:", err);
      // Don't fail if count fails, just leave it null
    }
  }, [scheduleId]);

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
      setLoading(true);
      setError(null);

      try {
        const q = buildQuery(cursor);
        const snapshot = await getDocs(q);

        const transformed: ScheduleExecution[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ScheduleExecution[];

        // Check for more results
        const hasMoreResults = snapshot.docs.length > pageSize;
        setHasMore(hasMoreResults);

        // Trim to page size
        if (hasMoreResults) {
          transformed.splice(pageSize);
        }

        // Store last doc for next page
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[Math.min(snapshot.docs.length - 1, pageSize - 1)] as QueryDocumentSnapshot<DocumentData>;
        } else {
          lastDocRef.current = null;
        }

        setExecutions(transformed);
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
    [buildQuery, pageSize]
  );

  // Reset pagination when scheduleId changes
  useEffect(() => {
    cursorHistory.current = [null];
    setCurrentPage(1);
    setHasPrev(false);
    fetchCount();
    fetchPage(null);
  }, [scheduleId, fetchPage, fetchCount]);

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

  const totalPages = totalCount !== null ? Math.ceil(totalCount / pageSize) : null;

  return {
    data: executions,
    loading,
    error,
    hasMore,
    hasPrev,
    currentPage,
    nextPage,
    prevPage,
    goToPage,
    goToLastPage,
    totalCount,
    totalPages,
  };
}
