This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Running on Your Computer

First, run the development server:

```bash
cd frontend
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Running on Your Phone (Mobile Testing)

To access the app from your phone on the same network:

1. **Find your computer's local IP address:**
   - **Windows:** Open PowerShell and run:
     ```powershell
     ipconfig
     ```
     Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)
   
   - **Mac/Linux:** Open Terminal and run:
     ```bash
     ifconfig | grep "inet " | grep -v 127.0.0.1
     ```
     Or use:
     ```bash
     ip addr show | grep "inet " | grep -v 127.0.0.1
     ```

2. **Create environment file for frontend:**
   Create a file `frontend/.env.local` with your computer's IP address:
   ```
   NEXT_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:8080
   ```
   Replace `YOUR_IP_ADDRESS` with the IP you found in step 1 (e.g., `http://192.168.1.100:8080`)

3. **Start the backend server:**
   ```bash
   cd backend
   go run cmd/api/main.go
   ```
   Or if you have the compiled executable:
   ```bash
   cd backend
   ./api.exe
   ```
   The backend will run on port 8080.

4. **Start the frontend server:**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on port 3000.

5. **Access from your phone:**
   - Make sure your phone is connected to the **same Wi-Fi network** as your computer
   - Open your phone's browser and go to:
     ```
     http://YOUR_IP_ADDRESS:3000
     ```
   - Replace `YOUR_IP_ADDRESS` with the same IP from step 1

**Important Notes:**
- Both your computer and phone must be on the same Wi-Fi network
- Make sure Windows Firewall allows connections on ports 3000 and 8080
- If you can't connect, try temporarily disabling your firewall or adding firewall rules for these ports

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
