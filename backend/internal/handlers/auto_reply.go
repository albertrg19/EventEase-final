package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type AutoReplyHandler struct {
	db *gorm.DB
}

func NewAutoReplyHandler(db *gorm.DB) *AutoReplyHandler {
	return &AutoReplyHandler{db: db}
}

// GetAutoReplyConfig returns the current auto-reply configuration
func (h *AutoReplyHandler) GetAutoReplyConfig(c *gin.Context) {
	var config models.AutoReplyConfig
	if err := h.db.First(&config).Error; err != nil {
		// If no config exists, create default
		config = models.AutoReplyConfig{
			Enabled: true,
			Message: "Thank you for your message. Our team is currently offline. We'll get back to you as soon as possible during business hours.",
		}
		h.db.Create(&config)
	}
	c.JSON(http.StatusOK, config)
}

// UpdateAutoReplyConfig updates the auto-reply configuration
func (h *AutoReplyHandler) UpdateAutoReplyConfig(c *gin.Context) {
	var req struct {
		Enabled bool   `json:"enabled"`
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var config models.AutoReplyConfig
	if err := h.db.First(&config).Error; err != nil {
		// Create new config if doesn't exist
		config = models.AutoReplyConfig{
			Enabled: req.Enabled,
			Message: req.Message,
		}
		if err := h.db.Create(&config).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create auto-reply config"})
			return
		}
	} else {
		config.Enabled = req.Enabled
		config.Message = req.Message
		if err := h.db.Save(&config).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update auto-reply config"})
			return
		}
	}

	c.JSON(http.StatusOK, config)
}

// SendAutoReply sends an auto-reply message if admin is offline
func (h *AutoReplyHandler) SendAutoReply(bookingID uint, chatHandler *ChatHandler) error {
	fmt.Printf("[AutoReply] Checking auto-reply for booking %d\n", bookingID)
	
	// Check if auto-reply is enabled
	var config models.AutoReplyConfig
	if err := h.db.First(&config).Error; err != nil {
		fmt.Printf("[AutoReply] No config found, creating default\n")
		// Create default config
		config = models.AutoReplyConfig{
			Enabled: true,
			Message: "Thank you for your message. Our team is currently offline. We'll get back to you as soon as possible during business hours.",
		}
		h.db.Create(&config)
	}

	fmt.Printf("[AutoReply] Config - Enabled: %v, Message: %s\n", config.Enabled, config.Message)

	if !config.Enabled {
		fmt.Printf("[AutoReply] Auto-reply is disabled\n")
		return nil // Auto-reply disabled
	}

	// Check if admin is online
	isOnline := chatHandler.isAdminOnline()
	fmt.Printf("[AutoReply] Admin online status: %v\n", isOnline)
	if isOnline {
		fmt.Printf("[AutoReply] Admin is online, skipping auto-reply\n")
		return nil // Admin is online, no auto-reply needed
	}

	// Find the first admin user to send as
	var admin models.User
	if err := h.db.Where("role = ?", "admin").First(&admin).Error; err != nil {
		fmt.Printf("[AutoReply] No admin user found: %v\n", err)
		return nil // No admin found
	}

	fmt.Printf("[AutoReply] Using admin user: %s (ID: %d)\n", admin.Name, admin.ID)

	// Check if we already sent an auto-reply for this booking recently (within last hour)
	var recentAutoReply models.Message
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	if err := h.db.Where("booking_id = ? AND sender_id = ? AND created_at > ?", 
		bookingID, admin.ID, oneHourAgo).
		Order("created_at DESC").
		First(&recentAutoReply).Error; err == nil {
		// Check if the last message from admin matches the auto-reply message
		if recentAutoReply.Content == config.Message {
			fmt.Printf("[AutoReply] Already sent auto-reply recently (message ID: %d), skipping\n", recentAutoReply.ID)
			// Already sent auto-reply recently, skip
			return nil
		}
	}

	// Create auto-reply message
	message := models.Message{
		BookingID: bookingID,
		SenderID:  admin.ID,
		Content:   config.Message,
		Read:      false,
		Status:    models.MessageStatusSent,
		IsDeleted: false,
	}

	if err := h.db.Create(&message).Error; err != nil {
		fmt.Printf("[AutoReply] Failed to create message: %v\n", err)
		return err
	}

	fmt.Printf("[AutoReply] Auto-reply message created successfully (ID: %d)\n", message.ID)

	// Load sender info
	h.db.Preload("Sender").First(&message, message.ID)

	// Broadcast to WebSocket connections
	readReceipts := make([]ReadReceiptInfo, 0)
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
		IsDeleted:   message.IsDeleted,
		ReadReceipts: readReceipts,
		CreatedAt:   message.CreatedAt,
	}

	fmt.Printf("[AutoReply] Broadcasting auto-reply message to booking %d\n", bookingID)
	chatHandler.broadcastMessage(bookingID, response)
	fmt.Printf("[AutoReply] Auto-reply sent successfully\n")

	return nil
}

