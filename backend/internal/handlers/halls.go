package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type HallHandler struct{ db *gorm.DB }

func NewHallHandler(db *gorm.DB) *HallHandler { return &HallHandler{db: db} }

func (h *HallHandler) logActivity(c *gin.Context, action, resource string, resourceID *uint, details string) {
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

func (h *HallHandler) List(c *gin.Context) {
	var items []models.EventHall
	page, size := getPagination(c)
	if err := h.db.Order("id asc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	c.JSON(http.StatusOK, items)
}

type hallUpsert struct {
	Name        string  `json:"name" binding:"required"`
	Location    string  `json:"location"`
	Capacity    int     `json:"capacity"`
	Description *string `json:"description"`
	Price       float64 `json:"price"`
	MaxCapacity int     `json:"max_capacity"`
	Photo       *string `json:"photo"`
}

func (h *HallHandler) Create(c *gin.Context) {
	var req hallUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hall := models.EventHall{
		Name: req.Name, Location: req.Location, Capacity: req.Capacity, Description: req.Description,
		Price: req.Price, MaxCapacity: req.MaxCapacity, Photo: req.Photo,
	}
	if err := h.db.Create(&hall).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
	}
	h.logActivity(c, "create", "hall", &hall.ID, fmt.Sprintf("Created hall: %s", hall.Name))
	c.JSON(http.StatusCreated, hall)
}

func (h *HallHandler) Get(c *gin.Context) {
	var hall models.EventHall
	if err := h.db.First(&hall, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, hall)
}

func (h *HallHandler) Update(c *gin.Context) {
	var hall models.EventHall
	if err := h.db.First(&hall, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req hallUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	oldName := hall.Name
	hall.Name = req.Name
	hall.Location = req.Location
	hall.Capacity = req.Capacity
	hall.Description = req.Description
	hall.Price = req.Price
	hall.MaxCapacity = req.MaxCapacity
	hall.Photo = req.Photo
	if err := h.db.Save(&hall).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	h.logActivity(c, "update", "hall", &hall.ID, fmt.Sprintf("Updated hall: %s -> %s", oldName, hall.Name))
	c.JSON(http.StatusOK, hall)
}

func (h *HallHandler) Delete(c *gin.Context) {
	var hall models.EventHall
	if err := h.db.First(&hall, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	hallID := hall.ID
	hallName := hall.Name
	
	// Check for related bookings
	var bookingCount int64
	if err := h.db.Model(&models.Booking{}).Where("hall_id = ?", hallID).Count(&bookingCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check bookings: %v", err)})
		return
	}
	if bookingCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("This hall cannot be deleted because it has %d booking(s) associated with it. Please remove or cancel all bookings first.", bookingCount),
		})
		return
	}
	
	// Check for related events
	var eventCount int64
	if err := h.db.Model(&models.Event{}).Where("hall_id = ?", hallID).Count(&eventCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to check events: %v", err)})
		return
	}
	if eventCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("This hall cannot be deleted because it has %d event(s) associated with it. Please remove all events first.", eventCount),
		})
		return
	}
	
	// Attempt to delete the hall
	if err := h.db.Delete(&models.EventHall{}, hallID).Error; err != nil {
		// Check if it's a foreign key constraint error
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "foreign key") || strings.Contains(errStr, "constraint") || strings.Contains(errStr, "references") {
			c.JSON(http.StatusConflict, gin.H{
				"error": "This hall cannot be deleted because it has bookings or events associated with it. Please remove all related records first.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("delete failed: %v", err)})
		return
	}
	
	// Log activity (non-blocking - don't fail if logging fails)
	func() {
		defer func() {
			if r := recover(); r != nil {
				// Silently ignore logging errors - don't fail the delete operation
			}
		}()
		h.logActivity(c, "delete", "hall", &hallID, fmt.Sprintf("Deleted hall: %s", hallName))
	}()
	
	c.Status(http.StatusNoContent)
}
