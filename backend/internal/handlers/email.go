package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
	"strings"

	"gorm.io/gorm"

	"venue-reservation/backend/internal/models"
)

type EmailService struct {
	db       *gorm.DB
	host     string
	port     string
	username string
	password string
	from     string
	enabled  bool
}

func NewEmailService(db *gorm.DB) *EmailService {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if from == "" {
		from = "noreply@eventease.com"
	}
	if port == "" {
		port = "587"
	}

	enabled := host != "" && username != "" && password != ""

	return &EmailService{
		db:       db,
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		enabled:  enabled,
	}
}

func (s *EmailService) IsEnabled() bool {
	return s.enabled
}

func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	if !s.enabled {
		fmt.Printf("[Email Disabled] To: %s, Subject: %s\n", to, subject)
		return nil
	}

	auth := smtp.PlainAuth("", s.username, s.password, s.host)

	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	msg := []byte(fmt.Sprintf("To: %s\r\nFrom: %s\r\nSubject: %s\r\n%s\r\n%s",
		to, s.from, subject, mime, htmlBody))

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	return smtp.SendMail(addr, auth, s.from, []string{to}, msg)
}

const bookingStatusTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
        .status-approved { background: #d4edda; color: #155724; }
        .status-rejected { background: #f8d7da; color: #721c24; }
        .status-pending { background: #fff3cd; color: #856404; }
        .details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #6c757d; font-size: 14px; }
        .detail-value { color: #212529; font-weight: 500; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EventEase</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Booking Update</p>
        </div>
        <div class="content">
            <p>Dear {{.CustomerName}},</p>
            <p>Your booking status has been updated:</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge status-{{.Status}}">{{.StatusText}}</span>
            </div>
            
            <div class="details">
                <div class="detail-row">
                    <span class="detail-label">Event Name</span>
                    <span class="detail-value">{{.EventName}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Date</span>
                    <span class="detail-value">{{.EventDate}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Venue</span>
                    <span class="detail-value">{{.VenueName}}</span>
                </div>
                {{if .AdminNotes}}
                <div class="detail-row">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">{{.AdminNotes}}</span>
                </div>
                {{end}}
            </div>
            
            {{if eq .Status "approved"}}
            <p style="color: #155724;">Congratulations! Your booking has been confirmed. We look forward to hosting your event.</p>
            {{else if eq .Status "rejected"}}
            <p style="color: #721c24;">We regret to inform you that your booking request could not be approved. Please contact us for more information.</p>
            {{end}}
        </div>
        <div class="footer">
            <p>© EventEase - Venue Reservation System</p>
            <p>This is an automated message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
`

const invoiceTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .invoice-number { font-size: 18px; color: #1e3a5f; font-weight: bold; margin-bottom: 20px; }
        .details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #6c757d; font-size: 14px; }
        .detail-value { color: #212529; font-weight: 500; }
        .total { font-size: 24px; color: #1e3a5f; font-weight: bold; text-align: center; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EventEase</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice</p>
        </div>
        <div class="content">
            <p>Dear {{.CustomerName}},</p>
            <p>A new invoice has been generated for your booking:</p>
            
            <div class="invoice-number">Invoice #{{.InvoiceID}}</div>
            
            <div class="details">
                <div class="detail-row">
                    <span class="detail-label">Event</span>
                    <span class="detail-value">{{.EventName}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Base Price</span>
                    <span class="detail-value">₱{{.BasePrice}}</span>
                </div>
                {{if .AdditionalFees}}
                <div class="detail-row">
                    <span class="detail-label">Additional Fees</span>
                    <span class="detail-value">₱{{.AdditionalFees}}</span>
                </div>
                {{end}}
                {{if .Discount}}
                <div class="detail-row">
                    <span class="detail-label">Discount</span>
                    <span class="detail-value">-₱{{.Discount}}</span>
                </div>
                {{end}}
            </div>
            
            <div class="total">Total: ₱{{.TotalAmount}}</div>
            
            <p>Please ensure payment is made before your event date.</p>
        </div>
        <div class="footer">
            <p>© EventEase - Venue Reservation System</p>
            <p>This is an automated message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
`

type BookingEmailData struct {
	CustomerName string
	EventName    string
	EventDate    string
	VenueName    string
	Status       string
	StatusText   string
	AdminNotes   string
}

type InvoiceEmailData struct {
	CustomerName   string
	EventName      string
	InvoiceID      uint
	BasePrice      string
	AdditionalFees string
	Discount       string
	TotalAmount    string
}

func (s *EmailService) SendBookingStatusEmail(booking *models.Booking, user *models.User, hall *models.EventHall) error {
	if user == nil || user.Email == "" {
		return nil
	}

	statusText := strings.Title(string(booking.Status))
	adminNotes := ""
	if booking.AdminNotes != nil {
		adminNotes = *booking.AdminNotes
	}

	venueName := "N/A"
	if hall != nil {
		venueName = hall.Name
	}

	data := BookingEmailData{
		CustomerName: user.Name,
		EventName:    booking.EventName,
		EventDate:    booking.EventDate.Format("January 2, 2006"),
		VenueName:    venueName,
		Status:       string(booking.Status),
		StatusText:   statusText,
		AdminNotes:   adminNotes,
	}

	tmpl, err := template.New("booking").Parse(bookingStatusTemplate)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	subject := fmt.Sprintf("Booking %s - %s", statusText, booking.EventName)
	return s.sendEmail(user.Email, subject, buf.String())
}

func (s *EmailService) SendInvoiceEmail(invoice *models.Invoice, booking *models.Booking, user *models.User) error {
	if user == nil || user.Email == "" {
		return nil
	}

	data := InvoiceEmailData{
		CustomerName:   user.Name,
		EventName:      booking.EventName,
		InvoiceID:      invoice.ID,
		BasePrice:      fmt.Sprintf("%.2f", invoice.BasePrice),
		AdditionalFees: fmt.Sprintf("%.2f", invoice.AdditionalFees),
		Discount:       fmt.Sprintf("%.2f", invoice.Discount),
		TotalAmount:    fmt.Sprintf("%.2f", invoice.TotalAmount),
	}

	tmpl, err := template.New("invoice").Parse(invoiceTemplate)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	subject := fmt.Sprintf("Invoice #%d - %s", invoice.ID, booking.EventName)
	return s.sendEmail(user.Email, subject, buf.String())
}

