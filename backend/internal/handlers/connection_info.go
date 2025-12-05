package handlers

import (
	"github.com/gorilla/websocket"
)

// ConnectionInfo stores information about a WebSocket connection
type ConnectionInfo struct {
	Conn   *websocket.Conn
	UserID uint
	Role   string
}

