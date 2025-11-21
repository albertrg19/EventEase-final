package handlers

import (
	"os"
	"strconv"

	"venue-reservation/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func getPagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	return page, size
}

// isSuperAdmin checks if a user is a super admin based on email
func isSuperAdmin(user *models.User) bool {
	superEmail := os.Getenv("SUPER_ADMIN_EMAIL")
	if superEmail == "" {
		superEmail = "superadmin@gmail.com"
	}
	return user.Email == superEmail
}
