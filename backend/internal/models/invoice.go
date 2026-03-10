package models

import (
	"time"

	"gorm.io/gorm"
)

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusPaid      PaymentStatus = "paid"
	PaymentStatusOverdue   PaymentStatus = "overdue"
	PaymentStatusCancelled PaymentStatus = "cancelled"
)

type Invoice struct {
	ID              uint          `gorm:"primaryKey" json:"id"`
	BookingID       uint          `gorm:"not null;index" json:"booking_id"`
	BasePrice       float64       `gorm:"type:numeric(10,2);not null" json:"base_price"`
	AdditionalFees  float64       `gorm:"type:numeric(10,2);default:0" json:"additional_fees"`
	Discount        float64       `gorm:"type:numeric(10,2);default:0" json:"discount"`
	TotalAmount     float64       `gorm:"type:numeric(10,2);not null" json:"total_amount"`
	PaymentStatus   PaymentStatus `gorm:"type:varchar(20);default:pending" json:"payment_status"`
	PaymentDate     *time.Time    `gorm:"type:date" json:"payment_date"`
	PaymentMethod   *string       `gorm:"type:varchar(50)" json:"payment_method"`
	PaymentNotes    *string       `gorm:"type:text" json:"payment_notes"`
	PaymentDeadline *time.Time    `gorm:"type:date;index" json:"payment_deadline"` // Payment deadline date
	DaysOverdue     int           `gorm:"default:0" json:"days_overdue"`       // Days past deadline
	LastRemindedAt  *time.Time    `json:"last_reminded_at"`                    // Last time a reminder was sent
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy       *uint          `json:"deleted_by,omitempty"`

	// Relations
	Booking Booking `gorm:"foreignKey:BookingID" json:"booking"`
}
