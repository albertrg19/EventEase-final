package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type ChatTemplateHandler struct {
	db *gorm.DB
}

func NewChatTemplateHandler(db *gorm.DB) *ChatTemplateHandler {
	return &ChatTemplateHandler{db: db}
}

// ListTemplates returns all chat templates
func (h *ChatTemplateHandler) ListTemplates(c *gin.Context) {
	category := c.Query("category")
	
	var templates []models.ChatTemplate
	query := h.db.Model(&models.ChatTemplate{}).Preload("Creator")
	
	if category != "" {
		query = query.Where("category = ?", category)
	}
	
	if err := query.Order("created_at DESC").Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch templates"})
		return
	}
	
	c.JSON(http.StatusOK, templates)
}

// GetTemplate returns a single template
func (h *ChatTemplateHandler) GetTemplate(c *gin.Context) {
	id := c.Param("id")
	
	var template models.ChatTemplate
	if err := h.db.Preload("Creator").First(&template, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}
	
	c.JSON(http.StatusOK, template)
}

// CreateTemplate creates a new template
func (h *ChatTemplateHandler) CreateTemplate(c *gin.Context) {
	userID, _ := c.Get("userId")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	} else if id, ok := userID.(uint); ok {
		uid = id
	}
	
	var req struct {
		Title    string  `json:"title" binding:"required"`
		Content  string  `json:"content" binding:"required"`
		Category *string `json:"category"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	template := models.ChatTemplate{
		Title:     req.Title,
		Content:   req.Content,
		Category:  req.Category,
		CreatedBy: uid,
	}
	
	if err := h.db.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create template"})
		return
	}
	
	h.db.Preload("Creator").First(&template, template.ID)
	c.JSON(http.StatusCreated, template)
}

// UpdateTemplate updates an existing template
func (h *ChatTemplateHandler) UpdateTemplate(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("userId")
	uid := uint(0)
	if idVal, ok := userID.(float64); ok {
		uid = uint(idVal)
	} else if idVal, ok := userID.(uint); ok {
		uid = idVal
	}
	
	var template models.ChatTemplate
	if err := h.db.First(&template, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}
	
	// Only creator can update
	if template.CreatedBy != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only update your own templates"})
		return
	}
	
	var req struct {
		Title    string  `json:"title"`
		Content  string  `json:"content"`
		Category *string `json:"category"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if req.Title != "" {
		template.Title = req.Title
	}
	if req.Content != "" {
		template.Content = req.Content
	}
	if req.Category != nil {
		template.Category = req.Category
	}
	
	if err := h.db.Save(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update template"})
		return
	}
	
	h.db.Preload("Creator").First(&template, template.ID)
	c.JSON(http.StatusOK, template)
}

// DeleteTemplate deletes a template
func (h *ChatTemplateHandler) DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("userId")
	uid := uint(0)
	if idVal, ok := userID.(float64); ok {
		uid = uint(idVal)
	} else if idVal, ok := userID.(uint); ok {
		uid = idVal
	}
	
	var template models.ChatTemplate
	if err := h.db.First(&template, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}
	
	// Only creator can delete
	if template.CreatedBy != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete your own templates"})
		return
	}
	
	if err := h.db.Delete(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete template"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "template deleted"})
}

