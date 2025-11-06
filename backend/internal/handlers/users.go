package handlers

import (
	"net/http"
    "os"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type UserHandler struct{ db *gorm.DB }

func NewUserHandler(db *gorm.DB) *UserHandler { return &UserHandler{db: db} }

func (h *UserHandler) List(c *gin.Context) {
	var items []models.User
	page, size := getPagination(c)
	if err := h.db.Order("id desc").Limit(size).Offset((page - 1) * size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list"})
		return
	}
	// Don't return passwords
	for i := range items {
		items[i].Password = ""
	}
	c.JSON(http.StatusOK, items)
}

type userCreate struct {
	Name     string  `json:"name" binding:"required"`
	Email    string  `json:"email" binding:"required,email"`
	Phone    *string `json:"phone"`
	Password string  `json:"password" binding:"required,min=6"`
	Role     string  `json:"role"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req userCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check existing
	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already in use"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	role := models.UserRoleCustomer
	if req.Role == "admin" {
		role = models.UserRoleAdmin
	}

	user := models.User{
		Name:     req.Name,
		Email:    req.Email,
		Phone:    req.Phone,
		Password: string(hashed),
		Role:     role,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not create"})
		return
	}
	user.Password = ""
	c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) GetCurrentUser(c *gin.Context) {
	userId, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := h.db.First(&user, userId).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) Get(c *gin.Context) {
	var user models.User
	if err := h.db.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)
}

type userUpdate struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
	Phone *string `json:"phone"`
	Role  *string `json:"role"`
}

func (h *UserHandler) Update(c *gin.Context) {
	var user models.User
	if err := h.db.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
    // Prevent modifying static super admin critical fields
    superEmail := os.Getenv("SUPER_ADMIN_EMAIL")
    if superEmail == "" {
        superEmail = "admin@admin.com"
    }

	var req userUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		user.Name = *req.Name
	}
    if req.Email != nil {
        if user.Email == superEmail && *req.Email != user.Email {
            c.JSON(http.StatusForbidden, gin.H{"error": "cannot change super admin email"})
            return
        }
		// Check if email is already taken by another user
		var existing models.User
		if err := h.db.Where("email = ? AND id <> ?", *req.Email, user.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "email already in use"})
			return
		}
		user.Email = *req.Email
	}
	if req.Phone != nil {
		user.Phone = req.Phone
	}
    if req.Role != nil {
        if user.Email == superEmail && *req.Role != "admin" {
            c.JSON(http.StatusForbidden, gin.H{"error": "cannot demote super admin"})
            return
        }
		if *req.Role == "admin" {
			user.Role = models.UserRoleAdmin
		} else {
			user.Role = models.UserRoleCustomer
		}
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) Delete(c *gin.Context) {
    var user models.User
    if err := h.db.First(&user, c.Param("id")).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
        return
    }
    superEmail := os.Getenv("SUPER_ADMIN_EMAIL")
    if superEmail == "" {
        superEmail = "admin@admin.com"
    }
    if user.Email == superEmail {
        c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete super admin"})
        return
    }
    if err := h.db.Delete(&models.User{}, user.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.Status(http.StatusNoContent)
}
