package models

import "time"

// AutoReplyConfig stores auto-reply configuration
type AutoReplyConfig struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	Message     string    `gorm:"type:text;not null" json:"message"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

