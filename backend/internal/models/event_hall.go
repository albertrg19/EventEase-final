package models

import "time"

type EventHall struct {
	ID          uint      `gorm:"primaryKey"`
	Name        string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	Location    string    `gorm:"type:text;not null"`
	Capacity    int       `gorm:"not null"`
	Description *string   `gorm:"type:text"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	Price       float64   `gorm:"type:numeric(10,2);default:0"`
	MaxCapacity int       `gorm:"default:0"`
	Photo       *string   `gorm:"type:varchar(255)"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:HallID"`
	Events   []Event   `gorm:"foreignKey:HallID"`
}


