package models

import (
	"time"

	"gorm.io/gorm"
)

type Event struct {
	ID              uint           `gorm:"primaryKey"`
	Title           string         `gorm:"type:varchar(255);not null"`
	HallID          uint           `gorm:"not null;index"`
	EventCategoryID *uint          `gorm:"index" json:"category_id"`
	StartDate       time.Time      `gorm:"not null"`
	EndDate         time.Time      `gorm:"not null"`
	Description     *string        `gorm:"type:text"`
	CreatedAt       time.Time      `gorm:"autoCreateTime"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy       *uint          `json:"deleted_by,omitempty"`

	// Relations
	Hall          EventHall     `gorm:"foreignKey:HallID"`
	EventCategory EventCategory `gorm:"foreignKey:EventCategoryID" json:"category,omitempty"`
}


