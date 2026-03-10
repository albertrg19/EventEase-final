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
	"venue-reservation/backend/internal/services"
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
    Name     string `json:"name" binding:"required"`
    Email    string `json:"email" binding:"required,email"`
    Phone    string `json:"phone" binding:"required"`
    Password string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
    Identifier string `json:"identifier" binding:"required"` // Can be Email or Phone
    Password   string `json:"password" binding:"required"`
}

type requestOTPRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Method     string `json:"method" binding:"required,oneof=email sms"`
}

type verifyOTPRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Code       string `json:"code" binding:"required,len=6"`
	Method     string `json:"method" binding:"required,oneof=email sms"`
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

    // Check existing email
    var existingEmail models.User
    if err := h.db.Where("email = ?", req.Email).First(&existingEmail).Error; err == nil {
        c.JSON(http.StatusConflict, gin.H{"error": "email already in use"})
        return
    }

    // Check existing phone
    var existingPhone models.User
    if err := h.db.Where("phone = ?", req.Phone).First(&existingPhone).Error; err == nil {
        c.JSON(http.StatusConflict, gin.H{"error": "phone number already in use"})
        return
    }

    hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
        return
    }

	user := models.User{
		Name:               req.Name,
		Email:              req.Email,
		Phone:              &req.Phone,
		Password:           string(hashed),
		Role:               models.UserRoleCustomer,
		EmailVerified:      false,
		PhoneVerified:      false,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":             user.ID,
		"email":          user.Email,
		"phone":          user.Phone,
		"message":        "Registration successful! Please verify your account.",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	// Allow login via email or phone
	if err := h.db.Where("email = ? OR phone = ?", req.Identifier, req.Identifier).First(&user).Error; err != nil {
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

	// Block login if neither email nor phone is verified (customers only)
	if user.Role == models.UserRoleCustomer {
		if !user.EmailVerified && !user.PhoneVerified {
			c.JSON(http.StatusForbidden, gin.H{"error": "Please verify your email or phone number before logging in."})
			return
		}
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

// RequestOTP generates a 6-digit code, saves it to the DB, and fires the Email or SMS depending on the method.
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var req requestOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Identify User
	var user models.User
	if req.Method == "email" {
		if err := h.db.Where("email = ?", req.Identifier).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Account not found with that email."})
			return
		}
	} else if req.Method == "sms" {
		if err := h.db.Where("phone = ?", req.Identifier).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Account not found with that phone number."})
			return
		}
	}

	// Basic rate limiting: check if they requested recently to avoid spam
	var lastOTP models.OTPVerification
	if err := h.db.Where("identifier = ?", req.Identifier).Order("created_at desc").First(&lastOTP).Error; err == nil {
		if time.Since(lastOTP.CreatedAt) < 1*time.Minute {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Please wait a minute before requesting another code."})
			return
		}
	}

	code := generateOTP()
	otp := models.OTPVerification{
		Identifier: req.Identifier,
		Code:       code,
		ExpiresAt:  time.Now().Add(5 * time.Minute),
	}

	if err := h.db.Create(&otp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate OTP"})
		return
	}

	// Fire the transmission method
	if req.Method == "email" {
		go h.emailService.SendEmailVerificationOTP(user.Email, user.Name, code)
	} else if req.Method == "sms" {
		msg := fmt.Sprintf("Your EventEase verification code is %s. Valid for 5 minutes. Do not share this code.", code)
		go services.SendSMS(*user.Phone, msg)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verification code dispatched via " + req.Method})
}

// VerifyOTP validates the verification code and activates the account, automatically logging them in.
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req verifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var otp models.OTPVerification
	if err := h.db.Where("identifier = ? AND code = ?", req.Identifier, req.Code).First(&otp).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}

	if time.Now().After(otp.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code has expired. Please request a new one."})
		return
	}

	// Consume OTP
	otp.IsVerified = true
	h.db.Save(&otp)

	// Fetch their user account
	var user models.User
	if req.Method == "email" {
		if err := h.db.Where("email = ?", req.Identifier).First(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User account missing"})
			return
		}
		user.EmailVerified = true
	} else if req.Method == "sms" {
		if err := h.db.Where("phone = ?", req.Identifier).First(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User account missing"})
			return
		}
		user.PhoneVerified = true
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user verification status"})
		return
	}

	// Authenticate the user instantly using JWT
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
		"message":        "Account verified successfully! Logging you in...",
		"token":          signed,
		"email_verified": user.EmailVerified,
	})
}
