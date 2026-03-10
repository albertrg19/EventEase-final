package main

import (
	"log"
	"venue-reservation/backend/internal/database"
	"venue-reservation/backend/internal/models"
)

func main() {
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// Drop the table to allow AutoMigrate to reconstruct it with the new schema
	if err := db.Migrator().DropTable(&models.OTPVerification{}); err != nil {
		log.Fatalf("failed to drop table: %v", err)
	}
	
	log.Println("Successfully dropped otp_verifications table.")
}
