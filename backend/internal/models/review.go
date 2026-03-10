package models

import (
	"time"

	"gorm.io/gorm"
)

type Review struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	HallID    uint      `gorm:"not null;index" json:"hall_id"`
	BookingID uint      `gorm:"not null;index" json:"booking_id"`
	Rating    int       `gorm:"not null;check:rating >= 1 AND rating <= 5" json:"rating"`
	Comment   string    `gorm:"type:text" json:"comment"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relations
	User    User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Hall    EventHall `gorm:"foreignKey:HallID" json:"hall,omitempty"`
	Booking Booking   `gorm:"foreignKey:BookingID" json:"-"`
}

func (Review) TableName() string {
	return "reviews"
}

