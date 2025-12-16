import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

interface ReportPDFProps {
  run: RunHistoryItem;
  typeChartImage?: string;
  severityChartImage?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
    borderBottom: "2 solid #1f4f48",
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f4f48",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f4f48",
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryBox: {
    width: "30%",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f4f48",
  },
  statusBadge: {
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  statusHealthy: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusWarning: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  statusError: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  chartContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: "center",
  },
  chartImage: {
    maxWidth: "100%",
    height: "auto",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#999",
    borderTop: "1 solid #e5e5e5",
    paddingTop: 10,
  },
});

function getStatusStyle(status: string) {
  const statusLower = status.toLowerCase();
  if (statusLower === "healthy" || statusLower === "success") {
    return [styles.statusBadge, styles.statusHealthy];
  }
  if (statusLower === "warning") {
    return [styles.statusBadge, styles.statusWarning];
  }
  if (statusLower === "error") {
    return [styles.statusBadge, styles.statusError];
  }
  return [styles.statusBadge, styles.statusHealthy];
}

export function ReportPDF({
  run,
  typeChartImage,
  severityChartImage,
}: ReportPDFProps) {
  const runDate =
    run.started_at?.toDate?.() || run.ended_at?.toDate?.() || new Date();
  const formattedDate =
    runDate instanceof Date
      ? runDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Unknown";

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const byType = run.counts?.by_type || {};
  const bySeverity = run.counts?.by_severity || {};

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Integrity Scan Report</Text>
          <Text style={styles.subtitle}>Run ID: {run.run_id || run.id}</Text>
          <Text style={styles.subtitle}>Scan Date: {formattedDate}</Text>
          <Text style={styles.subtitle}>Generated: {generatedDate}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Status</Text>
              <View style={getStatusStyle(run.status)}>
                <Text>{run.status}</Text>
              </View>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Mode</Text>
              <Text style={styles.summaryValue}>
                {run.mode === "full" ? "Full Scan" : "Incremental"}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total Issues</Text>
              <Text style={styles.summaryValue}>
                {run.anomalies.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Trigger</Text>
              <Text style={styles.summaryValue}>
                {run.trigger === "manual"
                  ? "Manual"
                  : run.trigger === "nightly"
                  ? "Nightly"
                  : run.trigger === "weekly"
                  ? "Weekly"
                  : run.trigger}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{run.duration}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{run.time}</Text>
            </View>
          </View>
        </View>

        {typeChartImage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issues by Type</Text>
            <View style={styles.chartContainer}>
              <Image src={typeChartImage} style={styles.chartImage} />
            </View>
          </View>
        )}

        {severityChartImage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issues by Severity</Text>
            <View style={styles.chartContainer}>
              <Image src={severityChartImage} style={styles.chartImage} />
            </View>
          </View>
        )}

        {(!typeChartImage || !severityChartImage) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issue Breakdown</Text>
            <View style={{ marginTop: 10 }}>
              <Text
                style={{ fontSize: 11, marginBottom: 8, fontWeight: "bold" }}
              >
                By Type:
              </Text>
              {Object.entries(byType).map(([type, count]) => (
                <View
                  key={type}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, textTransform: "capitalize" }}>
                    {type.replace(/_/g, " ")}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: "bold" }}>
                    {count}
                  </Text>
                </View>
              ))}
              {Object.keys(byType).length === 0 && (
                <Text style={{ fontSize: 10, color: "#999" }}>
                  No type data available
                </Text>
              )}
            </View>
            <View style={{ marginTop: 15 }}>
              <Text
                style={{ fontSize: 11, marginBottom: 8, fontWeight: "bold" }}
              >
                By Severity:
              </Text>
              {Object.entries(bySeverity).map(([severity, count]) => (
                <View
                  key={severity}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, textTransform: "capitalize" }}>
                    {severity}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: "bold" }}>
                    {count}
                  </Text>
                </View>
              ))}
              {Object.keys(bySeverity).length === 0 && (
                <Text style={{ fontSize: 10, color: "#999" }}>
                  No severity data available
                </Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          Generated by Data Integrity Monitor • {generatedDate}
        </Text>
      </Page>
    </Document>
  );
}
