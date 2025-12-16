import html2canvas from "html2canvas";

export interface ChartData {
  name: string;
  value: number;
  fill?: string;
}

export async function chartToImage(
  element: HTMLElement,
  options?: { width?: number; height?: number }
): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    width: options?.width,
    height: options?.height,
    logging: false,
  });

  return canvas.toDataURL("image/png");
}
