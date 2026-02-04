package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

// parseDateString parses a date string in various formats and returns a time.Time
// Supports: YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, RFC3339, RFC3339Nano
func parseDateString(dateStr string) (*time.Time, error) {
	if dateStr == "" {
		return nil, nil
	}

	// Try parsing as date-only format first (YYYY-MM-DD)
	if t, err := time.Parse("2006-01-02", dateStr); err == nil {
		return &t, nil
	}

	// Try parsing as date with time (YYYY-MM-DDTHH:MM:SS)
	if t, err := time.Parse("2006-01-02T15:04:05", dateStr); err == nil {
		return &t, nil
	}

	// Try parsing as RFC3339 (full datetime with timezone)
	if t, err := time.Parse(time.RFC3339, dateStr); err == nil {
		return &t, nil
	}

	// Try parsing as RFC3339Nano
	if t, err := time.Parse(time.RFC3339Nano, dateStr); err == nil {
		return &t, nil
	}

	return nil, fmt.Errorf("invalid date format: %s", dateStr)
}

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
	
	query := h.db.Preload("Booking")
	
	// Filter by payment status
	if status := c.Query("payment_status"); status != "" && status != "all" {
		query = query.Where("payment_status = ?", status)
	}
	
	// Filter by booking ID
	if bookingID := c.Query("booking_id"); bookingID != "" {
		query = query.Where("booking_id = ?", bookingID)
	}
	
	// Filter by date range (created_at)
	if createdFrom := c.Query("created_from"); createdFrom != "" {
		parsedDate, err := parseDateString(createdFrom)
		if err == nil && parsedDate != nil {
			query = query.Where("created_at >= ?", *parsedDate)
		}
	}
	
	if createdTo := c.Query("created_to"); createdTo != "" {
		parsedDate, err := parseDateString(createdTo)
		if err == nil && parsedDate != nil {
			// Add 1 day to include the end date fully
			endDate := parsedDate.AddDate(0, 0, 1)
			query = query.Where("created_at < ?", endDate)
		}
	}
	
	if err := query.Order("id desc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
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
	PaymentStatus *string `json:"payment_status"`
	PaymentDate   *string `json:"payment_date"` // Accept as string, parse manually
	PaymentMethod *string `json:"payment_method"`
	PaymentNotes  *string `json:"payment_notes"`
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
	if req.PaymentDate != nil && *req.PaymentDate != "" {
		parsedDate, err := parseDateString(*req.PaymentDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid payment_date format: %v", err)})
			return
		}
		if parsedDate != nil {
			item.PaymentDate = parsedDate
		}
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
		fmt.Printf("ERROR: Invoice creation failed - booking #%d not found: %v\n", bookingID, err)
		return nil, fmt.Errorf("booking not found: %w", err)
	}

	// Verify hall is loaded
	if booking.Hall.ID == 0 {
		fmt.Printf("ERROR: Invoice creation failed - hall not found for booking #%d (HallID: %d)\n", bookingID, booking.HallID)
		return nil, fmt.Errorf("hall not found for booking #%d", bookingID)
	}

	fmt.Printf("DEBUG: Creating invoice for booking #%d (Hall: %s, Price: ₱%.2f)\n", bookingID, booking.Hall.Name, booking.Hall.Price)

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

	// Set payment deadline (7 days from invoice creation by default)
	deadline := time.Now().AddDate(0, 0, 7)

	// Create invoice
	inv := models.Invoice{
		BookingID:       bookingID,
		BasePrice:       basePrice,
		AdditionalFees:  additionalFees,
		Discount:        discount,
		TotalAmount:     totalAmount,
		PaymentStatus:   models.PaymentStatusPending,
		PaymentDeadline: &deadline,
		DaysOverdue:     0,
	}

	if err := db.Create(&inv).Error; err != nil {
		fmt.Printf("ERROR: Failed to create invoice in database for booking #%d: %v\n", bookingID, err)
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	fmt.Printf("SUCCESS: Created invoice #%d for booking #%d (Total: ₱%.2f)\n", inv.ID, bookingID, inv.TotalAmount)

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
	// Use case-sensitive status check
	if err := h.db.Where("LOWER(status) = ?", "approved").Find(&approvedBookings).Error; err != nil {
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
		"message": fmt.Sprintf("Created %d invoices, skipped %d that already had invoices", created, skipped),
	})
}

// CreateMyMissingInvoices creates invoices for the current user's approved bookings that don't have one
func (h *InvoiceHandler) CreateMyMissingInvoices(c *gin.Context) {
	// Get current user ID
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

	// Get user's approved bookings without invoices
	var approvedBookings []models.Booking
	// Use case-insensitive status check
	if err := h.db.Where("user_id = ? AND LOWER(status) = ?", uid, "approved").
		Preload("Hall").Find(&approvedBookings).Error; err != nil {
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

		// Verify hall is loaded and has valid price
		if booking.Hall.ID == 0 {
			errors = append(errors, fmt.Sprintf("Booking #%d: hall not found", booking.ID))
			continue
		}

		// Create invoice
		inv, err := CreateInvoiceForBooking(h.db, booking.ID, h.emailService)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Booking #%d: %v", booking.ID, err))
			fmt.Printf("ERROR: Failed to create invoice for booking #%d: %v\n", booking.ID, err)
			continue
		}
		created++
		fmt.Printf("SUCCESS: Created invoice #%d for booking #%d (Total: ₱%.2f)\n", inv.ID, booking.ID, inv.TotalAmount)
	}

	c.JSON(http.StatusOK, gin.H{
		"created": created,
		"skipped": skipped,
		"errors":  errors,
		"message": fmt.Sprintf("Created %d invoices, skipped %d that already had invoices", created, skipped),
	})
}

// Delete removes an invoice (only non-paid invoices can be deleted)
func (h *InvoiceHandler) Delete(c *gin.Context) {
	var item models.Invoice
	if err := h.db.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Prevent deletion of paid invoices for audit trail
	if item.PaymentStatus == models.PaymentStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete paid invoices. Paid invoices must be kept for audit purposes."})
		return
	}

	invoiceID := item.ID
	bookingID := item.BookingID
	if err := h.db.Delete(&models.Invoice{}, invoiceID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete invoice"})
		return
	}

	h.logActivity(c, "delete", "invoice", &invoiceID, fmt.Sprintf("Deleted invoice #%d for booking #%d", invoiceID, bookingID))

	c.JSON(http.StatusOK, gin.H{"message": "Invoice deleted successfully"})
}

// SendEmail resends the invoice email to the customer
func (h *InvoiceHandler) SendEmail(c *gin.Context) {
	var item models.Invoice
	if err := h.db.Preload("Booking").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Get user information
	var user models.User
	if err := h.db.First(&user, item.Booking.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Send email
	if err := h.emailService.SendInvoiceEmail(&item, &item.Booking, &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send email: %v", err)})
		return
	}

	h.logActivity(c, "send_email", "invoice", &item.ID, fmt.Sprintf("Sent invoice #%d email to %s", item.ID, user.Email))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Invoice email sent to %s", user.Email),
		"email":   user.Email,
	})
}

// SendReminder sends a payment reminder email to the customer
func (h *InvoiceHandler) SendReminder(c *gin.Context) {
	var item models.Invoice
	if err := h.db.Preload("Booking").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Cannot send reminder for paid invoices
	if item.PaymentStatus == models.PaymentStatusPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot send reminder for paid invoices"})
		return
	}

	// Get user information
	var user models.User
	if err := h.db.First(&user, item.Booking.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Send reminder email
	if err := h.emailService.SendPaymentReminder(&item, &item.Booking, &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send reminder: %v", err)})
		return
	}

	h.logActivity(c, "send_reminder", "invoice", &item.ID, fmt.Sprintf("Sent payment reminder for invoice #%d to %s", item.ID, user.Email))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Payment reminder sent to %s", user.Email),
		"email":   user.Email,
	})
}

// GeneratePDF generates a PDF invoice using gofpdf
func (h *InvoiceHandler) GeneratePDF(c *gin.Context) {
	var item models.Invoice
	if err := h.db.Preload("Booking").Preload("Booking.Hall").Preload("Booking.User").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Generate PDF
	pdfBytes, err := generateInvoicePDF(&item)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate PDF: %v", err)})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=invoice_%d.pdf", item.ID))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func generateInvoiceHTML(invoice *models.Invoice) string {
	paymentStatus := string(invoice.PaymentStatus)
	paymentDate := ""
	if invoice.PaymentDate != nil {
		paymentDate = invoice.PaymentDate.Format("January 2, 2006")
	}
	paymentMethod := ""
	if invoice.PaymentMethod != nil {
		paymentMethod = *invoice.PaymentMethod
	}
	paymentDeadline := ""
	if invoice.PaymentDeadline != nil {
		paymentDeadline = invoice.PaymentDeadline.Format("January 2, 2006")
	}
	customerName := ""
	customerEmail := ""
	if invoice.Booking.User.ID != 0 {
		customerName = invoice.Booking.User.Name
		customerEmail = invoice.Booking.User.Email
	}
	venueName := ""
	venueLocation := ""
	if invoice.Booking.Hall.ID != 0 {
		venueName = invoice.Booking.Hall.Name
		venueLocation = invoice.Booking.Hall.Location
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice #%d - EventEase</title>
    <style>
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; padding: 20px; }
        .invoice-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1e3a5f 0%%, #2d5a87 100%%); color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 28px; }
        .header .invoice-label { font-size: 14px; opacity: 0.9; }
        .header .invoice-number { font-size: 24px; font-weight: bold; }
        .content { padding: 30px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .info-section h3 { color: #1e3a5f; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .info-section p { color: #333; margin: 5px 0; }
        .info-section .label { color: #6c757d; font-size: 12px; }
        .items-table { width: 100%%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background: #f8f9fa; color: #1e3a5f; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .items-table td { padding: 12px; border-bottom: 1px solid #e9ecef; }
        .items-table .amount { text-align: right; font-weight: 500; }
        .totals { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .totals-row.total { font-size: 24px; font-weight: bold; color: #1e3a5f; border-top: 2px solid #1e3a5f; padding-top: 15px; margin-top: 10px; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-paid { background: #d4edda; color: #155724; }
        .status-overdue { background: #f8d7da; color: #721c24; }
        .status-cancelled { background: #e9ecef; color: #6c757d; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; }
        .print-btn { background: #1e3a5f; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; margin: 20px auto; display: block; }
        .print-btn:hover { background: #2d5a87; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                <h1>EventEase</h1>
                <p style="opacity: 0.9; margin-top: 5px;">Venue Reservation System</p>
            </div>
            <div style="text-align: right;">
                <p class="invoice-label">INVOICE</p>
                <p class="invoice-number">#%d</p>
                <p style="margin-top: 10px; font-size: 14px;">%s</p>
            </div>
        </div>
        
        <div class="content">
            <div class="info-grid">
                <div class="info-section">
                    <h3>Bill To</h3>
                    <p style="font-weight: 600; font-size: 18px;">%s</p>
                    <p>%s</p>
                </div>
                <div class="info-section" style="text-align: right;">
                    <h3>Invoice Details</h3>
                    <p><span class="label">Status:</span> <span class="status-badge status-%s">%s</span></p>
                    <p><span class="label">Event Date:</span> %s</p>
                    %s
                    %s
                    %s
                </div>
            </div>
            
            <div class="info-section" style="margin-bottom: 20px;">
                <h3>Event Details</h3>
                <p style="font-weight: 600; font-size: 16px;">%s</p>
                <p><span class="label">Venue:</span> %s</p>
                <p><span class="label">Location:</span> %s</p>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Venue Rental - %s</td>
                        <td class="amount">₱%.2f</td>
                    </tr>
                    %s
                    %s
                </tbody>
            </table>
            
            <div class="totals">
                <div class="totals-row">
                    <span>Subtotal</span>
                    <span>₱%.2f</span>
                </div>
                %s
                %s
                <div class="totals-row total">
                    <span>Total Amount</span>
                    <span>₱%.2f</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Thank you for choosing EventEase!</p>
            <p style="margin-top: 5px;">For questions, please contact our support team.</p>
        </div>
    </div>
    
    <button class="print-btn no-print" onclick="window.print()">🖨️ Print Invoice</button>
</body>
</html>`,
		invoice.ID,
		invoice.ID,
		invoice.CreatedAt.Format("January 2, 2006"),
		customerName,
		customerEmail,
		paymentStatus,
		paymentStatus,
		invoice.Booking.EventDate.Format("January 2, 2006"),
		func() string {
			if paymentDeadline != "" {
				return fmt.Sprintf(`<p><span class="label">Payment Deadline:</span> %s</p>`, paymentDeadline)
			}
			return ""
		}(),
		func() string {
			if paymentDate != "" {
				return fmt.Sprintf(`<p><span class="label">Payment Date:</span> %s</p>`, paymentDate)
			}
			return ""
		}(),
		func() string {
			if paymentMethod != "" {
				return fmt.Sprintf(`<p><span class="label">Payment Method:</span> %s</p>`, paymentMethod)
			}
			return ""
		}(),
		invoice.Booking.EventName,
		venueName,
		venueLocation,
		venueName,
		invoice.BasePrice,
		func() string {
			if invoice.AdditionalFees > 0 {
				return fmt.Sprintf(`<tr><td>Additional Fees</td><td class="amount">₱%.2f</td></tr>`, invoice.AdditionalFees)
			}
			return ""
		}(),
		func() string {
			if invoice.Discount > 0 {
				return fmt.Sprintf(`<tr><td>Discount</td><td class="amount" style="color: #28a745;">-₱%.2f</td></tr>`, invoice.Discount)
			}
			return ""
		}(),
		invoice.BasePrice,
		func() string {
			if invoice.AdditionalFees > 0 {
				return fmt.Sprintf(`<div class="totals-row"><span>Additional Fees</span><span>₱%.2f</span></div>`, invoice.AdditionalFees)
			}
			return ""
		}(),
		func() string {
			if invoice.Discount > 0 {
				return fmt.Sprintf(`<div class="totals-row"><span>Discount</span><span style="color: #28a745;">-₱%.2f</span></div>`, invoice.Discount)
			}
			return ""
		}(),
		invoice.TotalAmount,
	)

	return html
}

// generateInvoicePDF creates a PDF invoice using gofpdf
func generateInvoicePDF(invoice *models.Invoice) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	// Colors
	headerR, headerG, headerB := 30, 58, 95   // #1e3a5f - Dark blue
	grayR, grayG, grayB := 108, 117, 125      // #6c757d - Gray

	// Header background
	pdf.SetFillColor(headerR, headerG, headerB)
	pdf.Rect(0, 0, 210, 45, "F")

	// Header text
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 24)
	pdf.SetXY(15, 15)
	pdf.Cell(100, 10, "EventEase")
	pdf.SetFont("Arial", "", 10)
	pdf.SetXY(15, 27)
	pdf.Cell(100, 5, "Venue Reservation System")

	// Invoice number on right
	pdf.SetFont("Arial", "", 10)
	pdf.SetXY(140, 12)
	pdf.Cell(55, 5, "INVOICE")
	pdf.SetFont("Arial", "B", 18)
	pdf.SetXY(140, 20)
	pdf.Cell(55, 8, fmt.Sprintf("#%d", invoice.ID))
	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(140, 32)
	pdf.Cell(55, 5, invoice.CreatedAt.Format("January 2, 2006"))

	// Reset position after header
	pdf.SetY(55)
	pdf.SetTextColor(0, 0, 0)

	// Customer info
	customerName := ""
	customerEmail := ""
	if invoice.Booking.User.ID != 0 {
		customerName = invoice.Booking.User.Name
		customerEmail = invoice.Booking.User.Email
	}

	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(headerR, headerG, headerB)
	pdf.Cell(0, 6, "BILL TO")
	pdf.Ln(8)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 6, customerName)
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.Cell(0, 5, customerEmail)
	pdf.Ln(12)

	// Event details
	pdf.SetTextColor(headerR, headerG, headerB)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(0, 6, "EVENT DETAILS")
	pdf.Ln(8)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(0, 6, invoice.Booking.EventName)
	pdf.Ln(7)

	venueName := ""
	venueLocation := ""
	if invoice.Booking.Hall.ID != 0 {
		venueName = invoice.Booking.Hall.Name
		venueLocation = invoice.Booking.Hall.Location
	}

	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.Cell(30, 5, "Venue:")
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 5, venueName)
	pdf.Ln(6)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.Cell(30, 5, "Location:")
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 5, venueLocation)
	pdf.Ln(6)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.Cell(30, 5, "Event Date:")
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 5, invoice.Booking.EventDate.Format("January 2, 2006"))
	pdf.Ln(6)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.Cell(30, 5, "Status:")
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 5, string(invoice.PaymentStatus))
	pdf.Ln(15)

	// Items table header
	pdf.SetFillColor(248, 249, 250) // #f8f9fa
	pdf.SetTextColor(headerR, headerG, headerB)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(130, 10, "DESCRIPTION", "B", 0, "L", true, 0, "")
	pdf.CellFormat(50, 10, "AMOUNT", "B", 0, "R", true, 0, "")
	pdf.Ln(12)

	// Items
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(130, 8, fmt.Sprintf("Venue Rental - %s", venueName))
	pdf.Cell(50, 8, fmt.Sprintf("P%.2f", invoice.BasePrice))
	pdf.Ln(10)

	if invoice.AdditionalFees > 0 {
		pdf.Cell(130, 8, "Additional Fees")
		pdf.Cell(50, 8, fmt.Sprintf("P%.2f", invoice.AdditionalFees))
		pdf.Ln(10)
	}

	if invoice.Discount > 0 {
		pdf.SetTextColor(40, 167, 69) // Green
		pdf.Cell(130, 8, "Discount")
		pdf.Cell(50, 8, fmt.Sprintf("-P%.2f", invoice.Discount))
		pdf.SetTextColor(0, 0, 0)
		pdf.Ln(10)
	}

	// Totals section
	pdf.Ln(5)
	pdf.SetFillColor(248, 249, 250)
	pdf.SetDrawColor(headerR, headerG, headerB)

	// Subtotal
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(130, 10, "Subtotal", "", 0, "R", false, 0, "")
	pdf.CellFormat(50, 10, fmt.Sprintf("P%.2f", invoice.BasePrice), "", 0, "R", false, 0, "")
	pdf.Ln(10)

	if invoice.AdditionalFees > 0 {
		pdf.CellFormat(130, 10, "Additional Fees", "", 0, "R", false, 0, "")
		pdf.CellFormat(50, 10, fmt.Sprintf("P%.2f", invoice.AdditionalFees), "", 0, "R", false, 0, "")
		pdf.Ln(10)
	}

	if invoice.Discount > 0 {
		pdf.SetTextColor(40, 167, 69)
		pdf.CellFormat(130, 10, "Discount", "", 0, "R", false, 0, "")
		pdf.CellFormat(50, 10, fmt.Sprintf("-P%.2f", invoice.Discount), "", 0, "R", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.Ln(10)
	}

	// Total line
	pdf.SetDrawColor(headerR, headerG, headerB)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(5)
	pdf.SetFont("Arial", "B", 14)
	pdf.SetTextColor(headerR, headerG, headerB)
	pdf.CellFormat(130, 12, "TOTAL AMOUNT", "", 0, "R", false, 0, "")
	pdf.CellFormat(50, 12, fmt.Sprintf("P%.2f", invoice.TotalAmount), "", 0, "R", false, 0, "")
	pdf.Ln(15)

	// Payment info
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetFont("Arial", "", 9)
	if invoice.PaymentDeadline != nil {
		pdf.Cell(0, 5, fmt.Sprintf("Payment Deadline: %s", invoice.PaymentDeadline.Format("January 2, 2006")))
		pdf.Ln(5)
	}
	if invoice.PaymentDate != nil {
		pdf.Cell(0, 5, fmt.Sprintf("Payment Date: %s", invoice.PaymentDate.Format("January 2, 2006")))
		pdf.Ln(5)
	}
	if invoice.PaymentMethod != nil && *invoice.PaymentMethod != "" {
		pdf.Cell(0, 5, fmt.Sprintf("Payment Method: %s", *invoice.PaymentMethod))
		pdf.Ln(5)
	}

	// Footer
	pdf.SetY(-30)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 5, "Thank you for choosing EventEase!", "", 0, "C", false, 0, "")
	pdf.Ln(5)
	pdf.CellFormat(0, 5, "For questions, please contact our support team.", "", 0, "C", false, 0, "")

	// Output to bytes
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
