package models

import "time"

type BookingStatus string

const (
	BookingStatusPending  BookingStatus = "pending"
	BookingStatusApproved BookingStatus = "approved"
	BookingStatusRejected BookingStatus = "rejected"
)

type Booking struct {
	ID              uint           `gorm:"primaryKey"`
	CustomerID      uint           `gorm:"not null"`
	UserID          uint           `gorm:"not null;index"`
	EventName       string         `gorm:"type:varchar(255);not null"`
	EventType       string         `gorm:"type:varchar(100);not null"`
	EventCategoryID uint           `gorm:"not null;index"`
	HallID          uint           `gorm:"not null;index"`
	EventDate       time.Time      `gorm:"type:date;not null"`
	Status          BookingStatus  `gorm:"type:varchar(20);default:pending"`
	CreatedAt       time.Time      `gorm:"autoCreateTime"`
	AdminNotes      *string        `gorm:"type:text"`

	// Relations
	User          User          `gorm:"foreignKey:UserID"`
	EventCategory EventCategory `gorm:"foreignKey:EventCategoryID"`
	Hall          EventHall     `gorm:"foreignKey:HallID"`
	Invoices      []Invoice     `gorm:"foreignKey:BookingID"`
}


