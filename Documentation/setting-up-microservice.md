# Setting Up A Typescript Microservice

This document outlines the process of setting up a microservice using node.js for Typescript. The following steps have been followed to create the `example-service`, so if you have any issues refer to what has been created there.

1. create a new directory in `src/services` that corresponds to the microservice you are creating
2. run `npm init -y` to initialise a Node.js project
3. run `npm install express dotenv` to install express (web framework) and dotenv (env config loader)
4. create a `.env` file to store environment variables for the microservice
   - set `PORT=3001` or whatever port you would like the API to expose (if you are doing local development each port should be different)
5. run `npm install --save-dev typescript ts-node @types/node @types/express` to install typescript if that is your language of choice
6. run `npx tsc --init` to initialise a `tsconfig.json file`
7. create an `src/index.ts` file (in a new `src` directory in the service folder) and write the following template code for your service

```ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.send('OK');
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
});

```

8. add the following lines of code in your `scripts` object in your `package.json`

```json
  "dev": "ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
```

**dev** allows you to run the code immediately which is good for local development
**build** will compile the typescript to javascript in the `dist` folder
**start** will run the compiled javascript, this would be used when the API is uploaded to CloudRun

9. run `npm run dev` to run your server

When the server is running you'll need to keep the terminal open, the hostname of the server will be `localhost:<PORT>`, in this case `localhost:3001`

If we run `localhost:3001/health` we will get an `OK`, which indicates we have setup the application correctly.

10. begin developing!

**NOTE:** the `.gitignore` will not commit any `node_module` folders as they should only exist on your local. therefore if you have an error when attempting to run someone elses service you should first try running `npm install` in the service directory

# Setting up a Golang Microservice

Because I like Golang, I will probably try to create at least one service using it, the steps for setting up a golang API is the following

1. create a new directory in `src/services` that corresponds to the microservice you are creating
2. run `go mod init <SERVICE-NAME` to create a go.mod file, in this case I will run `go mod auth-service`
   - go.mod keeps track of the projects path, as well as package dependencies and versions. It shows all the required libraries you need to run your application
3. run `go get github.com/gorilla/mux` to install the mux library, which allows for handling of HTTP requests and routing
4. run `go get github.com/joho/godotenv` to install the godotenv library, which allows you to use a .env file to store environment variables
5. create a `.env` file to store environment variables for the microservice
   - set `PORT=3003` or whatever port you would like the API to expose (if you are doing local development each port should be different)
6. create a `main.go` file, this is where your code will go
7. Write the following code to setup a basic go API that loads the port from the .env file, and will create a handler for the /health prefix

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	port := os.Getenv("PORT")

	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	}).Methods("GET")

	log.Println("Service running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

```

7. run `go run main.go` to start up your service, you can now access it with `localhost:<PORT>`, in this case `localhost:3003`

If you search `localhost:3003/health` you should get OK

8. start writing in go! If you want a tutorial for go i reccommend following [this tutorial](https://go.dev/doc/tutorial/getting-started)
