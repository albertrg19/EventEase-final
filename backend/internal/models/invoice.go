package models

import "time"

type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "pending"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusOverdue  PaymentStatus = "overdue"
	PaymentStatusCancelled PaymentStatus = "cancelled"
)

type Invoice struct {
	ID             uint          `gorm:"primaryKey"`
	BookingID      uint          `gorm:"not null;index"`
	BasePrice      float64       `gorm:"type:numeric(10,2);not null"`
	AdditionalFees float64       `gorm:"type:numeric(10,2);default:0"`
	Discount       float64       `gorm:"type:numeric(10,2);default:0"`
	TotalAmount    float64       `gorm:"type:numeric(10,2);not null"`
	PaymentStatus  PaymentStatus `gorm:"type:varchar(20);default:pending"`
	PaymentDate    *time.Time    `gorm:"type:date"`
	PaymentMethod  *string       `gorm:"type:varchar(50)"`
	PaymentNotes   *string       `gorm:"type:text"`
	CreatedAt      time.Time     `gorm:"autoCreateTime"`

	// Relations
	Booking Booking `gorm:"foreignKey:BookingID"`
}


