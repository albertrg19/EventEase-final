package handlers

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net"
	"net/smtp"
	"os"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
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

	if enabled {
		log.Printf("[Email] SMTP enabled: host=%s, port=%s, from=%s", host, port, from)
	} else {
		log.Printf("[Email] SMTP disabled - missing configuration")
	}

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

	log.Printf("[Email] Sending email to: %s, subject: %s", to, subject)

	// Build the message
	headers := make(map[string]string)
	headers["From"] = s.from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=\"UTF-8\""

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	// Connect to the SMTP server
	serverAddr := fmt.Sprintf("%s:%s", s.host, s.port)
	
	conn, err := net.Dial("tcp", serverAddr)
	if err != nil {
		log.Printf("[Email Error] Failed to connect: %v", err)
		return fmt.Errorf("failed to connect to SMTP server: %v", err)
	}

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		log.Printf("[Email Error] Failed to create client: %v", err)
		return fmt.Errorf("failed to create SMTP client: %v", err)
	}
	defer client.Close()

	// Start TLS
	tlsConfig := &tls.Config{
		ServerName: s.host,
	}
	if err = client.StartTLS(tlsConfig); err != nil {
		log.Printf("[Email Error] Failed to start TLS: %v", err)
		return fmt.Errorf("failed to start TLS: %v", err)
	}

	// Authenticate
	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	if err = client.Auth(auth); err != nil {
		log.Printf("[Email Error] Authentication failed: %v", err)
		return fmt.Errorf("SMTP authentication failed: %v", err)
	}

	// Set the sender and recipient
	if err = client.Mail(s.from); err != nil {
		log.Printf("[Email Error] Failed to set sender: %v", err)
		return fmt.Errorf("failed to set sender: %v", err)
	}
	if err = client.Rcpt(to); err != nil {
		log.Printf("[Email Error] Failed to set recipient: %v", err)
		return fmt.Errorf("failed to set recipient: %v", err)
	}

	// Send the email body
	w, err := client.Data()
	if err != nil {
		log.Printf("[Email Error] Failed to get data writer: %v", err)
		return fmt.Errorf("failed to get data writer: %v", err)
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		log.Printf("[Email Error] Failed to write message: %v", err)
		return fmt.Errorf("failed to write message: %v", err)
	}

	err = w.Close()
	if err != nil {
		log.Printf("[Email Error] Failed to close writer: %v", err)
		return fmt.Errorf("failed to close writer: %v", err)
	}

	client.Quit()
	log.Printf("[Email] Successfully sent email to: %s", to)
	return nil
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

	// Use cases.Title instead of deprecated strings.Title
	statusText := cases.Title(language.English).String(string(booking.Status))
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

const paymentReminderTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .urgent-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; background: #fff3cd; color: #856404; }
        .overdue-badge { background: #f8d7da; color: #721c24; }
        .invoice-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc3545; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #6c757d; font-size: 14px; }
        .detail-value { color: #212529; font-weight: 500; }
        .total { font-size: 28px; color: #dc3545; font-weight: bold; text-align: center; margin: 20px 0; }
        .deadline { background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }
        .deadline-date { font-size: 18px; font-weight: bold; color: #856404; }
        .cta-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #28a745 0%, #218838 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Payment Reminder</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">EventEase</p>
        </div>
        <div class="content">
            <p>Dear {{.CustomerName}},</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="urgent-badge {{if .IsOverdue}}overdue-badge{{end}}">
                    {{if .IsOverdue}}Payment Overdue{{else}}Payment Due Soon{{end}}
                </span>
            </div>
            
            <p>This is a friendly reminder that payment for your booking is {{if .IsOverdue}}overdue{{else}}due soon{{end}}.</p>
            
            <div class="invoice-box">
                <div class="detail-row">
                    <span class="detail-label">Invoice Number</span>
                    <span class="detail-value">#{{.InvoiceID}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event</span>
                    <span class="detail-value">{{.EventName}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Date</span>
                    <span class="detail-value">{{.EventDate}}</span>
                </div>
                {{if .DaysOverdue}}
                <div class="detail-row">
                    <span class="detail-label">Days Overdue</span>
                    <span class="detail-value" style="color: #dc3545; font-weight: bold;">{{.DaysOverdue}} days</span>
                </div>
                {{end}}
            </div>
            
            <div class="total">Amount Due: ₱{{.TotalAmount}}</div>
            
            {{if .PaymentDeadline}}
            <div class="deadline">
                <p style="margin: 0; font-size: 14px; color: #856404;">Payment Deadline</p>
                <p class="deadline-date" style="margin: 5px 0 0 0;">{{.PaymentDeadline}}</p>
            </div>
            {{end}}
            
            <p>Please ensure payment is made as soon as possible to avoid any inconvenience with your booking.</p>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
                If you have already made the payment, please disregard this reminder. For any questions, please contact our support team.
            </p>
        </div>
        <div class="footer">
            <p>© EventEase - Venue Reservation System</p>
            <p>This is an automated reminder. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
`

type PaymentReminderEmailData struct {
	CustomerName    string
	EventName       string
	EventDate       string
	InvoiceID       uint
	TotalAmount     string
	PaymentDeadline string
	IsOverdue       bool
	DaysOverdue     int
}

func (s *EmailService) SendPaymentReminder(invoice *models.Invoice, booking *models.Booking, user *models.User) error {
	if user == nil || user.Email == "" {
		return nil
	}

	isOverdue := invoice.PaymentStatus == models.PaymentStatusOverdue
	daysOverdue := invoice.DaysOverdue

	paymentDeadline := ""
	if invoice.PaymentDeadline != nil {
		paymentDeadline = invoice.PaymentDeadline.Format("January 2, 2006")
	}

	data := PaymentReminderEmailData{
		CustomerName:    user.Name,
		EventName:       booking.EventName,
		EventDate:       booking.EventDate.Format("January 2, 2006"),
		InvoiceID:       invoice.ID,
		TotalAmount:     fmt.Sprintf("%.2f", invoice.TotalAmount),
		PaymentDeadline: paymentDeadline,
		IsOverdue:       isOverdue,
		DaysOverdue:     daysOverdue,
	}

	tmpl, err := template.New("reminder").Parse(paymentReminderTemplate)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	subject := fmt.Sprintf("Payment Reminder - Invoice #%d", invoice.ID)
	if isOverdue {
		subject = fmt.Sprintf("⚠️ OVERDUE: Payment Reminder - Invoice #%d", invoice.ID)
	}
	return s.sendEmail(user.Email, subject, buf.String())
}

const passwordResetTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reset-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .reset-button:hover { background: linear-gradient(135deg, #2d5a87 0%, #3d6a97 100%); }
        .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; color: #856404; font-size: 14px; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; background: #f8f9fa; }
        .link-text { word-break: break-all; font-size: 12px; color: #6c757d; background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EventEase</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset Request</p>
        </div>
        <div class="content">
            <p>Dear {{.Name}},</p>
            <p>We received a request to reset your password for your EventEase account. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
                <a href="{{.ResetLink}}" class="reset-button">Reset Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </div>
            
            <p style="font-size: 14px; color: #6c757d;">If the button doesn't work, copy and paste this link into your browser:</p>
            <div class="link-text">{{.ResetLink}}</div>
        </div>
        <div class="footer">
            <p>© EventEase - Venue Reservation System</p>
            <p>This is an automated message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
`

type PasswordResetEmailData struct {
	Name      string
	ResetLink string
}

func (s *EmailService) SendPasswordResetEmail(email, name, resetLink string) error {
	// Log reset link to console for development (when SMTP is not configured)
	if !s.enabled {
		fmt.Printf("\n==================== PASSWORD RESET ====================\n")
		fmt.Printf("Email: %s\n", email)
		fmt.Printf("Reset Link: %s\n", resetLink)
		fmt.Printf("=========================================================\n\n")
		return nil
	}

	data := PasswordResetEmailData{
		Name:      name,
		ResetLink: resetLink,
	}

	tmpl, err := template.New("passwordReset").Parse(passwordResetTemplate)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	return s.sendEmail(email, "Reset Your EventEase Password", buf.String())
}

// Email Verification OTP Template
// Email Verification OTP Template
const emailVerificationOTPTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
        .header { background-color: #1e3a5f; color: white; padding: 40px 20px; text-align: center; border-radius: 8px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 10px; text-align: center; }
        .envelope-icon { width: 64px; height: 64px; margin: 0 auto 20px; background-image: url('https://ci3.googleusercontent.com/meips/ADKq_Nao15.../envelope.png'); background-size: contain; background-repeat: no-repeat; }
        /* Using a text emoji for the envelope if image fails, or replace with base64/url */
        .icon-container { margin-bottom: 20px; }
        .icon-container img { width: 60px; height: auto; }
        .title { font-size: 20px; font-weight: bold; color: #202124; margin-bottom: 15px; }
        .subtitle { color: #5f6368; font-size: 14px; margin-bottom: 30px; line-height: 1.5; max-width: 400px; margin-left: auto; margin-right: auto; }
        .otp-container { display: flex; justify-content: center; gap: 10px; margin: 30px 0; }
        .otp-digit { width: 45px; height: 55px; border: 1px solid #dadce0; border-radius: 4px; font-size: 24px; font-weight: bold; color: #3c4043; text-align: center; line-height: 55px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .otp-digit.highlight { border: 2px solid #f29900; color: #202124; }
        .expire-notice { color: #d93025; font-size: 12px; margin-top: 25px; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f3f4; color: #5f6368; font-size: 11px; line-height: 1.5; }
        
        /* Fallback for the icon if external images are blocked */
        .fallback-icon { font-size: 48px; color: #2d5a87; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Navy Blue Header Block -->
        <div class="header">
            <h1>EventEase</h1>
            <p>Email Verification</p>
        </div>

        <div class="content">
            <!-- Envelope Icon (using inline SVG for reliability) -->
            <div class="icon-container">
               <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="#4285f4" stroke-width="2"/>
                    <path d="M22 6L12 13L2 6" stroke="#4285f4" stroke-width="2"/>
                    <path d="M22 18L15 13" stroke="#4285f4" stroke-width="2"/>
                    <path d="M9 13L2 18" stroke="#4285f4" stroke-width="2"/>
                    <path d="M16 4H8V14L12 17L16 14V4Z" fill="#e8f0fe"/>
                    <text x="12" y="11" font-family="Arial" font-size="8" fill="#4285f4" text-anchor="middle" font-weight="bold">E</text>
                </svg>
            </div>

            <div class="title">Verify Your Email Address</div>
            <div class="subtitle">Dear {{.Name}}, please use the code below to verify your email address.</div>
            
            <div class="otp-container">
                {{range $i, $d := .Digits}}
                <!-- Highlight the 4th digit (index 3) just like the screenshot for demo purposes, or make it dynamic if meaningful -->
                <div class="otp-digit{{if eq $i 3}} highlight{{end}}">{{$d}}</div>
                {{end}}
            </div>
            
            <div class="expire-notice">
                <span style="color: #d93025;">⏰</span> <span style="color: #5f6368;">This code expires in <strong>10 minutes</strong></span>
            </div>

            <p style="font-size: 12px; color: #9aa0a6; margin-top: 30px;">
                If you didn't create an account with EventEase, please ignore this email.
            </p>
        </div>

        <div class="footer">
            <p>© EventEase - Venue Reservation System</p>
            <p>This is an automated message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
`

type EmailVerificationOTPData struct {
	Name   string
	Code   string
	Digits []string
}

func (s *EmailService) SendEmailVerificationOTP(email, name, code string) error {
	// Convert code to individual digits
	digits := make([]string, len(code))
	for i, d := range code {
		digits[i] = string(d)
	}

	// Log verification code to console for development (when SMTP is not configured)
	if !s.enabled {
		fmt.Printf("\n==================== EMAIL VERIFICATION ====================\n")
		fmt.Printf("Email: %s\n", email)
		fmt.Printf("Verification Code: %s\n", code)
		fmt.Printf("=============================================================\n\n")
		return nil
	}

	data := EmailVerificationOTPData{
		Name:   name,
		Code:   code,
		Digits: digits,
	}

	tmpl, err := template.New("emailVerificationOTP").Parse(emailVerificationOTPTemplate)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return err
	}

	return s.sendEmail(email, "Your EventEase Verification Code: "+code, buf.String())
}
