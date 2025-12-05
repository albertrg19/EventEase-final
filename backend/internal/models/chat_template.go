package models

import "time"

// ChatTemplate stores quick reply templates for admins
type ChatTemplate struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"type:varchar(100);not null" json:"title"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	Category    *string   `gorm:"type:varchar(50)" json:"category,omitempty"` // e.g., "greeting", "booking", "payment"
	CreatedBy   uint      `gorm:"not null;index" json:"created_by"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	
	// Relations
	Creator User `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

