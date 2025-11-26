package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type AdminActivityHandler struct {
	db *gorm.DB
}

func NewAdminActivityHandler(db *gorm.DB) *AdminActivityHandler {
	return &AdminActivityHandler{db: db}
}

func (h *AdminActivityHandler) List(c *gin.Context) {
	var activities []models.AdminActivity
	page, size := getPagination(c)
	if err := h.db.Order("id desc").Limit(size).Offset((page - 1) * size).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list activities"})
		return
	}
	c.JSON(http.StatusOK, activities)
}

func (h *AdminActivityHandler) LogActivity(userID uint, userEmail, action, resource string, resourceID *uint, details, ipAddress string) {
	activity := models.AdminActivity{
		UserID:     userID,
		UserEmail:  userEmail,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    details,
		IPAddress:  ipAddress,
	}
	h.db.Create(&activity)
}

func LogAdminActivity(db *gorm.DB, userID uint, userEmail, action, resource string, resourceID *uint, details, ipAddress string) {
	activity := models.AdminActivity{
		UserID:     userID,
		UserEmail:  userEmail,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    details,
		IPAddress:  ipAddress,
	}
	db.Create(&activity)
}


