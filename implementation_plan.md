# 01-central-broker.md

## Specification: Central Exam Broker
This Node.js service acts as the central command-and-control server. It exposes a WebSocket gateway for Agent communication, handles the incoming delta-compression patches, and broadcasts state changes to the lab.

## Implementation Tasks

- [ ] **Task 1: Initialize Project & WebSocket Gateway**
  - **Action**: Bootstrap a Node.js project. Implement a WebSocket server (`ws` or `socket.io`) to handle incoming Agent connections and authenticate them via a secure handshake.
  - **Verification**: Write an integration test where a mock client connects and receives an `ACK` payload. `npm run test:ws`
  - **Done**: WebSocket server accepts authenticated connections and rejects invalid ones.

- [ ] **Task 2: Implement Delta-Patching Engine (Data Decompression)**
  - **Action**: Implement a patch engine (e.g., using `diff-match-patch`). When an Agent sends a delta JSON payload, the Broker must apply the patch to the server's master copy of the student's file and increment the version number.
  - **Verification**: Write a test sending a base string, followed by 3 delta diffs. Assert the final string matches the expected output. `npm run test:diff`
  - **Done**: The server successfully reconstructs files from incremental network deltas.

- [ ] **Task 3: Implement Live Network Monitoring State**
  - **Action**: Build a state machine tracking connected PCs. Update status (Online, Offline, Synced) based on incoming Agent heartbeats. If a PC drops, flag the session so the student can resume on another machine.
  - **Verification**: Write tests simulating 10 agents connecting and 2 dropping out. Verify the state tree updates correctly. `npm run test:state`
  - **Done**: Disconnected sockets trigger an "offline" state event within 5 seconds.

- [ ] **Task 4: Build the "Session Resume" Payload Generator**
  - **Action**: Create an endpoint/event that, upon a new login request from an existing student index, packages their latest patched files and broadcasts them down to the new Agent.
  - **Verification**: Write a test simulating a student migrating to a new PC socket. Assert the new socket receives the full reconstructed file tree. `npm run test:resume`
  - **Done**: A student's exact workspace state is delivered to any new machine instantly.