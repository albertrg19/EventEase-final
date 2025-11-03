package models

import "time"

type HomepageContent struct {
	ID        uint      `gorm:"primaryKey"`
	Section   string    `gorm:"type:varchar(50);not null"`
	Content   string    `gorm:"type:text;not null"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}


