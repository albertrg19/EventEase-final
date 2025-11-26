package models

import "time"

type AdminActivity struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	UserEmail string    `gorm:"type:varchar(100)" json:"user_email"`
	Action    string    `gorm:"type:varchar(100);not null" json:"action"`
	Resource  string    `gorm:"type:varchar(100)" json:"resource"`
	ResourceID *uint    `json:"resource_id,omitempty"`
	Details   string    `gorm:"type:text" json:"details,omitempty"`
	IPAddress string    `gorm:"type:varchar(50)" json:"ip_address,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
}


