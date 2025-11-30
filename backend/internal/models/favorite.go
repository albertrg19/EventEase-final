package models

import "time"

type Favorite struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	HallID    uint      `gorm:"not null;index" json:"hall_id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	User User      `gorm:"foreignKey:UserID" json:"-"`
	Hall EventHall `gorm:"foreignKey:HallID" json:"hall,omitempty"`
}

// Composite unique index to prevent duplicate favorites
func (Favorite) TableName() string {
	return "favorites"
}

