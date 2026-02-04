package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
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
    db           *gorm.DB
    emailService *EmailService
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
    return &AuthHandler{
        db:           db,
        emailService: NewEmailService(db),
    }
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

type forgotPasswordRequest struct {
    Email string `json:"email" binding:"required,email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

type verifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

type resendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// generateOTP creates a 6-digit random code
func generateOTP() string {
	b := make([]byte, 3)
	rand.Read(b)
	num := int(b[0])<<16 | int(b[1])<<8 | int(b[2])
	return fmt.Sprintf("%06d", num%1000000)
}

// getClientIP extracts the real client IP from request headers
func getClientIP(c *gin.Context) string {
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		return ip
	}
	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return ip
	}
	return c.ClientIP()
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

	// Generate 6-digit verification code
	verificationCode := generateOTP()
	now := time.Now()

	user := models.User{
		Name:               req.Name,
		Email:              req.Email,
		Phone:              req.Phone,
		Password:           string(hashed),
		Role:               models.UserRoleCustomer,
		EmailVerified:      false,
		VerificationToken:  &verificationCode,
		VerificationSentAt: &now,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	// Send verification email with OTP code
	go h.emailService.SendEmailVerificationOTP(user.Email, user.Name, verificationCode)

	c.JSON(http.StatusCreated, gin.H{
		"id":             user.ID,
		"email":          user.Email,
		"email_verified": false,
		"message":        "Registration successful! Please check your email for the 6-digit verification code.",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Log failed login attempt
		h.logLoginAttempt(c, 0, false)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		// Log failed login attempt
		h.logLoginAttempt(c, user.ID, false)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Log successful login
	h.logLoginAttempt(c, user.ID, true)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-change-me"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":            user.ID,
		"email":          user.Email,
		"role":           user.Role,
		"email_verified": user.EmailVerified,
		"exp":            time.Now().Add(24 * time.Hour).Unix(),
		"iat":            time.Now().Unix(),
		"nbf":            time.Now().Unix(),
	})

	signed, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":          signed,
		"email_verified": user.EmailVerified,
	})
}

// ForgotPassword initiates password reset by sending email with reset token
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
    var req forgotPasswordRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var user models.User
    if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
        // Don't reveal if email exists or not for security
        c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
        return
    }

    // Generate secure reset token
    tokenBytes := make([]byte, 32)
    if _, err := rand.Read(tokenBytes); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate reset token"})
        return
    }
    resetToken := hex.EncodeToString(tokenBytes)

    // Store token with expiration (1 hour)
    expiry := time.Now().Add(1 * time.Hour)
    user.ResetToken = &resetToken
    user.ResetTokenExpiry = &expiry

    if err := h.db.Save(&user).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save reset token"})
        return
    }

    // Send password reset email
    frontendURL := os.Getenv("FRONTEND_URL")
    if frontendURL == "" {
        frontendURL = "http://localhost:3000"
    }
    resetLink := frontendURL + "/reset-password?token=" + resetToken

    if err := h.emailService.SendPasswordResetEmail(user.Email, user.Name, resetLink); err != nil {
        // Log the error but don't reveal it to user
        c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
}

// ResetPassword validates token and updates user password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
    var req resetPasswordRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var user models.User
    if err := h.db.Where("reset_token = ?", req.Token).First(&user).Error; err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
        return
    }

    // Check if token is expired
    if user.ResetTokenExpiry == nil || time.Now().After(*user.ResetTokenExpiry) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token has expired"})
        return
    }

    // Hash new password
    hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update password"})
        return
    }

    // Update password and clear reset token
    user.Password = string(hashed)
    user.ResetToken = nil
    user.ResetTokenExpiry = nil

    if err := h.db.Save(&user).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update password"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Password has been reset successfully"})
}

// logLoginAttempt logs login attempts to the database
func (h *AuthHandler) logLoginAttempt(c *gin.Context, userID uint, success bool) {
	userAgent := c.GetHeader("User-Agent")
	device := parseDevice(userAgent)
	browser := parseBrowser(userAgent)

	loginHistory := models.UserLoginHistory{
		UserID:    userID,
		IPAddress: getClientIP(c),
		UserAgent: userAgent,
		Device:    device,
		Browser:   browser,
		Success:   success,
	}

	// Log asynchronously to not block login response
	go h.db.Create(&loginHistory)
}

// parseDevice extracts device type from User-Agent string
func parseDevice(userAgent string) string {
	uaLower := userAgent
	if len(uaLower) > 0 {
		uaLower = userAgent
	}
	switch {
	case contains(uaLower, "iPhone"):
		return "iPhone"
	case contains(uaLower, "iPad"):
		return "iPad"
	case contains(uaLower, "Android") && contains(uaLower, "Mobile"):
		return "Android Phone"
	case contains(uaLower, "Android"):
		return "Android Tablet"
	case contains(uaLower, "Windows"):
		return "Windows PC"
	case contains(uaLower, "Macintosh"):
		return "Mac"
	case contains(uaLower, "Linux"):
		return "Linux PC"
	default:
		return "Unknown"
	}
}

// parseBrowser extracts browser name from User-Agent string
func parseBrowser(userAgent string) string {
	switch {
	case contains(userAgent, "Edg/"):
		return "Edge"
	case contains(userAgent, "Chrome/") && !contains(userAgent, "Edg/"):
		return "Chrome"
	case contains(userAgent, "Firefox/"):
		return "Firefox"
	case contains(userAgent, "Safari/") && !contains(userAgent, "Chrome/"):
		return "Safari"
	case contains(userAgent, "Opera") || contains(userAgent, "OPR/"):
		return "Opera"
	default:
		return "Unknown"
	}
}

// contains is a simple helper for string contains check
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// VerifyEmail validates the verification code and marks email as verified
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req verifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ? AND verification_token = ?", req.Email, req.Code).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}

	// Check if code is older than 10 minutes (OTP codes expire faster)
	if user.VerificationSentAt != nil && time.Since(*user.VerificationSentAt) > 10*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code has expired. Please request a new one."})
		return
	}

	// Mark email as verified
	user.EmailVerified = true
	user.VerificationToken = nil

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Email verified successfully! You can now login.",
		"email_verified": true,
	})
}

// ResendVerification resends the verification email
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req resendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Don't reveal if email exists
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a verification link has been sent"})
		return
	}

	// Check if already verified
	if user.EmailVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is already verified"})
		return
	}

	// Rate limit: don't allow resending within 1 minute
	if user.VerificationSentAt != nil && time.Since(*user.VerificationSentAt) < 1*time.Minute {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Please wait before requesting another verification email"})
		return
	}

	// Generate new 6-digit verification code
	verificationCode := generateOTP()
	now := time.Now()

	user.VerificationToken = &verificationCode
	user.VerificationSentAt = &now

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save verification code"})
		return
	}

	// Send verification email with OTP code
	go h.emailService.SendEmailVerificationOTP(user.Email, user.Name, verificationCode)

	c.JSON(http.StatusOK, gin.H{"message": "Verification code sent successfully"})
}
