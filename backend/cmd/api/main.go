package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/database"
	"venue-reservation/backend/internal/handlers"
	"venue-reservation/backend/internal/middleware"
	"venue-reservation/backend/internal/models"
)

func main() {
	// Connect DB
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// Auto migrate
	if err := db.AutoMigrate(
		&models.User{},
		&models.EventCategory{},
		&models.EventHall{},
		&models.Event{},
		&models.Booking{},
		&models.Invoice{},
		&models.HomepageContent{},
		&models.AdminActivity{},
		&models.Favorite{},
		&models.Review{},
	); err != nil {
		log.Fatalf("auto migration failed: %v", err)
	}

	// Ensure a static super admin exists
	ensureSuperAdmin(db)

	// Initialize backup handler and start scheduler (daily backups)
	backupHandler := handlers.NewBackupHandler(db)
	backupInterval := 24 * time.Hour // Daily backups
	if env := os.Getenv("BACKUP_INTERVAL_HOURS"); env != "" {
		if hours, err := time.ParseDuration(env + "h"); err == nil {
			backupInterval = hours
		}
	}
	backupHandler.StartScheduler(backupInterval)
	defer backupHandler.StopScheduler()

	r := gin.Default()
	r.Use(middleware.CORS())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.RateLimiter())

	// Serve uploaded files (local dev)
	// Files saved under ./uploads will be accessible at /uploads/<filename>
	r.Static("/uploads", "./uploads")

	// Health endpoints
	healthHandler := handlers.NewHealthHandler(db)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/api/health/status", healthHandler.Status)

	// API routes
	api := r.Group("/api")
	{
		// Auth
		authHandler := handlers.NewAuthHandler(db)
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Public reads
		catHandler := handlers.NewCategoryHandler(db)
		hallHandler := handlers.NewHallHandler(db)
		eventHandler := handlers.NewEventHandler(db)
		invoiceHandler := handlers.NewInvoiceHandler(db)
		bookingHandler := handlers.NewBookingHandler(db)
		userHandler := handlers.NewUserHandler(db)
		uploadHandler := handlers.NewUploadHandler()
		activityHandler := handlers.NewAdminActivityHandler(db)
		favoriteHandler := handlers.NewFavoriteHandler(db)
		reviewHandler := handlers.NewReviewHandler(db)

		api.GET("/categories", catHandler.List)
		api.GET("/halls", hallHandler.List)
		api.GET("/events", eventHandler.List)
		api.GET("/invoices", invoiceHandler.List)
		api.GET("/bookings", bookingHandler.List)
		api.GET("/categories/:id", catHandler.Get)
		api.GET("/halls/:id", hallHandler.Get)
		api.GET("/events/:id", eventHandler.Get)
		api.GET("/bookings/:id", bookingHandler.Get)

		// Public review endpoints
		api.GET("/halls/:hall_id/reviews", reviewHandler.ListByHall)
		api.GET("/halls/:hall_id/reviews/stats", reviewHandler.GetHallStats)

		// Protected mutating routes (admin only)
		admin := api.Group("/admin")
		admin.Use(middleware.AuthRequired(), middleware.RequireRoles("admin"))
		{
			admin.GET("/users", userHandler.List)
			admin.POST("/users", userHandler.Create)
			admin.GET("/users/:id", userHandler.Get)
			admin.PUT("/users/:id", userHandler.Update)
			admin.DELETE("/users/:id", userHandler.Delete)

			admin.POST("/categories", catHandler.Create)
			admin.PUT("/categories/:id", catHandler.Update)
			admin.DELETE("/categories/:id", catHandler.Delete)

			admin.POST("/halls", hallHandler.Create)
			admin.PUT("/halls/:id", hallHandler.Update)
			admin.DELETE("/halls/:id", hallHandler.Delete)

			admin.POST("/events", eventHandler.Create)
			admin.PUT("/events/:id", eventHandler.Update)
			admin.DELETE("/events/:id", eventHandler.Delete)

			admin.POST("/invoices", invoiceHandler.Create)

			// Uploads
			admin.POST("/uploads/images", uploadHandler.Image)

			// Activity log
			admin.GET("/activity", activityHandler.List)

			// Backups
			admin.POST("/backups", backupHandler.CreateBackup)
			admin.GET("/backups", backupHandler.ListBackups)
			admin.GET("/backups/:filename", backupHandler.DownloadBackup)
			admin.DELETE("/backups/:filename", backupHandler.DeleteBackup)
		}

		// Authenticated routes (admin and customer)
		secure := api.Group("/")
		secure.Use(middleware.AuthRequired(), middleware.RequireRoles("admin", "customer"))
		{
			// Get current user profile
			secure.GET("/me", userHandler.GetCurrentUser)
			// Update current user profile
			secure.PUT("/me", userHandler.UpdateSelf)

			// Bookings
			secure.POST("/bookings", bookingHandler.Create)
			secure.PUT("/bookings/:id", bookingHandler.Update)
			secure.DELETE("/bookings/:id", bookingHandler.Delete)

			// Favorites
			secure.GET("/favorites", favoriteHandler.List)
			secure.POST("/favorites", favoriteHandler.Add)
			secure.DELETE("/favorites/:hall_id", favoriteHandler.Remove)
			secure.GET("/favorites/check/:hall_id", favoriteHandler.Check)

			// Reviews (user-specific)
			secure.GET("/my-reviews", reviewHandler.ListByUser)
			secure.POST("/reviews", reviewHandler.Create)
			secure.PUT("/reviews/:id", reviewHandler.Update)
			secure.DELETE("/reviews/:id", reviewHandler.Delete)
		}
	}

	addr := ":8080"
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func ensureSuperAdmin(db *gorm.DB) {
	// Use env or sensible dev defaults
	email := os.Getenv("SUPER_ADMIN_EMAIL")
	if email == "" {
		email = "superadmin@gmail.com"
	}
	password := os.Getenv("SUPER_ADMIN_PASSWORD")
	if password == "" {
		password = "admin123"
	}

	var u models.User
	if err := db.Where("email = ?", email).First(&u).Error; err == nil {
		// Ensure role is admin, name is correct, and password is correct
		needsUpdate := false
		if u.Role != models.UserRoleAdmin {
			u.Role = models.UserRoleAdmin
			needsUpdate = true
		}
		if u.Name != "Super Admin" {
			u.Name = "Super Admin"
			needsUpdate = true
		}
		// Always update password to ensure it matches the expected password
		hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		u.Password = string(hashed)
		needsUpdate = true
		if needsUpdate {
			_ = db.Save(&u).Error
		}
		return
	}

	// Create new super admin if it doesn't exist
	hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	user := models.User{
		Name:     "Super Admin",
		Email:    email,
		Password: string(hashed),
		Role:     models.UserRoleAdmin,
	}
	_ = db.Create(&user).Error
}
