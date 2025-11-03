package models

import (
	"time"
)

type UserRole string

const (
	UserRoleAdmin    UserRole = "admin"
	UserRoleCustomer UserRole = "customer"
)

type User struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"type:varchar(100);not null"`
	Email     string    `gorm:"type:varchar(100);uniqueIndex;not null"`
	Phone     *string   `gorm:"type:varchar(20)"`
	Password  string    `gorm:"type:varchar(255);not null"`
	Role      UserRole  `gorm:"type:varchar(20);default:customer;not null"`
	CreatedAt time.Time `gorm:"autoCreateTime"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:UserID"`
}


