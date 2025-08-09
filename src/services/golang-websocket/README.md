# WebSocket Service

Flow logic of a collaboration session
1. everyone who joins a session connects to the same websocket
2. the websocket watches for when a new document in the labels is added, with the batchID matching the socket iD
3. it sends a message to all members of the websocket letting them know that it's been updated
