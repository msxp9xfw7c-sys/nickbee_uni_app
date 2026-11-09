#!/bin/bash
cd "$(dirname "$0")"

npm run dev &
server_pid=$!

for attempt in {1..30}; do
	if curl --silent --fail http://127.0.0.1:3000/ >/dev/null; then
		open http://localhost:3000
		break
	fi
	sleep 1
done

wait "$server_pid"
