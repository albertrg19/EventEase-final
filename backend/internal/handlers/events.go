package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type EventHandler struct{ db *gorm.DB }

func NewEventHandler(db *gorm.DB) *EventHandler { return &EventHandler{db: db} }

func (h *EventHandler) List(c *gin.Context) {
	var items []models.Event
	page, size := getPagination(c)
	if err := h.db.Preload("Hall").Order("id asc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	c.JSON(http.StatusOK, items)
}

type eventUpsert struct {
	Title       string    `json:"title" binding:"required"`
	HallID      uint      `json:"hall_id" binding:"required"`
	StartDate   time.Time `json:"start_date" binding:"required"`
	EndDate     time.Time `json:"end_date" binding:"required"`
	Description *string   `json:"description"`
}

func (h *EventHandler) Create(c *gin.Context) {
	var req eventUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item := models.Event{Title: req.Title, HallID: req.HallID, StartDate: req.StartDate, EndDate: req.EndDate, Description: req.Description}
	if err := h.db.Create(&item).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *EventHandler) Get(c *gin.Context) {
	var item models.Event
	if err := h.db.Preload("Hall").First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *EventHandler) Update(c *gin.Context) {
	var item models.Event
	if err := h.db.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req eventUpsert
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.Title = req.Title
	item.HallID = req.HallID
	item.StartDate = req.StartDate
	item.EndDate = req.EndDate
	item.Description = req.Description
	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *EventHandler) Delete(c *gin.Context) {
	if err := h.db.Delete(&models.Event{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.Status(http.StatusNoContent)
}
