# Booking to Payment Workflow - Quick Summary

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

1️⃣  BOOKING REQUEST
    ┌─────────────────────┐
    │  Customer selects    │
    │  date & fills form   │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  POST /api/bookings  │
    │  Status: "pending"   │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Booking Created     │
    │  ✅ Availability     │
    │     Checked          │
    └─────────────────────┘

2️⃣  ADMIN REVIEW
    ┌─────────────────────┐
    │  Admin reviews      │
    │  booking request    │
    └──────────┬───────────┘
               │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    APPROVED        REJECTED
        │               │
        │               └──► ❌ No invoice
        │
        ▼
    ┌─────────────────────┐
    │  Email sent to      │
    │  customer           │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  AUTO-CREATE        │
    │  INVOICE            │
    │  (async)            │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Invoice Created    │
    │  • Base Price       │
    │  • Total Amount     │
    │  • Status: pending  │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Email sent to      │
    │  customer with      │
    │  invoice            │
    └─────────────────────┘

3️⃣  PAYMENT PROCESS
    ┌─────────────────────┐
    │  Customer views     │
    │  invoice            │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  "Offline Payment   │
    │   Required" notice  │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Customer contacts  │
    │  admin to pay       │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Customer pays via: │
    │  • Cash             │
    │  • Bank Transfer    │
    │  • Other methods    │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Admin records      │
    │  payment            │
    │  PUT /api/admin/    │
    │  invoices/:id       │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Invoice Status     │
    │  Updated: "paid"    │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Customer sees      │
    │  payment confirmed  │
    └─────────────────────┘
```

## Key Points

### ✅ Automatic Processes
- Invoice creation when booking is approved
- Email notifications on status changes
- Availability checking to prevent double-booking

### 🔄 Manual Processes
- Admin approval/rejection of bookings
- Payment recording by admin (offline system)
- Payment verification (no automatic gateway)

### 📊 Status Flow

**Booking Status:**
```
pending → approved ✅ → Invoice Created
       → rejected ❌ → No Invoice
```

**Invoice Status:**
```
pending → paid ✅ → Payment Complete
       → overdue ⚠️
       → cancelled ❌
```

## Important Notes

1. **No Payment Gateway**: System uses offline/manual payment processing
2. **Auto-Invoice**: Created automatically when booking is approved
3. **Email Notifications**: Sent for booking status changes and invoice creation
4. **Admin Control**: Admin must manually record payments after customer pays offline

## Files Involved

### Frontend
- `app/customer/booking/page.tsx` - Booking form
- `app/customer/invoices/page.tsx` - Customer invoice view
- `app/admin/invoices/page.tsx` - Admin payment management

### Backend
- `backend/internal/handlers/bookings.go` - Booking creation & status updates
- `backend/internal/handlers/invoices.go` - Invoice creation & payment updates
- `backend/internal/models/booking.go` - Booking model
- `backend/internal/models/invoice.go` - Invoice model

