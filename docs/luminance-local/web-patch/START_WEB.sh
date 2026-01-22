#!/bin/bash

# Luminance Web - Optimized Startup Script for Low Resource Usage
# Reduces memory and CPU usage to prevent laptop crashes

# Configuration
WEB_DIR="$HOME/code/web"
CONFIG_FILE="$HOME/code/luminance-web-local-config.yaml"
GULP_LOG="/tmp/gulp.log"
WEB_LOG="/tmp/web-server.log"
LOCK_FILE="/tmp/luminance-web.lock"

# Function to check if a port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

# Function to kill process on a port
kill_port() {
    if check_port $1; then
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Function to cleanup all Gulp processes (including workers)
cleanup_gulp() {
    echo "Cleaning up Gulp processes..."
    # Kill npm wrapper processes first
    pkill -f "npm exec gulp" 2>/dev/null || true
    # Kill main gulp process
    pkill -f "gulp watch" 2>/dev/null || true
    # Kill all gulp worker processes (they run tasks like javascript.js, less.js)
    pkill -f "gulp/tasks/javascript.js" 2>/dev/null || true
    pkill -f "gulp/tasks/less.js" 2>/dev/null || true
    pkill -f "gulp/tasks/asset.js" 2>/dev/null || true
    # Kill any remaining node processes that match gulp patterns
    ps aux | grep -E "node.*gulp|gulp.*watch" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    # Clean up any zombie/uninterruptible processes
    ps aux | grep -E "gulp.*watch" | grep -E "UE|Z" | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check for lock file - prevent multiple instances
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
    if ps -p "$LOCK_PID" > /dev/null 2>&1; then
        echo "❌ Error: Another instance is already running (PID: $LOCK_PID)"
        echo "   If you're sure it's not running, delete: $LOCK_FILE"
        exit 1
    else
        # Stale lock file, remove it
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT INT TERM

# Start background services (Redis, PostgreSQL, Elasticsearch, Minio)
bash ~/code/START_EVERYTHING.sh > /dev/null 2>&1

# Clean up existing processes - be thorough
echo "Cleaning up existing processes..."
kill_port 42069
kill_port 4000
cleanup_gulp
pkill -f "nodemon.*web.js" 2>/dev/null || true
pkill -f "ts-node.*web.js" 2>/dev/null || true
pkill -f "node.*apps/web.js" 2>/dev/null || true
sleep 2

# Setup Node.js
export PATH="$HOME/.fnm:$PATH"
eval "$(fnm env)" 2>/dev/null

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    exit 1
fi

# Verify config
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Config file not found at $CONFIG_FILE"
    exit 1
fi

# Check for required dependencies
cd "$WEB_DIR"
if [ ! -d "node_modules" ] || [ ! -d "node_modules/uuid" ]; then
    echo ""
    echo "❌ Error: Missing dependencies!"
    echo ""
    echo "   Required package 'uuid' is not installed."
    echo "   Please run: cd ~/code/web && npm install"
    echo ""
    exit 1
fi

# Verify and fix database permissions silently (per schema/roles.sql)
# Use background process with sleep to prevent hanging if database is not ready
(PGPASSWORD='12345' psql -h localhost -p 5432 -U postgres -d luminance > /dev/null 2>&1 <<'SQL'
DO $$
BEGIN
    -- Ensure critical web views are owned by luminance_web
    PERFORM 1 FROM pg_views WHERE schemaname = 'web' AND viewname = 'users' AND viewowner = 'luminance_web';
    IF NOT FOUND THEN ALTER VIEW web.users OWNER TO luminance_web; END IF;
    
    PERFORM 1 FROM pg_views WHERE schemaname = 'web' AND viewname = 'rooms' AND viewowner = 'luminance_web';
    IF NOT FOUND THEN ALTER VIEW web.rooms OWNER TO luminance_web; END IF;
    
    PERFORM 1 FROM pg_views WHERE schemaname = 'web' AND viewname = 'documents' AND viewowner = 'luminance_web';
    IF NOT FOUND THEN ALTER VIEW web.documents OWNER TO luminance_web; END IF;
    
    PERFORM 1 FROM pg_views WHERE schemaname = 'web' AND viewname = 'sources' AND viewowner = 'luminance_web';
    IF NOT FOUND THEN ALTER VIEW web.sources OWNER TO luminance_web; END IF;
    
    -- Ensure all required schema permissions (per roles.sql)
    GRANT USAGE ON SCHEMA web TO luminance_web;
    GRANT SELECT ON ALL TABLES IN SCHEMA web TO luminance_web;
    GRANT USAGE ON SCHEMA statistics TO luminance_web;
    GRANT SELECT ON ALL TABLES IN SCHEMA statistics TO luminance_web;
    GRANT USAGE ON SCHEMA acl TO luminance_web;
    GRANT SELECT ON ALL TABLES IN SCHEMA acl TO luminance_web;
    GRANT USAGE ON SCHEMA events TO luminance_web;
    GRANT INSERT, UPDATE, SELECT ON ALL TABLES IN SCHEMA events TO luminance_web;
    GRANT USAGE ON SCHEMA analysis TO luminance_web;
    GRANT SELECT ON ALL TABLES IN SCHEMA analysis TO luminance_web;
    
    -- Grant default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA web GRANT SELECT ON TABLES TO luminance_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA statistics GRANT SELECT ON TABLES TO luminance_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA acl GRANT SELECT ON TABLES TO luminance_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA events GRANT INSERT, UPDATE, SELECT ON TABLES TO luminance_web;
    ALTER DEFAULT PRIVILEGES IN SCHEMA analysis GRANT SELECT ON TABLES TO luminance_web;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SQL
) &  # Run in background to not block

# Get port from config
WEB_PORT=$(grep -E "^port:" "$CONFIG_FILE" | awk '{print $2}' | tr -d "'\"")
WEB_PORT=${WEB_PORT:-4000}

# Start frontend (Gulp) with optimized settings for M3 MacBook Pro
# Using --concurrent creates worker processes - monitor them carefully
cd "$WEB_DIR"
# Limit Node.js memory to 3GB for Gulp process (M3 MacBook Pro can handle this)
# Use gulp directly to avoid the --hot-reload flag from package.json
# Note: --concurrent creates worker processes - they will be cleaned up on exit
echo "Starting Gulp (this may take a moment)..."
NODE_OPTIONS="--max-old-space-size=3072" npx gulp watch --sourcemaps --detailed --concurrent --skip-superfluous-tasks > "$GULP_LOG" 2>&1 &
GULP_PID=$!

# Verify Gulp started (don't wait too long)
sleep 3
if ! ps -p "$GULP_PID" > /dev/null 2>&1; then
    echo "❌ Error: Gulp failed to start. Check $GULP_LOG"
    rm -f "$LOCK_FILE"
    exit 1
fi
# Don't wait for build - let it happen in background
sleep 2

# Start backend (web server) with optimized memory for M3 MacBook Pro
cd "$WEB_DIR"
# Limit Node.js memory to 3GB for web server
NODE_OPTIONS="--max-old-space-size=3072" npm run web:noreload -- "$CONFIG_FILE" > "$WEB_LOG" 2>&1 &
WEB_PID=$!

# Wait for server to be ready (with timeout)
for i in {1..10}; do
    if check_port $WEB_PORT; then
        break
    fi
    if [ $i -eq 10 ]; then
        echo "⚠️  Server may still be starting (check $WEB_LOG if issues)"
        break
    fi
    sleep 2
done

# Display result
if check_port $WEB_PORT; then
    echo "✅ https://localhost:${WEB_PORT}"
    echo ""
    echo "💡 Resource optimizations enabled for local development"
    echo ""
    echo "📝 To stop: Run ./STOP_WEB.sh or press Ctrl+C"
    echo "📝 Lock file: $LOCK_FILE (prevents multiple instances)"
else
    echo "⚠️  Starting... (check logs if issues: tail -f $WEB_LOG)"
fi

# Keep script running and handle cleanup on exit
trap "echo ''; echo 'Cleaning up...'; cleanup_gulp; pkill -f 'node.*apps/web.js' 2>/dev/null || true; rm -f $LOCK_FILE; exit" INT TERM

# Don't wait - let processes run in background
# The script will exit but processes will continue running
# Use STOP_WEB.sh to stop them

