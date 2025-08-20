# Auth Service API Reference

## Authentication

| Method | Endpoint       | Description                                                                                                           | JSON/Form Data Example                   |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| POST   | /auth/{userID} | Validates a JWT token in the header, and also that the userID matches the claim. Returns 200 OK if valid, 401 if not. | Header:`Authorization: Bearer <token>` |

## User Registration

| Method | Endpoint  | Description           | JSON/Form Data Example                                |
| ------ | --------- | --------------------- | ----------------------------------------------------- |
| POST   | /register | Registers a new user. | { "email": "user@example.com", "password": "string" } |

## User Login

| Method | Endpoint | Description                       | JSON/Form Data Example                                |
| ------ | -------- | --------------------------------- | ----------------------------------------------------- |
| POST   | /login   | Logs in a user and returns a JWT. | { "email": "user@example.com", "password": "string" } |

## User Deletion

| Method | Endpoint | Description             | JSON/Form Data Example                                |
| ------ | -------- | ----------------------- | ----------------------------------------------------- |
| DELETE | /delete  | Deletes a user account. | { "email": "user@example.com", "password": "string" } |

---

- All endpoints expect and return JSON unless otherwise noted.
- The `/auth` endpoint expects a JWT in the `Authorization` header.
- Passwords must be at least 12 characters and include uppercase, lowercase, number, and special character for registration.
