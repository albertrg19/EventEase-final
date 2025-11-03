package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type BookingHandler struct{ db *gorm.DB }

func NewBookingHandler(db *gorm.DB) *BookingHandler { return &BookingHandler{db: db} }

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
	CustomerID      uint      `json:"customer_id" binding:"required"`
	UserID          uint      `json:"user_id" binding:"required"`
	EventName       string    `json:"event_name" binding:"required"`
	EventType       string    `json:"event_type" binding:"required"`
	EventCategoryID uint      `json:"event_category_id" binding:"required"`
	HallID          uint      `json:"hall_id" binding:"required"`
	EventDate       time.Time `json:"event_date" binding:"required"`
	Status          string    `json:"status"`
	AdminNotes      *string   `json:"admin_notes"`
}

func (h *BookingHandler) Create(c *gin.Context) {
	var req bookingUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Availability: prevent double-booking same hall & date (pending or approved)
	var count int64
	if err := h.db.Model(&models.Booking{}).
		Where("hall_id = ? AND event_date = ? AND status IN ?", req.HallID, req.EventDate, []string{"pending", "approved"}).
		Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "availability check failed"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "hall already booked for that date"})
		return
	}
	item := models.Booking{
		CustomerID:      req.CustomerID,
		UserID:          req.UserID,
		EventName:       req.EventName,
		EventType:       req.EventType,
		EventCategoryID: req.EventCategoryID,
		HallID:          req.HallID,
		EventDate:       req.EventDate,
		AdminNotes:      req.AdminNotes,
	}
	if req.Status != "" {
		item.Status = models.BookingStatus(req.Status)
	}
	if err := h.db.Create(&item).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
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
	// If hall/date changed, re-check availability
	if !(item.HallID == req.HallID && item.EventDate.Equal(req.EventDate)) {
		var count int64
		if err := h.db.Model(&models.Booking{}).
			Where("hall_id = ? AND event_date = ? AND id <> ? AND status IN ?", req.HallID, req.EventDate, item.ID, []string{"pending", "approved"}).
			Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "availability check failed"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "hall already booked for that date"})
			return
		}
	}
	item.CustomerID = req.CustomerID
	item.UserID = req.UserID
	item.EventName = req.EventName
	item.EventType = req.EventType
	item.EventCategoryID = req.EventCategoryID
	item.HallID = req.HallID
	item.EventDate = req.EventDate
	item.AdminNotes = req.AdminNotes
	if req.Status != "" {
		item.Status = models.BookingStatus(req.Status)
	}
	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *BookingHandler) Delete(c *gin.Context) {
	if err := h.db.Delete(&models.Booking{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.Status(http.StatusNoContent)
}
