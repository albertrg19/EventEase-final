package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type InvoiceHandler struct {
	db           *gorm.DB
	emailService *EmailService
}

func NewInvoiceHandler(db *gorm.DB) *InvoiceHandler {
	return &InvoiceHandler{
		db:           db,
		emailService: NewEmailService(db),
	}
}

func (h *InvoiceHandler) logActivity(c *gin.Context, action, resource string, resourceID *uint, details string) {
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

func (h *InvoiceHandler) List(c *gin.Context) {
	var items []models.Invoice
	page, size := getPagination(c)
	if err := h.db.Preload("Booking").Order("id desc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	c.JSON(http.StatusOK, items)
}

type invoiceCreate struct {
	BookingID      uint    `json:"booking_id" binding:"required"`
	BasePrice      float64 `json:"base_price" binding:"required"`
	AdditionalFees float64 `json:"additional_fees"`
	Discount       float64 `json:"discount"`
	TotalAmount    float64 `json:"total_amount" binding:"required"`
}

func (h *InvoiceHandler) Create(c *gin.Context) {
	var req invoiceCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	inv := models.Invoice{
		BookingID:      req.BookingID,
		BasePrice:      req.BasePrice,
		AdditionalFees: req.AdditionalFees,
		Discount:       req.Discount,
		TotalAmount:    req.TotalAmount,
		PaymentStatus:  models.PaymentStatusPending, // Default to pending
	}
	if err := h.db.Create(&inv).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
	}

	h.logActivity(c, "create", "invoice", &inv.ID, fmt.Sprintf("Created invoice #%d for booking #%d, total: ₱%.2f", inv.ID, inv.BookingID, inv.TotalAmount))

	// Send email notification
	go func() {
		var booking models.Booking
		if err := h.db.First(&booking, inv.BookingID).Error; err != nil {
			return
		}
		var user models.User
		if err := h.db.First(&user, booking.UserID).Error; err != nil {
			return
		}
		h.emailService.SendInvoiceEmail(&inv, &booking, &user)
	}()

	c.JSON(http.StatusCreated, inv)
}

func (h *InvoiceHandler) Get(c *gin.Context) {
	var item models.Invoice
	if err := h.db.Preload("Booking").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

type invoiceUpdate struct {
	PaymentStatus *string    `json:"payment_status"`
	PaymentDate   *time.Time `json:"payment_date"`
	PaymentMethod *string    `json:"payment_method"`
	PaymentNotes  *string    `json:"payment_notes"`
}

func (h *InvoiceHandler) Update(c *gin.Context) {
	var item models.Invoice
	if err := h.db.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req invoiceUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update payment status if provided
	if req.PaymentStatus != nil {
		status := models.PaymentStatus(*req.PaymentStatus)
		// Validate payment status
		if status != models.PaymentStatusPending && status != models.PaymentStatusPaid &&
			status != models.PaymentStatusOverdue && status != models.PaymentStatusCancelled {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment status"})
			return
		}
		item.PaymentStatus = status

		// If marking as paid and no payment date provided, set to today
		if status == models.PaymentStatusPaid && item.PaymentDate == nil {
			now := time.Now()
			item.PaymentDate = &now
		}
	}

	// Update payment date if provided
	if req.PaymentDate != nil {
		item.PaymentDate = req.PaymentDate
	}

	// Update payment method if provided
	if req.PaymentMethod != nil {
		item.PaymentMethod = req.PaymentMethod
	}

	// Update payment notes if provided
	if req.PaymentNotes != nil {
		item.PaymentNotes = req.PaymentNotes
	}

	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	statusMsg := string(item.PaymentStatus)
	if item.PaymentDate != nil {
		statusMsg += fmt.Sprintf(" on %s", item.PaymentDate.Format("2006-01-02"))
	}
	h.logActivity(c, "update", "invoice", &item.ID, fmt.Sprintf("Updated invoice #%d payment status: %s", item.ID, statusMsg))

	c.JSON(http.StatusOK, item)
}

// CreateInvoiceForBooking automatically creates an invoice for an approved booking
// Returns the created invoice and any error
func CreateInvoiceForBooking(db *gorm.DB, bookingID uint, emailService *EmailService) (*models.Invoice, error) {
	// Check if invoice already exists for this booking
	var existingInvoice models.Invoice
	if err := db.Where("booking_id = ?", bookingID).First(&existingInvoice).Error; err == nil {
		// Invoice already exists, return it
		return &existingInvoice, nil
	}

	// Get booking with hall information
	var booking models.Booking
	if err := db.Preload("Hall").First(&booking, bookingID).Error; err != nil {
		return nil, fmt.Errorf("booking not found: %w", err)
	}

	// Verify hall is loaded
	if booking.Hall.ID == 0 {
		return nil, fmt.Errorf("hall not found for booking #%d", bookingID)
	}

	// Use hall price as base price
	basePrice := booking.Hall.Price
	if basePrice < 0 {
		basePrice = 0 // Default to 0 if invalid price
	}

	// Calculate total (base price + additional fees - discount)
	// For auto-generated invoices, additional fees and discount start at 0
	additionalFees := 0.0
	discount := 0.0
	totalAmount := basePrice + additionalFees - discount

	// Create invoice
	inv := models.Invoice{
		BookingID:      bookingID,
		BasePrice:      basePrice,
		AdditionalFees: additionalFees,
		Discount:       discount,
		TotalAmount:    totalAmount,
		PaymentStatus:  models.PaymentStatusPending,
	}

	if err := db.Create(&inv).Error; err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	// Send email notification asynchronously
	go func() {
		var user models.User
		if err := db.First(&user, booking.UserID).Error; err != nil {
			return
		}
		emailService.SendInvoiceEmail(&inv, &booking, &user)
	}()

	return &inv, nil
}

// CreateMissingInvoices creates invoices for all approved bookings that don't have one
func (h *InvoiceHandler) CreateMissingInvoices(c *gin.Context) {
	var approvedBookings []models.Booking
	if err := h.db.Where("status = ?", models.BookingStatusApproved).Find(&approvedBookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch bookings"})
		return
	}

	created := 0
	skipped := 0
	errors := []string{}

	for _, booking := range approvedBookings {
		// Check if invoice already exists
		var existingInvoice models.Invoice
		if err := h.db.Where("booking_id = ?", booking.ID).First(&existingInvoice).Error; err == nil {
			skipped++
			continue
		}

		// Create invoice
		inv, err := CreateInvoiceForBooking(h.db, booking.ID, h.emailService)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Booking #%d: %v", booking.ID, err))
			continue
		}
		created++
		fmt.Printf("Created invoice #%d for booking #%d\n", inv.ID, booking.ID)
	}

	h.logActivity(c, "create", "invoice", nil, fmt.Sprintf("Created %d missing invoices, skipped %d existing", created, skipped))

	c.JSON(http.StatusOK, gin.H{
		"created": created,
		"skipped": skipped,
		"errors":  errors,
		"message":  fmt.Sprintf("Created %d invoices, skipped %d that already had invoices", created, skipped),
	})
}
