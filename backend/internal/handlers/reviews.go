package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type ReviewHandler struct {
	db *gorm.DB
}

func NewReviewHandler(db *gorm.DB) *ReviewHandler {
	return &ReviewHandler{db: db}
}

// ListByHall returns all reviews for a specific hall/venue
func (h *ReviewHandler) ListByHall(c *gin.Context) {
	hallID := c.Param("hall_id")

	var reviews []models.Review
	if err := h.db.Preload("User").Where("hall_id = ?", hallID).Order("created_at desc").Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list reviews"})
		return
	}

	// Calculate average rating
	var avgRating float64
	var totalReviews int64
	h.db.Model(&models.Review{}).Where("hall_id = ?", hallID).Count(&totalReviews)
	if totalReviews > 0 {
		h.db.Model(&models.Review{}).Where("hall_id = ?", hallID).Select("AVG(rating)").Scan(&avgRating)
	}

	c.JSON(http.StatusOK, gin.H{
		"reviews":       reviews,
		"total_reviews": totalReviews,
		"avg_rating":    avgRating,
	})
}

// ListByUser returns all reviews by the current user
func (h *ReviewHandler) ListByUser(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	var reviews []models.Review
	if err := h.db.Preload("Hall").Where("user_id = ?", uid).Order("created_at desc").Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list reviews"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}

type reviewRequest struct {
	HallID    uint   `json:"hall_id" binding:"required"`
	BookingID uint   `json:"booking_id" binding:"required"`
	Rating    int    `json:"rating" binding:"required,min=1,max=5"`
	Comment   string `json:"comment"`
}

// Create creates a new review
func (h *ReviewHandler) Create(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	var req reviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify booking exists and belongs to user
	var booking models.Booking
	if err := h.db.Where("id = ? AND user_id = ?", req.BookingID, uid).First(&booking).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "booking not found or not yours"})
		return
	}

	// Check if booking is approved (completed)
	if booking.Status != models.BookingStatusApproved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only review approved bookings"})
		return
	}

	// Check if hall matches booking
	if booking.HallID != req.HallID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hall does not match booking"})
		return
	}

	// Check if already reviewed this booking
	var existingReview models.Review
	if err := h.db.Where("booking_id = ?", req.BookingID).First(&existingReview).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "you have already reviewed this booking"})
		return
	}

	review := models.Review{
		UserID:    uid,
		HallID:    req.HallID,
		BookingID: req.BookingID,
		Rating:    req.Rating,
		Comment:   req.Comment,
	}

	if err := h.db.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create review"})
		return
	}

	// Load relations for response
	h.db.Preload("User").Preload("Hall").First(&review, review.ID)

	c.JSON(http.StatusCreated, review)
}

type reviewUpdateRequest struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

// Update updates an existing review
func (h *ReviewHandler) Update(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	reviewID := c.Param("id")

	var review models.Review
	if err := h.db.Where("id = ? AND user_id = ?", reviewID, uid).First(&review).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found or not yours"})
		return
	}

	var req reviewUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	review.Rating = req.Rating
	review.Comment = req.Comment

	if err := h.db.Save(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update review"})
		return
	}

	// Load relations for response
	h.db.Preload("User").Preload("Hall").First(&review, review.ID)

	c.JSON(http.StatusOK, review)
}

// Delete deletes a review
func (h *ReviewHandler) Delete(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	reviewID := c.Param("id")

	var review models.Review
	if err := h.db.Where("id = ? AND user_id = ?", reviewID, uid).First(&review).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found or not yours"})
		return
	}

	if err := h.db.Delete(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete review"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetHallStats returns review statistics for a hall
func (h *ReviewHandler) GetHallStats(c *gin.Context) {
	hallID := c.Param("hall_id")

	var stats struct {
		TotalReviews int64   `json:"total_reviews"`
		AvgRating    float64 `json:"avg_rating"`
		Rating5      int64   `json:"rating_5"`
		Rating4      int64   `json:"rating_4"`
		Rating3      int64   `json:"rating_3"`
		Rating2      int64   `json:"rating_2"`
		Rating1      int64   `json:"rating_1"`
	}

	h.db.Model(&models.Review{}).Where("hall_id = ?", hallID).Count(&stats.TotalReviews)

	if stats.TotalReviews > 0 {
		h.db.Model(&models.Review{}).Where("hall_id = ?", hallID).Select("AVG(rating)").Scan(&stats.AvgRating)
		h.db.Model(&models.Review{}).Where("hall_id = ? AND rating = 5", hallID).Count(&stats.Rating5)
		h.db.Model(&models.Review{}).Where("hall_id = ? AND rating = 4", hallID).Count(&stats.Rating4)
		h.db.Model(&models.Review{}).Where("hall_id = ? AND rating = 3", hallID).Count(&stats.Rating3)
		h.db.Model(&models.Review{}).Where("hall_id = ? AND rating = 2", hallID).Count(&stats.Rating2)
		h.db.Model(&models.Review{}).Where("hall_id = ? AND rating = 1", hallID).Count(&stats.Rating1)
	}

	c.JSON(http.StatusOK, stats)
}

