package models

import "time"

type Event struct {
	ID          uint      `gorm:"primaryKey"`
	Title       string    `gorm:"type:varchar(255);not null"`
	HallID      uint      `gorm:"not null;index"`
	StartDate   time.Time `gorm:"not null"`
	EndDate     time.Time `gorm:"not null"`
	Description *string   `gorm:"type:text"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`

	// Relations
	Hall EventHall `gorm:"foreignKey:HallID"`
}


