package models

import "time"

type Message struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BookingID uint      `gorm:"not null;index" json:"booking_id"`
	SenderID  uint      `gorm:"not null;index" json:"sender_id"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Read      bool      `gorm:"default:false" json:"read"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Booking Booking `gorm:"foreignKey:BookingID" json:"-"`
	Sender  User    `gorm:"foreignKey:SenderID" json:"sender"`
}

