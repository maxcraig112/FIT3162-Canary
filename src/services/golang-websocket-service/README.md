# Things yet to add

Database should be updated after connection is created, not before

# Features

1. Create a session as an owner
2. Members can join your session
3. When a member leaves it removes their data from firestore
4. When the owner leaves it closes everyone elses connection



When you first create a session, you just need to provide a batchID and then it will return a sessionID for that unique session

When you join a session, you need to provide the sessionID and that will allow you to connect to that session

Everytime a new image is loaded on the webpage, a message to the server should be sent containing the imageID that you are currently looking at. This should then update the conneciton so that it only watches for changes in that images labels. That means that when you first create a session there will be a period of time where you won't have an imageID because you need to create the session first

I need to figure out how to receive and process messages from the client
