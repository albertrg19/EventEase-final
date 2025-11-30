package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type FavoriteHandler struct {
	db *gorm.DB
}

func NewFavoriteHandler(db *gorm.DB) *FavoriteHandler {
	return &FavoriteHandler{db: db}
}

// List returns all favorites for the current user
func (h *FavoriteHandler) List(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	var favorites []models.Favorite
	if err := h.db.Preload("Hall").Where("user_id = ?", uid).Order("created_at desc").Find(&favorites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list favorites"})
		return
	}

	c.JSON(http.StatusOK, favorites)
}

type favoriteRequest struct {
	HallID uint `json:"hall_id" binding:"required"`
}

// Add adds a venue to favorites
func (h *FavoriteHandler) Add(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	var req favoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if hall exists
	var hall models.EventHall
	if err := h.db.First(&hall, req.HallID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "venue not found"})
		return
	}

	// Check if already favorited
	var existing models.Favorite
	if err := h.db.Where("user_id = ? AND hall_id = ?", uid, req.HallID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "venue already in favorites"})
		return
	}

	favorite := models.Favorite{
		UserID: uid,
		HallID: req.HallID,
	}

	if err := h.db.Create(&favorite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to favorites"})
		return
	}

	// Load the hall relation for response
	h.db.Preload("Hall").First(&favorite, favorite.ID)

	c.JSON(http.StatusCreated, favorite)
}

// Remove removes a venue from favorites
func (h *FavoriteHandler) Remove(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	hallID := c.Param("hall_id")

	var favorite models.Favorite
	if err := h.db.Where("user_id = ? AND hall_id = ?", uid, hallID).First(&favorite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "favorite not found"})
		return
	}

	if err := h.db.Delete(&favorite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from favorites"})
		return
	}

	c.Status(http.StatusNoContent)
}

// Check checks if a venue is in user's favorites
func (h *FavoriteHandler) Check(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	hallID := c.Param("hall_id")

	var favorite models.Favorite
	if err := h.db.Where("user_id = ? AND hall_id = ?", uid, hallID).First(&favorite).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"is_favorite": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_favorite": true, "favorite": favorite})
}

