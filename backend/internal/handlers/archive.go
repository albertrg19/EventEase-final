package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type ArchiveHandler struct {
	db *gorm.DB
}

func NewArchiveHandler(db *gorm.DB) *ArchiveHandler {
	return &ArchiveHandler{db: db}
}

func (h *ArchiveHandler) logActivity(c *gin.Context, action, resource string, resourceID *uint, details string) {
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

func (h *ArchiveHandler) getModelByEntity(entity string) (interface{}, interface{}, error) {
	switch strings.ToLower(entity) {
	case "users":
		return &models.User{}, &[]models.User{}, nil
	case "bookings":
		return &models.Booking{}, &[]models.Booking{}, nil
	case "categories":
		return &models.EventCategory{}, &[]models.EventCategory{}, nil
	case "halls":
		return &models.EventHall{}, &[]models.EventHall{}, nil
	case "events":
		return &models.Event{}, &[]models.Event{}, nil
	case "invoices":
		return &models.Invoice{}, &[]models.Invoice{}, nil
	case "reviews":
		return &models.Review{}, &[]models.Review{}, nil
	default:
		return nil, nil, fmt.Errorf("unknown entity: %s", entity)
	}
}

// GET /api/admin/archive/:entity
func (h *ArchiveHandler) GetArchived(c *gin.Context) {
	entity := c.Param("entity")
	
	// Default to Categories if entity is somehow empty, though router should prevent this
	if entity == "" {
		entity = "categories"
	}
	
	_, slicePtr, err := h.getModelByEntity(entity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Note: Preloading might be needed for some types (like User inside Booking), but we will keep it simple for now or fetch it locally in UI.
	// For example, Bookings often need Customer and Hall info. We can add conditional Preload.
	query := h.db.Unscoped().Where("deleted_at IS NOT NULL")
	
	switch strings.ToLower(entity) {
	case "bookings":
		query = query.Preload("User").Preload("Hall").Preload("EventCategory")
	case "reviews":
		query = query.Preload("User").Preload("Hall")
	case "invoices":
		query = query.Preload("Booking")
	}

	if err := query.Find(slicePtr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch archived records"})
		return
	}

	// Because `DeletedBy` is an ID, we need to map the user names manually. 
	// We'll collect all user IDs, query their names, then inject them into a dynamic structured return.
	var userIDs []uint
	
	// Reflection or manual extraction is needed here. Let's do it via JSON marshalling trick
	// to easily inject arbitrary string fields into the response.
	
	jsonData, _ := json.Marshal(slicePtr)
	var rawMaps []map[string]interface{}
	json.Unmarshal(jsonData, &rawMaps)
	
	for _, rec := range rawMaps {
		if uidStr, ok := rec["deleted_by"]; ok && uidStr != nil {
			if uid, ok := uidStr.(float64); ok && uid > 0 {
				userIDs = append(userIDs, uint(uid))
			}
		}
	}
	
	userNameMap := make(map[uint]string)
	if len(userIDs) > 0 {
		var users []models.User
		h.db.Unscoped().Where("id IN ?", userIDs).Find(&users)
		for _, u := range users {
			userNameMap[u.ID] = u.Name
		}
	}
	
	for i, rec := range rawMaps {
		if uidStr, ok := rec["deleted_by"]; ok && uidStr != nil {
			if uid, ok := uidStr.(float64); ok && uid > 0 {
				if name, found := userNameMap[uint(uid)]; found {
					rawMaps[i]["deleted_by_name"] = name
				} else {
					rawMaps[i]["deleted_by_name"] = "Unknown User"
				}
			}
		} else {
			rawMaps[i]["deleted_by_name"] = "System / Unknown"
		}
	}

	c.JSON(http.StatusOK, rawMaps)
}

// POST /api/admin/archive/:entity/:id/restore
func (h *ArchiveHandler) Restore(c *gin.Context) {
	entity := c.Param("entity")
	id := c.Param("id")

	modelPtr, _, err := h.getModelByEntity(entity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// First verify it exists and is actually deleted
	if err := h.db.Unscoped().Where("deleted_at IS NOT NULL AND id = ?", id).First(modelPtr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "archived record not found"})
		return
	}

	// Restore it by setting deleted_at back to NULL
	if err := h.db.Unscoped().Model(modelPtr).Where("id = ?", id).Update("deleted_at", nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to restore record"})
		return
	}

	h.logActivity(c, "restore", entity, nil, fmt.Sprintf("Restored archived record ID: %s", id))

	c.JSON(http.StatusOK, gin.H{"message": "record restored successfully"})
}

// DELETE /api/admin/archive/:entity/:id/permanent
func (h *ArchiveHandler) DeletePermanent(c *gin.Context) {
	entity := c.Param("entity")
	id := c.Param("id")

	modelPtr, _, err := h.getModelByEntity(entity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify it exists in unscoped 
	if err := h.db.Unscoped().Where("id = ?", id).First(modelPtr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}

	// Hard delete uses Unscoped().Delete()
	if err := h.db.Unscoped().Where("id = ?", id).Delete(modelPtr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to permanently delete record"})
		return
	}

	h.logActivity(c, "delete_permanent", entity, nil, fmt.Sprintf("Permanently deleted record ID: %s", id))

	c.JSON(http.StatusOK, gin.H{"message": "record permanently deleted"})
}
