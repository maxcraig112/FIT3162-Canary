# WebSocket Service

https://firebase.google.com/docs/firestore/query-data/listen#web

Flow logic of a collaboration session
1. everyone who joins a session connects to a websocket containing info about the session theyre joining
2. the websocket watches for when a new document in the labels is added, with the batchID matching the socket iD
3. it sends a message to all members of the websockets letting them know that it's been updated, then there is logic on the webpage side to update the page for them

We could technicalyl avoid the websocket at all by using firestore real time connection directly on the webpage, but having it in a microservice lets us send custom messages and filtered messages as well, like if a user joins
