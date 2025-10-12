package websocket

import (
	"context"
	"time"

	fs "pkg/gcp/firestore"

	"github.com/rs/zerolog/log"
)

type MemberStatusNotification struct {
	Type        string    `json:"type"`
	SessionID   string    `json:"sessionID"`
	MemberID    string    `json:"memberID"`
	MemberEmail string    `json:"memberEmail"`
	Time        time.Time `json:"time"`
}

type OwnerStatusNotification struct {
	Type       string    `json:"type"`
	SessionID  string    `json:"sessionID"`
	OwnerID    string    `json:"ownerID"`
	OwnerEmail string    `json:"ownerEmail"`
	Time       time.Time `json:"time"`
}

type StandardNotification struct {
	Type      string `json:"type"`
	SessionID string `json:"sessionID"`
	Time      string `json:"time"`
}

type ConnectionStatusNotification struct {
	Type      string `json:"type"`
	SessionID string `json:"sessionID"`
	UserID    string `json:"userID"`
	Role      string `json:"role"`
	Reason    string `json:"reason,omitempty"`
	Time      string `json:"time"`
}

// OwnerLeft is invoked when the session owner disconnects.
func (h *WebSocketHub) handlerOwnerLeft(sessionID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	// First, get the owner email from Firestore before clearing
	ownerEmail := ""
	ownerID := ""
	sessionDoc, err := h.SessionStore.GetSession(ctx, sessionID)
	if err == nil && sessionDoc.Owner.ID != "" {
		ownerEmail = sessionDoc.Owner.Email
		ownerID = sessionDoc.Owner.ID
	}

	h.mu.Lock()
	session, ok := h.Sessions[sessionID]
	if !ok {
		h.mu.Unlock()
		return
	}
	// Clear the in-memory owner reference but keep the session active for members.
	session.Owner = nil
	h.mu.Unlock()

	// Send notification to all remaining members that owner has left
	if ownerID != "" {
		h.sendOwnerStatusNotification(OwnerStatusNotification{
			Type:       "owner_left",
			SessionID:  sessionID,
			OwnerID:    ownerID,
			OwnerEmail: ownerEmail,
			Time:       time.Now().UTC(),
		})
	}

	log.Info().Str("sessionID", sessionID).Msg("session owner disconnected; session remains active")
}

// MemberLeft is invoked when a session member disconnects.
func (h *WebSocketHub) handlerMemberLeft(sessionID string, memberID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	// First, get the member email from Firestore before removing
	memberEmail := ""
	sessionDoc, err := h.SessionStore.GetSession(ctx, sessionID)
	if err == nil {
		for _, member := range sessionDoc.Members {
			if member.ID == memberID {
				memberEmail = member.Email
				break
			}
		}
	}

	h.mu.RLock()
	session, ok := h.Sessions[sessionID]
	h.mu.RUnlock()
	if ok {
		session.Mu.Lock()
		for member := range session.Members {
			if member.id == memberID {
				delete(session.Members, member)
				break
			}
		}
		session.Mu.Unlock()
	}

	if err := h.SessionStore.RemoveMemberFromSession(ctx, sessionID, memberID, memberEmail); err != nil && err != fs.ErrNotFound {
		log.Error().Err(err).Str("sessionID", sessionID).Str("memberID", memberID).Msg("failed to remove member from session in Firestore")
		return
	}
	log.Info().Str("sessionID", sessionID).Str("memberID", memberID).Msg("member removed from session database")
	h.sendMemberStatusNotification(MemberStatusNotification{
		Type:        "member_left",
		SessionID:   sessionID,
		MemberID:    memberID,
		MemberEmail: memberEmail,
		Time:        time.Now().UTC(),
	})
}

// This is a generic notification format indicating something has happened to a member of the session (joined, left, etc.)
// The notification is sent to everyone but the member in question
func (h *WebSocketHub) sendMemberStatusNotification(notif MemberStatusNotification) {
	h.mu.RLock()
	s, ok := h.Sessions[notif.SessionID]
	h.mu.RUnlock()
	if !ok || s == nil {
		log.Warn().Str("sessionID", notif.SessionID).Msg("session not found while sending member status notification")
		return
	}

	s.Mu.RLock()
	defer s.Mu.RUnlock()

	// Notify owner
	if s.Owner != nil {
		if !h.safeEnqueue(s.Owner, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Msg("owner out channel unavailable, dropping member status notification")
		}
	}

	// Notify all members (excluding the leaving member if they have already been removed)
	for member := range s.Members {
		if !h.safeEnqueue(member, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Str("memberID", member.id).Msg("member out channel unavailable, dropping member status notification")
		}
	}
}

// sendOwnerStatusNotification notifies all connected clients (except the owner) that the owner has joined the session.
func (h *WebSocketHub) sendOwnerStatusNotification(notif OwnerStatusNotification) {
	h.mu.RLock()
	s, ok := h.Sessions[notif.SessionID]
	h.mu.RUnlock()
	if !ok || s == nil {
		log.Warn().Str("sessionID", notif.SessionID).Msg("session not found while sending owner status notification")
		return
	}

	s.Mu.RLock()
	defer s.Mu.RUnlock()

	// Notify owner if present (useful for reconnect acknowledgement)
	if s.Owner != nil {
		if !h.safeEnqueue(s.Owner, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Msg("owner out channel unavailable, dropping owner status notification")
		}
	}

	// Notify members
	for member := range s.Members {
		if !h.safeEnqueue(member, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Str("memberID", member.id).Msg("member out channel unavailable, dropping owner status notification")
		}
	}
}

// safeEnqueue attempts a non-blocking send to a client's out channel.
// It recovers from a panic in case the channel has been closed concurrently.
func (h *WebSocketHub) safeEnqueue(c *Client, msg any) (ok bool) {
	defer func() {
		if r := recover(); r != nil {
			ok = false
		}
	}()
	select {
	case c.out <- msg:
		return true
	default:
		return false
	}
}

// broadcastConnectionStatus notifies all connected clients (owner + members) except the specified user.
func (h *WebSocketHub) broadcastConnectionStatus(sessionID, skipUserID string, notif ConnectionStatusNotification) {
	h.mu.RLock()
	s, ok := h.Sessions[sessionID]
	h.mu.RUnlock()
	if !ok || s == nil {
		return
	}

	s.Mu.RLock()
	defer s.Mu.RUnlock()

	if s.Owner != nil && s.Owner.id != skipUserID {
		_ = h.safeEnqueue(s.Owner, notif)
	}

	for member := range s.Members {
		if member.id == skipUserID {
			continue
		}
		_ = h.safeEnqueue(member, notif)
	}
}
