package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// SendSMS sends an SMS message via the PhilSMS Provider API.
// Make sure to set SMS_API_KEY in your .env file.
func SendSMS(phone string, message string) error {
	apiKey := os.Getenv("SMS_API_KEY")
	if apiKey == "" {
		fmt.Printf("[MOCK SMS] To: %s | Message: %s\n", phone, message)
		return nil // Graceful degradation for local testing without an API key
	}

	apiURL := "https://dashboard.philsms.com/api/v3/sms/send"

	// Format Philippine phone numbers from 09XX to +639XX
	formattedPhone := phone
	if strings.HasPrefix(phone, "0") {
		formattedPhone = "+63" + phone[1:]
	} else if strings.HasPrefix(phone, "9") {
		formattedPhone = "+63" + phone
	} else if !strings.HasPrefix(phone, "+") {
		formattedPhone = "+" + phone
	}

	// PhilSMS expects a JSON payload
	payload := map[string]interface{}{
		"recipient": formattedPhone,
		"sender_id": "PhilSMS", // Default free sender ID, change if you applied for a custom one
		"type":      "plain",
		"message":   message,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal PhilSMS payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to build SMS request: %w", err)
	}
	
	// PhilSMS uses Bearer token authentication
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send SMS request: %w", err)
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		log.Printf("[SMS ERROR] Failed to send to %s. Status: %d, Response: %s\n", phone, res.StatusCode, string(body))
		return fmt.Errorf("PhilSMS API error: %d %s", res.StatusCode, string(body))
	}

	// Successfully dispatched but we want to see the JSON
	log.Printf("[SMS SUCCESS] Sent OTP to %s successfully. Response: %s", phone, string(body))
	return nil
}
