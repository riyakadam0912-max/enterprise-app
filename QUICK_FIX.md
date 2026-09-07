# Quick Fix: Expo CLI Connection Issue

## 🔴 Current Problem
Mobile app shows: **"Cannot connect to Expo CLI"**

---

## ✅ Immediate Fix (1 Minute)

### **Step 1: Open PowerShell**
```powershell
cd C:\Users\91773\enterprise-app\app
```

### **Step 2: Start Expo Dev Server**
```powershell
npm start
```

**OR use the new launcher script:**
```powershell
..\start-expo.ps1 -Platform android
```

### **Step 3: Keep Terminal Open**
⚠️ **Important:** Do NOT close this terminal while developing

---

## ⏱️ Expected Timeline

| Step | Time | Status |
|------|------|--------|
| Navigate to app folder | 10s | ✓ |
| npm install (if needed) | 30-60s | ✓ |
| Expo server startup | 20-30s | 🚀 |
| Device connects | 5-10s | ✓ |
| **Total** | **~2 minutes** | **✅ Ready** |

---

## 🔍 How to Verify It Works

1. **In PowerShell**, you should see:
   ```
   Starting Expo server on http://localhost:19000
   ```

2. **On your mobile device/emulator**, the warning should disappear

3. **The app should load** without LogBox errors

---

## 🎯 What Gets Fixed

| Issue | Before | After |
|-------|--------|-------|
| Console Warning | ❌ "Cannot connect to Expo CLI" | ✅ Warning gone |
| Hot Reload | ❌ Broken | ✅ Works |
| Log Streaming | ❌ No device logs | ✅ Real-time logs |
| Development Speed | ❌ Slow (rebuild needed) | ✅ Fast (reload on save) |

---

## 📋 Pre-Requisites

- [x] Expo dependencies installed ✓ (already in package.json)
- [x] `usesCleartextTraffic` enabled ✓ (already in app.json)
- [x] Node.js and npm installed
- ✓ Mobile device/emulator on same WiFi network (if not using emulator)

---

## 🚨 If It Still Doesn't Work

1. **Check if Expo is still running:**
   ```powershell
   netstat -ano | findstr :19000
   ```

2. **Clear cache and restart:**
   ```powershell
   expo start --clear
   ```

3. **Full reset:**
   ```powershell
   rm -r node_modules
   npm install
   npm start
   ```

4. **Read detailed guide:** See `EXPO_CONNECTION_FIX.md` for troubleshooting

---

## 💡 Tips

- **For Android Emulator:** Automatically connects to localhost
- **For Physical Device:** Make sure WiFi network allows device-to-PC communication
- **Keep Terminal Running:** This is critical - the dev server must stay alive
- **Hot Reload:** Saves are automatically synced to device

---

## 📞 Reference Commands

```powershell
# Start for Android
npm run android

# Start for iOS (Mac only)
npm run ios

# Clear cache
expo start --clear

# Check what's running on port 19000
netstat -ano | findstr :19000

# Get your machine IP (for physical devices)
ipconfig | Select-String "IPv4 Address"
```

---

**File Created:** `start-expo.ps1` in root directory  
**Full Documentation:** `EXPO_CONNECTION_FIX.md`

Start your Expo server now! 🚀
