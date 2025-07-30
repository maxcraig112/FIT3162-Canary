# Endpoints

| Endpoint      | Description                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/register` | Allows you to register an account with an email and password.Email must be unique and valid. Password must be at least 12 characters, have upper, lowercase, a number and a special character.                    |
| `/login`    | Takes in a username and password and verifies it against what is stored in Firestore. If successful, it will return a JWT token which should be added later to client cookies and used for future authentication. |
| `/delete`   | Deletes a user account from the database.                                                                                                                                                                         |
| `/auth`     | Validates a JWT authorization header in order to confirm a request as authentic.                                                                                                                                  |
