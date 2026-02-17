#!/bin/bash
# Photo Browser Deployment Script for Unraid
# Usage: ./deploy.sh [--reset-db]
#
# One-liner to download and run (initial clone):
#   curl -fsSL https://raw.githubusercontent.com/Stu1983/QuickPhotoDownload/main/deploy.sh -o /tmp/deploy-photo-browser.sh && bash /tmp/deploy-photo-browser.sh

set -e

REPO_URL="https://github.com/Stu1983/QuickPhotoDownload.git"
APP_DIR="/mnt/user/appdata/photo-browser"
CACHE_DIR="$APP_DIR/cache"
PHOTOS_DIR="/mnt/user/ftp"
CONTAINER_NAME="photo-browser"
IMAGE_NAME="photo-browser:local"
PORT="8580"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Photo Browser Deployment ===${NC}"

# Parse arguments
RESET_DB=false
for arg in "$@"; do
    if [ "$arg" == "--reset-db" ]; then
        RESET_DB=true
        echo -e "${YELLOW}Database will be reset after deployment${NC}"
    fi
done

# Clone the repo if it doesn't exist yet
if [ ! -d "$APP_DIR/.git" ]; then
    echo -e "${GREEN}First-time setup — cloning repository...${NC}"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone "$REPO_URL" "$APP_DIR"
fi

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
    rm -f "$CACHE_DIR/photobrowser.db" "$CACHE_DIR/photobrowser.db-shm" "$CACHE_DIR/photobrowser.db-wal"
    echo -e "${GREEN}Database files removed. Fresh database will be created on startup.${NC}"
fi

# Ensure directories exist
mkdir -p "$CACHE_DIR/thumbs"
mkdir -p "$CACHE_DIR/previews"
mkdir -p "$PHOTOS_DIR"

# Start new container
echo -e "${GREEN}Starting new container...${NC}"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:8080" \
  -v "$PHOTOS_DIR:/photos" \
  -v "$CACHE_DIR:/app/cache" \
  -e TZ=Europe/London \
  -e SCAN_INTERVAL_MINUTES=5 \
  -e THUMB_SIZE=400 \
  -e PREVIEW_SIZE=2000 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
IP_ADDR=$(hostname -I | awk '{print $1}')
echo -e "Photo Browser: ${GREEN}http://$IP_ADDR:$PORT${NC}"
echo ""
echo -e "${YELLOW}Volume mounts:${NC}"
echo -e "  Photos (FTP + sorted): ${GREEN}$PHOTOS_DIR${NC} → /photos"
echo -e "  Cache (thumbs, DB):    ${GREEN}$CACHE_DIR${NC} → /app/cache"
echo ""

# Show container status
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
