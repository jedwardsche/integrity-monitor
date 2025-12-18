import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "./useAuth";

export interface ScheduleGroup {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  updated_by: string;
}

export function useFirestoreScheduleGroups() {
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const groupsRef = collection(db, "schedule_groups");
    const q = query(groupsRef, orderBy("created_at", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const transformed: ScheduleGroup[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ScheduleGroup[];
          setGroups(transformed);
          setLoading(false);
          setError(null);
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Failed to process groups";
          console.error("Error processing schedule groups:", errorMsg, err);
          setError(errorMsg);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firestore subscription error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const createGroup = async (name: string, description?: string) => {
    if (!user) throw new Error("User not authenticated");

    const now = Timestamp.now();
    const groupData = {
      name,
      description: description || "",
      enabled: true,
      created_at: now,
      updated_at: now,
      created_by: user.uid,
      updated_by: user.uid,
    };

    const docRef = await addDoc(collection(db, "schedule_groups"), groupData);
    return docRef.id;
  };

  const updateGroup = async (
    groupId: string,
    updates: Partial<Pick<ScheduleGroup, "name" | "description" | "enabled">>
  ) => {
    if (!user) throw new Error("User not authenticated");

    const groupRef = doc(db, "schedule_groups", groupId);
    await updateDoc(groupRef, {
      ...updates,
      updated_at: Timestamp.now(),
      updated_by: user.uid,
    });
  };

  const deleteGroup = async (groupId: string) => {
    const groupRef = doc(db, "schedule_groups", groupId);
    await deleteDoc(groupRef);
  };

  return {
    data: groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
  };
}
