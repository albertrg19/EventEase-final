package models

import "time"

type BookingStatus string

const (
	BookingStatusPending  BookingStatus = "pending"
	BookingStatusApproved BookingStatus = "approved"
	BookingStatusRejected BookingStatus = "rejected"
)

type Booking struct {
	ID              uint          `gorm:"primaryKey" json:"id"`
	CustomerID      uint          `gorm:"not null" json:"customer_id"`
	UserID          uint          `gorm:"not null;index" json:"user_id"`
	EventName       string        `gorm:"type:varchar(255);not null" json:"event_name"`
	EventType       string        `gorm:"type:varchar(100);not null" json:"event_type"`
	EventCategoryID uint          `gorm:"not null;index" json:"event_category_id"`
	HallID          uint          `gorm:"not null;index" json:"hall_id"`
	EventDate       time.Time     `gorm:"type:date;not null" json:"event_date"`
	StartTime       *time.Time    `gorm:"type:time" json:"start_time"`                    // Start time of the event
	EndTime         *time.Time    `gorm:"type:time" json:"end_time"`                    // End time of the event
	ReferenceNumber string        `gorm:"type:varchar(50);uniqueIndex" json:"reference_number"` // Unique booking reference
	Status          BookingStatus `gorm:"type:varchar(20);default:pending" json:"status"`
	CreatedAt       time.Time     `gorm:"autoCreateTime" json:"created_at"`
	AdminNotes      *string       `gorm:"type:text" json:"admin_notes"`

	// Relations
	User          User          `gorm:"foreignKey:UserID" json:"user"`
	EventCategory EventCategory `gorm:"foreignKey:EventCategoryID" json:"event_category"`
	Hall          EventHall     `gorm:"foreignKey:HallID" json:"hall"`
	Invoices      []Invoice     `gorm:"foreignKey:BookingID" json:"invoices"`
}
