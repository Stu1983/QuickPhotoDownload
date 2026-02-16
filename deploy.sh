#!/bin/bash
# Docommenter Deployment Script for Unraid
# Usage: ./deploy.sh [--branch <branch-name>] [--reset-db]

set -e

APP_DIR="/mnt/user/appdata/docommenter"
DATA_DIR="$APP_DIR/data"
DOCS_DIR="$APP_DIR/documents"
CONTAINER_NAME="docommenter"
IMAGE_NAME="docommenter:local"
PORT="1971"
HTTPS_PORT="443"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Docommenter Deployment ===${NC}"

# Parse arguments
RESET_DB=false
for arg in "$@"; do
    if [ "$arg" == "--reset-db" ]; then
        RESET_DB=true
        echo -e "${YELLOW}Database will be reset after deployment${NC}"
    fi
done

# Navigate to app directory
cd "$APP_DIR"

# Fetch latest remote info and prune deleted branches
echo -e "${GREEN}Fetching branches...${NC}"
git fetch --all --prune --quiet 2>/dev/null || { echo -e "${RED}Warning: git fetch failed${NC}"; }

# Clean up local branches whose remote has been deleted
git branch -vv | grep ': gone]' | awk '{print $1}' | while read -r gone_branch; do
    git branch -d "$gone_branch" 2>/dev/null || true
done

# Build a list of available branches from the remote
BRANCHES=()
while IFS= read -r branch; do
    BRANCHES+=("$branch")
done < <(git branch -r --format='%(refname:short)' | sed 's|^origin/||' | grep -v '^HEAD$' | sort)

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Display branch selection menu
echo ""
echo -e "${GREEN}=== Branch Selection ===${NC}"
echo ""
for i in "${!BRANCHES[@]}"; do
    marker="  "
    if [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ]; then
        marker="* "
    fi
    printf "  %s%2d) %s\n" "$marker" "$((i + 1))" "${BRANCHES[$i]}"
done
echo ""
echo "  (* = currently checked out)"
echo ""

# Let user pick a branch by number, or auto-select current branch after 10 seconds
while true; do
    read -t 10 -p "Select a branch [1-${#BRANCHES[@]}] or press Enter for '$CURRENT_BRANCH' (auto-selects in 10s): " SELECTION || true

    # Default to current branch (on Enter or timeout)
    if [ -z "$SELECTION" ]; then
        BRANCH="$CURRENT_BRANCH"
        echo ""
        echo -e "${YELLOW}Defaulting to current branch: $CURRENT_BRANCH${NC}"
        break
    fi

    # Validate numeric input
    if [[ "$SELECTION" =~ ^[0-9]+$ ]] && [ "$SELECTION" -ge 1 ] && [ "$SELECTION" -le "${#BRANCHES[@]}" ]; then
        BRANCH="${BRANCHES[$((SELECTION - 1))]}"
        break
    else
        echo -e "${RED}Invalid selection. Enter a number between 1 and ${#BRANCHES[@]}.${NC}"
    fi
done

echo ""
echo -e "Selected branch: ${GREEN}$BRANCH${NC}"

# Switch branch if different from current
if [ "$BRANCH" != "$CURRENT_BRANCH" ]; then
    echo -e "${GREEN}Switching to branch: $BRANCH${NC}"
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" || { echo -e "${RED}ERROR: Could not checkout $BRANCH${NC}"; exit 1; }
fi

# Pull latest code
echo -e "${GREEN}Pulling latest from $BRANCH...${NC}"
git pull origin "$BRANCH"

# Build the Docker image (uses layer cache for faster rebuilds)
echo -e "${GREEN}Building Docker image...${NC}"
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_COMMIT_DATE=$(git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M')
docker build \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg GIT_COMMIT_DATE="$GIT_COMMIT_DATE" \
  -t "$IMAGE_NAME" .

# Stop and remove existing container (ignore errors if not running)
echo -e "${GREEN}Stopping existing container...${NC}"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Reset database if requested
if [ "$RESET_DB" == true ]; then
    echo -e "${YELLOW}Resetting database...${NC}"
    rm -f "$DATA_DIR/docommenter.db" "$DATA_DIR/docommenter.db-shm" "$DATA_DIR/docommenter.db-wal"
    echo -e "${GREEN}Database files removed. Fresh database will be created on startup.${NC}"
fi

# Ensure directories exist
mkdir -p "$DATA_DIR"
mkdir -p "$DOCS_DIR"

# Start new container
echo -e "${GREEN}Starting new container...${NC}"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:8080" \
  -p "$HTTPS_PORT:8443" \
  -v "$DATA_DIR:/app/data" \
  -v "$DOCS_DIR:/app/wwwroot/documents" \
  -e TZ=Europe/London \
  --restart unless-stopped \
  "$IMAGE_NAME"

# Export the self-signed cert so the user can install it on Windows
CERT_EXPORT_PATH="$APP_DIR/cert.pem"
docker cp "$CONTAINER_NAME:/etc/nginx/ssl/cert.pem" "$CERT_EXPORT_PATH" 2>/dev/null && \
  echo -e "${GREEN}SSL certificate exported to: ${YELLOW}$CERT_EXPORT_PATH${NC}" || \
  echo -e "${YELLOW}Could not export SSL cert (container may still be starting)${NC}"

echo -e "${GREEN}=== Deployment Complete ===${NC}"
IP_ADDR=$(hostname -I | awk '{print $1}')
echo -e "HTTP:  ${GREEN}http://$IP_ADDR:$PORT${NC}"
echo -e "HTTPS: ${GREEN}https://$IP_ADDR:$HTTPS_PORT${NC}  (for Office WebDAV editing)"
echo ""
echo -e "${YELLOW}To trust the HTTPS cert on Windows:${NC}"
echo -e "  1. Download: ${GREEN}\\\\$(hostname)\\appdata\\docommenter\\cert.pem${NC}"
echo -e "  2. Double-click → Install Certificate → Local Machine → Trusted Root CAs"

# Show container status
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
