package models

import "time"

type MessageStatus string

const (
	MessageStatusSent     MessageStatus = "sent"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusRead     MessageStatus = "read"
)

type Message struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BookingID uint      `gorm:"not null;index" json:"booking_id"`
	SenderID  uint      `gorm:"not null;index" json:"sender_id"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Read      bool      `gorm:"default:false" json:"read"`
	Status    MessageStatus `gorm:"type:varchar(20);default:sent" json:"status"`
	
	// File attachments
	FileURL   *string   `gorm:"type:varchar(500)" json:"file_url,omitempty"`
	FileName  *string   `gorm:"type:varchar(255)" json:"file_name,omitempty"`
	FileType  *string   `gorm:"type:varchar(50)" json:"file_type,omitempty"`
	FileSize  *int64    `gorm:"type:bigint" json:"file_size,omitempty"`
	
	// Message editing/deletion
	EditedAt  *time.Time `gorm:"type:timestamp" json:"edited_at,omitempty"`
	DeletedAt *time.Time `gorm:"type:timestamp;index" json:"deleted_at,omitempty"`
	IsDeleted bool       `gorm:"default:false" json:"is_deleted"`
	
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Booking Booking `gorm:"foreignKey:BookingID" json:"-"`
	Sender  User    `gorm:"foreignKey:SenderID" json:"sender"`
	
	// Read receipts - track who read the message and when
	ReadReceipts []MessageReadReceipt `gorm:"foreignKey:MessageID" json:"read_receipts,omitempty"`
}

// MessageReadReceipt tracks when a specific user read a message
type MessageReadReceipt struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	MessageID uint      `gorm:"not null;index" json:"message_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	ReadAt    time.Time `gorm:"autoCreateTime" json:"read_at"`
	
	// Relations
	Message Message `gorm:"foreignKey:MessageID" json:"-"`
	User    User    `gorm:"foreignKey:UserID" json:"user"`
}

