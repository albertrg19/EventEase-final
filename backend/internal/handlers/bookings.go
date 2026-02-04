package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type BookingHandler struct {
	db           *gorm.DB
	emailService *EmailService
}

func NewBookingHandler(db *gorm.DB) *BookingHandler {
	return &BookingHandler{
		db:           db,
		emailService: NewEmailService(db),
	}
}

func (h *BookingHandler) logActivity(c *gin.Context, action, resource string, resourceID *uint, details string) {
	userID, _ := c.Get("userId")
	userEmail, _ := c.Get("userEmail")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}
	email := ""
	if e, ok := userEmail.(string); ok {
		email = e
	}
	LogAdminActivity(h.db, uid, email, action, resource, resourceID, details, c.ClientIP())
}

func (h *BookingHandler) List(c *gin.Context) {
	var items []models.Booking
	page, size := getPagination(c)
	if err := h.db.Preload("User").Preload("EventCategory").Preload("Hall").Order("id desc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	c.JSON(http.StatusOK, items)
}

type bookingUpsert struct {
	CustomerID      uint       `json:"customer_id"` // Optional, will use authenticated user
	UserID          uint       `json:"user_id"`     // Optional, will use authenticated user
	EventName       string     `json:"event_name" binding:"required"`
	EventType       string     `json:"event_type" binding:"required"`
	EventCategoryID uint       `json:"event_category_id" binding:"required"`
	HallID          uint       `json:"hall_id" binding:"required"`
	EventDate       time.Time  `json:"event_date" binding:"required"`
	StartTime       *time.Time `json:"start_time"` // Optional time string (HH:MM format)
	EndTime         *time.Time `json:"end_time"`   // Optional time string (HH:MM format)
	Status          string     `json:"status"`
	AdminNotes      *string    `json:"admin_notes"`
}

// generateBookingRef generates a unique booking reference number
func generateBookingRef(bookingID uint) string {
	return fmt.Sprintf("BK-%s-%06d", time.Now().Format("20060102"), bookingID)
}

func (h *BookingHandler) Create(c *gin.Context) {
	var req bookingUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// SECURITY FIX: Always use authenticated user ID from JWT context, ignore client input
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}
	// Override any user_id from request with authenticated user ID
	req.UserID = uid
	req.CustomerID = uid

	// Validate time range if times are provided
	if req.StartTime != nil && req.EndTime != nil {
		// Parse times if they're strings (handle both time.Time and string formats)
		startTime := *req.StartTime
		endTime := *req.EndTime

		if !endTime.After(startTime) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_time_range",
				"message": "End time must be after start time",
			})
			return
		}

		// Check minimum duration (2 hours)
		duration := endTime.Sub(startTime)
		if duration < 2*time.Hour {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "minimum_duration",
				"message": "Minimum booking duration is 2 hours",
			})
			return
		}
	}

	// RACE CONDITION FIX: Use transaction with row-level locking
	var item models.Booking
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Build availability query
		query := tx.Model(&models.Booking{}).
			Where("hall_id = ? AND event_date = ? AND status IN ?",
				req.HallID, req.EventDate, []string{"pending", "approved"})

		// TIME-BASED AVAILABILITY CHECK: Check for time overlaps if times provided
		if req.StartTime != nil && req.EndTime != nil {
			// Check for overlapping time slots
			// Overlap occurs if: (new_start < existing_end) AND (new_end > existing_start)
			query = query.Where(
				"((start_time IS NULL OR start_time <= ?) AND (end_time IS NULL OR end_time > ?)) OR "+
					"((start_time IS NULL OR start_time < ?) AND (end_time IS NULL OR end_time >= ?)) OR "+
					"((start_time IS NULL OR start_time >= ?) AND (end_time IS NULL OR end_time <= ?))",
				req.EndTime, req.StartTime, // New booking starts during existing
				req.EndTime, req.StartTime, // New booking ends during existing
				req.StartTime, req.EndTime, // New booking completely within existing
			)
		}

		// Use FOR UPDATE to lock rows and prevent race conditions
		var count int64
		if err := query.Set("gorm:query_option", "FOR UPDATE").Count(&count).Error; err != nil {
			return fmt.Errorf("availability check failed: %w", err)
		}

		if count > 0 {
			return fmt.Errorf("hall already booked for this time slot")
		}

		// Create booking within transaction
		item = models.Booking{
			CustomerID:      req.CustomerID,
			UserID:          req.UserID,
			EventName:       req.EventName,
			EventType:       req.EventType,
			EventCategoryID: req.EventCategoryID,
			HallID:          req.HallID,
			EventDate:       req.EventDate,
			StartTime:       req.StartTime,
			EndTime:         req.EndTime,
			AdminNotes:      req.AdminNotes,
			Status:          models.BookingStatusPending,
		}
		if req.Status != "" {
			item.Status = models.BookingStatus(req.Status)
		}

		if err := tx.Create(&item).Error; err != nil {
			return fmt.Errorf("could not create booking: %w", err)
		}

		// Generate and set reference number
		item.ReferenceNumber = generateBookingRef(item.ID)
		if err := tx.Model(&item).Update("reference_number", item.ReferenceNumber).Error; err != nil {
			return fmt.Errorf("could not set reference number: %w", err)
		}

		return nil
	})

	if err != nil {
		if err.Error() == "hall already booked for this time slot" {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "time_slot_unavailable",
				"message": "This time slot is already booked. Please select another time.",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "creation_failed",
				"message": "Unable to create booking. Please try again.",
			})
		}
		return
	}

	h.logActivity(c, "create", "booking", &item.ID, fmt.Sprintf("Created booking: %s on %s", item.EventName, item.EventDate.Format("2006-01-02")))

	// Auto-create invoice if booking is created with approved status
	if string(item.Status) == string(models.BookingStatusApproved) || item.Status == "Approved" {
		go func() {
			inv, err := CreateInvoiceForBooking(h.db, item.ID, h.emailService)
			if err != nil {
				// Log error but don't fail the booking creation
				fmt.Printf("ERROR: Failed to auto-create invoice for booking #%d: %v\n", item.ID, err)
			} else {
				fmt.Printf("SUCCESS: Auto-created invoice #%d for booking #%d (Total: ₱%.2f)\n", inv.ID, item.ID, inv.TotalAmount)
			}
		}()
	}

	c.JSON(http.StatusCreated, item)
}

func (h *BookingHandler) Get(c *gin.Context) {
	var item models.Booking
	if err := h.db.Preload("User").Preload("EventCategory").Preload("Hall").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BookingHandler) Update(c *gin.Context) {
	var item models.Booking
	if err := h.db.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req bookingUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// If hall/date/time changed, re-check availability with transaction
	hallOrDateChanged := !(item.HallID == req.HallID && item.EventDate.Equal(req.EventDate))
	timeChanged := (req.StartTime != nil && item.StartTime != nil && !req.StartTime.Equal(*item.StartTime)) ||
		(req.EndTime != nil && item.EndTime != nil && !req.EndTime.Equal(*item.EndTime)) ||
		(req.StartTime != nil && item.StartTime == nil) ||
		(req.EndTime != nil && item.EndTime == nil)

	if hallOrDateChanged || timeChanged {
		err := h.db.Transaction(func(tx *gorm.DB) error {
			query := tx.Model(&models.Booking{}).
				Where("hall_id = ? AND event_date = ? AND id <> ? AND status IN ?",
					req.HallID, req.EventDate, item.ID, []string{"pending", "approved"})

			// Add time overlap check if times provided
			if req.StartTime != nil && req.EndTime != nil {
				query = query.Where(
					"((start_time IS NULL OR start_time <= ?) AND (end_time IS NULL OR end_time > ?)) OR "+
						"((start_time IS NULL OR start_time < ?) AND (end_time IS NULL OR end_time >= ?)) OR "+
						"((start_time IS NULL OR start_time >= ?) AND (end_time IS NULL OR end_time <= ?))",
					req.EndTime, req.StartTime,
					req.EndTime, req.StartTime,
					req.StartTime, req.EndTime,
				)
			}

			var count int64
			if err := query.Set("gorm:query_option", "FOR UPDATE").Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return fmt.Errorf("hall already booked for this time slot")
			}
			return nil
		})

		if err != nil {
			if err.Error() == "hall already booked for this time slot" {
				c.JSON(http.StatusConflict, gin.H{
					"error":   "time_slot_unavailable",
					"message": "This time slot is already booked. Please select another time.",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "availability check failed"})
			}
			return
		}
	}
	// SECURITY FIX: Use authenticated user ID, but allow admin to update other users' bookings
	userID, exists := c.Get("userId")
	if exists {
		// Only allow users to update their own bookings unless they're admin
		userRole, _ := c.Get("role")
		roleStr, _ := userRole.(string)
		if roleStr != "admin" {
			uid := uint(0)
			if id, ok := userID.(float64); ok {
				uid = uint(id)
			} else if id, ok := userID.(uint); ok {
				uid = id
			}
			if item.UserID != uid {
				c.JSON(http.StatusForbidden, gin.H{"error": "can only update your own bookings"})
				return
			}
			// For non-admin users, use authenticated ID
			req.UserID = uid
			req.CustomerID = uid
		}
	}

	// Save old status BEFORE updating
	oldStatus := item.Status

	item.CustomerID = req.CustomerID
	item.UserID = req.UserID
	item.EventName = req.EventName
	item.EventType = req.EventType
	item.EventCategoryID = req.EventCategoryID
	item.HallID = req.HallID
	item.EventDate = req.EventDate
	item.StartTime = req.StartTime
	item.EndTime = req.EndTime
	item.AdminNotes = req.AdminNotes
	if req.Status != "" {
		item.Status = models.BookingStatus(req.Status)
	}
	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	h.logActivity(c, "update", "booking", &item.ID, fmt.Sprintf("Updated booking: %s, status: %s", item.EventName, item.Status))

	// Check if status changed to approved
	statusChanged := req.Status != "" && models.BookingStatus(req.Status) != oldStatus
	isNowApproved := item.Status == models.BookingStatusApproved && oldStatus != models.BookingStatusApproved

	// Auto-create invoice when booking is approved
	if isNowApproved {
		fmt.Printf("DEBUG: Booking #%d status changed to approved (old: %s, new: %s)\n", item.ID, oldStatus, item.Status)
		go func() {
			inv, err := CreateInvoiceForBooking(h.db, item.ID, h.emailService)
			if err != nil {
				// Log error but don't fail the booking update
				fmt.Printf("ERROR: Failed to auto-create invoice for booking #%d: %v\n", item.ID, err)
			} else {
				fmt.Printf("SUCCESS: Auto-created invoice #%d for booking #%d (Total: ₱%.2f)\n", inv.ID, item.ID, inv.TotalAmount)
			}
		}()
	} else if item.Status == models.BookingStatusApproved {
		// Also check if invoice exists for already-approved bookings
		var invoiceCount int64
		h.db.Model(&models.Invoice{}).Where("booking_id = ?", item.ID).Count(&invoiceCount)
		if invoiceCount == 0 {
			fmt.Printf("DEBUG: Booking #%d is approved but has no invoice. Creating one...\n", item.ID)
			go func() {
				inv, err := CreateInvoiceForBooking(h.db, item.ID, h.emailService)
				if err != nil {
					fmt.Printf("ERROR: Failed to create missing invoice for booking #%d: %v\n", item.ID, err)
				} else {
					fmt.Printf("SUCCESS: Created missing invoice #%d for booking #%d (Total: ₱%.2f)\n", inv.ID, item.ID, inv.TotalAmount)
				}
			}()
		}
	}

	// Send email notification if status changed
	if statusChanged {
		go func() {
			var user models.User
			var hall models.EventHall
			h.db.First(&user, item.UserID)
			h.db.First(&hall, item.HallID)
			h.emailService.SendBookingStatusEmail(&item, &user, &hall)
		}()
	}

	c.JSON(http.StatusOK, item)
}

func (h *BookingHandler) Delete(c *gin.Context) {
	var item models.Booking
	if err := h.db.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	itemID := item.ID
	eventName := item.EventName
	if err := h.db.Delete(&models.Booking{}, itemID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	h.logActivity(c, "delete", "booking", &itemID, fmt.Sprintf("Deleted booking: %s", eventName))
	c.Status(http.StatusNoContent)
}
