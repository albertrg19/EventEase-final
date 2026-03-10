package models

import (
	"time"

	"gorm.io/gorm"
)

type EventHall struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"name"`
	Location    string    `gorm:"type:text;default:''" json:"location"`
	Capacity    int       `gorm:"not null" json:"capacity"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy   *uint          `json:"deleted_by,omitempty"`
	Price       float64        `gorm:"type:numeric(10,2);default:0" json:"price"`
	MaxCapacity int       `gorm:"default:0" json:"max_capacity"`
	Photo       *string   `gorm:"type:varchar(255)" json:"photo"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:HallID" json:"bookings"`
	Events   []Event   `gorm:"foreignKey:HallID" json:"events"`
}


