import { useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp, deleteField } from "firebase/firestore";
import { useFirestoreScheduleGroups } from "../hooks/useFirestoreScheduleGroups";
import { useFirestoreSchedules } from "../hooks/useFirestoreSchedules";
import { useFirestoreScheduleExecutions } from "../hooks/useFirestoreScheduleExecutions";
import { useAuth } from "../hooks/useAuth";
import { useRunStatus } from "../hooks/useRunStatus";
import ConfirmModal from "../components/ConfirmModal";

const ENTITY_TABLE_MAPPING: Record<string, string> = {
  students: "Students",
  parents: "Parents",
  contractors: "Contractors/Volunteers",
  classes: "Classes",
  attendance: "Attendance",
  truth: "Truth",
  payments: "Contractor/Vendor Invoices",
  data_issues: "Help Tickets",
};

const TIMEZONES = [
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "UTC", label: "UTC" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function computeNextRunAt(
  frequency: "daily" | "weekly",
  timeOfDay: string,
  timezone: string,
  daysOfWeek?: number[]
): Timestamp {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const now = new Date();

  // Get today's date in target timezone (accounts for DST automatically)
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const today: Record<string, string> = {};
  todayParts.forEach((part) => {
    today[part.type] = part.value;
  });

  const year = parseInt(today.year);
  const month = parseInt(today.month) - 1; // 0-indexed
  const day = parseInt(today.day);

  // Create a date string for "today at HH:mm" in the target timezone
  // Format: "YYYY-MM-DDTHH:mm:ss" - we'll use this to create a date
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:00`;

  // To convert a time in a specific timezone to UTC, we need to:
  // 1. Get what "now" is in the target timezone
  // 2. Calculate the offset
  // 3. Apply that offset to our target time

  // Get current time in target timezone
  const nowTzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const nowTz: Record<string, string> = {};
  nowTzParts.forEach((part) => {
    nowTz[part.type] = part.value;
  });

  // Create a local Date representing "now" in target timezone
  const nowTzLocal = new Date(
    parseInt(nowTz.year),
    parseInt(nowTz.month) - 1,
    parseInt(nowTz.day),
    parseInt(nowTz.hour),
    parseInt(nowTz.minute),
    parseInt(nowTz.second)
  );

  // Calculate offset: difference between UTC "now" and TZ "now" as local
  // This offset accounts for both timezone and DST
  const offset = now.getTime() - nowTzLocal.getTime();

  // Create local date for target time today
  const targetTzLocal = new Date(year, month, day, hours, minutes, 0);

  // Convert to UTC by adding the offset
  let nextRun = new Date(targetTzLocal.getTime() + offset);

  if (frequency === "daily") {
    // Check if the calculated time has already passed
    if (nextRun <= now) {
      // Time has passed - schedule for tomorrow
      nextRun = new Date(nextRun.getTime() + 24 * 60 * 60 * 1000);
    }
    // Note: The Cloud Function will recompute next_run_at correctly using luxon
    // This frontend calculation is just an initial estimate
  } else if (frequency === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    const tzDayName = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(now);
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const currentDay = dayMap[tzDayName] ?? 0;
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
    let nextDay = sortedDays.find((d) => d > currentDay);

    if (!nextDay) {
      nextDay = sortedDays[0];
      const daysToAdd = 7 - currentDay + nextDay;
      nextRun = new Date(nextRun.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } else {
      const daysToAdd = nextDay - currentDay;
      nextRun = new Date(nextRun.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    if (nextRun <= now && nextDay === currentDay) {
      nextRun = new Date(nextRun.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  return Timestamp.fromDate(nextRun);
}

export function SchedulingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: groups,
    loading: groupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
  } = useFirestoreScheduleGroups();
  const {
    data: schedules,
    loading: schedulesLoading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useFirestoreSchedules();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(
    null
  );

  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [scheduleForm, setScheduleForm] = useState({
    group_id: "",
    name: "",
    enabled: true,
    timezone: "America/Denver",
    frequency: "daily" as "daily" | "weekly",
    time_of_day: "14:00",
    days_of_week: [] as number[],
    mode: "incremental" as "incremental" | "full",
    entities: [] as string[],
  });

  const filteredSchedules = useMemo(() => {
    if (!selectedGroupId) return schedules;
    return schedules.filter((s) => s.group_id === selectedGroupId);
  }, [schedules, selectedGroupId]);

  const handleCreateGroup = async () => {
    try {
      await createGroup(groupForm.name, groupForm.description);
      setShowGroupModal(false);
      setGroupForm({ name: "", description: "" });
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Failed to create group");
    }
  };

  const handleUpdateGroup = async (groupId: string) => {
    try {
      await updateGroup(groupId, {
        name: groupForm.name,
        description: groupForm.description,
      });
      setEditingGroup(null);
      setGroupForm({ name: "", description: "" });
    } catch (error) {
      console.error("Failed to update group:", error);
      alert("Failed to update group");
    }
  };

  const handleCreateSchedule = async () => {
    try {
      const nextRunAt = computeNextRunAt(
        scheduleForm.frequency,
        scheduleForm.time_of_day,
        scheduleForm.timezone,
        scheduleForm.frequency === "weekly"
          ? scheduleForm.days_of_week
          : undefined
      );

      const scheduleData: any = {
        group_id: scheduleForm.group_id,
        name: scheduleForm.name,
        enabled: scheduleForm.enabled,
        timezone: scheduleForm.timezone,
        frequency: scheduleForm.frequency,
        time_of_day: scheduleForm.time_of_day,
        run_config: {
          mode: scheduleForm.mode,
        },
        next_run_at: nextRunAt,
      };

      // Only include days_of_week if frequency is weekly
      if (scheduleForm.frequency === "weekly") {
        scheduleData.days_of_week = scheduleForm.days_of_week;
      }

      // Only include entities if any are selected
      if (scheduleForm.entities.length > 0) {
        scheduleData.run_config.entities = scheduleForm.entities;
      }

      await createSchedule(scheduleData);

      setShowScheduleModal(false);
      setScheduleForm({
        group_id: "",
        name: "",
        enabled: true,
        timezone: "America/Denver",
        frequency: "daily",
        time_of_day: "14:00",
        days_of_week: [],
        mode: "incremental",
        entities: [],
      });
    } catch (error) {
      console.error("Failed to create schedule:", error);
      alert("Failed to create schedule");
    }
  };

  const handleUpdateSchedule = async (scheduleId: string) => {
    try {
      const schedule = schedules.find((s) => s.id === scheduleId);
      if (!schedule) return;

      const nextRunAt = computeNextRunAt(
        scheduleForm.frequency,
        scheduleForm.time_of_day,
        scheduleForm.timezone,
        scheduleForm.frequency === "weekly"
          ? scheduleForm.days_of_week
          : undefined
      );

      const updateData: any = {
        name: scheduleForm.name,
        enabled: scheduleForm.enabled,
        timezone: scheduleForm.timezone,
        frequency: scheduleForm.frequency,
        time_of_day: scheduleForm.time_of_day,
        run_config: {
          mode: scheduleForm.mode,
        },
        next_run_at: nextRunAt,
      };

      // Only include days_of_week if frequency is weekly
      if (scheduleForm.frequency === "weekly") {
        updateData.days_of_week = scheduleForm.days_of_week;
      } else {
        // For daily schedules, remove the field if it exists
        updateData.days_of_week = deleteField();
      }

      // Only include entities if any are selected
      if (scheduleForm.entities.length > 0) {
        updateData.run_config.entities = scheduleForm.entities;
      }

      await updateSchedule(scheduleId, updateData);

      setEditingSchedule(null);
      setScheduleForm({
        group_id: "",
        name: "",
        enabled: true,
        timezone: "America/Denver",
        frequency: "daily",
        time_of_day: "14:00",
        days_of_week: [],
        mode: "incremental",
        entities: [],
      });
    } catch (error) {
      console.error("Failed to update schedule:", error);
      alert("Failed to update schedule");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
      setDeletingGroupId(null);
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
    } catch (error) {
      console.error("Failed to delete group:", error);
      alert("Failed to delete group");
      setDeletingGroupId(null);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      setDeletingScheduleId(null);
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      alert("Failed to delete schedule");
      setDeletingScheduleId(null);
    }
  };

  const openEditGroup = (group: (typeof groups)[0]) => {
    setEditingGroup(group.id);
    setGroupForm({ name: group.name, description: group.description || "" });
    setShowGroupModal(true);
  };

  const openEditSchedule = (schedule: (typeof schedules)[0]) => {
    setEditingSchedule(schedule.id);
    // Convert old Los Angeles timezone to Denver if needed
    const timezone =
      schedule.timezone === "America/Los_Angeles"
        ? "America/Denver"
        : schedule.timezone;
    setScheduleForm({
      group_id: schedule.group_id,
      name: schedule.name,
      enabled: schedule.enabled,
      timezone: timezone,
      frequency: schedule.frequency,
      time_of_day: schedule.time_of_day,
      days_of_week: schedule.days_of_week || [],
      mode: schedule.run_config.mode,
      entities: schedule.run_config.entities || [],
    });
    setShowScheduleModal(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1
          className="text-3xl font-semibold text-[var(--text-main)]"
          style={{ fontFamily: "Outfit" }}
        >
          Scheduling
        </h1>
      </div>

      {/* Schedule Groups Section */}
      <section className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--text-main)]">
            Schedule Groups
          </h2>
          <button
            onClick={() => {
              setEditingGroup(null);
              setGroupForm({ name: "", description: "" });
              setShowGroupModal(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] hover:bg-[var(--brand)]/90 rounded-lg transition-colors"
          >
            Create Group
          </button>
        </div>

        {groupsLoading ? (
          <div className="text-[var(--text-muted)] py-4">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-[var(--text-muted)] py-4">
            No schedule groups yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-mid)]/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-main)]">
                    {group.name}
                    {!group.enabled && (
                      <span className="ml-2 text-sm text-[var(--text-muted)]">
                        (disabled)
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <div className="text-sm text-[var(--text-muted)] mt-1">
                      {group.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditGroup(group)}
                    className="px-3 py-1.5 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingGroupId(group.id)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schedules Section */}
      <section className="bg-white border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--text-main)]">
            Schedules
          </h2>
          <div className="flex gap-3">
            <select
              value={selectedGroupId || ""}
              onChange={(e) => setSelectedGroupId(e.target.value || null)}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
            >
              <option value="">All Groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (groups.length === 0) {
                  alert("Please create a schedule group first");
                  return;
                }
                setEditingSchedule(null);
                setScheduleForm({
                  group_id: groups[0].id,
                  name: "",
                  enabled: true,
                  timezone: "America/Denver",
                  frequency: "daily",
                  time_of_day: "14:00",
                  days_of_week: [],
                  mode: "incremental",
                  entities: [],
                });
                setShowScheduleModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] hover:bg-[var(--brand)]/90 rounded-lg transition-colors"
            >
              Create Schedule
            </button>
          </div>
        </div>

        {schedulesLoading ? (
          <div className="text-[var(--text-muted)] py-4">
            Loading schedules...
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-[var(--text-muted)] py-4">
            No schedules found. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Frequency
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Next Run
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Run Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-main)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => (
                  <Fragment key={schedule.id}>
                    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-mid)]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--text-main)]">
                          {schedule.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {groups.find((g) => g.id === schedule.group_id)
                            ?.name || "Unknown Group"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            schedule.enabled
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {schedule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-main)]">
                        {schedule.frequency === "daily"
                          ? "Daily"
                          : schedule.days_of_week
                          ? schedule.days_of_week
                              .map((d) => DAYS_OF_WEEK[d].label.slice(0, 3))
                              .join(", ")
                          : "Weekly"}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-main)]">
                        {schedule.next_run_at
                          ? (() => {
                              // Use the Firebase value directly - convert Timestamp to Date
                              const nextRunDate = schedule.next_run_at.toDate();
                              // Display in the schedule's configured timezone
                              // If timezone is incorrectly stored as Los Angeles, use Denver instead
                              const displayTimezone =
                                schedule.timezone === "America/Los_Angeles"
                                  ? "America/Denver"
                                  : schedule.timezone;
                              return nextRunDate.toLocaleString("en-US", {
                                timeZone: displayTimezone,
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                                timeZoneName: "short",
                              });
                            })()
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-main)]">
                        <div>
                          {schedule.run_config.mode === "full"
                            ? "Full Scan"
                            : "Incremental"}
                        </div>
                        {schedule.run_config.entities &&
                          schedule.run_config.entities.length > 0 && (
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              {schedule.run_config.entities.length} entity
                              {schedule.run_config.entities.length !== 1
                                ? "ies"
                                : "y"}
                            </div>
                          )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditSchedule(schedule)}
                            className="px-3 py-1.5 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/5 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              updateSchedule(schedule.id, {
                                enabled: !schedule.enabled,
                              })
                            }
                            className="px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
                          >
                            {schedule.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => setDeletingScheduleId(schedule.id)}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() =>
                              setExpandedSchedule(
                                expandedSchedule === schedule.id
                                  ? null
                                  : schedule.id
                              )
                            }
                            className="px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
                          >
                            {expandedSchedule === schedule.id ? "Hide" : "View"}{" "}
                            Executions
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedSchedule === schedule.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4">
                          <ScheduleExecutions scheduleId={schedule.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create/Edit Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setShowGroupModal(false);
              setEditingGroup(null);
              setGroupForm({ name: "", description: "" });
            }}
            aria-hidden="true"
          />
          <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md transform transition-all p-6">
            <h3 className="text-xl font-semibold text-[var(--text-main)] mb-4">
              {editingGroup ? "Edit Group" : "Create Schedule Group"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
                  placeholder="e.g., Nightly Scans"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
                  rows={3}
                  placeholder="Optional description for this group"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroup(null);
                  setGroupForm({ name: "", description: "" });
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-mid)]/50 hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  editingGroup
                    ? handleUpdateGroup(editingGroup)
                    : handleCreateGroup()
                }
                disabled={!groupForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-[var(--brand)] hover:bg-[var(--brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingGroup ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Schedule Modal */}
      {showScheduleModal && (
        <CreateScheduleModal
          isOpen={showScheduleModal}
          groups={groups}
          form={scheduleForm}
          setForm={setScheduleForm}
          onConfirm={() =>
            editingSchedule
              ? handleUpdateSchedule(editingSchedule)
              : handleCreateSchedule()
          }
          onCancel={() => {
            setShowScheduleModal(false);
            setEditingSchedule(null);
            setScheduleForm({
              group_id: "",
              name: "",
              enabled: true,
              timezone: "America/Denver",
              frequency: "daily",
              time_of_day: "14:00",
              days_of_week: [],
              mode: "incremental",
              entities: [],
            });
          }}
          isEditing={!!editingSchedule}
        />
      )}

      {/* Delete Confirmations */}
      {deletingGroupId && (
        <ConfirmModal
          isOpen={!!deletingGroupId}
          title="Delete Schedule Group"
          message="Are you sure you want to delete this schedule group? This will not delete the schedules in the group, but they will be orphaned."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDestructive
          onConfirm={() => handleDeleteGroup(deletingGroupId)}
          onCancel={() => setDeletingGroupId(null)}
        />
      )}

      {deletingScheduleId && (
        <ConfirmModal
          isOpen={!!deletingScheduleId}
          title="Delete Schedule"
          message="Are you sure you want to delete this schedule? This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDestructive
          onConfirm={() => handleDeleteSchedule(deletingScheduleId)}
          onCancel={() => setDeletingScheduleId(null)}
        />
      )}
    </div>
  );
}

function ScheduleExecutions({ scheduleId }: { scheduleId: string }) {
  const { data: executions, loading } =
    useFirestoreScheduleExecutions(scheduleId);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="text-[var(--text-muted)] py-2">Loading executions...</div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-[var(--text-muted)] py-2">
        No executions yet. This schedule hasn't run.
      </div>
    );
  }

  return (
    <div className="mt-2">
      <h4 className="text-sm font-semibold text-[var(--text-main)] mb-2">
        Recent Executions
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)]">
                Started
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)]">
                Status
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {executions.map((exec) => (
              <ExecutionRow
                key={exec.id}
                execution={exec}
                navigate={navigate}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecutionRow({
  execution,
  navigate,
}: {
  execution: ReturnType<typeof useFirestoreScheduleExecutions>["data"][0];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { runStatus, loading: runStatusLoading } = useRunStatus(
    execution.run_id || null
  );

  // Determine display status - directly reflect the run status
  let displayStatus: string;
  let statusColor: string;

  if (execution.status === "error" || execution.error) {
    displayStatus = "Error";
    statusColor = "text-red-600";
  } else if (runStatusLoading && execution.run_id) {
    displayStatus = "Loading...";
    statusColor = "text-[var(--text-muted)]";
  } else if (runStatus) {
    // Use the actual run status from the integrity run
    // Map "success" to "Healthy" since success means completed with no issues
    const actualStatus =
      runStatus.status === "success" ? "healthy" : runStatus.status;

    // Display the status with proper capitalization
    displayStatus =
      actualStatus.charAt(0).toUpperCase() + actualStatus.slice(1);

    // Color based on status - these are the health statuses when run completes
    if (actualStatus === "running") {
      statusColor = "text-blue-600";
    } else if (actualStatus === "healthy") {
      statusColor = "text-green-600";
    } else if (actualStatus === "warning") {
      statusColor = "text-yellow-600";
    } else if (
      actualStatus === "critical" ||
      actualStatus === "failed" ||
      actualStatus === "error"
    ) {
      statusColor = "text-red-600";
    } else if (actualStatus === "cancelled") {
      statusColor = "text-gray-600";
    } else {
      statusColor = "text-[var(--text-muted)]";
    }
  } else if (execution.status === "started") {
    displayStatus = "Started";
    statusColor = "text-blue-600";
  } else {
    displayStatus = "Unknown";
    statusColor = "text-[var(--text-muted)]";
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-mid)]/30">
      <td className="py-2 px-3 text-[var(--text-main)]">
        {execution.started_at.toDate().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <span className={statusColor}>{displayStatus}</span>
          {execution.error && (
            <span
              className="text-xs text-red-600"
              title={execution.error.message}
            >
              (
              {execution.error.message.length > 30
                ? execution.error.message.substring(0, 30) + "..."
                : execution.error.message}
              )
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        {execution.run_id ? (
          <button
            onClick={() => navigate(`/run/${execution.run_id}`)}
            className="text-[var(--brand)] hover:underline text-sm"
          >
            View Run
          </button>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

function CreateScheduleModal({
  isOpen,
  groups,
  form,
  setForm,
  onConfirm,
  onCancel,
  isEditing,
}: {
  isOpen: boolean;
  groups: ReturnType<typeof useFirestoreScheduleGroups>["data"];
  form: {
    group_id: string;
    name: string;
    enabled: boolean;
    timezone: string;
    frequency: "daily" | "weekly";
    time_of_day: string;
    days_of_week: number[];
    mode: "incremental" | "full";
    entities: string[];
  };
  setForm: (form: typeof form) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    new Set(form.entities)
  );

  if (!isOpen) return null;

  const handleEntityToggle = (entity: string) => {
    const next = new Set(selectedEntities);
    if (next.has(entity)) {
      next.delete(entity);
    } else {
      next.add(entity);
    }
    setSelectedEntities(next);
    setForm({ ...form, entities: Array.from(next) });
  };

  const handleSelectAllEntities = () => {
    const allEntities = Object.keys(ENTITY_TABLE_MAPPING);
    if (selectedEntities.size === allEntities.length) {
      setSelectedEntities(new Set());
      setForm({ ...form, entities: [] });
    } else {
      setSelectedEntities(new Set(allEntities));
      setForm({ ...form, entities: allEntities });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-4xl transform transition-all p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-[var(--text-main)] mb-4">
          {isEditing ? "Edit Schedule" : "Create Schedule"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Group
              </label>
              <select
                value={form.group_id}
                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
                required
              >
                <option value="">Select a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
                placeholder="e.g., Nightly Incremental Scan"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-[var(--text-main)]">
                  Enabled
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Frequency
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
                  <input
                    type="radio"
                    name="frequency"
                    value="daily"
                    checked={form.frequency === "daily"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        frequency: e.target.value as "daily",
                        days_of_week: [],
                      })
                    }
                    className="mr-3"
                  />
                  <span className="text-sm text-[var(--text-main)]">Daily</span>
                </label>
                <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
                  <input
                    type="radio"
                    name="frequency"
                    value="weekly"
                    checked={form.frequency === "weekly"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        frequency: e.target.value as "weekly",
                      })
                    }
                    className="mr-3"
                  />
                  <span className="text-sm text-[var(--text-main)]">
                    Weekly
                  </span>
                </label>
              </div>
            </div>

            {form.frequency === "weekly" && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                  Days of Week
                </label>
                <div className="space-y-2 border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-y-auto">
                  {DAYS_OF_WEEK.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-mid)]/50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={form.days_of_week.includes(day.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.days_of_week, day.value]
                            : form.days_of_week.filter((d) => d !== day.value);
                          setForm({ ...form, days_of_week: next });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[var(--text-main)]">
                        {day.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Time of Day
              </label>
              <input
                type="time"
                value={form.time_of_day}
                onChange={(e) =>
                  setForm({ ...form, time_of_day: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Timezone
              </label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text-main)]"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                Run Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
                  <input
                    type="radio"
                    name="mode"
                    value="incremental"
                    checked={form.mode === "incremental"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mode: e.target.value as "incremental",
                      })
                    }
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-[var(--text-main)]">
                      Incremental
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Only scan records modified since last run
                    </div>
                  </div>
                </label>
                <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
                  <input
                    type="radio"
                    name="mode"
                    value="full"
                    checked={form.mode === "full"}
                    onChange={(e) =>
                      setForm({ ...form, mode: e.target.value as "full" })
                    }
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-[var(--text-main)]">
                      Full
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Scan all records regardless of modification time
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Entities ({selectedEntities.size} of{" "}
                  {Object.keys(ENTITY_TABLE_MAPPING).length})
                </label>
                <button
                  onClick={handleSelectAllEntities}
                  className="text-sm text-[var(--brand)] hover:underline"
                  type="button"
                >
                  {selectedEntities.size ===
                  Object.keys(ENTITY_TABLE_MAPPING).length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 border border-[var(--border)] rounded-lg p-3">
                {Object.entries(ENTITY_TABLE_MAPPING).map(([entity, table]) => (
                  <label
                    key={entity}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-mid)]/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntities.has(entity)}
                      onChange={() => handleEntityToggle(entity)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[var(--text-main)]">
                        {table}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {entity}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Leave empty to scan all entities
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-mid)]/50 hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={
              !form.group_id ||
              !form.name.trim() ||
              (form.frequency === "weekly" && form.days_of_week.length === 0)
            }
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-[var(--brand)] hover:bg-[var(--brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
