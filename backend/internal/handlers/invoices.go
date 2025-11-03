package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type InvoiceHandler struct{ db *gorm.DB }

func NewInvoiceHandler(db *gorm.DB) *InvoiceHandler { return &InvoiceHandler{db: db} }

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
	c.JSON(http.StatusCreated, inv)
}
