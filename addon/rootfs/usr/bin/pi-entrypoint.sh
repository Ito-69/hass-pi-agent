#!/usr/bin/env bash
# ==============================================================================
# Pi Agent Add-on: Pi entrypoint
# Launches pi inside tmux, spawned by ttyd.
# ==============================================================================
set -e

# Source environment (written by init-pi)
if [[ -f /etc/profile.d/pi-agent.sh ]]; then
    # shellcheck source=/dev/null
    source /etc/profile.d/pi-agent.sh
fi

# Build pi args
declare -a PI_ARGS=()

# Load HA extension from container image
PI_ARGS+=(--extension /opt/ha-extension)

# pi requires --model whenever --provider is given, so only pass --provider
# together with a model. With no model, pi uses its saved/default model.
if [[ -n "${PI_DEFAULT_MODEL:-}" ]]; then
    if [[ -n "${PI_DEFAULT_PROVIDER:-}" ]]; then
        PI_ARGS+=(--provider "${PI_DEFAULT_PROVIDER}")
    fi
    PI_ARGS+=(--model "${PI_DEFAULT_MODEL}")
fi

# Continue previous session if available (skip when PI_FRESH_SESSION=true)
if [[ "${PI_FRESH_SESSION:-}" != "true" ]]; then
    PI_ARGS+=(--continue)
fi

echo "Starting Pi Agent..."
echo "Working directory: $(pwd)"
echo ""

exec pi "${PI_ARGS[@]}"
