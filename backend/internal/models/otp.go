package models

import (
	"time"
)

// OTPVerification handles phone number verification codes
type OTPVerification struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Identifier string    `gorm:"type:varchar(100);not null;index" json:"identifier"`
	Code       string    `gorm:"type:varchar(10);not null" json:"code"`
	ExpiresAt  time.Time `gorm:"not null" json:"expires_at"`
	Attempts   int       `gorm:"default:0" json:"attempts"`
	IsVerified bool      `gorm:"default:false" json:"is_verified"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}
