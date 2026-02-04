# Booking to Payment Workflow

## Overview
This document outlines the complete workflow from booking request to payment completion in the venue reservation system.

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOOKING REQUEST TO PAYMENT FLOW                      │
└─────────────────────────────────────────────────────────────────────────┘

1. BOOKING REQUEST
   │
   ├─ Customer selects date on calendar
   ├─ Customer fills booking form:
   │  ├─ Event name
   │  ├─ Event category
   │  ├─ Hall selection
   │  ├─ Date & time (start/end)
   │  └─ Validation
   │
   └─ POST /api/bookings
      │
      ├─ Backend validates:
      │  ├─ Check hall availability (no conflicts with pending/approved)
      │  ├─ Validate date (not in past)
      │  └─ Validate time (end > start)
      │
      └─ Create Booking
         ├─ Status: "pending" (default)
         ├─ Customer ID & User ID stored
         └─ Admin activity logged

2. BOOKING STATUS MANAGEMENT
   │
   ├─ Admin reviews booking
   │
   ├─ Admin updates status via PUT /api/admin/bookings/:id
   │  ├─ Options: "pending" | "approved" | "rejected"
   │  └─ Status change triggers:
   │     ├─ Email notification to customer
   │     └─ If approved → Auto-create invoice (async)
   │
   └─ Customer views booking status
      └─ GET /api/bookings (filtered by user)

3. INVOICE GENERATION (Automatic)
   │
   ├─ Trigger: Booking status changes to "approved"
   │
   ├─ Function: CreateInvoiceForBooking()
   │  ├─ Check if invoice already exists
   │  ├─ Load booking with hall details
   │  ├─ Calculate pricing:
   │  │  ├─ Base Price = Hall.Price
   │  │  ├─ Additional Fees = 0 (default)
   │  │  ├─ Discount = 0 (default)
   │  │  └─ Total = Base + Fees - Discount
   │  │
   │  ├─ Create Invoice record:
   │  │  ├─ Booking ID (linked)
   │  │  ├─ Payment Status: "pending"
   │  │  ├─ Payment Date: null
   │  │  ├─ Payment Method: null
   │  │  └─ Payment Notes: null
   │  │
   │  └─ Send email notification (async)
   │
   └─ Alternative: Manual invoice creation
      ├─ Admin can create invoice manually
      └─ POST /api/admin/invoices
         └─ Admin can set custom pricing

4. INVOICE VIEWING
   │
   ├─ Customer View:
   │  ├─ GET /api/invoices (filtered by user's bookings)
   │  ├─ View invoice details
   │  ├─ Download invoice PDF
   │  └─ See payment status
   │
   └─ Admin View:
      ├─ GET /api/admin/invoices (all invoices)
      ├─ View all invoices
      └─ Manage payment status

5. PAYMENT PROCESSING (Offline)
   │
   ├─ System Type: Manual/Offline Payment System
   │  └─ No payment gateway integration
   │
   ├─ Customer receives invoice
   │  ├─ Invoice shows: "Offline Payment Required"
   │  ├─ Payment methods:
   │  │  ├─ Cash at office
   │  │  ├─ Bank transfer
   │  │  └─ Other methods (contact admin)
   │  └─ Customer contacts admin to pay
   │
   ├─ Admin records payment:
   │  └─ PUT /api/admin/invoices/:id
   │     ├─ Update payment_status: "paid"
   │     ├─ Set payment_date: [date]
   │     ├─ Set payment_method: [method]
   │     └─ Set payment_notes: [optional notes]
   │
   └─ Payment Status Options:
      ├─ "pending" - Awaiting payment
      ├─ "paid" - Payment completed
      ├─ "overdue" - Payment past due
      └─ "cancelled" - Invoice cancelled

6. POST-PAYMENT
   │
   ├─ Invoice status updated to "paid"
   ├─ Customer can view updated invoice
   ├─ Payment details visible:
   │  ├─ Payment method
   │  ├─ Payment date
   │  └─ Payment notes
   └─ Invoice downloadable with payment confirmation

└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Process

### Step 1: Booking Request (Frontend)
**File:** `app/customer/booking/page.tsx`

1. Customer navigates to booking page
2. Calendar displays available dates
3. Customer clicks on a date
4. Booking dialog opens with form:
   - Event name (required)
   - Event category (required)
   - Hall selection (carousel of available halls)
   - Start time (12-hour format: HH:MM AM/PM)
   - End time (12-hour format: HH:MM AM/PM)
5. Form validation:
   - All required fields filled
   - End time > Start time
   - Date not in past
   - Hall available for selected date
6. Submit booking:
   ```javascript
   POST /api/bookings
   {
     customer_id: userId,
     user_id: userId,
     event_name: string,
     event_category_id: number,
     hall_id: number,
     event_date: "YYYY-MM-DD",
     start_time: "HH:MM",
     end_time: "HH:MM"
   }
   ```

### Step 2: Booking Creation (Backend)
**File:** `backend/internal/handlers/bookings.go` - `Create()`

1. Validate request payload
2. Check hall availability:
   ```go
   WHERE hall_id = ? AND event_date = ? 
   AND status IN ('pending', 'approved')
   ```
3. If available:
   - Create booking with status "pending"
   - Log admin activity
   - Return booking object
4. If not available:
   - Return 409 Conflict error
   - Frontend shows error message

### Step 3: Booking Status Update (Admin)
**File:** `backend/internal/handlers/bookings.go` - `Update()`

1. Admin reviews booking in admin panel
2. Admin updates status:
   - **Approved**: Triggers invoice creation
   - **Rejected**: No invoice created
   - **Pending**: Remains in queue
3. Status change triggers:
   - Email notification to customer (async)
   - If approved → Auto-create invoice (async)

### Step 4: Automatic Invoice Creation
**File:** `backend/internal/handlers/invoices.go` - `CreateInvoiceForBooking()`

**Trigger Conditions:**
- Booking status changes to "approved"
- Booking created with "approved" status
- Admin manually triggers for approved bookings without invoices

**Process:**
1. Check if invoice already exists for booking
2. Load booking with hall relationship
3. Calculate invoice:
   ```go
   BasePrice = Hall.Price
   AdditionalFees = 0.0  // Can be adjusted by admin later
   Discount = 0.0         // Can be adjusted by admin later
   TotalAmount = BasePrice + AdditionalFees - Discount
   ```
4. Create invoice:
   ```go
   Invoice {
     BookingID: bookingID,
     BasePrice: basePrice,
     AdditionalFees: 0.0,
     Discount: 0.0,
     TotalAmount: totalAmount,
     PaymentStatus: "pending",
     PaymentDate: nil,
     PaymentMethod: nil,
     PaymentNotes: nil
   }
   ```
5. Send email notification to customer (async)

### Step 5: Invoice Viewing (Customer)
**File:** `app/customer/invoices/page.tsx`

1. Customer navigates to invoices page
2. System fetches:
   - User's bookings
   - Invoices linked to those bookings
3. Customer can:
   - View invoice details
   - See payment status
   - Download invoice PDF
   - View payment instructions (offline payment notice)

**Invoice Display:**
- Invoice number
- Event details (name, date, venue)
- Payment breakdown (base, fees, discount, total)
- Payment status badge
- Offline payment instructions (if pending)

### Step 6: Payment Processing (Offline)
**File:** `app/admin/invoices/page.tsx` - Payment Update Dialog

**Current System:** Manual/Offline Payment

1. Customer receives invoice (email + web view)
2. Invoice shows "Offline Payment Required" notice
3. Customer contacts admin via:
   - Phone
   - Email
   - In-person visit
   - Chat system (if available)
4. Customer pays using:
   - Cash at office
   - Bank transfer
   - Other offline methods
5. Admin records payment:
   ```javascript
   PUT /api/admin/invoices/:id
   {
     payment_status: "paid",
     payment_date: "YYYY-MM-DD",
     payment_method: "Cash" | "Bank Transfer" | etc.,
     payment_notes: "Optional notes"
   }
   ```

### Step 7: Payment Status Update (Backend)
**File:** `backend/internal/handlers/invoices.go` - `Update()`

1. Validate payment status (pending/paid/overdue/cancelled)
2. Update invoice:
   - Set payment_status
   - Set payment_date (auto-set to today if paid and not provided)
   - Set payment_method
   - Set payment_notes
3. Log admin activity
4. Return updated invoice

### Step 8: Post-Payment (Customer View)
**File:** `app/customer/invoices/page.tsx`

1. Customer refreshes invoices page
2. Invoice status updated to "paid"
3. Payment details visible:
   - Payment method
   - Payment date
   - Payment notes
4. Invoice downloadable with payment confirmation

---

## Database Models

### Booking Model
```go
type Booking struct {
    ID              uint
    CustomerID      uint
    UserID          uint
    EventName       string
    EventType       string
    EventCategoryID uint
    HallID          uint
    EventDate       time.Time
    Status          BookingStatus  // "pending" | "approved" | "rejected"
    AdminNotes      *string
    CreatedAt       time.Time
}
```

### Invoice Model
```go
type Invoice struct {
    ID             uint
    BookingID      uint
    BasePrice      float64
    AdditionalFees float64
    Discount       float64
    TotalAmount    float64
    PaymentStatus  PaymentStatus  // "pending" | "paid" | "overdue" | "cancelled"
    PaymentDate    *time.Time
    PaymentMethod  *string
    PaymentNotes   *string
    CreatedAt      time.Time
}
```

---

## API Endpoints

### Booking Endpoints
- `POST /api/bookings` - Create booking (authenticated)
- `GET /api/bookings` - List bookings (authenticated)
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id` - Update booking (admin only)
- `DELETE /api/bookings/:id` - Delete booking (authenticated)

### Invoice Endpoints
- `GET /api/invoices` - List invoices (public read)
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/admin/invoices` - Create invoice (admin only)
- `PUT /api/admin/invoices/:id` - Update invoice/payment (admin only)
- `POST /api/admin/invoices/create-missing` - Create missing invoices (admin only)
- `POST /api/invoices/create-my-missing` - Create missing invoices for user (authenticated)

---

## Email Notifications

1. **Booking Status Change Email**
   - Sent when booking status changes
   - Includes booking details and new status
   - File: `backend/internal/handlers/email.go` - `SendBookingStatusEmail()`

2. **Invoice Creation Email**
   - Sent when invoice is created
   - Includes invoice details and payment instructions
   - File: `backend/internal/handlers/email.go` - `SendInvoiceEmail()`

---

## Key Features

### Automatic Invoice Generation
- Invoices are automatically created when bookings are approved
- Prevents manual invoice creation errors
- Ensures all approved bookings have invoices

### Offline Payment System
- No payment gateway integration
- Manual payment recording by admin
- Supports multiple payment methods (cash, bank transfer, etc.)
- Payment details tracked in database

### Availability Checking
- Prevents double-booking
- Checks for conflicts with pending and approved bookings
- Real-time availability display on calendar

### Status Management
- Booking statuses: pending → approved/rejected
- Invoice statuses: pending → paid/overdue/cancelled
- Status changes trigger notifications

---

## Current Limitations & Notes

1. **No Payment Gateway**: System uses offline/manual payment processing
2. **No Automatic Payment Verification**: Admin must manually verify and record payments
3. **No Payment Reminders**: No automated reminders for pending payments
4. **No Refund Processing**: No built-in refund workflow
5. **No Partial Payments**: System doesn't support partial payment tracking
6. **Time Validation**: Start/end time validation exists but could be enhanced

---

## Future Enhancement Opportunities

1. **Payment Gateway Integration**
   - Stripe, PayPal, or local payment gateways
   - Automatic payment verification
   - Receipt generation

2. **Payment Reminders**
   - Automated email reminders for pending payments
   - Overdue payment notifications

3. **Partial Payments**
   - Track multiple payment installments
   - Payment plan support

4. **Refund Management**
   - Refund request workflow
   - Refund processing and tracking

5. **Payment Analytics**
   - Revenue reports
   - Payment method statistics
   - Outstanding payments dashboard

---

## Summary

The workflow follows this pattern:
1. **Request** → Customer creates booking (status: pending)
2. **Review** → Admin reviews and approves/rejects
3. **Invoice** → Automatic invoice generation on approval
4. **Payment** → Customer pays offline, admin records payment
5. **Completion** → Invoice marked as paid, customer receives confirmation

The system is designed for **offline payment processing** with manual admin verification, making it suitable for businesses that prefer traditional payment methods or operate in regions where online payment gateways may not be readily available.

