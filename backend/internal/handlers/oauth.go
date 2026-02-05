package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type OAuthHandler struct {
	db *gorm.DB
}

func NewOAuthHandler(db *gorm.DB) *OAuthHandler {
	return &OAuthHandler{db: db}
}

// GoogleUserInfo represents the user info from Google API
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// generateStateToken creates a random state token for CSRF protection
func generateStateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// GoogleLogin redirects user to Google OAuth consent screen
func (h *OAuthHandler) GoogleLogin(c *gin.Context) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")

	if clientID == "" || redirectURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Google OAuth not configured"})
		return
	}

	// Generate state token for CSRF protection
	state, err := generateStateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate state token"})
		return
	}

	// Store state in cookie (expires in 10 minutes)
	c.SetCookie("oauth_state", state, 600, "/", "", false, true)

	// Build Google OAuth URL
	authURL := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=email%%20profile&state=%s&access_type=offline&prompt=consent",
		clientID,
		redirectURL,
		state,
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GoogleCallback handles the OAuth callback from Google
func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	// Verify state token
	stateCookie, err := c.Cookie("oauth_state")
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=invalid_state")
		return
	}

	stateParam := c.Query("state")
	if stateCookie != stateParam {
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=state_mismatch")
		return
	}

	// Clear state cookie
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	// Get authorization code
	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=no_code")
		return
	}

	// Exchange code for tokens
	tokenData, err := exchangeCodeForToken(code)
	if err != nil {
		fmt.Printf("Token exchange error: %v\n", err)
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=token_exchange_failed")
		return
	}

	// Get user info from Google
	userInfo, err := getGoogleUserInfo(tokenData["access_token"].(string))
	if err != nil {
		fmt.Printf("User info error: %v\n", err)
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=user_info_failed")
		return
	}

	// Find or create user
	var user models.User
	result := h.db.Where("email = ?", userInfo.Email).First(&user)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new user
		user = models.User{
			Name:          userInfo.Name,
			Email:         userInfo.Email,
			Password:      "", // No password for OAuth users
			Photo:         &userInfo.Picture,
			Role:          models.UserRoleCustomer,
			EmailVerified: true, // Google already verified the email
		}

		if err := h.db.Create(&user).Error; err != nil {
			c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=user_creation_failed")
			return
		}
	} else if result.Error != nil {
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=database_error")
		return
	} else {
		// Update existing user's photo if not set
		if user.Photo == nil || *user.Photo == "" {
			user.Photo = &userInfo.Picture
			h.db.Save(&user)
		}
		// Mark email as verified if not already
		if !user.EmailVerified {
			user.EmailVerified = true
			h.db.Save(&user)
		}
	}

	// Generate JWT token
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
		c.Redirect(http.StatusTemporaryRedirect, os.Getenv("FRONTEND_URL")+"/login?error=token_generation_failed")
		return
	}

	// Redirect to frontend with token
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/oauth/callback?token=%s", frontendURL, signed))
}

// exchangeCodeForToken exchanges the authorization code for access token
func exchangeCodeForToken(code string) (map[string]interface{}, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", map[string][]string{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURL},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var tokenData map[string]interface{}
	if err := json.Unmarshal(body, &tokenData); err != nil {
		return nil, err
	}

	if tokenData["error"] != nil {
		return nil, fmt.Errorf("token error: %v", tokenData["error_description"])
	}

	return tokenData, nil
}

// getGoogleUserInfo fetches user info from Google API
func getGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}
