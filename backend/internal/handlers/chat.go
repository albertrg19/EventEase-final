package handlers

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type ChatHandler struct {
	db          *gorm.DB
	upgrader    websocket.Upgrader
	connections map[uint]map[*websocket.Conn]bool // bookingID -> connections
	mu          sync.RWMutex
}

func NewChatHandler(db *gorm.DB) *ChatHandler {
	return &ChatHandler{
		db: db,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // In production, validate origin
			},
		},
		connections: make(map[uint]map[*websocket.Conn]bool),
	}
}

// MessageRequest represents incoming message
type MessageRequest struct {
	Content string `json:"content" binding:"required"`
}

// MessageResponse represents outgoing message
type MessageResponse struct {
	ID        uint      `json:"id"`
	BookingID uint      `json:"booking_id"`
	SenderID  uint      `json:"sender_id"`
	Sender    UserInfo  `json:"sender"`
	Content   string    `json:"content"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

type UserInfo struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// GetMessages retrieves all messages for a booking
func (h *ChatHandler) GetMessages(c *gin.Context) {
	bookingID := c.Param("booking_id")
	userID, _ := c.Get("userId")
	userRole, _ := c.Get("role")

	var booking models.Booking
	if err := h.db.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
		return
	}

	// Authorization: user must be admin or the booking owner
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}

	roleStr, _ := userRole.(string)
	if roleStr != "admin" && booking.UserID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var messages []models.Message
	if err := h.db.Where("booking_id = ?", bookingID).
		Preload("Sender").
		Order("created_at ASC").
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	// Mark messages as read for the current user
	if uid > 0 {
		h.db.Model(&models.Message{}).
			Where("booking_id = ? AND sender_id != ? AND read = ?", bookingID, uid, false).
			Update("read", true)
	}

	response := make([]MessageResponse, len(messages))
	for i, msg := range messages {
		response[i] = MessageResponse{
			ID:        msg.ID,
			BookingID: msg.BookingID,
			SenderID:  msg.SenderID,
			Sender: UserInfo{
				ID:    msg.Sender.ID,
				Name:  msg.Sender.Name,
				Email: msg.Sender.Email,
				Role:  string(msg.Sender.Role),
			},
			Content:   msg.Content,
			Read:      msg.Read,
			CreatedAt: msg.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

// SendMessage creates a new message
func (h *ChatHandler) SendMessage(c *gin.Context) {
	bookingID := c.Param("booking_id")
	userID, _ := c.Get("userId")
	userRole, _ := c.Get("role")

	var booking models.Booking
	if err := h.db.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
		return
	}

	// Authorization
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}

	roleStr, _ := userRole.(string)
	if roleStr != "admin" && booking.UserID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var req MessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Content) == 0 || len(req.Content) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message content must be between 1 and 5000 characters"})
		return
	}

	message := models.Message{
		BookingID: booking.ID,
		SenderID:  uid,
		Content:   req.Content,
		Read:      false,
	}

	if err := h.db.Create(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create message"})
		return
	}

	// Load sender info
	var sender models.User
	h.db.First(&sender, uid)

	response := MessageResponse{
		ID:        message.ID,
		BookingID: message.BookingID,
		SenderID:  message.SenderID,
		Sender: UserInfo{
			ID:    sender.ID,
			Name:  sender.Name,
			Email: sender.Email,
			Role:  string(sender.Role),
		},
		Content:   message.Content,
		Read:      message.Read,
		CreatedAt: message.CreatedAt,
	}

	// Broadcast to WebSocket connections
	h.broadcastMessage(booking.ID, response)

	c.JSON(http.StatusCreated, response)
}

// WebSocket endpoint for real-time messaging
func (h *ChatHandler) HandleWebSocket(c *gin.Context) {
	bookingID := c.Param("booking_id")
	
	// Try to get user from context (if middleware set it)
	userID, _ := c.Get("userId")
	userRole, _ := c.Get("role")
	
	// If not in context, try to get from query param token
	var uid uint
	var roleStr string
	
	if userID == nil {
		// Extract token from query parameter
		token := c.Query("token")
		if token == "" {
			// Try Authorization header
			auth := c.GetHeader("Authorization")
			if len(auth) > 7 && auth[:7] == "Bearer " {
				token = auth[7:]
			}
		}
		
		if token != "" {
			// Parse JWT token manually
			uid, roleStr = h.parseToken(token)
		}
	} else {
		if id, ok := userID.(float64); ok {
			uid = uint(id)
		} else if id, ok := userID.(uint); ok {
			uid = id
		}
		roleStr, _ = userRole.(string)
	}

	if uid == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var booking models.Booking
	if err := h.db.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
		return
	}

	// Authorization
	if roleStr != "admin" && booking.UserID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// Log the error for debugging
		fmt.Printf("WebSocket upgrade failed: %v\n", err)
		// Try to send error response if connection not already hijacked
		if !c.Writer.Written() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to upgrade connection"})
		}
		return
	}
	defer conn.Close()

	bid := booking.ID

	// Register connection
	h.mu.Lock()
	if h.connections[bid] == nil {
		h.connections[bid] = make(map[*websocket.Conn]bool)
	}
	h.connections[bid][conn] = true
	h.mu.Unlock()

	// Unregister on disconnect
	defer func() {
		h.mu.Lock()
		delete(h.connections[bid], conn)
		if len(h.connections[bid]) == 0 {
			delete(h.connections, bid)
		}
		h.mu.Unlock()
	}()

	// Send existing messages
	var messages []models.Message
	h.db.Where("booking_id = ?", bid).
		Preload("Sender").
		Order("created_at ASC").
		Find(&messages)

	for _, msg := range messages {
		var sender models.User
		h.db.First(&sender, msg.SenderID)
		response := MessageResponse{
			ID:        msg.ID,
			BookingID: msg.BookingID,
			SenderID:  msg.SenderID,
			Sender: UserInfo{
				ID:    sender.ID,
				Name:  sender.Name,
				Email: sender.Email,
				Role:  string(sender.Role),
			},
			Content:   msg.Content,
			Read:      msg.Read,
			CreatedAt: msg.CreatedAt,
		}
		conn.WriteJSON(response)
	}

	// Keep connection alive and handle incoming messages
	for {
		var req MessageRequest
		if err := conn.ReadJSON(&req); err != nil {
			break
		}

		if len(req.Content) == 0 || len(req.Content) > 5000 {
			conn.WriteJSON(gin.H{"error": "invalid message"})
			continue
		}

		message := models.Message{
			BookingID: bid,
			SenderID:  uid,
			Content:   req.Content,
			Read:      false,
		}

		if err := h.db.Create(&message).Error; err != nil {
			conn.WriteJSON(gin.H{"error": "failed to save message"})
			continue
		}

		var sender models.User
		h.db.First(&sender, uid)

		response := MessageResponse{
			ID:        message.ID,
			BookingID: message.BookingID,
			SenderID:  message.SenderID,
			Sender: UserInfo{
				ID:    sender.ID,
				Name:  sender.Name,
				Email: sender.Email,
				Role:  string(sender.Role),
			},
			Content:   message.Content,
			Read:      message.Read,
			CreatedAt: message.CreatedAt,
		}

		// Broadcast to all connections for this booking
		h.broadcastMessage(bid, response)
	}
}

// broadcastMessage sends message to all WebSocket connections for a booking
func (h *ChatHandler) broadcastMessage(bookingID uint, message MessageResponse) {
	h.mu.RLock()
	connections := h.connections[bookingID]
	h.mu.RUnlock()

	for conn := range connections {
		if err := conn.WriteJSON(message); err != nil {
			// Remove dead connection
			h.mu.Lock()
			delete(h.connections[bookingID], conn)
			h.mu.Unlock()
			conn.Close()
		}
	}
}

// parseToken extracts user ID and role from JWT token
func (h *ChatHandler) parseToken(tokenString string) (uint, string) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-me"
	}
	
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	
	if err != nil || !token.Valid {
		return 0, ""
	}
	
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, ""
	}
	
	uid := uint(0)
	if sub, ok := claims["sub"].(float64); ok {
		uid = uint(sub)
	}
	
	role := ""
	if r, ok := claims["role"].(string); ok {
		role = r
	}
	
	return uid, role
}

// GetUnreadCount returns unread message count for a user
func (h *ChatHandler) GetUnreadCount(c *gin.Context) {
	userID, _ := c.Get("userId")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}

	var count int64
	h.db.Model(&models.Message{}).
		Joins("JOIN bookings ON messages.booking_id = bookings.id").
		Where("messages.sender_id != ? AND messages.read = ? AND (bookings.user_id = ? OR ? = (SELECT role FROM users WHERE id = ?))", uid, false, uid, "admin", uid).
		Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

