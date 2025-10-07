package websocket

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

type MemberStatusNotification struct {
	Type      string    `json:"type"`
	SessionID string    `json:"sessionID"`
	MemberID  string    `json:"memberID"`
	Time      time.Time `json:"time"`
}

type StandardNotification struct {
	Type      string `json:"type"`
	SessionID string `json:"sessionID"`
	Time      string `json:"time"`
}

// OwnerLeft is invoked when the session owner disconnects.
func (h *WebSocketHub) handlerOwnerLeft(sessionID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	session := h.Sessions[sessionID]
	// for each member, close their channel
	for member := range session.Members {
		member.Close()
	}

	// delete session from database
	err := h.SessionStore.DeleteSession(ctx, sessionID)
	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Msg("failed to delete session from Firestore")
		return
	}
	delete(h.Sessions, sessionID)
	log.Info().Str("sessionID", sessionID).Msg("session deleted from database")
}

// MemberLeft is invoked when a session member disconnects.
func (h *WebSocketHub) handlerMemberLeft(sessionID string, memberID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	err := h.SessionStore.RemoveMemberFromSession(ctx, sessionID, memberID)
	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Str("memberID", memberID).Msg("failed to remove member from session in Firestore")
		return
	}
	log.Info().Str("sessionID", sessionID).Str("memberID", memberID).Msg("member removed from session database")
	h.sendMemberStatusNotification(MemberStatusNotification{
		Type:      "member_left",
		SessionID: sessionID,
		MemberID:  memberID,
		Time:      time.Now().UTC(),
	})
}

// This is a generic notification format indicating something has happened to a member of the session (joined, left, etc.)
// The notification is sent to everyone but the member in question
func (h *WebSocketHub) sendMemberStatusNotification(notif MemberStatusNotification) {
	s := h.Sessions[notif.SessionID]

	s.Mu.RLock()
	defer s.Mu.RUnlock()

	// Notify owner
	if s.Owner != nil {
		if !h.safeEnqueue(s.Owner, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Msg("owner out channel unavailable, dropping member_joined notification")
		}
	}

	// Notify all members except the new member itself
	for member := range s.Members {
		if member.id == notif.MemberID {
			continue
		}
		if !h.safeEnqueue(member, notif) {
			log.Warn().Str("sessionID", notif.SessionID).Str("memberID", member.id).Msg("member out channel unavailable, dropping member_joined notification")
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
