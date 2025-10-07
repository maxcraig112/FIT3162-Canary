package constants

// Debug / development constants for local websocket debugging.
// IMPORTANT: Disable (set DebugBypassEnabled = false) before deploying to any shared or production environment.
const (
	DebugBypassEnabled  = true          // set to false in prod
	DebugBypassToken    = "1234"        // simple token value accepted via the 'token' query param
	DebugDefaultUserID  = "debug-user"  // fallback userID if not supplied
	DebugDefaultOwnerID = "debug-owner" // fallback owner userID for create
	DebugDefaultBatchID = "debug-batch" // fallback batchID if not supplied on create
)
