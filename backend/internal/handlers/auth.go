package handlers

import (
    "net/http"
    "os"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "golang.org/x/crypto/bcrypt"
    "gorm.io/gorm"

    "venue-reservation/backend/internal/models"
)

type AuthHandler struct {
    db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
    return &AuthHandler{db: db}
}

type registerRequest struct {
    Name     string  `json:"name" binding:"required"`
    Email    string  `json:"email" binding:"required,email"`
    Phone    *string `json:"phone"`
    Password string  `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
    var req registerRequest
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

    user := models.User{
        Name:     req.Name,
        Email:    req.Email,
        Phone:    req.Phone,
        Password: string(hashed),
        Role:     models.UserRoleCustomer,
    }

    if err := h.db.Create(&user).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
        return
    }

    c.JSON(http.StatusCreated, gin.H{"id": user.ID, "email": user.Email})
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req loginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var user models.User
    if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }

    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }

    jwtSecret := os.Getenv("JWT_SECRET")
    if jwtSecret == "" {
        jwtSecret = "dev-secret-change-me"
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "sub":  user.ID,
        "role": user.Role,
        "exp":  time.Now().Add(24 * time.Hour).Unix(),
        "iat":  time.Now().Unix(),
        "nbf":  time.Now().Unix(),
    })

    signed, err := token.SignedString([]byte(jwtSecret))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"token": signed})
}


