package middleware

import (
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid auth header"})
			return
		}
		tokenString := parts[1]
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "dev-secret-change-me"
		}
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}
		c.Set("userId", claims["sub"])
		c.Set("role", claims["role"])
		if email, ok := claims["email"].(string); ok {
			c.Set("userEmail", email)
		}
		c.Next()
	}
}

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := map[string]struct{}{}
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		roleStr, _ := roleVal.(string)
		if _, ok := allowed[roleStr]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

// Permission represents a specific action on a resource
type Permission string

const (
	PermViewBookings     Permission = "bookings:view"
	PermManageBookings   Permission = "bookings:manage"
	PermViewUsers        Permission = "users:view"
	PermManageUsers      Permission = "users:manage"
	PermViewHalls        Permission = "halls:view"
	PermManageHalls      Permission = "halls:manage"
	PermViewCategories   Permission = "categories:view"
	PermManageCategories Permission = "categories:manage"
	PermViewEvents       Permission = "events:view"
	PermManageEvents     Permission = "events:manage"
	PermViewInvoices     Permission = "invoices:view"
	PermManageInvoices   Permission = "invoices:manage"
	PermViewActivity     Permission = "activity:view"
	PermViewHealth       Permission = "health:view"
)

// RolePermissions defines permissions for each role
var RolePermissions = map[string][]Permission{
	"admin": {
		PermViewBookings, PermManageBookings,
		PermViewUsers, PermManageUsers,
		PermViewHalls, PermManageHalls,
		PermViewCategories, PermManageCategories,
		PermViewEvents, PermManageEvents,
		PermViewInvoices, PermManageInvoices,
		PermViewActivity, PermViewHealth,
	},
	"manager": {
		PermViewBookings, PermManageBookings,
		PermViewUsers,
		PermViewHalls, PermManageHalls,
		PermViewCategories, PermManageCategories,
		PermViewEvents, PermManageEvents,
		PermViewInvoices,
		PermViewActivity,
	},
	"support": {
		PermViewBookings,
		PermViewUsers,
		PermViewHalls,
		PermViewCategories,
		PermViewEvents,
		PermViewInvoices,
	},
	"customer": {
		PermViewBookings,
		PermViewHalls,
		PermViewCategories,
		PermViewEvents,
	},
}

// RequirePermission checks if user has the required permission
func RequirePermission(perm Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden: no role"})
			return
		}
		roleStr, _ := roleVal.(string)
		permissions, ok := RolePermissions[roleStr]
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden: unknown role"})
			return
		}
		for _, p := range permissions {
			if p == perm {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden: insufficient permissions"})
	}
}

// Rate limiter implementation
type rateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

var limiter = &rateLimiter{
	requests: make(map[string][]time.Time),
	limit:    100,         // requests per window
	window:   time.Minute, // window duration
}

func (rl *rateLimiter) isAllowed(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Clean old requests
	if times, exists := rl.requests[key]; exists {
		var valid []time.Time
		for _, t := range times {
			if t.After(windowStart) {
				valid = append(valid, t)
			}
		}
		rl.requests[key] = valid
	}

	// Check if under limit
	if len(rl.requests[key]) >= rl.limit {
		return false
	}

	// Add new request
	rl.requests[key] = append(rl.requests[key], now)
	return true
}

// RateLimiter middleware
func RateLimiter() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use IP as key, or user ID if authenticated
		key := c.ClientIP()
		if userId, exists := c.Get("userId"); exists {
			if id, ok := userId.(float64); ok {
				key = string(rune(int(id)))
			}
		}

		if !limiter.isAllowed(key) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, please try again later",
			})
			return
		}
		c.Next()
	}
}

// RequestLogger middleware logs all requests
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Log after request
		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path
		clientIP := c.ClientIP()
		userAgent := c.Request.UserAgent()

		// Get user ID if authenticated
		userId := "anonymous"
		if id, exists := c.Get("userId"); exists {
			if idFloat, ok := id.(float64); ok {
				userId = string(rune(int(idFloat)))
			}
		}

		// Log format: timestamp | status | latency | ip | method | path | user | user-agent
		gin.DefaultWriter.Write([]byte(
			time.Now().Format("2006/01/02 - 15:04:05") +
				" | " + string(rune(status)) +
				" | " + latency.String() +
				" | " + clientIP +
				" | " + method +
				" | " + path +
				" | user:" + userId +
				" | " + userAgent + "\n",
		))
	}
}

// SecurityHeaders adds security headers to responses
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'")
		c.Next()
	}
}
