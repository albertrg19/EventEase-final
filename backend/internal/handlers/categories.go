package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

func (h *CategoryHandler) logActivity(c *gin.Context, action, resource string, resourceID *uint, details string) {
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

func (h *CategoryHandler) List(c *gin.Context) {
	var items []models.EventCategory
	page, size := getPagination(c)
	if err := h.db.Order("id asc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	c.JSON(http.StatusOK, items)
}

type categoryCreate struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Image       *string `json:"image"`
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var req categoryCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cat := models.EventCategory{Name: req.Name, Description: req.Description, Image: req.Image}
	if err := h.db.Create(&cat).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
	}
	h.logActivity(c, "create", "category", &cat.ID, fmt.Sprintf("Created category: %s", cat.Name))
	c.JSON(http.StatusCreated, cat)
}

func (h *CategoryHandler) Get(c *gin.Context) {
	var cat models.EventCategory
	if err := h.db.First(&cat, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	var cat models.EventCategory
	if err := h.db.First(&cat, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req categoryCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	oldName := cat.Name
	cat.Name = req.Name
	cat.Description = req.Description
	cat.Image = req.Image
	if err := h.db.Save(&cat).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	h.logActivity(c, "update", "category", &cat.ID, fmt.Sprintf("Updated category: %s -> %s", oldName, cat.Name))
	c.JSON(http.StatusOK, cat)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	var cat models.EventCategory
	if err := h.db.First(&cat, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	catID := cat.ID
	catName := cat.Name
	// Update DeletedBy before soft deleting
	if id, exists := c.Get("userId"); exists {
		var uid uint
		switch v := id.(type) {
		case float64:
			uid = uint(v)
		case uint:
			uid = v
		case int:
			uid = uint(v)
		}
		if uid > 0 {
			h.db.Model(&models.EventCategory{}).Where("id = ?", catID).Update("deleted_by", uid)
		}
	}

	if err := h.db.Delete(&models.EventCategory{}, catID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	h.logActivity(c, "delete", "category", &catID, fmt.Sprintf("Deleted category: %s", catName))
	c.Status(http.StatusNoContent)
}
