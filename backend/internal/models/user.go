package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	UserRoleAdmin    UserRole = "admin"
	UserRoleCustomer UserRole = "customer"
)

type User struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	Name             string     `gorm:"type:varchar(100);not null" json:"name"`
	Email            string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Phone            *string    `gorm:"type:varchar(20)" json:"phone"`
	Photo            *string    `gorm:"type:varchar(255)" json:"photo"`
	Password         string     `gorm:"type:varchar(255);not null" json:"-"`
	Role             UserRole   `gorm:"type:varchar(20);default:customer;not null" json:"role"`
	ResetToken       *string    `gorm:"type:varchar(64);index" json:"-"`
	ResetTokenExpiry *time.Time `json:"-"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy        *uint          `json:"deleted_by,omitempty"`
	// Email Verification
	EmailVerified      bool       `gorm:"default:false" json:"email_verified"`
	PhoneVerified      bool       `gorm:"default:false" json:"phone_verified"`
	VerificationToken  *string    `gorm:"type:varchar(64);index" json:"-"`
	VerificationSentAt *time.Time `json:"-"`

	// Relations
	Bookings []Booking `gorm:"foreignKey:UserID" json:"-"`

	// Admin module permissions (JSON array of module keys, e.g. ["dashboard","bookings"])
	Permissions *string `gorm:"type:text" json:"permissions,omitempty"`
}



