package models

import "time"

// UserLoginHistory tracks login attempts for security and device recognition
type UserLoginHistory struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	IPAddress string    `gorm:"type:varchar(45)" json:"ip_address"` // IPv6 compatible
	UserAgent string    `gorm:"type:text" json:"user_agent"`
	Device    string    `gorm:"type:varchar(100)" json:"device"`    // Parsed device type
	Browser   string    `gorm:"type:varchar(100)" json:"browser"`   // Parsed browser
	Location  *string   `gorm:"type:varchar(255)" json:"location"`  // Optional geo-location
	Success   bool      `gorm:"default:true" json:"success"`
	LoginAt   time.Time `gorm:"autoCreateTime" json:"login_at"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
}
