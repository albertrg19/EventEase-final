# Mobile Setup Guide

## Quick Setup for Phone Access

Your computer's IP address is: **192.168.2.110**

### Step 1: Create Environment File

Create a file named `.env.local` in the `frontend` folder with this content:

```
NEXT_PUBLIC_API_URL=http://192.168.2.110:8080
```

**Windows PowerShell command:**
```powershell
cd frontend
echo "NEXT_PUBLIC_API_URL=http://192.168.2.110:8080" > .env.local
```

### Step 2: Start Backend Server

Open a terminal and run:
```bash
cd backend
go run cmd/api/main.go
```

Or if you have the compiled executable:
```bash
cd backend
./api.exe
```

The backend will start on port 8080.

### Step 3: Start Frontend Server

Open another terminal and run:
```bash
cd frontend
npm run dev
```

The frontend will start on port 3000.

### Step 4: Access from Your Phone

1. Make sure your phone is connected to the **same Wi-Fi network** as your computer
2. Open your phone's browser (Chrome, Safari, etc.)
3. Go to: **http://192.168.2.110:3000**

### Troubleshooting

**Can't connect from phone?**
- Make sure both devices are on the same Wi-Fi network
- Check Windows Firewall settings - you may need to allow ports 3000 and 8080
- Try temporarily disabling Windows Firewall to test
- Verify the backend is running by checking: http://192.168.2.110:8080/health

**Firewall Configuration:**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" and enter ports: 3000, 8080
6. Allow the connection
7. Apply to all profiles

**Note:** Your IP address may change if you reconnect to Wi-Fi. If it stops working, run `ipconfig` again to get the new IP address and update `.env.local`.

