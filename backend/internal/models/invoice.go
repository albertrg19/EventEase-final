package models

import "time"

type Invoice struct {
	ID             uint      `gorm:"primaryKey"`
	BookingID      uint      `gorm:"not null;index"`
	BasePrice      float64   `gorm:"type:numeric(10,2);not null"`
	AdditionalFees float64   `gorm:"type:numeric(10,2);default:0"`
	Discount       float64   `gorm:"type:numeric(10,2);default:0"`
	TotalAmount    float64   `gorm:"type:numeric(10,2);not null"`
	CreatedAt      time.Time `gorm:"autoCreateTime"`

	// Relations
	Booking Booking `gorm:"foreignKey:BookingID"`
}


