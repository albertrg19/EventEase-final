package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var startTime = time.Now()

type HealthHandler struct {
	db *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Status(c *gin.Context) {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Check database connectivity
	dbStatus := "connected"
	sqlDB, err := h.db.DB()
	if err != nil {
		dbStatus = "error"
	} else if err := sqlDB.Ping(); err != nil {
		dbStatus = "disconnected"
	}

	// Get counts
	var bookingCount, userCount, invoiceCount int64
	h.db.Model(&struct{}{}).Table("bookings").Count(&bookingCount)
	h.db.Model(&struct{}{}).Table("users").Count(&userCount)
	h.db.Model(&struct{}{}).Table("invoices").Count(&invoiceCount)

	uptime := time.Since(startTime)

	c.JSON(http.StatusOK, gin.H{
		"status":   "healthy",
		"uptime":   uptime.String(),
		"uptime_seconds": int(uptime.Seconds()),
		"database": dbStatus,
		"memory": gin.H{
			"alloc_mb":       memStats.Alloc / 1024 / 1024,
			"total_alloc_mb": memStats.TotalAlloc / 1024 / 1024,
			"sys_mb":         memStats.Sys / 1024 / 1024,
			"gc_cycles":      memStats.NumGC,
		},
		"goroutines": runtime.NumGoroutine(),
		"counts": gin.H{
			"bookings": bookingCount,
			"users":    userCount,
			"invoices": invoiceCount,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}


