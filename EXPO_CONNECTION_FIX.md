# Expo CLI Connection Issue - Audit & Fix Guide

## Issue Summary
The mobile app is unable to connect to the Expo development server, displaying:
```
Console Warning: Cannot connect to Expo CLI.
```

This occurs at runtime when the app tries to communicate with the dev server (typically on `localhost:19000` or `127.0.0.1:19000`).

---

## Root Causes

### 1. **Expo Dev Server Not Running** (Most Common)
- The `expo start` process is not active on the development machine
- The app was built/installed but dev server wasn't kept running

### 2. **Network Connectivity Issues**
- Device/emulator on different network than dev machine
- Firewall blocking port 19000 (Expo dev server port)
- Localhost DNS resolution failing

### 3. **Wrong Host Configuration**
- Emulator trying to connect to `localhost` instead of machine IP
- Port mismatch or incorrect Expo configuration

### 4. **Development Client Build**
- App may need to rebuild after Expo dependency updates
- Cache corruption from failed previous builds

---

## Audit Checklist

### ✅ A. Verify Expo Dev Server Status
```powershell
# Check if Expo is running on port 19000
netstat -ano | findstr :19000

# Or check running Node processes
tasklist | findstr node
```

### ✅ B. Verify Network Connectivity
```powershell
# Ping dev machine from device/emulator
ping <your-machine-ip>

# Test port accessibility
Test-NetConnection -ComputerName <your-machine-ip> -Port 19000
```

### ✅ C. Check Expo Configuration
- Review `app.json` for any network-related settings
- Check for custom Expo CLI options or environment variables
- Verify Android `usesCleartextTraffic` is set to `true` (already enabled in app.json ✓)

### ✅ D. Check App Cache & Build
- Expo cache may be corrupted
- Previous builds may need clearing

---

## Fix Steps (In Order)

### **Step 1: Start Expo Dev Server** (PRIMARY FIX)

```powershell
# Navigate to app directory
cd C:\Users\91773\enterprise-app\app

# Start Expo dev server
npm start
# Or: expo start

# For specific platform:
npm run android    # For Android device/emulator
npm run ios        # For iOS device/emulator
```

**Expected Output:**
```
Starting Expo server on http://localhost:19000
Press a key to view logs, commands, or open debugger
```

⏱️ Keep this terminal **open and running** while developing.

---

### **Step 2: Connect Device/Emulator** (If Using Network)

#### For Android Emulator:
```powershell
# Emulator automatically connects to localhost
# No additional steps needed if Expo server is running

# If still failing, clear Expo cache:
expo start --clear
```

#### For Physical Android Device:
```powershell
# 1. Get your machine's IP (not localhost)
ipconfig

# 2. Make sure device is on same WiFi network

# 3. In Expo CLI, use "Connection > LAN" option
# Or use direct URL scheme:
# Scan QR code from Expo, or manually enter:
# exp://<your-machine-ip>:19000

# 4. If needed, test connectivity:
ping <your-machine-ip>  # From device command line
```

#### For iOS Simulator:
```powershell
npm run ios
# Simulator connects via localhost automatically
```

---

### **Step 3: Clear Cache & Rebuild** (If Still Failing)

```powershell
# Clear Expo cache
expo start --clear

# Or complete cleanup:
cd C:\Users\91773\enterprise-app\app
rm -r node_modules
npm install
npm start
```

---

### **Step 4: Firewall Configuration** (If On Corporate Network)

**Windows Firewall:**
```powershell
# Allow Expo port through firewall
New-NetFirewallRule -DisplayName "Expo Dev Server" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 19000
```

**Alternative - Disable Firewall for Development (Less Secure):**
```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $false
# Re-enable after development:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $true
```

---

### **Step 5: Environment Configuration** (Advanced)

Create or update `.env` file in `app/` directory if custom network settings needed:

```env
# Expo dev server configuration
EXPO_DEBUGGING=true
# REACT_NATIVE_PACKAGER_HOSTNAME=<your-machine-ip>  # Only if auto-detection fails
```

---

## Verification Steps

Once fixes are applied, verify with:

```powershell
# 1. Confirm Expo server is running
curl http://localhost:19000

# 2. Check app logs for successful connection
# Should see: "Connected to Expo dev server" (not the warning)

# 3. Test API connectivity if app makes requests
# The reports filter should load data without errors
```

---

## Prevention Measures

### 1. **Keep Dev Server Running**
- Use Terminal tab or separate window for Expo
- Consider using `npm install -g pm2` for persistent dev server

### 2. **Network Awareness**
- Always verify device/emulator is on same network as dev machine
- Document your dev machine's IP address

### 3. **Build Automation**
- Add pre-start checks in package.json scripts:
```json
{
  "prestart": "npm run typecheck && npm run lint"
}
```

### 4. **CI/CD Integration**
- See `DEVELOPMENT_TESTING_DEPLOYMENT.md` for structured dev workflow

---

## Troubleshooting Decision Tree

```
┌─ Is Expo dev server running?
│  ├─ NO → Run: npm start ✓
│  └─ YES ↓
├─ Can device reach dev machine?
│  ├─ NO → Check network/firewall
│  └─ YES ↓
├─ Are you using localhost?
│  ├─ YES (Emulator) → Should work now
│  └─ NO (Physical Device) → Use machine IP ✓
├─ Still failing?
│  ├─ YES → Run: expo start --clear ✓
│  └─ NO → ✓ FIXED
└─ Still failing?
   └─ Check firewall, restart npm, check ports
```

---

## Related Files

- `app/package.json` - Dev scripts and dependencies
- `app/app.json` - Expo configuration (already has `usesCleartextTraffic: true`)
- `app/eas.json` - EAS build configuration
- `docs/DEVELOPMENT_TESTING_DEPLOYMENT.md` - Development workflow guide

---

## Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Expo server stopped | `npm start` in app/ |
| Network unreachable | Check WiFi, firewall, machine IP |
| Cache corrupted | `expo start --clear` |
| Port 19000 blocked | Allow in Windows Firewall |
| Device can't find server | Use machine IP instead of localhost |

---

**Last Updated:** 2026-09-05  
**Status:** ✅ Ready for implementation
