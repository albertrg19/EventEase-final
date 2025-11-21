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
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	Email     string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Phone     *string   `gorm:"type:varchar(20)" json:"phone"`
	Password  string    `gorm:"type:varchar(255);not null" json:"-"`
	Role      UserRole  `gorm:"type:varchar(20);default:customer;not null" json:"role"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:UserID" json:"-"`
}


