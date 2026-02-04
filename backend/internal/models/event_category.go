package models

import "time"

type EventCategory struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	Image       *string   `gorm:"type:varchar(255)" json:"image"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:EventCategoryID" json:"bookings"`
}


