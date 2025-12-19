#!/bin/bash

#########################################
# Retrieve Deployed Code from Firebase Hosting
#
# This script downloads the deployed frontend code
# from Firebase Hosting to recover lost changes
#########################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID=${GCP_PROJECT_ID:-data-integrity-monitor}
DOWNLOAD_DIR="./firebase-deployed-code"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Firebase Deployment Recovery         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get the hosting site URL
echo -e "${BLUE}▶${NC} Getting Firebase Hosting site URL..."
SITE_URL=$(firebase hosting:sites:list --project "$PROJECT_ID" --json 2>/dev/null | grep -o '"defaultHosting":\s*"[^"]*"' | cut -d'"' -f4 || echo "data-integrity-monitor.web.app")

if [ -z "$SITE_URL" ]; then
    echo -e "${YELLOW}⚠${NC} Could not determine site URL, using default: data-integrity-monitor.web.app"
    SITE_URL="data-integrity-monitor.web.app"
fi

FULL_URL="https://${SITE_URL}"
echo -e "${GREEN}✓${NC} Site URL: ${FULL_URL}"
echo ""

# Create download directory
echo -e "${BLUE}▶${NC} Creating download directory..."
mkdir -p "$DOWNLOAD_DIR"
cd "$DOWNLOAD_DIR"

# Download main files
echo -e "${BLUE}▶${NC} Downloading deployed files..."
echo ""

# Download index.html
echo "Downloading index.html..."
curl -s -o index.html "${FULL_URL}/index.html" && echo -e "${GREEN}✓${NC} index.html downloaded" || echo -e "${RED}✗${NC} Failed to download index.html"

# Download main JavaScript bundle (usually assets/index-*.js)
echo "Downloading JavaScript bundles..."
curl -s "${FULL_URL}/index.html" | grep -oE 'src="[^"]*\.js[^"]*"' | sed 's/src="//;s/"$//' | while read -r js_file; do
    if [[ "$js_file" == /* ]]; then
        js_url="${FULL_URL}${js_file}"
    else
        js_url="${FULL_URL}/${js_file}"
    fi
    filename=$(basename "$js_file")
    echo "Downloading $filename..."
    curl -s -o "$filename" "$js_url" && echo -e "${GREEN}✓${NC} $filename downloaded" || echo -e "${RED}✗${NC} Failed to download $filename"
done

# Download CSS files
echo "Downloading CSS files..."
curl -s "${FULL_URL}/index.html" | grep -oE 'href="[^"]*\.css[^"]*"' | sed 's/href="//;s/"$//' | while read -r css_file; do
    if [[ "$css_file" == /* ]]; then
        css_url="${FULL_URL}${css_file}"
    else
        css_url="${FULL_URL}/${css_file}"
    fi
    filename=$(basename "$css_file")
    echo "Downloading $filename..."
    curl -s -o "$filename" "$css_url" && echo -e "${GREEN}✓${NC} $filename downloaded" || echo -e "${RED}✗${NC} Failed to download $filename"
done

# Download source maps if available
echo ""
echo -e "${BLUE}▶${NC} Checking for source maps..."
curl -s "${FULL_URL}/index.html" | grep -oE 'src="[^"]*\.js[^"]*"' | sed 's/src="//;s/"$//' | while read -r js_file; do
    if [[ "$js_file" == /* ]]; then
        map_url="${FULL_URL}${js_file}.map"
    else
        map_url="${FULL_URL}/${js_file}.map"
    fi
    filename=$(basename "$js_file").map
    echo "Checking for $filename..."
    if curl -s -f -o "$filename" "$map_url" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $filename found and downloaded"
    else
        echo -e "${YELLOW}⚠${NC} $filename not found (this is normal if source maps weren't deployed)"
    fi
done

cd ..

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Download Complete!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} Files downloaded to: ${BLUE}${DOWNLOAD_DIR}${NC}"
echo ""
echo "Next steps:"
echo "  1. Check the JavaScript bundles for your code"
echo "  2. If source maps exist, use them to map back to source files"
echo "  3. Search the bundles for keywords like 'SchedulingPage', 'IssuesPage', 'useIssueCounts'"
echo "  4. Extract the relevant code sections"
echo ""
echo "To search for specific code:"
echo "  grep -r 'SchedulingPage' ${DOWNLOAD_DIR}/"
echo "  grep -r 'IssuesPage' ${DOWNLOAD_DIR}/"
echo "  grep -r 'useIssueCounts' ${DOWNLOAD_DIR}/"
