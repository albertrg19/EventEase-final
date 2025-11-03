package models

import "time"

type EventCategory struct {
	ID          uint      `gorm:"primaryKey"`
	Name        string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	Description *string   `gorm:"type:text"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	Image       *string   `gorm:"type:varchar(255)"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:EventCategoryID"`
}


