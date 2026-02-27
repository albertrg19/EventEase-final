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
	db           *gorm.DB
	emailService *EmailService
	upgrader     websocket.Upgrader
	connections  map[uint]map[*websocket.Conn]*ConnectionInfo // bookingID -> connections with user info
	typingUsers  map[uint]map[uint]time.Time      // bookingID -> userID -> last typing time
	onlineAdmins map[uint]time.Time              // adminID -> last seen time
	mu           sync.RWMutex
}

func NewChatHandler(db *gorm.DB, emailService *EmailService) *ChatHandler {
	handler := &ChatHandler{
		db:           db,
		emailService: emailService,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // In production, validate origin
			},
		},
		connections: make(map[uint]map[*websocket.Conn]*ConnectionInfo),
		typingUsers: make(map[uint]map[uint]time.Time),
		onlineAdmins: make(map[uint]time.Time),
	}
	
	// Start background task to clean up stale admin online status (5 minutes timeout)
	go handler.cleanupOnlineAdmins()
	
	return handler
}

// cleanupOnlineAdmins removes admins who haven't been active in 5 minutes
func (h *ChatHandler) cleanupOnlineAdmins() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		h.mu.Lock()
		now := time.Now()
		for adminID, lastSeen := range h.onlineAdmins {
			if now.Sub(lastSeen) > 5*time.Minute {
				delete(h.onlineAdmins, adminID)
			}
		}
		h.mu.Unlock()
	}
}

// isAdminOnline checks if any admin is currently online
func (h *ChatHandler) isAdminOnline() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	// Check if any admin has active WebSocket connections
	adminConnections := make(map[uint]bool)
	for _, conns := range h.connections {
		for _, info := range conns {
			if info != nil && info.Role == "admin" {
				adminConnections[info.UserID] = true
			}
		}
	}
	
	if len(adminConnections) > 0 {
		fmt.Printf("[Chat] Found %d admin(s) with active connections\n", len(adminConnections))
		return true
	}
	
	// Also check the online admins map (for recently active admins)
	now := time.Now()
	for adminID, lastSeen := range h.onlineAdmins {
		if now.Sub(lastSeen) < 5*time.Minute {
			fmt.Printf("[Chat] Admin %d is online (last seen %v ago)\n", adminID, now.Sub(lastSeen))
			return true
		}
	}
	
	fmt.Printf("[Chat] No admin is currently online\n")
	return false
}

// markAdminOnline marks an admin as online
func (h *ChatHandler) markAdminOnline(adminID uint) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onlineAdmins[adminID] = time.Now()
}

// MessageRequest represents incoming message
type MessageRequest struct {
	Content  string  `json:"content"`
	FileURL  *string `json:"file_url,omitempty"`
	FileName *string `json:"file_name,omitempty"`
	FileType *string `json:"file_type,omitempty"`
	FileSize *int64  `json:"file_size,omitempty"`
}

// MessageResponse represents outgoing message
type MessageResponse struct {
	ID        uint      `json:"id"`
	BookingID uint      `json:"booking_id"`
	SenderID  uint      `json:"sender_id"`
	Sender    UserInfo  `json:"sender"`
	Content   string    `json:"content"`
	Read      bool      `json:"read"`
	Status    string    `json:"status"`
	FileURL   *string   `json:"file_url,omitempty"`
	FileName  *string   `json:"file_name,omitempty"`
	FileType  *string   `json:"file_type,omitempty"`
	FileSize  *int64    `json:"file_size,omitempty"`
	EditedAt  *time.Time `json:"edited_at,omitempty"`
	IsDeleted bool      `json:"is_deleted"`
	ReadReceipts []ReadReceiptInfo `json:"read_receipts,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// ReadReceiptInfo represents read receipt information
type ReadReceiptInfo struct {
	UserID uint      `json:"user_id"`
	UserName string `json:"user_name"`
	ReadAt  time.Time `json:"read_at"`
}

// TypingEvent represents typing indicator event
type TypingEvent struct {
	Type      string `json:"type"` // "typing_start" or "typing_stop"
	UserID    uint   `json:"user_id"`
	UserName  string `json:"user_name"`
	UserRole  string `json:"user_role"`
	BookingID uint   `json:"booking_id"`
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
	if err := h.db.Where("booking_id = ? AND is_deleted = ?", bookingID, false).
		Preload("Sender").
		Preload("ReadReceipts.User").
		Order("created_at ASC").
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	// Mark messages as read for the current user and create read receipts
	if uid > 0 {
		for _, msg := range messages {
			if msg.SenderID != uid {
				// Check if read receipt already exists
				var existingReceipt models.MessageReadReceipt
				if err := h.db.Where("message_id = ? AND user_id = ?", msg.ID, uid).First(&existingReceipt).Error; err != nil {
					// Create new read receipt
					receipt := models.MessageReadReceipt{
						MessageID: msg.ID,
						UserID:    uid,
					}
					h.db.Create(&receipt)
				}
				// Update message read status
				h.db.Model(&msg).Update("read", true)
				h.db.Model(&msg).Update("status", models.MessageStatusRead)
			}
		}
	}

	// Reload messages with updated read receipts
	h.db.Where("booking_id = ? AND is_deleted = ?", bookingID, false).
		Preload("Sender").
		Preload("ReadReceipts.User").
		Order("created_at ASC").
		Find(&messages)

	response := make([]MessageResponse, len(messages))
	for i, msg := range messages {
		readReceipts := make([]ReadReceiptInfo, len(msg.ReadReceipts))
		for j, receipt := range msg.ReadReceipts {
			readReceipts[j] = ReadReceiptInfo{
				UserID:   receipt.UserID,
				UserName: receipt.User.Name,
				ReadAt:   receipt.ReadAt,
			}
		}
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
			Content:     msg.Content,
			Read:        msg.Read,
			Status:      string(msg.Status),
			FileURL:     msg.FileURL,
			FileName:    msg.FileName,
			FileType:    msg.FileType,
			FileSize:    msg.FileSize,
			EditedAt:    msg.EditedAt,
			IsDeleted:   msg.IsDeleted,
			ReadReceipts: readReceipts,
			CreatedAt:   msg.CreatedAt,
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

	// Validate: must have either content or file
	if (req.Content == "" || len(req.Content) == 0) && req.FileURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message must have content or file attachment"})
		return
	}

	if len(req.Content) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message content must not exceed 5000 characters"})
		return
	}

	message := models.Message{
		BookingID: booking.ID,
		SenderID:  uid,
		Content:   req.Content,
		Read:      false,
		Status:    models.MessageStatusSent,
		FileURL:   req.FileURL,
		FileName:  req.FileName,
		FileType:  req.FileType,
		FileSize:  req.FileSize,
		IsDeleted: false,
	}

	if err := h.db.Create(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create message"})
		return
	}

	// Update status to delivered immediately (since recipient is likely online)
	h.db.Model(&message).Update("status", models.MessageStatusDelivered)

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
		Status:    string(message.Status),
		FileURL:   message.FileURL,
		FileName:  message.FileName,
		FileType:  message.FileType,
		FileSize:  message.FileSize,
		IsDeleted: message.IsDeleted,
		CreatedAt: message.CreatedAt,
	}

	// Broadcast to WebSocket connections
	h.broadcastMessage(booking.ID, response)

	// Send email notification to the other party (async)
	if h.emailService != nil {
		go func() {
			if roleStr == "admin" {
				// Admin sent message -> email the customer
				var customer models.User
				if err := h.db.First(&customer, booking.UserID).Error; err == nil && customer.Email != "" {
					h.emailService.SendChatMessageEmail(customer.Email, customer.Name, sender.Name, "admin", booking.EventName, req.Content)
				}
			} else {
				// Customer sent message -> email admin(s)
				var admins []models.User
				if err := h.db.Where("role = ?", "admin").Find(&admins).Error; err == nil {
					for _, admin := range admins {
						if admin.Email != "" {
							h.emailService.SendChatMessageEmail(admin.Email, admin.Name, sender.Name, "customer", booking.EventName, req.Content)
						}
					}
				}
			}
		}()
	}

	// Check if customer sent message and admin is offline - send auto-reply
	if roleStr != "admin" {
		// Customer sent message, check if we need to send auto-reply
		autoReplyHandler := NewAutoReplyHandler(h.db)
		go func() {
			// Small delay to ensure message is saved first
			time.Sleep(500 * time.Millisecond)
			if err := autoReplyHandler.SendAutoReply(booking.ID, h); err != nil {
				fmt.Printf("Failed to send auto-reply: %v\n", err)
			}
		}()
	}

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

	// Mark admin as online if they're an admin
	if roleStr == "admin" {
		h.markAdminOnline(uid)
	}

	// Register connection with user info
	h.mu.Lock()
	if h.connections[bid] == nil {
		h.connections[bid] = make(map[*websocket.Conn]*ConnectionInfo)
	}
	h.connections[bid][conn] = &ConnectionInfo{
		Conn:   conn,
		UserID: uid,
		Role:   roleStr,
	}
	h.mu.Unlock()

	// Unregister on disconnect
	defer func() {
		h.mu.Lock()
		delete(h.connections[bid], conn)
		if len(h.connections[bid]) == 0 {
			delete(h.connections, bid)
		}
		// Check if admin has any other active connections
		hasOtherConnections := false
		for _, conns := range h.connections {
			for c := range conns {
				if c == conn {
					hasOtherConnections = true
					break
				}
			}
			if hasOtherConnections {
				break
			}
		}
		// If admin has no other connections, they're offline
		if !hasOtherConnections && roleStr == "admin" {
			// Don't immediately remove - let cleanup task handle it after timeout
			fmt.Printf("[Chat] Admin %d disconnected, will be marked offline after 5 min timeout\n", uid)
		}
		h.mu.Unlock()
	}()

	// Send existing messages
	var messages []models.Message
	h.db.Where("booking_id = ? AND is_deleted = ?", bid, false).
		Preload("Sender").
		Preload("ReadReceipts.User").
		Order("created_at ASC").
		Find(&messages)

	for _, msg := range messages {
		readReceipts := make([]ReadReceiptInfo, len(msg.ReadReceipts))
		for i, receipt := range msg.ReadReceipts {
			readReceipts[i] = ReadReceiptInfo{
				UserID:   receipt.UserID,
				UserName: receipt.User.Name,
				ReadAt:   receipt.ReadAt,
			}
		}
		response := MessageResponse{
			ID:        msg.ID,
			BookingID: msg.BookingID,
			SenderID:  msg.SenderID,
			Sender: UserInfo{
				ID:    msg.Sender.ID,
				Name:  msg.Sender.Name,
				Email: msg.Sender.Email,
				Role:  string(msg.Sender.Role),
			},
			Content:     msg.Content,
			Read:        msg.Read,
			Status:      string(msg.Status),
			FileURL:     msg.FileURL,
			FileName:    msg.FileName,
			FileType:    msg.FileType,
			FileSize:    msg.FileSize,
			EditedAt:    msg.EditedAt,
			IsDeleted:   msg.IsDeleted,
			ReadReceipts: readReceipts,
			CreatedAt:   msg.CreatedAt,
		}
		conn.WriteJSON(gin.H{"type": "message", "data": response})
	}

	// Keep connection alive and handle incoming messages and events
	for {
		var rawMessage map[string]interface{}
		if err := conn.ReadJSON(&rawMessage); err != nil {
			break
		}

		// Check message type
		msgType, ok := rawMessage["type"].(string)
		if !ok {
			msgType = "message" // Default to message
		}

		switch msgType {
		case "typing_start":
			// Handle typing start
			h.handleTypingStart(bid, uid, conn)
		case "typing_stop":
			// Handle typing stop
			h.handleTypingStop(bid, uid, conn)
		case "message":
			// Handle regular message
			content, _ := rawMessage["content"].(string)
			fileURL, _ := rawMessage["file_url"].(string)
			fileName, _ := rawMessage["file_name"].(string)
			fileType, _ := rawMessage["file_type"].(string)
			var fileSize *int64
			if fs, ok := rawMessage["file_size"].(float64); ok {
				fsInt := int64(fs)
				fileSize = &fsInt
			}

			if (content == "" || len(content) == 0) && fileURL == "" {
				conn.WriteJSON(gin.H{"error": "message must have content or file attachment"})
				continue
			}

			if len(content) > 5000 {
				conn.WriteJSON(gin.H{"error": "message content must not exceed 5000 characters"})
				continue
			}

			var fileURLPtr, fileNamePtr, fileTypePtr *string
			if fileURL != "" {
				fileURLPtr = &fileURL
			}
			if fileName != "" {
				fileNamePtr = &fileName
			}
			if fileType != "" {
				fileTypePtr = &fileType
			}

			message := models.Message{
				BookingID: bid,
				SenderID:  uid,
				Content:   content,
				Read:      false,
				Status:    models.MessageStatusSent,
				FileURL:   fileURLPtr,
				FileName:  fileNamePtr,
				FileType:  fileTypePtr,
				FileSize:  fileSize,
				IsDeleted: false,
			}

			if err := h.db.Create(&message).Error; err != nil {
				conn.WriteJSON(gin.H{"error": "failed to save message"})
				continue
			}

			// Update status to delivered
			h.db.Model(&message).Update("status", models.MessageStatusDelivered)

			var sender models.User
			h.db.First(&sender, uid)

			// Load read receipts
			var readReceipts []models.MessageReadReceipt
			h.db.Where("message_id = ?", message.ID).Preload("User").Find(&readReceipts)
			
			receiptInfos := make([]ReadReceiptInfo, len(readReceipts))
			for i, receipt := range readReceipts {
				receiptInfos[i] = ReadReceiptInfo{
					UserID:   receipt.UserID,
					UserName: receipt.User.Name,
					ReadAt:   receipt.ReadAt,
				}
			}

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
				Content:     message.Content,
				Read:        message.Read,
				Status:      string(message.Status),
				FileURL:     message.FileURL,
				FileName:    message.FileName,
				FileType:    message.FileType,
				FileSize:    message.FileSize,
				IsDeleted:   message.IsDeleted,
				ReadReceipts: receiptInfos,
				CreatedAt:   message.CreatedAt,
			}

			// Mark admin as online if they sent a message
			if roleStr == "admin" {
				h.markAdminOnline(uid)
			}

			// Broadcast to all connections for this booking (including sender)
			h.broadcastMessage(bid, response)

			// Send email notification to the other party (async)
			if h.emailService != nil {
				go func() {
					if roleStr == "admin" {
						var customer models.User
						if err := h.db.First(&customer, booking.UserID).Error; err == nil && customer.Email != "" {
							h.emailService.SendChatMessageEmail(customer.Email, customer.Name, sender.Name, "admin", booking.EventName, content)
						}
					} else {
						var admins []models.User
						if err := h.db.Where("role = ?", "admin").Find(&admins).Error; err == nil {
							for _, admin := range admins {
								if admin.Email != "" {
									h.emailService.SendChatMessageEmail(admin.Email, admin.Name, sender.Name, "customer", booking.EventName, content)
								}
							}
						}
					}
				}()
			}

			// Check if customer sent message and admin is offline - send auto-reply
			if roleStr != "admin" {
				// Customer sent message via WebSocket, check if we need to send auto-reply
				autoReplyHandler := NewAutoReplyHandler(h.db)
				go func() {
					// Small delay to ensure message is saved first
					time.Sleep(1 * time.Second)
					fmt.Printf("[Chat] Triggering auto-reply check for booking %d (WebSocket)\n", bid)
					if err := autoReplyHandler.SendAutoReply(bid, h); err != nil {
						fmt.Printf("[Chat] Failed to send auto-reply: %v\n", err)
					}
				}()
			}
		}
	}
}

// broadcastMessage sends message to all WebSocket connections for a booking
func (h *ChatHandler) broadcastMessage(bookingID uint, message MessageResponse) {
	h.mu.RLock()
	connections := h.connections[bookingID]
	h.mu.RUnlock()

	for conn, info := range connections {
		if info == nil {
			continue
		}
		if err := conn.WriteJSON(gin.H{"type": "message", "data": message}); err != nil {
			// Remove dead connection
			h.mu.Lock()
			delete(h.connections[bookingID], conn)
			h.mu.Unlock()
			conn.Close()
		}
	}
}

// handleTypingStart handles typing start event
func (h *ChatHandler) handleTypingStart(bookingID, userID uint, conn *websocket.Conn) {
	h.mu.Lock()
	if h.typingUsers[bookingID] == nil {
		h.typingUsers[bookingID] = make(map[uint]time.Time)
	}
	h.typingUsers[bookingID][userID] = time.Now()
	h.mu.Unlock()

	// Get user info
	var user models.User
	h.db.First(&user, userID)

	// Broadcast typing event to other users
	typingEvent := TypingEvent{
		Type:      "typing_start",
		UserID:    userID,
		UserName:  user.Name,
		UserRole:  string(user.Role),
		BookingID: bookingID,
	}

	h.mu.RLock()
	connections := h.connections[bookingID]
	h.mu.RUnlock()

	for c, info := range connections {
		// Don't send to the user who is typing
		if c != conn && info != nil {
			c.WriteJSON(gin.H{"type": "typing", "data": typingEvent})
		}
	}
}

// handleTypingStop handles typing stop event
func (h *ChatHandler) handleTypingStop(bookingID, userID uint, conn *websocket.Conn) {
	h.mu.Lock()
	if h.typingUsers[bookingID] != nil {
		delete(h.typingUsers[bookingID], userID)
	}
	h.mu.Unlock()

	// Get user info
	var user models.User
	h.db.First(&user, userID)

	// Broadcast typing stop event
	typingEvent := TypingEvent{
		Type:      "typing_stop",
		UserID:    userID,
		UserName:  user.Name,
		UserRole:  string(user.Role),
		BookingID: bookingID,
	}

	h.mu.RLock()
	connections := h.connections[bookingID]
	h.mu.RUnlock()

	for c, info := range connections {
		if c != conn && info != nil {
			c.WriteJSON(gin.H{"type": "typing", "data": typingEvent})
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
		Where("messages.sender_id != ? AND messages.is_deleted = ? AND messages.read = ? AND (bookings.user_id = ? OR ? = (SELECT role FROM users WHERE id = ?))", uid, false, false, uid, "admin", uid).
		Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GetNotificationCount returns message notification data using read_receipts (not the auto-read flag)
func (h *ChatHandler) GetNotificationCount(c *gin.Context) {
	userID, _ := c.Get("userId")
	userRole, _ := c.Get("role")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}
	roleStr, _ := userRole.(string)

	type BookingMsg struct {
		BookingID  uint   `json:"booking_id"`
		EventName  string `json:"event_name"`
		SenderName string `json:"sender_name"`
		MsgCount   int64  `json:"count"`
		LatestAt   string `json:"latest_at"`
	}

	// Get bookings for this user
	var bookings []models.Booking
	if roleStr == "admin" {
		h.db.Find(&bookings)
	} else {
		h.db.Where("user_id = ?", uid).Find(&bookings)
	}

	var results []BookingMsg
	var totalCount int64

	for _, booking := range bookings {
		// Count messages NOT sent by this user, NOT deleted, and NOT acknowledged via read_receipts
		var count int64
		h.db.Model(&models.Message{}).
			Where("booking_id = ? AND sender_id != ? AND is_deleted = ?", booking.ID, uid, false).
			Where("id NOT IN (SELECT message_id FROM message_read_receipts WHERE user_id = ?)", uid).
			Count(&count)

		if count > 0 {
			// Get the latest message sender name and timestamp
			var latestMsg models.Message
			h.db.Where("booking_id = ? AND sender_id != ? AND is_deleted = ?", booking.ID, uid, false).
				Where("id NOT IN (SELECT message_id FROM message_read_receipts WHERE user_id = ?)", uid).
				Preload("Sender").
				Order("created_at DESC").
				First(&latestMsg)

			senderName := "Someone"
			if latestMsg.Sender.Name != "" {
				senderName = latestMsg.Sender.Name
			}

			results = append(results, BookingMsg{
				BookingID:  booking.ID,
				EventName:  booking.EventName,
				SenderName: senderName,
				MsgCount:   count,
				LatestAt:   latestMsg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			})
			totalCount += count
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":    totalCount,
		"bookings": results,
	})
}

// UpdateMessage edits an existing message
func (h *ChatHandler) UpdateMessage(c *gin.Context) {
	messageID := c.Param("message_id")
	userID, _ := c.Get("userId")
	
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}

	var message models.Message
	if err := h.db.First(&message, messageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	// Only sender can edit their message
	if message.SenderID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only edit your own messages"})
		return
	}

	// Check if message was deleted
	if message.IsDeleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot edit deleted message"})
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

	now := time.Now()
	message.Content = req.Content
	message.EditedAt = &now

	if err := h.db.Save(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update message"})
		return
	}

	// Load sender and read receipts
	h.db.Preload("Sender").Preload("ReadReceipts.User").First(&message, messageID)

	readReceipts := make([]ReadReceiptInfo, len(message.ReadReceipts))
	for i, receipt := range message.ReadReceipts {
		readReceipts[i] = ReadReceiptInfo{
			UserID:   receipt.UserID,
			UserName: receipt.User.Name,
			ReadAt:   receipt.ReadAt,
		}
	}

	response := MessageResponse{
		ID:        message.ID,
		BookingID: message.BookingID,
		SenderID:  message.SenderID,
		Sender: UserInfo{
			ID:    message.Sender.ID,
			Name:  message.Sender.Name,
			Email: message.Sender.Email,
			Role:  string(message.Sender.Role),
		},
		Content:     message.Content,
		Read:        message.Read,
		Status:      string(message.Status),
		FileURL:     message.FileURL,
		FileName:    message.FileName,
		FileType:    message.FileType,
		FileSize:    message.FileSize,
		EditedAt:    message.EditedAt,
		IsDeleted:   message.IsDeleted,
		ReadReceipts: readReceipts,
		CreatedAt:   message.CreatedAt,
	}

	// Broadcast update
	h.broadcastMessage(message.BookingID, response)

	c.JSON(http.StatusOK, response)
}

// DeleteMessage soft deletes a message
func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	messageID := c.Param("message_id")
	userID, _ := c.Get("userId")
	
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}

	var message models.Message
	if err := h.db.First(&message, messageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	// Only sender can delete their message
	if message.SenderID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete your own messages"})
		return
	}

	now := time.Now()
	message.IsDeleted = true
	message.DeletedAt = &now

	if err := h.db.Save(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete message"})
		return
	}

	// Load sender
	h.db.Preload("Sender").First(&message, messageID)

	response := MessageResponse{
		ID:        message.ID,
		BookingID: message.BookingID,
		SenderID:  message.SenderID,
		Sender: UserInfo{
			ID:    message.Sender.ID,
			Name:  message.Sender.Name,
			Email: message.Sender.Email,
			Role:  string(message.Sender.Role),
		},
		Content:   message.Content,
		Read:      message.Read,
		Status:    string(message.Status),
		FileURL:   message.FileURL,
		FileName:  message.FileName,
		FileType:   message.FileType,
		FileSize:   message.FileSize,
		EditedAt:   message.EditedAt,
		IsDeleted:  message.IsDeleted,
		CreatedAt:  message.CreatedAt,
	}

	// Broadcast deletion
	h.broadcastMessage(message.BookingID, response)

	c.JSON(http.StatusOK, response)
}

// SearchMessages searches messages in a booking
func (h *ChatHandler) SearchMessages(c *gin.Context) {
	bookingID := c.Param("booking_id")
	query := c.Query("q")
	userID, _ := c.Get("userId")
	userRole, _ := c.Get("role")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search query is required"})
		return
	}

	var booking models.Booking
	if err := h.db.First(&booking, bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "booking not found"})
		return
	}

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
	searchPattern := "%" + query + "%"
	if err := h.db.Where("booking_id = ? AND is_deleted = ? AND (content LIKE ? OR file_name LIKE ?)", bookingID, false, searchPattern, searchPattern).
		Preload("Sender").
		Preload("ReadReceipts.User").
		Order("created_at DESC").
		Limit(50).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search messages"})
		return
	}

	response := make([]MessageResponse, len(messages))
	for i, msg := range messages {
		readReceipts := make([]ReadReceiptInfo, len(msg.ReadReceipts))
		for j, receipt := range msg.ReadReceipts {
			readReceipts[j] = ReadReceiptInfo{
				UserID:   receipt.UserID,
				UserName: receipt.User.Name,
				ReadAt:   receipt.ReadAt,
			}
		}
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
			Content:     msg.Content,
			Read:        msg.Read,
			Status:      string(msg.Status),
			FileURL:     msg.FileURL,
			FileName:    msg.FileName,
			FileType:    msg.FileType,
			FileSize:    msg.FileSize,
			EditedAt:    msg.EditedAt,
			IsDeleted:   msg.IsDeleted,
			ReadReceipts: readReceipts,
			CreatedAt:   msg.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

