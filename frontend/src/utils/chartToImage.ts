import html2canvas from "html2canvas";

export interface ChartData {
  name: string;
  value: number;
  fill?: string;
}

// Convert computed color (rgb/rgba) to hex
function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (match && match.length >= 3) {
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
  }
  return "#000000";
}

// Convert CSS variables and oklch colors to hex by getting computed styles
function convertStylesToHex(element: HTMLElement): void {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  const elements: HTMLElement[] = [element];
  let node;
  while ((node = walker.nextNode())) {
    if (node instanceof HTMLElement) {
      elements.push(node);
    }
  }
  
  elements.forEach((el) => {
    const computed = window.getComputedStyle(el);
    
    // Convert color properties that might have oklch or CSS variables
    const colorProps = ["color", "backgroundColor", "borderColor"];
    colorProps.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (value && (value.includes("oklch") || value.includes("color-mix") || value.includes("var("))) {
        // Get the computed RGB value
        const rgb = computed.getPropertyValue(prop) || window.getComputedStyle(el)[prop as any];
        if (rgb && rgb.startsWith("rgb")) {
          const hex = rgbToHex(rgb);
          el.style.setProperty(prop, hex, "important");
        }
      }
    });
    
    // Handle SVG elements with fill/stroke
    if (el instanceof SVGElement) {
      const fill = el.getAttribute("fill");
      const stroke = el.getAttribute("stroke");
      
      if (fill && (fill.includes("var(") || fill.includes("oklch"))) {
        const computedFill = window.getComputedStyle(el).fill;
        if (computedFill && computedFill.startsWith("rgb")) {
          el.setAttribute("fill", rgbToHex(computedFill));
        }
      }
      
      if (stroke && (stroke.includes("var(") || stroke.includes("oklch"))) {
        const computedStroke = window.getComputedStyle(el).stroke;
        if (computedStroke && computedStroke.startsWith("rgb")) {
          el.setAttribute("stroke", rgbToHex(computedStroke));
        }
      }
    }
  });
}

// Convert all styles in cloned document to use hex colors
function convertClonedDocumentStyles(clonedDoc: Document, originalElement: HTMLElement): void {
  // Remove all stylesheets to prevent html2canvas from parsing oklch
  // This forces html2canvas to use only inline styles
  const styleSheets = Array.from(clonedDoc.querySelectorAll("style, link[rel='stylesheet']"));
  styleSheets.forEach((sheet) => {
    try {
      sheet.remove();
    } catch (e) {
      // Ignore errors
    }
  });
  
  // Also try to remove from head
  const headSheets = Array.from(clonedDoc.head.querySelectorAll("style, link[rel='stylesheet']"));
  headSheets.forEach((sheet) => {
    try {
      sheet.remove();
    } catch (e) {
      // Ignore errors
    }
  });
  
  // Create a mapping of original to cloned elements by walking both trees
  const originalElements: Element[] = [];
  const clonedElements: Element[] = [];
  
  const originalWalker = document.createTreeWalker(
    originalElement,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  const clonedWalker = clonedDoc.createTreeWalker(
    clonedDoc.body,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  let origNode;
  while ((origNode = originalWalker.nextNode())) {
    originalElements.push(origNode);
  }
  
  let cloneNode;
  while ((cloneNode = clonedWalker.nextNode())) {
    clonedElements.push(cloneNode);
  }
  
  // Convert each element's computed styles to inline hex
  clonedElements.forEach((clonedEl, index) => {
    const originalEl = originalElements[index] as HTMLElement;
    if (!originalEl) return;
    
    const computed = window.getComputedStyle(originalEl);
    
    if (clonedEl instanceof HTMLElement) {
      // Convert all color properties to hex
      const colorProps = [
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
      ];
      
      colorProps.forEach((prop) => {
        const value = computed.getPropertyValue(prop);
        if (value && value.startsWith("rgb")) {
          clonedEl.style.setProperty(prop, rgbToHex(value), "important");
        }
      });
      
      // Copy other important style properties to maintain layout
      const otherProps = [
        "borderWidth",
        "borderStyle",
        "padding",
        "margin",
        "fontSize",
        "fontFamily",
        "fontWeight",
        "display",
        "position",
        "width",
        "height",
      ];
      
      otherProps.forEach((prop) => {
        const value = computed.getPropertyValue(prop);
        if (value && value.trim() && value !== "auto") {
          clonedEl.style.setProperty(prop, value, "important");
        }
      });
    }
    
    // Handle SVG elements
    if (clonedEl instanceof SVGElement && originalEl instanceof SVGElement) {
      const fill = computed.fill || clonedEl.getAttribute("fill");
      const stroke = computed.stroke || clonedEl.getAttribute("stroke");
      
      if (fill) {
        if (fill.startsWith("rgb")) {
          clonedEl.setAttribute("fill", rgbToHex(fill));
        } else if (!fill.includes("oklch") && !fill.includes("var(") && !fill.includes("color-mix") && fill !== "none") {
          clonedEl.setAttribute("fill", fill);
        } else {
          // Fallback to a default color if we can't convert
          clonedEl.setAttribute("fill", "#000000");
        }
      }
      
      if (stroke) {
        if (stroke.startsWith("rgb")) {
          clonedEl.setAttribute("stroke", rgbToHex(stroke));
        } else if (!stroke.includes("oklch") && !stroke.includes("var(") && !stroke.includes("color-mix") && stroke !== "none") {
          clonedEl.setAttribute("stroke", stroke);
        } else {
          // Fallback to a default color if we can't convert
          clonedEl.setAttribute("stroke", "#000000");
        }
      }
    }
  });
}

export async function chartToImage(
  element: HTMLElement,
  options?: { width?: number; height?: number }
): Promise<string> {
  // Use html2canvas with onclone to modify the cloned document
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    width: options?.width,
    height: options?.height,
    logging: false,
    useCORS: true,
    allowTaint: false,
    onclone: (clonedDoc) => {
      // Convert all oklch colors to hex in the cloned document
      // Find the main element in the cloned doc (should be body's first child)
      const clonedElement = clonedDoc.body.firstElementChild as HTMLElement;
      if (clonedElement) {
        convertClonedDocumentStyles(clonedDoc, element);
      }
    },
  });

  return canvas.toDataURL("image/png");
}
