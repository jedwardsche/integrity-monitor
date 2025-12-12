/**
 * Utility functions for downloading files (JSON, CSV, ZIP)
 */
import JSZip from "jszip";

export function downloadJson(data: object, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(data: any[], filename: string): void {
  if (data.length === 0) {
    throw new Error("Cannot download empty CSV");
  }

  // Check if this is Airtable record format (has 'fields' property)
  const isAirtableFormat = data.some(
    (record) => record.fields && typeof record.fields === "object"
  );

  if (isAirtableFormat) {
    const flattened = flattenAirtableRecords(data);
    const fields = Object.keys(flattened[0]);
    const csvContent = convertToCsv(flattened, fields);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Original behavior for non-Airtable data
    const fields = Object.keys(data[0]);
    const csvContent = convertToCsv(data, fields);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function flattenAirtableRecords(records: any[]): any[] {
  // Collect all field names from all records to ensure complete column list
  const allFieldNames = new Set<string>();
  records.forEach((record) => {
    if (record.fields && typeof record.fields === "object") {
      Object.keys(record.fields).forEach((fieldName) => {
        allFieldNames.add(fieldName);
      });
    }
  });

  // Create ordered field list: id, createdTime, then all field names alphabetically
  const fieldNames = Array.from(allFieldNames).sort();
  const orderedFields = ["id", "createdTime", ...fieldNames];

  // Flatten each record
  return records.map((record) => {
    const flattened: any = {
      id: record.id || "",
      createdTime: record.createdTime || "",
    };

    // Add all fields, using empty string for missing fields
    fieldNames.forEach((fieldName) => {
      flattened[fieldName] = record.fields?.[fieldName] ?? "";
    });

    return flattened;
  });
}

export function convertToCsv(records: any[], fields: string[]): string {
  const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    // Handle arrays (multiple select, linked records, attachments, etc.)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "";
      }
      // Check if it's an array of objects (linked records, attachments)
      if (typeof value[0] === "object" && value[0] !== null) {
        // For linked records: extract IDs or names
        // For attachments: extract URLs or filenames
        const items = value.map((item) => {
          if (item.url) return item.url; // Attachment URL
          if (item.filename) return item.filename; // Attachment filename
          if (item.id) return item.id; // Linked record ID
          if (item.name) return item.name; // Linked record name
          return JSON.stringify(item);
        });
        return items.join("; ");
      }
      // Array of primitives (multiple select, etc.)
      return value.map((item) => escapeCsvValue(item)).join("; ");
    }

    // Handle objects
    if (typeof value === "object") {
      // Airtable attachment object
      if (value.url) {
        return value.url;
      }
      if (value.filename) {
        return value.filename;
      }
      // Linked record object
      if (value.id) {
        return value.id;
      }
      if (value.name) {
        return value.name;
      }
      // Date/time objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Fallback: stringify complex objects
      return JSON.stringify(value);
    }

    // Handle primitives
    const str = String(value);

    // Escape CSV special characters
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  const header = fields.map((f) => escapeCsvValue(f)).join(",");
  const rows = records.map((record) =>
    fields.map((field) => escapeCsvValue(record[field])).join(",")
  );

  return [header, ...rows].join("\n");
}

export function dataToJsonString(data: object): string {
  return JSON.stringify(data, null, 2);
}

export function dataToCsvString(data: any[]): string {
  if (data.length === 0) {
    return "";
  }

  // Check if this is Airtable record format (has 'fields' property)
  const isAirtableFormat = data.some(
    (record) => record.fields && typeof record.fields === "object"
  );

  if (isAirtableFormat) {
    const flattened = flattenAirtableRecords(data);
    const fields = Object.keys(flattened[0]);
    return convertToCsv(flattened, fields);
  } else {
    // Original behavior for non-Airtable data
    const fields = Object.keys(data[0]);
    return convertToCsv(data, fields);
  }
}

export interface ZipFile {
  name: string;
  content: string | Blob;
  type: "json" | "csv";
}

export async function createZipFile(
  files: ZipFile[],
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();

  // Organize files in ZIP structure
  const dataFolder = zip.folder("data");

  for (const file of files) {
    const filename = file.name.endsWith(`.${file.type}`)
      ? file.name
      : `${file.name}.${file.type}`;

    if (file.type === "csv" && dataFolder) {
      // Put CSV files in data/ folder
      dataFolder.file(filename, file.content);
    } else {
      // Put JSON files in root
      zip.file(filename, file.content);
    }
  }

  // Generate ZIP file
  const blob = await zip.generateAsync({ type: "blob" });

  // Download the ZIP
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFilename.endsWith(".zip") ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
