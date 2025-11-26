package handlers

import (
	"fmt"
	"net/http"

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
